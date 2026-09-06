import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../model/seed'
import type {
  Connection,
  Entity,
  EntityKind,
  FlightPath,
  Scenario,
  SpecModel,
  Vec2,
} from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, MOUNT_HEIGHT_M, newId } from '../model/types'
import { FT_TO_M } from '../analysis/sensorEnv'
import { heldTracksSeries, kpiSeries, sampleCount, threatSeries } from '../analysis/series'
import { buildLiveTimeline, liveKpisAt } from '../analysis/liveStats'
import * as uncertainty from '../analysis/uncertainty'
import { PF_SPREAD, sampleScenario, uncertainFields } from '../analysis/uncertainty'
import { betaQuantile, wilson } from '../te/calc/stats'
import { resolveEngagements } from './attrition'
import { FALLOFF_AT_MAX } from './pk'
import { replicateLoop, runReplicates, runSensitivity, sensitivityLoop, summaryNumbers } from './mcRun'
import type { BandSeries, ExecutionBudget, McSummary } from './mcRun'
import type { DrawPolicy } from './policy'
import { deterministicPolicy, monteCarloPolicy } from './policy'
import { assessAllThreats } from './sim'
import { DT } from './clock'

// The module keeps its real behavior; the spy shows whether the loop called it.
vi.mock('../analysis/uncertainty', { spy: true })

/**
 * Regression laydown, as policy.test.ts: Giraffe 1X at the origin, Coyote
 * 2.4 km northeast, FAAD C2 600 m west, chain Giraffe -> C2 -> Coyote, ROE
 * free. Mohajer-6 (Swerling 1 pinned) inbound from 14 km north at 14000 ft;
 * Mavic 3 inbound from 3 km north. The Giraffe Pd model draws here.
 */
function laydown(): Scenario {
  const common = { headingDeg: 0, color: null, notes: '' }
  const s = emptyScenario()
  s.roe = 'free'
  const ent = (kind: EntityKind, specId: string, pos: Vec2, extra?: Partial<Entity>) => {
    const id = newId('e')
    s.entities.push({ id, name: specId, kind, specId, pos, ...common, ...extra })
    return id
  }
  const flight = (entityId: string, from: Vec2, to: Vec2) => {
    s.paths.push({ id: newId('p'), entityId, points: [from, to], speedMps: 0, startDelayS: 0 })
  }
  const link = (fromId: string, toId: string) => {
    s.connections.push({ id: newId('c'), fromId, toId, label: 'track data' })
  }
  const mohajer = s.library.find((m) => m.id === 'lib-mohajer6')!
  mohajer.uas = { ...mohajer.uas!, swerling: 1 }
  const radar = ent('sensor', 'lib-giraffe1x', { x: 0, y: 0 })
  const coyote = ent('effector', 'lib-coyote', { x: 1697, y: -1697 })
  const c2 = ent('c2', 'lib-faadc2', { x: -600, y: 0 })
  link(radar, c2)
  link(c2, coyote)
  const m6 = ent('uas', 'lib-mohajer6', { x: 0, y: -14000 }, { altitudeFt: 14000 })
  flight(m6, { x: 0, y: -14000 }, { x: 0, y: -800 })
  const mavic = ent('uas', 'lib-mavic3', { x: 0, y: -3000 })
  flight(mavic, { x: 0, y: -3000 }, { x: 0, y: -100 })
  return s
}

/**
 * Hand-built laydown, as attrition.doctrine.test.ts: a planning-basis radar
 * (no Pd draw) at the origin, one interceptor at the origin with a 20 km
 * envelope and a one-round magazine, and a group 4 fixed-wing target flying
 * east at 40 m/s from x = -1210. The threat flies at the mount height so the
 * slant range equals the ground range.
 */
const FIXTURE_ALT_FT = MOUNT_HEIGHT_M / FT_TO_M

const RADAR: SpecModel = {
  id: 'tst-radar',
  name: 'test radar',
  kind: 'sensor',
  description: '',
  color: '#fff',
  builtin: false,
  sensor: {
    sensorType: 'radar',
    role: 'surveillance',
    rangeBasis: 'planning',
    detectRangeM: 50000,
    classifyRangeM: null,
    sectorDeg: 360,
  },
}

const TARGET: SpecModel = {
  id: 'tst-uas',
  name: 'test uas',
  kind: 'uas',
  description: '',
  color: '#fff',
  builtin: false,
  uas: {
    group: 4,
    airframe: 'fixed-wing',
    cruiseSpeedMps: 40,
    maxSpeedMps: 60,
    enduranceMin: 60,
    altBandFt: [0, 5000],
    navMode: 'rf-manual',
    emissionsNote: '',
  },
}

function interceptor(pk: number): SpecModel {
  return {
    id: 'tst-int',
    name: 'tst-int',
    kind: 'effector',
    description: '',
    color: '#fff',
    builtin: false,
    effector: {
      effectorType: 'interceptor',
      minRangeM: 0,
      maxRangeM: 20000,
      engageTimeS: 0,
      magazineSize: 1,
      pk,
    },
  }
}

let seq = 0
function ent(kind: Entity['kind'], specId: string, pos: Vec2): Entity {
  seq += 1
  return {
    id: `${kind}-${seq}`,
    name: `${kind}-${seq}`,
    kind,
    specId,
    pos,
    headingDeg: 0,
    color: null,
    notes: '',
    ...(kind === 'uas' ? { altitudeFt: FIXTURE_ALT_FT } : {}),
  }
}

function link(fromId: string, toId: string): Connection {
  seq += 1
  return { id: `con-${seq}`, fromId, toId, label: '' }
}

function flight(entityId: string, points: Vec2[]): FlightPath {
  seq += 1
  return { id: `path-${seq}`, entityId, points, speedMps: 40, startDelayS: 0 }
}

interface Built {
  scenario: Scenario
  uasId: string
  effId: string
}

/**
 * Defended asset at the path end with a 200 m boundary. With it, a ship the
 * one salvo misses arrives, so the end-of-run leaker count is Bernoulli(1 - Pk)
 * and the stopping rule has a variance to work on.
 */
function asset(pos: Vec2): Entity {
  seq += 1
  return {
    id: `asset-${seq}`,
    name: `asset-${seq}`,
    kind: 'asset',
    specId: null,
    pos,
    headingDeg: 0,
    color: null,
    notes: '',
    defendedRadiusM: 200,
  }
}

function build(pk: number, from: Vec2 = { x: -1210, y: 0 }, withAsset = false): Built {
  const scenario = emptyScenario()
  scenario.roe = 'free'
  const eff = interceptor(pk)
  scenario.library = [...scenario.library, RADAR, TARGET, eff]
  const sensor = ent('sensor', RADAR.id, { x: 0, y: 0 })
  const effector = ent('effector', eff.id, { x: 0, y: 0 })
  const uas = ent('uas', TARGET.id, from)
  scenario.entities = [sensor, effector, uas]
  if (withAsset) scenario.entities.push(asset({ x: from.x + 4210, y: from.y }))
  scenario.connections = [link(sensor.id, effector.id)]
  scenario.paths = [flight(uas.id, [from, { x: from.x + 4210, y: from.y }])]
  return { scenario, uasId: uas.id, effId: effector.id }
}

const thresholdsOf = (s: Scenario) => ({ ...DEFAULT_REQUIREMENT_THRESHOLDS, ...s.requirements })

/** Pin `fields` of a library model with `spread: null` rows, so no sample touches them. */
function pin(model: SpecModel, fields: string[]): void {
  const rows = (model.provenance ?? []).filter((r) => !fields.includes(r.field))
  for (const field of fields) {
    rows.push({ field, value: '', source: 'pinned', date: '2026-09-04', basis: 'pf', spread: null })
  }
  model.provenance = rows
}

/**
 * The regression laydown with every spread pinned except the Mohajer
 * `rcsM2` (the table's 6 dB). Connection latencies and the declaration
 * dwell still sample from the PF table, and neither moves first detection.
 */
function rcsOnlyLaydown(): Scenario {
  const s = laydown()
  const lib = (id: string) => s.library.find((m) => m.id === id)!
  pin(lib('lib-giraffe1x'), ['detectRangeM', 'trackInitS'])
  pin(lib('lib-coyote'), ['pk', 'engageTimeS', 'targetS', 'bdaS'])
  pin(lib('lib-mavic3'), ['rcsM2'])
  return s
}

function bands(summary: McSummary): BandSeries[] {
  return [
    summary.kills,
    summary.leakers,
    summary.detected,
    summary.tracked,
    summary.engaged,
    ...Object.values(summary.perThreat).map((t) => t.residual),
  ]
}

function last(values: number[]): number {
  return values[values.length - 1]
}

describe('runReplicates', () => {
  it('same seed gives a deep-equal summary; a different seed differs', () => {
    const s = laydown()
    s.replicates = 20
    s.seed = 4821
    const a = runReplicates(s)
    const b = runReplicates(s)
    expect(a).toEqual(b)
    expect(a.elapsedMs).toBe(0)
    expect(a.seed).toBe(4821)
    expect(a.replicates).toBe(20)
    const other = { ...s, seed: 9001 }
    const c = runReplicates(other)
    expect(c.seed).toBe(9001)
    expect(JSON.stringify({ ...c, seed: 4821 })).not.toBe(JSON.stringify(a))
  })

  it('Pd 1 and Pk 1 give zero variance and match the deterministic totals', () => {
    // The per-shot Pk carries distanceFalloff below 1, so the spec value is
    // raised until the clamped product is exactly 1 at every envelope range.
    const { scenario, uasId, effId } = build(1 / (1 - FALLOFF_AT_MAX))
    scenario.replicates = 10
    const summary = runReplicates(scenario)
    // One ship and one track: every band is a 0/1 statistic, so a constant
    // column reads the rule-of-three bound, 3 / 10 from the observed end
    // the 95 percent quantiles are unavailable under 40.
    for (const band of bands(summary)) {
      for (let k = 0; k < band.mean.length; k += 1) {
        const m = band.mean[k]
        expect([0, 1]).toContain(m)
        expect(band.p10[k]).toBe(m)
        expect(band.p90[k]).toBe(m)
        expect(Number.isNaN(band.p025[k])).toBe(true)
        expect(Number.isNaN(band.p975[k])).toBe(true)
        expect(band.lo[k]).toBeCloseTo(m === 1 ? 0.7 : 0, 12)
        expect(band.hi[k]).toBeCloseTo(m === 1 ? 1 : 0.3, 12)
      }
    }
    const det = resolveEngagements(scenario)
    expect(det.totals.expectedKills).toBe(1)
    expect(last(summary.kills.mean)).toBe(det.totals.expectedKills)
    expect(summary.perThreat[uasId].killed.mean).toBe(1)
    expect(summary.perEffector[effId].salvos.mean).toBe(1)
    expect(summary.perEffector[effId].kills.mean).toBe(1)
    // Same assessments as the deterministic run, so the reproduced rules
    // must equal the chart builders sample for sample.
    expect(summary.tracked.mean).toEqual(heldTracksSeries(scenario).values)
    const residual = threatSeries(scenario, uasId).find((x) => x.id === 'residual')!
    expect(summary.perThreat[uasId].residual.mean).toEqual(residual.values)
    const kills = kpiSeries(scenario).find((x) => x.id === 'kpi.expectedKills')!
    expect(summary.kills.mean).toEqual(kills.values)
  })

  it('Pk 0.5 and one salvo give a kill mean near 0.5 over 200 replicates', () => {
    const { scenario, uasId, effId } = build(0.5)
    scenario.replicates = 200
    const summary = runReplicates(scenario)
    expect(summary.replicates).toBe(200)
    const kills = last(summary.kills.mean)
    expect(Math.abs(kills - 0.5)).toBeLessThan(0.1)
    expect(summary.perThreat[uasId].killed.mean).toBe(kills)
    expect(summary.perThreat[uasId].killed.n).toBe(200)
    expect(summary.perThreat[uasId].killed.p10).toBe(0)
    expect(summary.perThreat[uasId].killed.p90).toBe(1)
    expect(summary.perEffector[effId].salvos.mean).toBe(1)
    expect(summary.perEffector[effId].kills.mean).toBe(kills)
    // Bernoulli(0.5): sd near 0.5, se = sd / sqrt(200) near 0.035. A one-ship
    // kill count is a 0/1 statistic, so the interval is Wilson on k of 200
    // half-width near 1.96 * 0.5 / sqrt(200) = 0.07; the unbounded
    // salvo count keeps the t-interval.
    const killed = summary.perThreat[uasId].killed
    expect(Math.abs(killed.sd - 0.5)).toBeLessThan(0.05)
    expect(killed.se).toBeCloseTo(killed.sd / Math.sqrt(200), 12)
    expect(killed.conf).toBe(0.95)
    expect(killed.interval).toBe('wilson')
    const w = wilson(Math.round(kills * 200), 200)
    expect(killed.lo).toBe(w.lo)
    expect(killed.hi).toBe(w.hi)
    expect(Math.abs((killed.hi - killed.lo) / 2 - 0.07)).toBeLessThan(0.01)
    expect(summary.perEffector[effId].salvos.interval).toBe('t')
    expect(summary.perEffector[effId].kills.interval).toBe('wilson')
    expect(killed.total).toBe(200)
    expect(killed.defined).toEqual({ p: 1, lo: expect.any(Number), hi: 1 })
    expect(summary.stopped).toEqual({ rule: 'replicates', at: 200 })
  })

  it('one replicate gives sd 0, no quantiles, and an interval by kind', () => {
    // A 1 of 1 kill is a 0/1 statistic at k = n: the rule of three gives
    // 1 - 3 / 1, clamped to 0, up to 1. The unbounded salvo count keeps the
    // t-interval, lo = hi = mean with one sample.
    const { scenario, uasId, effId } = build(1 / (1 - FALLOFF_AT_MAX))
    scenario.replicates = 1
    const summary = runReplicates(scenario)
    const killed = summary.perThreat[uasId].killed
    const salvos = summary.perEffector[effId].salvos
    for (const stat of [killed, salvos]) {
      expect(stat.n).toBe(1)
      expect(stat.total).toBe(1)
      expect(stat.mean).toBe(1)
      expect(stat.sd).toBe(0)
      expect(stat.se).toBe(0)
      expect(Number.isNaN(stat.p10)).toBe(true)
      expect(Number.isNaN(stat.p975)).toBe(true)
      expect(stat.defined.p).toBe(1)
    }
    expect([killed.interval, killed.lo, killed.hi]).toEqual(['rule-of-three', 0, 1])
    expect([salvos.interval, salvos.lo, salvos.hi]).toEqual(['t', 1, 1])
  })

  it('each replicate keeps the raid partition, nominal and under total', () => {
    const s = laydown()
    for (const seed of [4821, 4822, 4823]) {
      const policy = monteCarloPolicy(seed, 0, thresholdsOf(s))
      const { totals } = resolveEngagements(s, assessAllThreats(s, policy), policy)
      const { expectedKills, expectedLeakers, expectedNoArrival, raidSize } = totals
      expect(expectedKills + expectedLeakers + expectedNoArrival).toBeCloseTo(raidSize, 9)
      // The same replicate on the sampled scenario the total loop builds.
      const sampled = sampleScenario(s, (m, f) => policy.param(m, f))
      const t = resolveEngagements(sampled, assessAllThreats(sampled, policy), policy).totals
      expect(t.expectedKills + t.expectedLeakers + t.expectedNoArrival).toBeCloseTo(t.raidSize, 9)
      expect(t.raidSize).toBe(raidSize)
    }
  })

  describe('parameter uncertainty', () => {
    afterEach(() => {
      vi.mocked(uncertainty.sampleScenario).mockReset()
    })

    it('aleatory equals an absent setting and never samples the scenario', () => {
      const s = laydown()
      s.replicates = 20
      const { uncertainty: _absent, ...rest } = s
      const absent = rest as Scenario
      const spy = vi.mocked(uncertainty.sampleScenario)
      spy.mockClear()
      const a = runReplicates(absent)
      const b = runReplicates({ ...s, uncertainty: 'aleatory' })
      expect(b).toEqual(a)
      expect(spy).not.toHaveBeenCalled()
      // The spy is live: a total run samples once per replicate.
      runReplicates({ ...s, uncertainty: 'total' })
      expect(spy).toHaveBeenCalledTimes(20)
    })

    it('total widens the Mohajer first-detection band', () => {
      // Only the Mohajer rcsM2 samples (6 dB lognormal). The Giraffe Pd is
      // SNR-driven and range scales by the fourth root of RCS: one sigma is
      // a factor 4 in RCS, a factor 1.41 in range, so the range at Pd 0.5
      // moves by about 40 percent each side across the p10 to p90 sample and
      // the first detecting scan moves with it, on top of the Pd draw noise
      // the aleatory band already holds.
      const s = rcsOnlyLaydown()
      s.replicates = 100
      const m6 = s.entities.find((e) => e.specId === 'lib-mohajer6')!.id
      const aleatory = runReplicates(s).perThreat[m6].firstDetectS
      const total = runReplicates({ ...s, uncertainty: 'total' }).perThreat[m6].firstDetectS
      expect(aleatory.n).toBe(100)
      expect(total.n).toBe(100)
      expect(total.p90 - total.p10).toBeGreaterThan(aleatory.p90 - aleatory.p10)
    })

    it('a field with spread null never changes under total', async () => {
      const actual = await vi.importActual<typeof uncertainty>('../analysis/uncertainty')
      const s = rcsOnlyLaydown()
      s.replicates = 5
      s.uncertainty = 'total'
      const giraffe = s.library.find((m) => m.id === 'lib-giraffe1x')!
      const nominalRange = giraffe.sensor!.detectRangeM
      const keys: string[] = []
      const spy = vi.mocked(uncertainty.sampleScenario)
      spy.mockImplementation((scenario, u) =>
        actual.sampleScenario(scenario, (m, f) => {
          keys.push(`${m}.${f}`)
          return u(m, f)
        }),
      )
      runReplicates(s)
      expect(spy).toHaveBeenCalledTimes(5)
      expect(keys.length).toBeGreaterThan(0)
      expect(keys).not.toContain('lib-giraffe1x.detectRangeM')
      expect(keys).toContain('lib-mohajer6.rcsM2')
      for (const r of spy.mock.results) {
        const built = r.value as Scenario
        expect(built.library.find((m) => m.id === 'lib-giraffe1x')!.sensor!.detectRangeM).toBe(
          nominalRange,
        )
        expect(built.library.find((m) => m.id === 'lib-mohajer6')!.uas!.rcsM2).not.toBe(
          s.library.find((m) => m.id === 'lib-mohajer6')!.uas!.rcsM2,
        )
      }
    })
  })

  it('replicate i depends on i only: direct policies reproduce the summary', () => {
    // Three replicates of the regression laydown, built directly with
    // monteCarloPolicy(seed, i, thresholds): their kill totals are the three
    // samples behind the summary's end-of-run kills band and per-threat killed
    // Stats, so the band mean is their mean and the Stat sd their sample sd.
    const s = laydown()
    s.replicates = 3
    s.seed = 4821
    const direct = [0, 1, 2].map((i) => {
      const policy = monteCarloPolicy(4821, i, thresholdsOf(s))
      return resolveEngagements(s, assessAllThreats(s, policy), policy)
    })
    const summary = runReplicates(s)
    const totals = direct.map((r) => r.totals.expectedKills)
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const sd = (xs: number[]) => {
      const m = mean(xs)
      return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1))
    }
    expect(last(summary.kills.mean)).toBeCloseTo(mean(totals), 12)
    for (const t of direct[0].threats) {
      const killed = direct.map((r) => r.threats.find((x) => x.uasId === t.uasId)!.expectedKills)
      expect(summary.perThreat[t.uasId].killed.mean).toBeCloseTo(mean(killed), 12)
      expect(summary.perThreat[t.uasId].killed.sd).toBeCloseTo(sd(killed), 12)
    }
    // Replicate 1 reads the same whether or not replicate 0 ran first.
    const p1 = monteCarloPolicy(4821, 1, thresholdsOf(s))
    const again = resolveEngagements(s, assessAllThreats(s, p1), p1)
    expect(again).toEqual(direct[1])
    // Replicates differ from one another somewhere in the sweep or the events.
    const texts = direct.map((r) => JSON.stringify(r))
    expect(new Set(texts).size).toBeGreaterThan(1)
  })

  it('common random numbers: an extra effector leaves the shared radar draws unchanged', () => {
    // The regression laydown, then the same scenario object plus one of:
    // a second Coyote at (300, -5000) on the Mohajer path (10 km envelope)
    // linked through the C2; a second Giraffe at (200, 0), whose phase and
    // detect draws interleave with the first radar's in engine order (a
    // stream policy would shift every later draw); a second Mohajer on a
    // parallel path at x = 400. Entity ids are shared, so every detect key of
    // the first Giraffe against the shared threats (sensor, uas, member,
    // step) and its phase key are the same parts in every run and read the
    // same uniforms; only the draws of the new entity are new.
    type DetectRecord = [string, string, number, number, boolean]
    const recording = (
      base: DrawPolicy,
      detects: DetectRecord[],
      phases: Array<[string, number]>,
    ): DrawPolicy => ({
      ...base,
      detect: (pd: number, sensorId: string, uasId: string, tS: number, memberIdx: number) => {
        const r = base.detect(pd, sensorId, uasId, tS, memberIdx)
        detects.push([sensorId, uasId, memberIdx, tS, r])
        return r
      },
      phase: (sensorId: string) => {
        const r = base.phase(sensorId)
        phases.push([sensorId, r])
        return r
      },
    })
    const run = (s: Scenario) => {
      const detects: DetectRecord[] = []
      const phases: Array<[string, number]> = []
      const policy = recording(monteCarloPolicy(4821, 0, thresholdsOf(s)), detects, phases)
      const report = resolveEngagements(s, assessAllThreats(s, policy), policy)
      return { detects, phases, report }
    }
    const base = laydown()
    const c2 = base.entities.find((e) => e.kind === 'c2')!
    const extraId = 'e-extra-coyote'
    const extra: Scenario = {
      ...base,
      entities: [
        ...base.entities,
        {
          id: extraId,
          name: 'lib-coyote',
          kind: 'effector',
          specId: 'lib-coyote',
          pos: { x: 300, y: -5000 },
          headingDeg: 0,
          color: null,
          notes: '',
        },
      ],
      connections: [
        ...base.connections,
        { id: 'c-extra', fromId: c2.id, toId: extraId, label: 'track data' },
      ],
    }
    const radarId = base.entities.find((e) => e.kind === 'sensor')!.id
    const uasIds = new Set(base.entities.filter((e) => e.kind === 'uas').map((e) => e.id))
    const withSensor: Scenario = {
      ...base,
      entities: [
        ...base.entities,
        {
          ...base.entities.find((e) => e.id === radarId)!,
          id: 'e-extra-radar',
          pos: { x: 200, y: 0 },
        },
      ],
      connections: [
        ...base.connections,
        { id: 'c-extra-radar', fromId: 'e-extra-radar', toId: c2.id, label: 'track data' },
      ],
    }
    const mohajer = base.entities.find((e) => e.specId === 'lib-mohajer6')!
    const withThreat: Scenario = {
      ...base,
      entities: [...base.entities, { ...mohajer, id: 'e-extra-uas', pos: { x: 400, y: -14000 } }],
      paths: [
        ...base.paths,
        {
          id: 'p-extra-uas',
          entityId: 'e-extra-uas',
          points: [
            { x: 400, y: -14000 },
            { x: 400, y: -800 },
          ],
          speedMps: 0,
          startDelayS: 0,
        },
      ],
    }
    const shared = (r: ReturnType<typeof run>) => ({
      detects: r.detects.filter((d) => d[0] === radarId && uasIds.has(d[1])),
      phases: r.phases.filter((p) => p[0] === radarId),
    })
    const a = run(base)
    expect(a.detects.length).toBeGreaterThan(0)
    expect(a.detects.every((d) => d[0] === radarId)).toBe(true)
    expect(a.phases.length).toBeGreaterThan(0)

    const b = run(extra)
    expect(shared(b)).toEqual(shared(a))
    // The extra effector took part, so the runs are not the same run.
    expect(b.report.events.some((e) => e.effectorId === extraId)).toBe(true)
    expect(a.report.events.some((e) => e.effectorId === extraId)).toBe(false)

    const c = run(withSensor)
    expect(shared(c)).toEqual(shared(a))
    // The second radar drew its own phase and detects, interleaved with the first.
    expect(c.phases.some((p) => p[0] === 'e-extra-radar')).toBe(true)
    expect(c.detects.some((d) => d[0] === 'e-extra-radar')).toBe(true)
    expect(c.detects.length).toBeGreaterThan(a.detects.length)

    // The phase is drawn once per (radar, threat) scan state from a key with
    // no threat part, so the third threat adds a third copy of the same value.
    const d = run(withThreat)
    expect(shared(d).detects).toEqual(shared(a).detects)
    const phi = shared(a).phases.map((p) => p[1])
    expect(phi).toHaveLength(uasIds.size)
    expect(shared(d).phases.map((p) => p[1])).toEqual([...phi, phi[0]])
    expect(d.detects.some((r) => r[1] === 'e-extra-uas')).toBe(true)
  })

  it('common random numbers: an earlier extra threat leaves the shared kill keys unchanged', () => {
    // The regression laydown plus a Mohajer-6 at (0, -2500) at 1000 ft on a
    // path to (0, -100) at 15 m/s: inside the Coyote envelope from t = 0,
    // large RCS so the Giraffe holds it from the first scans, closer to the
    // Coyote than the Mavic (a higher Pk), and slow enough that the kill
    // chain closes on it. The Coyote engages it before any shared threat.
    // The kill key counts salvos per (effector, threat, ship), so the shared
    // shots keep salvoIdx 0, 1, ... and read the same uniforms (a per-effector
    // count would shift every shared salvoIdx by at least one). The busy Coyote can
    // delay a shared shot, which moves its Pk and so its result under the
    // same uniform, so the assertion is on the key, not the result.
    type KillRecord = [string, string, number, number]
    const recording = (base: DrawPolicy, kills: KillRecord[]): DrawPolicy => ({
      ...base,
      kill: (pk, effectorId, uasId, shipIdx, salvoIdx, tS) => {
        kills.push([effectorId, uasId, shipIdx, salvoIdx])
        return base.kill(pk, effectorId, uasId, shipIdx, salvoIdx, tS)
      },
    })
    const run = (s: Scenario) => {
      const kills: KillRecord[] = []
      const policy = recording(monteCarloPolicy(4821, 0, thresholdsOf(s)), kills)
      const report = resolveEngagements(s, assessAllThreats(s, policy), policy)
      return { kills, report }
    }
    const base = laydown()
    const extraId = 'e-extra-mohajer'
    const extra: Scenario = {
      ...base,
      entities: [
        ...base.entities,
        {
          id: extraId,
          name: 'lib-mohajer6',
          kind: 'uas',
          specId: 'lib-mohajer6',
          pos: { x: 0, y: -2500 },
          headingDeg: 0,
          color: null,
          notes: '',
          altitudeFt: 1000,
        },
      ],
      paths: [
        ...base.paths,
        {
          id: 'p-extra-mohajer',
          entityId: extraId,
          points: [
            { x: 0, y: -2500 },
            { x: 0, y: -100 },
          ],
          speedMps: 15,
          startDelayS: 0,
        },
      ],
    }
    const a = run(base)
    const b = run(extra)
    const extraEvents = b.report.events.filter((e) => e.uasId === extraId)
    const sharedEvents = b.report.events.filter((e) => e.uasId !== extraId)
    expect(extraEvents.length).toBeGreaterThan(0)
    expect(sharedEvents.length).toBeGreaterThan(0)
    expect(extraEvents[0].tS).toBeLessThan(sharedEvents[0].tS)
    // The extra threat's salvo was drawn before any shared salvo.
    expect(b.kills[0][1]).toBe(extraId)
    // Non-vacuous: at least one shared kill record on both sides.
    const sharedB = b.kills.filter((k) => k[1] !== extraId)
    expect(sharedB.length).toBeGreaterThanOrEqual(1)
    expect(a.kills.length).toBeGreaterThanOrEqual(1)
    const uasIds = new Set(sharedB.map((k) => k[1]))
    for (const uasId of uasIds) {
      const seqA = a.kills.filter((k) => k[1] === uasId).map((k) => [k[0], k[2], k[3]])
      const seqB = sharedB.filter((k) => k[1] === uasId).map((k) => [k[0], k[2], k[3]])
      expect(seqB[0][2]).toBe(0)
      expect(seqB).toEqual(seqA.slice(0, seqB.length))
    }
  })

  it('reports progress after every 10th replicate and after the last', () => {
    const s = laydown()
    s.replicates = 25
    const calls: Array<[number, number]> = []
    runReplicates(s, (done, total) => calls.push([done, total]))
    expect(calls).toEqual([
      [10, 25],
      [20, 25],
      [25, 25],
    ])
  })

  it('samples every band on the chart grid and starts residual at the ship count', () => {
    const s = laydown()
    s.replicates = 10
    const n = sampleCount(s)
    const summary = runReplicates(s)
    expect(summary.durationS).toBeGreaterThan(0)
    expect(n).toBe(Math.ceil(summary.durationS / 0.5) + 1)
    for (const band of bands(summary)) {
      expect(band.mean).toHaveLength(n)
      expect(band.p10).toHaveLength(n)
      expect(band.p90).toHaveLength(n)
      expect(band.p025).toHaveLength(n)
      expect(band.p975).toHaveLength(n)
      expect(band.lo).toHaveLength(n)
      expect(band.hi).toHaveLength(n)
    }
    const ids = s.entities.filter((e) => e.kind === 'uas').map((e) => e.id)
    expect(Object.keys(summary.perThreat).sort()).toEqual([...ids].sort())
    for (const id of ids) {
      const t = summary.perThreat[id]
      expect(t.shipCount).toBe(1)
      expect(t.residual.mean[0]).toBe(t.shipCount)
      expect(t.arrivalS).toBeNull()
      expect(t.firstDetectS.n).toBe(10)
    }
    expect(summary.firstDetectS.n).toBe(10)
    // The earliest stable track file per replicate, at or after the
    // first hit, and the same as the deterministic value when Pd is 1 at the
    // first scan for the fire-control-quality radar.
    expect(summary.firmTrackS.n).toBe(10)
    expect(summary.firmTrackS.interval).toBe('t')
    expect(summary.firmTrackS.mean).toBeGreaterThanOrEqual(summary.firstDetectS.mean)
    // No asset: no arrival, no warning, no leaker.
    expect(summary.minWarningS.n).toBe(0)
    expect(last(summary.leakers.mean)).toBe(0)
  })

  it('a threat nothing detects gives an all-NaN Stat with n 0', () => {
    // 100 km north of the radar: outside the 50 km placard for the whole path.
    const { scenario, uasId } = build(1, { x: -1210, y: -100000 })
    scenario.replicates = 10
    const summary = runReplicates(scenario)
    const stat = summary.perThreat[uasId].firstDetectS
    expect(stat.n).toBe(0)
    expect(stat.total).toBe(10)
    const numeric = [stat.mean, stat.sd, stat.se, stat.lo, stat.hi]
    for (const v of [...numeric, stat.p10, stat.p90, stat.p025, stat.p975]) {
      expect(Number.isNaN(v)).toBe(true)
    }
    // wilson(0, 10): p 0, lo 0, hi = z^2 / (n + z^2) = 3.8416 / 13.8416.
    expect(stat.defined.p).toBe(0)
    expect(stat.defined.lo).toBe(0)
    expect(stat.defined.hi).toBeCloseTo(3.8416 / 13.8416, 6)
    expect(summary.firstDetectS.n).toBe(0)
    expect(Number.isNaN(summary.firstDetectS.mean)).toBe(true)
    expect(last(summary.detected.mean)).toBe(0)
    expect(last(summary.tracked.mean)).toBe(0)
    expect(summary.perThreat[uasId].killed.mean).toBe(0)
  })

  describe('stopping rule', () => {
    // End-of-run leakers with one Pk 0.5 salvo and an asset: Bernoulli(0.5),
    // a 0/1 count, so the displayed interval is Wilson with half-width
    // about 0.93 / sqrt(n) near p 0.5 (0.1140 at n 70, 0.1067 at 80). The rule
    // checks at 30, 40, 50, ...; a target of 0.1156 is crossed near n 68, so the
    // loop stops at 70 with the sample p where it lands; 3 SE on p-hat at n 70
    // moves the half-width by under 7 percent, which keeps the stop in 50 to 110.
    const TARGET_H = 0.1156

    it('stops before the cap once the leaker half-width is under the target', () => {
      const { scenario, uasId } = build(0.5, { x: -1210, y: 0 }, true)
      scenario.replicates = 1000
      scenario.targetHalfWidth = TARGET_H
      const calls: Array<[number, number]> = []
      const summary = runReplicates(scenario, (done, total) => calls.push([done, total]))
      expect(summary.stopped.rule).toBe('halfWidth')
      const at = summary.stopped.at
      expect(at % 10).toBe(0)
      expect(at).toBeGreaterThanOrEqual(50)
      expect(at).toBeLessThanOrEqual(110)
      expect(summary.replicates).toBe(at)
      const leaked = summary.perThreat[uasId].leaked
      expect(leaked.n).toBe(at)
      expect(leaked.total).toBe(at)
      expect((leaked.hi - leaked.lo) / 2).toBeLessThan(TARGET_H)
      expect(Math.abs(leaked.mean - 0.5)).toBeLessThan(3 * 0.5 / Math.sqrt(at))
      expect(last(summary.leakers.mean)).toBe(leaked.mean)
      expect(summary.kills.mean).toHaveLength(sampleCount(scenario))
      // Progress keeps the configured total and ends at the stop.
      expect(calls[calls.length - 1]).toEqual([at, 1000])
      expect(calls.every(([, total]) => total === 1000)).toBe(true)
    })

    it('never stops before 30: a loose target stops at exactly 30', () => {
      const { scenario } = build(0.5, { x: -1210, y: 0 }, true)
      scenario.replicates = 1000
      scenario.targetHalfWidth = 10
      const summary = runReplicates(scenario)
      expect(summary.stopped).toEqual({ rule: 'halfWidth', at: 30 })
      expect(summary.replicates).toBe(30)
      expect(summary.leakers.mean).toHaveLength(sampleCount(scenario))
    })

    it('runs every replicate under a null target or one the loop never reaches', () => {
      const { scenario } = build(0.5, { x: -1210, y: 0 }, true)
      scenario.replicates = 40
      const all = runReplicates(scenario)
      expect(all.stopped).toEqual({ rule: 'replicates', at: 40 })
      scenario.targetHalfWidth = 0.001
      const tight = runReplicates(scenario)
      expect(tight.stopped).toEqual({ rule: 'replicates', at: 40 })
      expect(tight.replicates).toBe(40)
    })
  })

  describe('execution budget and cancel', () => {
    const wide: ExecutionBudget = { retainedNumbers: Infinity, timeMs: Infinity }

    it('a stop at checkpoint k gives the summary of a k-replicate run', () => {
      const { scenario } = build(0.5, { x: -1210, y: 0 }, true)
      scenario.replicates = 40
      const loop = replicateLoop(scenario)
      let next = loop.next()
      while (!next.done && next.value.done < 7) next = loop.next()
      next = loop.next('cancelled')
      expect(next.done).toBe(true)
      const cancelled = next.value as McSummary
      expect(cancelled.stopped).toEqual({ rule: 'cancelled', at: 7 })
      expect(cancelled.replicates).toBe(7)
      const seven = runReplicates({ ...scenario, replicates: 7 })
      expect(cancelled).toEqual({ ...seven, stopped: cancelled.stopped })
    })

    it('the retained-number budget stops the loop at the replicate that reaches it', () => {
      const { scenario } = build(0.5, { x: -1210, y: 0 }, true)
      scenario.replicates = 40
      const n = sampleCount(scenario)
      // One track: 6 numbers per step per replicate, so the smallest budget the
      // summary (7 * 6 * n) passes is reached by the rows at replicate 7.
      const summary = runReplicates(scenario, undefined, { ...wide, retainedNumbers: 7 * 6 * n })
      expect(summary.stopped).toEqual({ rule: 'budget', at: 7 })
      expect(summary.replicates).toBe(7)
      expect(summary.leakers.mean).toHaveLength(n)
      expect(runReplicates(scenario, undefined, wide).stopped).toEqual({ rule: 'replicates', at: 40 })
    })

    it('the wall-time budget stops after the first replicate, and the last checkpoint takes no stop', () => {
      const { scenario } = build(0.5, { x: -1210, y: 0 }, true)
      scenario.replicates = 5
      expect(runReplicates(scenario, undefined, { ...wide, timeMs: 0 }).stopped)
        .toEqual({ rule: 'budget', at: 1 })
      const loop = replicateLoop({ ...scenario, replicates: 1 })
      loop.next()
      const done = loop.next('cancelled')
      expect(done.done).toBe(true)
      expect((done.value as McSummary).stopped).toEqual({ rule: 'replicates', at: 1 })
    })

    it('a summary over the budget is refused before the first replicate', () => {
      const { scenario } = build(0.5, { x: -1210, y: 0 }, true)
      const need = summaryNumbers(scenario)
      expect(need).toBe(7 * sampleCount(scenario) * 6)
      const cost = vi.spyOn(uncertainty, 'sampleScenario')
      expect(() => runReplicates(scenario, undefined, { ...wide, retainedNumbers: need - 1 }))
        .toThrow(/over the budget/)
      expect(cost).not.toHaveBeenCalled()
      expect(runReplicates(scenario, undefined, { ...wide, retainedNumbers: need }).stopped)
        .toEqual({ rule: 'budget', at: 7 })
    })
  })
})

/**
 * Sensitivity fixture: a target-scaled radar (rangeBasis absent, so RCS
 * moves its range and the Pd model runs) with a 20 km placard at the origin,
 * a group 4 fixed-wing target at the mount height inbound from 10 km west at
 * 40 m/s to an asset at the origin, and one interceptor at the origin with a
 * 3 km envelope, Pk 0.5 and one round, linked radar -> C2 -> interceptor,
 * doctrine on, ROE free. The target enters the envelope about 175 s after
 * the first scan, so first detection has no effect on the one shot.
 */
describe('runSensitivity', () => {
  const SENS_RADAR: SpecModel = {
    ...RADAR,
    id: 'sens-radar',
    name: 'sens radar',
    sensor: { ...RADAR.sensor!, rangeBasis: undefined, detectRangeM: 20000 },
  }
  const SENS_INT: SpecModel = {
    ...interceptor(0.5),
    id: 'sens-int',
    name: 'sens int',
    effector: { ...interceptor(0.5).effector!, maxRangeM: 3000 },
  }

  // Fixed literal ids: the draw keys hash the ids, so the fixture's draws
  // never depend on the file-level `seq` counter or on test order.
  const fixedEnt = (id: string, kind: Entity['kind'], specId: string | null, pos: Vec2) => ({
    ...ent(kind, specId ?? '', pos),
    id,
    name: id,
    specId,
  })

  function fixture(): Scenario {
    const s = emptyScenario()
    s.roe = 'free'
    s.library = [SENS_RADAR, TARGET, SENS_INT]
    const radar = fixedEnt('sens-sensor', 'sensor', SENS_RADAR.id, { x: 0, y: 0 })
    const c2 = fixedEnt('sens-c2', 'c2', null, { x: -300, y: 0 })
    const eff = fixedEnt('sens-eff', 'effector', SENS_INT.id, { x: 0, y: 0 })
    const uas = fixedEnt('sens-uas', 'uas', TARGET.id, { x: -10000, y: 0 })
    const target = { ...asset({ x: 0, y: 0 }), id: 'sens-asset', name: 'sens-asset' }
    s.entities = [radar, c2, eff, uas, target]
    s.connections = [
      { ...link(radar.id, c2.id), id: 'sens-l1' },
      { ...link(c2.id, eff.id), id: 'sens-l2' },
    ]
    s.paths = [{ ...flight(uas.id, [{ x: -10000, y: 0 }, { x: 0, y: 0 }]), id: 'sens-path' }]
    s.runMode = 'monte-carlo'
    s.seed = 4821
    s.replicates = 20
    return s
  }

  const only = (s: Scenario, modelId: string, field: string, q: number) =>
    sampleScenario(s, (m, f) => (m === modelId && f === field ? q : null))

  it('ranks pk above rcsM2 and matches the nominal of runReplicates', () => {
    const s = fixture()
    // RCS: the p10 and p90 of a 6 dB lognormal are z = -1.28 and +1.28, a
    // factor 10^(-0.77) = 0.17 to 10^(0.77) = 5.9 in RCS and, by the fourth
    // root, 0.64 to 1.56 in range: the placard moves between about 12.8 km
    // and 31 km, past the 10 km start, so first detection stays at the first
    // scan and the leaker mean does not move.
    const thresholds = thresholdsOf(s)
    const det = deterministicPolicy(thresholds)
    const firstDetectAt = (q: number) =>
      assessAllThreats(only(s, TARGET.id, 'rcsM2', q), det)[0].firstDetectS
    expect(firstDetectAt(0.1)).toBe(0)
    expect(firstDetectAt(0.9)).toBe(0)

    const summary = runSensitivity(s)
    expect(summary.stat).toBe('leakers')
    expect(summary.seed).toBe(4821)
    expect(summary.replicates).toBe(20)
    expect(summary.elapsedMs).toBe(0)
    const base = { ...s, uncertainty: 'aleatory' as const, targetHalfWidth: null }
    expect(summary.nominal).toBe(runReplicates(base).leakers.mean.at(-1))

    const pkRow = summary.rows.find((r) => r.field === 'pk')!
    const rcsRow = summary.rows.find((r) => r.field === 'rcsM2')!
    expect(pkRow.label).toBe('sens int')
    expect(rcsRow.label).toBe('test uas')
    expect(rcsRow.swing).toBe(0)
    expect(pkRow.swing).toBeGreaterThan(rcsRow.swing)
    // Pk: the p10 and p90 of the pseudo beta at 0.5 with 20 pseudo-trials,
    // Beta(10, 10), are about 0.36 and 0.64. The one shot lands at the
    // distance falloff f of the deterministic event (the same slant in every
    // replicate), so the paired swing is the fraction of kill uniforms in
    // [f * 0.36, f * 0.64), expected f * 0.28 = about 0.22, within 3 SE =
    // 3 * sqrt(0.22 * 0.78 / 20) = 0.28 at 20 replicates. More Pk, fewer
    // leakers: the p10 mean is at or above the p90 mean.
    const event = resolveEngagements(s, assessAllThreats(s, det), det).events[0]
    const f = event.pk / 0.5
    const q10 = betaQuantile(0.1, 10, 10)
    const q90 = betaQuantile(0.9, 10, 10)
    expect(Math.abs(q10 - 0.36)).toBeLessThan(0.01)
    expect(Math.abs(q90 - 0.64)).toBeLessThan(0.01)
    const expected = f * (q90 - q10)
    const se = Math.sqrt((expected * (1 - expected)) / 20)
    expect(Math.abs(pkRow.swing - expected)).toBeLessThan(3 * se)
    expect(pkRow.low).toBeGreaterThanOrEqual(pkRow.high)
    expect(pkRow.swing).toBe(Math.abs(pkRow.high - pkRow.low))
    // The per-replicate difference high - low is 0 or -1, so its
    // sample sd is sqrt(n / (n - 1) * p (1 - p)) with p the swing, and the
    // paired SE is that over sqrt(n): sqrt(p (1 - p) / (n - 1)). A row that
    // moves nothing has se 0.
    const p = pkRow.swing
    expect(pkRow.se).toBeCloseTo(Math.sqrt((p * (1 - p)) / 19), 12)
    expect(rcsRow.se).toBe(0)
  })

  it('pairing by common random numbers lowers the swing variance', () => {
    // The paired swing at one seed reads the same kill uniform on both sides
    // of every replicate, so the draw noise cancels and only the parameter
    // effect remains: the swing is the fraction of uniforms inside the p10
    // to p90 Pk window, Bernoulli(p) with p = f * 0.28 = about 0.22 (see the
    // ranking test), variance 0.17 / n. An unpaired swing takes two
    // independent Bernoulli means at effective Pk 0.29 and 0.51 and carries
    // both their noises, variance (0.20 + 0.25) / n = 0.45 / n. Over K seed
    // pairs, d_j is the difference of two paired swings (sd 0.59 / sqrt n)
    // and e_j the difference of two unpaired swings (sd 0.95 / sqrt n), a
    // ratio r = 0.62 that does not depend on n. With normal d and e, mean |d|
    // over K is 0.80 sd_d with sd 0.60 sd_d / sqrt K; the assertion
    // mean |d| < mean |e| fails at z = 0.80 (1 - r) / (0.60 sqrt((1 + r^2) /
    // K)) = 0.43 sqrt K, so K = 40 gives z = 2.7 and a failure probability
    // of about 0.3 percent under that model. n = 10 keeps the cost bounded.
    const K = 40
    const n = 10
    const s = { ...fixture(), replicates: n }
    // End-of-run leaker mean over n replicates, the arithmetic of
    // runReplicates(...).leakers.mean.at(-1) without the bands.
    const meanAt = (seed: number, q: number) => {
      const sq = only(s, SENS_INT.id, 'pk', q)
      const tEndS = (sampleCount(sq) - 1) * DT
      let sum = 0
      for (let i = 0; i < n; i += 1) {
        const policy = monteCarloPolicy(seed, i, thresholdsOf(sq))
        const assessments = assessAllThreats(sq, policy)
        const report = resolveEngagements(sq, assessments, policy)
        sum += liveKpisAt(buildLiveTimeline(assessments, report), tEndS).leakerShips
      }
      return sum / n
    }
    // runSensitivity's pk swing is this paired swing at the same seed.
    const swing = runSensitivity({ ...s, seed: 4821 }).rows.find((r) => r.field === 'pk')!.swing
    expect(swing).toBeCloseTo(Math.abs(meanAt(4821, 0.9) - meanAt(4821, 0.1)), 12)
    let sumD = 0
    let sumE = 0
    for (let j = 0; j < K; j += 1) {
      const sa = 4821 + 2 * j
      const sb = 4822 + 2 * j
      const [lo10, lo90, hi10, hi90] = [
        meanAt(sa, 0.1), meanAt(sa, 0.9), meanAt(sb, 0.1), meanAt(sb, 0.9),
      ]
      // Paired: each swing pairs its p10 and p90 means by seed and replicate.
      sumD += Math.abs(Math.abs(lo90 - lo10) - Math.abs(hi90 - hi10))
      // Unpaired: the p10 mean of one seed against the p90 mean of the other.
      sumE += Math.abs(Math.abs(hi90 - lo10) - Math.abs(lo90 - hi10))
    }
    expect(sumD / K).toBeLessThan(sumE / K)
  })

  it('reports progress once per field and sorts rows by swing, ties in field order', () => {
    const s = fixture()
    const fields = uncertainFields(s)
    expect(fields.length).toBeGreaterThan(2)
    const calls: Array<[number, number]> = []
    const summary = runSensitivity(s, (done, total) => calls.push([done, total]))
    expect(calls).toEqual(fields.map((_, k) => [k + 1, fields.length]))
    expect(summary.rows).toHaveLength(fields.length)
    for (let i = 1; i < summary.rows.length; i += 1) {
      expect(summary.rows[i - 1].swing).toBeGreaterThanOrEqual(summary.rows[i].swing)
    }
    // Only pk moves the one shot; every other row swings 0 and keeps the
    // uncertainFields order behind it.
    const key = (r: { modelId: string; field: string }) => `${r.modelId}.${r.field}`
    expect(summary.rows[0].field).toBe('pk')
    expect(summary.rows.slice(1).map(key)).toEqual(
      fields.filter((f) => f.field !== 'pk').map(key),
    )
    expect(summary.rows.slice(1).every((r) => r.swing === 0)).toBe(true)
    // Labels: the model name, the connection label or id, and Doctrine.
    const byKey = new Map(summary.rows.map((r) => [key(r), r.label]))
    expect(byKey.get('sens-radar.detectRangeM')).toBe('sens radar')
    expect(byKey.get('doctrine.declareHostileS')).toBe('Doctrine')
    const con = s.connections[0]
    expect(byKey.get(`${con.id}.latencyS`)).toBe(con.id)
    // Sampling one field leaves the input untouched.
    expect(s.uncertainty).toBe('aleatory')
    expect(PF_SPREAD.pk.spread.kind).toBe('beta')
  })

  it('a stop drops the field in progress and keeps the completed rows under `stopped`', () => {
    const s = fixture()
    const full = runSensitivity(s)
    expect('stopped' in full).toBe(false)
    expect(JSON.stringify(runSensitivity(s, undefined, { retainedNumbers: Infinity, timeMs: Infinity })))
      .toBe(JSON.stringify(full))
    const cut = runSensitivity(s, undefined, { retainedNumbers: Infinity, timeMs: 0 })
    expect(cut.stopped).toEqual({ rule: 'budget', at: 0 })
    expect(cut.rows).toEqual([])
    expect(Number.isNaN(cut.nominal)).toBe(true)
    // Cancel during the second field: the nominal and the first row survive.
    const loop = sensitivityLoop(s)
    let next = loop.next()
    while (!next.done && next.value.done < 1) next = loop.next()
    next = loop.next('cancelled')
    expect(next.done).toBe(true)
    const partial = next.value as ReturnType<typeof runSensitivity>
    expect(partial.stopped).toEqual({ rule: 'cancelled', at: 1 })
    expect(partial.nominal).toBe(full.nominal)
    expect(partial.rows).toHaveLength(1)
    expect(full.rows.map((r) => r.modelId + r.field)).toContain(partial.rows[0].modelId + partial.rows[0].field)
    expect(full.rows.find((r) => r.field === partial.rows[0].field)).toEqual(partial.rows[0])
  })
})

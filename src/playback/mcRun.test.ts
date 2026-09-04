import { describe, expect, it } from 'vitest'
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
import { FALLOFF_AT_MAX, resolveEngagements } from './attrition'
import { runReplicates } from './mcRun'
import type { BandSeries, McSummary } from './mcRun'
import type { DrawPolicy } from './policy'
import { monteCarloPolicy } from './policy'
import { assessAllThreats } from './sim'

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
    for (const band of bands(summary)) {
      for (let k = 0; k < band.mean.length; k += 1) {
        expect(band.p10[k]).toBe(band.mean[k])
        expect(band.p90[k]).toBe(band.mean[k])
        expect(band.p025[k]).toBe(band.mean[k])
        expect(band.p975[k]).toBe(band.mean[k])
        expect(band.lo[k]).toBe(band.mean[k])
        expect(band.hi[k]).toBe(band.mean[k])
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
    // Bernoulli(0.5): sd near 0.5, se = sd / sqrt(200) near 0.035, and the
    // 95 percent t-interval on the mean is symmetric with half-width near 0.07.
    const killed = summary.perThreat[uasId].killed
    expect(Math.abs(killed.sd - 0.5)).toBeLessThan(0.05)
    expect(killed.se).toBeCloseTo(killed.sd / Math.sqrt(200), 12)
    expect(killed.conf).toBe(0.95)
    expect(killed.hi - killed.mean).toBeCloseTo(killed.mean - killed.lo, 12)
    expect(Math.abs((killed.hi - killed.lo) / 2 - 0.07)).toBeLessThan(0.01)
    expect(killed.total).toBe(200)
    expect(killed.defined).toEqual({ p: 1, lo: expect.any(Number), hi: 1 })
    expect(summary.stopped).toEqual({ rule: 'replicates', at: 200 })
  })

  it('one replicate gives a Stat with lo = hi = mean and se 0', () => {
    const { scenario, uasId, effId } = build(1 / (1 - FALLOFF_AT_MAX))
    scenario.replicates = 1
    const summary = runReplicates(scenario)
    for (const stat of [summary.perThreat[uasId].killed, summary.perEffector[effId].salvos]) {
      expect(stat.n).toBe(1)
      expect(stat.total).toBe(1)
      expect(stat.mean).toBe(1)
      expect(stat.lo).toBe(1)
      expect(stat.hi).toBe(1)
      expect(stat.sd).toBe(0)
      expect(stat.se).toBe(0)
      expect(stat.p10).toBe(1)
      expect(stat.p975).toBe(1)
      expect(stat.defined.p).toBe(1)
    }
  })

  it('each replicate keeps the raid partition', () => {
    const s = laydown()
    for (const seed of [4821, 4822, 4823]) {
      const policy = monteCarloPolicy(seed, 0, thresholdsOf(s))
      const { totals } = resolveEngagements(s, assessAllThreats(s, policy), policy)
      const { expectedKills, expectedLeakers, expectedNoArrival, raidSize } = totals
      expect(expectedKills + expectedLeakers + expectedNoArrival).toBeCloseTo(raidSize, 9)
    }
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
    // sd about 0.5, so the 95 percent half-width is about 0.98 / sqrt(n)
    // (t about 1.98 at n near 100). The rule checks at 30, 40, 50, ...; a
    // target of 0.1156 is crossed near n 75 (0.98 / sqrt(75) = 0.113), so the
    // loop stops at 70 or 80 with the sample sd where it lands; 3 SE on p-hat
    // at n 70 moves the sd by under 7 percent, which keeps the stop in 50 to 110.
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
})

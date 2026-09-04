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
import { mulberry32 } from '../geometry/prng'
import { FALLOFF_AT_MAX, resolveEngagements } from './attrition'
import { runReplicates } from './mcRun'
import type { BandSeries, McSummary } from './mcRun'
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

function build(pk: number, from: Vec2 = { x: -1210, y: 0 }): Built {
  const scenario = emptyScenario()
  scenario.roe = 'free'
  const eff = interceptor(pk)
  scenario.library = [...scenario.library, RADAR, TARGET, eff]
  const sensor = ent('sensor', RADAR.id, { x: 0, y: 0 })
  const effector = ent('effector', eff.id, { x: 0, y: 0 })
  const uas = ent('uas', TARGET.id, from)
  scenario.entities = [sensor, effector, uas]
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
  })

  it('each replicate keeps the raid partition', () => {
    const s = laydown()
    for (const seed of [4821, 4822, 4823]) {
      const policy = monteCarloPolicy(mulberry32(seed), thresholdsOf(s))
      const { totals } = resolveEngagements(s, assessAllThreats(s, policy), policy)
      const { expectedKills, expectedLeakers, expectedNoArrival, raidSize } = totals
      expect(expectedKills + expectedLeakers + expectedNoArrival).toBeCloseTo(raidSize, 9)
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
    for (const v of [stat.mean, stat.p10, stat.p90, stat.p025, stat.p975]) {
      expect(Number.isNaN(v)).toBe(true)
    }
    expect(summary.firstDetectS.n).toBe(0)
    expect(Number.isNaN(summary.firstDetectS.mean)).toBe(true)
    expect(last(summary.detected.mean)).toBe(0)
    expect(last(summary.tracked.mean)).toBe(0)
    expect(summary.perThreat[uasId].killed.mean).toBe(0)
  })
})

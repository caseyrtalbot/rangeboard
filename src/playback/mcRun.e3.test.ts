import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Connection, Entity, EntityKind, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { MOUNT_HEIGHT_M, newId } from '../model/types'
import { FT_TO_M } from '../analysis/sensorEnv'
import { bandMean, countSub, statMean, timeStatSub } from '../panels/analysis/widgets/mc'
import { resolveEngagements } from './attrition'
import { runReplicates } from './mcRun'
import type { McSummary } from './mcRun'

/**
 * E3 statistical study tests (docs/field-te/model-evidence/uncertainty-crosswalk.md):
 * reproducibility and pairing under entity order, fixed n against optional
 * stopping at one seed, a rare outcome at small n, and an undefined time in the
 * panel sub-line. Every expected number is derived in the comment above it.
 */

/** Regression laydown, as mcRun.test.ts: Giraffe 1X, Coyote, FAAD C2, Mohajer-6, Mavic 3. */
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

/** Hand-built one-shot laydown, as mcRun.test.ts `build`: planning radar, one interceptor, asset. */
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

// Fixed literal ids: the draw keys hash the ids, so the fixture's draws never
// depend on test order.
function ent(kind: Entity['kind'], specId: string | null, pos: Vec2): Entity {
  return {
    id: `e3-${kind}`,
    name: `e3-${kind}`,
    kind,
    specId,
    pos,
    headingDeg: 0,
    color: null,
    notes: '',
    ...(kind === 'uas' ? { altitudeFt: FIXTURE_ALT_FT } : {}),
    ...(kind === 'asset' ? { defendedRadiusM: 200 } : {}),
  }
}

function build(pk: number, from: Vec2 = { x: -1210, y: 0 }): { scenario: Scenario; uasId: string } {
  const scenario = emptyScenario()
  scenario.roe = 'free'
  const eff = interceptor(pk)
  scenario.library = [...scenario.library, RADAR, TARGET, eff]
  const sensor = ent('sensor', RADAR.id, { x: 0, y: 0 })
  const effector = ent('effector', eff.id, { x: 0, y: 0 })
  const uas = ent('uas', TARGET.id, from)
  const end = { x: from.x + 4210, y: from.y }
  scenario.entities = [sensor, effector, uas, ent('asset', null, end)]
  const link: Connection = { id: 'e3-link', fromId: sensor.id, toId: effector.id, label: '' }
  scenario.connections = [link]
  const path: FlightPath = { id: 'e3-path', entityId: uas.id, points: [from, end], speedMps: 40, startDelayS: 0 }
  scenario.paths = [path]
  return { scenario, uasId: uas.id }
}

/** JSON with the per-id maps in sorted key order, so only the values are compared. */
function canonical(summary: McSummary): string {
  return JSON.stringify(summary, (key, value: unknown) =>
    key === 'perThreat' || key === 'perEffector'
      ? Object.fromEntries(Object.entries(value as object).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  )
}

function last(values: number[]): number {
  return values[values.length - 1]
}

describe('reproducibility and pairing', () => {
  it('two runs with one seed give byte-identical summaries, aleatory and total', () => {
    const s = { ...laydown(), replicates: 20, seed: 4821 }
    expect(JSON.stringify(runReplicates(s))).toBe(JSON.stringify(runReplicates(s)))
    const total = { ...s, uncertainty: 'total' as const }
    expect(JSON.stringify(runReplicates(total))).toBe(JSON.stringify(runReplicates(total)))
  })

  it('reversing entity, connection and path order with the same ids leaves every result the same', () => {
    // Every draw key is (seed, replicate, kind, id hashes, indices, step). The one
    // index that is an order, memberIdx, is a formation member's rank by slant
    // range (detection.ts admittedSlantsM), not an entity position; the kill key
    // counts salvos per (effector, threat, ship). So the same ids in another
    // array order read the same uniforms, and the summaries differ only in the
    // key order of the per-id maps.
    const s = { ...laydown(), replicates: 20, seed: 4821 }
    const reversed: Scenario = {
      ...s,
      entities: [...s.entities].reverse(),
      connections: [...s.connections].reverse(),
      paths: [...s.paths].reverse(),
      library: [...s.library].reverse(),
    }
    const a = runReplicates(s)
    const b = runReplicates(reversed)
    expect(last(a.kills.mean)).toBeGreaterThan(0)
    expect(canonical(b)).toBe(canonical(a))
    const at = runReplicates({ ...s, uncertainty: 'total' })
    const bt = runReplicates({ ...reversed, uncertainty: 'total' })
    expect(canonical(bt)).toBe(canonical(at))
    expect(canonical(at)).not.toBe(canonical(a))
  })
})

describe('stopping, rare outcomes and undefined times', () => {
  it('a half-width stop at n equals the fixed-n run at the same seed', () => {
    // End-of-run leakers with one Pk 0.5 salvo and an asset: Bernoulli(q) with
    // q = 1 - deterministic expectedKills = 0.5013 (the salvo's falloff Pk).
    // The 95 percent half-width is about 0.98 / sqrt(n); a target of 0.1156
    // is crossed near n 75, so the loop stops at 70 or 80 (mcRun.test.ts). A
    // replicate depends on its index only, so the stopped summary is the
    // fixed-n summary at that n: optional stopping picks n, not the estimate
    // at n. Both means sit within 3 SE = 3 * 0.5 / sqrt(70) = 0.179 of q.
    const { scenario, uasId } = build(0.5)
    const q = 1 - resolveEngagements(scenario).totals.expectedKills
    expect(Math.abs(q - 0.5013)).toBeLessThan(0.001)
    const stopped = runReplicates({ ...scenario, replicates: 1000, targetHalfWidth: 0.1156 })
    expect(stopped.stopped.rule).toBe('halfWidth')
    const n = stopped.stopped.at
    expect([70, 80]).toContain(n)
    const fixed = runReplicates({ ...scenario, replicates: n })
    expect(fixed.stopped).toEqual({ rule: 'replicates', at: n })
    expect(canonical(stopped)).toBe(canonical({ ...fixed, stopped: stopped.stopped }))
    const leaked = stopped.perThreat[uasId].leaked
    expect(Math.abs(leaked.mean - q)).toBeLessThan(0.179)
    expect(Math.abs(last(runReplicates({ ...scenario, replicates: 30 }).leakers.mean) - q))
      .toBeLessThan(3 * 0.5 / Math.sqrt(30))
  })

  it('a rare outcome at n 30 follows the count and the quantile band hides it', () => {
    // Pk 0.03 at the fixture's falloff is a per-shot kill probability of
    // 0.0291 (the deterministic expectedKills), the same slant in every
    // replicate, so kills are Bernoulli(0.0291) per replicate. P(1 of 30) =
    // 30 * 0.0291 * 0.9709^29 = 0.371 and P(0 of 30) = 0.9709^30 = 0.412; seeds
    // 3 and 1 land there. For 1 of 30 the sample mean is 1 / 30, the sample sd
    // sqrt(1 / 30) = 0.1826 (a Bernoulli sample with k = 1 has variance k (n - k)
    // / (n (n - 1)) = 1 / 30) and se = sd / sqrt(30) = 0.0333; the type-7 p90
    // is 0 and the p975 interpolates between the 29th and 30th order statistic
    // at position 0.975 * 29 = 28.275, so 0.275. For 0 of 30 every statistic is
    // 0 and the mean interval has zero width: that is arithmetic, not coverage;
    // the rule-of-three bound 3 / 30 = 0.1 is the statement an adequacy rule
    // gives. The t-interval lower bound for 1 of 30 is 1 / 30 - 2.045 * 0.0333 =
    // -0.035, below the support of a count; that behavior is recorded in the
    // crosswalk and not asserted here.
    const { scenario, uasId } = build(0.03)
    const p = resolveEngagements(scenario).totals.expectedKills
    expect(Math.abs(p - 0.0291)).toBeLessThan(0.0001)
    const one = runReplicates({ ...scenario, seed: 3, replicates: 30 }).perThreat[uasId].killed
    expect(one.n).toBe(30)
    expect(one.mean).toBeCloseTo(1 / 30, 12)
    expect(one.sd).toBeCloseTo(Math.sqrt(1 / 30), 12)
    expect(one.se).toBeCloseTo(Math.sqrt(1 / 30) / Math.sqrt(30), 12)
    expect(one.p10).toBe(0)
    expect(one.p90).toBe(0)
    expect(one.p975).toBeCloseTo(0.275, 12)
    expect(one.defined).toEqual({ p: 1, lo: expect.any(Number), hi: 1 })
    const none = runReplicates({ ...scenario, seed: 1, replicates: 30 }).perThreat[uasId].killed
    expect(none.mean).toBe(0)
    expect(none.sd).toBe(0)
    expect(none.lo).toBe(0)
    expect(none.hi).toBe(0)
    expect(none.p975).toBe(0)
  })

  it('an undefined time reads unavailable in the panel sub-line while a count reads zero', () => {
    // 100 km north of the radar: outside the 50 km placard for the whole path,
    // so no replicate detects. The time Stat has n 0 and the panel helpers keep
    // it unavailable with its 0 of 10 denominator; the detected count at the
    // last step is a defined 0 in every replicate, with a zero-width mean CI.
    const { scenario } = build(1, { x: -1210, y: -100000 })
    const summary = runReplicates({ ...scenario, replicates: 10 })
    expect(summary.firstDetectS.n).toBe(0)
    expect(summary.firstDetectS.total).toBe(10)
    expect(statMean(summary.firstDetectS)).toBeNull()
    expect(timeStatSub(summary.firstDetectS, 'detected'))
      .toBe('MC estimate unavailable · detected in 0 of 10')
    expect(timeStatSub(summary.minWarningS, 'warning'))
      .toBe('MC estimate unavailable · warning time in 0 of 10')
    const k = summary.detected.mean.length - 1
    expect(bandMean(summary.detected, k, 10)).toBe(0)
    expect(countSub(summary.detected, k, 10)).toBe('MC mean · ±0 (95% mean CI) · n=10')
  })
})

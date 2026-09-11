import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Connection, Entity, EntityKind, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { MOUNT_HEIGHT_M, newId } from '../model/types'
import { FT_TO_M } from '../analysis/sensorEnv'
import { bandMean, countSub, statMean, timeStatSub } from '../panels/analysis/mc'
import { wilson } from '../analysis/stats'
import { resolveEngagements } from './attrition'
import { FALLOFF_AT_MAX } from './pk'
import { runReplicates } from './mcRun'
import type { McSummary } from './mcRun'

/**
 * Statistical checks: reproducibility and pairing under entity order, fixed n
 * against optional stopping at one seed, a rare outcome at small n, and an
 * undefined time in the panel sub-line. Every expected number is derived in
 * the comment above it.
 */

/** Regression laydown, as mcRun.test.ts: Giraffe 1X, Coyote, FAAD C2, Mohajer-6, Mavic 3. */
function laydown(): Scenario {
  const common = { headingDeg: 0, color: null, notes: '' }
  const s = emptyScenario()
  s.physics = [
    'singlePulseRadar', 'noFlightLimits', 'rfBandGate', 'eoirSpanRatio',
    'legacyKineticPk', 'legacyBeamPk',
  ]
  // The fresh scenario runs Monte Carlo under total uncertainty with a half-width
  // stop; every number here is pinned on the aleatory, fixed-n run.
  s.runMode = 'deterministic'
  s.uncertainty = 'aleatory'
  s.targetHalfWidth = null
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
  scenario.runMode = 'deterministic'
  scenario.uncertainty = 'aleatory'
  scenario.targetHalfWidth = null
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
    // The displayed Wilson half-width is about 0.93 / sqrt(n) near p 0.5; a
    // target of 0.1156 is crossed near n 68, so the loop stops at 70
    // (mcRun.test.ts, and the stop-rule test below). A
    // replicate depends on its index only, so the stopped summary is the
    // fixed-n summary at that n: optional stopping picks n, not the estimate
    // at n. Both means sit within 3 SE = 3 * 0.5 / sqrt(70) = 0.179 of q.
    const { scenario, uasId } = build(0.5)
    const q = 1 - resolveEngagements(scenario).totals.expectedKills
    expect(Math.abs(q - 0.5013)).toBeLessThan(0.001)
    const stopped = runReplicates({ ...scenario, replicates: 1000, targetHalfWidth: 0.1156 })
    expect(stopped.stopped.rule).toBe('halfWidth')
    const n = stopped.stopped.at
    expect(n).toBe(70)
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
    // 0. The killed count of a one-ship threat is a 0/1 statistic:
    // 1 of 30 takes the Wilson interval, 0.0059 to 0.167 (wilson(1, 30)), and
    // 0 of 30 the rule-of-three bound, 0 to 3 / 30 = 0.1, in place of the
    // t-interval (1 / 30 - 2.045 * 0.0333 = -0.035, below the support) and the
    // zero-width interval. The p975 at 30 replicates is unavailable
    // (BAND95_MIN_N 40).
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
    expect(Number.isNaN(one.p975)).toBe(true)
    expect(one.interval).toBe('wilson')
    const w = wilson(1, 30)
    expect(one.lo).toBe(w.lo)
    expect(one.hi).toBe(w.hi)
    expect(Math.abs(w.lo - 0.0059)).toBeLessThan(0.0001)
    expect(Math.abs(w.hi - 0.167)).toBeLessThan(0.001)
    expect(one.defined).toEqual({ p: 1, lo: expect.any(Number), hi: 1 })
    const none = runReplicates({ ...scenario, seed: 1, replicates: 30 }).perThreat[uasId].killed
    expect(none.mean).toBe(0)
    expect(none.sd).toBe(0)
    expect(none.interval).toBe('rule-of-three')
    expect(none.lo).toBe(0)
    expect(none.hi).toBeCloseTo(0.1, 12)
    expect(none.p90).toBe(0)
    expect(Number.isNaN(none.p975)).toBe(true)
  })

  it('replicate quantiles need 10 samples for p10/p90 and 40 for p025/p975', () => {
    // At 9 replicates no quantile is reported, at 10 the 80 percent
    // pair is, at 40 both pairs are. Pd 1 and Pk 1 give a constant 1, so
    // every reported quantile equals the mean.
    const { scenario, uasId } = build(1 / (1 - FALLOFF_AT_MAX))
    const at = (replicates: number) => runReplicates({ ...scenario, replicates }).perThreat[uasId].killed
    const nine = at(9)
    for (const v of [nine.p10, nine.p90, nine.p025, nine.p975]) expect(Number.isNaN(v)).toBe(true)
    const ten = at(10)
    expect([ten.p10, ten.p90]).toEqual([1, 1])
    expect(Number.isNaN(ten.p025)).toBe(true)
    const forty = at(40)
    expect([forty.p10, forty.p90, forty.p025, forty.p975]).toEqual([1, 1, 1, 1])
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
    // wilson(0, 10): 0 to 3.8416 / 13.8416 = 0.2775, shown as whole percents.
    expect(timeStatSub(summary.firstDetectS, 'detected'))
      .toBe('MC estimate unavailable · detected in 0 of 10 · 0% to 28% (95% Wilson)')
    expect(timeStatSub(summary.minWarningS, 'warning'))
      .toBe('MC estimate unavailable · warning time in 0 of 10 · 0% to 28% (95% Wilson)')
    // One track, so the detected count is a 0/1 statistic: 0 of 10 reads the
    // rule-of-three bound 0 to 0.3, printed as the interval, not a half-width.
    const k = summary.detected.mean.length - 1
    expect(bandMean(summary.detected, k, 10)).toBe(0)
    expect(countSub(summary.detected, k, 10)).toBe('MC mean · 0 to 0.3 (95% mean CI) · n=10')
  })

  it('a defined time under 30 replicates shows the defined fraction but no mean CI', () => {
    // Every replicate detects at the first scan (planning radar, Pd 1), so the
    // time is defined in 10 of 10: wilson(10, 10) is 0.722 to 1 (72% to 100%),
    // and the mean CI is withheld under TIME_CI_MIN_N 30.
    const { scenario } = build(1)
    const summary = runReplicates({ ...scenario, replicates: 10 })
    expect(summary.firstDetectS.n).toBe(10)
    expect(summary.firstDetectS.interval).toBe('t')
    expect(timeStatSub(summary.firstDetectS, 'detected')).toBe(
      'MC conditional mean · first single-scan hit · mean CI unavailable under 30 defined · n=10 · detected in 10 of 10 · 72% to 100% (95% Wilson)',
    )
  })
})

describe('bounded counts over more than one ship and the displayed-interval stop', () => {
  it('an all-zero multi-ship kill count reports 3 max / n; all at max the mirror; salvos unchanged', () => {
    // A three-ship formation against an interceptor whose 1 m reach
    // never binds: no shot, no kill, every ship alive to the end. Killed and
    // leaked are counts over 3 ships; residual at step 0 is 3 in every
    // replicate. At 0 of 30 the mean's upper bound is 3 * 3 / 30 = 0.3 (no
    // independence between ships), at 3 of 3 the mirror 3 - 0.3 = 2.7 (the
    // default taken for a finite support); the unbounded salvos count keeps
    // its clamped t-interval, zero width at 0 of 30.
    const { scenario, uasId } = build(0.5)
    const uas = scenario.entities.find((e) => e.id === uasId)!
    uas.formation = { count: 3, shape: 'line', spacingM: 50 }
    const eff = scenario.library.find((m) => m.id === 'tst-int')!
    eff.effector = { ...eff.effector!, maxRangeM: 1 }
    const summary = runReplicates({ ...scenario, replicates: 30 })
    const t = summary.perThreat[uasId]
    expect(t.shipCount).toBe(3)
    expect(t.killed.mean).toBe(0)
    expect(t.killed.interval).toBe('rule-of-three')
    expect(t.killed.lo).toBe(0)
    expect(t.killed.hi).toBeCloseTo(0.3, 12)
    expect(t.residual.mean[0]).toBe(3)
    expect(t.residual.lo[0]).toBeCloseTo(2.7, 12)
    expect(t.residual.hi[0]).toBe(3)
    expect(last(summary.kills.hi)).toBeCloseTo(0.3, 12)
    expect(countSub(summary.kills, summary.kills.mean.length - 1, 30))
      .toBe('MC mean · 0 to 0.3 (95% mean CI) · n=30')
    const salvos = summary.perEffector['e3-effector'].salvos
    expect(salvos.mean).toBe(0)
    expect(salvos.interval).toBe('t')
    expect(salvos.lo).toBe(0)
    expect(salvos.hi).toBe(0)
  })

  it('the stop rule reads the displayed leaker interval, not the t half-width', () => {
    // Leakers on a one-ship raid are 0/1, so the displayed interval is
    // Wilson (or the rule of three at 0 of n), and the stop rule tests its
    // half-width through the same statOf path. At the fixture's q 0.5013 the
    // Wilson half-width at n is z / (1 + z^2 / n) * sqrt(p (1 - p) / n + z^2 /
    // (4 n^2)): 0.1140 at 70 for p 0.5, under the t half-width 1.994 * 0.5036 /
    // sqrt(70) = 0.1200 there, so the target 0.1156 is met at 70 where the t
    // rule needed 80 (mcRun.test.ts). The stopped n is the first checkpoint
    // whose displayed half-width is under the target: the run 10 shorter is not.
    const { scenario, uasId } = build(0.5)
    const target = 0.1156
    const stopped = runReplicates({ ...scenario, replicates: 1000, targetHalfWidth: target })
    expect(stopped.stopped).toEqual({ rule: 'halfWidth', at: 70 })
    const leaked = stopped.perThreat[uasId].leaked
    expect(leaked.interval).toBe('wilson')
    const w = wilson(Math.round(leaked.mean * 70), 70)
    expect((leaked.hi - leaked.lo) / 2).toBeCloseTo((w.hi - w.lo) / 2, 12)
    expect((leaked.hi - leaked.lo) / 2).toBeLessThan(target)
    const shorter = runReplicates({ ...scenario, replicates: 60 }).perThreat[uasId].leaked
    expect((shorter.hi - shorter.lo) / 2).toBeGreaterThanOrEqual(target)
    // Every ship leaks when the interceptor's 1 m reach never binds: 1 of 1 in
    // every replicate, the rule-of-three mirror 1 - 3 / n to 1, half-width
    // 1.5 / n: 0.05 at 30 and 0.0375 at 40, so a target of 0.04 stops at 40
    // (the t half-width of a constant sample would be 0 at 30).
    const eff = scenario.library.find((m) => m.id === 'tst-int')!
    eff.effector = { ...eff.effector!, maxRangeM: 1 }
    const all = runReplicates({ ...scenario, replicates: 1000, targetHalfWidth: 0.04 })
    expect(all.stopped).toEqual({ rule: 'halfWidth', at: 40 })
    const one = all.perThreat[uasId].leaked
    expect(one.mean).toBe(1)
    expect(one.interval).toBe('rule-of-three')
    expect(one.lo).toBeCloseTo(0.925, 12)
    expect(one.hi).toBe(1)
  })
})

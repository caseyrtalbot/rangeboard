import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type {
  Connection,
  Entity,
  FlightPath,
  FormationSpec,
  Scenario,
  SensorSpec,
  SpecModel,
  Vec2,
} from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, MOUNT_HEIGHT_M } from '../model/types'
import { FT_TO_M, radarCalibration, radarPdAt } from '../analysis/sensorEnv'
import { mOfN, rangeForPd } from '../analysis/radarPd'
import { resolveEngagements } from './attrition'
import { runReplicates } from './mcRun'
import { monteCarloPolicy } from './policy'
import { assessAllThreats } from './sim'
import { stepIndex } from './clock'

/**
 * CLOSED-FORM CONVERGENCE of the replicate engine.
 * Every expected number below is derived by hand in the comment above the
 * assertion; none is copied from engine output. Each Monte Carlo assertion
 * is within 3 standard errors at 1000 replicates. For a proportion p over n
 * replicates the standard error is sqrt(p (1 - p) / n) (`proportionSe`).
 *
 * Shared facts, verified against sim.ts, policy.ts and attrition.ts:
 * - The sweep samples at DT = 0.5 s from the path delay (0 here) and stops
 *   at the path end. A scan radar with a stated period P takes scan k
 *   (1-indexed) at the nominal time (phi + k - 1) P, snapped forward to the
 *   first step at or after it, where phi in [0, 1) is the replicate's phase
 *   draw. P = 4 is a multiple of DT, so scan k lands at snap(phi P) +
 *   (k - 1) P: the phase moves the origin, never the spacing.
 * - Every phase phi here is strictly inside (0, 1) with phi P > 1e-6 (the
 *   scan tolerance), asserted before the replicates. Then scan k of every
 *   replicate is at or before k P, and scan k + 1 is after k P, so the step
 *   at t = k P sees exactly k scans in every replicate.
 * - The replicate policy ignores the requirement thresholds: a detect draw
 *   is u < Pd, a kill or jam draw is u < p, so pdDetect and
 *   pdTrackCumulative are set low only to state that the threshold is not
 *   the question.
 * - Doctrine is OFF: the gate is the first
 *   detection under ROE free, the first salvo fires at t = 0 and each later
 *   salvo at the previous salvo plus salvoCooldownS while the window holds.
 *   With no flyout speed and engageTimeS 0 the effect lands at the release
 *   step, inline, so the kill draw of salvo 1 decides whether salvo 2 fires.
 */

const REPLICATES = 1000
const SEED = 4821

/** Standard error of a proportion p estimated over n Bernoulli replicates. */
function proportionSe(p: number, n: number): number {
  return Math.sqrt((p * (1 - p)) / n)
}

/**
 * Fixture altitude: the threat flies at the default mount height, so the
 * slant range from every phase center and launcher equals the ground range.
 */
const FIXTURE_ALT_FT = MOUNT_HEIGHT_M / FT_TO_M

const thresholdsOf = (s: Scenario) => ({ ...DEFAULT_REQUIREMENT_THRESHOLDS, ...s.requirements })

/** A fresh scenario with the environment off, ROE free and doctrine off. */
function baseScenario(): Scenario {
  const s = emptyScenario()
  s.environment = { ...s.environment, apply: false }
  s.roe = 'free'
  s.doctrine = { ...s.doctrine!, enabled: false }
  s.requirements = { ...s.requirements, pdDetect: 0.1, pdTrackCumulative: 0.01 }
  s.seed = SEED
  s.replicates = REPLICATES
  return s
}

let seq = 0
function ent(
  kind: Entity['kind'],
  specId: string | null,
  pos: Vec2,
  extra?: Partial<Entity>,
): Entity {
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
    ...extra,
  }
}

function link(fromId: string, toId: string): Connection {
  seq += 1
  return { id: `con-${seq}`, fromId, toId, label: '' }
}

function flight(entityId: string, points: Vec2[], speedMps: number): FlightPath {
  seq += 1
  return { id: `path-${seq}`, entityId, points, speedMps, startDelayS: 0 }
}

type SpecBody = Omit<SpecModel, 'id' | 'name' | 'description' | 'color' | 'builtin'>

function model(id: string, spec: SpecBody): SpecModel {
  return { id, name: id, description: '', color: '#fff', builtin: false, ...spec }
}

/**
 * Hand-built 4 s scan radar, placard 4000 m against 0.01 m2 at Pd 0.5 and
 * Pfa 1e-6 (the placard planning factors), M-of-N pinned at 3 of 5.
 */
const PERIOD_S = 4
const SCAN_M = 3
const SCAN_N = 5
const SCAN_RADAR: SensorSpec = {
  sensorType: 'radar',
  role: 'surveillance',
  detectRangeM: 4000,
  refRcsM2: 0.01,
  classifyRangeM: null,
  sectorDeg: 360,
  updateRateS: PERIOD_S,
  trackInitM: SCAN_M,
  trackInitN: SCAN_N,
}

/**
 * The single-scan Pd every scan draws at. The range is the closed-form
 * inverse of the Swerling 1 Pd curve at Pd 0.45, so the Pd the engine
 * reads there is 0.45 by construction:
 *   snr0 = ln(1e-6) / ln(0.5) - 1 = 19.93 - 1 = 18.93 (the placard SNR)
 *   need = ln(1e-6) / ln(0.45) - 1 = 17.30 - 1 = 16.30
 *   r = 4000 * (18.93 / 16.30) ^ (1 / 4) = 4000 * 1.0381 = 4152 m
 * and Pd(r) = 1e-6 ^ (1 / (1 + 16.30)) = exp(-13.816 / 17.30) = 0.45.
 */
const SCAN_PD = 0.45

interface ScanFixture {
  scenario: Scenario
  sensorId: string
  uasId: string
  rangeM: number
}

/**
 * One quad (0.01 m2, Swerling 1 pinned) flies a 120 m chord tangent to the
 * Pd 0.45 circle at 5 m/s (24 s): the chord ends sit at the same range and
 * the midpoint is the tangent point, so the slant varies by
 * sqrt(r^2 + 60^2) - r = 3600 / (2 r) = 0.43 m along the whole path and the
 * Pd by under 5e-4 (asserted). Scan 5 of the latest phase lands at or
 * before 20 s, inside the 24 s flight. No effector: detection only.
 */
function scanFixture(): ScanFixture {
  const s = baseScenario()
  const rangeM = rangeForPd(radarCalibration(SCAN_RADAR), 0.01, SCAN_PD, 1, 1)
  s.library.push(
    model('tst-cv-radar', { kind: 'sensor', sensor: SCAN_RADAR }),
    model('tst-cv-quad', {
      kind: 'uas',
      uas: {
        group: 1,
        airframe: 'quad',
        cruiseSpeedMps: 5,
        maxSpeedMps: 5,
        enduranceMin: 60,
        altBandFt: [0, 400],
        navMode: 'gps',
        emissionsNote: '',
        rcsM2: 0.01,
        swerling: 1,
      },
    }),
  )
  const radar = ent('sensor', 'tst-cv-radar', { x: 0, y: 0 })
  const uas = ent('uas', 'tst-cv-quad', { x: rangeM, y: -60 })
  s.entities.push(radar, uas)
  s.paths.push(
    flight(
      uas.id,
      [
        { x: rangeM, y: -60 },
        { x: rangeM, y: 60 },
      ],
      5,
    ),
  )
  return { scenario: s, sensorId: radar.id, uasId: uas.id, rangeM }
}

/** Assert the Pd the engine reads is 0.45 at the tangent and within 5e-4 at the chord ends. */
function assertScanPd(f: ScanFixture): void {
  const uasSpec = f.scenario.library.find((m) => m.id === 'tst-cv-quad')!.uas
  const env = f.scenario.environment
  const atTangent = radarPdAt(SCAN_RADAR, env, uasSpec, f.rangeM)!
  const atEnd = radarPdAt(SCAN_RADAR, env, uasSpec, Math.hypot(f.rangeM, 60))!
  expect(Math.abs(atTangent - SCAN_PD)).toBeLessThan(1e-9)
  expect(Math.abs(atEnd - SCAN_PD)).toBeLessThan(5e-4)
}

/** Assert every replicate's phase draw is inside (0, 1) with phi P above the scan tolerance. */
function assertPhases(f: ScanFixture): void {
  const thresholds = thresholdsOf(f.scenario)
  for (let i = 0; i < REPLICATES; i += 1) {
    const phi = monteCarloPolicy(SEED, i, thresholds).phase(f.sensorId)
    expect(phi * PERIOD_S).toBeGreaterThan(1e-6)
    expect(phi).toBeLessThan(1)
  }
}

describe('case 1: cumulative detection by scan k at constant Pd', () => {
  /**
   * Each scan is an independent Bernoulli(0.45) trial, so the probability of
   * a first detection by scan k is 1 - 0.55 ^ k:
   *   k = 1  0.45
   *   k = 2  1 - 0.3025       = 0.6975
   *   k = 3  1 - 0.166375     = 0.833625
   *   k = 4  1 - 0.09150625   = 0.90849375
   *   k = 5  1 - 0.0503284375 = 0.9496715625
   * The `detected` band counts the tracks with firstDetectS at or before the
   * step. Scan k of every replicate is at or before k P = 4 k s (index 8 k)
   * and scan k + 1 is after it (see the phase facts at the top), so the
   * band mean at index 8 k is the fraction detected within k scans.
   */
  it('the detected band at t = k P follows 1 - (1 - Pd)^k within 3 SE', () => {
    const f = scanFixture()
    assertScanPd(f)
    assertPhases(f)
    const summary = runReplicates(f.scenario)
    expect(summary.replicates).toBe(REPLICATES)
    // No phase draw reaches t = 0, so nothing is detected at the first step.
    expect(summary.detected.mean[0]).toBe(0)
    const expected = [0.45, 0.6975, 0.833625, 0.90849375, 0.9496715625]
    expected.forEach((p, i) => {
      const k = i + 1
      const idx = stepIndex(k * PERIOD_S)
      expect(idx).toBe(8 * k)
      const observed = summary.detected.mean[idx]
      const se = proportionSe(p, REPLICATES)
      expect(Math.abs(observed - p)).toBeLessThanOrEqual(3 * se)
    })
  })
})

describe('case 2: M-of-N track initiation at constant Pd', () => {
  /**
   * A track initiates at the scan that completes the M-th detection inside
   * the last N scans. Within the first N = 5 scans the window is the first
   * five scans, so the fraction with a track by scan 5 is the binomial tail
   * P(at least 3 of 5 at p = 0.45):
   *   C(5,3) p^3 q^2 = 10 * 0.091125  * 0.3025 = 0.2756531
   *   C(5,4) p^4 q   =  5 * 0.04100625 * 0.55  = 0.1127672
   *   C(5,5) p^5     =      0.0184528           = 0.0184528
   *   sum                                       = 0.4068731
   * pdTrackCumulative is 0.01: mOfN(0.45, 3, 5) = 0.407 clears it at every
   * window length, so the Pd term never blocks initiation and the count
   * alone decides. The `tracked` band is the hold-flag rule (any hold
   * interval, coast included), not initiation, so this case reads the per
   * replicate observation: trackInitAtS, against scan 5 of that replicate,
   * pdSeriesStartS + 4 P (the first scan taken plus four periods).
   */
  const EXPECTED = 0.4068731

  it('the fraction with trackInitAtS by scan 5 follows mOfN(Pd, 3, 5) within 3 SE', () => {
    const f = scanFixture()
    assertScanPd(f)
    expect(Math.abs(mOfN(SCAN_PD, SCAN_M, SCAN_N) - EXPECTED)).toBeLessThan(1e-6)
    const thresholds = thresholdsOf(f.scenario)
    let initiated = 0
    for (let i = 0; i < REPLICATES; i += 1) {
      const a = assessAllThreats(f.scenario, monteCarloPolicy(SEED, i, thresholds))[0]
      const obs = a.sensorObservations!.find((o) => o.sensorId === f.sensorId)
      if (!obs || obs.trackInitAtS == null) continue
      // Initiation happens at a scan: a whole number of periods after the first scan.
      const offset = obs.trackInitAtS - obs.pdSeriesStartS!
      expect(Math.abs(offset / PERIOD_S - Math.round(offset / PERIOD_S))).toBeLessThan(1e-9)
      const scan5S = obs.pdSeriesStartS! + (SCAN_N - 1) * PERIOD_S
      if (obs.trackInitAtS <= scan5S + 1e-9) initiated += 1
    }
    const observed = initiated / REPLICATES
    const se = proportionSe(EXPECTED, REPLICATES)
    expect(Math.abs(observed - EXPECTED)).toBeLessThanOrEqual(3 * se)
  })
})

/**
 * Planning-basis omni radar with no scan period: it holds every step from
 * t = 0, so the ROE free gate is t = 0 and no Pd draw runs.
 */
const PLANNING_RADAR: SensorSpec = {
  sensorType: 'radar',
  role: 'surveillance',
  rangeBasis: 'planning',
  detectRangeM: 50000,
  classifyRangeM: null,
  sectorDeg: 360,
}

/** Group 4 fixed wing: SIZE_PENALTY 1 and no evasion penalty, so per-shot Pk = pk * falloff. */
const FIXED_WING = model('tst-cv-fw', {
  kind: 'uas',
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
})

/**
 * Per-shot Pk arithmetic. The interceptor sits at the origin with a 3000 m
 * envelope and spec pk 0.5. The target flies east along y = 0 from
 * x = -1000 at 40 m/s, through the launcher at t = 25 s, to x = 2000
 * (75 s). Salvo 1 fires at t = 0 at slant 1000 m, salvo 2 at t = cooldown.
 * With cooldown 50 s the target is at x = -1000 + 40 * 50 = 1000, slant
 * 1000 m again, so both shots read the same falloff
 *   1 - 0.3 * 1000 / 3000 = 0.9
 * and the same per-shot Pk q = 0.5 * 0.9 = 0.45. A third salvo would come
 * at t = 100, after the window closes at 75 s. Cooldown 80 s allows one.
 */
const SHOT_PK = 0.45
const WINDOW_END_S = 75

interface KineticLaydown {
  scenario: Scenario
  uasId: string
  effId: string
}

function kineticLaydown(cooldownS: number, magazine: number): KineticLaydown {
  const s = baseScenario()
  s.library.push(
    model('tst-cv-planning', { kind: 'sensor', sensor: PLANNING_RADAR }),
    FIXED_WING,
    model('tst-cv-int', {
      kind: 'effector',
      effector: {
        effectorType: 'interceptor',
        minRangeM: 0,
        maxRangeM: 3000,
        engageTimeS: 0,
        magazineSize: magazine,
        pk: 0.5,
        salvoCooldownS: cooldownS,
        flyoutSpeedMps: null,
      },
    }),
  )
  const sensor = ent('sensor', 'tst-cv-planning', { x: 0, y: 0 })
  const eff = ent('effector', 'tst-cv-int', { x: 0, y: 0 })
  const uas = ent('uas', FIXED_WING.id, { x: -1000, y: 0 })
  s.entities.push(sensor, eff, uas)
  s.connections.push(link(sensor.id, eff.id))
  s.paths.push(
    flight(
      uas.id,
      [
        { x: -1000, y: 0 },
        { x: 2000, y: 0 },
      ],
      40,
    ),
  )
  return { scenario: s, uasId: uas.id, effId: eff.id }
}

describe('case 3: kill mean at per-shot Pk q', () => {
  it('the deterministic run pins the geometry: two salvos at t = 0 and 50 at Pk 0.45', () => {
    const { scenario, uasId } = kineticLaydown(50, 5)
    const a = assessAllThreats(scenario)[0]
    expect(a.status).toBe('engageable')
    expect(a.engageGateS).toBe(0)
    expect(a.effectorWindows[0].intervals).toEqual([[0, WINDOW_END_S]])
    const report = resolveEngagements(scenario, [a])
    expect(report.events.map((e) => e.tS)).toEqual([0, 50])
    for (const e of report.events) {
      expect(e.uasId).toBe(uasId)
      expect(e.tEffectS).toBe(e.tS)
      expect(e.pk).toBeCloseTo(SHOT_PK, 9)
    }
    // Expected value: q + (1 - q) q = 0.45 + 0.55 * 0.45 = 0.45 + 0.2475 = 0.6975.
    expect(report.totals.expectedKills).toBeCloseTo(0.6975, 9)
    const one = kineticLaydown(80, 5)
    const oneReport = resolveEngagements(one.scenario)
    expect(oneReport.events.map((e) => e.tS)).toEqual([0])
    expect(oneReport.totals.expectedKills).toBeCloseTo(SHOT_PK, 9)
  })

  /**
   * One salvo: the kill count is Bernoulli(0.45), mean 0.45,
   * SE sqrt(0.45 * 0.55 / 1000) = 0.0157. The salvo count is 1 in every
   * replicate.
   */
  it('one shot: killed.mean near q within 3 SE', () => {
    const { scenario, uasId, effId } = kineticLaydown(80, 5)
    const summary = runReplicates(scenario)
    expect(summary.replicates).toBe(REPLICATES)
    const killed = summary.perThreat[uasId].killed
    expect(killed.n).toBe(REPLICATES)
    const se = proportionSe(SHOT_PK, REPLICATES)
    expect(Math.abs(killed.mean - SHOT_PK)).toBeLessThanOrEqual(3 * se)
    expect(summary.perEffector[effId].salvos.mean).toBe(1)
    expect(summary.perEffector[effId].salvos.sd).toBe(0)
  })

  /**
   * Shoot-look-shoot with time for both: salvo 2 fires only when salvo 1
   * missed, so the kill count is Bernoulli(1 - (1 - q)^2) with
   *   1 - 0.55^2 = 1 - 0.3025 = 0.6975,  SE sqrt(0.6975 * 0.3025 / 1000) = 0.0145.
   * The salvo count is 1 + Bernoulli(1 - q): mean 1 + 0.55 = 1.55,
   * SE sqrt(0.55 * 0.45 / 1000) = 0.0157.
   */
  it('two shots: killed.mean near 1 - (1 - q)^2 and salvos near 1 + (1 - q) within 3 SE', () => {
    const { scenario, uasId, effId } = kineticLaydown(50, 5)
    const summary = runReplicates(scenario)
    const twoShot = 1 - (1 - SHOT_PK) * (1 - SHOT_PK)
    expect(twoShot).toBeCloseTo(0.6975, 12)
    const killed = summary.perThreat[uasId].killed
    expect(killed.n).toBe(REPLICATES)
    const se = proportionSe(twoShot, REPLICATES)
    expect(Math.abs(killed.mean - twoShot)).toBeLessThanOrEqual(3 * se)
    const salvos = summary.perEffector[effId].salvos
    const missSe = proportionSe(1 - SHOT_PK, REPLICATES)
    expect(Math.abs(salvos.mean - 1.55)).toBeLessThanOrEqual(3 * missSe)
    expect(salvos.p10).toBe(1)
    expect(salvos.p90).toBe(2)
  })
})

/**
 * Omni GNSS jammer at the origin, 3000 m placard at rated power, spec pk
 * 0.5, cooldown 60 s. The target is a GNSS quad with jamBehavior
 * 'continue' flying east along y = 0 from x = -1000 to x = 1000 at 40 m/s
 * (50 s), the whole path inside the 3000 m reach, so the window is
 * [0, 50.5] (the sweep samples the clamped path end once more at 50.5 s
 * before it stops) and the 60 s cooldown leaves exactly one dwell, at
 * t = 0 at range 1000 m. Jam physics there: bandFactor 1 (the jammer covers the
 * target's one band), alignFactor 1 (omni), powerFactor
 * 1 - 0.3 * 1000 / 3000 = 0.9, so p = 0.5 * 0.9 = 0.45.
 * The hold is read from ThreatAttrition.continueJamProb: with no asset the
 * reference instant is the last dwell's effect time, inside the same
 * in-range interval as the dwell, so it is that dwell's jam draw (0 or 1).
 */
const JAM_P = 0.45

function jamLaydown(): { scenario: Scenario; uasId: string; effId: string } {
  const s = baseScenario()
  s.library.push(
    model('tst-cv-planning', { kind: 'sensor', sensor: PLANNING_RADAR }),
    model('tst-cv-gnss-quad', {
      kind: 'uas',
      uas: {
        group: 1,
        airframe: 'quad',
        cruiseSpeedMps: 40,
        maxSpeedMps: 40,
        enduranceMin: 60,
        altBandFt: [0, 400],
        navMode: 'gps',
        jamBehavior: 'continue',
        emissionsNote: '',
      },
    }),
    model('tst-cv-jammer', {
      kind: 'effector',
      effector: {
        effectorType: 'jammer',
        minRangeM: 0,
        maxRangeM: 3000,
        engageTimeS: 0,
        pk: 0.5,
        salvoCooldownS: 60,
        jamBands: ['gnss'],
      },
    }),
  )
  const sensor = ent('sensor', 'tst-cv-planning', { x: 0, y: 0 })
  const eff = ent('effector', 'tst-cv-jammer', { x: 0, y: 0 })
  const uas = ent('uas', 'tst-cv-gnss-quad', { x: -1000, y: 0 })
  s.entities.push(sensor, eff, uas)
  s.connections.push(link(sensor.id, eff.id))
  s.paths.push(
    flight(
      uas.id,
      [
        { x: -1000, y: 0 },
        { x: 1000, y: 0 },
      ],
      40,
    ),
  )
  return { scenario: s, uasId: uas.id, effId: eff.id }
}

describe('case 4: continue-jam hold fraction at p', () => {
  it('the deterministic run pins one dwell at t = 0 with p 0.45 and continueJamProb 0.45', () => {
    const { scenario, uasId, effId } = jamLaydown()
    const a = assessAllThreats(scenario)[0]
    expect(a.status).toBe('engageable')
    expect(a.effectorWindows[0].intervals).toEqual([[0, 50.5]])
    const report = resolveEngagements(scenario, [a])
    expect(report.events).toHaveLength(1)
    expect(report.events[0]).toMatchObject({
      tS: 0,
      tEffectS: 0,
      effectorId: effId,
      uasId,
      channel: 'jam',
    })
    expect(report.events[0].pk).toBeCloseTo(JAM_P, 9)
    expect(report.threats[0].jamSalvos).toBe(1)
    expect(report.threats[0].continueJamProb).toBeCloseTo(JAM_P, 9)
  })

  /** Bernoulli(0.45): mean 0.45, SE sqrt(0.45 * 0.55 / 1000) = 0.0157. */
  it('the fraction of replicates whose one dwell took hold is near p within 3 SE', () => {
    const { scenario } = jamLaydown()
    const thresholds = thresholdsOf(scenario)
    let held = 0
    for (let i = 0; i < REPLICATES; i += 1) {
      const policy = monteCarloPolicy(SEED, i, thresholds)
      const report = resolveEngagements(scenario, assessAllThreats(scenario, policy), policy)
      expect(report.threats[0].jamSalvos).toBe(1)
      expect(report.events).toHaveLength(1)
      expect(report.events[0].pk).toBeCloseTo(JAM_P, 9)
      const p = report.threats[0].continueJamProb
      expect(p === 0 || p === 1).toBe(true)
      held += p
    }
    const observed = held / REPLICATES
    const se = proportionSe(JAM_P, REPLICATES)
    expect(Math.abs(observed - JAM_P)).toBeLessThanOrEqual(3 * se)
  })
})

describe('case 5: raid partition with formation ships', () => {
  /**
   * The case 3 laydown with cooldown 10 s and five rounds, against two
   * formations: T1, three ships in line abreast at 50 m, on the case 3 path
   * to an asset at (2000, 0) with a 200 m boundary (arrival when the lead
   * reaches x = 1800, t = 70 s); T2, two ships on the parallel path
   * y = 1500, whose closest approach to the asset is 1500 m, so it never
   * arrives. Raid size 3 + 2 = 5. Ships are discrete under the replicate
   * policy, so every partition term is a whole number:
   *   T1  kills + leakers = 3, noArrival 0
   *   T2  kills + noArrival = 2, leakers 0
   *   raid  kills + leakers + noArrival = 5
   */
  it('kills + leakers + noArrival equals raidSize in every replicate', () => {
    const { scenario, uasId } = kineticLaydown(10, 5)
    const t1 = scenario.entities.find((e) => e.id === uasId)!
    const formation1: FormationSpec = { count: 3, shape: 'line', spacingM: 50 }
    t1.formation = formation1
    const t2 = ent('uas', FIXED_WING.id, { x: -1000, y: 1500 }, {
      formation: { count: 2, shape: 'line', spacingM: 50 },
    })
    scenario.entities.push(t2)
    scenario.paths.push(
      flight(
        t2.id,
        [
          { x: -1000, y: 1500 },
          { x: 2000, y: 1500 },
        ],
        40,
      ),
    )
    scenario.entities.push(ent('asset', null, { x: 2000, y: 0 }, { defendedRadiusM: 200 }))

    const thresholds = thresholdsOf(scenario)
    let killsSeen = 0
    let leakersSeen = 0
    let noArrivalSeen = 0
    for (let i = 0; i < REPLICATES; i += 1) {
      const policy = monteCarloPolicy(SEED, i, thresholds)
      const assessments = assessAllThreats(scenario, policy)
      if (i === 0) {
        expect(assessments.find((a) => a.uasId === uasId)!.arrivalS).toBe(70)
        expect(assessments.find((a) => a.uasId === t2.id)!.arrivalS).toBeNull()
      }
      const { totals, threats } = resolveEngagements(scenario, assessments, policy)
      expect(totals.raidSize).toBe(5)
      const { expectedKills, expectedLeakers, expectedNoArrival } = totals
      expect(expectedKills + expectedLeakers + expectedNoArrival).toBeCloseTo(5, 9)
      for (const v of [expectedKills, expectedLeakers, expectedNoArrival]) {
        expect(Number.isInteger(v)).toBe(true)
      }
      const row1 = threats.find((t) => t.uasId === uasId)!
      const row2 = threats.find((t) => t.uasId === t2.id)!
      expect(row1.shipCount).toBe(3)
      expect(row1.arrived).toBe(true)
      expect(row1.expectedNoArrival).toBe(0)
      expect(row1.expectedKills + row1.expectedLeakers).toBe(3)
      expect(row2.shipCount).toBe(2)
      expect(row2.arrived).toBe(false)
      expect(row2.expectedLeakers).toBe(0)
      expect(row2.expectedKills + row2.expectedNoArrival).toBe(2)
      killsSeen += expectedKills
      leakersSeen += expectedLeakers
      noArrivalSeen += expectedNoArrival
    }
    // The draws vary: every partition term is exercised somewhere in the run.
    expect(killsSeen).toBeGreaterThan(0)
    expect(leakersSeen).toBeGreaterThan(0)
    expect(noArrivalSeen).toBeGreaterThan(0)
  })
})

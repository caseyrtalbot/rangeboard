import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario, SensorSpec } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, TRACK_DROP_MISSES, TRACK_INIT_M, TRACK_INIT_N } from '../model/types'
import { dist, pointInSector } from '../geometry/geo'
import { mOfN } from '../analysis/radarPd'
import { DT, stepIndex } from './clock'
import {
  FALSE_TRACK_CELLS,
  FALSE_TRACK_SPEED_MPS,
  falseTrackRatePerScan,
  poissonInverse,
  prepareFalseTracks,
  scenarioHorizonS,
} from './falseTracks'
import type { DrawPolicy } from './policy'
import { deterministicPolicy, monteCarloPolicy } from './policy'
import { resolvedThresholds } from './detection'
import { resolveEngagements } from './attrition'
import { assessAllThreats } from './sim'
import type { TrackEstimate } from './trackTypes'
import { runTrial } from './trial'
import { createTrialManifest } from './trialTypes'

const T = DEFAULT_REQUIREMENT_THRESHOLDS

const RADAR: SensorSpec = {
  sensorType: 'radar',
  role: 'surveillance',
  rangeBasis: 'planning',
  detectRangeM: 5000,
  classifyRangeM: null,
  sectorDeg: 360,
  updateRateS: 1,
}

/** One radar at the origin, heading 0, with the given spec patch; no threat. */
function fixture(radar: Partial<SensorSpec>): Scenario {
  const scenario = emptyScenario()
  scenario.library.push({
    id: 'tst-radar', name: 'Radar', description: '', color: '#0f0', builtin: false, kind: 'sensor',
    sensor: { ...RADAR, ...radar },
  })
  const radarEnt: Entity = {
    id: 'radar', name: 'R', kind: 'sensor', specId: 'tst-radar', pos: { x: 0, y: 0 },
    headingDeg: 0, color: null, notes: '',
  }
  scenario.entities.push(radarEnt)
  return scenario
}

/** A policy that counts the kind-9 draws it serves. */
function spy(base: DrawPolicy): DrawPolicy & { falseAlarmCalls: number } {
  const p = {
    ...base,
    falseAlarmCalls: 0,
    falseAlarm(sensorId: string, tS: number, k: number) {
      p.falseAlarmCalls += 1
      return base.falseAlarm(sensorId, tS, k)
    },
  }
  return p
}

describe('closed form and inversion', () => {
  it('the false-track rate is cells times the M-of-N probability of the cell alarm probability', () => {
    const lambda = 100
    const p = lambda / FALSE_TRACK_CELLS
    expect(falseTrackRatePerScan(lambda, 3, 5)).toBeCloseTo(FALSE_TRACK_CELLS * mOfN(p, 3, 5), 12)
    // 3 of 5 at p = 0.01: 10 p^3 q^2 + 5 p^4 q + p^5.
    const byHand = 10 * p ** 3 * (1 - p) ** 2 + 5 * p ** 4 * (1 - p) + p ** 5
    expect(falseTrackRatePerScan(lambda, 3, 5)).toBeCloseTo(FALSE_TRACK_CELLS * byHand, 12)
    expect(falseTrackRatePerScan(0, 3, 5)).toBe(0)
    expect(falseTrackRatePerScan(Number.NaN, 3, 5)).toBe(0)
  })

  it('Poisson inversion returns the smallest k whose cdf exceeds u', () => {
    expect(poissonInverse(0, 0.9)).toBe(0)
    // mean 1: P(0) = e^-1 = 0.3679, P(<= 1) = 0.7358.
    expect(poissonInverse(1, 0.36)).toBe(0)
    expect(poissonInverse(1, 0.37)).toBe(1)
    expect(poissonInverse(1, 0.73)).toBe(1)
    expect(poissonInverse(1, 0.74)).toBe(2)
    // u at the very top terminates at the cap.
    expect(Number.isFinite(poissonInverse(4, 1 - 1e-16))).toBe(true)
  })
})

describe('false-track process', () => {
  it('converges: the mean false-track count per scan over many replicates matches the closed form', () => {
    // lambda 100 per scan: p 0.01, rate = 1e4 * mOfN(0.01, 3, 5) = 0.0985 per scan.
    const scenario = fixture({ falseAlarmRatePerScan: 100 })
    const rate = falseTrackRatePerScan(100, TRACK_INIT_M, TRACK_INIT_N)
    expect(rate).toBeGreaterThan(0.09)
    expect(rate).toBeLessThan(0.1)
    const horizonS = 500
    const scansPerRep = Math.floor(horizonS / 1) + 1
    const reps = 40
    let created = 0
    for (let r = 0; r < reps; r += 1) {
      const load = prepareFalseTracks(scenario, monteCarloPolicy(4821, r, T), horizonS)
      expect(load.sensorIds).toEqual(['radar'])
      created += load.created
    }
    const scans = reps * scansPerRep
    const mean = scans * rate
    const sd = Math.sqrt(mean)
    // Four sigma either side of the Poisson mean.
    expect(Math.abs(created - mean)).toBeLessThan(4 * sd)
  })

  it('the load counts each false track for trackDropMisses scans and agrees with the emitted estimates', () => {
    const scenario = fixture({ falseAlarmRatePerScan: 300 })
    const policy = monteCarloPolicy(7, 1, T)
    const estimates: TrackEstimate[] = []
    const horizonS = 200
    const load = prepareFalseTracks(scenario, policy, horizonS, (e) => estimates.push(e))
    expect(load.created).toBeGreaterThan(5)
    const ids = new Set(estimates.map((e) => e.id))
    expect(ids.size).toBe(load.created)
    // Per step, the live count equals the estimates stamped at that step.
    const perStep = new Map<number, number>()
    for (const e of estimates) {
      const i = stepIndex(e.state.tS)
      perStep.set(i, (perStep.get(i) ?? 0) + 1)
    }
    for (let i = 0; i <= stepIndex(horizonS); i += 1) {
      expect(load.countAt(i * DT)).toBe(perStep.get(i) ?? 0)
      expect(load.countAtSensor('radar', i * DT)).toBe(perStep.get(i) ?? 0)
    }
    expect(load.countAtSensor('other', 10)).toBe(0)
    // Each track lives TRACK_DROP_MISSES scans of 1 s: 2 steps per scan.
    const stepsPerTrack = new Map<string, number>()
    for (const e of estimates) stepsPerTrack.set(e.id, (stepsPerTrack.get(e.id) ?? 0) + 1)
    for (const [id, n] of stepsPerTrack) {
      const scanIdx = Number(id.split(':')[2])
      // A track opened near the horizon is cut short by it.
      const full = scanIdx + TRACK_DROP_MISSES <= horizonS
      if (full) expect(n).toBe(TRACK_DROP_MISSES / DT)
      else expect(n).toBeLessThanOrEqual(TRACK_DROP_MISSES / DT)
    }
    // The load without a sink is the same load.
    const silent = prepareFalseTracks(scenario, policy, horizonS)
    expect(silent.created).toBe(load.created)
    for (let i = 0; i <= stepIndex(horizonS); i += 1) expect(silent.countAt(i * DT)).toBe(load.countAt(i * DT))
  })

  it('a false track is truth-free: no uas, source false, inside the coverage, speed in the band', () => {
    const scenario = fixture({ falseAlarmRatePerScan: 300, sectorDeg: 90, rangeAccuracyM: 10, azimuthAccuracyDeg: 1 })
    scenario.entities[0].headingDeg = 45
    const estimates: TrackEstimate[] = []
    prepareFalseTracks(scenario, monteCarloPolicy(11, 0, T), 200, (e) => estimates.push(e))
    expect(estimates.length).toBeGreaterThan(0)
    const [lo, hi] = FALSE_TRACK_SPEED_MPS
    const origin = { x: 0, y: 0 }
    for (const e of estimates) {
      expect(e.uasId).toBeNull()
      expect(e.source).toBe('false')
      expect(e.sensorIds).toEqual(['radar'])
      expect(e.id.startsWith('radar:false:')).toBe(true)
      const speed = Math.hypot(e.state.vx, e.state.vy)
      expect(speed).toBeGreaterThanOrEqual(lo)
      expect(speed).toBeLessThanOrEqual(hi)
      expect(e.quality).toBeGreaterThan(0)
      expect(e.quality).toBeLessThan(1)
      expect(e.coasting).toBe(e.misses > 0)
      // The confirming position sits in the sector; a coasting track may have drifted past the edge.
      if (e.misses === 0 && e.state.tS % 1 === 0) {
        expect(pointInSector(origin, 45, 90, 5000, { x: e.state.x, y: e.state.y })).toBe(true)
        expect(dist(origin, e.state)).toBeLessThanOrEqual(5000)
      }
    }
    // The covariance grows while the track coasts.
    const first = estimates.find((e) => e.misses === 0)!
    const later = estimates.find((e) => e.id === first.id && e.misses === TRACK_DROP_MISSES - 1)!
    expect(later.covariance[0] + later.covariance[5]).toBeGreaterThan(first.covariance[0] + first.covariance[5])
  })

  it('the noFalseTracks switch yields none and consumes no draw', () => {
    const scenario = fixture({ falseAlarmRatePerScan: 300 })
    scenario.physics = ['noFalseTracks']
    const policy = spy(monteCarloPolicy(7, 1, T))
    const estimates: TrackEstimate[] = []
    const load = prepareFalseTracks(scenario, policy, 200, (e) => estimates.push(e))
    expect(load.created).toBe(0)
    expect(load.sensorIds).toEqual([])
    expect(load.countAt(10)).toBe(0)
    expect(estimates).toEqual([])
    expect(policy.falseAlarmCalls).toBe(0)
  })

  it('a radar with a null rate, a zero rate or no radar at all yields none', () => {
    for (const patch of [{}, { falseAlarmRatePerScan: null }, { falseAlarmRatePerScan: 0 }]) {
      const policy = spy(monteCarloPolicy(7, 1, T))
      const load = prepareFalseTracks(fixture(patch), policy, 200)
      expect(load.created).toBe(0)
      expect(load.countAt(10)).toBe(0)
      expect(policy.falseAlarmCalls).toBe(0)
    }
    const eo = fixture({ sensorType: 'eo-ir', falseAlarmRatePerScan: 300 })
    expect(prepareFalseTracks(eo, monteCarloPolicy(7, 1, T), 200).created).toBe(0)
  })

  it('the deterministic policy at u 0.5 opens no false track at a rate below ln 2 per scan', () => {
    const scenario = fixture({ falseAlarmRatePerScan: 100 })
    expect(prepareFalseTracks(scenario, deterministicPolicy(T), 200).created).toBe(0)
  })
})

describe('trial integration', () => {
  function laydown(): Scenario {
    const scenario = emptyScenario()
    scenario.roe = 'free'
    scenario.seed = 4821
    scenario.doctrine!.enabled = false
    const entity = (id: string, kind: Entity['kind'], specId: string, y: number): Entity => ({
      id, kind, specId, name: id, pos: { x: 0, y }, headingDeg: 0, color: null, notes: '',
    })
    scenario.entities = [
      entity('radar', 'sensor', 'lib-giraffe1x', 0),
      entity('c2', 'c2', 'lib-faadc2', 0),
      entity('effector', 'effector', 'lib-coyote', -1697),
      { ...entity('uas', 'uas', 'lib-mohajer6', -5000), altitudeFt: 1000 },
    ]
    scenario.connections = [
      { id: 'link-1', fromId: 'radar', toId: 'c2', label: '' },
      { id: 'link-2', fromId: 'c2', toId: 'effector', label: '' },
    ]
    scenario.paths = [{ id: 'path', entityId: 'uas', points: [{ x: 0, y: -5000 }, { x: 0, y: -800 }],
      speedMps: 30, startDelayS: 0 }]
    const radar = scenario.library.find((model) => model.id === 'lib-giraffe1x')!
    radar.sensor = { ...radar.sensor!, falseAlarmRatePerScan: 300 }
    return scenario
  }

  it('the scenario horizon is the latest path end', () => {
    expect(scenarioHorizonS(laydown())).toBeCloseTo(4200 / 30, 9)
    expect(scenarioHorizonS(emptyScenario())).toBe(0)
  })

  it('TrialResult.tracks carries the false tracks and the report is unchanged by them', () => {
    const scenario = laydown()
    const manifest = createTrialManifest(scenario, 'trial-false', 'fixed-basis')
    const result = runTrial(scenario, manifest)
    const tracks = result.tracks ?? []
    const falseTracks = tracks.filter((t) => t.source === 'false')
    expect(falseTracks.length).toBeGreaterThan(0)
    expect(falseTracks.every((t) => t.uasId === null && t.sensorIds[0] === 'radar')).toBe(true)
    expect(tracks.some((t) => t.source !== 'false')).toBe(true)
    const policy = monteCarloPolicy(manifest.seed, manifest.replicateIndex, resolvedThresholds(scenario))
    expect(result.report).toEqual(resolveEngagements(scenario, assessAllThreats(scenario, policy), policy))
    expect(runTrial(structuredClone(scenario), structuredClone(manifest))).toEqual(result)
  })
})

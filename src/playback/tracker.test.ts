import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario, SensorSpec, Vec2 } from '../model/types'
import { MOUNT_HEIGHT_M } from '../model/types'
import { FT_TO_M } from '../analysis/sensorEnv'
import { DT } from './clock'
import { positionSigmaM } from './kalman'
import type { DrawPolicy } from './policy'
import { deterministicPolicy, monteCarloPolicy } from './policy'
import { resolvedThresholds } from './detection'
import { prepareSweepRun, stepSweep } from './sweep'
import type { TrackEstimate } from './trackTypes'
import { polarMeasurement, trackId } from './tracker'
import { runTrial } from './trial'
import { createTrialManifest } from './trialTypes'

/**
 * The tracker on the sweep's own fixture: a planning-basis radar at the
 * origin (Pd 1 on a hit, M-of-N a count) with a 1 s scan period, so scans
 * fall on the even steps and the odd steps carry. The threat flies at the
 * mount height, so slant equals ground range.
 */
const RADAR: SensorSpec = {
  sensorType: 'radar',
  role: 'surveillance',
  rangeBasis: 'planning',
  detectRangeM: 1000,
  classifyRangeM: null,
  sectorDeg: 360,
}

const ACCURATE: Partial<SensorSpec> = { rangeAccuracyM: 10, azimuthAccuracyDeg: 1 }

function fixture(radar: Partial<SensorSpec>): { scenario: Scenario; uas: Entity } {
  const scenario = emptyScenario()
  scenario.environment = { ...scenario.environment, apply: false }
  const common = { description: '', color: '#0f0', builtin: false, kind: 'sensor' as const }
  scenario.library.push({ id: 'tst-radar', name: 'Radar', ...common, sensor: { ...RADAR, ...radar } })
  const ent = { pos: { x: 0, y: 0 }, headingDeg: 0, color: null, notes: '' }
  scenario.entities.push({ id: 'radar', name: 'R', kind: 'sensor', specId: 'tst-radar', ...ent })
  const uas: Entity = {
    id: 'uas', name: 'T', kind: 'uas', specId: null, ...ent, altitudeFt: MOUNT_HEIGHT_M / FT_TO_M,
  }
  scenario.entities.push(uas)
  return { scenario, uas }
}

/** The deterministic policy with a counter on the noise draw. */
function spyPolicy(scenario: Scenario): DrawPolicy & { noiseCalls: Array<[string, string, number, number]> } {
  const base = deterministicPolicy(resolvedThresholds(scenario))
  const spy = {
    ...base,
    noiseCalls: [] as Array<[string, string, number, number]>,
    noise(sensorId: string, uasId: string, tS: number, axis: number) {
      spy.noiseCalls.push([sensorId, uasId, tS, axis])
      return base.noise!(sensorId, uasId, tS, axis)
    },
  }
  return spy
}

/** Inside the ring, flying east at 10 m/s: x = 500 + 10 t. */
const inside = (t: number): Vec2[] => [{ x: 500 + 10 * t, y: 0 }]
const OUTSIDE: Vec2[] = [{ x: 5000, y: 0 }]

/** Run the sweep over `positions(t)` for t in [0, endS] with a sink; returns the estimates. */
function sweep(
  scenario: Scenario,
  uas: Entity,
  policy: DrawPolicy,
  positions: (t: number) => Vec2[],
  endS: number,
): TrackEstimate[] {
  const out: TrackEstimate[] = []
  const run = prepareSweepRun(scenario, uas, 0, policy, undefined, (e) => out.push(e))
  for (let t = 0; t <= endS + 1e-9; t += DT) stepSweep(run, positions(t), t)
  return out
}

describe('tracker truth path', () => {
  it('a sensor with null accuracy reports truth, zero covariance, quality 1 and consumes no draw', () => {
    const { scenario, uas } = fixture({ updateRateS: 1 })
    const policy = spyPolicy(scenario)
    const estimates = sweep(scenario, uas, policy, inside, 2)
    expect(estimates.length).toBe(5)
    expect(policy.noiseCalls).toEqual([])
    for (const e of estimates) {
      expect(e.id).toBe(trackId('radar', 'uas'))
      expect(e.source).toBe('truth')
      expect(e.quality).toBe(1)
      expect(e.covariance).toEqual(new Array(16).fill(0))
      expect(e.sensorIds).toEqual(['radar'])
      expect(e.coasting).toBe(false)
      expect(e.state.x).toBeCloseTo(500 + 10 * e.state.tS, 9)
      expect(e.state.y).toBe(0)
    }
    // The truth velocity is the finite difference of the lead; the first step has none yet.
    expect(estimates[0].state.vx).toBe(0)
    for (const e of estimates.slice(1)) expect(e.state.vx).toBeCloseTo(10, 9)
    expect(estimates.map((e) => e.hits)).toEqual([1, 1, 2, 2, 3])
  })

  it('the truthTracks switch forces the truth path with accuracy set, no draw consumed', () => {
    const { scenario, uas } = fixture({ updateRateS: 1, ...ACCURATE })
    scenario.physics = ['truthTracks']
    const policy = spyPolicy(scenario)
    const estimates = sweep(scenario, uas, policy, inside, 2)
    expect(estimates.length).toBe(5)
    expect(policy.noiseCalls).toEqual([])
    for (const e of estimates) {
      expect(e.source).toBe('truth')
      expect(e.quality).toBe(1)
      expect(e.covariance).toEqual(new Array(16).fill(0))
    }
  })

  it('without a sink the sweep runs and allocates no estimate history', () => {
    const { scenario, uas } = fixture({ updateRateS: 1, ...ACCURATE })
    const policy = spyPolicy(scenario)
    const run = prepareSweepRun(scenario, uas, 0, policy)
    for (let t = 0; t <= 2; t += DT) stepSweep(run, inside(t), t)
    // The estimate path still draws, so the keyed draws are the same with or without a sink.
    expect(policy.noiseCalls.length).toBe(6)
  })
})

describe('tracker estimate path', () => {
  it('draws two noise uniforms per measured scan, keyed by sensor, threat, time and axis', () => {
    const { scenario, uas } = fixture({ updateRateS: 1, ...ACCURATE })
    const policy = spyPolicy(scenario)
    const estimates = sweep(scenario, uas, policy, inside, 2)
    // Scans at 0, 1, 2; the odd steps carry and draw nothing.
    expect(policy.noiseCalls).toEqual([
      ['radar', 'uas', 0, 0], ['radar', 'uas', 0, 1],
      ['radar', 'uas', 1, 0], ['radar', 'uas', 1, 1],
      ['radar', 'uas', 2, 0], ['radar', 'uas', 2, 1],
    ])
    expect(estimates.length).toBe(5)
    for (const e of estimates) {
      expect(e.source).toBe('estimate')
      expect(e.quality).toBeLessThan(1)
      expect(e.quality).toBeGreaterThan(0)
    }
    // The deterministic policy's 0.5 is the noise-free measurement: the opening state is truth.
    expect(estimates[0].state.x).toBeCloseTo(500, 9)
    expect(estimates[0].state.y).toBeCloseTo(0, 9)
    expect(estimates.map((e) => e.hits)).toEqual([1, 1, 2, 2, 3])
  })

  it('the ellipse shrinks over consecutive hits and grows over misses', () => {
    const { scenario, uas } = fixture({ updateRateS: 1, ...ACCURATE })
    const policy = spyPolicy(scenario)
    // Three detected scans (0, 1, 2) initiate at 2 s; from 3 s the radar misses and coasts.
    const estimates = sweep(scenario, uas, policy, (t) => (t < 2.5 ? inside(t) : OUTSIDE), 4.5)
    const byT = new Map(estimates.map((e) => [e.state.tS, e]))
    const sigma = (t: number) => positionSigmaM(byT.get(t)!.covariance)
    // Measured scans: each update lowers the sigma below the previous scan's.
    expect(sigma(1)).toBeLessThan(sigma(0))
    expect(sigma(2)).toBeLessThan(sigma(1))
    // A carried step between scans predicts: larger than the scan before it.
    expect(sigma(0.5)).toBeGreaterThan(sigma(0))
    // Coasting from 3 s: the sigma grows every step and the flag is set.
    for (const t of [3, 3.5, 4, 4.5]) {
      expect(byT.get(t)!.coasting).toBe(true)
      expect(byT.get(t)!.source).toBe('estimate')
    }
    expect(byT.get(2.5)!.coasting).toBe(false)
    expect(sigma(3)).toBeGreaterThan(sigma(2.5))
    expect(sigma(3.5)).toBeGreaterThan(sigma(3))
    expect(sigma(4)).toBeGreaterThan(sigma(3.5))
    expect(sigma(4.5)).toBeGreaterThan(sigma(4))
    // The miss count is the sweep's consecutive missed scans.
    expect(byT.get(3)!.misses).toBe(1)
    expect(byT.get(3.5)!.misses).toBe(1)
    expect(byT.get(4)!.misses).toBe(2)
    // No draw on a coasting step.
    expect(policy.noiseCalls.length).toBe(6)
  })

  it('a missed step before initiation drops the track; the next hit opens a new one', () => {
    const { scenario, uas } = fixture({ updateRateS: 1, ...ACCURATE })
    const policy = spyPolicy(scenario)
    const estimates = sweep(scenario, uas, policy, (t) => (t === 1 ? OUTSIDE : inside(t)), 2)
    expect(estimates.map((e) => e.state.tS)).toEqual([0, 0.5, 2])
    expect(estimates.map((e) => e.hits)).toEqual([1, 1, 1])
  })

  it('Monte Carlo noise moves the measurement off truth and the filter pulls the velocity', () => {
    const { scenario, uas } = fixture({ updateRateS: 1, ...ACCURATE })
    const policy = monteCarloPolicy(11, 0, resolvedThresholds(scenario))
    const estimates = sweep(scenario, uas, policy, inside, 40)
    expect(estimates[0].state.x).not.toBeCloseTo(500, 3)
    const last = estimates[estimates.length - 1]
    expect(Math.abs(last.state.vx - 10)).toBeLessThan(2)
    expect(Math.abs(last.state.vy)).toBeLessThan(3)
    expect(Math.abs(last.state.x - (500 + 10 * last.state.tS))).toBeLessThan(30)
  })
})

describe('polarMeasurement', () => {
  it('puts the range sigma along the line of sight and the cross-range sigma across it', () => {
    const east = polarMeasurement({ x: 0, y: 0 }, { x: 1000, y: 0 }, 1000, 10, Math.PI / 180, 1, 0, 's', 'u', 0)
    expect(east.sigmaXM).toBeCloseTo(10, 9)
    expect(east.sigmaYM).toBeCloseTo(1000 * (Math.PI / 180), 9)
    expect(east.rhoXY).toBeCloseTo(0, 12)
    expect(east.x).toBeCloseTo(1010, 9)
    expect(east.y).toBeCloseTo(0, 9)
    const south = polarMeasurement({ x: 0, y: 0 }, { x: 0, y: 1000 }, 1000, 10, Math.PI / 180, 0, 1, 's', 'u', 0)
    expect(south.sigmaXM).toBeCloseTo(1000 * (Math.PI / 180), 9)
    expect(south.sigmaYM).toBeCloseTo(10, 9)
    // Cross-range along the +90 deg rotation of the line of sight: (-s, c) = (-1, 0).
    expect(south.x).toBeCloseTo(-1000 * (Math.PI / 180), 9)
    expect(south.y).toBeCloseTo(1000, 9)
  })

  it('a diagonal line of sight correlates x and y by (vr - vc) / (vr + vc)', () => {
    const r = 1000
    const m = polarMeasurement({ x: 0, y: 0 }, { x: r, y: r }, r * Math.SQRT2, 10, 0.01, 0, 0, 's', 'u', 0)
    const vr = 100
    const vc = (r * Math.SQRT2 * 0.01) ** 2
    expect(m.sigmaXM).toBeCloseTo(Math.sqrt((vr + vc) / 2), 9)
    expect(m.sigmaYM).toBeCloseTo(Math.sqrt((vr + vc) / 2), 9)
    expect(m.rhoXY).toBeCloseTo((vr - vc) / (vr + vc), 9)
  })
})

describe('runTrial tracks', () => {
  function laydown(accuracy: Partial<SensorSpec>): Scenario {
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
      { ...entity('uas', 'uas', 'lib-mohajer6', -5000), altitudeFt: 1000,
        formation: { count: 3, shape: 'line', spacingM: 100 } },
    ]
    scenario.connections = [
      { id: 'link-1', fromId: 'radar', toId: 'c2', label: '' },
      { id: 'link-2', fromId: 'c2', toId: 'effector', label: '' },
    ]
    scenario.paths = [{ id: 'path', entityId: 'uas', points: [{ x: 0, y: -5000 }, { x: 0, y: -800 }],
      speedMps: 30, startDelayS: 0 }]
    const giraffe = scenario.library.find((model) => model.id === 'lib-giraffe1x')!
    giraffe.sensor = { ...giraffe.sensor!, ...accuracy }
    return scenario
  }

  /** One entry per track per step: times strictly increase by DT within each track id. */
  function expectOnePerStep(tracks: readonly TrackEstimate[]): void {
    expect(tracks.length).toBeGreaterThan(0)
    const byId = new Map<string, number[]>()
    for (const e of tracks) {
      const list = byId.get(e.id) ?? []
      list.push(e.state.tS)
      byId.set(e.id, list)
    }
    for (const times of byId.values()) {
      for (let i = 1; i < times.length; i += 1) {
        expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(DT - 1e-9)
      }
    }
    expect(byId.has(trackId('radar', 'uas'))).toBe(true)
  }

  it('returns truth tracks with one entry per track per step when the radar has no accuracy', () => {
    const scenario = laydown({})
    const result = runTrial(scenario, createTrialManifest(scenario, 'trial-tracks', 'basis'))
    expectOnePerStep(result.tracks!)
    for (const e of result.tracks!) {
      expect(e.source).toBe('truth')
      expect(e.quality).toBe(1)
    }
    // Every emitted step is one the assessment held.
    const observations = result.assessments[0]?.sensorObservations ?? []
    expect(observations.length).toBeGreaterThan(0)
    const held = new Set(observations.flatMap((o) =>
      o.intervals.flatMap(([a, b]) => {
        const out: number[] = []
        for (let t = a; t <= b + 1e-9; t += DT) out.push(Math.round(t * 2) / 2)
        return out
      })))
    for (const e of result.tracks!) expect(held.has(Math.round(e.state.tS * 2) / 2)).toBe(true)
  })

  it('returns estimate tracks when the radar has accuracy, reproducibly', () => {
    const scenario = laydown({ rangeAccuracyM: 20, azimuthAccuracyDeg: 0.5 })
    const manifest = createTrialManifest(scenario, 'trial-tracks', 'basis')
    const result = runTrial(scenario, manifest)
    expectOnePerStep(result.tracks!)
    expect(result.tracks!.every((e) => e.source === 'estimate' && e.quality < 1)).toBe(true)
    expect(runTrial(structuredClone(scenario), structuredClone(manifest)).tracks).toEqual(result.tracks)
  })
})

import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario, SensorSpec, Vec2 } from '../model/types'
import { MOUNT_HEIGHT_M } from '../model/types'
import { FT_TO_M } from '../analysis/sensorEnv'
import { finishSweep, prepareSweepRun, stepSweep } from './sweep'

/**
 * The temporal rules on their own: a planning-basis radar (range test, Pd 1
 * on a hit, so M-of-N is a count) with a stated period, and a cued
 * classification camera, both at the origin. The threat flies at the mount
 * height, so slant equals ground range, and each step is fed a position set
 * directly: INSIDE is in both rings, CAMERA_ONLY is past the 1 km radar ring
 * but inside the 3 km camera ring, OUTSIDE is past both.
 */
const INSIDE: Vec2[] = [{ x: 500, y: 0 }]
const CAMERA_ONLY: Vec2[] = [{ x: 2000, y: 0 }]
const OUTSIDE: Vec2[] = [{ x: 5000, y: 0 }]

const RADAR: SensorSpec = {
  sensorType: 'radar',
  role: 'surveillance',
  rangeBasis: 'planning',
  detectRangeM: 1000,
  classifyRangeM: null,
  sectorDeg: 360,
}

const CAMERA: SensorSpec = {
  sensorType: 'eo-ir',
  role: 'classification',
  rangeBasis: 'planning',
  detectRangeM: 3000,
  classifyRangeM: 3000,
  sectorDeg: 360,
}

function fixture(radar: Partial<SensorSpec>, withCamera = false): { scenario: Scenario; uas: Entity } {
  const scenario = emptyScenario()
  scenario.environment = { ...scenario.environment, apply: false }
  const common = { description: '', color: '#0f0', builtin: false, kind: 'sensor' as const }
  scenario.library.push({ id: 'tst-radar', name: 'Radar', ...common, sensor: { ...RADAR, ...radar } })
  scenario.library.push({ id: 'tst-cam', name: 'Camera', ...common, sensor: CAMERA })
  const ent = { pos: { x: 0, y: 0 }, headingDeg: 0, color: null, notes: '' }
  scenario.entities.push({ id: 'radar', name: 'R', kind: 'sensor', specId: 'tst-radar', ...ent })
  if (withCamera) scenario.entities.push({ id: 'cam', name: 'C', kind: 'sensor', specId: 'tst-cam', ...ent })
  const uas: Entity = {
    id: 'uas', name: 'T', kind: 'uas', specId: null, ...ent, altitudeFt: MOUNT_HEIGHT_M / FT_TO_M,
  }
  scenario.entities.push(uas)
  return { scenario, uas }
}

describe('sweep run', () => {
  it('a scan radar samples at its period, holds between scans and credits the scan step', () => {
    const { scenario, uas } = fixture({ updateRateS: 4 })
    const run = prepareSweepRun(scenario, uas, 0)
    let step = stepSweep(run, INSIDE, 0)
    expect(step.firstHitSensorId).toBe('radar')
    expect(step.measuredTechs).toBe(1)
    // Off-scan steps take no sample: the target is outside, the hold carries.
    for (let t = 0.5; t < 4; t += 0.5) {
      step = stepSweep(run, OUTSIDE, t)
      expect(step.firstHitSensorId).toBeNull()
      expect(step.measuredTechs).toBe(1)
      expect(step.held).toBe(true)
    }
    expect(stepSweep(run, INSIDE, 4).firstHitSensorId).toBe('radar')
    const out = finishSweep(run)
    expect(out.firstDetectS).toBe(0)
    expect(out.firstDetectSensorId).toBe('radar')
    expect(out.detectingSensorIds).toEqual(['radar'])
    const obs = out.sensorObservations[0]
    expect(obs.intervals).toEqual([[0, 4]])
    expect(obs.heldSamples).toBe(9)
    expect(obs.lastDetectS).toBe(4)
  })

  it('a cued camera holds only behind a radar hit in the same step or its carried hold', () => {
    const { scenario, uas } = fixture({ updateRateS: 4 }, true)
    const run = prepareSweepRun(scenario, uas, 0)
    // In the camera ring alone: nothing cues it, so nothing holds.
    let step = stepSweep(run, CAMERA_ONLY, 0)
    expect(step.firstHitSensorId).toBeNull()
    expect(step.measuredTechs).toBe(0)
    // The search pass runs first, so the radar keeps the credit and cues the camera.
    step = stepSweep(run, INSIDE, 4)
    expect(step.firstHitSensorId).toBe('radar')
    expect(step.measuredTechs).toBe(2)
    expect(step.fcClassified).toBe(true)
    // Between scans the radar's carried hold is the camera's cue.
    step = stepSweep(run, CAMERA_ONLY, 4.5)
    expect(step.firstHitSensorId).toBe('cam')
    expect(step.measuredTechs).toBe(2)
    const out = finishSweep(run)
    expect(out.firstDetectS).toBe(4)
    expect(out.firstDetectSensorId).toBe('radar')
    expect([...out.detectingSensorIds].sort()).toEqual(['cam', 'radar'])
    expect([...out.techs].sort()).toEqual(['eo-ir', 'radar'])
    for (const obs of out.sensorObservations) expect(obs.intervals).toEqual([[4, 4.5]])
  })

  it('a missed scan before initiation ends the hold; after initiation it coasts', () => {
    const { scenario, uas } = fixture({ updateRateS: 1 })
    let run = prepareSweepRun(scenario, uas, 0)
    stepSweep(run, INSIDE, 0)
    stepSweep(run, OUTSIDE, 0.5)
    let step = stepSweep(run, OUTSIDE, 1)
    expect(step.held).toBe(false)
    expect(step.coastHeld).toBe(false)
    let obs = finishSweep(run).sensorObservations[0]
    expect(obs.trackInitAtS).toBeNull()
    expect(obs.intervals).toEqual([[0, 0.5]])
    expect(obs.coastIntervals).toEqual([])

    // Three detected scans (TRACK_INIT_M) initiate; the next miss coasts.
    run = prepareSweepRun(scenario, uas, 0)
    for (let t = 0; t <= 2.5; t += 0.5) stepSweep(run, INSIDE, t)
    step = stepSweep(run, OUTSIDE, 3)
    expect(step.coastHeld).toBe(true)
    expect(step.held).toBe(true)
    expect(step.measuredTechs).toBe(0)
    stepSweep(run, OUTSIDE, 3.5)
    obs = finishSweep(run).sensorObservations[0]
    expect(obs.trackInitAtS).toBe(2)
    expect(obs.intervals).toEqual([[0, 3.5]])
    expect(obs.coastIntervals).toEqual([[3, 3.5]])
  })

  it('M-of-N keeps a miss in the window and takes the spec M', () => {
    const { scenario, uas } = fixture({ updateRateS: 1 })
    // Detect, miss, detect, detect: 3 of 4 detected, but the miss holds the
    // window's mean Pd at 0.75 and mOfN(0.75, 3, 5) = 0.896 stays under the
    // 0.9 track threshold. The fourth detection lifts the mean to 0.8,
    // mOfN(0.8, 3, 5) = 0.942, and initiates at 4 s.
    const scans = (upToS: number) => {
      const run = prepareSweepRun(scenario, uas, 0)
      for (let t = 0; t <= upToS; t += 0.5) stepSweep(run, t >= 1 && t < 2 ? OUTSIDE : INSIDE, t)
      return finishSweep(run).sensorObservations[0]
    }
    expect(scans(3).trackInitAtS).toBeNull()
    const obs = scans(4)
    expect(obs.trackInitAtS).toBe(4)
    expect(obs.intervals).toEqual([[0, 0.5], [2, 4]])

    const eased = fixture({ updateRateS: 1, trackInitM: 2 })
    const run = prepareSweepRun(eased.scenario, eased.uas, 0)
    for (const t of [0, 1, 2]) stepSweep(run, INSIDE, t)
    expect(finishSweep(run).sensorObservations[0].trackInitAtS).toBe(1)
  })
})

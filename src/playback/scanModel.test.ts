import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Scenario, SensorSpec } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, MOUNT_HEIGHT_M } from '../model/types'
import { FT_TO_M, radarCalibration, radarPdAt } from '../analysis/sensorEnv'
import { rangeForPd } from '../analysis/radarPd'
import { assessAllThreats } from './sim'
import { monteCarloPolicy } from './policy'

/**
 * Slice 1 acceptance: one draw per scan gives the physical first-detection
 * distribution. One quad (0.01 m2, Swerling 1 pinned) flies a 100 m tangent
 * at the range where a hand-built 4 s radar reads single-scan Pd 0.45, so
 * every scan is an independent 0.45 trial and the cumulative probability of
 * a first detection by scan k is 1 - 0.55^k:
 *   k = 1  0.45
 *   k = 2  0.6975
 *   k = 3  0.8336
 *   k = 4  0.9085
 *   k = 5  0.9497
 * The geometry sets the Pd (asserted within 0.005 of 0.45) and the curve is
 * derived from the Pd the fixture reads, so a placard change moves the
 * expectation with it. Reads sim.ts and policy.ts only.
 */
describe('scan model replicate curve', () => {
  const ALT_FT = MOUNT_HEIGHT_M / FT_TO_M
  const REPLICATES = 1000
  const SEED = 4821
  const PERIOD_S = 4

  const spec: SensorSpec = {
    sensorType: 'radar',
    role: 'surveillance',
    detectRangeM: 4000,
    refRcsM2: 0.01,
    classifyRangeM: null,
    sectorDeg: 360,
    updateRateS: PERIOD_S,
  }

  function fixture(): { scenario: Scenario; sensorId: string; uasId: string; rangeM: number } {
    const s = emptyScenario()
    s.doctrine = { ...s.doctrine!, enabled: false }
    s.environment = { ...s.environment, apply: false }
    const rangeM = rangeForPd(radarCalibration(spec), 0.01, 0.45, 1, 1)
    s.library.push(
      {
        id: 'tst-mc-radar',
        name: 'Scan radar',
        kind: 'sensor',
        description: '',
        color: '#0f0',
        builtin: false,
        sensor: spec,
      },
      {
        id: 'tst-mc-uas',
        name: 'Scan quad',
        kind: 'uas',
        description: '',
        color: '#f00',
        builtin: false,
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
      },
    )
    const common = { color: null, notes: '', headingDeg: 0 }
    s.entities.push(
      {
        id: 'e-mc-radar',
        name: 'R1',
        kind: 'sensor',
        specId: 'tst-mc-radar',
        pos: { x: 0, y: 0 },
        ...common,
      },
      {
        id: 'e-mc-uas',
        name: 'T1',
        kind: 'uas',
        specId: 'tst-mc-uas',
        pos: { x: rangeM, y: -50 },
        altitudeFt: ALT_FT,
        ...common,
      },
    )
    // 100 m at 5 m/s: 20 s of flight, so every replicate takes at least five scans.
    s.paths.push({
      id: 'p-mc',
      entityId: 'e-mc-uas',
      points: [
        { x: rangeM, y: -50 },
        { x: rangeM, y: 50 },
      ],
      speedMps: 5,
      startDelayS: 0,
    })
    return { scenario: s, sensorId: 'e-mc-radar', uasId: 'e-mc-uas', rangeM }
  }

  it('the empirical cumulative first-detection curve follows 1 - (1 - Pd)^k within 3 SE', () => {
    const { scenario, sensorId, rangeM } = fixture()
    const uasSpec = scenario.library.find((m) => m.id === 'tst-mc-uas')!.uas
    const pd = radarPdAt(spec, scenario.environment, uasSpec, rangeM)!
    expect(Math.abs(pd - 0.45)).toBeLessThan(0.005)

    const byScan = new Map<number, number>()
    let detected = 0
    let phased = 0
    for (let i = 0; i < REPLICATES; i += 1) {
      const policy = monteCarloPolicy(SEED, i, DEFAULT_REQUIREMENT_THRESHOLDS)
      const a = assessAllThreats(scenario, policy)[0]
      if (a.firstDetectS == null) continue
      detected += 1
      const obs = a.sensorObservations!.find((o) => o.sensorId === sensorId)!
      // Scan k is pdSeriesStartS + (k - 1) * period: the phase moves the
      // origin, never the spacing.
      const offset = a.firstDetectS - obs.pdSeriesStartS!
      expect(Math.abs(offset / PERIOD_S - Math.round(offset / PERIOD_S))).toBeLessThan(1e-9)
      if (obs.pdSeriesStartS! > 0) phased += 1
      const k = Math.round(offset / PERIOD_S) + 1
      byScan.set(k, (byScan.get(k) ?? 0) + 1)
    }
    // The phase draw moves the first scan off the sweep start in most replicates.
    expect(phased).toBeGreaterThan(detected / 2)

    let cumulative = 0
    for (let k = 1; k <= 5; k += 1) {
      cumulative += byScan.get(k) ?? 0
      const empirical = cumulative / REPLICATES
      const expected = 1 - Math.pow(1 - pd, k)
      const se = Math.sqrt((expected * (1 - expected)) / REPLICATES)
      expect(Math.abs(empirical - expected)).toBeLessThanOrEqual(3 * se)
    }
  })
})

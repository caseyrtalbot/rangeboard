import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, FlightPath, SensorSpec, SpecModel, UasSpec } from '../model/types'
import { MOUNT_HEIGHT_M } from '../model/types'
import { rcsM2For } from '../model/rcsFactors'
import { posAtTime } from '../geometry/geo'
import { assessAllThreats } from '../playback/sim'
import { SCAN_S, scanPeriodS } from './doctrineFactors'
import { rangeForPd } from './radarPd'
import { FT_TO_M, effectiveDetectRangeM, radarCalibration } from './sensorEnv'

/**
 * VALIDATION AGAINST PUBLIC DATASHEETS (engine refactor slice 7).
 *
 * The radar range law (radarPd.ts, calibrated at the placard by
 * sensorEnv.ts) is checked against manufacturer range-versus-RCS points.
 * Every expected number is a datasheet value or is hand-derived in the
 * comment above the assertion; none is copied from engine output. Nothing
 * is tuned: the seeds are read as they are, the environment is off (free
 * space), and a point the model misses is pinned as a known deviation.
 *
 * Swerling: no seed here states a placard Swerling case and no datasheet
 * states a target fluctuation model, so every fixture pins the target on
 * the placard case the calibration carries (PLACARD_SWERLING, case 1). At
 * the placard Pd under the placard case rangeForPd is exactly the
 * fourth-root RCS law R = r0 * (rcs / rcs0) ^ (1/4).
 *
 * Sources (url and read date from the seed provenance rows):
 * - Blighter A400 series datasheet (BSS-1311, 2025), free-space table,
 *   M10S antennas. blighter.com/wp-content/uploads/2025/10/
 *   blighter-a400-series-radars-datasheet-bss-1311.pdf, read 2026-09-04.
 * - Echodyne EchoShield spec sheet (6JL, 2026), per-group RCS and range
 *   bands. cdn.prod.website-files.com/69148cb0d4c3689c365788f0/
 *   6a5558f970a01479ae2a92b7_TS-EchoShield-Echodyne_6JL.pdf, read 2026-09-04.
 * - Echodyne EchoGuard spec sheet (6JL, 2026), sUAV rows. cdn.prod.
 *   website-files.com/69148cb0d4c3689c365788f0/
 *   6a55591add6872e68b75655d_TS-EchoGuard-Echodyne_6JL.pdf, read 2026-09-04.
 */

/** Free-space environment: no derate, so the placard range is exact. */
function freeSpace() {
  const s = emptyScenario()
  s.environment.apply = false
  return s
}

function seedSensor(scenario: ReturnType<typeof emptyScenario>, id: string): SensorSpec {
  const model = scenario.library.find((m) => m.id === id)
  if (!model?.sensor) throw new Error(`seed ${id} missing`)
  return model.sensor
}

/** Group 1 quad at a stated RCS, pinned on the placard fluctuation case. */
function target(rcsM2: number, patch?: Partial<UasSpec>): UasSpec {
  return {
    group: 1,
    rcsM2,
    swerling: 1,
    airframe: 'quad',
    cruiseSpeedMps: 40,
    maxSpeedMps: 60,
    enduranceMin: 60,
    altBandFt: [0, 5000],
    navMode: 'gps',
    emissionsNote: '',
    ...patch,
  }
}

const dBsmToM2 = (dBsm: number) => Math.pow(10, dBsm / 10)

describe('Blighter A400 free-space table (BSS-1311, read 2026-09-04)', () => {
  // Datasheet: RCS m2 to detection range km, free space, M10S antennas.
  // The seed lib-a422 carries the 0.01 m2 line as detectRangeM 2730 with
  // refRcsM2 0.01, so that point is the calibration itself (residual 0).
  // Fourth-root law from 2730 m: 0.05 -> 2730 * 5^(1/4) = 4082 m (-0.19%),
  // 0.1 -> 2730 * 10^(1/4) = 4855 m (-0.31%), 0.5 -> 2730 * 50^(1/4) =
  // 7260 m (-0.28%), 1.0 -> 2730 * 100^(1/4) = 8633 m (-0.31%),
  // 10 -> 2730 * 1000^(1/4) = 15352 m (-0.31%). Every point is inside the
  // 2 percent tolerance; the datasheet table itself is a fourth-root law
  // rounded to 10 m.
  const TABLE: Array<[number, number]> = [
    [0.01, 2730],
    [0.05, 4090],
    [0.1, 4870],
    [0.5, 7280],
    [1.0, 8660],
    [10.0, 15400],
  ]

  it('rangeForPd at the placard Pd reproduces each point within 2 percent', () => {
    const cal = radarCalibration(seedSensor(freeSpace(), 'lib-a422'))
    expect(cal.r0M).toBe(2730)
    expect(cal.rcs0M2).toBe(0.01)
    for (const [rcs, sheetM] of TABLE) {
      const r = rangeForPd(cal, rcs, cal.pd0, 1, cal.swerling0)
      expect(Math.abs(r / sheetM - 1), `${rcs} m2`).toBeLessThan(0.02)
    }
    expect(rangeForPd(cal, 0.01, cal.pd0, 1, cal.swerling0)).toBeCloseTo(2730, 6)
  })

  it('the sweep first-detects a 0.01 m2 radial inbound at 2.73 km', () => {
    // Blighter seed at the origin, heading 0 (the 180 deg sector faces
    // north). Threat flies due south from (0, -4330) to the radar at
    // 40 m/s: range(t) = 4330 - 40 t. Altitude pinned at the mount height
    // so slant equals ground range; elevation is 0 deg, inside [0, 30].
    //
    // The seed is Pd-modeled (sourced basis, RCS target) and states no
    // updateRateS, so the scan period is SCAN_S.surveillance = 2 s with
    // scans at t = 0, 2, 4, ... (deterministic phase 0, path delay 0).
    // Deterministic detect: single-scan Pd >= pdDetect 0.5, the placard
    // Pd, so the first detecting scan is the first one at or inside
    // 2730 m. Scan 19 (t = 38) sits at 2810 m: Pd below 0.5, a miss.
    // Scan 20 (t = 40) sits at exactly 2730 m: Pd 0.5, a detection.
    // Expected firstDetectS 40 at ground range 2730 m.
    const scenario = freeSpace()
    const spec = seedSensor(scenario, 'lib-a422')
    expect(scanPeriodS(spec, true)).toBe(SCAN_S.surveillance)
    expect(SCAN_S.surveillance).toBe(2)
    const uasModel: SpecModel = {
      id: 'val-uas',
      name: 'val-uas',
      kind: 'uas',
      description: '',
      color: '#fff',
      builtin: false,
      uas: target(0.01),
    }
    scenario.library = [...scenario.library, uasModel]
    const radar: Entity = {
      id: 'val-radar',
      name: 'val-radar',
      kind: 'sensor',
      specId: 'lib-a422',
      pos: { x: 0, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    }
    const uas: Entity = {
      id: 'val-threat',
      name: 'val-threat',
      kind: 'uas',
      specId: uasModel.id,
      pos: { x: 0, y: -4330 },
      headingDeg: 180,
      color: null,
      notes: '',
      // The target flies at the phase center height, so slant equals
      // ground range and the elevation is 0 inside the gate tolerance.
      altitudeFt: MOUNT_HEIGHT_M / FT_TO_M,
    }
    const path: FlightPath = {
      id: 'val-path',
      entityId: uas.id,
      points: [
        { x: 0, y: -4330 },
        { x: 0, y: 0 },
      ],
      speedMps: 40,
      startDelayS: 0,
    }
    scenario.entities = [radar, uas]
    scenario.paths = [path]

    const a = assessAllThreats(scenario).find((x) => x.uasId === uas.id)!
    expect(a.firstDetectSensorId).toBe(radar.id)
    expect(a.firstDetectS).toBe(40)
    const p = posAtTime(path.points, 40, 0, a.firstDetectS!).pos
    const groundM = Math.hypot(p.x, p.y)
    // 4330 - 40 * 40 = 2730 m; the path interpolation may carry a
    // sub-micrometer rounding, so the bound allows 1e-6 m.
    expect(groundM).toBeGreaterThanOrEqual(2730 - 1e-6)
    expect(groundM).toBeLessThan(2730 + 1e-6)
  })
})

describe('Echodyne EchoShield group bands (6JL sheet, read 2026-09-04)', () => {
  // Datasheet: Group 1 -20 to -10 dBsm tracked at 3 to 5.3 km, Group 2
  // -10 to -3 dBsm at 5.3 to 7.2 km, Group 3 -3 to 5 dBsm at 7.2 to
  // 12.5 km. The seed lib-echoshield carries the Group 1 lower bound as
  // detectRangeM 3000 against refRcsM2 0.01 (-20 dBsm).
  //
  // Each group is tested at its band midpoint in dBsm, converted by
  // rcs = 10 ^ (dBsm / 10): Group 1 -15 dBsm = 0.03162 m2, Group 2
  // -6.5 dBsm = 0.2239 m2, Group 3 +1 dBsm = 1.259 m2. Fourth-root law
  // from 3000 m at 0.01 m2: Group 1 3000 * 3.162^(1/4) = 4000 m,
  // Group 2 3000 * 22.39^(1/4) = 6526 m, Group 3 3000 * 125.9^(1/4) =
  // 10049 m. Each lands inside its published band.
  const GROUPS: Array<[string, number, number, number]> = [
    ['Group 1', -15, 3000, 5300],
    ['Group 2', -6.5, 5300, 7200],
    ['Group 3', 1, 7200, 12500],
  ]

  it('the effective range at each band midpoint RCS lands inside the band', () => {
    const scenario = freeSpace()
    const spec = seedSensor(scenario, 'lib-echoshield')
    expect(spec.detectRangeM).toBe(3000)
    expect(spec.refRcsM2).toBe(0.01)
    for (const [name, dBsm, loM, hiM] of GROUPS) {
      const r = effectiveDetectRangeM(spec, scenario.environment, target(dBsmToM2(dBsm)))
      expect(r, name).toBeGreaterThanOrEqual(loM)
      expect(r, name).toBeLessThanOrEqual(hiM)
    }
  })
})

describe('Echodyne EchoGuard sUAV pair (6JL sheet, read 2026-09-04)', () => {
  // Datasheet: sUAV over 1 km (Phantom 4), over 1.4 km (Matrice 600),
  // 6 km instrumented. The seed lib-echoguard carries the Phantom 4 line
  // as detectRangeM 1000 against refRcsM2 0.01 (the Group 1 planning RCS
  // for the Phantom class), so that point is the calibration (residual 0).

  it('Phantom 4 at the seed reference RCS returns the placard 1000 m', () => {
    const scenario = freeSpace()
    const spec = seedSensor(scenario, 'lib-echoguard')
    expect(spec.detectRangeM).toBe(1000)
    const r = effectiveDetectRangeM(spec, scenario.environment, target(spec.refRcsM2!))
    expect(r).toBeCloseTo(1000, 6)
  })

  it('Matrice 600 through the seed G2 proxy RCS: known deviation +6.8 percent', () => {
    // No seed carries a Matrice 600 RCS. The nearest seed value is the
    // G2 quad tier lib-m350 at 0.05 m2 (a planning factor whose seed
    // comment cites this pair). Fourth-root law from 1000 m at 0.01 m2:
    // 1000 * 5^(1/4) = 1495 m against the sheet's 1400 m, ratio 1.0681,
    // residual +6.8 percent, outside the 2 percent tolerance.
    // KNOWN DEVIATION, pinned. The RCS the pair implies under the law is
    // 0.01 * 1.4^4 = 0.0384 m2, which is an unsourced derived value, not a
    // seed fact. Reported for an R-F row.
    const scenario = freeSpace()
    const spec = seedSensor(scenario, 'lib-echoguard')
    const m350 = scenario.library.find((m) => m.id === 'lib-m350')?.uas
    if (!m350) throw new Error('seed lib-m350 missing')
    expect(rcsM2For(m350)).toBe(0.05)
    const r = effectiveDetectRangeM(spec, scenario.environment, target(rcsM2For(m350)))
    expect(r / 1400).toBeCloseTo(1.0681, 3)
  })
})

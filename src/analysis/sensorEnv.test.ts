import { describe, expect, it } from 'vitest'
import type { EnvironmentSpec, SensorSpec, UasSpec } from '../model/types'
import { defaultEnvironment, emptyScenario } from '../model/seed'
import { RADAR_REF_RCS_M2, RCS_PLANNING_M2, rcsM2For, swerlingFor } from '../model/rcsFactors'
import { groundRangeM } from '../geometry/slant'
import { pdAtRange, rangeForPd, snrAtRange, snrForPd } from './radarPd'
import {
  ACOUSTIC_PLANNING_DB,
  IR_SIGNATURE_FACTOR,
  SPAN_PLANNING_M,
  acousticDbFor,
  irSignatureFor,
  spanMFor,
} from '../model/signatureFactors'
import {
  ALPHA_DB_PER_KM,
  FT_TO_M,
  acousticRangeM,
  acousticSolveM,
  effectiveClassifyRangeM,
  effectiveDetectRangeM,
  effectorGeometryGate,
  eoIrNeedsCue,
  eoRangeFactor,
  jammable,
  NIGHT_VISIBLE_FACTOR,
  pdContoursM,
  radarCalibration,
  radarPdAt,
  rcsRangeFactor,
  refRcsM2For,
  rfCanHear,
  rfDetectable,
  SENSOR_ENV_MODEL,
  sensorEnvFactor,
  sensorGeometryGate,
  sensorHoldGate,
  VISIBILITY_BY_PRECIP,
  visibilityMFor,
} from './sensorEnv'

function env(patch: Partial<EnvironmentSpec>): EnvironmentSpec {
  return { ...defaultEnvironment(), ...patch }
}

const RADAR: SensorSpec = { sensorType: 'radar', detectRangeM: 10000, classifyRangeM: null, sectorDeg: 360 }
const EO: SensorSpec = { sensorType: 'eo-ir', detectRangeM: 3000, classifyRangeM: 1500, sectorDeg: 360 }

describe('sensorEnvFactor', () => {
  it('is 1 on a clear day', () => {
    for (const t of ['radar', 'eo-ir', 'rf', 'acoustic'] as const) {
      expect(sensorEnvFactor(t, env({}))).toBe(1)
    }
  })

  it('is 1 for every condition when apply is off', () => {
    const e = env({ apply: false, precipitation: 'fog', light: 'night', windSpeedMps: 20 })
    for (const t of ['radar', 'eo-ir', 'rf', 'acoustic'] as const) {
      expect(sensorEnvFactor(t, e)).toBe(1)
    }
  })

  it('fog hits EO/IR hardest and leaves RF alone', () => {
    const e = env({ precipitation: 'fog' })
    expect(sensorEnvFactor('eo-ir', e)).toBeLessThan(sensorEnvFactor('radar', e))
    expect(sensorEnvFactor('rf', e)).toBe(1)
  })

  it('night is a per-band EO/IR effect, not a type-wide factor', () => {
    const e = env({ light: 'night' })
    for (const t of ['radar', 'eo-ir', 'rf', 'acoustic'] as const) {
      expect(sensorEnvFactor(t, e)).toBe(1)
    }
  })

  it('urban EM clutter degrades RF most', () => {
    const e = env({ emBackground: 'urban' })
    expect(sensorEnvFactor('rf', e)).toBe(SENSOR_ENV_MODEL.urbanEm.rf)
  })

  it('wind derates acoustic down to the floor', () => {
    expect(sensorEnvFactor('acoustic', env({ windSpeedMps: 10 }))).toBeCloseTo(0.7)
    expect(sensorEnvFactor('acoustic', env({ windSpeedMps: 25 }))).toBe(
      SENSOR_ENV_MODEL.acousticWindFloor,
    )
  })

  it('conditions multiply', () => {
    const e = env({ precipitation: 'rain', emBackground: 'urban' })
    expect(sensorEnvFactor('acoustic', e)).toBeCloseTo(
      SENSOR_ENV_MODEL.rain.acoustic * SENSOR_ENV_MODEL.urbanEm.acoustic,
    )
  })
})

function uas(patch: Partial<UasSpec>): UasSpec {
  return {
    group: 1,
    airframe: 'quad',
    cruiseSpeedMps: 15,
    maxSpeedMps: 20,
    enduranceMin: 30,
    altBandFt: [50, 400],
    navMode: 'gps',
    emissionsNote: '',
    ...patch,
  }
}

describe('RCS planning factors', () => {
  it('uses the spec RCS first, then the group tier', () => {
    expect(rcsM2For(uas({ group: 3, rcsM2: 0.5 }))).toBe(0.5)
    expect(rcsM2For(uas({ group: 3 }))).toBe(RCS_PLANNING_M2[3])
    expect(rcsM2For(uas({ group: 3, rcsM2: 0 }))).toBe(RCS_PLANNING_M2[3])
  })

  it('tiers grow with group', () => {
    for (let g = 1; g < 5; g++) {
      expect(RCS_PLANNING_M2[(g + 1) as 1 | 2 | 3 | 4 | 5]).toBeGreaterThan(
        RCS_PLANNING_M2[g as 1 | 2 | 3 | 4 | 5],
      )
    }
  })

  it('reference RCS defaults to the Group 1 tier', () => {
    expect(refRcsM2For(RADAR)).toBe(RADAR_REF_RCS_M2)
    expect(RADAR_REF_RCS_M2).toBe(RCS_PLANNING_M2[1])
    expect(refRcsM2For({ ...RADAR, refRcsM2: 0.2 })).toBe(0.2)
  })
})

describe('rcsRangeFactor', () => {
  it('is 1 for the target the range was quoted against', () => {
    expect(rcsRangeFactor(RADAR, uas({ group: 1 }))).toBe(1)
    expect(rcsRangeFactor({ ...RADAR, refRcsM2: 0.2 }, uas({ group: 3 }))).toBeCloseTo(1)
  })

  it('follows the fourth-root law', () => {
    expect(rcsRangeFactor(RADAR, uas({ rcsM2: 0.16 }))).toBeCloseTo(2)
    expect(rcsRangeFactor(RADAR, uas({ rcsM2: 0.01 / 16 }))).toBeCloseTo(0.5)
  })

  it('reproduces the Blighter A400 datasheet RCS table', () => {
    // 2.73 km at 0.01 m2; datasheet companions 4.87 km, 8.66 km, 15.4 km.
    const a422: SensorSpec = { ...RADAR, detectRangeM: 2730, refRcsM2: 0.01 }
    const e = env({})
    expect(effectiveDetectRangeM(a422, e, uas({ rcsM2: 0.1 }))).toBeCloseTo(4870, -2)
    expect(effectiveDetectRangeM(a422, e, uas({ rcsM2: 1 }))).toBeCloseTo(8660, -2)
    expect(effectiveDetectRangeM(a422, e, uas({ rcsM2: 10 }))).toBeCloseTo(15400, -2)
  })

  it('is 1 for non-radar sensors and for an unknown target', () => {
    expect(rcsRangeFactor(EO, uas({ group: 5 }))).toBe(1)
    expect(rcsRangeFactor({ ...RADAR, sensorType: 'rf' }, uas({ group: 5 }))).toBe(1)
    expect(rcsRangeFactor(RADAR, undefined)).toBe(1)
  })
})

describe('effectiveDetectRangeM', () => {
  it('scales radar range with the target RCS', () => {
    expect(effectiveDetectRangeM(RADAR, env({}), uas({ group: 1 }))).toBe(10000)
    expect(effectiveDetectRangeM(RADAR, env({}), uas({ group: 3 }))).toBeCloseTo(
      10000 * Math.pow(RCS_PLANNING_M2[3] / RADAR_REF_RCS_M2, 0.25),
    )
  })

  it('does not scale EO/IR with target RCS', () => {
    expect(effectiveDetectRangeM(EO, env({}), uas({ group: 5, rcsM2: 100, spanM: 0.4 }))).toBe(3000)
  })

  it('still scales with RCS when the environment toggle is off', () => {
    const e = env({ apply: false, precipitation: 'fog' })
    expect(effectiveDetectRangeM(RADAR, e, uas({ rcsM2: 0.16 }))).toBeCloseTo(20000)
  })

  it('caps at the instrumented range', () => {
    const capped: SensorSpec = { ...RADAR, instrumentedRangeM: 12000 }
    expect(effectiveDetectRangeM(capped, env({}), uas({ group: 5 }))).toBe(12000)
    expect(effectiveDetectRangeM(capped, env({}), uas({ group: 1 }))).toBe(10000)
    const tight: SensorSpec = { ...RADAR, classifyRangeM: 9000, instrumentedRangeM: 9500 }
    expect(effectiveClassifyRangeM(tight, env({}), uas({ group: 5 }))).toBe(9500)
  })

  it('caps a span-scaled EO/IR range at the maximum reported range', () => {
    const wisp: SensorSpec = {
      sensorType: 'eo-ir',
      role: 'surveillance',
      eoBand: 'thermal',
      detectRangeM: 4800,
      classifyRangeM: null,
      sectorDeg: 360,
      instrumentedRangeM: 16000,
    }
    const big = uas({ group: 3, airframe: 'one-way-attack', spanM: 2.5 })
    expect(effectiveDetectRangeM(wisp, env({}), big)).toBe(16000)
    expect(effectiveDetectRangeM({ ...wisp, instrumentedRangeM: null }, env({}), big)).toBeGreaterThan(16000)
  })

  it('combines weather and RCS, then caps', () => {
    const e = env({ precipitation: 'rain' })
    expect(effectiveDetectRangeM(RADAR, e, uas({ rcsM2: 0.16 }))).toBeCloseTo(
      10000 * SENSOR_ENV_MODEL.rain.radar * 2,
    )
    const capped: SensorSpec = { ...RADAR, instrumentedRangeM: 14000 }
    expect(effectiveDetectRangeM(capped, e, uas({ rcsM2: 0.16 }))).toBe(14000)
  })
})

describe('emissions logic', () => {
  const base = {
    group: 1 as const,
    airframe: 'fpv' as const,
    cruiseSpeedMps: 20,
    maxSpeedMps: 30,
    enduranceMin: 15,
    altBandFt: [10, 400] as [number, number],
    emissionsNote: '',
  }

  it('RF sensors hear manual and mixed links only', () => {
    expect(rfDetectable({ ...base, navMode: 'rf-manual' })).toBe(true)
    expect(rfDetectable({ ...base, navMode: 'mixed' })).toBe(true)
    expect(rfDetectable({ ...base, navMode: 'fiber' })).toBe(false)
    expect(rfDetectable({ ...base, navMode: 'inertial' })).toBe(false)
    expect(rfDetectable({ ...base, navMode: 'gps' })).toBe(false)
  })

  it('jammers affect GNSS or RF-linked threats only', () => {
    expect(jammable({ ...base, navMode: 'gps' })).toBe(true)
    expect(jammable({ ...base, navMode: 'rf-manual' })).toBe(true)
    expect(jammable({ ...base, navMode: 'fiber' })).toBe(false)
    expect(jammable({ ...base, navMode: 'inertial' })).toBe(false)
    expect(jammable({ ...base, navMode: 'optical' })).toBe(false)
  })
})

const ACOUSTIC: SensorSpec = {
  sensorType: 'acoustic',
  detectRangeM: 500,
  classifyRangeM: null,
  sectorDeg: 360,
}
const RF: SensorSpec = { sensorType: 'rf', detectRangeM: 4000, classifyRangeM: 4000, sectorDeg: 360 }

describe('EO/IR span and thermal scaling', () => {
  it('span tiers grow with group and the spec span wins', () => {
    for (let g = 1; g < 5; g++) {
      expect(SPAN_PLANNING_M[(g + 1) as 1 | 2 | 3 | 4 | 5]).toBeGreaterThan(
        SPAN_PLANNING_M[g as 1 | 2 | 3 | 4 | 5],
      )
    }
    expect(spanMFor(uas({ group: 3 }))).toBe(SPAN_PLANNING_M[3])
    expect(spanMFor(uas({ group: 3, spanM: 2.5 }))).toBe(2.5)
  })

  it('scales linearly with the span ratio (Johnson criteria)', () => {
    const e = env({})
    expect(eoRangeFactor(EO, uas({ spanM: 0.4 }), e)).toBe(1)
    expect(eoRangeFactor(EO, uas({ spanM: 0.8 }), e)).toBeCloseTo(2)
    expect(eoRangeFactor({ ...EO, refSpanM: 2 }, uas({ spanM: 1 }), e)).toBeCloseTo(0.5)
    expect(effectiveDetectRangeM(EO, e, uas({ spanM: 1.2 }))).toBeCloseTo(9000)
    expect(effectiveClassifyRangeM(EO, e, uas({ spanM: 1.2 }))).toBeCloseTo(4500)
  })

  it('is 1 for non-EO sensors and an unknown target', () => {
    expect(eoRangeFactor(RADAR, uas({ spanM: 10 }), env({}))).toBe(1)
    expect(eoRangeFactor(EO, undefined, env({}))).toBe(1)
  })

  it('caps at the meteorological visibility (Koschmieder)', () => {
    expect(visibilityMFor(env({}))).toBe(VISIBILITY_BY_PRECIP.clear)
    expect(visibilityMFor(env({ precipitation: 'fog' }))).toBe(VISIBILITY_BY_PRECIP.fog)
    expect(visibilityMFor(env({ precipitation: 'fog', visibilityM: 1500 }))).toBe(1500)
    // A TB2-sized target would be seen at 30x range; visibility stops it at 20 km.
    expect(effectiveDetectRangeM(EO, env({}), uas({ spanM: 12 }))).toBe(20000)
    expect(effectiveDetectRangeM(EO, env({ visibilityM: 2000 }), uas({ spanM: 0.4 }))).toBe(2000)
    // Fog: contrast multiplier and the 600 m visibility cap both apply.
    expect(effectiveDetectRangeM(EO, env({ precipitation: 'fog' }))).toBe(600)
    // Radar is not visibility-limited.
    expect(effectiveDetectRangeM(RADAR, env({ visibilityM: 100 }))).toBe(10000)
    // Toggle off: no cap.
    expect(effectiveDetectRangeM(EO, env({ apply: false }), uas({ spanM: 12 }))).toBe(90000)
  })

  it('night: visible-only falls to the night factor, thermal and dual keep range', () => {
    const night = env({ light: 'night' })
    expect(eoRangeFactor({ ...EO, eoBand: 'visible' }, undefined, night)).toBe(NIGHT_VISIBLE_FACTOR)
    expect(eoRangeFactor({ ...EO, eoBand: 'thermal' }, undefined, night)).toBe(1)
    expect(eoRangeFactor(EO, undefined, night)).toBe(1)
    expect(eoRangeFactor({ ...EO, eoBand: 'visible' }, undefined, env({}))).toBe(1)
  })

  it('thermal contrast applies when the thermal channel carries', () => {
    const quad = uas({ airframe: 'quad', spanM: 0.4 })
    const owa = uas({ airframe: 'one-way-attack', spanM: 0.4 })
    expect(irSignatureFor(quad)).toBe('low')
    expect(irSignatureFor(owa)).toBe('high')
    expect(irSignatureFor({ ...owa, irSignature: 'low' })).toBe('low')
    // Dual by day: the visible channel carries, no thermal term.
    expect(eoRangeFactor(EO, quad, env({}))).toBe(1)
    // Dual at night and a thermal sensor by day: the thermal term applies.
    expect(eoRangeFactor(EO, quad, env({ light: 'night' }))).toBe(IR_SIGNATURE_FACTOR.low)
    expect(eoRangeFactor({ ...EO, eoBand: 'thermal' }, quad, env({}))).toBe(IR_SIGNATURE_FACTOR.low)
    expect(eoRangeFactor({ ...EO, eoBand: 'thermal' }, owa, env({}))).toBe(1)
  })
})

describe('acoustic source-level scaling', () => {
  it('tiers grow with group and the spec level wins', () => {
    for (let g = 1; g < 5; g++) {
      expect(ACOUSTIC_PLANNING_DB[(g + 1) as 1 | 2 | 3 | 4 | 5]).toBeGreaterThan(
        ACOUSTIC_PLANNING_DB[g as 1 | 2 | 3 | 4 | 5],
      )
    }
    expect(acousticDbFor(uas({ group: 3 }))).toBe(ACOUSTIC_PLANNING_DB[3])
    expect(acousticDbFor(uas({ group: 3, acousticDb: 88 }))).toBe(88)
  })

  it('equal levels give the reference range exactly', () => {
    expect(acousticSolveM(500, 0)).toBe(500)
    expect(acousticRangeM(ACOUSTIC, uas({ group: 1 }), env({}))).toBe(500)
    expect(acousticRangeM(ACOUSTIC, undefined, env({}))).toBe(500)
  })

  it('+20 dB is about 10x at short range, less at long range where absorption bites', () => {
    const near = acousticSolveM(10, 20)
    expect(near / 10).toBeGreaterThan(9)
    expect(near / 10).toBeLessThan(10)
    const far = acousticSolveM(2000, 20)
    expect(far / 2000).toBeLessThan(6)
    expect(far).toBeGreaterThan(2000)
    // The solution satisfies the spreading-plus-absorption equation.
    const lhs = 20 * Math.log10(far / 2000) + (ALPHA_DB_PER_KM * (far - 2000)) / 1000
    expect(lhs).toBeCloseTo(20, 6)
    // Quieter source: closer (spreading alone says 50 m; the shorter path
    // gives back some absorption, so a little farther).
    const quiet = acousticSolveM(500, -20)
    expect(quiet).toBeGreaterThan(50)
    expect(quiet).toBeLessThan(70)
  })

  it('wind and urban multiply on top of the solved range', () => {
    const loud = uas({ group: 1, acousticDb: 90 })
    const calm = acousticRangeM(ACOUSTIC, loud, env({}))
    expect(calm).toBeGreaterThan(500)
    expect(acousticRangeM(ACOUSTIC, loud, env({ windSpeedMps: 10 }))).toBeCloseTo(calm * 0.7)
    expect(effectiveDetectRangeM(ACOUSTIC, env({ emBackground: 'urban' }), loud)).toBeCloseTo(
      calm * SENSOR_ENV_MODEL.urbanEm.acoustic,
    )
  })
})

describe('RF band coverage and urban override', () => {
  const link = uas({ navMode: 'rf-manual' }) // default bands 2.4 / 5.8 GHz

  it('rfCanHear needs an emitting band inside the receiver coverage', () => {
    expect(rfCanHear(RF, link)).toBe(true)
    expect(rfCanHear({ ...RF, rfBands: ['ism-2400'] }, link)).toBe(true)
    expect(rfCanHear({ ...RF, rfBands: ['uhf-433', 'ism-915'] }, link)).toBe(false)
    expect(rfCanHear({ ...RF, rfBands: ['uhf-433'] }, { ...link, linkBands: ['uhf-433'] })).toBe(true)
    // GNSS is received, never transmitted: it never counts as an emission.
    expect(rfCanHear({ ...RF, rfBands: ['gnss'] }, uas({ navMode: 'mixed' }))).toBe(false)
    expect(rfCanHear(RF, uas({ navMode: 'fiber' }))).toBe(false)
  })

  it('a published urban range replaces the generic urban multiplier', () => {
    const urban = env({ emBackground: 'urban' })
    expect(effectiveDetectRangeM(RF, urban)).toBeCloseTo(4000 * SENSOR_ENV_MODEL.urbanEm.rf)
    const sourced: SensorSpec = { ...RF, urbanRangeM: 1000 }
    expect(effectiveDetectRangeM(sourced, urban)).toBe(1000)
    expect(effectiveClassifyRangeM(sourced, urban)).toBe(1000)
    expect(effectiveDetectRangeM(sourced, env({}))).toBe(4000)
    expect(effectiveDetectRangeM(sourced, env({ ...urban, apply: false }))).toBe(4000)
  })
})

describe('range basis', () => {
  it('a planning figure is never target-scaled', () => {
    const planRadar: SensorSpec = { ...RADAR, rangeBasis: 'planning' }
    expect(rcsRangeFactor(planRadar, uas({ rcsM2: 1 }))).toBe(1)
    expect(effectiveDetectRangeM(planRadar, env({}), uas({ rcsM2: 1 }))).toBe(10000)
    const planEo: SensorSpec = { ...EO, rangeBasis: 'planning', eoBand: 'thermal' }
    expect(eoRangeFactor(planEo, uas({ spanM: 4 }), env({}))).toBe(1)
    const planAc: SensorSpec = { ...ACOUSTIC, rangeBasis: 'planning' }
    expect(acousticRangeM(planAc, uas({ acousticDb: 105 }), env({}))).toBe(500)
    // Environment still applies to a planning figure.
    expect(effectiveDetectRangeM(planRadar, env({ precipitation: 'rain' }), uas({ rcsM2: 1 }))).toBe(
      7500,
    )
  })
})

describe('cue rule and hold gate', () => {
  it('only narrow-field EO/IR roles need a cue', () => {
    expect(eoIrNeedsCue(EO)).toBe(true) // default role: classification
    for (const role of ['classification', 'fire-control', 'tracking', 'target-acquisition'] as const) {
      expect(eoIrNeedsCue({ ...EO, role })).toBe(true)
    }
    for (const role of ['surveillance', 'early-warning'] as const) {
      expect(eoIrNeedsCue({ ...EO, role })).toBe(false)
    }
    expect(eoIrNeedsCue({ ...RADAR, role: 'classification' })).toBe(false)
  })

  it('sensorHoldGate names the reason a sensor cannot hold', () => {
    expect(sensorHoldGate(RADAR, uas({}))).toBe('ok')
    expect(sensorHoldGate(RADAR, undefined)).toBe('ok')
    expect(sensorHoldGate(EO, undefined)).toBe('needs-cue')
    expect(sensorHoldGate({ ...EO, role: 'surveillance' }, uas({}))).toBe('ok')
    expect(sensorHoldGate(RF, uas({ navMode: 'fiber' }))).toBe('rf-silent')
    expect(sensorHoldGate(RF, uas({ navMode: 'gps' }))).toBe('rf-silent')
    expect(sensorHoldGate({ ...RF, rfBands: ['uhf-433'] }, uas({ navMode: 'rf-manual' }))).toBe(
      'rf-band',
    )
    expect(sensorHoldGate(RF, uas({ navMode: 'rf-manual' }))).toBe('ok')
    expect(sensorHoldGate(RF, undefined)).toBe('ok')
    expect(sensorHoldGate({ ...RADAR, detectRangeM: 0 }, uas({}))).toBe('no-range')
    expect(sensorHoldGate({ ...EO, detectRangeM: -5 }, undefined)).toBe('no-range')
  })
})

describe('vertical geometry gates', () => {
  const ACOUSTIC: SensorSpec = {
    sensorType: 'acoustic',
    detectRangeM: 4000,
    classifyRangeM: null,
    sectorDeg: 360,
  }
  /** Mohajer-6 cruise, 14,000 ft, meters. */
  const HIGH_M = 14000 * FT_TO_M

  it('ceiling applies only when maxAltitudeFt is recorded', () => {
    expect(sensorGeometryGate({ ...RADAR, maxAltitudeFt: 10000 }, 4, HIGH_M, 5000)).toBe('ceiling')
    expect(sensorGeometryGate({ ...RADAR, maxAltitudeFt: null }, 4, HIGH_M, 5000)).toBe('ok')
    expect(sensorGeometryGate({ ...RADAR, maxAltitudeFt: 20000 }, 4, HIGH_M, 5000)).toBe('ok')
    // The ceiling is a coverage limit, so it gates acoustic sensors too.
    expect(sensorGeometryGate({ ...ACOUSTIC, maxAltitudeFt: 10000 }, 4, HIGH_M, 500)).toBe('ceiling')
  })

  it('a target beyond the 4/3 earth radio horizon is below-horizon', () => {
    // 4 m mast to a 2 m target: 4120 * (2 + 1.414) = 14.07 km.
    expect(sensorGeometryGate(RADAR, 4, 2, 60000)).toBe('below-horizon')
    expect(sensorGeometryGate(RADAR, 4, 2, 14000)).toBe('ok')
    expect(sensorGeometryGate({ ...RADAR, sensorType: 'rf' }, 4, 2, 60000)).toBe('below-horizon')
    expect(sensorGeometryGate(EO, 4, 2, 60000)).toBe('below-horizon')
  })

  it('acoustic sensors need no line of sight, so the horizon never gates them', () => {
    expect(sensorGeometryGate(ACOUSTIC, 4, 2, 60000)).toBe('ok')
    expect(sensorGeometryGate({ ...ACOUSTIC, elevationDeg: [0, 30] }, 4, 100, 10)).toBe('ok')
  })

  it('elevation applies only when elevationDeg is recorded', () => {
    const limited: SensorSpec = { ...RADAR, elevationDeg: [0, 30] }
    // 104 m up at 100 m out: 45 deg, above the 30 deg limit (cone of silence).
    expect(sensorGeometryGate(limited, 4, 104, 100)).toBe('elevation')
    // 1 km out at ground level: -0.23 deg, below the 0 deg floor.
    expect(sensorGeometryGate(limited, 4, 0, 1000)).toBe('elevation')
    // 100 m up at 1 km: 5.5 deg, inside the band.
    expect(sensorGeometryGate(limited, 4, 100, 1000)).toBe('ok')
    expect(sensorGeometryGate(RADAR, 4, 104, 100)).toBe('ok')
    expect(sensorGeometryGate({ ...RADAR, elevationDeg: null }, 4, 0, 1000)).toBe('ok')
  })

  it('the elevation gate carries a 0.001 degree tolerance at both edges', () => {
    const limited: SensorSpec = { ...RADAR, elevationDeg: [0, 30] }
    // 1e-9 m below the phase center at 1 km: about -6e-11 deg, inside the tolerance.
    expect(sensorGeometryGate(limited, 4, 4 - 1e-9, 1000)).toBe('ok')
    // -0.01 deg at 1 km is 0.1745 m below: outside.
    expect(sensorGeometryGate(limited, 4, 4 - 1000 * Math.tan((0.01 * Math.PI) / 180), 1000))
      .toBe('elevation')
    // The upper edge: 30 deg plus 1e-6 is inside the tolerance, 30.01 is not.
    const up = (deg: number) => 4 + 1000 * Math.tan((deg * Math.PI) / 180)
    expect(sensorGeometryGate(limited, 4, up(30 + 1e-6), 1000)).toBe('ok')
    expect(sensorGeometryGate(limited, 4, up(30.01), 1000)).toBe('elevation')
  })

  it('effectorGeometryGate is the ceiling alone', () => {
    const eff = { effectorType: 'interceptor' as const, minRangeM: 0, maxRangeM: 10000, engageTimeS: 0 }
    expect(effectorGeometryGate({ ...eff, maxAltitudeFt: 3000 }, HIGH_M)).toBe('ceiling')
    expect(effectorGeometryGate({ ...eff, maxAltitudeFt: 20000 }, HIGH_M)).toBe('ok')
    expect(effectorGeometryGate({ ...eff, maxAltitudeFt: null }, HIGH_M)).toBe('ok')
    expect(effectorGeometryGate(eff, HIGH_M)).toBe('ok')
  })
})

describe('radar Pd model', () => {
  const clear = env({})
  const rain = env({ precipitation: 'rain' })
  const M_RAIN = SENSOR_ENV_MODEL.rain.radar
  /** Today's law, before the Pd model: placard x fourth root of the RCS ratio x environment. */
  const fourthRoot = (target: UasSpec | undefined, m: number) =>
    RADAR.detectRangeM * (target ? Math.pow(rcsM2For(target) / RADAR_REF_RCS_M2, 0.25) : 1) * m
  const relClose = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-9 * b)
  const library = emptyScenario().library
  const GIRAFFE = library.find((m) => m.id === 'lib-giraffe1x')!.sensor!
  const MOHAJER = library.find((m) => m.id === 'lib-mohajer6')!.uas!

  it('radarCalibration reads the placard: detect range, reference RCS, PF Pd, Pfa and case', () => {
    expect(radarCalibration(RADAR)).toEqual({
      r0M: 10000,
      rcs0M2: 0.01,
      pd0: 0.5,
      pfa: 1e-6,
      swerling0: 1,
    })
    expect(radarCalibration({ ...RADAR, refRcsM2: 0.1, placardPd: 0.8, pfa: 1e-4 })).toEqual({
      r0M: 10000,
      rcs0M2: 0.1,
      pd0: 0.8,
      pfa: 1e-4,
      swerling0: 1,
    })
    // A Pd or Pfa outside (0, 1) is not a probability: the planning factor stands in.
    expect(radarCalibration({ ...RADAR, placardPd: 1, pfa: 0 })).toMatchObject({ pd0: 0.5, pfa: 1e-6 })
  })

  it('with defaults, a Swerling 1 target returns the pre-slice fourth-root value to 1e-9 relative', () => {
    // Quad airframes resolve to Swerling 1, the placard case, so the SNR ratio is exactly 1.
    relClose(effectiveDetectRangeM(RADAR, clear), fourthRoot(undefined, 1))
    relClose(effectiveDetectRangeM(RADAR, clear, uas({ group: 1 })), fourthRoot(uas({ group: 1 }), 1))
    relClose(effectiveDetectRangeM(RADAR, clear, uas({ group: 3 })), fourthRoot(uas({ group: 3 }), 1))
    relClose(effectiveDetectRangeM(RADAR, rain, uas({ group: 3 })), fourthRoot(uas({ group: 3 }), M_RAIN))
    relClose(effectiveDetectRangeM(RADAR, clear, uas({ group: 3 }), 0.5), fourthRoot(uas({ group: 3 }), 1))
  })

  it('the environment multiplier enters the SNR as the fourth power', () => {
    const t = uas({ group: 3 })
    const cal = radarCalibration(RADAR)
    expect(snrAtRange(cal, 0.2, 8000, M_RAIN)).toBeCloseTo(
      snrAtRange(cal, 0.2, 8000, 1) * Math.pow(M_RAIN, 4),
      9,
    )
    // Rain at R reads the same Pd as clear air at R / m.
    expect(radarPdAt(RADAR, rain, t, 9000)).toBeCloseTo(radarPdAt(RADAR, clear, t, 9000 / M_RAIN)!, 9)
  })

  it('radarPdAt is null without a Pd model, 0 beyond the instrumented range, and falls with range', () => {
    const t = uas({ group: 3 })
    expect(radarPdAt(EO, clear, t, 1000)).toBeNull()
    expect(radarPdAt({ ...RADAR, rangeBasis: 'planning' }, clear, t, 1000)).toBeNull()
    expect(radarPdAt(RADAR, clear, undefined, 1000)).toBeNull()
    const capped: SensorSpec = { ...RADAR, instrumentedRangeM: 12000 }
    expect(radarPdAt(capped, clear, t, 12001)).toBe(0)
    expect(radarPdAt(capped, clear, t, 12000)).toBeGreaterThan(0)
    let last = 1
    for (let r = 1000; r <= 30000; r += 1000) {
      const pd = radarPdAt(RADAR, clear, t, r)!
      expect(pd).toBeLessThan(last)
      last = pd
    }
    // At the placard range against the placard target the placard Pd comes back.
    expect(radarPdAt(RADAR, clear, uas({ group: 1 }), 10000)).toBeCloseTo(0.5, 12)
  })

  it('effectiveDetectRangeM at pd is rangeForPd; a planning-basis radar ignores pd', () => {
    const t = uas({ group: 3 })
    const cal = radarCalibration(RADAR)
    expect(effectiveDetectRangeM(RADAR, rain, t, 0.9)).toBe(
      rangeForPd(cal, rcsM2For(t), 0.9, M_RAIN, swerlingFor(t)),
    )
    expect(effectiveDetectRangeM(RADAR, clear, t, 0.9)).toBeLessThan(effectiveDetectRangeM(RADAR, clear, t))
    const capped: SensorSpec = { ...RADAR, instrumentedRangeM: 9000 }
    expect(effectiveDetectRangeM(capped, clear, t, 0.1)).toBe(9000)
    const plan: SensorSpec = { ...RADAR, rangeBasis: 'planning' }
    expect(effectiveDetectRangeM(plan, clear, t, 0.9)).toBe(10000)
    expect(effectiveDetectRangeM(plan, clear, t, 0.1)).toBe(10000)
    // A pd outside (0, 1) is not a contour: it reads as the placard Pd, never Infinity.
    expect(effectiveDetectRangeM(RADAR, clear, t, 0)).toBe(effectiveDetectRangeM(RADAR, clear, t))
    expect(pdContoursM(RADAR, clear, t, [0, 1])).toEqual([
      effectiveDetectRangeM(RADAR, clear, t),
      effectiveDetectRangeM(RADAR, clear, t),
    ])
  })

  it('pdContoursM: Giraffe 1X vs Mohajer-6 at Pd 0.5 and 0.9', () => {
    // Placard 4000 m at 0.01 m2, Pd 0.5, Pfa 1e-6, case 1: snr0 = ln(1e-6) / ln(0.5) - 1 = 18.9316.
    // Mohajer-6: 1 m2 (ratio 100), fixed-wing so Swerling 3.
    //   Pd 0.5 case 3 needs SNR 15.6809 (11.954 dB): R = 4000 * (100 * 18.9316 / 15.6809)^0.25 = 13,259.09 m.
    //   Pd 0.9 case 3 needs SNR 53.6532 (17.296 dB): R = 4000 * (100 * 18.9316 / 53.6532)^0.25 = 9,748.95 m.
    expect(swerlingFor(MOHAJER)).toBe(3)
    const [r50, r90] = pdContoursM(GIRAFFE, clear, MOHAJER, [0.5, 0.9])
    expect(r50).toBeCloseTo(13259.09, 2)
    expect(r90).toBeCloseTo(9748.95, 2)
    expect(snrForPd(0.5, 1e-6, 3)).toBeCloseTo(15.6809, 4)
    expect(snrForPd(0.9, 1e-6, 3)).toBeCloseTo(53.6532, 4)
    // Ground projection from a 4 m mast to 14,000 ft: 12,555.02 m and 8,767.39 m.
    const dAlt = 14000 * FT_TO_M - 4
    expect(groundRangeM(r50, dAlt)).toBeCloseTo(12555.02, 2)
    expect(groundRangeM(r90, dAlt)).toBeCloseTo(8767.39, 2)
    // Forced to the placard case the 0.5 contour is the fourth-root value, 12,649.11 m; 0.9 is 7,812.06 m.
    const [c50, c90] = pdContoursM(GIRAFFE, clear, { ...MOHAJER, swerling: 1 }, [0.5, 0.9])
    expect(c50).toBeCloseTo(4000 * Math.pow(100, 0.25), 9)
    expect(c90).toBeCloseTo(7812.06, 2)
    // EO/IR has no Pd model: every contour is the one effective range.
    const eoM = effectiveDetectRangeM(EO, clear, MOHAJER)
    expect(pdContoursM(EO, clear, MOHAJER, [0.5, 0.9])).toEqual([eoM, eoM])
  })

  it('a fixed-wing target (Swerling 3) reads 4.8 percent farther than the fourth-root law at Pd 0.5', () => {
    // Intended model (D11): the placard is quoted for a case 1 target, and a case 3 target needs
    // 11.954 dB instead of 12.772 dB for Pd 0.5 at Pfa 1e-6, so (18.9316 / 15.6809)^0.25 = 1.04822.
    const fw = uas({ group: 3, airframe: 'fixed-wing' })
    const ratio = effectiveDetectRangeM(RADAR, clear, fw) / fourthRoot(fw, 1)
    expect(ratio).toBeCloseTo(1.04822, 5)
    expect(pdAtRange(radarCalibration(RADAR), rcsM2For(fw), fourthRoot(fw, 1), 1, 3)).toBeCloseTo(0.586, 3)
  })
})

import { describe, expect, it } from 'vitest'
import { defaultEnvironment } from '../../model/seed'
import type { EnvironmentSpec, SensorSpec, UasSpec } from '../../model/types'
import {
  JOHNSON_CYCLES,
  KOSCHMIEDER_CONTRAST,
  THERMAL_EXTINCTION_RATIO,
  eoBandFor,
  eoExtinctionPerM,
  eoIfovRadFor,
  eoIrDriRangesM,
  eoIrRangeM,
  eoPixelsOnTarget,
  eoTransmissionAt,
} from './eoir'

function env(patch: Partial<EnvironmentSpec> = {}): EnvironmentSpec {
  return { ...defaultEnvironment(), ...patch }
}

function sensor(patch: Partial<SensorSpec> = {}): SensorSpec {
  return {
    sensorType: 'eo-ir',
    detectRangeM: 3000,
    classifyRangeM: 1500,
    sectorDeg: 360,
    eoBand: 'visible',
    pixelPitchUm: 10,
    focalLengthMm: 250,
    ...patch,
  }
}

function target(patch: Partial<UasSpec> = {}): UasSpec {
  return {
    group: 1,
    airframe: 'quad',
    cruiseSpeedMps: 20,
    maxSpeedMps: 30,
    enduranceMin: 30,
    altBandFt: [0, 500],
    navMode: 'gps',
    emissionsNote: '',
    spanM: 0.8,
    irSignature: 'high',
    ...patch,
  }
}

describe('EO/IR optics', () => {
  it('uses pitch over focal length first, then horizontal FOV over pixels', () => {
    const both = sensor({ fovDeg: 10, detectorPixelsH: 100 })
    expect(eoIfovRadFor(both)).toBeCloseTo(4e-5, 12)

    const fov = sensor({
      pixelPitchUm: null,
      focalLengthMm: null,
      fovDeg: 5,
      detectorPixelsH: 1000,
    })
    expect(eoIfovRadFor(fov)).toBeCloseTo((5 * Math.PI) / 180 / 1000, 12)

    expect(eoIfovRadFor(sensor({ focalLengthMm: null }))).toBeNull()
    expect(eoIfovRadFor(sensor({ pixelPitchUm: 0, fovDeg: 0, detectorPixelsH: 1000 }))).toBeNull()
  })

  it('puts two pixels in each Johnson cycle and returns the 1:4:8 DRI ranges', () => {
    const spec = sensor()
    const clear = env({ apply: false })
    const dri = eoIrDriRangesM(spec, target(), clear)!
    expect(dri).toEqual({ detectM: 10000, recognizeM: 2500, identifyM: 1250 })

    const ifov = eoIfovRadFor(spec)!
    expect(eoPixelsOnTarget(0.8, dri.detectM, ifov)).toBe(2 * JOHNSON_CYCLES.detect)
    expect(eoPixelsOnTarget(0.8, dri.recognizeM, ifov)).toBe(2 * JOHNSON_CYCLES.recognize)
    expect(eoPixelsOnTarget(0.8, dri.identifyM, ifov)).toBe(2 * JOHNSON_CYCLES.identify)
  })

  it('derives extinction from visibility and selects the dual sensor band by light', () => {
    const visible = sensor({ eoBand: 'visible' })
    const thermal = sensor({ eoBand: 'thermal' })
    const day = env({ visibilityM: 1000, light: 'day' })
    const night = env({ visibilityM: 1000, light: 'night' })
    const visibleSigma = -Math.log(KOSCHMIEDER_CONTRAST) / 1000
    const ituQAtFog = 0.585 * Math.cbrt(0.6)
    const ituMwirRatio = Math.pow(4000 / 550, -ituQAtFog)

    expect(ituMwirRatio).toBeCloseTo(0.37569, 5)
    expect(THERMAL_EXTINCTION_RATIO).toBeCloseTo(ituMwirRatio, 2)
    expect(eoExtinctionPerM(visible, day)).toBeCloseTo(visibleSigma, 12)
    expect(eoExtinctionPerM(thermal, day)).toBeCloseTo(visibleSigma * THERMAL_EXTINCTION_RATIO, 12)
    expect(eoTransmissionAt(visible, day, 1000)).toBeCloseTo(KOSCHMIEDER_CONTRAST, 12)
    expect(eoBandFor(sensor({ eoBand: 'dual' }), day)).toBe('visible')
    expect(eoBandFor(sensor({ eoBand: 'dual' }), night)).toBe('thermal')
    expect(eoExtinctionPerM(visible, env({ apply: false, visibilityM: 1000 }))).toBe(0)
  })

  it('solves the Beer-Lambert contrast threshold continuously instead of hard-capping at visibility', () => {
    const spec = sensor({ eoBand: 'thermal' })
    const weather = env({ visibilityM: 1000 })
    const dri = eoIrDriRangesM(spec, target(), weather)!
    const ifov = eoIfovRadFor(spec)!
    const availableCycles =
      (eoPixelsOnTarget(0.8, dri.detectM, ifov) * eoTransmissionAt(spec, weather, dri.detectM)) / 2

    expect(availableCycles).toBeCloseTo(JOHNSON_CYCLES.detect, 10)
    expect(dri.detectM).toBeGreaterThan(1000)
    expect(dri.detectM).toBeLessThan(10000)
  })
})

describe('EO/IR fallback adapter', () => {
  it('returns the supplied legacy value exactly for the switch or incomplete optics', () => {
    const fallback = 1234.567890123
    const weather = env()
    const t = target()
    expect(
      eoIrRangeM(sensor(), t, weather, {
        task: 'detect',
        fallbackRangeM: fallback,
        useFallback: true,
      }),
    ).toBe(fallback)
    expect(
      eoIrRangeM(sensor({ pixelPitchUm: null, focalLengthMm: null }), t, weather, {
        task: 'detect',
        fallbackRangeM: fallback,
      }),
    ).toBe(fallback)
  })

  it('models complete optics even when the placard basis is planning', () => {
    const spec = sensor({ rangeBasis: 'planning' })
    const result = eoIrRangeM(spec, target(), env({ apply: false }), {
      task: 'identify',
      fallbackRangeM: 99,
    })
    expect(result).toBe(1250)
  })

  it('uses the selected modeled task and ignores the fallback value', () => {
    const spec = sensor()
    const clear = env({ apply: false })
    const t = target()
    expect(eoIrRangeM(spec, t, clear, { task: 'detect', fallbackRangeM: -1 })).toBe(10000)
    expect(eoIrRangeM(spec, t, clear, { task: 'recognize', fallbackRangeM: -1 })).toBe(2500)
    expect(eoIrRangeM(spec, t, clear, { task: 'identify', fallbackRangeM: -1 })).toBe(1250)
  })
})

import { describe, expect, it } from 'vitest'
import type { EnvironmentSpec, SensorSpec } from '../model/types'
import { defaultEnvironment } from '../model/seed'
import {
  effectiveDetectRangeM,
  jammable,
  radarTargetFactor,
  rfDetectable,
  SENSOR_ENV_MODEL,
  sensorEnvFactor,
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

  it('night degrades only EO/IR', () => {
    const e = env({ light: 'night' })
    expect(sensorEnvFactor('eo-ir', e)).toBeLessThan(1)
    expect(sensorEnvFactor('radar', e)).toBe(1)
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
    const e = env({ precipitation: 'rain', light: 'night' })
    expect(sensorEnvFactor('eo-ir', e)).toBeCloseTo(
      SENSOR_ENV_MODEL.rain['eo-ir'] * SENSOR_ENV_MODEL.night['eo-ir'],
    )
  })
})

describe('effectiveDetectRangeM', () => {
  it('scales radar range with target group', () => {
    expect(effectiveDetectRangeM(RADAR, env({}), 1)).toBe(10000)
    expect(effectiveDetectRangeM(RADAR, env({}), 3)).toBe(10000 * radarTargetFactor(3))
  })

  it('does not scale EO/IR with target group', () => {
    expect(effectiveDetectRangeM(EO, env({}), 5)).toBe(3000)
  })

  it('ignores target group when apply is off', () => {
    expect(effectiveDetectRangeM(RADAR, env({ apply: false }), 5)).toBe(10000)
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

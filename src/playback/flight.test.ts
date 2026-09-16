import { describe, expect, it } from 'vitest'
import jiatfFixture from './__fixtures__/detection-outside-rings.json'
import layeredFixture from './__fixtures__/layered-acoustic-merops.json'
import { parseAutosave } from '../io/persist'
import { pathLength, posAtTime } from '../geometry/geo'
import { modelFor, pathSpeed } from '../model/scenario'
import type { UasSpec, Vec2 } from '../model/types'
import { effectivePathDelayS } from './raid'
import { limitedFlightDurationS, limitedPosAtTime, turnRadiusM } from './flight'

function uas(patch: Partial<UasSpec> = {}): UasSpec {
  return {
    group: 1,
    airframe: 'quad',
    cruiseSpeedMps: 10,
    maxSpeedMps: 20,
    enduranceMin: 30,
    altBandFt: [0, 400],
    navMode: 'gps',
    emissionsNote: '',
    ...patch,
  }
}

function assertNullLimitParity(fixture: unknown): void {
  const scenario = parseAutosave(JSON.stringify(fixture))
  for (const path of scenario.paths) {
    const entity = scenario.entities.find((e) => e.id === path.entityId)
    const spec = entity ? modelFor(scenario, entity)?.uas : undefined
    if (!spec) continue
    const noLimits = {
      ...spec,
      maxTurnRateDegS: null,
      climbRateMps: null,
      maxAccelMps2: null,
    }
    const speed = pathSpeed(scenario, path)
    const delayS = effectivePathDelayS(scenario, path)
    const endS = Math.ceil(delayS + pathLength(path.points) / speed) + 1
    for (let tS = 0; tS <= endS; tS += 0.5) {
      expect(
        limitedPosAtTime(path.points, speed, delayS, tS, noLimits, scenario.environment),
      ).toEqual(posAtTime(path.points, speed, delayS, tS))
    }
  }
}

describe('limitedPosAtTime', () => {
  it('matches both golden fixtures bit for bit when every flight limit is null', () => {
    assertNullLimitParity(jiatfFixture)
    assertNullLimitParity(layeredFixture)
  })

  it('flies a hand-derived 90 degree fillet at the bounded turn rate', () => {
    const points: Vec2[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    const speedMps = 10
    const turnRateDegS = 90
    // R = V / omega = 10 / (pi/2) = 20/pi = 6.3661977 m.
    // For a 90 deg corner the tangent distance is R tan(45 deg) = R.
    // Entry is (100-R, 0), arc length is R*pi/2 = 10 m, and exit is
    // (100, R). The exit time is ((100-R) + 10) / 10 = 10.3633802 s.
    const radiusM = 20 / Math.PI
    const entryS = (100 - radiusM) / speedMps
    const exitS = entryS + 1
    expect(turnRadiusM(speedMps, turnRateDegS)).toBeCloseTo(radiusM, 12)

    const entry = limitedPosAtTime(
      points,
      speedMps,
      0,
      entryS,
      uas({ maxTurnRateDegS: turnRateDegS }),
    )
    expect(entry.pos.x).toBeCloseTo(100 - radiusM, 9)
    expect(entry.pos.y).toBeCloseTo(0, 9)
    expect(entry.headingDeg).toBeCloseTo(90, 9)

    const middle = limitedPosAtTime(
      points,
      speedMps,
      0,
      entryS + 0.5,
      uas({ maxTurnRateDegS: turnRateDegS }),
    )
    // Arc center (100-R, R), radial heading 0 -> 45 deg at half arc.
    expect(middle.pos.x).toBeCloseTo(100 - radiusM + radiusM / Math.sqrt(2), 9)
    expect(middle.pos.y).toBeCloseTo(radiusM - radiusM / Math.sqrt(2), 9)
    expect(middle.headingDeg).toBeCloseTo(135, 9)

    const exit = limitedPosAtTime(
      points,
      speedMps,
      0,
      exitS,
      uas({ maxTurnRateDegS: turnRateDegS }),
    )
    expect(exit.pos.x).toBeCloseTo(100, 9)
    expect(exit.pos.y).toBeCloseTo(radiusM, 9)
    expect(exit.headingDeg).toBeCloseTo(180, 9)
  })

  it('accelerates from rest to the path speed at the stated limit', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    const spec = uas({ maxAccelMps2: 2 })
    // V = 10 m/s and a = 2 m/s2: acceleration lasts 5 s and covers 25 m.
    // At t=2, s=0.5*a*t2=4 m. At t=7, s=25+10*(7-5)=45 m.
    expect(limitedPosAtTime(points, 10, 0, 2, spec).pos.x).toBeCloseTo(4, 12)
    expect(limitedPosAtTime(points, 10, 0, 7, spec).pos.x).toBeCloseTo(45, 12)
    expect(limitedFlightDurationS(points, 10, spec)).toBeCloseTo(12.5, 12)
  })

  it('adds the meteorological wind vector to the ground track while airborne', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ]
    const spec = uas({ climbRateMps: 5 })
    const calm = limitedPosAtTime(points, 10, 0, 4, spec)
    const windy = limitedPosAtTime(points, 10, 0, 4, spec, {
      windSpeedMps: 5,
      windFromDeg: 270,
      temperatureC: 15,
      fieldElevationFt: 0,
      apply: true,
    })
    // Wind from west (270 deg) blows east at 5 m/s: offset after 4 s is (+20, 0).
    expect(windy.pos.x - calm.pos.x).toBeCloseTo(20, 12)
    expect(windy.pos.y - calm.pos.y).toBeCloseTo(0, 12)
    expect(windy.headingDeg).toBe(calm.headingDeg)
  })

  it('does not invent vertical motion from a scalar altitude and climb limit', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    const sample = limitedPosAtTime(points, 10, 0, 4, uas({ climbRateMps: 5 }))
    expect(sample).toEqual(posAtTime(points, 10, 0, 4))
  })
})

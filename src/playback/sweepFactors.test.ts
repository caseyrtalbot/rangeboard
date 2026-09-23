import { describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import { bearingDeg, dist } from '../geometry/geo'
import { VISIBILITY_BY_PRECIP } from '../analysis/sensorEnv'
import {
  applySweepValue,
  approachAzimuthDeg,
  approachCenter,
  SWEEP_ENVIRONMENT_PRESETS,
} from './sweepFactors'
import type { McSweepRequest } from './mcRun'
import { runSweep } from './mcRun'

/** The JIATF-401 firing laydown: one Mavic 3 at 300 ft, 18 km north of the asset at the origin. */
function laydown() {
  return parseAutosave(JSON.stringify(fixture))
}
const uasIds = (s: ReturnType<typeof laydown>) =>
  s.entities.filter((e) => e.kind === 'uas').map((e) => e.id)

describe('applySweepValue', () => {
  it('returns a new scenario and leaves the input untouched', () => {
    const s = laydown()
    const before = JSON.stringify(s)
    for (const [factor, value] of [
      ['threatAltitudeFt', 1000],
      ['threatSpeedMps', 25],
      ['approachAzimuthDeg', 90],
      ['raidSize', 3],
      ['environmentPreset', 'rain-day'],
    ] as const) {
      expect(applySweepValue(s, factor, value)).not.toBe(s)
    }
    expect(JSON.stringify(s)).toBe(before)
  })

  it('threatAltitudeFt sets every UAS with a path and nothing else', () => {
    const s = laydown()
    const next = applySweepValue(s, 'threatAltitudeFt', 1000)
    for (const e of next.entities) {
      if (e.kind === 'uas') expect(e.altitudeFt).toBe(1000)
      else expect(e).toEqual(s.entities.find((x) => x.id === e.id))
    }
    expect(() => applySweepValue(s, 'threatAltitudeFt', 'high')).toThrow(/finite number/)
  })

  it('threatSpeedMps overrides the speed of every UAS path', () => {
    const s = laydown()
    expect(s.paths[0].speedMps).toBeNull()
    const next = applySweepValue(s, 'threatSpeedMps', 25)
    expect(next.paths.map((p) => p.speedMps)).toEqual([25])
    expect(next.paths[0].points).toEqual(s.paths[0].points)
  })

  it('approachAzimuthDeg rotates the raid about the defended asset to the given bearing', () => {
    const s = laydown()
    const asset = s.entities.find((e) => e.kind === 'asset')!
    expect(approachCenter(s)).toEqual(asset.pos)
    expect(approachAzimuthDeg(s)).toBe(0)
    const next = applySweepValue(s, 'approachAzimuthDeg', 90)
    expect(approachAzimuthDeg(next)).toBeCloseTo(90, 9)
    const path = next.paths[0]
    const old = s.paths[0]
    for (let i = 0; i < old.points.length; i += 1) {
      const r = dist(asset.pos, old.points[i])
      expect(dist(asset.pos, path.points[i])).toBeCloseTo(r, 6)
      // A point on the center has no bearing and stays put.
      if (r > 0)
        expect(bearingDeg(asset.pos, path.points[i])).toBeCloseTo(
          (bearingDeg(asset.pos, old.points[i]) + 90) % 360,
          9,
        )
    }
    const uas = next.entities.find((e) => e.kind === 'uas')!
    expect(uas.pos.x).toBeCloseTo(18000, 6)
    expect(uas.pos.y).toBeCloseTo(0, 6)
    // Nothing but the threats moves; the same azimuth is a no-op.
    expect(next.entities.filter((e) => e.kind !== 'uas')).toEqual(
      s.entities.filter((e) => e.kind !== 'uas'),
    )
    expect(applySweepValue(s, 'approachAzimuthDeg', 0)).toBe(s)
  })

  it('approachAzimuthDeg falls back to the laydown centroid without an asset', () => {
    const s = laydown()
    s.entities = s.entities.filter((e) => e.kind !== 'asset')
    const ground = s.entities.filter((e) => e.kind !== 'uas')
    const centroid = {
      x: ground.reduce((a, e) => a + e.pos.x, 0) / ground.length,
      y: ground.reduce((a, e) => a + e.pos.y, 0) / ground.length,
    }
    expect(approachCenter(s)).toEqual(centroid)
    const next = applySweepValue(s, 'approachAzimuthDeg', 180)
    expect(approachAzimuthDeg(next)).toBeCloseTo(180, 9)
    expect(dist(centroid, next.paths[0].points[0])).toBeCloseTo(
      dist(centroid, s.paths[0].points[0]),
      6,
    )
  })

  it('raidSize truncates the first wave or repeats its members with fresh ids', () => {
    const s = laydown()
    expect(uasIds(s)).toHaveLength(1)
    const three = applySweepValue(s, 'raidSize', 3)
    const ids = uasIds(three)
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe(uasIds(s)[0])
    expect(three.paths).toHaveLength(3)
    for (const id of ids) {
      const e = three.entities.find((x) => x.id === id)!
      const p = three.paths.find((x) => x.entityId === id)!
      expect(e.altitudeFt).toBe(300)
      expect(p.points).toEqual(s.paths[0].points)
    }
    expect(three.paths[0]).toEqual(s.paths[0])
    expect(new Set(three.paths.map((p) => p.id)).size).toBe(3)
    // An explicit first wave grows and shrinks with the members.
    const waved = { ...s, raid: { waves: [{ startDelayS: 0, entityIds: uasIds(s) }] } }
    expect(applySweepValue(waved, 'raidSize', 2).raid!.waves[0].entityIds).toHaveLength(2)
    const back = applySweepValue(applySweepValue(waved, 'raidSize', 3), 'raidSize', 1)
    expect(uasIds(back)).toEqual(uasIds(s))
    expect(back.paths).toEqual(s.paths)
    expect(back.raid!.waves[0].entityIds).toEqual(uasIds(s))
    expect(() => applySweepValue(s, 'raidSize', 0)).toThrow(/1 or more/)
    expect(() => applySweepValue(s, 'raidSize', 1.5)).toThrow(/1 or more/)
  })

  it('raidSize derives the added ids from the source and copy index, clear of taken ids', () => {
    const s = laydown()
    const [source] = uasIds(s)
    const path = s.paths.find((p) => p.entityId === source)!
    const three = applySweepValue(s, 'raidSize', 3)
    expect(uasIds(three)).toEqual([source, `${source}~r1`, `${source}~r2`])
    expect(three.paths.map((p) => p.id)).toEqual([path.id, `${path.id}~r1`, `${path.id}~r2`])
    // An id already in the scenario is never reused.
    const clash = { ...s, entities: [...s.entities, { ...s.entities[0], id: `${source}~r1` }] }
    const grown = uasIds(applySweepValue(clash, 'raidSize', 2))
    expect(grown).toContain(`${source}~r1~`)
    expect(new Set(grown).size).toBe(grown.length)
  })

  it('a raidSize sweep that adds ships gives the same summary at another wall clock', () => {
    const spec: Omit<McSweepRequest, 'type' | 'runId'> = {
      scenario: laydown(),
      factors: [{ id: 'raidSize', values: [1, 3] }],
      replicatesPerCell: 8,
      responses: ['leakers', 'kills'],
    }
    const clock = vi.spyOn(Date, 'now')
    try {
      clock.mockReturnValue(1_790_000_000_000)
      const first = JSON.stringify(runSweep(spec))
      clock.mockReturnValue(1_790_000_000_000 + 86_400_000 * 37 + 12_345)
      expect(JSON.stringify(runSweep(spec))).toBe(first)
    } finally {
      clock.mockRestore()
    }
  })

  it('environmentPreset sets the covariates and keeps the range numbers', () => {
    const s = laydown()
    for (const preset of SWEEP_ENVIRONMENT_PRESETS) {
      const next = applySweepValue(s, 'environmentPreset', preset.id)
      expect(next.environment).toEqual({
        ...s.environment,
        ...preset.set,
        visibilityM: null,
        apply: true,
      })
      expect(VISIBILITY_BY_PRECIP[next.environment.precipitation!]).toBeGreaterThan(0)
    }
    expect(() => applySweepValue(s, 'environmentPreset', 'monsoon')).toThrow(
      /Unknown environment preset/,
    )
  })
})

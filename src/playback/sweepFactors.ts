/**
 * Factor sweep inputs. `applySweepValue` sets one scenario factor to one
 * value and returns a new Scenario; the sweep loop (mcRun.ts) runs one
 * ensemble per grid cell over one or two of these factors. Every function
 * here is pure: the input scenario is never mutated. No draw happens here,
 * so the engine computes each cell exactly as it would the same scenario
 * edited by hand.
 */
import { bearingDeg, rotatePoint } from '../geometry/geo'
import type { Entity, EnvironmentSpec, FlightPath, Scenario, Vec2 } from '../model/types'
import { entityActive, newId } from '../model/types'

/** The factors a sweep can vary. */
export type SweepFactorId =
  'threatAltitudeFt' | 'threatSpeedMps' | 'approachAzimuthDeg' | 'raidSize' | 'environmentPreset'

/** One swept factor and its grid values (2 to 6; the UI caps the grid at 36 cells). */
export interface SweepFactor {
  id: SweepFactorId
  values: number[] | string[]
}

/** Fewest and most values one factor may take. */
export const SWEEP_VALUES_MIN = 2
export const SWEEP_VALUES_MAX = 6

/**
 * Environment presets a sweep can select. Each sets the categorical
 * covariates the sensor model reads (sensorEnv.ts) and leaves wind,
 * temperature and field elevation as the scenario has them: those are the
 * range's own numbers and no preset invents new ones. Visibility follows the
 * precipitation default (VISIBILITY_BY_PRECIP).
 */
export const SWEEP_ENVIRONMENT_PRESETS: ReadonlyArray<{
  id: string
  label: string
  set: Pick<EnvironmentSpec, 'precipitation' | 'light' | 'emBackground'>
}> = [
  {
    id: 'clear-day',
    label: 'Clear day',
    set: { precipitation: 'clear', light: 'day', emBackground: 'rural' },
  },
  {
    id: 'clear-night',
    label: 'Clear night',
    set: { precipitation: 'clear', light: 'night', emBackground: 'rural' },
  },
  {
    id: 'rain-day',
    label: 'Rain, day',
    set: { precipitation: 'rain', light: 'day', emBackground: 'rural' },
  },
  {
    id: 'fog-day',
    label: 'Fog, day',
    set: { precipitation: 'fog', light: 'day', emBackground: 'rural' },
  },
  {
    id: 'urban-day',
    label: 'Urban clutter, day',
    set: { precipitation: 'clear', light: 'day', emBackground: 'urban' },
  },
  {
    id: 'urban-night',
    label: 'Urban clutter, night',
    set: { precipitation: 'clear', light: 'night', emBackground: 'urban' },
  },
]

/** Active UAS entities that fly a path, in entity order: the threats a replicate runs. */
function threatsWithPath(s: Scenario): Entity[] {
  return s.entities.filter(
    (e) => e.kind === 'uas' && entityActive(e) && s.paths.some((p) => p.entityId === e.id),
  )
}

function number(value: number | string, factor: SweepFactorId): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${factor} takes a finite number, not ${JSON.stringify(value)}`)
  }
  return value
}

/** Altitude, feet AGL, on every active UAS that flies a path. */
function withAltitude(s: Scenario, altitudeFt: number): Scenario {
  const ids = new Set(threatsWithPath(s).map((e) => e.id))
  return {
    ...s,
    entities: s.entities.map((e) => (ids.has(e.id) ? { ...e, altitudeFt } : e)),
  }
}

/** Speed override, m/s, on every path of an active UAS. */
function withSpeed(s: Scenario, speedMps: number): Scenario {
  const ids = new Set(threatsWithPath(s).map((e) => e.id))
  return {
    ...s,
    paths: s.paths.map((p) => (ids.has(p.entityId) ? { ...p, speedMps } : p)),
  }
}

/**
 * The point the raid approaches: the first active defended asset, else the
 * centroid of the active non-threat entities, else the world origin.
 */
export function approachCenter(s: Scenario): Vec2 {
  const asset = s.entities.find((e) => e.kind === 'asset' && entityActive(e))
  if (asset) return { ...asset.pos }
  const laydown = s.entities.filter(
    (e) => e.kind !== 'uas' && e.kind !== 'marker' && entityActive(e),
  )
  if (laydown.length === 0) return { x: 0, y: 0 }
  const sum = laydown.reduce((acc, e) => ({ x: acc.x + e.pos.x, y: acc.y + e.pos.y }), {
    x: 0,
    y: 0,
  })
  return { x: sum.x / laydown.length, y: sum.y / laydown.length }
}

/**
 * The approach azimuth of the raid, degrees true: the bearing from the
 * approach center to the first point of the first threat's path. Null with
 * no threat path, or a path that starts on the center.
 */
export function approachAzimuthDeg(s: Scenario): number | null {
  const lead = threatsWithPath(s)[0]
  const path = lead && s.paths.find((p) => p.entityId === lead.id)
  const start = path?.points[0]
  if (!start) return null
  const center = approachCenter(s)
  if (start.x === center.x && start.y === center.y) return null
  return bearingDeg(center, start)
}

/**
 * Rotate every threat path, and its entity, about the approach center so the
 * raid's approach azimuth becomes `azimuthDeg`. One rotation for the whole
 * raid keeps its relative geometry. A scenario with no azimuth is returned as is.
 */
function withAzimuth(s: Scenario, azimuthDeg: number): Scenario {
  const current = approachAzimuthDeg(s)
  if (current == null) return s
  const delta = azimuthDeg - current
  if (delta === 0) return s
  const center = approachCenter(s)
  const ids = new Set(threatsWithPath(s).map((e) => e.id))
  return {
    ...s,
    entities: s.entities.map((e) =>
      ids.has(e.id)
        ? {
            ...e,
            pos: rotatePoint(e.pos, center, delta),
            headingDeg: (((e.headingDeg + delta) % 360) + 360) % 360,
          }
        : e,
    ),
    paths: s.paths.map((p) =>
      ids.has(p.entityId)
        ? { ...p, points: p.points.map((q) => rotatePoint(q, center, delta)) }
        : p,
    ),
  }
}

/**
 * Set the first wave to `size` members. The first wave is `raid.waves[0]`,
 * else every threat with a path (the implicit single wave). Fewer members
 * drops the last ones with their paths; more repeats the members in order
 * with fresh ids from the one id allocator, so their draw keys are their own.
 * Repeated members keep the original geometry and formation.
 */
function withRaidSize(s: Scenario, size: number): Scenario {
  if (!Number.isInteger(size) || size < 1)
    throw new Error(`raidSize takes a whole number of 1 or more, not ${size}`)
  const threats = threatsWithPath(s)
  const threatIds = new Set(threats.map((e) => e.id))
  const wave = s.raid?.waves[0]
  const members = wave ? wave.entityIds.filter((id) => threatIds.has(id)) : threats.map((e) => e.id)
  if (members.length === 0) return s
  if (size <= members.length) {
    const drop = new Set(members.slice(size))
    return {
      ...s,
      entities: s.entities.filter((e) => !drop.has(e.id)),
      paths: s.paths.filter((p) => !drop.has(p.entityId)),
      raid: s.raid && {
        waves: s.raid.waves.map((w) => ({
          ...w,
          entityIds: w.entityIds.filter((id) => !drop.has(id)),
        })),
      },
    }
  }
  const entities = [...s.entities]
  const paths = [...s.paths]
  const added: string[] = []
  for (let i = members.length; i < size; i += 1) {
    const sourceId = members[i % members.length]
    const source = s.entities.find((e) => e.id === sourceId)!
    const id = newId('ent')
    entities.push({ ...source, id, name: `${source.name} ${Math.floor(i / members.length) + 1}` })
    for (const p of s.paths) {
      if (p.entityId !== sourceId) continue
      paths.push({
        ...p,
        id: newId('pth'),
        entityId: id,
        points: p.points.map((q) => ({ ...q })),
      } satisfies FlightPath)
    }
    added.push(id)
  }
  return {
    ...s,
    entities,
    paths,
    raid: s.raid && {
      waves: s.raid.waves.map((w, i) =>
        i === 0 ? { ...w, entityIds: [...w.entityIds, ...added] } : w,
      ),
    },
  }
}

/** The environment with a preset's covariates applied; an unknown id throws. */
function withEnvironmentPreset(s: Scenario, id: number | string): Scenario {
  const preset = SWEEP_ENVIRONMENT_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Unknown environment preset ${JSON.stringify(id)}`)
  return { ...s, environment: { ...s.environment, ...preset.set, visibilityM: null, apply: true } }
}

/** A new Scenario with `factor` at `value`; the input is untouched. */
export function applySweepValue(
  scenario: Scenario,
  factor: SweepFactorId,
  value: number | string,
): Scenario {
  switch (factor) {
    case 'threatAltitudeFt':
      return withAltitude(scenario, number(value, factor))
    case 'threatSpeedMps':
      return withSpeed(scenario, number(value, factor))
    case 'approachAzimuthDeg':
      return withAzimuth(scenario, number(value, factor))
    case 'raidSize':
      return withRaidSize(scenario, number(value, factor))
    case 'environmentPreset':
      return withEnvironmentPreset(scenario, value)
  }
}

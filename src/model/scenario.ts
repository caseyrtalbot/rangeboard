import type { Entity, FlightPath, Scenario, SpecModel } from './types'
import { pathLength } from '../geometry/geo'
import { effectivePathDelayS } from '../playback/raid'

/**
 * Id index per library array. The store never mutates a library in place, so
 * the array identity is a safe key and the entry dies with the array.
 */
const LIBRARY_INDEX = new WeakMap<SpecModel[], Map<string, SpecModel>>()

function libraryIndex(library: SpecModel[]): Map<string, SpecModel> {
  let index = LIBRARY_INDEX.get(library)
  if (!index) {
    index = new Map()
    // First id wins, which is what `find` returned for a duplicated id.
    for (const m of library) if (!index.has(m.id)) index.set(m.id, m)
    LIBRARY_INDEX.set(library, index)
  }
  return index
}

/** Model referenced by an entity, if any. */
export function modelFor(scenario: Scenario, entity: Entity): SpecModel | undefined {
  if (entity.specId == null) return undefined
  return libraryIndex(scenario.library).get(entity.specId) ?? undefined
}

/** Effective speed for a flight path: override, spec cruise, or 15 m/s fallback. */
export function pathSpeed(scenario: Scenario, path: FlightPath): number {
  if (path.speedMps && path.speedMps > 0) return path.speedMps
  const entity = scenario.entities.find((e) => e.id === path.entityId)
  const model = entity ? modelFor(scenario, entity) : undefined
  return model?.uas?.cruiseSpeedMps ?? 15
}

/** Scenario duration: longest path flight time plus path and wave delays, minimum 60 s. */
export function scenarioDurationS(scenario: Scenario): number {
  let max = 60
  for (const p of scenario.paths) {
    const t = effectivePathDelayS(scenario, p) + pathLength(p.points) / pathSpeed(scenario, p)
    if (t > max) max = t
  }
  return Math.ceil(max)
}

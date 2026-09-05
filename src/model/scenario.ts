import type { Entity, FlightPath, Scenario, SpecModel } from './types'
import { pathLength } from '../geometry/geo'
import { effectivePathDelayS } from '../playback/raid'

/** Model referenced by an entity, if any. */
export function modelFor(scenario: Scenario, entity: Entity): SpecModel | undefined {
  return scenario.library.find((m) => m.id === entity.specId) ?? undefined
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

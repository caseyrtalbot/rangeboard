import type { Scenario, SpecModel } from '../model/types'
import { scenarioDurationS, pathSpeed } from '../model/scenario'
import { DT } from '../playback/clock'
import { pathLength } from '../geometry/geo'
import { idsOf, MAX_ARRAY_LENGTH, invalid, objectAt, reference, validateShape } from './runtimeValidation'

export function validateScenarioShape(value: unknown): asserts value is Scenario {
  validateShape(value, 'Scenario', 'scenario', true)
}

/** Run after seed/default filling, so references to newly adopted seeds resolve. */
export function validateScenarioReferences(s: Scenario): void {
  const models = idsOf(s.library, 'scenario.library')
  const entities = idsOf(s.entities, 'scenario.entities')
  for (const key of ['systemPresets', 'connections', 'boundaries', 'paths', 'testCards', 'frames', 'scorecards'] as const) {
    idsOf(s[key] ?? [], `scenario.${key}`)
  }
  s.entities.forEach((e, i) => {
    reference(e.specId, models, `scenario.entities[${i}].specId`)
    const model = s.library.find(m => m.id === e.specId)
    if (model && model.kind !== e.kind) invalid(`scenario.entities[${i}].specId`, 'model kind differs from entity kind')
  })
  s.connections.forEach((c, i) => {
    reference(c.fromId, entities, `scenario.connections[${i}].fromId`)
    reference(c.toId, entities, `scenario.connections[${i}].toId`)
  })
  const routed = new Set<string>()
  s.paths.forEach((p, i) => {
    reference(p.entityId, entities, `scenario.paths[${i}].entityId`)
    if (routed.has(p.entityId)) invalid(`scenario.paths[${i}].entityId`, 'entity has more than one flight path')
    routed.add(p.entityId)
    const duration = pathLength(p.points) / pathSpeed(s, p)
    if (!Number.isFinite(duration)) invalid(`scenario.paths[${i}]`, 'resolved path duration is not finite; check coordinates and speed')
  })
  const duration = scenarioDurationS(s)
  if (!Number.isFinite(duration) || Math.ceil(duration / DT) + 1 > MAX_ARRAY_LENGTH) invalid('scenario.paths', 'resolved duration exceeds the engine sample-array limit')
  s.testCards.forEach((c, i) => {
    c.linkedEntityIds.forEach((id, j) => reference(id, entities, `scenario.testCards[${i}].linkedEntityIds[${j}]`))
    idsOf(c.runs, `scenario.testCards[${i}].runs`)
  })
  s.raid?.waves.forEach((w, i) => w.entityIds.forEach((id, j) => reference(id, entities, `scenario.raid.waves[${i}].entityIds[${j}]`)))
  s.systemPresets.forEach((p, i) => {
    // Deleting a library model deliberately leaves preset components in place;
    // dropSystem skips unavailable models. Preserve this saved-data contract.
    p.links.forEach((pair, j) => pair.forEach((index, k) => {
      if (!Number.isSafeInteger(index) || index < 0 || index >= p.components.length) invalid(`scenario.systemPresets[${i}].links[${j}][${k}]`, 'component index is out of bounds')
    }))
  })
}

/** Pure boundary shared by the file picker and regression tests. */
export function parseLibraryData(value: unknown): SpecModel[] {
  const root = objectAt(value, 'library')
  if (root.rangeboardLibrary !== 1) invalid('library.rangeboardLibrary', 'expected 1')
  if (!Array.isArray(root.models)) invalid('library.models', 'expected an array')
  root.models.forEach((model, i) => validateShape(model, 'SpecModel', `library.models[${i}]`))
  const models = root.models as SpecModel[]
  idsOf(models, 'library.models')
  return models
}

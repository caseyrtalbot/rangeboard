import type { SpecModel, SystemPreset } from './types'
import { dropEditedProvenance } from './types'
import { SEED_LIBRARY } from './seedLibrary'
import { SEED_SYSTEMS } from './seedSystems'

/**
 * The one owner of the seed library lifecycle: what a new scenario starts with,
 * how a save reconciles against the current seeds, how an import merges and how
 * a builtin goes back to its seed. Store-free and pure, so `fillScenario`
 * (`src/io/persist.ts`) and the store library actions share one policy.
 *
 * Saved-id precedence is the rule every path here follows: an entry the user
 * already holds wins over the seed of the same id, so edits and custom models
 * survive; a seed id the user deleted stays out.
 */

/** The library a new scenario starts with: a private copy of every seed model. */
export function initialLibrary(): SpecModel[] {
  return SEED_LIBRARY.map((m) => ({ ...m }))
}

/** The system presets a new scenario starts with. */
export function initialSystemPresets(): SystemPreset[] {
  return SEED_SYSTEMS.map((p) => ({ ...p }))
}

/**
 * Saved-id precedence for a seeded list. A saved entry wins on collision, so a
 * user's edits to a seed entry and their custom entries both survive. A seed
 * the save has never seen is appended, unless its id is in `deleted`: the user
 * removed it and a reload must not bring it back. A save with no list at all
 * takes the whole seed set.
 */
export function reconcileSeeded<T extends { id: string }>(
  saved: T[] | undefined,
  seeds: readonly T[],
  deleted: readonly string[] = [],
): T[] {
  if (!Array.isArray(saved)) return [...seeds]
  const have = new Set(saved.map((x) => x.id))
  const gone = new Set(deleted)
  return [...saved, ...seeds.filter((x) => !have.has(x.id) && !gone.has(x.id))]
}

/**
 * Library reconcile: saved-id precedence, then provenance retention. A seed row
 * added after a save was written never reaches that save through the merge,
 * which keeps the saved copy whole, so the saved builtins adopt those rows here.
 */
export function reconcileLibrary(
  saved: SpecModel[] | undefined,
  seeds: readonly SpecModel[],
  deleted: readonly string[] = [],
): SpecModel[] {
  const seedById = new Map(seeds.map((m) => [m.id, m]))
  return reconcileSeeded(saved, seeds, deleted).map((m) => {
    const seed = m.builtin ? seedById.get(m.id) : undefined
    return seed ? adoptSeedProvenance(m, seed) : m
  })
}

/**
 * Give a saved builtin model the seed's provenance rows for every field the user
 * has not edited. A saved row is kept as it is. A field whose saved value differs
 * from the seed value gets no row (it stays a planning factor). A custom model is
 * returned unchanged. `dropEditedProvenance` is the one field comparison: read
 * against the save, it keeps exactly the seed rows the save has not edited away.
 */
export function adoptSeedProvenance(saved: SpecModel, seed: SpecModel): SpecModel {
  if (!saved.builtin) return saved
  const rows = seed.provenance
  if (!rows || rows.length === 0) return saved
  const have = new Set((saved.provenance ?? []).map((r) => r.field))
  const unedited = dropEditedProvenance(saved, seed).provenance ?? []
  const add = unedited.filter((r) => !have.has(r.field))
  if (add.length === 0) return saved
  return { ...saved, provenance: [...(saved.provenance ?? []), ...add] }
}

/**
 * Library import merge. An id the library already holds keeps the existing
 * model, so an import never overwrites the user's copy; every other incoming
 * model is appended. Same precedence as the load reconcile.
 */
export function importModels(
  existing: readonly SpecModel[],
  incoming: readonly SpecModel[],
): SpecModel[] {
  const have = new Set(existing.map((m) => m.id))
  return [...existing, ...incoming.filter((m) => !have.has(m.id))]
}

/**
 * Put one builtin model back to its seed definition, deep-copied so the library
 * never shares the seed object. A custom model, an unknown id and a model that
 * already equals its seed return the same array, so the caller records no edit.
 */
export function resetBuiltin(
  models: SpecModel[],
  id: string,
  seeds: readonly SpecModel[] = SEED_LIBRARY,
): SpecModel[] {
  const model = models.find((m) => m.id === id)
  const seed = seeds.find((m) => m.id === id)
  if (!model || !seed || !model.builtin) return models
  if (JSON.stringify(model) === JSON.stringify(seed)) return models
  const copy: SpecModel = JSON.parse(JSON.stringify(seed))
  return models.map((m) => (m.id === id ? copy : m))
}

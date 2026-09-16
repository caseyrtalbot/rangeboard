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

/** Spec block of a model, as `ADOPTED_SEED_KEYS` names them. */
export type SeedBlock = 'sensor' | 'uas' | 'effector' | 'c2'

/** One builtin model's adoption: the block it filled and the keys it took. */
export interface SeedAdoption {
  modelId: string
  block: SeedBlock
  keys: string[]
}

/** A reconcile and what it adopted, so a loader can stamp the fill. */
export interface LibraryReconcile {
  library: SpecModel[]
  /** One entry per (model, block) that took at least one key; empty when nothing was filled. */
  adopted: SeedAdoption[]
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
  return reconcileLibraryReport(saved, seeds, deleted).library
}

/**
 * The reconcile with its adoption report: which builtin models took which
 * `ADOPTED_SEED_KEYS`, so a load can say what it filled. The library it returns
 * is the one `reconcileLibrary` gives for the same arguments.
 */
export function reconcileLibraryReport(
  saved: SpecModel[] | undefined,
  seeds: readonly SpecModel[],
  deleted: readonly string[] = [],
): LibraryReconcile {
  const seedById = new Map(seeds.map((m) => [m.id, m]))
  const adopted: SeedAdoption[] = []
  const library = reconcileSeeded(saved, seeds, deleted).map((m) => {
    const seed = m.builtin ? seedById.get(m.id) : undefined
    if (!seed) return m
    const taken = adoptSeedFieldsReport(m, seed)
    for (const entry of taken.adopted) adopted.push({ modelId: m.id, ...entry })
    return adoptSeedProvenance(taken.model, seed)
  })
  return { library, adopted }
}

/**
 * Seed spec keys a saved builtin adopts when it does not hold them: the fields
 * the data package gained after saves were written. `'*'` adopts the whole
 * block when the save has none. Every other key follows saved-id precedence,
 * so an old save keeps its physics; this list is the one migration path a new
 * field takes into an existing board.
 */
export const ADOPTED_SEED_KEYS: Partial<Record<SeedBlock, readonly string[] | '*'>> = {
  // Phase 2 (2026-09-10): tracker accuracy and the radar false-alarm rate.
  sensor: [
    'rangeAccuracyM',
    'azimuthAccuracyDeg',
    'elevationAccuracyDeg',
    'falseAlarmRatePerScan',
    // Phase 3 (2026-09-10): radar dwell, EO/IR optics, RF sensitivity and acoustic threshold.
    'pulsesPerDwell',
    'dwellTimeS',
    'pixelPitchUm',
    'focalLengthMm',
    'detectorPixelsH',
    'fovDeg',
    'mrtdMk',
    'receiverSensitivityDbm',
    'geolocationMinNodes',
    'noiseFloorDb',
  ],
  // Phase 3: threat kinematic limits and link emission.
  uas: ['maxTurnRateDegS', 'climbRateMps', 'maxAccelMps2', 'radiatedPowerW', 'linkProtocol'],
  // Phase 3: interceptor, gun, directed-energy and HPM physics fields.
  effector: [
    'seekerAcquisitionRangeM',
    'lethalRadiusM',
    'guidanceNoiseM',
    'maxFlyoutSpeedMps',
    'boostTimeS',
    'dispersionMils',
    'fireControlErrorMils',
    'burstRounds',
    'rateOfFireRpm',
    'muzzleVelocityMps',
    'outputPowerKw',
    'beamQualityM2',
    'jitterUrad',
    'apertureM',
    'dwellToEffectS',
    'fieldStrengthVm',
    'fieldStrengthRangeM',
    'beamwidthDeg',
    'rechargeS',
  ],
  // Phase 2: the C2 decision fields; c2 models had no spec block before.
  c2: '*',
}

/**
 * Give a saved builtin model the `ADOPTED_SEED_KEYS` it does not hold. A key
 * the save holds, with any value including null, is the user's and stays. A
 * custom model is returned unchanged; so is a model with nothing to adopt.
 */
export function adoptSeedFields(saved: SpecModel, seed: SpecModel): SpecModel {
  return adoptSeedFieldsReport(saved, seed).model
}

/**
 * `adoptSeedFields` with the keys it took, per block, in spec order. The model
 * it returns is the one `adoptSeedFields` gives for the same arguments; a model
 * that adopted nothing reports an empty list and the same object.
 */
export function adoptSeedFieldsReport(
  saved: SpecModel,
  seed: SpecModel,
): { model: SpecModel; adopted: Array<{ block: SeedBlock; keys: string[] }> } {
  if (!saved.builtin) return { model: saved, adopted: [] }
  let out: SpecModel | null = null
  const adopted: Array<{ block: SeedBlock; keys: string[] }> = []
  for (const block of Object.keys(ADOPTED_SEED_KEYS) as SeedBlock[]) {
    const keys = ADOPTED_SEED_KEYS[block]
    const seedSpec = seed[block] as Record<string, unknown> | undefined
    if (!keys || !seedSpec) continue
    const savedSpec = saved[block] as Record<string, unknown> | undefined
    if (!savedSpec) {
      if (keys !== '*') continue
      out = { ...(out ?? saved), [block]: { ...seedSpec } }
      // A whole block taken: every key of the seed block was adopted.
      adopted.push({ block, keys: Object.keys(seedSpec) })
      continue
    }
    let next: Record<string, unknown> | null = null
    const took: string[] = []
    for (const key of keys === '*' ? Object.keys(seedSpec) : keys) {
      if (key in savedSpec || !(key in seedSpec)) continue
      next = next ?? { ...savedSpec }
      next[key] = seedSpec[key]
      took.push(key)
    }
    if (next) {
      out = { ...(out ?? saved), [block]: next }
      adopted.push({ block, keys: took })
    }
  }
  return { model: out ?? saved, adopted }
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

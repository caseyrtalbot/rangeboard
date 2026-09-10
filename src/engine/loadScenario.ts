/**
 * The scenario load boundary for the headless runner. `io/persist.ts` owns
 * the Board's `fillScenario`, but that module imports the zustand store, and
 * the store pulls react into any bundle that carries it. This loader repeats
 * the fill from the same pieces (`validateScenarioShape`, `fillContainers`,
 * `reconcileLibrary`, `reconcileSeeded`, `validateScenarioReferences`) so a
 * scenario JSON fills here as it fills in the browser. Keep the two in step:
 * a field added to `fillScenario` is added here.
 */
import type { FireDoctrine, Scenario } from '../model/types'
import { emptyScenario } from '../model/seed'
import { reconcileLibrary, reconcileSeeded } from '../model/libraryLifecycle'
import { SCENARIO_LEGACY_FIELDS, fillContainers } from '../io/compat'
import { validateScenarioReferences, validateScenarioShape } from '../io/validateScenario'

/** Validate the shape, fill fields a save may omit, then check the references. */
export function loadScenario(parsed: unknown): Scenario {
  validateScenarioShape(parsed)
  const empty = emptyScenario()
  const roe =
    parsed.roe ??
    (parsed.engageOn === 'detected' ? 'free' : parsed.engageOn === 'confirmed' ? 'tight' : empty.roe)
  const deletedSeedIds = Array.isArray(parsed.deletedSeedIds) ? parsed.deletedSeedIds : []
  const filled: Scenario = {
    ...empty,
    ...parsed,
    ...fillContainers(parsed, empty, SCENARIO_LEGACY_FIELDS),
    library: reconcileLibrary(parsed.library, empty.library, deletedSeedIds),
    systemPresets: reconcileSeeded(parsed.systemPresets, empty.systemPresets, deletedSeedIds),
    deletedSeedIds,
    doctrine: fillDoctrine(empty.doctrine as FireDoctrine, parsed.doctrine),
    roe,
    // Compatibility defaults, as the Board applies them: an old save stays deterministic and aleatory.
    runMode: parsed.runMode ?? 'deterministic',
    uncertainty: parsed.uncertainty ?? 'aleatory',
    targetHalfWidth: parsed.targetHalfWidth === undefined ? null : parsed.targetHalfWidth,
  }
  validateScenarioReferences(filled)
  return filled
}

/** Parse a scenario JSON text through the load boundary. */
export function parseScenarioJson(raw: string): Scenario {
  return loadScenario(JSON.parse(raw))
}

/** A record with no launchPolicy predates the doctrinal sequence and takes the default enabled flag. */
function fillDoctrine(empty: FireDoctrine, saved: Partial<FireDoctrine> | undefined): FireDoctrine {
  if (!saved) return { ...empty }
  const preLaunchPolicy = saved.launchPolicy == null
  return { ...empty, ...saved, enabled: preLaunchPolicy ? empty.enabled : (saved.enabled ?? empty.enabled) }
}

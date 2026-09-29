import type { FireDoctrine, Scenario } from '../model/types'
import { emptyScenario } from '../model/seed'
import type { SeedAdoption } from '../model/libraryLifecycle'
import { reconcileLibraryReport, reconcileSeeded } from '../model/libraryLifecycle'
import { SCENARIO_LEGACY_FIELDS, fillContainers } from './compat'
import { validateScenarioReferences, validateScenarioShape } from './validateScenario'

/** A filled scenario and the seed keys its library adopted on the way. */
export interface ScenarioFill {
  scenario: Scenario
  adopted: SeedAdoption[]
}

/**
 * The one scenario fill, store-free so the Board (`fillScenario`, `io/persist.ts`)
 * and the headless runner (`loadScenario`, `engine/loadScenario.ts`) share it:
 * validate the shape, then fill fields added after a save was written.
 * `SCENARIO_LEGACY_FIELDS` (`io/compat.ts`) names which fields a legacy save may
 * omit and what supplies each. Library and system presets are reconciled against
 * the seeds rather than taken whole, so a stale save never shadows seed content
 * added since.
 */
export function fillScenarioReport(parsed: unknown): ScenarioFill {
  validateScenarioShape(parsed)
  const empty = emptyScenario()
  const roe =
    parsed.roe ??
    (parsed.engageOn === 'detected'
      ? 'free'
      : parsed.engageOn === 'confirmed'
        ? 'tight'
        : empty.roe)
  const deletedSeedIds = Array.isArray(parsed.deletedSeedIds) ? parsed.deletedSeedIds : []
  const reconciled = reconcileLibraryReport(parsed.library, empty.library, deletedSeedIds)
  const scenario: Scenario = {
    ...empty,
    ...parsed,
    ...fillContainers(parsed, empty, SCENARIO_LEGACY_FIELDS),
    library: reconciled.library,
    systemPresets: reconcileSeeded(parsed.systemPresets, empty.systemPresets, deletedSeedIds),
    deletedSeedIds,
    // emptyScenario() always sets doctrine; the Scenario type keeps it optional for old saves.
    doctrine: fillDoctrine(empty.doctrine as FireDoctrine, parsed.doctrine),
    roe,
    // A save that predates a run field keeps the compatibility default.
    runMode: parsed.runMode ?? 'deterministic',
    uncertainty: parsed.uncertainty ?? 'aleatory',
    targetHalfWidth: parsed.targetHalfWidth === undefined ? null : parsed.targetHalfWidth,
  }
  validateScenarioReferences(scenario)
  return { scenario, adopted: reconciled.adopted }
}

/**
 * Doctrine fill with one migration: a record with no launchPolicy predates
 * the doctrinal sequence and takes the default enabled flag; a record with a
 * launchPolicy keeps its enabled flag as written.
 */
function fillDoctrine(empty: FireDoctrine, saved: Partial<FireDoctrine> | undefined): FireDoctrine {
  if (!saved) return { ...empty }
  const preLaunchPolicy = saved.launchPolicy == null
  return {
    ...empty,
    ...saved,
    enabled: preLaunchPolicy ? empty.enabled : (saved.enabled ?? empty.enabled),
  }
}

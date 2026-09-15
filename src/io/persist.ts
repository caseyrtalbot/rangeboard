import type {
  AarSummary,
  FireDoctrine,
  Scenario,
  SpecModel,
  UncertaintyMode,
} from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport } from '../playback/attritionReport'
import type { McSummary, SensitivitySummary } from '../playback/mcRun'
import type { ModelTag } from '../analysis/fidelity'
import { modelsUsed } from '../analysis/fidelity'
import type { RequirementGateReport } from '../analysis/requirements'
import { buildRequirementGateReport } from '../analysis/requirements'
import type { RunValidityAssessment } from '../analysis/runValidity'
import { assessRunValidity } from '../analysis/runValidity'
import type { UncertainField } from '../analysis/uncertainty'
import { uncertainFields } from '../analysis/uncertainty'
import { runSettings } from '../model/types'
import { emptyScenario } from '../model/seed'
import type { SeedAdoption } from '../model/libraryLifecycle'
import { reconcileLibraryReport, reconcileSeeded } from '../model/libraryLifecycle'
import type { Override } from '../model/libraryField'
import { DATA_PACKAGE_VERSION } from '../model/libraryField'
import { useStore } from '../state/store'
import { analysisBasisSignature } from '../state/analysisBasis'
import { runResultGroups } from './runResultGroups'
import type { RunResultGroups } from './runResultGroups'
import type { TrialResultView } from '../analysis/trialResult'
import type { AutosaveAdapter } from './autosave'
import { createAutosave } from './autosave'
import { SCENARIO_LEGACY_FIELDS, fillContainers } from './compat'
import { parseLibraryData, validateScenarioReferences, validateScenarioShape } from './validateScenario'
import { MAX_IMAGE_CODE_UNITS, objectAt, validateImage } from './runtimeValidation'
import { BASELINE_RECOVERY_PREFIX, BOARD_BASELINE, SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX } from './storageKeys'
import type { PinnedBaseline } from '../state/baseline'
import { validateMcSummary } from '../state/baseline'

/**
 * The one Board load boundary: validate the shape, then fill fields added after
 * a save was written. `SCENARIO_LEGACY_FIELDS` (`io/compat.ts`) declares which
 * fields a legacy save may omit and what supplies each one, so the validator's
 * accepted omissions and these fills cannot drift apart. Every `container`
 * entry is deep-filled one level from `emptyScenario()`, which stays the source
 * of top-level defaults. Exported for tests.
 *
 * Two fills are named rather than generic. Library and system presets RECONCILE
 * rather than being taken whole from the save: spreading the save over the seeds
 * would let a stale library shadow every model and preset added since, so an
 * existing scenario would never receive new seed content
 * (`src/model/libraryLifecycle.ts` owns that policy). The legacy engageOn policy
 * migrates to an ROE posture ('detected' -> 'free', 'confirmed' -> 'tight').
 */
/**
 * What a load adopted from the seed library: the stamp the Systems tab prints.
 * Never persisted and never part of the Scenario: a save records the filled
 * library, not the fact that a fill happened.
 */
export interface LoadNotice {
  /** Builtin models that took at least one seed key. */
  models: number
  /** Seed fields taken over those models. */
  fields: number
  /** The data package the keys came from (`DATA_PACKAGE_VERSION`). */
  dataPackageVersion: number
  /** Per (model, block), the keys taken. */
  adopted: SeedAdoption[]
}

/**
 * Adoption by the model object `fillScenario` built, so the stamp follows the
 * installed library and nothing else: a baseline parse, a rejected import or a
 * New scenario builds other objects and leaves the Board's stamp alone, and an
 * edit that replaces a model object drops its stamp with it.
 */
const SEED_ADOPTION = new WeakMap<SpecModel, SeedAdoption[]>()

/** The seed adoptions of one model object from the load that built it, else []. */
export function seedAdoptionOf(model: SpecModel): SeedAdoption[] {
  return SEED_ADOPTION.get(model) ?? []
}

/** The load notice over a library as installed, or null when no model in it adopted a key. */
export function loadNoticeFor(library: readonly SpecModel[]): LoadNotice | null {
  const adopted = library.flatMap(seedAdoptionOf)
  if (adopted.length === 0) return null
  return {
    models: new Set(adopted.map((a) => a.modelId)).size,
    fields: adopted.reduce((sum, a) => sum + a.keys.length, 0),
    dataPackageVersion: DATA_PACKAGE_VERSION,
    adopted,
  }
}

export function fillScenario(parsed: unknown): Scenario {
  validateScenarioShape(parsed)
  const empty = emptyScenario()
  const roe =
    parsed.roe ??
    (parsed.engageOn === 'detected' ? 'free' : parsed.engageOn === 'confirmed' ? 'tight' : empty.roe)
  const deletedSeedIds = Array.isArray(parsed.deletedSeedIds) ? parsed.deletedSeedIds : []
  const reconciled = reconcileLibraryReport(parsed.library, empty.library, deletedSeedIds)
  for (const model of reconciled.library) {
    const mine = reconciled.adopted.filter((a) => a.modelId === model.id)
    if (mine.length > 0) SEED_ADOPTION.set(model, mine)
  }
  const filled: Scenario = {
    ...empty,
    ...parsed,
    ...fillContainers(parsed, empty, SCENARIO_LEGACY_FIELDS),
    library: reconciled.library,
    systemPresets: reconcileSeeded(parsed.systemPresets, empty.systemPresets, deletedSeedIds),
    deletedSeedIds,
    // emptyScenario() always sets doctrine; the Scenario type keeps it optional for old saves.
    doctrine: fillDoctrine(empty.doctrine as FireDoctrine, parsed.doctrine),
    roe,
    // A save that predates a run field keeps the compatibility default, not the
    // fresh-scenario default: an old board stays deterministic and aleatory.
    runMode: parsed.runMode ?? 'deterministic',
    uncertainty: parsed.uncertainty ?? 'aleatory',
    targetHalfWidth: parsed.targetHalfWidth === undefined ? null : parsed.targetHalfWidth,
  }
  validateScenarioReferences(filled)
  return filled
}

/**
 * Doctrine fill with one migration: a record with no launchPolicy predates
 * the doctrinal sequence and takes the default enabled flag; a record with a
 * launchPolicy keeps its enabled flag as written.
 */
function fillDoctrine(
  empty: FireDoctrine,
  saved: Partial<FireDoctrine> | undefined,
): FireDoctrine {
  if (!saved) return { ...empty }
  const preLaunchPolicy = saved.launchPolicy == null
  return { ...empty, ...saved, enabled: preLaunchPolicy ? empty.enabled : (saved.enabled ?? empty.enabled) }
}

/**
 * Parse a raw autosave record. Throws a path/reason on invalid JSON or runtime
 * shape; only a validated, default-filled schema-1 scenario is returned.
 */
export function parseAutosave(raw: string): Scenario {
  return parseScenarioData(JSON.parse(raw))
}

/** Pure scenario import boundary; no malformed payload reaches a store. */
export function parseScenarioData(value: unknown): Scenario {
  return fillScenario(value)
}

/**
 * The Board half of the autosave lifecycle in `io/autosave.ts`: the scenario
 * key, the scenario parser, the scenario selection, adoption through
 * `loadScenario` and the Board's epoch-millisecond save status.
 */
export const scenarioAutosaveAdapter: AutosaveAdapter<Scenario> = {
  key: SCENARIO_KEY,
  recoveryPrefix: SCENARIO_RECOVERY_PREFIX,
  label: 'scenario',
  parse: parseAutosave,
  adopt: (scenario) => useStore.getState().loadScenario(scenario),
  subscribe: (changed) =>
    useStore.subscribe((state, prev) => {
      if (state.scenario === prev.scenario) return
      changed(state.scenario)
    }),
  reportSaved: () => useStore.getState().setSaveState(Date.now(), null),
  reportPaused: (message) => {
    const store = useStore.getState()
    store.setSaveState(store.save.lastAutosaveAt, message)
  },
  reportWriteFailure: (error) => {
    const store = useStore.getState()
    const reason = error instanceof Error ? error.message || error.name : 'storage error'
    store.setSaveState(store.save.lastAutosaveAt, `Not saved: ${reason}. Export the scenario.`)
  },
}

const scenarioAutosave = createAutosave(scenarioAutosaveAdapter)

/**
 * The persisted baseline record. A cleared baseline is written as null rather
 * than removed, so a pending pin write can never resurrect a cleared baseline.
 */
export interface BaselineSave {
  schemaVersion: 1
  baseline: PinnedBaseline | null
}

/**
 * Parse a raw baseline save. The scenario passes the one Board load boundary;
 * the summary passes `validateMcSummary`, which restores NaN from null.
 */
export function parseBaselineSave(raw: string): BaselineSave {
  const save = objectAt(JSON.parse(raw), 'baselineSave')
  if (save.schemaVersion !== 1) throw new Error('baselineSave.schemaVersion: expected 1')
  if (save.baseline === null) return { schemaVersion: 1, baseline: null }
  const b = objectAt(save.baseline, 'baseline')
  for (const key of ['pinnedAt', 'label', 'scenarioHash'] as const) {
    if (typeof b[key] !== 'string' || !b[key]) throw new Error(`baseline.${key}: expected a nonempty string`)
  }
  if (!Number.isFinite(Date.parse(b.pinnedAt as string))) throw new Error('baseline.pinnedAt: expected an ISO time')
  return { schemaVersion: 1, baseline: {
    pinnedAt: b.pinnedAt as string, label: b.label as string, scenarioHash: b.scenarioHash as string,
    scenario: parseScenarioData(b.scenario), mc: validateMcSummary(b.mc, 'baseline.mc'),
    overrides: baselineOverrides(b.overrides),
  } }
}

/** The overrides a pinned ensemble applied; a baseline pinned before the record carries none. */
function baselineOverrides(value: unknown): Override[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('baseline.overrides: expected an array')
  return value.map((entry, i) => {
    const path = `baseline.overrides[${i}]`
    const o = objectAt(entry, path)
    for (const key of ['modelId', 'field', 'reason', 'date'] as const) {
      if (typeof o[key] !== 'string' || !o[key]) throw new Error(`${path}.${key}: expected a nonempty string`)
    }
    if (!Object.hasOwn(o, 'value')) throw new Error(`${path}.value: expected a value`)
    return { modelId: o.modelId as string, field: o.field as string, value: o.value, reason: o.reason as string, date: o.date as string }
  })
}

const BASELINE_ERROR = 'Baseline not saved'

/** The baseline half of the lifecycle: its own key, parser and record, sharing the Board save status. */
export const baselineAutosaveAdapter: AutosaveAdapter<BaselineSave> = {
  key: BOARD_BASELINE,
  recoveryPrefix: BASELINE_RECOVERY_PREFIX,
  label: 'baseline',
  parse: parseBaselineSave,
  adopt: (save) => useStore.getState().restoreBaseline(save.baseline),
  deferred: true,
  subscribe: (changed) =>
    useStore.subscribe((state, prev) => {
      if (state.baseline === prev.baseline) return
      changed({ schemaVersion: 1, baseline: state.baseline })
    }),
  // The scenario stamp stays the scenario's; a baseline write clears only its own error.
  reportSaved: () => {
    const store = useStore.getState()
    if (store.save.error?.startsWith(BASELINE_ERROR)) store.setSaveState(store.save.lastAutosaveAt, null)
  },
  reportPaused: (message) => {
    const store = useStore.getState()
    store.setSaveState(store.save.lastAutosaveAt, message)
  },
  reportWriteFailure: (error) => {
    const store = useStore.getState()
    const reason = error instanceof Error ? error.message || error.name : 'storage error'
    store.setSaveState(store.save.lastAutosaveAt, `${BASELINE_ERROR}: ${reason}. Pin again when storage is available.`)
  },
}

const baselineAutosave = createAutosave(baselineAutosaveAdapter)

/** Read the saved scenario, then the saved baseline, back into the store at startup. Runs at most once. */
export function restoreAutosave(): void {
  scenarioAutosave.restore()
  baselineAutosave.restore()
}

/**
 * Subscribe the store to localStorage autosave. Call once at startup. Writes
 * are debounced; a pending write is flushed synchronously when the tab is
 * hidden or unloaded so a close never loses the last edit.
 */
export function startAutosave(): void {
  scenarioAutosave.observe()
  baselineAutosave.observe()
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** A file-name-safe slug. Shared with the CSV tables so one run's files sort together. */
export function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'scenario'
}

export function exportScenario(scenario: Scenario): void {
  downloadJson(scenario, `${safeName(scenario.name)}.rangeboard.json`)
}

export function exportLibrary(library: SpecModel[]): void {
  downloadJson({ rangeboardLibrary: 1, models: library }, 'rangeboard-library.json')
}

interface RunRecordMeta {
  id: string
  label: string
  sequence: number
  startedAt: string
  completedAt: string
  durationS: number
  observedThroughS: number
}

/** Full, reproducible completed-run package rather than summary-only AAR. */
interface RunExport {
  rangeboardRun: 1
  /** Existing dataBasis describes only its named groups, not the whole mixed package. */
  packageBasis: {
    semantics: 'planning-envelope' | 'mixed-result-groups'
    dataBasisAppliesTo: Array<Exclude<keyof RunResultGroups, 'trial'>>
  }
  /** Configuration equality only: not a cryptographic or source-revision hash. */
  configuration: { analysisBasisSignature: string; identityKind: 'configuration-equality' }
  resultGroups: RunResultGroups
  dataBasis: {
    kind: 'deterministic-planning-model' | 'monte-carlo'
    /** What the numbers are: a threshold envelope, or a replicate estimate. */
    semantics: 'planning-envelope' | 'estimate'
    sampleStepS: 0.5
    independentlyInstrumented: false
    runScoped: true
    /** Monte Carlo only: the base seed and the replicate count behind mcSummary. */
    seed?: number
    replicates?: number
    /** Monte Carlo only: why the replicate loop ended. */
    stopped?: McSummary['stopped']
    /** Monte Carlo only: draw noise alone, or parameter spreads too. */
    uncertainty?: UncertaintyMode
  }
  /**
   * Whether the run can carry the evidence it looks like it carries, and
   * every finding behind that call. A detect result from a track that spawned
   * inside a sensor ring is not a detect result, and the record has to say so.
   */
  validity: RunValidityAssessment
  /** Every model the laydown exercises, with its tier and validation status. */
  models: ModelTag[]
  run: RunRecordMeta
  scenario: Scenario
  assessments: ThreatAssessment[]
  attrition: AttritionReport
  requirements: RequirementGateReport
  summary: AarSummary
  /** The replicate summary, present only for a Monte Carlo run. */
  mcSummary?: McSummary
  /** Every field the replicates sampled; a Monte Carlo run under total uncertainty only. */
  sampledFields?: UncertainField[]
  /** The sensitivity rows, present when a sensitivity run finished for this run. */
  sensitivity?: SensitivitySummary
}

/** Pure builder for tests and alternate storage targets. */
export function runExportObject(
  scenario: Scenario,
  run: RunRecordMeta,
  assessments: ThreatAssessment[],
  attrition: AttritionReport,
  summary: AarSummary,
  mc: McSummary | null = null,
  sensitivity: SensitivitySummary | null = null,
  trial: TrialResultView | null = null,
): RunExport {
  if (trial) {
    if (trial.manifest.runId !== run.id) throw new Error('Trial run id does not match the export package')
    if (!run.completedAt || !Number.isFinite(run.durationS) || !Number.isFinite(run.observedThroughS) ||
      run.durationS !== trial.durationS || run.observedThroughS < run.durationS) {
      throw new Error('Cannot export an incomplete trial run')
    }
  }
  // A package with no replicate summary carries deterministic numbers, so its
  // validity and its model list read the envelope even under a Monte Carlo
  // run setting; the scenario itself is exported unchanged.
  const basisScenario: Scenario =
    mc || runSettings(scenario).runMode === 'deterministic'
      ? scenario
      : { ...scenario, runMode: 'deterministic' }
  const validity = assessRunValidity(basisScenario, assessments)
  const out: RunExport = {
    rangeboardRun: 1,
    packageBasis: {
      semantics: mc || sensitivity || trial ? 'mixed-result-groups' : 'planning-envelope',
      dataBasisAppliesTo: mc ? ['mcSummary'] : ['assessments', 'attrition', 'requirements', 'summary'],
    },
    configuration: {
      analysisBasisSignature: analysisBasisSignature(scenario),
      identityKind: 'configuration-equality',
    },
    resultGroups: runResultGroups(scenario, assessments, attrition, mc, sensitivity, trial),
    dataBasis: mc
      ? {
          kind: 'monte-carlo',
          semantics: 'estimate',
          sampleStepS: 0.5,
          independentlyInstrumented: false,
          runScoped: true,
          seed: mc.seed,
          replicates: mc.replicates,
          stopped: mc.stopped,
          uncertainty: runSettings(scenario).uncertainty,
        }
      : {
          kind: 'deterministic-planning-model',
          semantics: 'planning-envelope',
          sampleStepS: 0.5,
          independentlyInstrumented: false,
          runScoped: true,
        },
    validity,
    models: modelsUsed(basisScenario),
    run,
    scenario,
    assessments,
    attrition,
    requirements: buildRequirementGateReport(scenario, assessments, attrition, validity),
    summary,
  }
  if (mc) out.mcSummary = mc
  // The sampled field list is what a total-uncertainty replicate drew, so it
  // reads the scenario the run settings name, never the sampled copy.
  if (mc && runSettings(scenario).uncertainty === 'total') {
    out.sampledFields = uncertainFields(scenario)
  }
  if (sensitivity) out.sensitivity = sensitivity
  return out
}

export function exportRunRecord(
  scenario: Scenario,
  run: RunRecordMeta,
  assessments: ThreatAssessment[],
  attrition: AttritionReport,
  summary: AarSummary,
  mc: McSummary | null = null,
  sensitivity: SensitivitySummary | null = null,
  trial: TrialResultView | null = null,
): void {
  downloadJson(
    runExportObject(scenario, run, assessments, attrition, summary, mc, sensitivity, trial),
    `${safeName(scenario.name)}.${run.label.toLowerCase()}.run.json`,
  )
}

/**
 * Open a file picker and parse the chosen JSON file. A handler may return a
 * promise, so a store write after the parse reports through the same alert.
 */
export function pickJsonFile(onLoad: (data: unknown) => void | Promise<void>): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    file
      .text()
      .then((text) => onLoad(JSON.parse(text)))
      .catch((error: unknown) => window.alert(`Could not import file: ${error instanceof Error ? error.message : 'unreadable JSON'}`))
  }
  input.click()
}

/** True when the board holds work an import or a reset would destroy. */
export function scenarioHasWork(s: Scenario): boolean {
  return s.entities.length > 0 || s.paths.length > 0 || s.boundaries.length > 0
}

export function importScenarioFile(): void {
  if (
    scenarioHasWork(useStore.getState().scenario) &&
    !window.confirm('Import a scenario? The current board is replaced.')
  ) {
    return
  }
  pickJsonFile((data) => {
    const s = parseScenarioData(data)
    useStore.getState().loadScenario(s, { fit: 'always' })
  })
}


export function importLibraryFile(): void {
  pickJsonFile((data) => {
    useStore.getState().mergeLibrary(parseLibraryData(data))
  })
}

/** Open a file picker for an image and load it as the satellite underlay. */
export function importUnderlayImage(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    // Base64 expands bytes by 4/3; localStorage counts UTF-16 code units.
    if (4 * Math.ceil(file.size / 3) + 128 > MAX_IMAGE_CODE_UNITS) {
      window.alert('Image exceeds the 5 MiB browser-storage budget. Choose a smaller image.')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => window.alert('Could not read the image file.')
    reader.onload = () => {
      const dataUrl = reader.result as string
      try { validateImage(dataUrl, 'underlay.dataUrl', true) } catch (error) { window.alert((error as Error).message); return }
      const img = new Image()
      img.onerror = () => window.alert('Could not decode the image file.')
      img.onload = () => {
        useStore.getState().setUnderlayImage(dataUrl, img.naturalWidth, img.naturalHeight)
        useStore.getState().setBasemap('sat')
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

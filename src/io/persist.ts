import type {
  AarSummary,
  FireDoctrine,
  McdaVector,
  RaidPlan,
  Scenario,
  SpecModel,
} from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport } from '../playback/attrition'
import type { McSummary } from '../playback/mcRun'
import type { ModelTag } from '../analysis/fidelity'
import { modelsUsed } from '../analysis/fidelity'
import type { RequirementGateReport } from '../analysis/requirements'
import { buildRequirementGateReport } from '../analysis/requirements'
import type { RunValidityAssessment } from '../analysis/runValidity'
import { assessRunValidity } from '../analysis/runValidity'
import { specFields, runSettings } from '../model/types'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { notifyRecovery, stashUnreadableSave } from './recovery'
import { SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX } from './storageKeys'

/**
 * Append seed entries the save has never seen, matched by id. Saved entries win
 * on collision, so a user's edits to a seed model and their custom models both
 * survive. A seed id in `deletedSeedIds` stays out: the user removed it and a
 * reload must not bring it back. Same policy as the store's mergeLibrary action.
 */
function mergeSeeds<T extends { id: string }>(
  saved: T[] | undefined,
  seeds: T[],
  deleted: ReadonlySet<string>,
): T[] {
  if (!Array.isArray(saved)) return seeds
  const have = new Set(saved.map((x) => x.id))
  return [...saved, ...seeds.filter((x) => !have.has(x.id) && !deleted.has(x.id))]
}

/**
 * Give a saved builtin model the seed's provenance rows for every field the user
 * has not edited. A saved row is kept as it is. A field whose saved value differs
 * from the seed value gets no row (it stays a planning factor). A custom model is
 * returned unchanged.
 */
export function adoptSeedProvenance(saved: SpecModel, seed: SpecModel): SpecModel {
  if (!saved.builtin) return saved
  const rows = seed.provenance
  if (!rows || rows.length === 0) return saved
  const savedSpec = specFields(saved)
  const seedSpec = specFields(seed)
  const have = new Set((saved.provenance ?? []).map((r) => r.field))
  const add = rows.filter(
    (r) =>
      !have.has(r.field) &&
      JSON.stringify(savedSpec[r.field]) === JSON.stringify(seedSpec[r.field]),
  )
  if (add.length === 0) return saved
  return { ...saved, provenance: [...(saved.provenance ?? []), ...add] }
}

/**
 * Fill fields added after a save was written and migrate the legacy engageOn
 * policy to an ROE posture ('detected' -> 'free', 'confirmed' -> 'tight').
 * Nested objects (environment, requirements, doctrine, mcdaWeights, underlay,
 * raid) are deep-filled one level so a field added to any of them reaches an
 * older save. Exported for tests.
 *
 * Library and system presets MERGE rather than being taken whole from the save.
 * Spreading the save over the seeds would let a stale library shadow every model
 * and preset added since, so an existing scenario would never receive new seed
 * content.
 */
export function fillScenario(parsed: Scenario): Scenario {
  const empty = emptyScenario()
  const roe =
    parsed.roe ??
    (parsed.engageOn === 'detected' ? 'free' : parsed.engageOn === 'confirmed' ? 'tight' : empty.roe)
  const deletedSeedIds = Array.isArray(parsed.deletedSeedIds) ? parsed.deletedSeedIds : []
  const deleted = new Set(deletedSeedIds)
  // A seed row added after a save was written never reaches that save through
  // mergeSeeds, which keeps the saved copy whole. Adopt the rows here instead.
  const seedById = new Map(empty.library.map((m) => [m.id, m]))
  const library = mergeSeeds(parsed.library, empty.library, deleted).map((m) => {
    const seed = m.builtin ? seedById.get(m.id) : undefined
    return seed ? adoptSeedProvenance(m, seed) : m
  })
  return {
    ...empty,
    ...parsed,
    library,
    systemPresets: mergeSeeds(parsed.systemPresets, empty.systemPresets, deleted),
    deletedSeedIds,
    environment: { ...empty.environment, ...parsed.environment },
    requirements: { ...empty.requirements, ...parsed.requirements },
    // emptyScenario() always sets these; the Scenario type keeps them optional for old saves.
    doctrine: fillDoctrine(empty.doctrine as FireDoctrine, parsed.doctrine),
    mcdaWeights: { ...(empty.mcdaWeights as McdaVector), ...parsed.mcdaWeights },
    underlay: { ...empty.underlay, ...parsed.underlay },
    raid: { ...(empty.raid as RaidPlan), ...parsed.raid },

    roe,
  }
}

/**
 * Doctrine fill with one migration. Saves written before launch policies
 * existed carry `enabled: false` only because that was the default of the
 * day, never as a planning decision, so a doctrine record with no
 * launchPolicy adopts the doctrinal sequence (the current default). A save
 * that has a launchPolicy keeps its enabled flag as written.
 */
export function fillDoctrine(
  empty: FireDoctrine,
  saved: Partial<FireDoctrine> | undefined,
): FireDoctrine {
  if (!saved) return { ...empty }
  const preLaunchPolicy = saved.launchPolicy == null
  return { ...empty, ...saved, enabled: preLaunchPolicy ? empty.enabled : (saved.enabled ?? empty.enabled) }
}

/**
 * Parse a raw autosave record. Throws on malformed JSON; returns null when the
 * record is not a schema-1 scenario. Exported for tests.
 */
export function parseAutosave(raw: string): Scenario | null {
  const parsed = JSON.parse(raw) as Scenario | null
  if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1) return null
  return fillScenario(parsed)
}

/**
 * Load the scenario autosave. A record that exists but cannot be loaded is
 * copied to a recovery key BEFORE this returns, because the first edit after
 * an empty start overwrites the live key. The user is told where the copy is.
 */
export function loadAutosave(): Scenario | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(SCENARIO_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let scenario: Scenario | null = null
  try {
    scenario = parseAutosave(raw)
  } catch {
    scenario = null
  }
  if (scenario) return scenario
  notifyRecovery('scenario', stashUnreadableSave(raw, SCENARIO_RECOVERY_PREFIX))
  return null
}

/**
 * Subscribe the store to localStorage autosave. Call once at startup. Writes
 * are debounced; a pending write is flushed synchronously when the tab is
 * hidden or unloaded so a close never loses the last edit.
 */
export function startAutosave(): void {
  let timer: number | undefined
  let pending: Scenario | null = null

  function flush(): void {
    window.clearTimeout(timer)
    timer = undefined
    const scenario = pending
    pending = null
    if (!scenario) return
    const store = useStore.getState()
    try {
      localStorage.setItem(SCENARIO_KEY, JSON.stringify(scenario))
      store.setSaveState(Date.now(), null)
    } catch (err) {
      // Storage full (large underlay image) or storage unavailable. The Saved
      // pill must not keep showing a time that is no longer true.
      const reason = err instanceof Error && err.name ? err.name : 'storage error'
      store.setSaveState(store.save.lastAutosaveAt, `Not saved: ${reason}. Export the scenario.`)
    }
  }

  useStore.subscribe((state, prev) => {
    if (state.scenario === prev.scenario) return
    pending = state.scenario
    window.clearTimeout(timer)
    timer = window.setTimeout(flush, 500)
  })
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'scenario'
}

export function exportScenario(scenario: Scenario): void {
  downloadJson(scenario, `${safeName(scenario.name)}.rangeboard.json`)
}

export function exportLibrary(library: SpecModel[]): void {
  downloadJson({ rangeboardLibrary: 1, models: library }, 'rangeboard-library.json')
}

/** AAR export file shape. */
export interface AarExport {
  rangeboardAar: 1
  scenario: string
  summary: AarSummary
}

/** Pure builder for the AAR export payload; exported for tests. */
export function aarExportObject(scenarioName: string, summary: AarSummary): AarExport {
  return { rangeboardAar: 1, scenario: scenarioName, summary }
}

export function exportAar(scenarioName: string, summary: AarSummary): void {
  downloadJson(aarExportObject(scenarioName, summary), `${safeName(scenarioName)}.aar.json`)
}

export interface RunRecordMeta {
  id: string
  label: string
  sequence: number
  startedAt: string
  completedAt: string
  durationS: number
  observedThroughS: number
}

/** Full, reproducible completed-run package rather than summary-only AAR. */
export interface RunExport {
  rangeboardRun: 1
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
}

/** Pure builder for tests and alternate storage targets. */
export function runExportObject(
  scenario: Scenario,
  run: RunRecordMeta,
  assessments: ThreatAssessment[],
  attrition: AttritionReport,
  summary: AarSummary,
  mc: McSummary | null = null,
): RunExport {
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
  return out
}

export function exportRunRecord(
  scenario: Scenario,
  run: RunRecordMeta,
  assessments: ThreatAssessment[],
  attrition: AttritionReport,
  summary: AarSummary,
  mc: McSummary | null = null,
): void {
  downloadJson(
    runExportObject(scenario, run, assessments, attrition, summary, mc),
    `${safeName(scenario.name)}.${run.label.toLowerCase()}.run.json`,
  )
}

/** Open a file picker and parse the chosen JSON file. */
export function pickJsonFile(onLoad: (data: unknown) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    file
      .text()
      .then((text) => onLoad(JSON.parse(text)))
      .catch(() => window.alert('Could not read that file as JSON.'))
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
    const s = data as Scenario
    if (s?.schemaVersion !== 1 || !Array.isArray(s.entities)) {
      window.alert('That file is not a RangeBoard scenario.')
      return
    }
    useStore.getState().loadScenario(fillScenario(s), { fit: 'always' })

  })
}


export function importLibraryFile(): void {
  pickJsonFile((data) => {
    const d = data as { rangeboardLibrary?: number; models?: SpecModel[] }
    if (d?.rangeboardLibrary !== 1 || !Array.isArray(d.models)) {
      window.alert('That file is not a RangeBoard library.')
      return
    }
    useStore.getState().mergeLibrary(d.models)
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
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
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

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
import type { RequirementGateReport } from '../analysis/requirements'
import { buildRequirementGateReport } from '../analysis/requirements'
import type { RunValidityAssessment } from '../analysis/runValidity'
import { assessRunValidity } from '../analysis/runValidity'
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
  return {
    ...empty,
    ...parsed,
    library: mergeSeeds(parsed.library, empty.library, deleted),
    systemPresets: mergeSeeds(parsed.systemPresets, empty.systemPresets, deleted),
    deletedSeedIds,
    environment: { ...empty.environment, ...parsed.environment },
    requirements: { ...empty.requirements, ...parsed.requirements },
    // emptyScenario() always sets these; the Scenario type keeps them optional for old saves.
    doctrine: { ...(empty.doctrine as FireDoctrine), ...parsed.doctrine },
    mcdaWeights: { ...(empty.mcdaWeights as McdaVector), ...parsed.mcdaWeights },
    underlay: { ...empty.underlay, ...parsed.underlay },
    raid: { ...(empty.raid as RaidPlan), ...parsed.raid },

    roe,
  }
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
    kind: 'deterministic-planning-model'
    sampleStepS: 0.5
    independentlyInstrumented: false
    runScoped: true
  }
  /**
   * Whether the run can carry the evidence it looks like it carries, and
   * every finding behind that call. A detect result from a track that spawned
   * inside a sensor ring is not a detect result, and the record has to say so.
   */
  validity: RunValidityAssessment
  run: RunRecordMeta
  scenario: Scenario
  assessments: ThreatAssessment[]
  attrition: AttritionReport
  requirements: RequirementGateReport
  summary: AarSummary
}

/** Pure builder for tests and alternate storage targets. */
export function runExportObject(
  scenario: Scenario,
  run: RunRecordMeta,
  assessments: ThreatAssessment[],
  attrition: AttritionReport,
  summary: AarSummary,
): RunExport {
  const validity = assessRunValidity(scenario, assessments)
  return {
    rangeboardRun: 1,
    dataBasis: {
      kind: 'deterministic-planning-model',
      sampleStepS: 0.5,
      independentlyInstrumented: false,
      runScoped: true,
    },
    validity,
    run,
    scenario,
    assessments,
    attrition,
    requirements: buildRequirementGateReport(scenario, assessments, attrition, validity),
    summary,
  }
}

export function exportRunRecord(
  scenario: Scenario,
  run: RunRecordMeta,
  assessments: ThreatAssessment[],
  attrition: AttritionReport,
  summary: AarSummary,
): void {
  downloadJson(
    runExportObject(scenario, run, assessments, attrition, summary),
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

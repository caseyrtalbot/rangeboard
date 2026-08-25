import type { AarSummary, Scenario, SpecModel } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport } from '../playback/attrition'
import type { RequirementGateReport } from '../analysis/requirements'
import { buildRequirementGateReport } from '../analysis/requirements'
import type { RunValidityAssessment } from '../analysis/runValidity'
import { assessRunValidity } from '../analysis/runValidity'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'

const STORAGE_KEY = 'rangeboard.scenario.v1'

/**
 * Append seed entries the save has never seen, matched by id. Saved entries win
 * on collision, so a user's edits to a seed model and their custom models both
 * survive. The tradeoff: a seed entry the user deleted comes back on the next
 * load. Same policy as the store's mergeLibrary action.
 */
function mergeSeeds<T extends { id: string }>(saved: T[] | undefined, seeds: T[]): T[] {
  if (!Array.isArray(saved)) return seeds
  const have = new Set(saved.map((x) => x.id))
  return [...saved, ...seeds.filter((x) => !have.has(x.id))]
}

/**
 * Fill fields added after a save was written, including nested environment
 * fields, and migrate the legacy engageOn policy to an ROE posture
 * ('detected' -> 'free', 'confirmed' -> 'tight'). Exported for tests.
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
  return {
    ...empty,
    ...parsed,
    library: mergeSeeds(parsed.library, empty.library),
    systemPresets: mergeSeeds(parsed.systemPresets, empty.systemPresets),
    environment: { ...empty.environment, ...parsed.environment },
    requirements: { ...empty.requirements, ...parsed.requirements },
    roe,
  }
}

export function loadAutosave(): Scenario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Scenario
    if (parsed.schemaVersion !== 1) return null
    return fillScenario(parsed)
  } catch {
    return null
  }
}

/** Subscribe the store to localStorage autosave. Call once at startup. */
export function startAutosave(): void {
  let timer: number | undefined
  useStore.subscribe((state, prev) => {
    if (state.scenario === prev.scenario) return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scenario))
        useStore.getState().setLastAutosaveAt(Date.now())
      } catch {
        // Storage full (large underlay image): skip autosave, export still works.
      }
    }, 500)
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

export function importScenarioFile(): void {
  pickJsonFile((data) => {
    const s = data as Scenario
    if (s?.schemaVersion !== 1 || !Array.isArray(s.entities)) {
      window.alert('That file is not a RangeBoard scenario.')
      return
    }
    useStore.getState().replaceScenario(fillScenario(s))
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

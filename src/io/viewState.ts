import type { BasemapMode } from '../model/types'
import type { DisplayUnits } from '../geometry/geo'
import type { LayerVisibility } from '../state/layers'
import { DEFAULT_LAYERS } from '../state/layers'
import type { AnalysisViewState } from '../state/analysisLayout'
import { defaultAnalysisView, sanitizeAnalysisView } from '../state/analysisLayout'
import type { Camera, RightTab, Theme } from '../state/store'
import type { RingKey, RingOverrides } from '../state/rings'
import { RING_KEYS } from '../state/rings'
import type { Workspace } from '../te/state/teStore'
import { ANALYSIS_KEY, LAYERS_KEY, RINGS_KEY, RUNSEQ_KEY, UNITS_KEY, VIEW_KEY } from './storageKeys'

/**
 * View state that survives a reload but never enters the `Scenario`: camera,
 * basemap, right panel tab, workspace and theme. Written eagerly by the store
 * setters, read once at store construction. Every field is optional so a
 * partial or older record still loads.
 */
export interface SavedView {
  camera?: Camera
  basemap?: BasemapMode
  rightTab?: RightTab
  workspace?: Workspace
  theme?: Theme
}

function readRaw(): Record<string, unknown> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function validCamera(c: unknown): Camera | undefined {
  if (!c || typeof c !== 'object') return undefined
  const { x, y, scale } = c as Record<string, unknown>
  if (typeof x !== 'number' || typeof y !== 'number' || typeof scale !== 'number') return undefined
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale) || scale <= 0) {
    return undefined
  }
  return { x, y, scale }
}

function oneOf<T extends string>(v: unknown, allowed: T[]): T | undefined {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : undefined
}

/** Validated view state from localStorage; a field the record lacks or that fails validation is absent. */
export function savedView(): SavedView {
  const BASEMAPS: BasemapMode[] = ['canvas', 'sat', 'airspace']
  const RIGHT_TABS: RightTab[] = ['inspect', 'cards', 'library', 'analysis']
  const WORKSPACES: Workspace[] = ['board', 'ops']
  const THEMES: Theme[] = ['system', 'dark', 'light']
  const raw = readRaw()
  const out: SavedView = {}
  const camera = validCamera(raw.camera)
  const basemap = oneOf(raw.basemap, BASEMAPS)
  const rightTab = oneOf(raw.rightTab, RIGHT_TABS)
  const workspace = oneOf(raw.workspace, WORKSPACES)
  const theme = oneOf(raw.theme, THEMES)
  if (camera) out.camera = camera
  if (basemap) out.basemap = basemap
  if (rightTab) out.rightTab = rightTab
  if (workspace) out.workspace = workspace
  if (theme) out.theme = theme
  return out
}

/** Merge a partial view state into the stored record. */
export function writeView(patch: SavedView): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({ ...readRaw(), ...patch }))
  } catch {
    // View state is a convenience; a full store loses nothing the scenario holds.
  }
}

function readRingsRaw(): Record<string, unknown> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RINGS_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Validated per-entity ring overrides from localStorage. An entity record keeps
 * only known ring keys with a boolean value, and an empty record is dropped.
 */
export function savedRingOverrides(): RingOverrides {
  const raw = readRingsRaw()
  const out: RingOverrides = {}
  for (const [entityId, record] of Object.entries(raw)) {
    if (!record || typeof record !== 'object') continue
    const entry: Partial<Record<RingKey, boolean>> = {}
    for (const key of RING_KEYS) {
      const v = (record as Record<string, unknown>)[key]
      if (typeof v === 'boolean') entry[key] = v
    }
    if (Object.keys(entry).length > 0) out[entityId] = entry
  }
  return out
}

/** Replace the stored ring overrides with the whole current map. */
export function writeRingOverrides(overrides: RingOverrides): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(RINGS_KEY, JSON.stringify(overrides))
  } catch {
    // Ring overrides are a convenience; the layer flags still answer for every entity.
  }
}

/**
 * Validated analysis lens layout and user presets from localStorage. Builtin
 * lenses are never stored: they come from `BUILTIN_LENSES` on every read.
 */
export function savedAnalysis(): AnalysisViewState {
  if (typeof localStorage === 'undefined') return defaultAnalysisView()
  try {
    const raw = localStorage.getItem(ANALYSIS_KEY)
    if (raw == null) return defaultAnalysisView()
    return sanitizeAnalysisView(JSON.parse(raw))
  } catch {
    return defaultAnalysisView()
  }
}

/** Replace the stored analysis view with the whole current layout and preset list. */
export function writeAnalysis(state: AnalysisViewState): void {
  if (typeof localStorage === 'undefined') return
  try {
    const { layout, userPresets } = state
    localStorage.setItem(ANALYSIS_KEY, JSON.stringify({ layout, userPresets }))
  } catch {
    // The lens layout is a convenience; every widget still reads the live scenario.
  }
}

/** Trailing debounce for the camera, which changes on every drag and zoom event. */
const CAMERA_WRITE_DELAY_MS = 250
let cameraTimer: ReturnType<typeof setTimeout> | undefined
let pendingCamera: Camera | null = null
let flushHooked = false

/** Write the latest pending camera now. Called on pagehide and when the tab is hidden. */
export function flushViewWrites(): void {
  clearTimeout(cameraTimer)
  cameraTimer = undefined
  const camera = pendingCamera
  pendingCamera = null
  if (camera) writeView({ camera })
}

function hookFlush(): void {
  if (flushHooked || typeof window === 'undefined' || typeof document === 'undefined') return
  flushHooked = true
  window.addEventListener('pagehide', flushViewWrites)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushViewWrites()
  })
}

/** Queue a camera write; only the last camera inside the delay reaches storage. */
export function writeViewCamera(camera: Camera): void {
  if (typeof localStorage === 'undefined') return
  hookFlush()
  pendingCamera = camera
  clearTimeout(cameraTimer)
  cameraTimer = setTimeout(flushViewWrites, CAMERA_WRITE_DELAY_MS)
}


/**
 * Run sequence the next startup issues. Written on a manual reset (the fresh
 * run's own number, so a reload shows the same run) and on the first start of
 * a run (that number plus one, so a run that produced telemetry is never
 * reissued after a reload).
 */
export function savedRunSeq(): number {
  if (typeof localStorage === 'undefined') return 1
  const n = Number(localStorage.getItem(RUNSEQ_KEY))
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** Store the run sequence the next startup issues. */
export function writeRunSeq(seq: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(RUNSEQ_KEY, String(seq))
  } catch {
    // A lost sequence write costs a reused label, never data.
  }
}

/** Display units from localStorage; anything other than the exact metric value is aviation. */
export function savedUnits(): DisplayUnits {
  if (typeof localStorage === 'undefined') return 'aviation'
  return localStorage.getItem(UNITS_KEY) === 'metric' ? 'metric' : 'aviation'
}

/** Store the display units. */
export function writeUnits(v: DisplayUnits): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(UNITS_KEY, v)
}

/**
 * Layer visibility from localStorage, spread over DEFAULT_LAYERS so a layer key
 * added after the save still gets a value. A save from before the ring split
 * carries `sensorFootprints` and `effectorEnvelopes`: they seed the placard and
 * the max-range ring, then both old keys go.
 */
export function savedLayers(): LayerVisibility {
  const defaults = { ...DEFAULT_LAYERS }
  if (typeof localStorage === 'undefined') return defaults
  const raw = localStorage.getItem(LAYERS_KEY)
  if (raw == null) return defaults
  try {
    const saved = JSON.parse(raw) as Partial<LayerVisibility> & {
      sensorFootprints?: boolean
      effectorEnvelopes?: boolean
    }
    if (typeof saved.sensorFootprints === 'boolean' && saved.sensorPlacard === undefined) {
      saved.sensorPlacard = saved.sensorFootprints
    }
    if (typeof saved.effectorEnvelopes === 'boolean' && saved.effectorMaxRange === undefined) {
      saved.effectorMaxRange = saved.effectorEnvelopes
    }
    delete saved.sensorFootprints
    delete saved.effectorEnvelopes
    return { ...defaults, ...saved }
  } catch {
    return defaults
  }
}

/** Store the layer visibility. */
export function writeLayers(layers: LayerVisibility): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAYERS_KEY, JSON.stringify(layers))
}

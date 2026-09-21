import type { BasemapMode } from '../model/types'
import type { DisplayUnits } from '../geometry/geo'
import type { LayerVisibility } from '../state/layers'
import { DEFAULT_LAYERS } from '../state/layers'
import type { Camera, RightTab, Theme } from '../state/store'
import type { RingKey, RingOverrides } from '../state/rings'
import { RING_KEYS } from '../state/rings'
import { LAYERS_KEY, RINGS_KEY, RUNSEQ_KEY, UNITS_KEY, VIEW_KEY } from './storageKeys'

/**
 * View state that survives a reload but never enters the `Scenario`: camera,
 * basemap, right panel tab and theme. Written eagerly by the store setters, read
 * once at store construction. Every field is optional, so a partial or older record
 * still loads and an unknown field is dropped rather than raised.
 */
export interface SavedView {
  camera?: Camera
  basemap?: BasemapMode
  rightTab?: RightTab
  theme?: Theme
}

/**
 * One guarded path for every settings key. Browser storage can be absent, blocked
 * or full, so a failed read answers null and a failed write is dropped.
 */
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Write one setting. A blocked or full store drops the write; the default stands. */
export function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Dropped on purpose; see readSetting.
  }
}

/** Parse a stored JSON record; anything that is not an object reads as empty. */
function recordOf(raw: string | null): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function readRaw(): Record<string, unknown> {
  return recordOf(readSetting(VIEW_KEY))
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
  const RIGHT_TABS: RightTab[] = ['inspect', 'library', 'analysis']
  const THEMES: Theme[] = ['system', 'dark', 'light']
  const raw = readRaw()
  const out: SavedView = {}
  const camera = validCamera(raw.camera)
  const basemap = oneOf(raw.basemap, BASEMAPS)
  const rightTab = oneOf(raw.rightTab, RIGHT_TABS)
  const theme = oneOf(raw.theme, THEMES)
  if (camera) out.camera = camera
  if (basemap) out.basemap = basemap
  if (rightTab) out.rightTab = rightTab
  if (theme) out.theme = theme
  return out
}

/** Merge a partial view state into the stored record. */
export function writeView(patch: SavedView): void {
  writeSetting(VIEW_KEY, JSON.stringify({ ...readRaw(), ...patch }))
}

function readRingsRaw(): Record<string, unknown> {
  return recordOf(readSetting(RINGS_KEY))
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
  writeSetting(RINGS_KEY, JSON.stringify(overrides))
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
  hookFlush()
  pendingCamera = camera
  clearTimeout(cameraTimer)
  cameraTimer = setTimeout(flushViewWrites, CAMERA_WRITE_DELAY_MS)
}

/**
 * Run sequence the next startup issues. A manual reset writes the fresh run's own
 * number; the first start of a run writes that number plus one, so a run that
 * produced telemetry is never reissued after a reload.
 */
export function savedRunSeq(): number {
  const n = Number(readSetting(RUNSEQ_KEY))
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** Store the run sequence the next startup issues. */
export function writeRunSeq(seq: number): void {
  writeSetting(RUNSEQ_KEY, String(seq))
}

/** Display units from localStorage; anything other than the exact metric value is aviation. */
export function savedUnits(): DisplayUnits {
  return readSetting(UNITS_KEY) === 'metric' ? 'metric' : 'aviation'
}

/** Store the display units. */
export function writeUnits(v: DisplayUnits): void {
  writeSetting(UNITS_KEY, v)
}

/**
 * Layer visibility from localStorage, spread over DEFAULT_LAYERS so a layer key
 * added after the save still gets a value. An older save's `sensorFootprints` and
 * `effectorEnvelopes` seed the placard and max-range rings, then both keys go.
 */
export function savedLayers(): LayerVisibility {
  const defaults = { ...DEFAULT_LAYERS }
  const raw = readSetting(LAYERS_KEY)
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
  writeSetting(LAYERS_KEY, JSON.stringify(layers))
}

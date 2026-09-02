import type { BasemapMode } from '../model/types'
import type { Camera, RightTab } from '../state/store'
import type { Workspace } from '../te/state/teStore'
import { VIEW_KEY } from './storageKeys'

/**
 * View state that survives a reload but never enters the `Scenario`: camera,
 * basemap, right panel tab and workspace. Written eagerly by the store
 * setters, read once at store construction. Every field is optional so a
 * partial or older record still loads.
 */
export interface SavedView {
  camera?: Camera
  basemap?: BasemapMode
  rightTab?: RightTab
  workspace?: Workspace
}

const BASEMAPS: BasemapMode[] = ['canvas', 'sat', 'airspace']
const RIGHT_TABS: RightTab[] = ['inspect', 'cards', 'library', 'analysis']
const WORKSPACES: Workspace[] = ['board', 'ops']

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
  const raw = readRaw()
  const out: SavedView = {}
  const camera = validCamera(raw.camera)
  const basemap = oneOf(raw.basemap, BASEMAPS)
  const rightTab = oneOf(raw.rightTab, RIGHT_TABS)
  const workspace = oneOf(raw.workspace, WORKSPACES)
  if (camera) out.camera = camera
  if (basemap) out.basemap = basemap
  if (rightTab) out.rightTab = rightTab
  if (workspace) out.workspace = workspace
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


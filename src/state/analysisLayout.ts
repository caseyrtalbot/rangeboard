import { newId } from '../model/types'

/**
 * Analysis lens model: a lens is an ordered stack of widgets. Pure data and
 * pure reducers only. This module is a leaf: it never imports the store or the
 * storage layer, so both can import it without a cycle.
 */

/** Widget kinds the analysis stack can hold, in catalog order. */
export type WidgetType =
  | 'kpi-tiles' | 'time-series' | 'system-status' | 'threat-picture'
  | 'requirement-gates' | 'event-ledger' | 'environment' | 'fire-doctrine'
  | 'projection' | 'run-validity' | 'engagement-lanes' | 'sensitivity'

/** Every widget type in catalog order. The one list a loader validates against. */
export const WIDGET_TYPES: readonly WidgetType[] = [
  'kpi-tiles',
  'time-series',
  'system-status',
  'threat-picture',
  'requirement-gates',
  'event-ledger',
  'environment',
  'fire-doctrine',
  'projection',
  'run-validity',
  'engagement-lanes',
  'sensitivity',
]

/** KPI tile keys. The first six are the default tile set. */
export type KpiKey =
  | 'detect' | 'trackNow' | 'idClass' | 'engaged' | 'killEk' | 'leakEn'
  | 'lateEk' | 'salvos' | 'targetNow' | 'firstDetect' | 'firstEffect'
  | 'detectToEffect' | 'minWarning'

/** Every KPI tile key in display order. */
export const KPI_KEYS: readonly KpiKey[] = [
  'detect',
  'trackNow',
  'idClass',
  'engaged',
  'killEk',
  'leakEn',
  'lateEk',
  'salvos',
  'targetNow',
  'firstDetect',
  'firstEffect',
  'detectToEffect',
  'minWarning',
]

/** Tiles a kpi-tiles widget shows when nothing else is chosen: the first six keys. */
export const DEFAULT_KPI_TILES: readonly KpiKey[] = KPI_KEYS.slice(0, 6)

/** Series a time-series widget shows when nothing else is chosen. */
export const DEFAULT_TIME_SERIES_IDS: readonly string[] = [
  'kpi.expectedKills',
  'kpi.leakerShips',
  'kpi.detected',
]

/** Named series set for a time-series widget, resolved by the widget itself. */
export type TimeSeriesPreset = 'sensors' | 'effectors' | 'threat'

/** Which systems a system-status widget lists. */
export type SystemStatusKind = 'sensor' | 'effector' | 'all'

/**
 * One widget in a lens stack. `params` is per type and is never validated
 * beyond "is an object": a widget reads its own params defensively.
 *
 * | type | params | default |
 * | --- | --- | --- |
 * | `kpi-tiles` | `{ tiles: KpiKey[] }` | `{ tiles: [...DEFAULT_KPI_TILES] }` |
 * | `time-series` | `{ seriesIds: string[] }` (ids from `kpiSeries`, `kpi.<LiveKpis key>`) or `{ preset: TimeSeriesPreset }` | `{ seriesIds: [...DEFAULT_TIME_SERIES_IDS] }` |
 * | `system-status` | `{ kind: SystemStatusKind }` | `{ kind: 'all' }` |
 * | `threat-picture` | `{ expanded: boolean }` | `{ expanded: false }` |
 * | `requirement-gates` | `{ gates: string[] }`, ids `detect`, `track`, `identify`, `target`, `engage`, `effect`; absent or empty = all | `{}` |
 * | every other type | `{}` | `{}` |
 */
export interface WidgetInstance {
  id: string
  type: WidgetType
  params: Record<string, unknown>
  collapsed: boolean
}

/** The widget stack on screen and the lens id it came from. */
interface AnalysisLayout {
  presetId: string
  widgets: WidgetInstance[]
}

/** A named widget stack. Builtin presets ship with the app and are never persisted. */
interface LensPreset {
  id: string
  label: string
  builtin: boolean
  widgets: WidgetInstance[]
}

/** The lens id a fresh view and every fallback lands on. */
const DEFAULT_PRESET_ID = 'run-summary'

function widget(
  id: string,
  type: WidgetType,
  params: Record<string, unknown> = {},
): WidgetInstance {
  return { id, type, params, collapsed: false }
}

/**
 * The five built-in lenses in bar order. Widget ids are stable by design, so
 * applying a preset is a pure replace and never renumbers anything.
 */
export const BUILTIN_LENSES: LensPreset[] = [
  {
    id: 'run-summary',
    label: 'Run summary',
    builtin: true,
    widgets: [
      widget('rs-kpi', 'kpi-tiles', { tiles: [...DEFAULT_KPI_TILES] }),
      widget('rs-series', 'time-series', { seriesIds: [...DEFAULT_TIME_SERIES_IDS] }),
      widget('rs-threats', 'threat-picture', { expanded: false }),
      widget('rs-projection', 'projection'),
      widget('rs-validity', 'run-validity'),
    ],
  },
  {
    id: 'sensors',
    label: 'Sensors',
    builtin: true,
    widgets: [
      widget('se-kpi', 'kpi-tiles', {
        tiles: ['detect', 'trackNow', 'firstDetect', 'minWarning'],
      }),
      widget('se-series', 'time-series', { preset: 'sensors' }),
      widget('se-systems', 'system-status', { kind: 'sensor' }),
      widget('se-gates', 'requirement-gates', { gates: ['detect', 'track', 'identify'] }),
    ],
  },
  {
    id: 'effectors',
    label: 'Effectors',
    builtin: true,
    widgets: [
      widget('ef-kpi', 'kpi-tiles', { tiles: ['engaged', 'salvos', 'killEk', 'lateEk'] }),
      widget('ef-series', 'time-series', { preset: 'effectors' }),
      widget('ef-systems', 'system-status', { kind: 'effector' }),
      widget('ef-doctrine', 'fire-doctrine'),
      widget('ef-ledger', 'event-ledger'),
    ],
  },
  {
    id: 'iads',
    label: 'System of systems',
    builtin: true,
    widgets: [
      widget('sos-kpi', 'kpi-tiles', {
        tiles: ['firstDetect', 'firstEffect', 'detectToEffect', 'minWarning'],
      }),
      widget('sos-lanes', 'engagement-lanes'),
      widget('sos-systems', 'system-status', { kind: 'all' }),
      widget('sos-doctrine', 'fire-doctrine'),
      widget('sos-gates', 'requirement-gates'),
      widget('sos-sensitivity', 'sensitivity'),
    ],
  },
  {
    id: 'threat',
    label: 'Threat',
    builtin: true,
    widgets: [
      widget('th-threats', 'threat-picture', { expanded: true }),
      widget('th-series', 'time-series', { preset: 'threat' }),
      widget('th-projection', 'projection'),
      widget('th-sensitivity', 'sensitivity'),
      widget('th-environment', 'environment'),
    ],
  },
]

/** The whole analysis view: the live stack plus the user's saved lenses. */
export interface AnalysisViewState {
  layout: AnalysisLayout
  userPresets: LensPreset[]
}

/** Params a new widget of this type starts with. */
export function defaultWidgetParams(type: WidgetType): Record<string, unknown> {
  switch (type) {
    case 'kpi-tiles':
      return { tiles: [...DEFAULT_KPI_TILES] }
    case 'time-series':
      return { seriesIds: [...DEFAULT_TIME_SERIES_IDS] }
    case 'system-status':
      return { kind: 'all' }
    case 'threat-picture':
      return { expanded: false }
    default:
      return {}
  }
}

// Array values are copied too, so editing a tile list in the live stack can
// never reach the builtin preset it came from.
function copyParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    out[key] = Array.isArray(value) ? [...value] : value
  }
  return out
}

function copyWidgets(widgets: WidgetInstance[]): WidgetInstance[] {
  return widgets.map((w) => ({ ...w, params: copyParams(w.params) }))
}

function isBuiltinId(id: string): boolean {
  return BUILTIN_LENSES.some((p) => p.id === id)
}

/** A fresh view: the run-summary stack and no user presets. */
export function defaultAnalysisView(): AnalysisViewState {
  const preset = BUILTIN_LENSES.find((p) => p.id === DEFAULT_PRESET_ID)!
  return { layout: { presetId: preset.id, widgets: copyWidgets(preset.widgets) }, userPresets: [] }
}

/** Lens by id: the builtins first, then the user presets. */
export function presetById(state: AnalysisViewState, id: string): LensPreset | undefined {
  return BUILTIN_LENSES.find((p) => p.id === id) ?? state.userPresets.find((p) => p.id === id)
}

/**
 * Replace the live stack with a lens. An unknown id falls back to run-summary.
 * Always a new object: re-applying the active lens is how the user discards
 * collapse flags and widget edits.
 */
export function applyPreset(state: AnalysisViewState, presetId: string): AnalysisViewState {
  const preset = presetById(state, presetId) ?? presetById(state, DEFAULT_PRESET_ID)!
  return {
    ...state,
    layout: { presetId: preset.id, widgets: copyWidgets(preset.widgets) },
  }
}

/** Append a widget to the live stack. The lens id does not change. */
export function addWidget(
  state: AnalysisViewState,
  type: WidgetType,
  params?: Record<string, unknown>,
): AnalysisViewState {
  const next: WidgetInstance = {
    id: newId('w'),
    type,
    params: params ?? defaultWidgetParams(type),
    collapsed: false,
  }
  return { ...state, layout: { ...state.layout, widgets: [...state.layout.widgets, next] } }
}

/** Drop one widget. An unknown id returns the same state. */
export function removeWidget(state: AnalysisViewState, id: string): AnalysisViewState {
  const widgets = state.layout.widgets.filter((w) => w.id !== id)
  if (widgets.length === state.layout.widgets.length) return state
  return { ...state, layout: { ...state.layout, widgets } }
}

/** Move one widget. `toIndex` is clamped; an unknown id or no move returns the same state. */
export function moveWidget(
  state: AnalysisViewState,
  id: string,
  toIndex: number,
): AnalysisViewState {
  const from = state.layout.widgets.findIndex((w) => w.id === id)
  if (from < 0) return state
  const to = Math.min(Math.max(toIndex, 0), state.layout.widgets.length - 1)
  if (to === from) return state
  const widgets = [...state.layout.widgets]
  const [moved] = widgets.splice(from, 1)
  widgets.splice(to, 0, moved)
  return { ...state, layout: { ...state.layout, widgets } }
}

/** Collapse or expand one widget. An unknown id returns the same state. */
export function toggleCollapsed(state: AnalysisViewState, id: string): AnalysisViewState {
  if (!state.layout.widgets.some((w) => w.id === id)) return state
  const widgets = state.layout.widgets.map((w) =>
    w.id === id ? { ...w, collapsed: !w.collapsed } : w,
  )
  return { ...state, layout: { ...state.layout, widgets } }
}

/** Replace one widget's whole params object. An unknown id returns the same state. */
export function setWidgetParams(
  state: AnalysisViewState,
  id: string,
  params: Record<string, unknown>,
): AnalysisViewState {
  if (!state.layout.widgets.some((w) => w.id === id)) return state
  const widgets = state.layout.widgets.map((w) => (w.id === id ? { ...w, params } : w))
  return { ...state, layout: { ...state.layout, widgets } }
}

/**
 * Save the live stack as a user lens. An empty label returns the same state.
 * A preset with the same trimmed label is replaced in place, so saving twice
 * under one name updates the lens instead of making a second one.
 */
export function saveAsPreset(state: AnalysisViewState, label: string): AnalysisViewState {
  const trimmed = label.trim()
  if (trimmed === '') return state
  const widgets = copyWidgets(state.layout.widgets)
  const existing = state.userPresets.find((p) => p.label === trimmed)
  const preset: LensPreset = existing
    ? { ...existing, widgets }
    : { id: newId('lens'), label: trimmed, builtin: false, widgets }
  const userPresets = existing
    ? state.userPresets.map((p) => (p.id === existing.id ? preset : p))
    : [...state.userPresets, preset]
  return { layout: { ...state.layout, presetId: preset.id }, userPresets }
}

/**
 * Delete a user lens. A builtin id or an unknown id returns the same state.
 * Deleting the active lens falls back to run-summary.
 */
export function deletePreset(state: AnalysisViewState, id: string): AnalysisViewState {
  if (isBuiltinId(id)) return state
  if (!state.userPresets.some((p) => p.id === id)) return state
  const next: AnalysisViewState = {
    ...state,
    userPresets: state.userPresets.filter((p) => p.id !== id),
  }
  if (state.layout.presetId !== id) return next
  return { ...next, layout: applyPreset(next, DEFAULT_PRESET_ID).layout }
}

function sanitizeWidgets(raw: unknown): WidgetInstance[] {
  if (!Array.isArray(raw)) return []
  const out: WidgetInstance[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { id, type, params, collapsed } = item as Record<string, unknown>
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue
    if (!WIDGET_TYPES.includes(type as WidgetType)) continue
    seen.add(id)
    const object = params != null && typeof params === 'object' && !Array.isArray(params)
    out.push({
      id,
      type: type as WidgetType,
      params: object ? (params as Record<string, unknown>) : {},
      collapsed: collapsed === true,
    })
  }
  return out
}

function sanitizePresets(raw: unknown): LensPreset[] {
  if (!Array.isArray(raw)) return []
  const out: LensPreset[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { id, label, widgets } = item as Record<string, unknown>
    if (typeof id !== 'string' || id === '' || isBuiltinId(id)) continue
    if (typeof label !== 'string' || label === '') continue
    const kept = sanitizeWidgets(widgets)
    if (kept.length === 0) continue
    out.push({ id, label, builtin: false, widgets: kept })
  }
  return out
}

/**
 * Validated view state from a persisted record. A widget with an unknown type,
 * a preset with no widgets left, or a layout that names no known lens is
 * dropped, and the layout then falls back to the default view.
 */
export function sanitizeAnalysisView(raw: unknown): AnalysisViewState {
  if (!raw || typeof raw !== 'object') return defaultAnalysisView()
  const record = raw as Record<string, unknown>
  const userPresets = sanitizePresets(record.userPresets)
  const fallback = defaultAnalysisView().layout
  const rawLayout = record.layout
  if (!rawLayout || typeof rawLayout !== 'object') return { layout: fallback, userPresets }
  const { presetId, widgets } = rawLayout as Record<string, unknown>
  const known =
    typeof presetId === 'string' &&
    (isBuiltinId(presetId) || userPresets.some((p) => p.id === presetId))
  const kept = sanitizeWidgets(widgets)
  if (!known || kept.length === 0) return { layout: fallback, userPresets }
  return { layout: { presetId: presetId as string, widgets: kept }, userPresets }
}

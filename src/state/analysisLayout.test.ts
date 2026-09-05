import { describe, expect, it } from 'vitest'
import {
  addWidget,
  applyPreset,
  BUILTIN_LENSES,
  defaultAnalysisView,
  defaultWidgetParams,
  deletePreset,
  DEFAULT_KPI_TILES,
  KPI_KEYS,
  moveWidget,
  presetById,
  removeWidget,
  sanitizeAnalysisView,
  saveAsPreset,
  setWidgetParams,
  toggleCollapsed,
  WIDGET_TYPES,
} from './analysisLayout'
import type { AnalysisViewState, KpiKey } from './analysisLayout'

/** A view with one saved user lens, built the way the store builds one. */
function withUserPreset(label = 'My lens'): AnalysisViewState {
  return saveAsPreset(applyPreset(defaultAnalysisView(), 'sensors'), label)
}

describe('builtin lenses', () => {
  it('lists the five lenses in bar order', () => {
    expect(BUILTIN_LENSES.map((p) => p.id)).toEqual([
      'run-summary',
      'sensors',
      'effectors',
      'iads',
      'threat',
    ])
    expect(BUILTIN_LENSES.every((p) => p.builtin)).toBe(true)
    expect(BUILTIN_LENSES.every((p) => p.label.length > 0)).toBe(true)
  })

  it('uses only known widget types, known kpi keys, and unique widget ids', () => {
    for (const preset of BUILTIN_LENSES) {
      const ids = preset.widgets.map((w) => w.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const w of preset.widgets) {
        expect(WIDGET_TYPES).toContain(w.type)
        expect(w.collapsed).toBe(false)
        if (w.type !== 'kpi-tiles') continue
        const tiles = w.params.tiles as KpiKey[]
        expect(tiles.length).toBeGreaterThan(0)
        for (const key of tiles) expect(KPI_KEYS).toContain(key)
      }
    }
  })

  it('places the sensitivity widget in the threat and system-of-systems lenses', () => {
    const threat = BUILTIN_LENSES.find((p) => p.id === 'threat')!
    expect(threat.widgets.map((w) => w.id)).toEqual([
      'th-threats',
      'th-series',
      'th-projection',
      'th-sensitivity',
      'th-environment',
    ])
    const iads = BUILTIN_LENSES.find((p) => p.id === 'iads')!
    expect(iads.widgets.map((w) => w.id)).toEqual([
      'sos-kpi',
      'sos-lanes',
      'sos-systems',
      'sos-doctrine',
      'sos-gates',
      'sos-sensitivity',
    ])
    for (const id of ['th-sensitivity', 'sos-sensitivity']) {
      const all = BUILTIN_LENSES.flatMap((p) => p.widgets)
      expect(all.find((w) => w.id === id)?.type).toBe('sensitivity')
    }
  })

  it('lists sensitivity last in the widget catalog and gives it no params', () => {
    expect(WIDGET_TYPES[WIDGET_TYPES.length - 1]).toBe('sensitivity')
    expect(new Set(WIDGET_TYPES).size).toBe(WIDGET_TYPES.length)
    expect(defaultWidgetParams('sensitivity')).toEqual({})
  })

  it('opens on run-summary with the six default tiles', () => {
    const view = defaultAnalysisView()
    expect(view.layout.presetId).toBe('run-summary')
    expect(view.userPresets).toEqual([])
    expect(view.layout.widgets.map((w) => w.type)).toEqual([
      'kpi-tiles',
      'time-series',
      'threat-picture',
      'projection',
      'run-validity',
    ])
    expect(view.layout.widgets[0].params.tiles).toEqual([...DEFAULT_KPI_TILES])
  })
})

describe('applyPreset', () => {
  it('replaces the whole stack and keeps the lens id', () => {
    const view = applyPreset(defaultAnalysisView(), 'effectors')
    expect(view.layout.presetId).toBe('effectors')
    expect(view.layout.widgets.map((w) => w.id)).toEqual([
      'ef-kpi',
      'ef-series',
      'ef-systems',
      'ef-doctrine',
      'ef-ledger',
    ])
  })

  it('falls back to run-summary on an unknown id', () => {
    expect(applyPreset(defaultAnalysisView(), 'nope').layout.presetId).toBe('run-summary')
  })

  it('returns fresh widget objects, so an edit never reaches the builtin', () => {
    const view = applyPreset(defaultAnalysisView(), 'sensors')
    const source = BUILTIN_LENSES.find((p) => p.id === 'sensors')!
    view.layout.widgets[0].collapsed = true
    ;(view.layout.widgets[0].params.tiles as string[]).push('killEk')
    expect(source.widgets[0].collapsed).toBe(false)
    expect(source.widgets[0].params.tiles).toEqual(['detect', 'trackNow', 'firstDetect', 'minWarning'])
  })

  it('re-applying the active lens discards collapse flags and edits', () => {
    const edited = toggleCollapsed(defaultAnalysisView(), 'rs-kpi')
    expect(edited.layout.widgets[0].collapsed).toBe(true)
    const again = applyPreset(edited, 'run-summary')
    expect(again).not.toBe(edited)
    expect(again.layout.widgets[0].collapsed).toBe(false)
  })
})

describe('presetById', () => {
  it('finds a builtin and a user preset, and nothing else', () => {
    const view = withUserPreset()
    expect(presetById(view, 'threat')?.label).toBe('Threat')
    expect(presetById(view, view.userPresets[0].id)?.label).toBe('My lens')
    expect(presetById(view, 'missing')).toBeUndefined()
  })
})

describe('widget reducers', () => {
  it('addWidget appends with default params and keeps the lens id', () => {
    const view = addWidget(defaultAnalysisView(), 'environment')
    const last = view.layout.widgets[view.layout.widgets.length - 1]
    expect(view.layout.widgets).toHaveLength(6)
    expect(view.layout.presetId).toBe('run-summary')
    expect(last.type).toBe('environment')
    expect(last.params).toEqual({})
    expect(last.collapsed).toBe(false)
    const withParams = addWidget(defaultAnalysisView(), 'system-status', { kind: 'sensor' })
    expect(withParams.layout.widgets[5].params).toEqual({ kind: 'sensor' })
  })

  it('removeWidget drops one widget and ignores an unknown id', () => {
    const view = removeWidget(defaultAnalysisView(), 'rs-projection')
    expect(view.layout.widgets.map((w) => w.id)).not.toContain('rs-projection')
    expect(removeWidget(view, 'ghost')).toBe(view)
  })

  it('toggleCollapsed flips one widget and ignores an unknown id', () => {
    const view = toggleCollapsed(defaultAnalysisView(), 'rs-series')
    expect(view.layout.widgets.find((w) => w.id === 'rs-series')!.collapsed).toBe(true)
    expect(toggleCollapsed(view, 'rs-series').layout.widgets[1].collapsed).toBe(false)
    expect(toggleCollapsed(view, 'ghost')).toBe(view)
  })

  it('setWidgetParams replaces the whole params object', () => {
    const view = setWidgetParams(defaultAnalysisView(), 'rs-kpi', { tiles: ['salvos'] })
    expect(view.layout.widgets[0].params).toEqual({ tiles: ['salvos'] })
    expect(setWidgetParams(view, 'ghost', {})).toBe(view)
  })

  it('moveWidget clamps the target index and ignores a no-op move', () => {
    const view = defaultAnalysisView()
    expect(moveWidget(view, 'rs-kpi', 99).layout.widgets.map((w) => w.id)).toEqual([
      'rs-series',
      'rs-threats',
      'rs-projection',
      'rs-validity',
      'rs-kpi',
    ])
    expect(moveWidget(view, 'rs-validity', -5).layout.widgets[0].id).toBe('rs-validity')
    expect(moveWidget(view, 'rs-kpi', 0)).toBe(view)
    expect(moveWidget(view, 'ghost', 1)).toBe(view)
  })

  it('defaultWidgetParams answers per type', () => {
    expect(defaultWidgetParams('kpi-tiles')).toEqual({ tiles: [...DEFAULT_KPI_TILES] })
    expect(defaultWidgetParams('time-series')).toEqual({
      seriesIds: ['kpi.expectedKills', 'kpi.leakerShips', 'kpi.detected'],
    })
    expect(defaultWidgetParams('system-status')).toEqual({ kind: 'all' })
    expect(defaultWidgetParams('threat-picture')).toEqual({ expanded: false })
    expect(defaultWidgetParams('requirement-gates')).toEqual({})
    expect(defaultWidgetParams('event-ledger')).toEqual({})
  })
})

describe('user presets', () => {
  it('saveAsPreset trims the label and makes the new lens active', () => {
    const view = saveAsPreset(applyPreset(defaultAnalysisView(), 'threat'), '  Wide look  ')
    expect(view.userPresets).toHaveLength(1)
    expect(view.userPresets[0].label).toBe('Wide look')
    expect(view.userPresets[0].builtin).toBe(false)
    expect(view.layout.presetId).toBe(view.userPresets[0].id)
  })

  it('saveAsPreset replaces a preset with the same trimmed label in place', () => {
    const first = withUserPreset('Wide look')
    const edited = removeWidget(first, 'se-gates')
    const second = saveAsPreset(edited, 'Wide look ')
    expect(second.userPresets).toHaveLength(1)
    expect(second.userPresets[0].id).toBe(first.userPresets[0].id)
    expect(second.userPresets[0].widgets.map((w) => w.id)).not.toContain('se-gates')
  })

  it('saveAsPreset with an empty label changes nothing', () => {
    const view = defaultAnalysisView()
    expect(saveAsPreset(view, '   ')).toBe(view)
  })

  it('deletePreset refuses a builtin and an unknown id', () => {
    const view = withUserPreset()
    expect(deletePreset(view, 'sensors')).toBe(view)
    expect(deletePreset(view, 'ghost')).toBe(view)
  })

  it('deleting the active user preset falls back to run-summary', () => {
    const view = withUserPreset()
    const after = deletePreset(view, view.userPresets[0].id)
    expect(after.userPresets).toEqual([])
    expect(after.layout.presetId).toBe('run-summary')
    expect(after.layout.widgets[0].id).toBe('rs-kpi')
  })

  it('deleting an inactive user preset keeps the live stack', () => {
    const saved = withUserPreset()
    const view = applyPreset(saved, 'effectors')
    const after = deletePreset(view, saved.userPresets[0].id)
    expect(after.userPresets).toEqual([])
    expect(after.layout.presetId).toBe('effectors')
  })
})

describe('sanitizeAnalysisView', () => {
  it('round-trips a state with a user preset through JSON', () => {
    const view = withUserPreset()
    expect(sanitizeAnalysisView(JSON.parse(JSON.stringify(view)))).toEqual(view)
  })

  it('returns the default view on a non-object', () => {
    const fresh = defaultAnalysisView()
    expect(sanitizeAnalysisView(null)).toEqual(fresh)
    expect(sanitizeAnalysisView('nope')).toEqual(fresh)
    expect(sanitizeAnalysisView(7)).toEqual(fresh)
  })

  it('drops a widget with an unknown type, a bad id, or a duplicate id', () => {
    const view = sanitizeAnalysisView({
      layout: {
        presetId: 'run-summary',
        widgets: [
          { id: 'a', type: 'kpi-tiles', params: { tiles: ['detect'] }, collapsed: true },
          { id: 'b', type: 'bogus', params: {}, collapsed: false },
          { id: '', type: 'projection', params: {}, collapsed: false },
          { id: 'a', type: 'projection', params: {}, collapsed: false },
          { id: 'c', type: 'projection', params: [1], collapsed: 'yes' },
        ],
      },
      userPresets: [],
    })
    expect(view.layout.widgets).toEqual([
      { id: 'a', type: 'kpi-tiles', params: { tiles: ['detect'] }, collapsed: true },
      { id: 'c', type: 'projection', params: {}, collapsed: false },
    ])
  })

  it('drops a preset with no surviving widget, a builtin id, or no label', () => {
    const view = sanitizeAnalysisView({
      layout: { presetId: 'run-summary', widgets: [{ id: 'a', type: 'projection' }] },
      userPresets: [
        { id: 'u1', label: 'Empty', widgets: [{ id: 'x', type: 'bogus' }] },
        { id: 'sensors', label: 'Shadow', widgets: [{ id: 'y', type: 'projection' }] },
        { id: 'u2', label: '', widgets: [{ id: 'z', type: 'projection' }] },
        { id: 'u3', label: 'Keep', widgets: [{ id: 'k', type: 'projection' }], builtin: true },
      ],
    })
    expect(view.userPresets).toHaveLength(1)
    expect(view.userPresets[0].id).toBe('u3')
    expect(view.userPresets[0].builtin).toBe(false)
  })

  it('falls back to the default layout on an unknown preset id or an empty stack', () => {
    const fresh = defaultAnalysisView().layout
    const unknown = sanitizeAnalysisView({
      layout: { presetId: 'gone', widgets: [{ id: 'a', type: 'projection' }] },
      userPresets: [],
    })
    expect(unknown.layout).toEqual(fresh)
    const empty = sanitizeAnalysisView({ layout: { presetId: 'threat', widgets: [] } })
    expect(empty.layout).toEqual(fresh)
    const noLayout = sanitizeAnalysisView({ userPresets: [] })
    expect(noLayout.layout).toEqual(fresh)
  })

  it('keeps a layout that names a surviving user preset', () => {
    const view = sanitizeAnalysisView({
      layout: { presetId: 'u1', widgets: [{ id: 'a', type: 'projection' }] },
      userPresets: [{ id: 'u1', label: 'Mine', widgets: [{ id: 'a', type: 'projection' }] }],
    })
    expect(view.layout.presetId).toBe('u1')
    expect(view.layout.widgets).toHaveLength(1)
  })
})

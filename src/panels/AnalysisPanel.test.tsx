import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { AnalysisPanel } from './AnalysisPanel'
import { emptyScenario } from '../model/seed'
import type { Entity, EntityKind } from '../model/types'
import { useStore } from '../state/store'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<AnalysisPanel />)
}

function widgetTypes(html: string): string[] {
  return [...html.matchAll(/data-widget-type="([a-z-]+)"/g)].map((m) => m[1])
}

/** The markup of one widget: its own section, up to the section that follows it. */
function widgetHtml(html: string, type: string): string {
  const start = html.indexOf(`data-widget-type="${type}"`)
  if (start < 0) return ''
  const next = html.indexOf('<section', start)
  return next < 0 ? html.slice(start) : html.slice(start, next)
}

const RUN_SUMMARY = ['kpi-tiles', 'time-series', 'threat-picture', 'projection', 'run-validity']

describe('AnalysisPanel lenses', () => {
  beforeEach(() => {
    const st = useStore.getState()
    st.replaceScenario(emptyScenario())
    st.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    st.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const uas = useStore.getState().scenario.entities.find((e) => e.kind === 'uas')!
    useStore.getState().beginPath(uas.id)
    useStore.getState().addDraftPoint({ x: 0, y: -100 })
    useStore.getState().finishPath()
    useStore.getState().applyLens('run-summary')
    useStore.getState().setAnalysisCustomize(false)
  })

  it('renders the run-summary widget stack in lens order', () => {
    expect(widgetTypes(render())).toEqual(RUN_SUMMARY)
  })

  it('keeps modeled future results out of the default live view', () => {
    const projection = widgetHtml(render(), 'projection')

    expect(projection).toContain('not live')
    expect(projection).toContain('conditional')
    expect(projection).toContain('Projected threat outcome')
    // The projected threat picture sits behind a closed disclosure, so a
    // future result never renders beside the live widgets.
    expect(projection).not.toContain('threat-picture"')
    expect(projection).not.toContain('class="tg')
  })

  it('renders the six default KPI tiles', () => {
    const html = render()
    expect(html).toContain('Detect')
    expect(html).toContain('Track now')
    expect(html).toContain('ID / class')
    expect(html).toContain('Engaged')
    // The two expectation tiles carry a bracketed symbol; the case is the widget's.
    expect(html).toMatch(/Kill E\[k\]/i)
    expect(html).toMatch(/Leak E\[n\]/i)
  })

  it('puts the ROE control in the fire-doctrine widget of the effectors lens', () => {
    useStore.getState().applyLens('effectors')
    const html = render()

    expect(widgetTypes(html)).toEqual([
      'kpi-tiles',
      'time-series',
      'system-status',
      'fire-doctrine',
      'event-ledger',
    ])
    expect(widgetHtml(html, 'fire-doctrine')).toContain('data-role="roe"')
    const head = html.slice(0, html.indexOf('<section'))
    expect(head).not.toContain('data-role="roe"')
    expect(html).not.toContain('analysis-header')
  })

  it('keeps the ROE control out of a lens without the fire-doctrine widget', () => {
    useStore.getState().applyLens('effectors')
    useStore.getState().applyLens('run-summary')

    expect(render()).not.toContain('data-role="roe"')
  })

  it('shows the add and save rows in customize mode only', () => {
    expect(render()).not.toContain('Add widget')

    useStore.getState().setAnalysisCustomize(true)
    const html = render()
    const add = html.slice(html.indexOf('class="add"'), html.indexOf('class="save"'))
    expect(html).toContain('Add widget')
    expect(add.match(/<button/g)?.length).toBe(12)
    expect(html).toContain('Save as preset')

    useStore.getState().setAnalysisCustomize(false)
    const off = render()
    expect(off).not.toContain('Add widget')
    expect(off).not.toContain('Save as preset')
  })
})

function idOf(kind: EntityKind): string {
  const entity = useStore.getState().scenario.entities.find((e: Entity) => e.kind === kind)
  if (!entity) throw new Error(`no ${kind} placed`)
  return entity.id
}

describe('AnalysisPanel selection detail', () => {
  beforeEach(() => {
    const store = useStore.getState()
    store.replaceScenario(emptyScenario())
    store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    store.addEntityFromModel('lib-coyote', { x: 1697, y: -1697 })
    store.addEntityFromModel('lib-faadc2', { x: -500, y: 0 })
    store.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const uas = idOf('uas')
    useStore.getState().beginPath(uas)
    useStore.getState().addDraftPoint({ x: 0, y: -100 })
    useStore.getState().finishPath()
    useStore.getState().applyLens('run-summary')
    useStore.getState().setAnalysisCustomize(false)
    useStore.getState().clearSelection()
  })

  it('replaces the widget stack with the sensor detail and keeps the run header', () => {
    useStore.getState().select({ entityIds: [idOf('sensor')] })
    const html = render()

    expect(html).toContain('data-detail="sensor"')
    expect(html).not.toContain('class="lens')
    expect(html).not.toContain('data-widget-type')
    expect(html).toContain('live-strip')
  })

  it('renders the pane of the effector, the C2 and the threat', () => {
    useStore.getState().select({ entityIds: [idOf('effector')] })
    expect(render()).toContain('data-detail="effector"')

    useStore.getState().select({ entityIds: [idOf('c2')] })
    expect(render()).toContain('data-detail="system"')

    useStore.getState().select({ entityIds: [idOf('uas')] })
    expect(render()).toContain('data-detail="threat"')
  })

  it('returns the widget stack when the selection is cleared', () => {
    useStore.getState().select({ entityIds: [idOf('sensor')] })
    expect(render()).toContain('data-detail="sensor"')

    useStore.getState().clearSelection()
    const html = render()
    expect(widgetTypes(html)).toEqual(RUN_SUMMARY)
    expect(html).not.toContain('data-detail')
  })

  it('keeps the stack and adds one note for two selected entities', () => {
    useStore.getState().select({ entityIds: [idOf('sensor'), idOf('effector')] })
    const html = render()

    expect(widgetTypes(html)).toEqual(RUN_SUMMARY)
    expect(html).toContain('2 entities selected')
    expect(html).not.toContain('data-detail')
  })

  it('shows the note for a placed system, never a pane', () => {
    const sensor = idOf('sensor')
    const effector = idOf('effector')
    const entities = useStore
      .getState()
      .scenario.entities.map((e) =>
        e.id === sensor || e.id === effector ? { ...e, systemId: 'sys-1' } : e,
      )
    useStore.getState().patchScenario({ entities })
    useStore.getState().selectSystem('sys-1')
    const html = render()

    expect(html).toContain('2 entities selected')
    expect(html).not.toContain('data-detail')
    expect(widgetTypes(html)).toEqual(RUN_SUMMARY)
  })

  it('never moves the preset id or the undo history on a selection', () => {
    useStore.getState().applyLens('sensors')
    const past = useStore.getState().past.length

    useStore.getState().select({ entityIds: [idOf('sensor')] })
    expect(render()).toContain('data-detail="sensor"')
    expect(useStore.getState().ui.analysis.layout.presetId).toBe('sensors')

    useStore.getState().clearSelection()
    expect(useStore.getState().ui.analysis.layout.presetId).toBe('sensors')
    expect(useStore.getState().past.length).toBe(past)
  })

  it('keeps the widget stack for an entity kind with no pane', () => {
    useStore.getState().addEntityFromModel('lib-asset', { x: 200, y: 200 })
    useStore.getState().select({ entityIds: [idOf('asset')] })
    const html = render()

    expect(widgetTypes(html)).toEqual(RUN_SUMMARY)
    expect(html).not.toContain('data-detail')
  })
})

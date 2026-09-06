import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AnalysisPanel } from './AnalysisPanel'
import { emptyScenario } from '../model/seed'
import type { Entity, EntityKind } from '../model/types'
import { BUILTIN_LENSES } from '../state/analysisLayout'
import { useStore } from '../state/store'
import { selectDurationS } from '../state/selectors'
import { engagementPicture } from '../analysis/impact'
import { OutcomeSummary } from './analysis/OutcomeSummary'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(props?: ComponentProps<typeof AnalysisPanel>): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<AnalysisPanel {...props} />)
}

function widgetTypes(html: string): string[] {
  return [...html.matchAll(/data-widget-type="([a-z-]+)"/g)].map((m) => m[1])
}

/** The markup of one widget: its own section, up to the section that follows it. */
function widgetHtml(html: string, type: string): string {
  const start = html.indexOf(`data-widget-type="${type}"`)
  if (start < 0) return ''
  const next = html.indexOf('data-widget-type=', start + 1)
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

  it('leads Analyze with full-run validity and outcomes without editing the saved layout or run', () => {
    const state = useStore.getState()
    const html = render({ phase: 'analyze', showDetail: false })
    expect(widgetTypes(html)).toEqual(['run-validity', 'projection', 'time-series', 'kpi-tiles', 'threat-picture'])
    expect(html).toContain('Full-run results · entire configured duration')
    expect(html).toContain('<summary>Cursor-scoped supplemental data</summary>')
    expect(html.indexOf('data-widget-type="run-validity"')).toBeLessThan(html.indexOf('class="outcome-summary"'))
    expect(html.indexOf('class="outcome-summary"')).toBeLessThan(html.indexOf('Cursor-scoped supplemental data'))
    expect(html).toContain('First detect')
    expect(html).toContain('First effect')
    expect(html).toContain('Min warning')
    const { assessments, report } = engagementPicture(state.scenario)
    expect(html).toContain(renderToStaticMarkup(
      <OutcomeSummary scenario={state.scenario} assessments={assessments} report={report} />,
    ))
    expect(useStore.getState().ui.analysis).toBe(state.ui.analysis)
    expect(useStore.getState().playback).toBe(state.playback)
    expect(useStore.getState().scenario).toBe(state.scenario)
    expect(useStore.getState().mc).toBe(state.mc)
  })

  it('preserves custom widget order and user presets in Analyze', () => {
    useStore.getState().moveAnalysisWidget('rs-projection', 0)
    const moved = useStore.getState().ui.analysis.layout.widgets.map((widget) => widget.type)
    expect(widgetTypes(render({ phase: 'analyze' }))).toEqual(moved)
    useStore.getState().saveAnalysisPreset('My order')
    expect(widgetTypes(render({ phase: 'analyze' }))).toEqual(moved)
    expect(render({ phase: 'analyze' })).not.toContain('Cursor-scoped supplemental data')
  })

  it('preserves authored order while customizing the built-in Run summary', () => {
    useStore.getState().setAnalysisCustomize(true)
    expect(widgetTypes(render({ phase: 'analyze' }))).toEqual(RUN_SUMMARY)
  })

  it('keeps completed products compact without duplicating the outcome or full validity', () => {
    const state = useStore.getState()
    const durationS = selectDurationS(state)
    useStore.setState({ playback: {
      ...state.playback, phase: 'complete', startedAtMs: 1000, completedAtMs: 2000,
      observedThroughS: durationS,
    } })
    const html = render({ phase: 'analyze', showDetail: false })
    expect(html.match(/class="outcome-summary"/g)).toHaveLength(1)
    expect(html).toContain('<details class="debrief-record evidence-products">')
    expect(html).toContain('Export debrief JSON')
    expect(html).toContain('Capture final PNG')
    expect(html).toContain('New clean run')
    expect(html).toContain('Full-run system and component record')
    expect(html).toContain('Full-run threat record')
    expect(html).toContain('Full-run engagement event ledger')
    expect(html).not.toContain('class="run-validity validity-')

    useStore.getState().applyLens('sensors')
    const sensors = render({ phase: 'analyze', showDetail: false })
    expect(sensors).not.toContain('class="outcome-summary"')
    expect(sensors).toContain('class="run-validity validity-')
    expect(sensors).toContain('Full-run system and component record')
  })

  it('routes production input controls to Prepare while standalone editing remains available', () => {
    useStore.getState().applyLens('effectors')
    const html = render({ phase: 'analyze', onOpenPreparation: () => {} })
    expect(html).toContain('Edit run settings in Prepare')
    expect(html).not.toContain('data-role="roe"')
    expect(render()).toContain('data-role="roe"')
  })

  it('renders the five built-in lenses as one roving tablist', () => {
    const html = render()
    const tablist = html.slice(
      html.indexOf('class="lens-builtins"'),
      html.indexOf('class="lens-layout"'),
    )

    expect(tablist).toContain('role="tablist"')
    expect(tablist.match(/role="tab"/g)?.length).toBe(BUILTIN_LENSES.length)
    for (const preset of BUILTIN_LENSES) expect(tablist).toContain(`>${preset.label}</button>`)
    expect(tablist.match(/tabindex="0"/g)?.length).toBe(1)
    expect(tablist.match(/tabindex="-1"/g)?.length).toBe(BUILTIN_LENSES.length - 1)
  })

  it('marks the active built-in lens as the single selected and tabbable tab', () => {
    useStore.getState().applyLens('effectors')
    const html = render()
    const active = html.match(/<button[^>]*aria-selected="true"[^>]*>Effectors<\/button>/)?.[0]

    expect(active).toContain('tabindex="0"')
    expect(html.match(/aria-selected="true"/g)?.length).toBe(1)
  })

  it('keeps layout editing behind the dedicated Layout surface', () => {
    useStore.getState().saveAnalysisPreset('Wide look')
    useStore.getState().setAnalysisCustomize(true)
    const html = render()
    expect(html).toContain('lens-layout-trigger')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('Add widget')
    expect(html).not.toContain('Save as preset')
    expect(html).not.toContain('Delete Wide look preset')
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

  it('keeps widget move and remove controls in customize mode', () => {
    expect(render()).not.toContain('aria-label="Move KPI tiles up"')
    useStore.getState().setAnalysisCustomize(true)
    const html = render()
    expect(html).toContain('aria-label="Move KPI tiles up"')
    expect(html).toContain('aria-label="Move KPI tiles down"')
    expect(html).toContain('aria-label="Remove KPI tiles"')
    expect(html).not.toContain('Add widget')
    expect(html).not.toContain('Save as preset')
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

  it('keeps the five-lens navigation above selected entity detail', () => {
    useStore.getState().select({ entityIds: [idOf('sensor')] })
    const html = render()

    expect(html).toContain('data-detail="sensor"')
    expect(html.match(/role="tab"/g)?.length).toBe(BUILTIN_LENSES.length)
    expect(html).not.toContain('data-widget-type')
    expect(html).toContain('live-strip')
  })

  it('lets an owner hide navigation and detail independently', () => {
    useStore.getState().select({ entityIds: [idOf('sensor')] })
    const html = render({ showNavigation: false, showDetail: false })

    expect(html).not.toContain('class="lens')
    expect(html).not.toContain('data-detail')
    expect(widgetTypes(html)).toEqual(RUN_SUMMARY)
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

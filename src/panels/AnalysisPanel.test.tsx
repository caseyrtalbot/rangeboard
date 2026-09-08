import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AnalysisPanel } from './AnalysisPanel'
import { emptyScenario } from '../model/seed'
import type { Entity, EntityKind } from '../model/types'
import { useStore } from '../state/store'
import { selectDurationS } from '../state/selectors'
import { engagementPicture } from '../analysis/impact'
import { OutcomeSummary } from './analysis/OutcomeSummary'
import { installTrial, observeTrial } from './analysis/widgets/trialTestState'
import { runReplicates } from '../playback/mcRun'
import { DEFAULT_KPI_TILES } from '../state/analysisLayout'
import { TRIAL_KPI_LABELS } from './analysis/widgets/labels'

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

  it('leads Analyze with trial results, separate Forecast and Monte Carlo without editing the saved layout or run', () => {
    const state = useStore.getState()
    const html = render({ phase: 'analyze' })
    expect(widgetTypes(html)).toEqual(['kpi-tiles', 'time-series', 'threat-picture', 'run-validity', 'projection'])
    expect(html).toContain('aria-label="Trial results"')
    expect(html).toContain('aria-label="Forecast"')
    expect(html).toContain('<summary>Monte Carlo</summary>')
    expect(html).toContain('<summary>Trial cursor telemetry</summary>')
    expect(html.indexOf('data-widget-type="run-validity"')).toBeLessThan(html.indexOf('class="outcome-summary"'))
    expect(html.indexOf('aria-label="Trial results"')).toBeLessThan(html.indexOf('aria-label="Forecast"'))
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

  it('keeps ensemble means and intervals in Monte Carlo while Forecast stays deterministic', () => {
    const { scenario } = installTrial(3)
    const summary = runReplicates({ ...scenario, replicates: 2 })
    const mc = { ...summary, kills: { ...summary.kills, mean: summary.kills.mean.map(() => 123) } }
    const state = useStore.getState()
    useStore.setState({ mc: { ...state.mc, status: 'done', runId: state.playback.runId, summary: mc } })
    const html = render({ phase: 'analyze' })
    const forecast = html.slice(html.indexOf('aria-label="Forecast"'), html.indexOf('aria-label="Monte Carlo"'))
    const picture = engagementPicture(scenario)
    expect(forecast).toContain(renderToStaticMarkup(<OutcomeSummary scenario={scenario} assessments={picture.assessments} report={picture.report} />))
    expect(forecast).not.toContain('MC mean')
    const ensemble = html.slice(html.indexOf('aria-label="Monte Carlo"'))
    expect(ensemble).toContain('Mean kills · 123')
    expect(ensemble).toContain('95% mean CI')
    expect(ensemble).toContain('95% Wilson')
    expect(ensemble).toContain('n=2')
    useStore.setState({ mc: { ...useStore.getState().mc, status: 'stale' } })
    expect(render({ phase: 'analyze' })).toContain('No current ensemble result.')
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
    installTrial()
    const state = useStore.getState()
    const durationS = selectDurationS(state)
    useStore.setState({ playback: {
      ...state.playback, phase: 'complete', startedAtMs: 1000, completedAtMs: 2000,
      observedThroughS: durationS,
    } })
    const html = render({ phase: 'analyze' })
    expect(html.match(/class="outcome-summary"/g)).toHaveLength(1)
    expect(html).toContain('<details class="debrief-record evidence-products" open="">')
    expect(html).toContain('Export debrief JSON')
    expect(html).toContain('Capture final PNG')
    expect(html).toContain('New clean run')
    expect(html).toContain('Trial system and component record')
    expect(html).toContain('Trial threat record')
    expect(html).toContain('Trial engagement event ledger')
    expect(html).not.toContain('class="run-validity validity-')

    useStore.getState().applyLens('sensors')
    const sensors = render({ phase: 'analyze' })
    expect(sensors).not.toContain('class="outcome-summary"')
    expect(sensors).toContain('class="run-validity validity-')
    expect(sensors).toContain('Trial system and component record')
  })

  it('routes production input controls to Prepare while standalone editing remains available', () => {
    useStore.getState().applyLens('effectors')
    const html = render({ phase: 'analyze', onOpenPreparation: () => {} })
    expect(html).toContain('Edit fire doctrine in Prepare')
    expect(html).not.toContain('data-role="roe"')
    expect(render()).toContain('data-role="roe"')
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

  it('mounts the default KPI widget with idle text before Play and all six realized tiles when ready', () => {
    const before = useStore.getState().ui.analysis.layout.widgets.find(widget => widget.type === 'kpi-tiles')!
    const idle = widgetHtml(render(), 'kpi-tiles')
    expect(idle).toContain('Simulated trial · ready')
    expect(idle).not.toContain('class="tile"')
    expect(DEFAULT_KPI_TILES).toHaveLength(6)
    installTrial(5)
    const html = widgetHtml(render(), 'kpi-tiles')
    expect(html.match(/class="tile"/g)).toHaveLength(6)
    for (const key of DEFAULT_KPI_TILES) expect(html).toContain(TRIAL_KPI_LABELS[key].label)
    expect(html).toContain('Detect</span><span class="tv">1<small>/3</small>')
    expect(html).toContain('Engaged</span><span class="tv">2<small>/3</small>')
    expect(html).toContain('Pre-arrival defeats</span><span class="tv">3</span>')
    expect(html).toContain('Arrived undefeated</span><span class="tv bad">3</span>')
    expect(html).not.toMatch(/Expected|E\[k\]|E\[n\]/)
    expect(useStore.getState().ui.analysis.layout.widgets.find(widget => widget.type === 'kpi-tiles')).toBe(before)
  })

  it('uses achieved observation for the Analyze summary even when cursor telemetry is rewound', () => {
    const { view } = installTrial(3)
    observeTrial(3, 0)
    const html = render({ phase: 'analyze' })
    const summary = html.slice(html.indexOf('class="trial-summary"'), html.indexOf('Trial cursor telemetry'))
    expect(summary).toContain('T+0:03 observed')
    expect(summary).toContain('Pre-arrival hard kills</span><strong>2</strong>')
    expect(summary).toContain('Late hard kills</span><strong>0</strong>')
    expect(summary).toContain('Arrived undefeated</span><strong>0</strong>')
    observeTrial(view.durationS, 0)
    useStore.setState({ playback: { ...useStore.getState().playback, completedAtMs: 2 } })
    const completed = render({ phase: 'analyze' })
    expect(completed).toContain('Simulated trial · complete')
    expect(completed).toContain('Late hard kills</span><strong>1</strong>')
    expect(completed).toContain('Late mission kills</span><strong>1</strong>')
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

  it('keeps the stack and adds one note for two selected entities', () => {
    useStore.getState().select({ entityIds: [idOf('sensor'), idOf('effector')] })
    const html = render()

    expect(widgetTypes(html)).toEqual(RUN_SUMMARY)
    expect(html).toContain('2 entities selected')
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
    expect(widgetTypes(html)).toEqual(RUN_SUMMARY)
  })

  it('keeps the widget stack for an entity kind with no pane', () => {
    useStore.getState().addEntityFromModel('lib-asset', { x: 200, y: 200 })
    useStore.getState().select({ entityIds: [idOf('asset')] })
    const html = render()

    expect(widgetTypes(html)).toEqual(RUN_SUMMARY)
  })
})


describe('Execute analysis visibility', () => {
  beforeEach(() => {
    const st = useStore.getState()
    st.replaceScenario(emptyScenario())
    st.applyLens('run-summary')
    st.setAnalysisCustomize(false)
    st.setBoardPhase('execute')
  })
  afterEach(() => useStore.getState().setBoardPhase('prepare'))

  it('replaces forecast bodies while preserving widget order, collapse and customize controls', () => {
    const st = useStore.getState()
    st.addAnalysisWidget('requirement-gates')
    st.addAnalysisWidget('sensitivity')
    st.addAnalysisWidget('environment')
    st.addAnalysisWidget('fire-doctrine')
    st.setAnalysisCustomize(true)
    const before = useStore.getState().ui.analysis
    const html = render({ phase: 'execute' })
    expect(widgetTypes(html)).toEqual(before.layout.widgets.map((w) => w.type))
    for (const type of ['projection', 'requirement-gates', 'sensitivity']) {
      expect(widgetHtml(html, type)).toContain('Forecast available in Analyze')
    }
    for (const type of ['run-validity', 'environment', 'fire-doctrine']) {
      expect(widgetHtml(html, type)).not.toContain('Forecast available in Analyze')
    }
    expect(html).toContain('aria-label="Remove Full-run projection"')
    expect(html).toContain('aria-label="Move Full-run projection up"')
    expect(html).not.toContain('class="outcome-summary"')
    expect(html).toContain('Execution view · outcomes through the observed horizon. Forecast widgets open in Analyze.')
    expect(html).not.toContain('Full-run time series · playback cursor marker')
    expect(useStore.getState().ui.analysis).toBe(before)
    st.toggleAnalysisWidget('rs-projection')
    expect(widgetHtml(render({ phase: 'execute' }), 'projection')).not.toContain('Forecast available in Analyze')
    st.setBoardPhase('analyze')
    expect(widgetHtml(render({ phase: 'analyze' }), 'projection')).toContain('aria-expanded="false"')
    st.toggleAnalysisWidget('rs-projection')
    expect(widgetHtml(render({ phase: 'analyze' }), 'projection')).toContain('No threats with flight paths.')
  })

  it('mounts completed evidence only when the Execute cursor reaches the full duration', () => {
    installTrial()
    const st = useStore.getState()
    const durationS = selectDurationS(st)
    st.completeRun(durationS)
    expect(render({ phase: 'execute' })).toContain('evidence-products')
    st.scrubTo(0)
    expect(render({ phase: 'execute' })).not.toContain('evidence-products')
    st.setBoardPhase('analyze')
    expect(render({ phase: 'analyze' })).toContain('evidence-products')
    st.resetRun()
    expect(render({ phase: 'analyze' })).not.toContain('evidence-products')
  })
})

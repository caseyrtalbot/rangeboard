import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AnalysisPanel } from './AnalysisPanel'
import { BoardPreparation } from './BoardPreparation'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { installTrial, observeTrial, unstartTrial } from './analysis/widgets/trialTestState'
import { runReplicates } from '../playback/mcRun'

function render(props?: ComponentProps<typeof AnalysisPanel>): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<AnalysisPanel {...props} />)
}

const noTrial = '<p class="muted small">No trial yet. Press Play in Execute to run one.</p>'
const trialScreens = [
  { phase: 'execute', screen: 'now' },
  { phase: 'analyze', screen: 'outcome' },
  { phase: 'analyze', screen: 'compare' },
] as const

describe('AnalysisPanel screens', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().applyLens('run-summary')
    useStore.getState().setAnalysisCustomize(false)
  })

  it('defaults each phase to its first screen and renders Inputs unchanged', () => {
    expect(render({ phase: 'prepare' })).toContain('<h3>Fragility</h3>')
    expect(render({ phase: 'prepare' })).toContain('Monte Carlo · No current ensemble result.')
    const inputs = render({ phase: 'prepare', screen: 'inputs' })
    expect(inputs).toBe(renderToStaticMarkup(<BoardPreparation />))
    installTrial()
    expect(render()).toContain('<h3>Now</h3>')
    expect(render({ phase: 'analyze' })).toContain('<h3>Outcome</h3>')
    expect(render({ phase: 'prepare', screen: 'compare' })).toContain('<h3>Fragility</h3>')
  })

  it.each(trialScreens)('shows only one placeholder before Play in $screen, even with an ensemble', props => {
    const { scenario } = installTrial()
    unstartTrial()
    const state = useStore.getState()
    useStore.setState({ mc: { ...state.mc, status: 'done', runId: state.playback.runId, summary: runReplicates({ ...scenario, replicates: 2 }) } })
    expect(render(props)).toBe(`<div class="inspector-body analysis-panel">${noTrial}</div>`)
    useStore.getState().resetRun()
    expect(render(props)).toBe(`<div class="inspector-body analysis-panel">${noTrial}</div>`)
  })

  it('mounts each trial screen with one basis line and one placeholder paragraph', () => {
    installTrial(3)
    for (const props of trialScreens) {
      const html = render(props)
      const title = props.screen[0].toUpperCase() + props.screen.slice(1)
      expect(html).toContain(`<h3>${title}</h3>`)
      expect(html.match(/<p /g)).toHaveLength(2)
      expect(html.match(/class="analysis-scope"/g)).toHaveLength(1)
      expect(html).not.toContain('data-widget-type')
      expect(html).not.toContain('No trial yet')
    }
    observeTrial(3, 1)
    expect(render({ phase: 'execute' })).toContain('T+0:01 observed')
    expect(render({ phase: 'analyze' })).toContain('T+0:03 observed')
  })

  it('uses only the current ensemble for Fragility and Compare', () => {
    const { scenario } = installTrial()
    const summary = runReplicates({ ...scenario, replicates: 2 })
    const state = useStore.getState()
    useStore.setState({ mc: { ...state.mc, status: 'done', runId: state.playback.runId, summary } })
    for (const props of [{ phase: 'prepare', screen: 'fragility' }, { phase: 'analyze', screen: 'compare' }] as const) {
      expect(render(props)).toContain(`Monte Carlo · 2 replicates · Aleatory uncertainty · seed ${summary.seed}`)
      expect(render(props)).toContain('full run')
    }
    useStore.setState({ mc: { ...useStore.getState().mc, status: 'stale' } })
    expect(render({ phase: 'analyze', screen: 'compare' })).toContain('No current ensemble result.')
  })

  it('preserves saved layouts, customization, selection and run state while mounting screens', () => {
    installTrial()
    useStore.getState().applyLens('sensors')
    useStore.getState().setAnalysisCustomize(true)
    const before = useStore.getState()
    for (const props of trialScreens) expect(render(props)).not.toContain('data-widget-type')
    const after = useStore.getState()
    expect(after.ui.analysis).toBe(before.ui.analysis)
    expect(after.ui.analysisCustomize).toBe(true)
    expect(after.selection).toBe(before.selection)
    expect(after.scenario).toBe(before.scenario)
    expect(after.playback).toBe(before.playback)
    expect(after.mc).toBe(before.mc)
  })
})

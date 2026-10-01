import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AnalysisPanel, PanelValidity } from './AnalysisPanel'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { installTrial, observeTrial, unstartTrial } from './analysis/trialTestState'
import { runReplicates } from '../playback/mcRun'

function render(props?: ComponentProps<typeof AnalysisPanel>): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<AnalysisPanel {...props} />)
}

const noTrial =
  '<p class="empty-row"><span class="state warning"><i class="state-square hollow" aria-hidden="true"></i>No trial yet. Press Play in Execute to run one.</span></p>'
// Compare keeps the placeholder in its Trial against ensemble section (R2d).
const compareNoTrial = `<section class="analysis-primary" aria-label="Compare"><section class="psec"><div class="psec-head"><h3 class="psec-title">Trial against ensemble</h3></div><div class="psec-body">${noTrial}</div></section></section>`
// Execute holds the Play control, so its placeholder carries it inline.
const nowPlay =
  '<p class="muted small">No trial yet. Press <button type="button" class="mini">Play</button> to run one.</p>'
// Analyze before a completed trial: the Validity line reads PENDING and opens nothing.
const pendingLine =
  '<div class="vline vline-pending" id="validity-line"><span class="vline-label">Trial validity</span><span class="state inactive"><i class="state-square hollow" aria-hidden="true"></i>PENDING</span><span class="vline-count">No completed trial</span></div>'
const trialScreens = [
  { phase: 'execute', screen: 'now' },
  { phase: 'analyze', screen: 'outcome' },
  { phase: 'analyze', screen: 'compare' },
] as const

describe('AnalysisPanel screens', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
  })

  it('defaults each phase to its first screen and renders Inputs under the Validity line', () => {
    expect(render({ phase: 'prepare' })).toContain('aria-label="Fragility"')
    expect(render({ phase: 'prepare' })).toContain('No ensemble for this setup.')
    const inputs = render({ phase: 'prepare', screen: 'inputs' })
    // useId values differ between renders, so the check reads the two parts.
    expect(inputs.startsWith(renderToStaticMarkup(<PanelValidity phase="prepare" />))).toBe(true)
    expect(inputs).toContain('<div class="inspector-body board-preparation">')
    expect(inputs.startsWith('<div class="vline-wrap">')).toBe(true)
    installTrial()
    expect(render()).toContain('aria-label="Now"')
    expect(render({ phase: 'analyze' })).toContain('aria-label="Outcome"')
    expect(render({ phase: 'prepare', screen: 'compare' })).toContain('aria-label="Fragility"')
  })

  it('mounts Placement in Prepare and nowhere else', () => {
    const placement = render({ phase: 'prepare', screen: 'placement' })
    expect(placement).toContain('aria-label="Placement"')
    expect(placement).toContain('No placement result yet.')
    expect(placement).not.toContain('aria-label="Fragility"')
    for (const phase of ['execute', 'analyze'] as const) {
      expect(render({ phase, screen: 'placement' })).not.toContain('aria-label="Placement"')
    }
  })

  it.each(trialScreens)(
    'shows only one placeholder before Play in $screen, even with an ensemble',
    (props) => {
      const { scenario } = installTrial()
      unstartTrial()
      const state = useStore.getState()
      useStore.setState({
        mc: {
          ...state.mc,
          status: 'done',
          runId: state.playback.runId,
          summary: runReplicates({ ...scenario, replicates: 2 }),
        },
      })
      // Execute shows the line only while the status bar holds it open (D10).
      const expected =
        props.phase === 'execute'
          ? `<div class="inspector-body analysis-panel">${nowPlay}</div>`
          : `${pendingLine}<div class="inspector-body analysis-panel">${props.screen === 'compare' ? compareNoTrial : noTrial}</div>`
      expect(render(props)).toBe(expected)
      useStore.getState().resetRun()
      expect(render(props)).toBe(expected)
    },
  )

  it('mounts each trial screen once with its own basis and no widget', () => {
    installTrial(3)
    for (const props of trialScreens) {
      const html = render(props)
      const title = props.screen[0].toUpperCase() + props.screen.slice(1)
      expect(html.match(new RegExp(`aria-label="${title}"`, 'g'))).toHaveLength(1)
      expect(html).not.toContain('data-widget-type')
      expect(html).not.toContain('No trial yet')
    }
    observeTrial(3, 1)
    expect(render({ phase: 'execute' })).toContain('aria-label="Kill-chain funnel"')
    expect(render({ phase: 'analyze' })).toContain('Trial in progress')
  })

  it('puts the Validity line over Prepare and Analyze, and over Execute only while open', () => {
    expect(render({ phase: 'prepare' })).toContain(
      '<span class="vline-label">Forecast validity</span>',
    )
    installTrial(3)
    expect(render({ phase: 'analyze' })).toContain(pendingLine)
    expect(render({ phase: 'execute' })).not.toContain('class="vline')
    useStore.getState().setValidityOpen(true)
    const open = render({ phase: 'execute' })
    expect(open).toContain('<span class="vline-label">Forecast validity</span>')
    expect(open).toContain('aria-expanded="true"')
    useStore.getState().setValidityOpen(false)
  })

  it('reads the completed trial in Analyze', () => {
    installTrial(60)
    const playback = useStore.getState().playback
    useStore.setState({ playback: { ...playback, completedAtMs: 2 } })
    const html = render({ phase: 'analyze' })
    expect(html).not.toContain('vline-pending')
    expect(html).toMatch(/<span class="vline-label">(Trial|Forecast) validity<\/span>/)
    expect(html).toMatch(/<span class="vline-count">\d+ findings?<\/span>/)
  })

  it('uses only the current ensemble for Fragility and Compare', () => {
    const { scenario } = installTrial()
    const summary = runReplicates({ ...scenario, replicates: 2 })
    const state = useStore.getState()
    useStore.setState({ mc: { ...state.mc, status: 'done', runId: state.playback.runId, summary } })
    expect(render({ phase: 'prepare', screen: 'fragility' })).toContain(
      `${summary.replicates} runs · seed ${summary.seed} · T+`,
    )
    // Compare reads the ensemble in its section head (R2d).
    expect(render({ phase: 'analyze', screen: 'compare' })).toContain(
      `2 runs<span class="cmp-seed"> · seed ${summary.seed}</span>`,
    )
    useStore.setState({ mc: { ...useStore.getState().mc, status: 'stale' } })
    expect(render({ phase: 'analyze', screen: 'compare' })).toContain('No current ensemble result.')
  })

  it('preserves selection and run state while mounting screens', () => {
    installTrial()
    const before = useStore.getState()
    for (const props of trialScreens) expect(render(props)).not.toContain('data-widget-type')
    const after = useStore.getState()
    expect(after.ui).toBe(before.ui)
    expect(after.selection).toBe(before.selection)
    expect(after.scenario).toBe(before.scenario)
    expect(after.playback).toBe(before.playback)
    expect(after.mc).toBe(before.mc)
  })
})

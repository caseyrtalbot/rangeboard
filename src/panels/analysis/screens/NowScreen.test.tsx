import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../state/store'
import { IDLE_TRIAL } from '../../../state/runState'
import { installTrial, observeTrial, unstartTrial } from '../trialTestState'
import * as forecast from '../../../analysis/impact'
import { NowScreen } from './NowScreen'

function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<NowScreen />)
}

afterEach(() => vi.restoreAllMocks())

// Execute holds the Play control, so the placeholder carries it inline.
const nowPlay =
  '<p class="muted small">No trial yet. Press <button class="mini">Play</button> to run one.</p>'

describe('NowScreen cursor telemetry', () => {
  it('ready: retains exactly one pre-Play placeholder', () => {
    installTrial()
    unstartTrial()
    expect(render()).toBe(nowPlay)
    useStore.setState({ trial: IDLE_TRIAL })
    expect(render()).toBe(nowPlay)
  })

  it('mid-run: shows retained holds, bounded milestones and inventory without scenario inputs', () => {
    installTrial(3)
    const spy = vi.spyOn(forecast, 'engagementPicture')
    const html = render()
    expect(html).toContain('observed through T+0:03 of 1:00"')
    expect(html).toContain('<span>Engaged</span><span class="live-value">2/3 tracks</span>')
    expect(html).toContain('>swarm</td>')
    expect(html).toContain('>moving</td>')
    expect(html).toContain('>flyby</td>')
    expect(html).not.toContain('>parked</td>')
    expect(html).toContain('>radar</td>')
    expect(html).toContain('<td>—</td><td>0:01</td><td>0:05</td>')
    expect(html).toContain('7/10')
    expect(html).toContain('cont.')
    expect(html).toContain('width:100%')
    expect(html).toContain('1 held · 0:02 hold')
    expect(html).toContain('>New run</button>')
    expect(html).toContain('>Forecast and analysis</button>')
    for (const excluded of [
      'Fire doctrine',
      'Environment',
      'Requirement',
      'Sensitivity',
      'Forecast available in Analyze',
      '<input',
      '<select',
    ]) {
      expect(html).not.toContain(excluded)
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('complete: reveals reached identification, final inventory and no current sensor hold', () => {
    installTrial(60)
    observeTrial(60, 60)
    useStore.setState(({ playback }) => ({
      playback: { ...playback, phase: 'complete', completedAtMs: 1 },
    }))
    const html = render()
    expect(html).toContain('Complete')
    expect(html).toContain('observed through T+1:00 of 1:00')
    expect(html).toContain('<span>Defeated</span><span class="live-value">5/11 members</span>')
    expect(html).toContain('<td>0:06</td><td>0:01</td><td>0:05</td>')
    expect(html).toContain('6/10')
    expect(html).toContain('>searching<')
    expect(html).toContain('0 held')
    expect(html).not.toContain(' hold</span>')
  })

  it('uses the requested state inks at reached milestones', () => {
    installTrial(1.2)
    useStore.setState(({ trial }) => ({
      trial: {
        ...trial,
        result: {
          ...trial.result!,
          assessments: trial.result!.assessments.map((a) =>
            a.uasId === 'flyby' ? { ...a, windowS: [1, 2] as [number, number] } : a,
          ),
        },
      },
    }))
    expect(render()).toContain('class="state warning"')
    const { result } = installTrial(60)
    // Keep the retained scenario and draw identity; isolate two row-state boundaries.
    const assessments = result.assessments.map((a) =>
      a.uasId === 'flyby'
        ? { ...a, classificationAtS: { ...a.classificationAtS, hostileAtS: 2 } }
        : a,
    )
    const movingEvent = result.report.events[0]
    const events = [
      ...result.report.events,
      { ...movingEvent, shipIdx: 0 },
      { ...movingEvent, shipIdx: 1 },
    ]
    useStore.setState(({ trial }) => ({
      trial: { ...trial, result: { ...result, assessments, report: { ...result.report, events } } },
    }))
    const html = render()
    expect(html).toContain('class="state-square hollow"')
    expect(html).toContain('>identified</span>')
    expect(html).toContain('style="color:var(--ghost)"')
    expect(html).toContain('>defeated</span>')
  })

  it('scrubbing a completed run back hides future effects and identification', () => {
    installTrial(60)
    observeTrial(60, 1)
    const html = render()
    expect(html).toContain('<span>Defeated</span><span class="live-value">0/11 members</span>')
    expect(html).toContain('9/10')
    expect(html).not.toContain('<td>0:06</td>')
    expect(html).not.toContain('>radar</td>')
  })

  it('preserves preparation and error states without populating results', () => {
    installTrial()
    const trial = useStore.getState().trial
    useStore.setState({ trial: { ...trial, status: 'preparing' } })
    expect(render()).toContain('Preparing trial')
    useStore.setState({ trial: { ...trial, status: 'error', error: 'Preparation failed' } })
    expect(render()).toContain('Preparation failed')
    expect(render()).not.toContain('<table')
  })
})

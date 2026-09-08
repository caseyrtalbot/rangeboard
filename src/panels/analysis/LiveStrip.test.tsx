import { emptyScenario } from '../../model/seed'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../state/store'
import { IDLE_TRIAL } from '../../state/runState'
import { installTrial, observeTrial, unstartTrial } from './widgets/trialTestState'
import * as forecast from '../../analysis/impact'
import { LiveStrip } from './LiveStrip'

function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<LiveStrip />)
}
afterEach(() => vi.restoreAllMocks())

describe('LiveStrip trial lifecycle', () => {
  it.each(['idle', 'preparing', 'error', 'cancelled', 'ready'] as const)('retains the %s header without requiring threats or computing a forecast', status => {
    installTrial()
    unstartTrial()
    const trial = useStore.getState().trial
    useStore.setState({ trial: status === 'idle' ? IDLE_TRIAL : { ...trial, status, error: status === 'error' ? 'Preparation failed' : null } })
    const spy = vi.spyOn(forecast, 'engagementPicture')
    const html = render()
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain('DET')
    expect(html).not.toContain('mc-pop')
    const text = status === 'preparing' ? 'Preparing trial' : status === 'error' ? 'Preparation failed' : status === 'ready' ? 'Trial ready' : 'Simulated trial · ready'
    expect(html).toContain(text)
    if (status === 'preparing') expect(html).toContain('>Cancel<')
    if (status === 'error' || status === 'cancelled') expect(html).toContain('>Retry<')
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows preparation errors even on an empty scenario', () => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().startTrialRun()
    const html = render()
    expect(html).toContain('Web Worker unavailable')
    expect(html).toContain('>Retry</button>')
  })

  it('distinguishes visible prefix, achieved observation and replay across phases', () => {
    installTrial()
    observeTrial(60, 1)
    useStore.setState(({ playback }) => ({ playback: { ...playback, completedAtMs: 1, phase: 'paused' } }))
    for (const phase of ['execute', 'analyze'] as const) {
      useStore.getState().setBoardPhase(phase)
      const html = render()
      expect(html).toContain('Simulated trial · Replay')
      expect(html).toContain('Visible prefix through 0:01')
      expect(html).toContain('achieved observation through 1:00')
      expect(html).toContain('full trial observed')
    }
  })

  it('offers separate Replay and New run controls at completion', () => {
    installTrial()
    useStore.setState(({ playback }) => ({ playback: { ...playback, completedAtMs: 1, phase: 'complete' } }))
    const html = render()
    expect(html).toContain('>Replay</button>')
    expect(html).toContain('aria-label="New run"')
  })
})

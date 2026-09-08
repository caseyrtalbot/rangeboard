import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mixedTrial } from '../playback/__fixtures__/trialFixture'
import type { TrialResultView } from '../analysis/trialResult'
import { useStore } from '../state/store'
import { TrackFileReadout } from './TrackFileReadout'

vi.mock('react-konva', () => ({}))
let trial: TrialResultView

function render(horizonS: number | null = 3): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<TrackFileReadout trial={trial} horizonS={horizonS} size={{ w: 1200, h: 800 }} />)
}

describe('TrackFileReadout', () => {
  beforeEach(() => {
    const fixture = mixedTrial()
    trial = fixture.view
    useStore.getState().replaceScenario(fixture.scenario)
    useStore.getState().select({ entityIds: ['swarm'] })
    useStore.getState().setBoardPhase('prepare')
    useStore.getState().setSimTime(3)
  })

  it('keeps current essentials, integer group counts and the Details action', () => {
    const html = render()
    expect(html).toContain('class="readout compact"')
    expect(html.match(/class="ro-k"/g)?.length).toBe(3)
    expect(html).toContain('CURSOR')
    expect(html).toContain('SPEED / HDG')
    expect(html).toContain('ALT')
    expect(html).toContain('3 active · 1 hard kill · 1 mission kill · 5 members')
    expect(html).toContain('SIMULATED TRIAL · THROUGH T+0:03')
    expect(html).toContain('>Details</button>')
    expect(html).not.toContain('E[k]')
  })

  it('uses a frozen member-zero leader position and hard-kill speed', () => {
    // A fresh retained ledger allows an explicit killed lead-member fixture.
    const fixture = mixedTrial()
    fixture.result.report.events[2].shipIdx = 0
    trial = fixture.view
    useStore.getState().replaceScenario(fixture.scenario)
    useStore.getState().select({ entityIds: ['swarm'] })
    useStore.getState().setSimTime(40)
    useStore.setState({ camera: { x: 0, y: 0, scale: 1 } })
    const html = render(3)
    expect(html).toContain('x1="20" y1="0"')
    expect(html).toContain('0 kt')
    expect(html).toContain('3 active')
  })


  it('uses the shared raw horizon in Execute without rounding a reached scan backward', () => {
    useStore.getState().setBoardPhase('execute')
    useStore.setState({ playback: { ...useStore.getState().playback, startedAtMs: 1, simTimeS: 1.1, observedThroughS: 1.1 } })
    expect(render(1.1)).toContain('>TRACKED</span>')
  })

  it('retains the configuration card without outcomes before observation', () => {
    const html = render(null)
    expect(html).toContain('CONFIGURATION · TRIAL NOT OBSERVED')
    expect(html).not.toContain('active ·')
    expect(html).not.toContain('HARD KILL')
    expect(html).not.toContain('SIMULATED TRIAL')
  })
})

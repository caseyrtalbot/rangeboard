import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useStore } from '../../state/store'
import { IDLE_TRIAL } from '../../state/runState'
import { installTrial } from './trialTestState'
import { LiveStrip } from './LiveStrip'

function render(horizon: number, complete = false, speedMult = 1) {
  const { view } = installTrial()
  useStore.setState(({ playback }) => ({
    playback: {
      ...playback,
      phase: complete ? 'complete' : 'paused',
      completedAtMs: complete ? 1 : null,
      speedMult,
    },
  }))
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<LiveStrip view={view} horizon={horizon} />)
}

describe('LiveStrip run line', () => {
  it('keeps track and member denominators distinct at the cursor', () => {
    const html = render(3)
    expect(html).toContain('Paused')
    expect(html).toContain('>T+0:03 / 1:00</span>')
    expect(html).toContain('aria-valuetext="Simulated trial · observed through T+0:03 of 1:00"')
    expect(html).toContain('<span>Tracks</span><span class="live-value">1/3</span>')
    expect(html).toContain('<span>Engaged</span><span class="live-value">2/3 tracks</span>')
    expect(html).toContain('<span>Defeated</span><span class="live-value">3/11 members</span>')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('live-strip')
  })

  it('is a card with the clock, the observed horizon bar and the replicate, seed and speed rows', () => {
    const { manifest } = installTrial()
    const html = render(15, false, 5)
    expect(html).toContain('class="live-card"')
    expect(html).toContain('class="live-clock">T+0:15 / 1:00</span>')
    expect(html).toContain('role="progressbar" aria-label="Observed horizon"')
    expect(html).toContain('aria-valuenow="15"')
    expect(html).toContain('style="width:25%"')
    expect(html).toContain(
      `<span>Replicate</span><span class="live-value">${manifest.replicateIndex}</span>`,
    )
    expect(html).toContain(`<span>Seed</span><span class="live-value">${manifest.seed}</span>`)
    expect(html).toContain('<span>Speed</span><span class="live-value">5x</span>')
    expect(html).not.toContain('muted')
  })

  it('puts the Play control inline before a trial, and names Execute only outside it', () => {
    useStore.setState(({ ui }) => ({ trial: IDLE_TRIAL, ui: { ...ui, boardPhase: 'execute' } }))
    Object.assign(useStore.getInitialState(), useStore.getState())
    const execute = renderToStaticMarkup(<LiveStrip />)
    expect(execute).toContain('No trial yet. Press <button class="mini">Play</button>')
    expect(execute).not.toContain('in Execute')
    useStore.setState(({ ui }) => ({ ui: { ...ui, boardPhase: 'prepare' } }))
    Object.assign(useStore.getInitialState(), useStore.getState())
    expect(renderToStaticMarkup(<LiveStrip />)).toContain('Press Play in Execute to run one.')
  })

  it('shows completion and includes late defeats only after their effects', () => {
    expect(render(60, true)).toContain('Complete')
    expect(render(60, true)).toContain(
      '<span>Defeated</span><span class="live-value">5/11 members</span>',
    )
    expect(render(1)).toContain('<span>Defeated</span><span class="live-value">0/11 members</span>')
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useStore } from '../../state/store'
import { IDLE_TRIAL } from '../../state/runState'
import { installTrial } from './trialTestState'
import { LiveStrip } from './LiveStrip'

function render(horizon: number, complete = false) {
  const { view } = installTrial()
  useStore.setState(({ playback }) => ({
    playback: {
      ...playback,
      phase: complete ? 'complete' : 'paused',
      completedAtMs: complete ? 1 : null,
    },
  }))
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<LiveStrip view={view} horizon={horizon} />)
}

describe('LiveStrip run line', () => {
  it('keeps track and member denominators distinct at the cursor', () => {
    const html = render(3)
    expect(html).toContain('Paused')
    expect(html).toContain('Simulated trial · observed through T+0:03 of 1:00')
    expect(html).toContain('tracks 1/3')
    expect(html).toContain('engaged 2/3 tracks')
    expect(html).toContain('defeated 3/11 members')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('live-strip')
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
    expect(render(60, true)).toContain('defeated 5/11 members')
    expect(render(1)).toContain('defeated 0/11 members')
  })
})

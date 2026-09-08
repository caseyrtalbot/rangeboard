import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_HORIZON, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import { useStore } from '../../../state/store'
import { installTrial, observeTrial, unstartTrial } from './trialTestState'
import { SystemStatusWidget } from './SystemStatusWidget'

function render(horizon: ExecutionHorizon) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<SystemStatusWidget horizon={horizon} id="systems" params={{}} collapsed={false} customize={false} index={0} count={1} />)
}

describe('SystemStatusWidget trial visibility', () => {
  beforeEach(() => { installTrial(3) })

  it('shows retained telemetry, assigned salvos and integer effect counts', () => {
    const html = render(FULL_RUN)
    expect(html).toContain('system-telemetry-head')
    expect(html).toContain('2 effects · 2 trial defeats')
    expect(html).toContain('online')
    expect(html).toContain('T+0:03 observed')
    expect(html).not.toMatch(/E\[k\]|expected|planning envelope/)
  })

  it('withholds an assigned effect until its exact boundary', () => {
    observeTrial(1.99)
    const pending = render(FULL_RUN)
    expect(pending).toContain('0 effects · 0 trial defeats')
    expect(pending).not.toMatch(/[1-9] effects/)
    observeTrial(2)
    expect(render(FULL_RUN)).toContain('2 effects · 2 trial defeats')
  })

  it('shows no system outcomes at EMPTY_HORIZON before Play', () => {
    unstartTrial()
    const html = render(EMPTY_HORIZON)
    expect(html).toContain('Simulated trial · ready')
    expect(html).not.toContain('system-telemetry-head')
    expect(html).not.toContain('component-telemetry-row')
  })
})

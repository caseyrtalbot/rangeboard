import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_HORIZON, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import { useStore } from '../../../state/store'
import { installTrial, observeTrial, unstartTrial } from './trialTestState'
import { ThreatPictureWidget } from './ThreatPictureWidget'

function render(horizon: ExecutionHorizon) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<ThreatPictureWidget horizon={horizon} id="threat" params={{ expanded: true }} collapsed={false} customize={false} index={0} count={1} />)
}

describe('ThreatPictureWidget trial visibility', () => {
  beforeEach(() => { installTrial(1) })

  it('bounds Analyze telemetry at observation, including expanded members and tooltips', () => {
    const html = render(FULL_RUN)
    expect(html).toContain('Trial threat picture')
    expect(html).toContain('T+0:01 observed')
    expect(html).toContain('UNSEEN')
    expect(html).toContain('D — · ID — · ENG — · FX —')
    expect(html).toContain('0 trial defeats')
    expect(html).not.toMatch(/Expected|EXPECTED|preview/)
  })

  it('shows integer member counts and only reached milestones', () => {
    observeTrial(3)
    const html = render(FULL_RUN)
    expect(html).toContain('2 trial defeats · 3 active members')
    expect(html).toContain('3/5 members')
    expect(html).toContain('ENG 0:01')
    expect(html).toContain('ID —')
    expect(html).not.toContain('expected kills')
  })

  it('has no member outcomes before Play at EMPTY_HORIZON', () => {
    unstartTrial()
    const html = render(EMPTY_HORIZON)
    expect(html).toContain('Simulated trial · ready')
    expect(html).not.toContain('threat-data-group')
    expect(html).not.toContain('T+')
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as forecast from '../../../analysis/impact'
import * as detection from '../../../playback/detection'
import * as series from '../../../analysis/series'
import { FULL_RUN } from '../../../analysis/horizon'
import { IDLE_TRIAL } from '../../../state/runState'
import { useStore } from '../../../state/store'
import { KpiTilesWidget } from './KpiTilesWidget'
import { TimeSeriesWidget } from './TimeSeriesWidget'
import { ThreatPictureWidget } from './ThreatPictureWidget'
import { SystemStatusWidget } from './SystemStatusWidget'
import { installTrial, unstartTrial } from './trialTestState'

const widgets = [KpiTilesWidget, TimeSeriesWidget, ThreatPictureWidget, SystemStatusWidget]
afterEach(() => vi.restoreAllMocks())

describe.each(widgets)('%s trial selection', Widget => {
  function render(collapsed = false) {
    Object.assign(useStore.getInitialState(), useStore.getState())
    return renderToStaticMarkup(createElement(Widget, { id: 'saved-id', params: {}, horizon: FULL_RUN,
      collapsed, customize: false, index: 0, count: 1 }))
  }

  it.each(['idle', 'preparing', 'error', 'cancelled', 'unstarted'] as const)('keeps its frame and matching %s state without counters', status => {
    installTrial()
    if (status === 'unstarted') unstartTrial()
    else {
      const trial = useStore.getState().trial
      useStore.setState({ trial: status === 'idle' ? IDLE_TRIAL : { ...trial,
        status: status === 'error' ? 'ready' : status, error: status === 'error' ? 'Captured trial failed' : null } })
    }
    const expected = status === 'preparing' ? 'Preparing trial' : status === 'error' ? 'Captured trial failed' : 'Simulated trial · ready'
    const html = render()
    expect(html).toContain('data-widget-type=')
    expect(html).toContain(expected)
    expect(html).not.toMatch(/class="tv|threat-data-group|component-telemetry-row|class="chart|planning envelope|Expected/)
    expect(render(true)).toContain(expected)
    expect(render(true)).not.toContain('class="wg-b"')
  })

  it('never computes a forecast, deterministic detection or forecast series', () => {
    installTrial()
    const picture = vi.spyOn(forecast, 'engagementPicture')
    const hits = vi.spyOn(detection, 'detectionsAt')
    const builders = ['kpiSeries', 'heldTracksSeries', 'meanHeldPdSeries', 'groupResidualSeries', 'salvosInFlightSeries', 'withBands'] as const
    const spies = builders.map(name => vi.spyOn(series, name))
    render()
    expect(picture).not.toHaveBeenCalled()
    expect(hits).not.toHaveBeenCalled()
    spies.forEach(spy => expect(spy).not.toHaveBeenCalled())
  })
})

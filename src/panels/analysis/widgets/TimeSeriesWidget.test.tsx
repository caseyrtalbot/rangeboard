import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_HORIZON, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import type { TimeSeriesProps } from '../../../charts/TimeSeries'
import { useStore } from '../../../state/store'
import { TimeSeriesWidget } from './TimeSeriesWidget'
import { installTrial, observeTrial, unstartTrial } from './trialTestState'

const chart = vi.hoisted(() => vi.fn<(props: TimeSeriesProps) => void>())
// Chart censoring belongs to the chart contract; this boundary must pass the horizon.
vi.mock('../../../charts/TimeSeries', () => ({
  TimeSeries: (props: TimeSeriesProps) => {
    chart(props)
    return <div>{props.marks?.map((mark) => <span key={mark.label}>{mark.label}</span>)}</div>
  },
}))

function render(horizon: ExecutionHorizon, params: Record<string, unknown> = { seriesIds: ['kpi.expectedKills'] }) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<TimeSeriesWidget horizon={horizon} id="series" params={params} collapsed={false} customize={false} index={0} count={1} />)
}

describe('TimeSeriesWidget trial visibility', () => {
  beforeEach(() => { installTrial(1.99); chart.mockClear() })

  it('maps the saved expected-kills id to realized pre-arrival defeats in Analyze', () => {
    const html = render(FULL_RUN)
    expect(html).toContain('Pre-arrival defeats')
    expect(html).toContain('observed')
    expect(html).not.toContain('Expected')
    const props = chart.mock.calls[0][0]
    expect(props.series[0]).toMatchObject({ id: 'kpi.expectedKills', basis: 'simulated-trial', label: 'Pre-arrival defeats', values: [0, 0, 0, 0] })
    expect(props.horizonS).toBe(1.99)
  })

  it.each([{}, { preset: 'sensors' }, { preset: 'effectors' }, { preset: 'threat' }])('bounds every chart and series for %j without bands', params => {
    render(FULL_RUN, params)
    expect(chart).toHaveBeenCalled()
    for (const [props] of chart.mock.calls) {
      expect(props.horizonS).toBe(1.99)
      expect(props.tS).toBe(1.99)
      expect(props.marks?.some(mark => mark.tS > 1.99)).not.toBe(true)
      for (const series of props.series) {
        expect(series.values).toHaveLength(4)
        expect(series).toMatchObject({ basis: 'simulated-trial' })
        expect(series).not.toHaveProperty('band80')
        expect(series).not.toHaveProperty('band95')
        expect(series.label).not.toMatch(/Expected|E\[/)
      }
    }
  })

  it('keeps EMPTY_HORIZON free of charts and outcomes before first Play', () => {
    unstartTrial()
    const html = render(EMPTY_HORIZON)
    expect(chart).not.toHaveBeenCalled()
    expect(html).toContain('Simulated trial · ready')
    expect(html).not.toContain('ARR')
  })

  it('reveals only a reached trial arrival and preserves params', () => {
    const params = { seriesIds: ['kpi.expectedKills'], unknown: 'saved' }
    const before = structuredClone(params)
    expect(render(FULL_RUN, params)).not.toContain('ARR')
    observeTrial(5)
    expect(render(FULL_RUN, params)).toContain('ARR')
    expect(params).toEqual(before)
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { EMPTY_HORIZON, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import type { TimeSeriesProps } from '../../../charts/TimeSeries'
import { parseAutosave } from '../../../io/persist'
import { useStore } from '../../../state/store'
import { TimeSeriesWidget } from './TimeSeriesWidget'

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

describe('TimeSeriesWidget visibility', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(parseAutosave(JSON.stringify(fixture)))
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    useStore.getState().scrubTo(250)
    chart.mockClear()
  })

  it('retains unscoped series labels and the earliest arrival marker', () => {
    const html = render(FULL_RUN)
    expect(html).toContain('Expected kills')
    expect(html).toContain('ARR')
    expect(html).toContain('0.5 s · basis per series')
    expect(chart.mock.calls[0][0].horizonS).toBeUndefined()
  })

  it.each([{}, { preset: 'sensors' }, { preset: 'effectors' }, { preset: 'threat' }])('caps every chart for %j before future outcomes', (params) => {
    const html = render({ scoped: true, horizonS: 1 }, params)
    expect(chart).toHaveBeenCalled()
    for (const [props] of chart.mock.calls) {
      expect(props.horizonS).toBe(1)
      expect(props.tS).toBe(1)
      expect(props.marks?.some((mark) => mark.tS > 1)).not.toBe(true)
    }
    expect(html).not.toContain('ARR')
  })

  it('passes EMPTY_HORIZON to every chart and drops event marks', () => {
    const html = render(EMPTY_HORIZON)
    expect(chart.mock.calls[0][0].horizonS).toBe(-Infinity)
    expect(chart.mock.calls[0][0].marks).toEqual([])
    expect(html).not.toContain('ARR')
  })

  it('never presents forecast arrival as an event even after its time, and preserves params', () => {
    const params = { seriesIds: ['kpi.expectedKills'], unknown: 'saved' }
    const before = structuredClone(params)
    expect(render({ scoped: true, horizonS: 1000 }, params)).not.toContain('ARR')
    expect(params).toEqual(before)
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  TimeSeries, formatYTick, lastFiniteIndex, seriesDurationS, seriesRange, seriesRows,
  snapScrubS,
} from './TimeSeries'
import type { Series } from './types'

const a: Series = {
  id: 'a',
  label: 'Pd T01',
  unit: null,
  values: [0, 0.2, NaN, 0.6, 0.8, 1],
  color: 'chart-1',
  kind: 'line',
}
const b: Series = {
  id: 'b',
  label: 'Kills',
  unit: 'ships',
  values: [0, 0, 1, 1, 2],
  color: 'chart-2',
  kind: 'step',
  band80: [[0, 0, 0.5, 0.5, 1.5], [0, 0, 1.5, 1.5, 2.5]],
}

describe('TimeSeries static markup', () => {
  const html = renderToStaticMarkup(
    <TimeSeries series={[a, b]} tS={12} width={312} height={120} />,
  )

  it('renders the frame and the legend with both series labels', () => {
    expect(html).toContain('class="chart"')
    expect(html).toContain('class="chart-legend"')
    expect(html).toContain('Pd T01')
    expect(html).toContain('Kills')
    expect(html).toContain('background:#3987e5')
    expect(html).toContain('background:#d95926')
  })

  it('renders the Recharts wrapper at the fixed width', () => {
    expect(html).toContain('recharts-wrapper')
    expect(html).toContain('width:312px')
  })

  // Recharts 3.10.1 dispatches the chart size from a useEffect, which never runs in
  // react-dom/server, so the plot SVG (playhead, marks, lines) is absent from static
  // markup. The playhead assertion needs a browser.

  it('hides the legend for a single series', () => {
    const one = renderToStaticMarkup(<TimeSeries series={[a]} tS={0} width={312} height={120} />)
    expect(one).not.toContain('chart-legend')
  })
})

describe('TimeSeries helpers', () => {
  it('maps NaN to null and keeps bands as [low, high]', () => {
    const rows = seriesRows([a, b])
    expect(rows).toHaveLength(6)
    expect(rows[2].t).toBe(1)
    expect(rows[2].a).toBeNull()
    expect(rows[3].a).toBe(0.6)
    expect(rows[2]['b:80']).toEqual([0.5, 1.5])
    expect(rows[5].b).toBeNull()
    expect(rows[5]['b:80']).toBeNull()
  })

  it('spans (maxLen - 1) * DT', () => {
    expect(seriesDurationS([a, b])).toBe(2.5)
    expect(seriesDurationS([])).toBe(0)
  })

  it('ranges from 0 to the maximum plus headroom, bands included', () => {
    const [lo, hi] = seriesRange([a, b])
    expect(lo).toBe(0)
    expect(hi).toBeCloseTo(2.5 * 1.08)
    expect(seriesRange([a], [0, 1])).toEqual([0, 1])
    expect(seriesRange([{ ...a, values: [0, 0] }])).toEqual([0, 1])
  })

  it('finds the last finite sample', () => {
    expect(lastFiniteIndex(a.values)).toBe(5)
    expect(lastFiniteIndex([NaN, 1, NaN])).toBe(1)
    expect(lastFiniteIndex([NaN])).toBe(-1)
  })

  it('formats y ticks by the mockup rule', () => {
    expect(formatYTick(2, 4)).toBe('2')
    expect(formatYTick(0.5, 1)).toBe('0.5')
    expect(formatYTick(1, 1)).toBe('1.0')
  })

  it('snaps a scrub time to DT inside the run', () => {
    expect(snapScrubS(12.3, 100)).toBe(12.5)
    expect(snapScrubS(-4, 100)).toBe(0)
    expect(snapScrubS(140, 100)).toBe(100)
  })
})

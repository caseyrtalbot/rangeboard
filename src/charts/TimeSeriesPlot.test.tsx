import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DT } from '../playback/clock'
import { TimeSeriesPlot } from './TimeSeriesChart'
import type { Series } from './types'

// Recharts sizes SVGs in effects. Expose the plot contract for server-render assertions.
vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  CartesianGrid: () => null,
  XAxis: ({ domain }: { domain: number[] }) => <g data-axis="x" data-domain={domain.join(',')} />,
  YAxis: ({ domain }: { domain: number[] }) => <g data-axis="y" data-domain={domain.join(',')} />,
  Area: () => <g data-role="band" />,
  Line: () => <g data-role="series" />,
  ReferenceDot: ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} />,
  ReferenceLine: ({ x, label }: { x: number; label: { value: string } }) => (
    <g data-rule={x}>{label.value}</g>
  ),
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
}))

const values = Array.from({ length: 121 }, (_, i) => (i * DT <= 30 ? i * DT : 1000))
const series: Series[] = [
  {
    id: 'a',
    label: 'Observed',
    unit: null,
    color: 'chart-1',
    kind: 'line',
    values,
    band80: [values, values],
  },
]
const render = (horizonS?: number) =>
  renderToStaticMarkup(
    <TimeSeriesPlot
      series={series}
      tS={50}
      width={312}
      height={120}
      horizonS={horizonS}
      marks={[
        { tS: 30, label: 'Reached mark', color: 'accent' },
        { tS: 45, label: 'Future mark', color: 'accent' },
      ]}
    />,
  )

describe('TimeSeries plot horizon contract', () => {
  it('preserves the unscoped plot and endpoint at the full duration', () => {
    expect(render(Infinity)).toBe(render())
    expect(render()).toContain('cx="60" cy="1000"')
    expect(render()).toContain('Future mark')
  })

  it('clips the endpoint and Y range, filters marks, and keeps the full X extent and cursor', () => {
    const html = render(30)
    expect(html).toContain('cx="30" cy="30"')
    expect(html).toContain('data-axis="x" data-domain="0,60"')
    expect(html).toContain(`data-axis="y" data-domain="0,${30 * 1.08}"`)
    expect(html).toContain('Reached mark')
    expect(html).not.toContain('Future mark')
    expect(html).toContain('data-rule="50">T+0:50')
  })

  it('renders only axes and cursor before observation', () => {
    const html = render(-Infinity)
    expect(html).toContain('data-axis="x"')
    expect(html).toContain('data-axis="y"')
    expect(html).toContain('data-rule="50">T+0:50')
    expect(html).not.toContain('data-role="series"')
    expect(html).not.toContain('data-role="band"')
    expect(html).not.toContain('<circle')
    expect(html).not.toContain('Reached mark')
    expect(html).not.toContain('Future mark')
  })
})

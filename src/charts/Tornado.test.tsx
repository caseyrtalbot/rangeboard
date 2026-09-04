import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tornado, type TornadoRow } from './Tornado'

const rows: TornadoRow[] = [
  { id: 'a', label: 'detectRangeM', low: 2.5, high: 9.5 },
  { id: 'b', label: 'pk', low: 5, high: 7.5 },
  { id: 'c', label: 'engageTimeSeconds', low: 6.5, high: 6.5, tag: <b>PF</b> },
]

const html = renderToStaticMarkup(
  <Tornado rows={rows} nominal={6} unit="leakers" width={300} />,
)

describe('Tornado static markup', () => {
  it('renders the shell and the svg at the given width', () => {
    expect(html).toContain('class="chart chart-tornado"')
    expect(html).toContain('class="chart-tornado-svg"')
    expect(html).toContain('width="300"')
  })

  it('draws one bar rect per row', () => {
    expect(html.match(/data-role="bar"/g)).toHaveLength(rows.length)
  })

  it('cuts the gutter label to the budget and keeps the tag', () => {
    expect(html).toContain('detectRangeM')
    expect(html).toContain('engageTimeSe…')
    expect(html).not.toContain('engageTimeSeconds')
    expect(html).toContain('<foreignObject')
    expect(html).toContain('<b>PF</b>')
  })

  it('draws the nominal rule and its caption', () => {
    expect(html).toContain('data-role="nominal"')
    expect(html).toContain('6.00 leakers')
    // --text-dim from TOKEN_FALLBACK: no document in node, so the fallback answers.
    expect(html).toContain('stroke="rgba(255, 255, 255, 0.61)"')
  })

  it('prints both end values at the bar ends', () => {
    expect(html).toContain('2.50')
    expect(html).toContain('9.50')
    expect(html).toContain('5.00')
    expect(html).toContain('7.50')
  })

  it('splits each bar at the nominal, low side chart-2 and high side chart-1', () => {
    // Row a spans 2.5 to 9.5 with the nominal at 6: the stop sits at (6 - 2.5) / 7 = 0.5.
    expect(html).toContain('offset="0.5"')
    expect(html).toContain('stop-color="#d95926"')
    expect(html).toContain('stop-color="#3987e5"')
  })
})

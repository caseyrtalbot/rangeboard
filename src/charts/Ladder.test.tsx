import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Ladder } from './Ladder'
import type { LadderRow } from './types'

const rows: LadderRow[] = [
  {
    id: 'a',
    label: 'Track',
    spans: [
      { startS: 10, endS: 50, color: 'chart-1', label: 'window ends at 0:50' },
      { startS: 40, endS: 60, color: 'chart-2', label: 'later span' },
    ],
  },
]
const render = (horizonS?: number) =>
  renderToStaticMarkup(
    <Ladder rows={rows} durationS={60} tS={45} width={392} horizonS={horizonS} />,
  )

describe('Ladder horizon', () => {
  it('preserves unscoped markup with Infinity', () => {
    expect(render(Infinity)).toBe(render())
    expect(render()).toContain('window ends at 0:50')
    expect(render().match(/<rect /g)).toHaveLength(2)
  })

  it('clips crossing spans and their labels and removes later spans', () => {
    const html = render(30)
    expect(html.match(/<rect /g)).toHaveLength(1)
    expect(html).toContain('x="144" y="6" width="96"')
    expect(html).toContain('0:10–0:30')
    expect(html).not.toContain('0:50')
    expect(html).not.toContain('later span')
    expect(html).toContain('x1="312" y1="2" x2="312"')
    expect(html).toContain('data-role="playhead"')
  })

  it('keeps a span starting exactly at the horizon', () => {
    expect(render(40).match(/<rect /g)).toHaveLength(2)
  })

  it('renders no spans before observation while retaining the cursor and axis', () => {
    const html = render(-Infinity)
    expect(html).not.toContain('<rect')
    expect(html).not.toContain('window ends')
    expect(html).not.toContain('later span')
    expect(html).toContain('data-role="playhead"')
    expect(html).toContain('1:00')
  })
})

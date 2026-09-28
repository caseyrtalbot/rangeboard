import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RunTimelineRow } from '../../analysis/runTimeline'
import type { RunTimelineHit } from './hit'
import { TipBody } from './Tooltip'

const row: RunTimelineRow = {
  key: 'effector:gun',
  kind: 'effector',
  label: 'Gun',
  meta: '',
  entityId: 'gun',
  spans: [],
  marks: [{ kind: 'hard-kill', tS: 90, text: 'UAS-3', after: 'pk 0.85' }],
}
const hit: RunTimelineHit = { t: 'mark', row, mark: row.marks[0] }

describe('TipBody', () => {
  it('draws the kind, the subject, the note, the data line and the horizon line', () => {
    const html = renderToStaticMarkup(<TipBody hit={hit} horizonS={200} />)
    expect(html).toContain('<b>Hard kill</b> Gun')
    expect(html).toContain('<div>UAS-3</div>')
    expect(html).toContain('<div class="runtl-tip-data">T+1:30 · pk 0.85</div>')
    expect(html).toContain('<div class="runtl-tip-horizon">Shown through T+3:20</div>')
  })
})

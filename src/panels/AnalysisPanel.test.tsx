import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FullRunProjection } from './AnalysisPanel'

describe('AnalysisPanel time-horizon boundaries', () => {
  it('keeps modeled future results out of the default live view', () => {
    const html = renderToStaticMarkup(
      <FullRunProjection>
        <div className="future-result">4 fired</div>
      </FullRunProjection>,
    )

    expect(html).toContain('Full-run projection')
    expect(html).toContain('not live')
    expect(html).not.toContain('future-result')
    expect(html).not.toContain('4 fired')
  })
})

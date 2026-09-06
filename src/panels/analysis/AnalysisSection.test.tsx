import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AnalysisSection } from './AnalysisSection'

describe('AnalysisSection', () => {
  it('uses the full visible heading as a native disclosure button', () => {
    const html = renderToStaticMarkup(
      <AnalysisSection title="Long operational threshold title" headline="3 of 6">
        <span>Threshold body</span>
      </AnalysisSection>,
    )

    expect(html).toMatch(
      /<button[^>]*class="section-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+-content"[^>]*>[\s\S]*Long operational threshold title[\s\S]*3 of 6[\s\S]*<\/button>/,
    )
    expect(html).not.toContain('Threshold body')
  })

  it('keeps header actions beside the toggle instead of nesting controls', () => {
    const html = renderToStaticMarkup(
      <AnalysisSection
        title="Requirements"
        defaultOpen
        headerExtra={<button type="button">Export</button>}
      >
        <span>Requirement body</span>
      </AnalysisSection>,
    )
    const toggleEnd = html.indexOf('</button>')
    const action = html.indexOf('>Export</button>')

    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('class="section-content"')
    expect(html).toContain('Requirement body')
    expect(action).toBeGreaterThan(toggleEnd)
  })
})

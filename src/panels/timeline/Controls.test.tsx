import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RunTimelineModel } from '../../analysis/runTimeline'
import { Controls } from './Controls'

const model: RunTimelineModel = { durationS: 600, horizonS: 200, groups: [] }

describe('Controls', () => {
  it('renders the controls in mockup order with the window readout', () => {
    const html = renderToStaticMarkup(
      <Controls model={model} base={{ t0S: 0, winS: 120 }} follow />,
    )
    const order = ['>Follow<', 'aria-label="Zoom out"', '>120 s<', 'aria-label="Zoom in"']
    const rest = ['>Fit<', '>Collapse all<', '>Expand all<']
    const at = [...order, ...rest].map((needle) => html.indexOf(needle))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(html).toContain('aria-pressed="true"')
    expect(html).not.toContain('disabled')
  })

  it('reads fit at the whole run, with Follow off and Zoom out disabled', () => {
    const html = renderToStaticMarkup(
      <Controls model={model} base={{ t0S: 0, winS: 600 }} follow={false} />,
    )
    expect(html).toContain('>fit<')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toMatch(/aria-label="Zoom out"[^>]*disabled/)
    expect(html).not.toMatch(/aria-label="Zoom in"[^>]*disabled/)
  })
})

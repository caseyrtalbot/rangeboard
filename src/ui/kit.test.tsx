import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProvMark, State } from './kit'

describe('State', () => {
  it('draws the solid square and the word in one tone', () => {
    const html = renderToStaticMarkup(<State tone="nominal">READY</State>)
    expect(html).toBe(
      '<span class="state nominal"><i class="state-square" aria-hidden="true"></i>READY</span>',
    )
  })

  it('draws the hollow square for a qualifying count and the circle for live', () => {
    expect(renderToStaticMarkup(<State tone="inactive" hollow>3 pending</State>)).toContain(
      'class="state-square hollow"',
    )
    expect(renderToStaticMarkup(<State tone="critical" live>LIVE</State>)).toContain(
      'class="state-square live"',
    )
  })

  it('carries a title and a role for the one alert state', () => {
    const html = renderToStaticMarkup(
      <State tone="critical" title="disk full" role="alert">
        Save failed
      </State>,
    )
    expect(html).toContain('title="disk full"')
    expect(html).toContain('role="alert"')
  })
})

describe('ProvMark', () => {
  it('renders the sourced mark on the bare column class', () => {
    expect(renderToStaticMarkup(<ProvMark kind="sourced" title="datasheet · maker · 2026-09-04" />)).toBe(
      '<span class="prov-mark" title="datasheet · maker · 2026-09-04" aria-label="datasheet · maker · 2026-09-04"></span>',
    )
  })

  it('adds one kind class for every other kind and keeps the column for absent', () => {
    for (const kind of ['pf', 'estimated', 'probable', 'inferred', 'absent'] as const) {
      expect(renderToStaticMarkup(<ProvMark kind={kind} />)).toBe(`<span class="prov-mark ${kind}"></span>`)
    }
  })
})

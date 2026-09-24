import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Field, FieldHelpProvider, ProvMark, State } from './kit'

describe('Field', () => {
  it('keeps the plain wrapping label without help or error', () => {
    expect(
      renderToStaticMarkup(
        <Field label="Speed" unit="kt">
          <input type="number" />
        </Field>,
      ),
    ).toBe(
      '<label class="field"><span>Speed</span><div class="nu-row"><input type="number"/><span class="nu-unit">kt</span></div></label>',
    )
  })

  it('ends the label row in the (i) and hides the help line without a help provider', () => {
    const html = renderToStaticMarkup(
      <Field label="Seed" help="Fixes the random stream.">
        <input />
      </Field>,
    )
    expect(html).toMatch(
      /^<div class="field"><span class="field-label"><label for="([^"]+)">Seed<\/label>/,
    )
    expect(html).toContain('aria-label="About Seed" title="Fixes the random stream."')
    const id = /for="([^"]+)"/.exec(html)![1]
    expect(html).toContain(`<input id="${id}"/>`)
    expect(html).not.toContain('field-help')
  })

  it('renders the help line under a help provider set to true', () => {
    const html = renderToStaticMarkup(
      <FieldHelpProvider value>
        <Field label="Seed" help="Fixes the random stream.">
          <input />
        </Field>
      </FieldHelpProvider>,
    )
    expect(html).toContain('<span class="field-help">Fixes the random stream.</span>')
  })

  it('marks the control invalid and renders the error line', () => {
    const html = renderToStaticMarkup(
      <Field label="Runs" error="Enter a whole number." unit="n">
        <input />
      </Field>,
    )
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('<span class="nu-unit">n</span>')
    expect(html).toContain('<span class="field-error" role="alert">Enter a whole number.</span>')
  })
})

describe('State', () => {
  it('draws the solid square and the word in one tone', () => {
    const html = renderToStaticMarkup(<State tone="nominal">READY</State>)
    expect(html).toBe(
      '<span class="state nominal"><i class="state-square" aria-hidden="true"></i>READY</span>',
    )
  })

  it('draws the hollow square for a qualifying count and the circle for live', () => {
    expect(
      renderToStaticMarkup(
        <State tone="inactive" hollow>
          3 pending
        </State>,
      ),
    ).toContain('class="state-square hollow"')
    expect(
      renderToStaticMarkup(
        <State tone="critical" live>
          LIVE
        </State>,
      ),
    ).toContain('class="state-square live"')
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
    expect(
      renderToStaticMarkup(<ProvMark kind="sourced" title="datasheet · maker · 2026-09-04" />),
    ).toBe(
      '<span class="prov-mark" title="datasheet · maker · 2026-09-04" aria-label="datasheet · maker · 2026-09-04"></span>',
    )
  })

  it('adds one kind class for every other kind and keeps the column for absent', () => {
    for (const kind of ['pf', 'estimated', 'probable', 'inferred', 'absent'] as const) {
      expect(renderToStaticMarkup(<ProvMark kind={kind} />)).toBe(
        `<span class="prov-mark ${kind}"></span>`,
      )
    }
  })
})

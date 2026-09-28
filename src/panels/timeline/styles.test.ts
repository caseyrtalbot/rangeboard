// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  let at = css.indexOf(`\n${selector} {`)
  // Skip a match that ends a longer selector list (the line before ends in a comma).
  while (at > 0 && css[at - 1] === ',') at = css.indexOf(`\n${selector} {`, at + 1)
  expect(at, selector).toBeGreaterThanOrEqual(0)
  return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
}

describe('run timeline styles', () => {
  it('caps the playhead with a 5 px text 1 triangle that moves with it', () => {
    const cap = rule('.runtl-playhead::before')
    expect(cap).toContain('border-top: 5px solid var(--text)')
    expect(cap).toContain('border-left: 3px solid transparent')
    expect(cap).toContain('border-right: 3px solid transparent')
    expect(cap).toContain('width: 1px')
    expect(cap).not.toContain('transition')
    // The cap is part of the playhead box, which the reduced-motion rule stops.
    const reduced = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .runtl-pan'),
    )
    expect(reduced.slice(0, reduced.indexOf('}'))).toContain('.runtl-playhead')
  })

  it('prints the summary label in mono 11 px at an 18 px indent', () => {
    expect(rule('.runtl-summary-name')).toContain('padding-left: 18px')
    const shared = rule('.runtl-sub,\n.runtl-summary-name')
    expect(shared).toContain('font-family: var(--font-mono)')
    expect(shared).toContain('font-size: var(--type-dense-size)')
  })

  it('draws the legend swatches with the strip ink tokens', () => {
    expect(rule('.runtl-sw-hold')).toContain('var(--runtl-sensor)')
    expect(rule('.runtl-sw-dwell')).toContain('var(--runtl-ew)')
    expect(rule('.runtl-sw-mission-kill')).toContain('var(--runtl-ew)')
    expect(rule('.runtl-sw-miss')).toContain('var(--runtl-ghost)')
  })
})

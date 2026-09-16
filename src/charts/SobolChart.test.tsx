import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { UncertainField } from '../analysis/parameterBasis'
import type { SobolResult } from '../playback/mcTypes'
import { SOBOL_FIXTURE } from './__fixtures__/sobolFixture'
import { SobolChart } from './SobolChart'

const labelOf = (f: UncertainField) => `${f.modelId} · ${f.field}`
const html = renderToStaticMarkup(
  <SobolChart result={SOBOL_FIXTURE} labelOf={labelOf} width={312} />,
)

/** Row keys in draw order. */
const drawnRows = (markup: string) =>
  [...markup.matchAll(/data-sobol-row="(\w+)"/g)].map((m) => m[1])

/** Every field in the fixture with both bounds inside the scale. */
const inScale: SobolResult = {
  ...SOBOL_FIXTURE,
  fields: SOBOL_FIXTURE.fields.map((f) => ({
    ...f,
    firstOrder: { ...f.firstOrder, lo: Math.max(0, f.firstOrder.lo) },
  })),
}

describe('SobolChart static markup', () => {
  it('renders the shell and the svg at the given width', () => {
    expect(html).toContain('class="chart chart-sobol"')
    expect(html).toContain('class="chart-sobol-svg"')
    expect(html).toContain('width="312"')
  })

  it('draws a total bar and a first-order bar for every field', () => {
    expect(html.match(/data-role="total"/g)).toHaveLength(SOBOL_FIXTURE.fields.length)
    expect(html.match(/data-role="first-order"/g)).toHaveLength(SOBOL_FIXTURE.fields.length)
    // chart-1 for the total, chart-2 for the first order, from TOKEN_FALLBACK in node.
    expect(html).toContain('fill="#3987e5"')
    expect(html).toContain('fill="#d95926"')
  })

  it('orders the rows by the ranking, not by the field order', () => {
    expect(drawnRows(html)).toEqual(
      SOBOL_FIXTURE.ranking.map((i) => SOBOL_FIXTURE.fields[i].field.field),
    )
    expect(drawnRows(html)).toEqual(['detectRangeM', 'pk', 'rcsM2', 'engageTimeS'])
    expect(drawnRows(html)).not.toEqual(SOBOL_FIXTURE.fields.map((f) => f.field.field))
  })

  it('names the method and its inputs in the copy line', () => {
    expect(html).toContain(
      'Sobol first-order and total indices · Saltelli, base 256, 4 fields, 1536 runs · bootstrap 200 resamples, 95 percent',
    )
  })

  it('draws the fixed 0 to 1 scale with its ticks', () => {
    expect(html.match(/data-role="tick"/g)).toHaveLength(3)
    expect(html).toContain('>0.00</text>')
    expect(html).toContain('>0.50</text>')
    expect(html).toContain('>1.00</text>')
  })

  it('lists the ranking as sentences in the hidden block, in order with its numbers', () => {
    const sentences = [...html.matchAll(/<p>([^<]+)<\/p>/g)].map((m) => m[1])
    expect(sentences).toEqual([
      '1. lib-rps42 · detectRangeM: total 0.42 (0.35 to 0.49), first-order 0.30 (0.24 to 0.36).',
      '2. lib-coyote · pk: total 0.31 (0.25 to 0.38), first-order 0.24 (0.19 to 0.30).',
      '3. lib-mavic3 · rcsM2: total 0.18 (0.13 to 0.24), first-order 0.11 (0.06 to 0.16).',
      '4. lib-coyote · engageTimeS: total 0.09 (0.05 to 0.14), first-order 0.04 (-0.01 to 0.09).',
    ])
    expect(html).toContain('clip-path:inset(50%)')
  })

  it('summarises the chart in the svg aria-label and leaves the detail to the block', () => {
    expect(html).toContain('4 fields ranked by the total index; the ranking follows as text.')
    expect(html).toContain('role="img"')
  })
})

describe('SobolChart bounds outside the scale', () => {
  it('clamps a bootstrap bound to the scale and counts it in the copy line', () => {
    // engageTimeS carries a first-order lower bound of -0.012; the whisker starts at the
    // gutter edge, x = GUTTER_W, and the sentence still reports the estimate.
    const starts = [...html.matchAll(/<line x1="([\d.-]+)"[^>]*data-role="first-order-ci"/g)].map(
      (m) => m[1],
    )
    expect(starts).toHaveLength(4)
    expect(starts[3]).toBe('150')
    expect(html).toContain('· 1 bound clamped to [0, 1]')
  })

  it('says nothing about clamping when every bound is on the scale', () => {
    const clean = renderToStaticMarkup(
      <SobolChart result={inScale} labelOf={labelOf} width={312} />,
    )
    expect(clean).not.toContain('clamped')
    expect(drawnRows(clean)).toEqual(drawnRows(html))
  })
})

describe('SobolChart gutter', () => {
  it('cuts a long label in the middle and keeps the field key whole', () => {
    const long = renderToStaticMarkup(
      <SobolChart
        result={SOBOL_FIXTURE}
        width={312}
        labelOf={(f) => `RPS-42 radar panel (RADA MHR) · ${f.field}`}
      />,
    )
    expect(long).toContain('RPS-42 ra…· detectRangeM')
    expect(long).toContain('RPS-42 ra…RADA MHR) · pk')
    expect(long).not.toContain('>RPS-42 radar panel (RADA MHR) · detectRangeM<')
    // The hidden block still carries the whole label.
    expect(long).toContain('1. RPS-42 radar panel (RADA MHR) · detectRangeM: total 0.42')
  })
})

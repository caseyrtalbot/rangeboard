import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BandSeries, SensitivityResponse, Stat, SweepCell } from '../playback/mcRun'
import type { SweepFactor } from '../playback/sweepFactors'
import { SweepMap } from './SweepMap'

const band = (value: number): BandSeries => ({
  mean: [value],
  lo: [value - 0.1],
  hi: [value + 0.1],
  p10: [],
  p90: [],
  p025: [],
  p975: [],
})
const stat = (value: number): Stat => ({
  mean: value,
  sd: 1,
  se: 0.1,
  lo: value - 1,
  hi: value + 1,
  conf: 0.95,
  interval: 't',
  p10: 0,
  p90: 0,
  p025: 0,
  p975: 0,
  n: 40,
  total: 40,
  defined: { p: 1, lo: 0.9, hi: 1 },
})
const factors: SweepFactor[] = [{ id: 'threatAltitudeFt', values: [100, 200, 300] }]
const cells: SweepCell[] = [0, 3, 6].map((value, i) => ({
  index: [i],
  values: factors[0].values.slice(i, i + 1),
  summary: {
    kills: band(value),
    leakers: band(value),
    firstDetectS: stat(value),
    minWarningS: stat(value),
    perEffector: {},
    replicates: 40,
  },
}))
const render = (response: SensitivityResponse, grid = factors, results = cells, progress = 0) =>
  renderToStaticMarkup(
    <SweepMap
      factors={grid}
      cells={results}
      response={response}
      replicatesPerCell={40}
      durationS={60}
      progress={progress}
    />,
  )
const tones = (html: string) => [...html.matchAll(/data-tone="([^"]+)"/g)].map((m) => m[1])

describe('SweepMap', () => {
  it('uses relative thirds, prints values in ink, labels units and replicate denominator', () => {
    const html = render('leakers')
    expect(tones(html)).toEqual(['nominal', 'warning', 'critical'])
    expect(html).toContain('var(--status-nominal)')
    expect(html).toContain('color:var(--ink)')
    expect(html).toContain('40 replicates per cell')
    expect(html).toContain('nominal 0 to &lt;2; warning 2 to &lt;4; critical 4 to 6')
    expect(html).toContain('Threat altitude (ft AGL)')
    expect(html).toContain('not requirement thresholds')
    expect(html).toContain('95% mean CI')
  })

  it.each(['kills', 'minWarningS'] as const)('reverses the scale for %s', (response) => {
    expect(tones(render(response))).toEqual(['critical', 'warning', 'nominal'])
  })

  it('keeps equal values in the middle and undefined means unpainted', () => {
    expect(tones(render('salvos'))).toEqual(['warning', 'warning', 'warning'])
    const missing = cells.map((c) => ({
      ...c,
      summary: { ...c.summary, minWarningS: { ...c.summary.minWarningS, mean: NaN, n: 0 } },
    }))
    const html = render('minWarningS', factors, missing)
    expect(tones(html)).toEqual(['pending', 'pending', 'pending'])
    expect(html).not.toContain('NaN')
    expect(html).toContain('warning time in 0 of 40')
  })

  it('caps both dimensions and refuses duplicate factors or an oversized grid', () => {
    const six = [1, 2, 3, 4, 5, 6]
    const grid: SweepFactor[] = [
      { id: 'threatAltitudeFt', values: six },
      { id: 'threatSpeedMps', values: six },
    ]
    expect(render('kills', grid, []).match(/data-sweep-cell=/g)).toHaveLength(36)
    for (const invalid of [
      [],
      [{ ...grid[0], values: [1] }],
      [{ ...grid[0], values: [...six, 7] }],
      [...grid, grid[0]],
      [grid[0], grid[0]],
    ]) {
      const html = render('kills', invalid, [])
      expect(html).toContain('role="alert"')
      expect(html).not.toContain('data-sweep-cell=')
    }
  })

  it('marks progress in engine index order without inventing response values', () => {
    const grid: SweepFactor[] = [
      factors[0],
      { id: 'environmentPreset', values: ['clear-day', 'rain-day'] },
    ]
    const html = render('kills', grid, [], 3)
    expect(tones(html)).toEqual([
      'complete',
      'complete',
      'pending',
      'complete',
      'pending',
      'pending',
    ])
    expect(html).toContain('Rain, day')
    expect(html).not.toContain('background:var(--status')
  })

  it('does not color out-of-grid results or missing-asset leakage', () => {
    const extra = { ...cells[0], index: [99], summary: { ...cells[0].summary, kills: band(1000) } }
    expect(tones(render('kills', factors, [...cells, extra]))).toEqual([
      'critical',
      'warning',
      'nominal',
    ])
    const html = renderToStaticMarkup(
      <SweepMap
        factors={factors}
        cells={cells}
        response="leakers"
        replicatesPerCell={40}
        durationS={60}
        hasAsset={false}
      />,
    )
    expect(tones(html)).toEqual(['pending', 'pending', 'pending'])
    expect(html).toContain('No defended asset')
  })
})

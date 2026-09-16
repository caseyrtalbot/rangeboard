import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MORRIS_FIXTURE, SOBOL_FIXTURE } from '../../charts/__fixtures__/sobolFixture'
import { emptyScenario } from '../../model/seed'
import type { MorrisResult } from '../../playback/mcTypes'
import { SensitivityWidget } from './SensitivityWidget'

const scenario = emptyScenario()
const NOTE = 'Morris screening: 10 trajectories over 6 fields, 70 runs; kept 4 for Sobol'

describe('SensitivityWidget with Sobol indices', () => {
  const html = renderToStaticMarkup(
    <SensitivityWidget scenario={scenario} morris={MORRIS_FIXTURE} sobol={SOBOL_FIXTURE} />,
  )

  it('renders the chart and the one-line Morris note', () => {
    expect(html).toContain('data-sensitivity-widget="sobol"')
    expect(html).toContain('class="chart chart-sobol"')
    expect(html).toContain(NOTE)
  })

  it('labels each row with the model name from the scenario library and the field key', () => {
    expect(html).toContain(
      '1. RPS-42 radar panel (RADA MHR) · detectRangeM: total 0.42 (0.35 to 0.49)',
    )
    expect(html).toContain('2. Coyote Block 2 interceptor · pk: total 0.31 (0.25 to 0.38)')
  })

  it('drops the note when Morris is absent', () => {
    const alone = renderToStaticMarkup(
      <SensitivityWidget scenario={scenario} morris={null} sobol={SOBOL_FIXTURE} />,
    )
    expect(alone).toContain('class="chart chart-sobol"')
    expect(alone).not.toContain('Morris screening')
  })
})

describe('SensitivityWidget with Morris only', () => {
  const html = renderToStaticMarkup(
    <SensitivityWidget scenario={scenario} morris={MORRIS_FIXTURE} sobol={null} />,
  )

  it('lists the kept fields by mu star with mu star and sigma', () => {
    expect(html).toContain('data-sensitivity-widget="morris"')
    expect(html).toContain(NOTE)
    expect([...html.matchAll(/data-morris-row="(\w+)"/g)].map((m) => m[1])).toEqual([
      'detectRangeM',
      'pk',
      'rcsM2',
      'engageTimeS',
    ])
    expect(html).toContain('RPS-42 radar panel (RADA MHR) · detectRangeM')
    expect(html).toContain('1.84 <small>sigma 0.62</small>')
    expect(html).toContain('class="insp-row-value mono"')
  })

  it('leaves the screened-out fields off the table', () => {
    expect(html).not.toContain('trackInitS')
    expect(html).not.toContain('targetS')
  })

  it('renders no chart', () => {
    expect(html).not.toContain('chart-sobol')
  })

  it('falls back to the id for a field with no library model', () => {
    const offLibrary: MorrisResult = {
      ...MORRIS_FIXTURE,
      fields: [
        {
          field: {
            modelId: 'doctrine',
            field: 'declareHostileS',
            spread: { kind: 'triangular', lo: -0.3, hi: 0.5 },
          },
          mu: 0.2,
          muStar: 0.31,
          sigma: 0.12,
        },
      ],
      ranking: [0],
      kept: [0],
    }
    const html = renderToStaticMarkup(
      <SensitivityWidget scenario={scenario} morris={offLibrary} sobol={null} />,
    )
    expect(html).toContain('doctrine · declareHostileS')
  })
})

describe('SensitivityWidget with no result', () => {
  it('renders nothing', () => {
    expect(
      renderToStaticMarkup(<SensitivityWidget scenario={scenario} morris={null} sobol={null} />),
    ).toBe('')
  })
})

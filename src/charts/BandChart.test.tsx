import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BandSeries } from '../playback/mcRun'
import type { Series } from './types'
import { BandChart } from './BandChart'

const ensemble: BandSeries = {
  mean: [0, 1, 2],
  lo: [0, 0.5, 1],
  hi: [0, 1.5, 3],
  p10: [],
  p90: [],
  p025: [],
  p975: [],
}
const trial: Series = {
  id: 'trial',
  label: 'Trial',
  unit: 'members',
  values: [0, 1, 3],
  kind: 'step',
  color: 'chart-1',
}

describe('BandChart', () => {
  it('names both series, the mean band, denominator, endpoint and horizon accessibly', () => {
    const html = renderToStaticMarkup(
      <BandChart
        ensemble={ensemble}
        trial={trial}
        durationS={1}
        population={5}
        replicates={40}
        width={312}
      />,
    )
    expect(html).toContain(
      'role="img" aria-label="Kills before arrival, members of 5. Ensemble mean and 95 % band on mean; simulated trial with endpoint marked. Horizon T+0:01."',
    )
    expect(html).toContain('recharts-wrapper')
    expect(html).toContain('Shown through T+0:01')
    expect(html).not.toContain('baseline')
  })

  it('adds the optional dashed baseline to the accessible series description', () => {
    const html = renderToStaticMarkup(
      <BandChart
        ensemble={ensemble}
        trial={trial}
        baseline={{ ...trial, label: 'Pinned baseline mean' }}
        durationS={1}
        population={5}
        replicates={40}
        width={312}
      />,
    )
    expect(html).toContain('Pinned baseline mean, dashed')
    expect(html).toContain('background:var(--text-tertiary)')
  })
})

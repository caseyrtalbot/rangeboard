import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { Entity } from '../../model/types'
import { trackEstimateFixture } from '../../playback/__fixtures__/trackEstimateFixture'
import { useStore } from '../../state/store'
import { PairingLineLayer } from './PairingLineLayer'

// The static markup carries each line's dash, so a hold and a coast tell apart.
vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Line: ({ dash, points }: { dash?: number[]; points: number[] }) => (
    <span
      data-node="pair"
      data-dash={dash ? dash.join(',') : 'solid'}
      data-points={points.map((p) => Math.round(p)).join(',')}
    />
  ),
}))

function lines(html: string): Array<{ dash: string; points: string }> {
  return (html.match(/<span data-node="pair"[^>]*>/g) ?? []).map((tag) => ({
    dash: tag.match(/data-dash="([^"]*)"/)![1],
    points: tag.match(/data-points="([^"]*)"/)![1],
  }))
}

const fixture = trackEstimateFixture()

function render(horizonS: number | null, stepS?: number) {
  return renderToStaticMarkup(
    <PairingLineLayer tracks={fixture} horizonS={horizonS} stepS={stepS} />,
  )
}

beforeEach(() => {
  const scenario = emptyScenario()
  const radar: Entity = {
    id: 'radar',
    name: 'radar',
    kind: 'sensor',
    specId: null,
    pos: { x: 0, y: 0 },
    headingDeg: 0,
    color: null,
    notes: '',
  }
  scenario.entities = [radar]
  useStore.getState().replaceScenario(scenario)
  Object.assign(useStore.getInitialState(), useStore.getState())
})

describe('PairingLineLayer', () => {
  it('draws nothing without a horizon or before the first estimate', () => {
    expect(render(null)).toBe('')
    expect(render(-1)).toBe('')
    expect(renderToStaticMarkup(<PairingLineLayer tracks={undefined} horizonS={2} />)).toBe('')
  })

  it('pairs the radar with the estimate it holds and draws the hold solid', () => {
    // Step 1 (0.5 s): the estimate track is updated; the truth track has no sensor.
    const drawn = lines(render(0.5))
    expect(drawn).toHaveLength(1)
    expect(drawn[0].dash).toBe('solid')
  })

  it('dashes a coasting hold', () => {
    // Steps 4 to 7 coast; at 2.5 s the latest estimate is a coast.
    const drawn = lines(render(2.5))
    const estimate = drawn.find((l) => !l.points.startsWith('0,0,2200'))
    expect(estimate?.dash).toBe('4,4')
  })

  it('pairs a false track too, and skips a track with no sensor', () => {
    // At 2 s the false track (step 4) appears beside the estimate; the truth track never pairs.
    const drawn = lines(render(2))
    expect(drawn).toHaveLength(2)
  })

  it('drops a track older than one sweep step at the horizon', () => {
    // The false track has one entry at 2 s; at 4 s with a 0.5 s step only the estimate pairs.
    expect(lines(render(4, 0.5))).toHaveLength(1)
    expect(lines(render(4))).toHaveLength(2)
  })

  it('trims both ends off the sensor and the track', () => {
    const [line] = lines(render(0.5))
    const [x1, y1, x2] = line.points.split(',').map(Number)
    // The estimate sits at (1050, 400) at 0.5 s; both ends move inward along the line.
    expect(x1).toBeGreaterThan(0)
    expect(y1).toBeGreaterThan(0)
    expect(x2).toBeLessThan(1050)
  })
})

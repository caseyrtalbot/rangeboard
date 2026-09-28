import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import { trackEstimateFixture } from '../../playback/__fixtures__/trackEstimateFixture'
import { useStore } from '../../state/store'
import { TrackLayer } from './TrackLayer'
import { TRACK_ESTIMATE_INK, TRACK_FALSE_INK } from './footprintStyle'

// The Konva attrs the assertions read come back as data attributes, so the
// static markup carries the drawn radii, rotation, dash and ink.
vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Line: ({ stroke }: { stroke?: string }) => <span data-node="marker" data-stroke={stroke} />,
  Ellipse: (p: {
    radiusX: number
    radiusY: number
    rotation: number
    stroke?: string
    dash?: number[]
  }) => (
    <span
      data-node="ellipse"
      data-rx={String(p.radiusX)}
      data-ry={String(p.radiusY)}
      data-rot={String(p.rotation)}
      data-stroke={p.stroke}
      data-dash={p.dash ? p.dash.join(',') : 'solid'}
    />
  ),
}))

interface EllipseAttrs {
  rx: number
  ry: number
  rot: number
  stroke: string
  dash: string
}

function ellipses(html: string): EllipseAttrs[] {
  const out: EllipseAttrs[] = []
  for (const tag of html.match(/<span data-node="ellipse"[^>]*>/g) ?? []) {
    const read = (name: string) => tag.match(new RegExp(`data-${name}="([^"]*)"`))![1]
    out.push({
      rx: Number(read('rx')),
      ry: Number(read('ry')),
      rot: Number(read('rot')),
      stroke: read('stroke'),
      dash: read('dash'),
    })
  }
  return out
}

function markerStrokes(html: string): string[] {
  return (html.match(/<span data-node="marker" data-stroke="([^"]*)"/g) ?? []).map(
    (tag) => tag.match(/data-stroke="([^"]*)"/)![1],
  )
}

const fixture = trackEstimateFixture()

function render(horizonS: number | null, tracks = fixture) {
  return renderToStaticMarkup(<TrackLayer tracks={tracks} horizonS={horizonS} />)
}

beforeEach(() => {
  useStore.getState().replaceScenario(emptyScenario())
  Object.assign(useStore.getInitialState(), useStore.getState())
})

describe('TrackLayer', () => {
  it('draws nothing without a horizon or tracks', () => {
    expect(render(null)).toBe('')
    expect(render(2, [])).toBe('')
    expect(renderToStaticMarkup(<TrackLayer tracks={undefined} horizonS={2} />)).toBe('')
    // Before the first estimate the layer is empty, not a stale picture.
    expect(render(-1)).toBe('')
  })

  it('shrinks the ellipse over the measurement run and grows it on the coast', () => {
    // Step 0 at 0 s (sigma 60 m), step 3 at 1.5 s (sigma 24 m, the last hit),
    // step 7 at 3.5 s (sigma 58 m, the last coasting step).
    const open = ellipses(render(0)).find((e) => e.stroke === TRACK_ESTIMATE_INK)!
    const tight = ellipses(render(1.5)).find((e) => e.stroke === TRACK_ESTIMATE_INK)!
    const coasted = ellipses(render(3.5)).find((e) => e.stroke === TRACK_ESTIMATE_INK)!
    expect(tight.rx).toBeLessThan(open.rx)
    expect(tight.ry).toBeLessThan(open.ry)
    expect(coasted.rx).toBeGreaterThan(tight.rx)
    expect(coasted.ry).toBeGreaterThan(tight.ry)
    // The correlated block turns the major axis off the x axis.
    expect(tight.rot).toBeGreaterThan(0)
    expect(tight.rx).toBeGreaterThan(tight.ry)
  })

  it('dashes a coasting track and draws an updated track solid', () => {
    expect(ellipses(render(1.5))[0].dash).toBe('solid')
    expect(ellipses(render(3.5))[0].dash).toBe('4,4')
    // The two updates after the coast return the track to a solid ellipse.
    expect(ellipses(render(4.5))[0].dash).toBe('solid')
  })

  it('draws a truth track as the marker alone and a false track in the muted ink', () => {
    // At 1.5 s only the estimate and truth tracks exist. Each marker is a
    // two-arm cross, so two tracks give four lines and one ellipse.
    const early = render(1.5)
    expect(markerStrokes(early)).toEqual(Array(4).fill(TRACK_ESTIMATE_INK))
    expect(ellipses(early)).toHaveLength(1)
    // The false track opens at 2 s and takes the muted ink on both nodes.
    const late = render(2)
    expect(ellipses(late).map((e) => e.stroke)).toEqual([TRACK_ESTIMATE_INK, TRACK_FALSE_INK])
    expect(markerStrokes(late)).toContain(TRACK_FALSE_INK)
  })

  it('drops a track older than one sweep step at the horizon when the step is known', () => {
    const stale = (horizonS: number) =>
      renderToStaticMarkup(<TrackLayer tracks={fixture} horizonS={horizonS} stepS={0.5} />)
    // The truth track has entries at 0 and 4.5 s only: at 1.5 s it is three
    // steps old and leaves the board; the estimate track updated at 1.5 s stays.
    expect(markerStrokes(stale(1.5))).toEqual(Array(2).fill(TRACK_ESTIMATE_INK))
    expect(ellipses(stale(1.5))).toHaveLength(1)
    // The false track has one entry at 2 s: it draws within one step of it, then leaves.
    expect(markerStrokes(stale(2.4))).toContain(TRACK_FALSE_INK)
    expect(markerStrokes(stale(2.6))).not.toContain(TRACK_FALSE_INK)
    // The estimate and truth histories end at 4.5 s: past one step nothing draws.
    expect(markerStrokes(stale(4.9))).toHaveLength(4)
    expect(stale(5.1)).toBe('')
    // Without the step the latest entry per track draws whatever its age.
    expect(markerStrokes(render(5.1))).toHaveLength(6)
  })

  it('renders nothing past the horizon', () => {
    // The last estimate before 2 s is step 4 at 2 s; the later, larger
    // covariances must not reach the board.
    const atTwo = ellipses(render(2)).find((e) => e.stroke === TRACK_ESTIMATE_INK)!
    const atEnd = ellipses(render(4.5)).find((e) => e.stroke === TRACK_ESTIMATE_INK)!
    expect(atTwo.rx).not.toBe(atEnd.rx)
    // One node set per track id, never one per captured entry.
    expect(ellipses(render(4.5))).toHaveLength(2)
    expect(markerStrokes(render(4.5))).toHaveLength(6)
    // The false track at 2 s stays off the board at 1.9 s.
    expect(ellipses(render(1.9)).some((e) => e.stroke === TRACK_FALSE_INK)).toBe(false)
  })
})

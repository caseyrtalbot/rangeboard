import { describe, expect, it } from 'vitest'
import { tickStepS } from './timeAxis'
import {
  DEFAULT_WINDOW_S,
  FOLLOW_AT,
  MIN_WINDOW_S,
  ZOOM_STEP,
  clampViewport,
  followViewport,
  viewportTicks,
  xOf,
  zoomViewport,
} from './timeViewport'

describe('constants', () => {
  it('match SPEC 1.3', () => {
    expect([DEFAULT_WINDOW_S, MIN_WINDOW_S, FOLLOW_AT, ZOOM_STEP]).toEqual([120, 10, 2 / 3, 1.5])
  })
})

describe('clampViewport', () => {
  it('returns the same object when nothing changes', () => {
    const v = { t0S: 30, winS: 120 }
    expect(clampViewport(v, 488)).toBe(v)
  })

  it('clamps t0 below 0 and a window past the duration end', () => {
    expect(clampViewport({ t0S: -5, winS: 120 }, 488)).toEqual({ t0S: 0, winS: 120 })
    expect(clampViewport({ t0S: 400, winS: 120 }, 488)).toEqual({ t0S: 368, winS: 120 })
  })

  it('clamps the window into [MIN_WINDOW_S, duration]', () => {
    expect(clampViewport({ t0S: 50, winS: 4 }, 488)).toEqual({ t0S: 50, winS: 10 })
    expect(clampViewport({ t0S: 50, winS: 900 }, 488)).toEqual({ t0S: 0, winS: 488 })
  })

  it('lets a run shorter than 10 s show the whole run', () => {
    expect(clampViewport({ t0S: 2, winS: 120 }, 6)).toEqual({ t0S: 0, winS: 6 })
    expect(clampViewport({ t0S: 0, winS: 1 }, 6)).toEqual({ t0S: 0, winS: 6 })
  })

  it('gives the minimum window at 0 for a zero or invalid duration', () => {
    expect(clampViewport({ t0S: 40, winS: 120 }, 0)).toEqual({ t0S: 0, winS: 10 })
    expect(clampViewport({ t0S: 40, winS: 120 }, Number.NaN)).toEqual({ t0S: 0, winS: 10 })
  })
})

describe('followViewport', () => {
  it('holds the playhead at two thirds mid-run', () => {
    const v = followViewport({ t0S: 0, winS: 120 }, 200, 488)
    expect(v).toEqual({ t0S: 120, winS: 120 })
    expect(xOf(v, 300)(200)).toBeCloseTo(200)
  })

  it('clamps at the run start and end', () => {
    expect(followViewport({ t0S: 50, winS: 120 }, 30, 488)).toEqual({ t0S: 0, winS: 120 })
    expect(followViewport({ t0S: 0, winS: 120 }, 480, 488)).toEqual({ t0S: 368, winS: 120 })
  })
})

describe('zoomViewport', () => {
  it('keeps the anchor at the same x when zooming in and out', () => {
    const v = { t0S: 100, winS: 120 }
    const anchor = 140
    const before = xOf(v, 300)(anchor)
    const zin = zoomViewport(v, 1 / ZOOM_STEP, anchor, 488)
    const zout = zoomViewport(v, ZOOM_STEP, anchor, 488)
    expect(zin.winS).toBeCloseTo(80)
    expect(zout.winS).toBeCloseTo(180)
    expect(xOf(zin, 300)(anchor)).toBeCloseTo(before)
    expect(xOf(zout, 300)(anchor)).toBeCloseTo(before)
  })

  it('returns the same object at the minimum and maximum window', () => {
    const atMin = { t0S: 100, winS: 10 }
    expect(zoomViewport(atMin, 1 / ZOOM_STEP, 105, 488)).toBe(atMin)
    const atMax = { t0S: 0, winS: 488 }
    expect(zoomViewport(atMax, ZOOM_STEP, 200, 488)).toBe(atMax)
    // At a limit, a window past the run end still comes back clamped.
    expect(zoomViewport({ t0S: 480, winS: 10 }, 1 / ZOOM_STEP, 485, 488)).toEqual({
      t0S: 478,
      winS: 10,
    })
  })

  it('clamps t0 to 0 when zooming out near the start', () => {
    expect(zoomViewport({ t0S: 5, winS: 120 }, ZOOM_STEP, 100, 488)).toEqual({
      t0S: 0,
      winS: 180,
    })
  })
})

describe('viewportTicks', () => {
  it('gives multiples of the step inside the window, at least 70 px apart', () => {
    for (const widthPx of [200, 312, 640, 1200]) {
      for (const v of [
        { t0S: 0, winS: 10 },
        { t0S: 33.3, winS: 120 },
        { t0S: 100, winS: 488 },
        { t0S: 1234.5, winS: 3000 },
      ]) {
        const step = tickStepS(v.winS, widthPx)
        const ticks = viewportTicks(v, widthPx)
        expect(ticks.length).toBeGreaterThan(0)
        const x = xOf(v, widthPx)
        for (const t of ticks) {
          expect(t % step).toBe(0)
          expect(t).toBeGreaterThanOrEqual(v.t0S)
          expect(t).toBeLessThanOrEqual(v.t0S + v.winS)
        }
        for (let i = 1; i < ticks.length; i++) {
          expect(x(ticks[i]) - x(ticks[i - 1])).toBeGreaterThanOrEqual(70)
        }
      }
    }
  })

  it('includes both window edges when they land on a step', () => {
    expect(viewportTicks({ t0S: 30, winS: 120 }, 300)).toEqual([30, 60, 90, 120, 150])
  })

  it('keeps tick times fixed across a pan', () => {
    const a = viewportTicks({ t0S: 100, winS: 120 }, 300)
    const b = viewportTicks({ t0S: 147, winS: 120 }, 300)
    const shared = b.filter((t) => t <= 220)
    expect(shared.length).toBeGreaterThan(0)
    for (const t of shared) expect(a).toContain(t)
  })

  it('is empty for a zero width', () => {
    expect(viewportTicks({ t0S: 0, winS: 120 }, 0)).toEqual([])
  })
})

describe('xOf', () => {
  it('maps the window edges to 0 and the width', () => {
    const x = xOf({ t0S: 37.5, winS: 90 }, 412)
    expect(x(37.5)).toBe(0)
    expect(x(127.5)).toBe(412)
  })
})

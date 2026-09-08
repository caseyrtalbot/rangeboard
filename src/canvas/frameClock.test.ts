import { describe, expect, it } from 'vitest'
import { displayTimeAt, nextPublishedTimeS, PUBLISH_PERIOD_MS } from './frameClock'

describe('nextPublishedTimeS', () => {
  it('publishes nothing inside the period', () => {
    expect(nextPublishedTimeS(10, 1, 0)).toBeNull()
    expect(nextPublishedTimeS(10, 30, PUBLISH_PERIOD_MS - 0.01)).toBeNull()
  })

  it('advances by the measured wall time at playback speed, not a nominal step', () => {
    expect(nextPublishedTimeS(10, 1, PUBLISH_PERIOD_MS)).toBeCloseTo(10.1, 9)
    expect(nextPublishedTimeS(10, 30, PUBLISH_PERIOD_MS)).toBeCloseTo(13, 9)
    // A slow frame publishes late and covers the whole gap, so the clock does not drift.
    expect(nextPublishedTimeS(10, 5, 130)).toBeCloseTo(10.65, 9)
  })
})

describe('displayTimeAt', () => {
  it('equals the published time at the instant of publication', () => {
    expect(displayTimeAt(10, 0, 30, 500)).toBe(10)
  })

  it('runs ahead at playback speed and clamps to one period', () => {
    expect(displayTimeAt(10, 50, 1, 500)).toBeCloseTo(10.05, 9)
    expect(displayTimeAt(10, 50, 30, 500)).toBeCloseTo(11.5, 9)
    expect(displayTimeAt(10, 250, 30, 500)).toBeCloseTo(13, 9)
  })

  it('never passes the duration and never runs backward', () => {
    expect(displayTimeAt(499.95, 90, 30, 500)).toBe(500)
    expect(displayTimeAt(10, -5, 1, 500)).toBe(10)
    // Monotone across a late publication: the new published time covers the whole gap.
    const shown = displayTimeAt(10, 140, 5, 500)
    const published = nextPublishedTimeS(10, 5, 140)!
    expect(published).toBeGreaterThanOrEqual(shown)
  })
})

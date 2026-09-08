import { describe, expect, it } from 'vitest'
import { nextPublishedTimeS, PUBLISH_PERIOD_MS } from './frameClock'

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


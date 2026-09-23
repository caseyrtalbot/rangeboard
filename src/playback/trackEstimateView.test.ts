import { describe, expect, it } from 'vitest'
import {
  covarianceOf,
  estimateTrackHistory,
  trackEstimateFixture,
} from './__fixtures__/trackEstimateFixture'
import { mixedTrial } from './__fixtures__/trialFixture'
import { boundRetainedTrial } from './retainTrial'
import { latestEstimatesAt, positionEllipse } from './trackEstimateView'
import type { Covariance4, TrackEstimate } from './trackTypes'

/** The fields a bound entry keeps, as JSON, so a ledger row compares to a plain one. */
const picture = (tracks: TrackEstimate[]) =>
  JSON.parse(
    JSON.stringify(
      tracks.map(({ sensorIds: _sensorIds, covariance, ...track }) => ({
        ...track,
        covariance: [covariance[0], covariance[1], covariance[5]],
      })),
    ),
  )

/** A 4x4 block from the three position entries; the rest stays zero. */
function positionBlock(varX: number, covXY: number, varY: number): Covariance4 {
  const cov = new Array<number>(16).fill(0)
  cov[0] = varX
  cov[1] = covXY
  cov[4] = covXY
  cov[5] = varY
  return cov
}

describe('positionEllipse', () => {
  it('returns the sigmas of a diagonal block at angle 0', () => {
    // var(x) 9 and var(y) 4 with no correlation: the axes are the sigmas 3
    // and 2, and the major axis already lies along +x.
    const e = positionEllipse(positionBlock(9, 0, 4))
    expect(e).not.toBeNull()
    expect(e!.semiMajorM).toBeCloseTo(3, 12)
    expect(e!.semiMinorM).toBeCloseTo(2, 12)
    expect(e!.angleDeg).toBeCloseTo(0, 12)
  })

  it('turns the major axis to +y when the y variance leads', () => {
    const e = positionEllipse(positionBlock(4, 0, 9))
    expect(e!.semiMajorM).toBeCloseTo(3, 12)
    expect(e!.angleDeg).toBeCloseTo(90, 12)
  })

  it('matches a hand-computed eigenpair on an off-diagonal block', () => {
    // [[4, 1.2], [1.2, 1]]: mid = (4 + 1) / 2 = 2.5, half = (4 - 1) / 2 = 1.5,
    // radius = hypot(1.5, 1.2) = sqrt(2.25 + 1.44) = sqrt(3.69) = 1.920937271...
    // lambdaMax = 2.5 + 1.920937271 = 4.420937271, sqrt = 2.102602499...
    // lambdaMin = 2.5 - 1.920937271 = 0.579062729, sqrt = 0.760961713...
    // angle = 0.5 * atan2(2.4, 3) = 0.5 * 0.674740942 rad
    //       = 0.337370471 rad * 180 / pi = 19.329904...deg
    const e = positionEllipse(positionBlock(4, 1.2, 1))
    expect(e!.semiMajorM).toBeCloseTo(2.1026025, 6)
    expect(e!.semiMinorM).toBeCloseTo(0.7609617, 6)
    expect(e!.angleDeg).toBeCloseTo(19.3299041, 6)
  })

  it('scales both axes by the sigma multiple', () => {
    const one = positionEllipse(positionBlock(9, 0, 4))!
    const two = positionEllipse(positionBlock(9, 0, 4), 2)!
    expect(two.semiMajorM).toBeCloseTo(one.semiMajorM * 2, 12)
    expect(two.semiMinorM).toBeCloseTo(one.semiMinorM * 2, 12)
    expect(two.angleDeg).toBeCloseTo(one.angleDeg, 12)
  })

  it('returns null for a zero block, a non-PSD block and a non-finite block', () => {
    expect(positionEllipse(positionBlock(0, 0, 0))).toBeNull()
    // det = 1 * 1 - 4 = -3: one eigenvalue is negative, so this is no covariance.
    expect(positionEllipse(positionBlock(1, 2, 1))).toBeNull()
    expect(positionEllipse(positionBlock(-4, 0, -1))).toBeNull()
    expect(positionEllipse(positionBlock(Number.NaN, 0, 1))).toBeNull()
  })

  it('reads the position block of a full 4x4 and ignores the velocity block', () => {
    const cov = covarianceOf(3, 2, 0)
    const e = positionEllipse(cov)!
    expect(e.semiMajorM).toBeCloseTo(3, 12)
    expect(e.semiMinorM).toBeCloseTo(2, 12)
  })
})

describe('latestEstimatesAt', () => {
  it('returns nothing without tracks', () => {
    expect(latestEstimatesAt(undefined, 10)).toEqual([])
    expect(latestEstimatesAt([], 10)).toEqual([])
  })

  it('censors at the horizon and keeps the latest entry per id', () => {
    const fixture = trackEstimateFixture()
    const at = (h: number) => latestEstimatesAt(fixture, h)
    for (const horizonS of [0, 1.5, 2.5, 4.5]) {
      for (const track of at(horizonS)) expect(track.state.tS).toBeLessThanOrEqual(horizonS)
    }
    // Before the first entry nothing has been tracked.
    expect(at(-0.1)).toEqual([])
    // The estimate and truth tracks both start at 0; the false track starts at 2.
    expect(at(0).map((t) => t.id)).toEqual(['trk-est', 'trk-truth'])
    expect(at(1.9).map((t) => t.id)).toEqual(['trk-est', 'trk-truth'])
    expect(at(2).map((t) => t.id)).toEqual(['trk-est', 'trk-truth', 'trk-false'])
    // One row per id, never one row per entry.
    expect(at(4.5)).toHaveLength(3)
    const est = at(4.5).find((t) => t.id === 'trk-est')!
    expect(est.state.tS).toBe(4.5)
    expect(at(2.2).find((t) => t.id === 'trk-est')!.state.tS).toBe(2)
  })

  it('keeps first-appearance order of the entries that pass the horizon', () => {
    const [a0, a1] = estimateTrackHistory()
    const other = { ...a0, id: 'trk-other', state: { ...a0.state, tS: 0.25 } }
    // 'trk-other' appears second in the array but first at a horizon of 0.4,
    // because the only earlier 'trk-est' entry also passes.
    expect(latestEstimatesAt([a0, other, a1], 0.4).map((t) => t.id)).toEqual([
      'trk-est',
      'trk-other',
    ])
    // At a horizon that drops the first 'trk-est' entry, order follows what is left.
    expect(
      latestEstimatesAt([{ ...a0, state: { ...a0.state, tS: 9 } }, other], 1).map((t) => t.id),
    ).toEqual(['trk-other'])
  })

  it('reads a bound ledger as it reads the plain array', () => {
    const { result } = mixedTrial()
    const [a0, a1] = estimateTrackHistory()
    const other = { ...a0, id: 'trk-other', state: { ...a0.state, tS: 0.25 } }
    // The tracker's time-ordered history, then a hand-built one out of order with a tie.
    for (const tracks of [trackEstimateFixture(), [a1, other, a0, { ...a0, hits: 9 }]]) {
      const bound = boundRetainedTrial({ ...result, tracks }).tracks!
      // Between entries, at the first entry, before any entry, past every entry.
      for (const horizonS of [2.2, 0.4, 0, -0.1, 9]) {
        expect(picture(latestEstimatesAt(bound, horizonS))).toEqual(
          picture(latestEstimatesAt(tracks, horizonS)),
        )
      }
    }
  })
})

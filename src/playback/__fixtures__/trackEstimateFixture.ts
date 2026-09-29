import type { Covariance4, TrackEstimate } from '../trackTypes'

/**
 * A track history the board layer can draw before lane 2.2 produces real
 * estimates. One estimate track walks east at 0.5 s steps: four measurement
 * updates shrink its position sigma, four coasting steps grow it, and two
 * more updates shrink it again. A truth track (no covariance) and a false
 * track ride alongside.
 */

/** Step interval of the fixture history, seconds. */
const FIXTURE_STEP_S = 0.5

/** Position 1 sigma along x per step, meters: fall, grow on coast, fall again. */
const SIGMA_X_M = [60, 45, 33, 24, 30, 38, 47, 58, 40, 28]
/** The along-track sigma runs narrower than the cross-track one. */
const SIGMA_RATIO = 0.6
/** A steady x-y correlation, so the ellipse carries a real bearing. */
const RHO = 0.3
/** Steps 4 through 7 predict without a measurement. */
const COAST_FROM = 4
const COAST_TO = 7

/** Flat row-major 4x4 covariance from a position sigma pair and their correlation. */
export function covarianceOf(sigmaXM: number, sigmaYM: number, rho: number): Covariance4 {
  const cov = new Array<number>(16).fill(0)
  cov[0] = sigmaXM * sigmaXM
  cov[1] = rho * sigmaXM * sigmaYM
  cov[4] = cov[1]
  cov[5] = sigmaYM * sigmaYM
  cov[10] = 4
  cov[15] = 4
  return cov
}

/** The ten-step estimate track, oldest entry first. */
export function estimateTrackHistory(): TrackEstimate[] {
  let hits = 0
  return SIGMA_X_M.map((sigmaXM, step) => {
    const coasting = step >= COAST_FROM && step <= COAST_TO
    if (!coasting) hits++
    return {
      id: 'trk-est',
      uasId: 'threat-1',
      sensorIds: ['radar'],
      state: { x: 1000 + step * 50, y: 400, vx: 100, vy: 0, tS: step * FIXTURE_STEP_S },
      covariance: covarianceOf(sigmaXM, sigmaXM * SIGMA_RATIO, RHO),
      quality: 1 / (1 + sigmaXM / 100),
      hits,
      misses: coasting ? step - COAST_FROM + 1 : 0,
      coasting,
      source: 'estimate',
    }
  })
}

/** A truth path track: no error, so the layer draws its marker and no ellipse. */
function truthTrackHistory(): TrackEstimate[] {
  return [0, 9].map((step) => ({
    id: 'trk-truth',
    uasId: 'threat-1',
    sensorIds: [],
    state: { x: 1000 + step * 50, y: 400, vx: 100, vy: 0, tS: step * FIXTURE_STEP_S },
    covariance: new Array<number>(16).fill(0) as Covariance4,
    quality: 1,
    hits: step + 1,
    misses: 0,
    coasting: false,
    source: 'truth' as const,
  }))
}

/** A false alarm track: no target, drawn in the muted ink. */
function falseTrackHistory(): TrackEstimate[] {
  return [
    {
      id: 'trk-false',
      uasId: null,
      sensorIds: ['radar'],
      state: { x: 2200, y: 900, vx: 0, vy: 0, tS: 4 * FIXTURE_STEP_S },
      covariance: covarianceOf(120, 120, 0),
      quality: 0.2,
      hits: 1,
      misses: 0,
      coasting: false,
      source: 'false',
    },
  ]
}

/** Every fixture track, interleaved the way a tracker appends them. */
export function trackEstimateFixture(): TrackEstimate[] {
  return [...estimateTrackHistory(), ...truthTrackHistory(), ...falseTrackHistory()].sort(
    (a, b) => a.state.tS - b.state.tS,
  )
}

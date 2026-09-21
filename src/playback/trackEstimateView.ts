/**
 * Read-side helpers for the track estimates a trial captured. The board layer
 * and any panel that reports a track read the same two functions.
 *
 * Board frame throughout: +x east, +y south, angles measured from +x toward
 * +y, meters and seconds.
 */

import type { Covariance4, TrackEstimate } from './trackTypes'

/**
 * The latest estimate per track id at or before the horizon, in the order the
 * ids first appear among the entries that pass the horizon. An estimate past
 * the horizon never returns: outcome censoring is a board rule, so a paused
 * or bounded run shows no future knowledge.
 */
export function latestEstimatesAt(
  tracks: readonly TrackEstimate[] | undefined,
  horizonS: number,
): TrackEstimate[] {
  if (!tracks || tracks.length === 0) return []
  const order: string[] = []
  const latest = new Map<string, TrackEstimate>()
  for (const track of tracks) {
    if (!(track.state.tS <= horizonS)) continue
    const held = latest.get(track.id)
    if (!held) order.push(track.id)
    // Ties go to the later entry: the tracker appends in update order.
    if (!held || track.state.tS >= held.state.tS) latest.set(track.id, track)
  }
  return order.map((id) => latest.get(id)!)
}

/** Semi-axes in meters and the major-axis bearing of a position error ellipse. */
export interface PositionEllipse {
  semiMajorM: number
  semiMinorM: number
  /** Major axis, degrees from +x toward +y. */
  angleDeg: number
}

/**
 * The `sigmas` error ellipse of the position block of a 4x4 covariance:
 * `cov[0]` var(x), `cov[1]` cov(x, y), `cov[5]` var(y). The semi-axes are the
 * square roots of the eigenvalues scaled by `sigmas`, and the angle is the
 * major eigenvector's.
 *
 * Null when the block is all zeros (a truth path carries no error, so the
 * layer draws a point) or when the block is not positive semidefinite.
 */
export function positionEllipse(cov: Covariance4, sigmas = 1): PositionEllipse | null {
  const varX = cov[0]
  const covXY = cov[1]
  const varY = cov[5]
  if (!Number.isFinite(varX) || !Number.isFinite(covXY) || !Number.isFinite(varY)) return null
  if (varX === 0 && covXY === 0 && varY === 0) return null

  // Eigenvalues of [[varX, covXY], [covXY, varY]]: the trace midpoint plus and
  // minus the radius hypot((varX - varY) / 2, covXY).
  const mid = (varX + varY) / 2
  const half = (varX - varY) / 2
  const radius = Math.hypot(half, covXY)
  const lambdaMax = mid + radius
  const lambdaMin = mid - radius
  // A covariance built by a filter can land a hair below zero; anything worse
  // is not a covariance and draws nothing.
  const tolerance = Math.max(Math.abs(varX) + Math.abs(varY), 1) * 1e-12
  if (lambdaMin < -tolerance || lambdaMax <= 0) return null

  return {
    semiMajorM: sigmas * Math.sqrt(lambdaMax),
    semiMinorM: sigmas * Math.sqrt(Math.max(lambdaMin, 0)),
    // atan2 of the eigenvector equation, halved: the major axis of a 2x2
    // symmetric block sits at 0.5 * atan2(2 * covXY, varX - varY).
    angleDeg: (Math.atan2(2 * covXY, varX - varY) / 2) * (180 / Math.PI),
  }
}

import type { McdaVector } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'

/**
 * Weighted single-value configuration score, after the COURAGEOUS project
 * general model S_i = sum(w_j * a_ij) (Remote Sens. 2024, 16, 3714, eq. 1).
 * Each part is a 0-1 score over the threats that have flight paths.
 */

/** Warning time that earns a full score, seconds. */
export const WARNING_FULL_S = 300

/** Normalized 0-1 scores per requirement, or null when no threat has a path. */
export function mcdaParts(assessments: ThreatAssessment[]): McdaVector | null {
  const threats = assessments.filter((a) => a.status !== 'no-path')
  if (threats.length === 0) return null
  const n = threats.length
  const detected = threats.filter((a) => a.firstDetectS != null).length
  const confirmed = threats.filter((a) => a.firstConfirmS != null).length
  const engageable = threats.filter((a) => a.status === 'engageable').length
  const warning =
    threats.reduce(
      (sum, a) => sum + Math.min(Math.max(a.warningS ?? 0, 0), WARNING_FULL_S) / WARNING_FULL_S,
      0,
    ) / n
  return { warning, coverage: detected / n, confirm: confirmed / n, engage: engageable / n }
}

/** Weighted total, 0-100. */
export function mcdaScore(parts: McdaVector, weights: McdaVector): number {
  const sumW = weights.warning + weights.coverage + weights.confirm + weights.engage
  if (sumW <= 0) return 0
  const s =
    weights.warning * parts.warning +
    weights.coverage * parts.coverage +
    weights.confirm * parts.confirm +
    weights.engage * parts.engage
  return Math.round((s / sumW) * 100)
}

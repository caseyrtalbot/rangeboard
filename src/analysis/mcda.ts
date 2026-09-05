import type { McdaVector } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport } from '../playback/attritionReport'

/**
 * Weighted single-value configuration score, after the COURAGEOUS project
 * general model S_i = sum(w_j * a_ij) (Remote Sens. 2024, 16, 3714, eq. 1).
 * Each part is a 0-1 score over the threats that have flight paths.
 */

/** Warning time that earns a full score, seconds. */
export const WARNING_FULL_S = 300

/** Normalized 0-1 scores per requirement, or null when no threat has a path. */
export function mcdaParts(
  assessments: ThreatAssessment[],
  attrition?: AttritionReport | null,
): McdaVector | null {
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
  const parts: McdaVector = {
    warning,
    coverage: detected / n,
    confirm: confirmed / n,
    engage: engageable / n,
  }
  // Attrition part: expected kill fraction of the raid (1 - mean leak probability).
  // expectedKills is PRE-ARRIVAL mass only (late intercepts sit in
  // expectedLateKills), so this ratio is the true defeat rate the score claims.
  if (attrition && attrition.totals.raidSize > 0) {
    parts.attrition = attrition.totals.expectedKills / attrition.totals.raidSize
  }
  return parts
}

/** Weighted total, 0-100. The attrition term joins only when the part exists. */
export function mcdaScore(parts: McdaVector, weights: McdaVector): number {
  const wAttrition = parts.attrition != null ? (weights.attrition ?? 0) : 0
  const sumW = weights.warning + weights.coverage + weights.confirm + weights.engage + wAttrition
  if (sumW <= 0) return 0
  const s =
    weights.warning * parts.warning +
    weights.coverage * parts.coverage +
    weights.confirm * parts.confirm +
    weights.engage * parts.engage +
    wAttrition * (parts.attrition ?? 0)
  return Math.round((s / sumW) * 100)
}

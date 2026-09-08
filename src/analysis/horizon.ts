/** Latest simulation time whose outcomes may show. Scoped only in Execute. */
export interface ExecutionHorizon {
  scoped: boolean
  horizonS: number
}

export const FULL_RUN: ExecutionHorizon = Object.freeze({ scoped: false, horizonS: Infinity })
export const EMPTY_HORIZON: ExecutionHorizon = Object.freeze({ scoped: true, horizonS: -Infinity })

export const FORECAST_IN_ANALYZE = 'Forecast available in Analyze'

export function reached(tS: number | null | undefined, h: ExecutionHorizon): boolean {
  return tS != null && tS <= h.horizonS
}

/** Number of leading samples reached on an increasing time grid (dtS > 0). */
export function visibleCount(length: number, t0S: number, dtS: number, h: ExecutionHorizon): number {
  if (length === 0 || !h.scoped) return length
  // Compare grid times directly, including at floating-point sample boundaries.
  let lo = 0
  let hi = length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (reached(t0S + mid * dtS, h)) lo = mid + 1
    else hi = mid
  }
  return lo
}


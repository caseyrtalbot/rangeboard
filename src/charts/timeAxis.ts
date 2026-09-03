/** Candidate tick spacings, seconds. */
export const TICK_STEPS = [10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

/**
 * First step whose pixel spacing reaches 70 px, else 7200. Moved verbatim from
 * EngagementStrip.tsx.
 */
export function tickStepS(durationS: number, widthPx: number): number {
  for (const s of TICK_STEPS) if ((s / durationS) * widthPx >= 70) return s
  return 7200
}

/** Tick times from 0 to durationS at tickStepS, inclusive of 0. */
export function timeTicks(durationS: number, widthPx: number): number[] {
  const out = [0]
  if (!(durationS > 0)) return out
  const step = tickStepS(durationS, widthPx)
  for (let t = step; t <= durationS; t += step) out.push(t)
  return out
}

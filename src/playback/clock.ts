/** Engine sample step, seconds. The one DT source for the sweep, the series builders and the chart kit. */
export const DT = 0.5

/**
 * DT step count of a sample time, rounded; two samples DT apart never share
 * it. The engine's samples can sit off the grid (t = delayS + k * DT), so a
 * rounded count, not a grid placement, keys a draw (series.ts keeps its own
 * grid placement, a different question).
 */
export function stepIndex(tS: number): number {
  return Math.round(tS / DT)
}

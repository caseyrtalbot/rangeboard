/**
 * Run-timeline arithmetic (MASTER-CALCULATIONS 3.2).
 * Elapsed time = stop-event time - start-event time; the timing decision rule
 * makes a result borderline when available equals required within the
 * approved uncertainty band (10 s2.4).
 */

import type { TeRun } from '../model/types'

/** Epoch milliseconds of the earliest event carrying the mark, or null. */
function firstEventMs(run: TeRun, mark: string): number | null {
  let best: number | null = null
  for (const event of run.events) {
    if (event.mark !== mark) continue
    const t = Date.parse(event.at)
    if (Number.isNaN(t)) continue
    if (best === null || t < best) best = t
  }
  return best
}

/** Seconds from run start to the first event with the mark. */
export function eventTimeS(run: TeRun, mark: string): number | null {
  if (run.startAt === null) return null
  const start = Date.parse(run.startAt)
  if (Number.isNaN(start)) return null
  const at = firstEventMs(run, mark)
  if (at === null) return null
  return (at - start) / 1000
}

/** Seconds between the first events carrying each mark. */
export function segmentS(run: TeRun, fromMark: string, toMark: string): number | null {
  const from = firstEventMs(run, fromMark)
  const to = firstEventMs(run, toMark)
  if (from === null || to === null) return null
  return (to - from) / 1000
}

/**
 * Mission margin and the timing decision rule.
 * margin = available - required - uncertainty.
 * met when available exceeds required by more than the uncertainty band;
 * borderline when they agree within the band; missed otherwise.
 */
export function missionMargin(
  availableS: number,
  requiredS: number,
  uncertaintyS: number,
): { margin: number; verdict: 'met' | 'borderline' | 'missed' } {
  const margin = availableS - requiredS - uncertaintyS
  const slack = availableS - requiredS
  const verdict = slack > uncertaintyS ? 'met' : slack >= -uncertaintyS ? 'borderline' : 'missed'
  return { margin, verdict }
}

/** Segment durations between consecutive marks; null where an event is absent. */
export function chainSegments(
  run: TeRun,
  marks: string[],
): Array<{ from: string; to: string; seconds: number | null }> {
  const segments: Array<{ from: string; to: string; seconds: number | null }> = []
  for (let i = 0; i + 1 < marks.length; i++) {
    segments.push({ from: marks[i], to: marks[i + 1], seconds: segmentS(run, marks[i], marks[i + 1]) })
  }
  return segments
}

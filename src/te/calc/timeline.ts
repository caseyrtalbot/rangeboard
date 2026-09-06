/**
 * Run-timeline arithmetic (MASTER-CALCULATIONS).
 * Elapsed time = stop-event time - start-event time; the timing decision rule
 * makes a result borderline when available equals required within the
 * approved uncertainty band.
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


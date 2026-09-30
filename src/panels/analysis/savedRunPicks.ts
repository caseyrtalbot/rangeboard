import type { RunSummary } from '../../io/runStore'

/** Keep a pick that still exists; fill an empty side with the newest record the other side does not hold. */
export function defaultPicks(
  runs: RunSummary[],
  picks: { a: string | null; b: string | null },
): { a: string | null; b: string | null } {
  const has = (id: string | null) => id != null && runs.some((run) => run.id === id)
  let a = has(picks.a) ? picks.a : null
  let b = has(picks.b) ? picks.b : null
  const next = (other: string | null) => runs.find((run) => run.id !== other)?.id ?? null
  if (a == null) a = next(b)
  if (b == null) b = next(a)
  return { a, b }
}

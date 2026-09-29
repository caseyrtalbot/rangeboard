/**
 * Same-name threat fold (docs/timeline/SPEC.md 1.2). Past GROUP_AT threat rows,
 * threats that share a label minus a trailing " <n>" fold into one fold row.
 * Pure: the entries hold references to the model's rows, never copies.
 */

import type { RunTimelineRow } from '../../analysis/runTimeline'

/** Above this many threat rows, same-named threats ("Shahed 1..12") fold. */
export const GROUP_AT = 14

export type ThreatEntry =
  | { t: 'row'; row: RunTimelineRow }
  | { t: 'fold'; key: string; base: string; label: string; rows: RunTimelineRow[] }

/** The fold key for a label base; the store's `openFolds` holds these. */
function foldKey(base: string): string {
  return `fold:${base}`
}

/** Threat rows in model order; a base with two or more members becomes one fold. */
export function foldThreats(rows: readonly RunTimelineRow[]): ThreatEntry[] {
  if (rows.length <= GROUP_AT) return rows.map((row) => ({ t: 'row', row }))
  const byBase = new Map<string, RunTimelineRow[]>()
  for (const row of rows) {
    const base = row.label.replace(/ \d+$/, '')
    const hit = byBase.get(base)
    if (hit) hit.push(row)
    else byBase.set(base, [row])
  }
  // Map iteration keeps first-seen order, so a fold sits where its first member was.
  const out: ThreatEntry[] = []
  for (const [base, members] of byBase) {
    if (members.length < 2) out.push({ t: 'row', row: members[0] })
    else
      out.push({
        t: 'fold',
        key: foldKey(base),
        base,
        label: `${base} ×${members.length}`,
        rows: members,
      })
  }
  return out
}

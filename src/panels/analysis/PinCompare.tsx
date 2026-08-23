import type { AarSummary, ScorecardSnap } from '../../model/types'
import { formatTime } from '../../geometry/geo'

interface Col {
  key: string
  name: string
  score: number | null
  aar: AarSummary
}

const timeCell = (v: number | null) => (v == null ? '—' : formatTime(v))

/**
 * Metric rows, one formatter per column. Same metric on the same row for
 * every pin. Pins whose rows predate the kinetic/jam split carry no
 * jamSalvos field (undefined, distinct from a true 0) and their shotsFired
 * is a combined count that cannot be split retroactively: the shots cell
 * carries a "total" qualifier and the jam cell an honest placeholder.
 */
const ROWS: Array<{ label: string; cell: (c: Col) => string }> = [
  { label: 'Score', cell: (c) => (c.score != null ? `${c.score}` : '—') },
  { label: 'Exp kills', cell: (c) => c.aar.expectedKills.toFixed(1) },
  { label: 'Hard kills', cell: (c) => c.aar.expectedHardKills.toFixed(1) },
  { label: 'Soft kills', cell: (c) => c.aar.expectedSoftKills.toFixed(1) },
  { label: 'Leakers', cell: (c) => c.aar.expectedLeakers.toFixed(1) },
  {
    label: 'Kin shots',
    cell: (c) =>
      c.aar.jamSalvos == null ? `${c.aar.shotsFired} total` : `${c.aar.shotsFired}`,
  },
  { label: 'Jam salvos', cell: (c) => (c.aar.jamSalvos == null ? '-' : `${c.aar.jamSalvos}`) },
  { label: 'First det', cell: (c) => timeCell(c.aar.firstDetectS) },
  { label: 'First shot', cell: (c) => timeCell(c.aar.firstShotS) },
  { label: 'Raid', cell: (c) => `${c.aar.raidSize}` },
  { label: 'ROE', cell: (c) => c.aar.roe },
]

/**
 * Aligned columnar comparison of pinned scorecards against the current
 * configuration: one metric per row, one column per pin. A lone pin still
 * renders (one column, plus Current when the current run has data). Pins
 * made before the AAR summary existed carry no aar and are skipped (their
 * score still shows in the pin list above).
 */
export function PinCompare({
  pins,
  current,
  currentScore,
}: {
  pins: ScorecardSnap[]
  current: AarSummary
  currentScore: number | null
}) {
  // Current leads so it never scrolls out of view in a narrow panel.
  const cols: Col[] =
    current.threats.length > 0
      ? [{ key: 'current', name: 'Current', score: currentScore, aar: current }]
      : []
  for (const p of pins) {
    if (p.aar) cols.push({ key: p.id, name: p.name, score: p.score, aar: p.aar })
  }
  if (cols.length === 0) return null

  return (
    <div className="aar-table-wrap">
      <table className="pin-table">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c.key} title={c.name}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              {cols.map((c) => (
                <td key={c.key} className="num">
                  {r.cell(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

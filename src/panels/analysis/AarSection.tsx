import { useState } from 'react'
import type {
  AarOutcome,
  AarSummary,
  AarThreatRow as AarThreatRowData,
  ImpactSeverity,
} from '../../model/types'
import { useStore } from '../../state/store'
import { formatTime } from '../../geometry/geo'
import { SEVERITY_LABEL } from '../../analysis/impact'
import { effectorExpenditureLine, TIER_CLS } from '../headlines'
import { exportAar } from '../../io/persist'

const OUTCOME_TEXT: Record<AarOutcome, { label: string; cls: string }> = {
  'hard-kill': { label: 'hard kill', cls: 'good' },
  'soft-kill': { label: 'soft kill (jam)', cls: 'good' },
  leaker: { label: 'leaker', cls: 'bad' },
  'not-engaged': { label: 'not engaged', cls: 'warn' },
}

const OUTCOME_ORDER: AarOutcome[] = ['hard-kill', 'soft-kill', 'leaker', 'not-engaged']

const SEVERITY_RANK: Record<ImpactSeverity, number> = { low: 0, moderate: 1, severe: 2 }

/** Compact classification cell: highest rung reached and when. */
function classifyCell(t: AarThreatRowData): string {
  if (t.hostileAtS != null) return `hostile ${formatTime(t.hostileAtS)}`
  if (t.suspectedAtS != null) return `suspect ${formatTime(t.suspectedAtS)}`
  if (t.unknownAtS != null) return `unknown ${formatTime(t.unknownAtS)}`
  return 'never'
}

const aarTime = (v: number | null) => (v == null ? '—' : formatTime(v))
const aarPct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)

/** Min–max time range over the non-null values; a single value when equal. */
function aarTimeRange(values: (number | null)[]): string {
  const v = values.filter((x): x is number => x != null)
  if (v.length === 0) return '—'
  const lo = formatTime(Math.min(...v))
  const hi = formatTime(Math.max(...v))
  return lo === hi ? lo : `${lo}–${hi}`
}

/**
 * Impact cell from the optional I&W row fields. Three states: a severity
 * tier with the expected arriving mass, 'none' when the row was assessed and
 * nothing warns (severity present but null), and '—' for pins made before
 * the fields existed.
 */
function aarImpactCell(t: AarThreatRowData): string {
  if (t.impactSeverity != null) {
    const kg =
      (t.expectedWarheadKg ?? 0) > 0 ? ` · ${Math.round(t.expectedWarheadKg!)} kg` : ''
    return `${SEVERITY_LABEL[t.impactSeverity]} · ${(t.expectedShipsArriving ?? 0).toFixed(1)} ships${kg}`
  }
  return t.impactSeverity === null ? 'none' : '—'
}

/** Group key: the row name with any trailing " <number>" ship suffix stripped. */
const aarGroupKey = (name: string) => name.replace(/ \d+$/, '')

interface AarGroup {
  key: string
  rows: AarThreatRowData[]
  ships: number
}

/** Bucket rows by group key, first-seen order. Unique names stay singles. */
function groupThreats(threats: AarThreatRowData[]): AarGroup[] {
  const order: string[] = []
  const byKey = new Map<string, AarThreatRowData[]>()
  for (const t of threats) {
    const k = aarGroupKey(t.name)
    const rows = byKey.get(k)
    if (rows) rows.push(t)
    else {
      byKey.set(k, [t])
      order.push(k)
    }
  }
  return order.map((key) => {
    const rows = byKey.get(key)!
    return { key, rows, ships: rows.reduce((s, t) => s + t.shipCount, 0) }
  })
}

/** Ship counts of the highest classification rung reached: "hostile ×16, never ×2". */
function classifySummary(rows: AarThreatRowData[]): string {
  const rungs = ['hostile', 'suspect', 'unknown', 'never'] as const
  const counts = new Map<string, number>()
  for (const t of rows) {
    const r =
      t.hostileAtS != null
        ? 'hostile'
        : t.suspectedAtS != null
          ? 'suspect'
          : t.unknownAtS != null
            ? 'unknown'
            : 'never'
    counts.set(r, (counts.get(r) ?? 0) + t.shipCount)
  }
  return rungs
    .filter((r) => counts.has(r))
    .map((r) => `${r} ×${counts.get(r)}`)
    .join(', ')
}

/** Worst I&W tier across the group's rows; null when no row has a tier. */
function worstSeverity(rows: AarThreatRowData[]): ImpactSeverity | null {
  let worst: ImpactSeverity | null = null
  for (const t of rows) {
    const s = t.impactSeverity
    if (s != null && (worst == null || SEVERITY_RANK[s] > SEVERITY_RANK[worst])) worst = s
  }
  return worst
}

/** Per-outcome ship counts as status chips: "12 hard kill · 6 leaker". */
function OutcomeCounts({ rows }: { rows: AarThreatRowData[] }) {
  const counts = new Map<AarOutcome, number>()
  for (const t of rows) counts.set(t.outcome, (counts.get(t.outcome) ?? 0) + t.shipCount)
  return (
    <>
      {OUTCOME_ORDER.filter((o) => counts.has(o)).map((o, i) => (
        <span key={o}>
          {i > 0 ? ' · ' : ''}
          <span className={`status ${OUTCOME_TEXT[o].cls}`}>
            {counts.get(o)} {OUTCOME_TEXT[o].label}
          </span>
        </span>
      ))}
    </>
  )
}

/**
 * Headline raid distribution: one stacked bar (killed | not engaged | leakers)
 * and a one-line total under it. Segment palette is validated for color
 * vision; the 2px gaps read as panel background. No text inside the bar.
 */
function AarOutcomeBar({
  aar,
  mode = 'actual',
}: {
  aar: AarSummary
  mode?: 'actual' | 'projected'
}) {
  const killed = aar.expectedHardKills + aar.expectedSoftKills
  const notEngaged = aar.threats
    .filter((t) => t.outcome === 'not-engaged')
    .reduce((s, t) => s + t.shipCount, 0)
  // expectedLeakers already counts not-engaged ships (each leaks with p=1);
  // the red segment holds only engaged leakers so the bar partitions the raid.
  const engagedLeak = Math.max(0, aar.expectedLeakers - notEngaged)
  const segments = [
    { v: killed, color: '#8fae7a' },
    { v: notEngaged, color: 'var(--border)' },
    { v: engagedLeak, color: '#c4564a' },
  ].filter((s) => s.v > 0.05)
  const barTitle = `${mode === 'projected' ? 'Full-run model: ' : ''}${killed.toFixed(1)} killed · ${notEngaged} not engaged (leak through) · ${engagedLeak.toFixed(1)} leak through engaged`
  return (
    <div className="aar-headline">
      {segments.length > 0 && (
        <div className="aar-bar" title={barTitle}>
          {segments.map((s, i) => (
            <div key={i} style={{ flexGrow: s.v, background: s.color }} />
          ))}
        </div>
      )}
      <div>
        {mode === 'projected' ? 'Projected: ' : ''}
        {killed.toFixed(1)} killed ({aar.expectedHardKills.toFixed(1)} hard ·{' '}
        {aar.expectedSoftKills.toFixed(1)} soft) · {aar.expectedLeakers.toFixed(1)} leak
        through · {aarPct(aar.leakProbability)}
      </div>
    </div>
  )
}

/** AAR totals and per-effector shot ledger. Renders from the summary alone. */
export function AarTotals({
  aar,
  mode = 'actual',
}: {
  aar: AarSummary
  mode?: 'actual' | 'projected'
}) {
  const projected = mode === 'projected'
  return (
    <>
      <div className="aar-table-wrap">
        <table className="threat-table">
          <tbody>
            <tr>
              <td>Raid size</td>
              <td>
                {aar.raidSize} ships · ROE {aar.roe}
              </td>
            </tr>
            <tr>
              <td>{projected ? 'Projected first detection' : 'First detection'}</td>
              <td>{aarTime(aar.firstDetectS)}</td>
            </tr>
            <tr>
              <td>{projected ? 'Projected first shot' : 'First shot'}</td>
              <td>{aarTime(aar.firstShotS)}</td>
            </tr>
            <tr>
              <td>{projected ? 'Projected kinetic shots' : 'Shots fired'}</td>
              <td>{aar.shotsFired}</td>
            </tr>
            {(aar.jamSalvos ?? 0) > 0 && (
              <tr>
                <td>{projected ? 'Projected jam salvos' : 'Jam salvos'}</td>
                <td>{aar.jamSalvos}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {aar.effectors.length > 0 && (
        <div className="aar-table-wrap">
          <table className="threat-table">
            <tbody>
              {aar.effectors.map((e) => (
                <tr key={e.effectorId}>
                  <td>{e.name}</td>
                  <td>
                    {effectorExpenditureLine(e, mode)} ·{' '}
                    {e.expectedRoundsRemaining != null
                      ? projected
                        ? `${e.expectedRoundsRemaining}${
                            e.magazineSize != null ? ` of ${e.magazineSize}` : ''
                          } after run`
                        : `${e.expectedRoundsRemaining}${
                            e.magazineSize != null ? ` of ${e.magazineSize}` : ''
                          } left`
                      : projected
                        ? 'unlimited capacity'
                        : 'unlimited'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/** One threat's table row; `member` indents it under its group summary. */
function ThreatTr({ t, member = false }: { t: AarThreatRowData; member?: boolean }) {
  return (
    <tr className={member ? 'aar-member' : undefined}>
      <td>
        {t.name}
        {t.shipCount > 1 ? ` ×${t.shipCount}` : ''}
      </td>
      <td className="num">{aarTime(t.detectS)}</td>
      <td>{classifyCell(t)}</td>
      <td className="num">{aarTime(t.engageS)}</td>
      <td>
        <span className={`status ${OUTCOME_TEXT[t.outcome].cls}`}>
          {OUTCOME_TEXT[t.outcome].label}
        </span>
        {t.leakProbability > 0.0005 && t.leakProbability < 0.9995
          ? ` ${aarPct(t.leakProbability)} leak`
          : ''}
      </td>
      <td>{aarImpactCell(t)}</td>
    </tr>
  )
}

/** Group summary row; the chevron expands the member rows beneath it. */
function AarGroupRows({ group }: { group: AarGroup }) {
  const [open, setOpen] = useState(false)
  const worst = worstSeverity(group.rows)
  return (
    <>
      <tr className="aar-group" onClick={() => setOpen((v) => !v)}>
        <td>
          <span className={`chevron${open ? ' open' : ''}`}>▸</span> {group.key} ×{group.ships}
        </td>
        <td className="num">{aarTimeRange(group.rows.map((t) => t.detectS))}</td>
        <td>{classifySummary(group.rows)}</td>
        <td className="num">{aarTimeRange(group.rows.map((t) => t.engageS))}</td>
        <td>
          <OutcomeCounts rows={group.rows} />
        </td>
        <td>
          {worst != null ? (
            <span className={`status ${TIER_CLS[worst]}`}>{SEVERITY_LABEL[worst]}</span>
          ) : (
            '—'
          )}
        </td>
      </tr>
      {open && group.rows.map((t) => <ThreatTr key={t.uasId} t={t} member />)}
    </>
  )
}

/** Actual after-action report or explicitly labeled full-run projection. */
export function AarBody({
  aar,
  mode = 'actual',
}: {
  aar: AarSummary
  mode?: 'actual' | 'projected'
}) {
  const name = useStore((s) => s.scenario.name)
  return (
    <>
      <AarOutcomeBar aar={aar} mode={mode} />
      <AarTotals aar={aar} mode={mode} />
      <div className="aar-table-wrap">
        <table className="aar-threat-table">
          <thead>
            <tr>
              <th>Threat</th>
              <th>Detect</th>
              <th>Classify</th>
              <th>Engage</th>
              <th>Outcome</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {groupThreats(aar.threats).map((g) =>
              g.rows.length > 1 ? (
                <AarGroupRows key={g.key} group={g} />
              ) : (
                <ThreatTr key={g.rows[0].uasId} t={g.rows[0]} />
              ),
            )}
          </tbody>
        </table>
      </div>
      <div className="inspector-actions">
        <button onClick={() => exportAar(name, aar)}>
          {mode === 'projected' ? 'Export projection JSON' : 'Export AAR JSON'}
        </button>
      </div>
    </>
  )
}

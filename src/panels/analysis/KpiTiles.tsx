import type { ThreatAssessment } from '../../playback/sim'
import type { AttritionReport } from '../../playback/attrition'
import { formatTime } from '../../geometry/geo'

/** Warning-time floor below which the Min warning tile turns amber. */
const MIN_WARNING_WARN_S = 120

function Tile({
  label,
  value,
  sub,
  cls,
  title,
}: {
  label: string
  value: string
  sub?: string
  cls?: string
  title?: string
}) {
  return (
    <div className="kpi-tile" title={title}>
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value${cls ? ` ${cls}` : ''}`}>{value}</span>
      {sub ? <span className="kpi-sub">{sub}</span> : null}
    </div>
  )
}

/**
 * Six whole-run forecast numbers, rendered under the FORECAST head row.
 * Color is semantic and lands on the value only: leakers go amber above the
 * severity floor and red at one expected ship; warning goes amber under two
 * minutes.
 */
export function KpiTiles({
  threats,
  report,
  score,
}: {
  threats: ThreatAssessment[]
  report: AttritionReport
  score: number | null
}) {
  const t = report.totals
  const leakPct = t.raidSize > 0 ? Math.round((t.expectedLeakers / t.raidSize) * 100) : 0
  const leakCls = t.expectedLeakers >= 1 ? 'bad' : t.expectedLeakers > 0.05 ? 'warn' : ''
  const warnings = threats.filter((a) => a.warningS != null).map((a) => a.warningS!)
  const minWarn = warnings.length > 0 ? Math.min(...warnings) : null
  return (
    <div className="kpi-grid">
      <Tile label="Raid" value={`${t.raidSize}`} sub="ships" />
      <Tile
        label="Exp kills"
        value={t.expectedKills.toFixed(1)}
        sub={
          t.expectedSoftKills > 0.05
            ? `${t.expectedHardKills.toFixed(1)} hard · ${t.expectedSoftKills.toFixed(1)} soft`
            : `${t.expectedHardKills.toFixed(1)} hard`
        }
        title={`${t.expectedHardKills.toFixed(1)} hard kills · ${t.expectedSoftKills.toFixed(1)} soft kills (jam)`}
      />
      <Tile
        label="Leakers"
        value={t.expectedLeakers.toFixed(1)}
        sub={`${leakPct}% of raid`}
        cls={leakCls}
      />
      <Tile
        label="Min warn"
        value={minWarn != null ? formatTime(minWarn) : '—'}
        cls={minWarn != null && minWarn < MIN_WARNING_WARN_S ? 'warn' : ''}
        title="Shortest warning time: arrival at the defended asset minus first detection"
      />
      <Tile
        label="Shots"
        value={`${t.shotsFired}`}
        sub={t.jamSalvos > 0 ? `kin · ${t.jamSalvos} jam` : 'kinetic'}
        title={`${t.shotsFired} kinetic shots${t.jamSalvos > 0 ? ` · ${t.jamSalvos} jam salvos` : ''}`}
      />
      <Tile label="Score" value={score != null ? `${score}` : '—'} title="Weighted configuration score, 0-100" />
    </div>
  )
}

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
        label="Proj kills"
        value={t.expectedKills.toFixed(1)}
        sub={
          t.expectedSoftKills > 0.05
            ? `${t.expectedHardKills.toFixed(1)} hard · ${t.expectedSoftKills.toFixed(1)} soft`
            : `${t.expectedHardKills.toFixed(1)} hard`
        }
        title={`Full-run model: ${t.expectedHardKills.toFixed(1)} hard kills · ${t.expectedSoftKills.toFixed(1)} soft kills (jam)`}
      />
      <Tile
        label="Proj leakers"
        value={t.expectedLeakers.toFixed(1)}
        sub={`${leakPct}% of raid`}
        cls={leakCls}
        title="Expected surviving ships at the end of the modeled full run"
      />
      <Tile
        label="Proj min warn"
        value={minWarn != null ? formatTime(minWarn) : '—'}
        cls={minWarn != null && minWarn < MIN_WARNING_WARN_S ? 'warn' : ''}
        title="Full-run model: shortest warning time from first detection to defended-asset arrival"
      />
      <Tile
        label="Proj shots"
        value={`${t.shotsFired}`}
        sub={t.jamSalvos > 0 ? `kin · ${t.jamSalvos} jam` : 'kinetic'}
        title={`Full-run model projects ${t.shotsFired} kinetic shots${t.jamSalvos > 0 ? ` · ${t.jamSalvos} jam salvos` : ''}`}
      />
      <Tile
        label="Config score"
        value={score != null ? `${score}` : '—'}
        title="Weighted full-run configuration score, 0-100"
      />
    </div>
  )
}

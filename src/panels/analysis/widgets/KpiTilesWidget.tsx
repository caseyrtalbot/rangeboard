import { useMemo } from 'react'
import { trialKpisAt } from '../../../analysis/liveStats'
import { formatTime } from '../../../geometry/geo'
import { trialSweepAt } from '../../../playback/trialSweepAt'
import type { KpiKey } from '../../../state/analysisLayout'
import { DEFAULT_KPI_TILES, KPI_KEYS } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { useTrialResult, trialViewOf, trialStateText } from './controls'
import { TRIAL_KPI_LABELS as KPI_LABELS } from './labels'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

interface Tile {
  key: KpiKey
  value: React.ReactNode
  sub?: string
  cls?: string
  title?: string
}

/** The tile keys from params: unknown keys dropped, an empty list falls back to the default. */
function tilesOf(params: Record<string, unknown>): KpiKey[] {
  const raw = Array.isArray(params.tiles) ? params.tiles : []
  const kept = KPI_KEYS.filter((key) => raw.includes(key))
  return kept.length > 0 ? kept : [...DEFAULT_KPI_TILES]
}

function minOf(values: Array<number | null | undefined>): number | null {
  let min: number | null = null
  for (const v of values) if (v != null && (min == null || v < min)) min = v
  return min
}

/** Time tile: the value once the cursor reaches it, else a dash and "not yet". */
function timeTile(
  key: KpiKey,
  value: number | null,
  reachedAtS: number | null,
  t: number,
  sub?: string | null,
): Tile {
  const reached = value != null && reachedAtS != null && t >= reachedAtS
  return reached
    ? { key, value: formatTime(value), sub: sub ?? undefined }
    : { key, value: '—', sub: 'not yet' }
}

function KpiParams({ id, tiles }: { id: string; tiles: KpiKey[] }) {
  const setParams = useStore((s) => s.setAnalysisWidgetParams)
  return (
    <div className="params">
      {KPI_KEYS.map((key) => {
        const checked = tiles.includes(key)
        return (
          <label key={key}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                const next = KPI_KEYS.filter((k) => (k === key ? event.target.checked : tiles.includes(k)))
                // An empty selection is never committed: the widget keeps one tile.
                if (next.length > 0) setParams(id, { tiles: next })
              }}
            />
            {KPI_LABELS[key].label}
          </label>
        )
      })}
    </div>
  )
}

/** KPI tiles at the cursor time: the run header's counters, one tile per chosen key. */
export function KpiTilesWidget({ id, params, collapsed, customize, index, count, horizon }: WidgetProps) {
  const trial = useTrialResult()
  const view = trialViewOf(trial)
  const t = trial.horizon
  const tiles = useMemo(() => tilesOf(params), [params])
  const stateText = trialStateText(trial.selection, trial.snapshot?.observedThroughS)
  const k = view ? trialKpisAt(view, t) : null
  const n = trial.snapshot?.counts.totalTracks ?? 0
  const tracking = view ? new Set(trialSweepAt(view, t).sensors.filter(s => s.stateAtTime !== 'not-held').map(s => s.threatId)).size : 0
  const threats = view?.assessments.filter(a => a.status !== 'no-path') ?? []
  const firstDetect = minOf(threats.map(a => a.firstDetectS))
  const firstEffect = minOf(view?.attrition.events.filter(e => e.killDelta === 1).map(e => e.tEffectS) ?? [])
  const warning = threats.filter(a => a.arrivalS != null && a.arrivalS <= t && a.warningS != null)
    .sort((a, b) => a.warningS! - b.warningS!)[0]

  const tile = (key: KpiKey): Tile => {
    if (!k) return { key, value: '—' }
    switch (key) {
      case 'detect': return { key, value: <>{k.detected}<small>/{n}</small></> }
      case 'trackNow': return { key, value: <>{tracking}<small>/{n}</small></> }
      case 'idClass': return { key, value: <>{k.classified}<small>/{n}</small></> }
      case 'targetNow': return { key, value: <>{k.targetable}<small>/{n}</small></> }
      case 'engaged': return { key, value: <>{k.engaged}<small>/{n}</small></> }
      case 'salvos': return { key, value: <>{k.kineticShots}{k.deSalvos > 0 && <small className="de"> · {k.deSalvos}d</small>}{k.jamSalvos > 0 && <small className="ew"> · {k.jamSalvos}j</small>}</> }
      case 'killEk': return { key, value: k.kills }
      case 'lateEk': return { key, value: k.lateKills }
      case 'leakEn': return { key, value: k.reportedLeakers ?? '—', sub: k.reportedLeakers == null ? 'no defended asset' : undefined, cls: (k.reportedLeakers ?? 0) > 0 ? 'bad' : undefined }
      case 'firstDetect': return timeTile(key, firstDetect, firstDetect, t)
      case 'firstEffect': return timeTile(key, firstEffect, firstEffect, t)
      case 'detectToEffect': return timeTile(key, firstDetect != null && firstEffect != null ? firstEffect - firstDetect : null, firstDetect != null && firstEffect != null ? Math.max(firstDetect, firstEffect) : null, t)
      case 'minWarning': return view?.hasActiveAsset ? timeTile(key, warning?.warningS ?? null, warning?.arrivalS ?? null, t) : { key, value: '—', sub: 'no defended asset placed' }
    }
  }

  const body = customize ? (
    <KpiParams id={id} tiles={tiles} />
  ) : !view ? (
    <p className="muted small">{stateText}</p>
  ) : threats.length === 0 ? (
    <p className="muted small">No threats with flight paths.</p>
  ) : (
    <div className={`tiles ${tiles.length <= 4 ? 'c2' : 'c3'}`}>
      {tiles.map((key) => {
        const item = tile(key)
        return (
          <div className="tile" key={key} title={KPI_LABELS[key].hint}>
            <span className="tl">{KPI_LABELS[key].label}</span>
            <span className={`tv${item.cls ? ` ${item.cls}` : ''}`}>{item.value}</span>
            <span className="ts">{['firstDetect', 'firstEffect', 'detectToEffect', 'minWarning'].includes(key) ? 'trial milestone' : 'trial count'}{item.sub ? ` · ${item.sub}` : ''}</span>
          </div>
        )
      })}
    </div>
  )

  return (
    <WidgetFrame
      id={id}
      horizon={horizon}
      type="kpi-tiles"
      title="KPI tiles"
      metaWithinHorizon
      meta={stateText}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {body}
    </WidgetFrame>
  )
}

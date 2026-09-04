import { useMemo } from 'react'
import { buildLiveTimeline, liveKpisAt, type LiveKpis } from '../../../analysis/liveStats'
import { formatTime } from '../../../geometry/geo'
import type { BandSeries, McSummary } from '../../../playback/mcRun'
import { detectionsAt } from '../../../playback/sim'
import type { KpiKey } from '../../../state/analysisLayout'
import { DEFAULT_KPI_TILES, KPI_KEYS } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { useEngagement, useRunCursor } from './controls'
import { KPI_LABELS } from './labels'
import { bandStep, countSub, currentSummary, formatCount, timeStatSub } from './mc'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

const ZERO_KPIS: LiveKpis = {
  detected: 0,
  classified: 0,
  targetable: 0,
  engaged: 0,
  kineticShots: 0,
  deSalvos: 0,
  jamSalvos: 0,
  expectedKills: 0,
  lateKills: 0,
  arrivedTracks: 0,
  leakerShips: 0,
}

interface Tile {
  key: KpiKey
  value: React.ReactNode
  sub?: string
  cls?: string
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

/** The replicate mean at the cursor step and its half-width sub over `reps` replicates. */
function bandAt(band: BandSeries, t: number, reps: number): { mean: number; sub: string } {
  const i = bandStep(t, band.mean.length)
  return { mean: band.mean[i], sub: countSub(band, i, reps) }
}

/** A count tile over n: the replicate mean with its band sub. */
function bandCountTile(key: KpiKey, band: BandSeries, t: number, n: number, reps: number): Tile {
  const at = bandAt(band, t, reps)
  return { key, value: <>{formatCount(at.mean)}<small>/{n}</small></>, sub: at.sub }
}

/** A finite Stat mean, else null (a Stat over no sample is NaN). */
function meanOf(stat: McSummary['firstDetectS']): number | null {
  return stat.n > 0 && Number.isFinite(stat.mean) ? stat.mean : null
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
export function KpiTilesWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const mc = useStore((s) => s.mc)
  const { assessments, report } = useEngagement(scenario, runId)
  const { t, untouched } = useRunCursor(scenario)
  // Nothing is observed before the first play: the replicate means wait too.
  const summary = untouched ? null : currentSummary(mc, runId)
  const tiles = useMemo(() => tilesOf(params), [params])
  const tl = useMemo(() => buildLiveTimeline(assessments, report), [assessments, report])
  const threats = useMemo(
    () => assessments.filter((a) => a.status !== 'no-path'),
    [assessments],
  )
  const wantsTracking = tiles.includes('trackNow')
  const tracking = useMemo(() => {
    if (untouched || !wantsTracking) return 0
    const hits = detectionsAt(scenario, t)
    return tl.trackIds.filter((uasId) => hits.has(uasId)).length
  }, [scenario, t, untouched, wantsTracking, tl])
  const k = untouched ? ZERO_KPIS : liveKpisAt(tl, t)
  const n = tl.trackCount
  const cursor = untouched ? -1 : t

  const firstDetect = minOf(threats.map((a) => a.firstDetectS))
  const firstEffect = minOf(
    report.events.filter((ev) => ev.killDelta > 0).map((ev) => ev.tEffectS),
  )
  const warningHolder = threats.reduce<{ warningS: number; arrivalS: number } | null>(
    (best, a) =>
      a.warningS != null && a.arrivalS != null && (best == null || a.warningS < best.warningS)
        ? { warningS: a.warningS, arrivalS: a.arrivalS }
        : best,
    null,
  )
  const leakCls = k.leakerShips >= 1 ? 'bad' : k.leakerShips > 0.05 ? 'warn' : ''

  const tile = (key: KpiKey): Tile => {
    switch (key) {
      case 'detect':
        if (summary) return bandCountTile(key, summary.detected, t, n, summary.replicates)
        return { key, value: <>{k.detected}<small>/{n}</small></> }
      case 'trackNow':
        if (summary) return bandCountTile(key, summary.tracked, t, n, summary.replicates)
        return { key, value: <>{tracking}<small>/{n}</small></> }
      case 'idClass':
        return { key, value: <>{k.classified}<small>/{n}</small></> }
      case 'targetNow':
        return { key, value: <>{k.targetable}<small>/{n}</small></> }
      case 'engaged':
        if (summary) return bandCountTile(key, summary.engaged, t, n, summary.replicates)
        return { key, value: <>{k.engaged}<small>/{n}</small></> }
      case 'salvos':
        return {
          key,
          value: (
            <>
              {k.kineticShots}
              {k.deSalvos > 0 && <small className="de"> · {k.deSalvos}d</small>}
              {k.jamSalvos > 0 && <small className="ew"> · {k.jamSalvos}j</small>}
            </>
          ),
        }
      case 'killEk': {
        if (!summary) return { key, value: k.expectedKills.toFixed(1) }
        const at = bandAt(summary.kills, t, summary.replicates)
        return { key, value: formatCount(at.mean), sub: at.sub }
      }
      case 'lateEk':
        return { key, value: k.lateKills.toFixed(1) }
      case 'leakEn': {
        if (report.totals.reportedLeakers == null) {
          return { key, value: '—', sub: 'no defended asset' }
        }
        if (!summary) return { key, value: k.leakerShips.toFixed(1), cls: leakCls }
        const at = bandAt(summary.leakers, t, summary.replicates)
        const cls = at.mean >= 1 ? 'bad' : at.mean > 0.05 ? 'warn' : ''
        return { key, value: formatCount(at.mean), sub: at.sub, cls }
      }
      case 'firstDetect': {
        if (!summary) return timeTile(key, firstDetect, firstDetect, cursor)
        const mean = meanOf(summary.firstDetectS)
        return timeTile(key, mean, mean, cursor, timeStatSub(summary.firstDetectS))
      }
      case 'firstEffect':
        return timeTile(key, firstEffect, firstEffect, cursor)
      case 'detectToEffect': {
        const both = firstDetect != null && firstEffect != null
        const value = both ? firstEffect - firstDetect : null
        const reachedAt = both ? Math.max(firstDetect, firstEffect) : null
        return timeTile(key, value, reachedAt, cursor)
      }
      case 'minWarning': {
        const arrivalS = warningHolder?.arrivalS ?? null
        if (!summary) return timeTile(key, warningHolder?.warningS ?? null, arrivalS, cursor)
        const mean = meanOf(summary.minWarningS)
        return timeTile(key, mean, arrivalS, cursor, timeStatSub(summary.minWarningS))
      }
    }
  }

  const body = customize ? (
    <KpiParams id={id} tiles={tiles} />
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
            {item.sub ? <span className="ts">{item.sub}</span> : null}
          </div>
        )
      })}
    </div>
  )

  return (
    <WidgetFrame
      id={id}
      type="kpi-tiles"
      title="KPI tiles"
      meta={`${tiles.length} of ${KPI_KEYS.length}${
        summary ? ` · mean of ${summary.replicates}` : ''
      }`}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {body}
    </WidgetFrame>
  )
}

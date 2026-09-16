import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useStore } from '../../state/store'
import { scenarioDurationS } from '../../model/scenario'
import { selectSimTimeS } from '../../state/selectors'
import type { ExecutionHorizon } from '../../analysis/horizon'
import { reached } from '../../analysis/horizon'
import type { ImpactSeverity } from '../../model/types'
import { SEVERITY_RANK, severityFor } from '../../analysis/impact'
import { formatTime } from '../../geometry/geo'
import { tickStepS } from '../../charts/timeAxis'
import type { TrialResultView } from '../../analysis/trialResult'
import type { TrialSelection } from '../../state/trialSelectors'
import { useTrialResult, trialViewOf } from './controls'
import { PUBLISH_PERIOD_MS } from '../../canvas/frameClock'

const GUTTER_W = 150
const LANE_H = 16
/** Above this many lanes, same-named threats ("Shahed 1..12") collapse into groups. */
const GROUP_AT = 14

/** Classification ramp: one hue, stepped light -> dark (unknown -> suspected -> hostile). */
const RAMP_UNKNOWN = 'color-mix(in srgb, var(--danger) 25%, var(--bg-panel))'
const RAMP_SUSPECTED = 'color-mix(in srgb, var(--danger) 55%, var(--bg-panel))'
const RAMP_HOSTILE = 'var(--danger)'

interface Lane {
  key: string
  label: string
  entityIds: string[]
  /** Set on a group aggregate lane; the gutter chevron toggles the members. */
  groupKey: string | null
  detS: number | null
  suspectedAtS: number | null
  hostileAtS: number | null
  winS: [number, number] | null
  shotS: number | null
  arrS: number | null
  severity: ImpactSeverity | null
}

/** Censor members before grouping so future arrivals cannot affect group outcomes. */
// eslint-disable-next-line react/only-export-components -- colocated pure regression-test seam
export function censorLane(lane: Lane, horizon: ExecutionHorizon): Lane {
  if (!horizon.scoped) return lane
  return {
    ...lane,
    detS: reached(lane.detS, horizon) ? lane.detS : null,
    suspectedAtS: reached(lane.suspectedAtS, horizon) ? lane.suspectedAtS : null,
    hostileAtS: reached(lane.hostileAtS, horizon) ? lane.hostileAtS : null,
    winS:
      lane.winS && reached(lane.winS[0], horizon)
        ? [lane.winS[0], Math.min(lane.winS[1], horizon.horizonS)]
        : null,
    shotS: reached(lane.shotS, horizon) ? lane.shotS : null,
    arrS: reached(lane.arrS, horizon) ? lane.arrS : null,
    severity: reached(lane.arrS, horizon) ? lane.severity : null,
  }
}

function minS(vals: Array<number | null>): number | null {
  let out: number | null = null
  for (const v of vals) if (v != null && (out == null || v < out)) out = v
  return out
}

function maxS(vals: Array<number | null>): number | null {
  let out: number | null = null
  for (const v of vals) if (v != null && (out == null || v > out)) out = v
  return out
}

/** One lane per threat with a flight path, in assessment order. */
function threatLanes(view: TrialResultView): Lane[] {
  const { scenario, assessments, attrition: report } = view
  const out: Lane[] = []
  for (const a of assessments) {
    if (a.status === 'no-path') continue
    const att = report.threats.find((t) => t.uasId === a.uasId)
    const entity = scenario.entities.find((e) => e.id === a.uasId)
    const removed = report.events.filter(
      (e) =>
        e.uasId === a.uasId && e.killDelta === 1 && a.arrivalS != null && e.tEffectS <= a.arrivalS,
    ).length
    const arrivals =
      a.arrivalS != null && view.hasActiveAsset ? (entity?.formation?.count ?? 1) - removed : 0
    const warheadKg =
      scenario.library.find((model) => model.id === entity?.specId)?.uas?.warheadKg ?? 0
    out.push({
      key: a.uasId,
      label: scenario.entities.find((e) => e.id === a.uasId)?.name ?? a.uasId,
      entityIds: [a.uasId],
      groupKey: null,
      detS: a.firstDetectS,
      suspectedAtS: a.classificationAtS.suspectedAtS,
      hostileAtS: a.classificationAtS.hostileAtS,
      winS: a.windowS,
      shotS: att?.firstShotS ?? null,
      arrS: a.arrivalS,
      severity: severityFor(arrivals > 0, arrivals, arrivals * warheadKg),
    })
  }
  return out
}

/** Aggregate: earliest detection to latest arrival; earliest member time per ladder rung. */
function aggregateLane(base: string, members: Lane[]): Lane {
  const ws = minS(members.map((m) => m.winS?.[0] ?? null))
  const we = maxS(members.map((m) => m.winS?.[1] ?? null))
  let severity: ImpactSeverity | null = null
  for (const m of members) {
    if (
      m.severity != null &&
      (severity == null || SEVERITY_RANK[m.severity] > SEVERITY_RANK[severity])
    )
      severity = m.severity
  }
  return {
    key: `group:${base}`,
    label: `${base} ×${members.length}`,
    entityIds: members.flatMap((m) => m.entityIds),
    groupKey: base,
    detS: minS(members.map((m) => m.detS)),
    suspectedAtS: minS(members.map((m) => m.suspectedAtS)),
    hostileAtS: minS(members.map((m) => m.hostileAtS)),
    winS: ws != null && we != null ? [ws, we] : null,
    shotS: minS(members.map((m) => m.shotS)),
    arrS: maxS(members.map((m) => m.arrS)),
    severity,
  }
}

/** Past GROUP_AT lanes, threats sharing a name minus a trailing " <n>" fold into one row. */
function visibleLanes(lanes: Lane[], openGroups: Set<string>): Lane[] {
  if (lanes.length <= GROUP_AT) return lanes
  const byBase = new Map<string, Lane[]>()
  const order: string[] = []
  for (const l of lanes) {
    const base = l.label.replace(/ \d+$/, '')
    const hit = byBase.get(base)
    if (hit) hit.push(l)
    else {
      byBase.set(base, [l])
      order.push(base)
    }
  }
  const out: Lane[] = []
  for (const base of order) {
    const members = byBase.get(base)!
    if (members.length < 2) {
      out.push(...members)
      continue
    }
    out.push(aggregateLane(base, members))
    if (openGroups.has(base)) out.push(...members)
  }
  return out
}

function tipText(l: Lane, scoped: boolean): string {
  if (scoped) {
    const time = (t: number | null) => (t == null ? '—' : formatTime(t))
    return [
      `det ${time(l.detS)}`,
      `hostile ${time(l.hostileAtS)}`,
      `win ${l.winS ? `${formatTime(l.winS[0])}–${formatTime(l.winS[1])}` : '—'}`,
      `shot ${time(l.shotS)}`,
      `arr ${time(l.arrS)}`,
    ].join(' · ')
  }
  const p: string[] = []
  if (l.detS != null) p.push(`det ${formatTime(l.detS)}`)
  if (l.hostileAtS != null) p.push(`hostile ${formatTime(l.hostileAtS)}`)
  if (l.winS) p.push(`win ${formatTime(l.winS[0])}–${formatTime(l.winS[1])}`)
  if (l.shotS != null) p.push(`shot ${formatTime(l.shotS)}`)
  if (l.arrS != null) p.push(`arr ${formatTime(l.arrS)}`)
  return p.length > 0 ? p.join(' · ') : 'never detected'
}

const SEVERITY_FILL: Record<ImpactSeverity, string> = {
  severe: 'var(--danger)',
  moderate: 'var(--warn)',
  low: 'var(--warn)',
}

function LaneMarks({
  lane,
  i,
  x,
  durationS,
  endS,
}: {
  lane: Lane
  i: number
  x: (t: number) => number
  durationS: number
  endS: number
}) {
  if (endS < 0) return null
  const y = i * LANE_H
  const rampEndS = lane.arrS ?? endS
  const els: React.ReactNode[] = []
  const trackEnd = x(lane.detS ?? endS)
  if (trackEnd > 0) {
    els.push(
      <rect
        key="pre"
        x={0}
        y={y + 5}
        width={trackEnd}
        height={2}
        fill="var(--border)"
        shapeRendering="crispEdges"
      />,
    )
  }
  if (lane.detS != null) {
    const segs: Array<{ from: number; to: number; fill: string }> = [
      { from: lane.detS, to: lane.suspectedAtS ?? lane.hostileAtS ?? rampEndS, fill: RAMP_UNKNOWN },
    ]
    if (lane.suspectedAtS != null)
      segs.push({ from: lane.suspectedAtS, to: lane.hostileAtS ?? rampEndS, fill: RAMP_SUSPECTED })
    if (lane.hostileAtS != null)
      segs.push({ from: lane.hostileAtS, to: rampEndS, fill: RAMP_HOSTILE })
    segs.forEach((s, si) => {
      if (s.to <= s.from) return
      const x0 = x(s.from)
      const w = Math.max(1, x(s.to) - x0)
      els.push(
        <rect
          key={`ramp${si}`}
          x={x0}
          y={y + 3}
          width={w}
          height={6}
          fill={s.fill}
          shapeRendering="crispEdges"
        />,
      )
    })
  }
  if (lane.winS) {
    const x0 = x(lane.winS[0])
    els.push(
      <rect
        key="win"
        x={x0}
        y={y + 9}
        width={Math.max(1, x(lane.winS[1]) - x0)}
        height={4}
        fill="var(--accent)"
        shapeRendering="crispEdges"
      />,
    )
  }
  if (lane.shotS != null) {
    els.push(
      <rect
        key="shot"
        x={Math.min(x(lane.shotS), x(durationS) - 1)}
        y={y + 4}
        width={1}
        height={8}
        fill="var(--text)"
        shapeRendering="crispEdges"
      />,
    )
  }
  if (lane.arrS != null) {
    const cx = Math.min(x(lane.arrS), x(durationS) - 3)
    const cy = y + 8
    els.push(
      <path
        key="arr"
        d={`M ${cx} ${cy - 3} L ${cx + 3} ${cy} L ${cx} ${cy + 3} L ${cx - 3} ${cy} Z`}
        fill={lane.severity != null ? SEVERITY_FILL[lane.severity] : 'var(--text-dim)'}
      />,
    )
  }
  return <g>{els}</g>
}

/**
 * The playhead subscribes separately from the sampled lanes.
 * A linear transition over one publication period carries it
 * between publications without a subscription change.
 */
const Playhead = memo(function Playhead({ w, durationS }: { w: number; durationS: number }) {
  const t = useStore(selectSimTimeS)
  const x = Math.round(Math.min(1, Math.max(0, t / durationS)) * w)
  return (
    <div
      className="engstrip-playhead"
      style={{
        transform: `translateX(${x}px)`,
        transition: `transform ${PUBLISH_PERIOD_MS}ms linear`,
      }}
    />
  )
})

/** Text for a trial that produced no outcomes, one line per state that is not ready. */
function stripStateText(selection: TrialSelection): string {
  if (selection.status === 'preparing') return 'Preparing trial'
  if (selection.status === 'error') return selection.message
  if (selection.status === 'cancelled') return 'Trial cancelled'
  return 'No trial yet. Press Play to start one.'
}

/**
 * Engagement timeline lane strip: detection, classification, window, shot, arrival per threat.
 * Under the board it is mounted only while open: the playback bar holds the toggle and `App`
 * holds the open flag. `embedded` (inside a widget frame) only drops the shared element id.
 * Memoized: `App` re-renders on every selection change and the strip reads none of it.
 */
export const EngagementStrip = memo(function EngagementStrip({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const scenario = useStore((s) => s.scenario)
  const trial = useTrialResult()
  const view = trialViewOf(trial)
  const horizon = useMemo<ExecutionHorizon>(
    () => ({ scoped: true, horizonS: view ? trial.horizon : -1 }),
    [view, trial.horizon],
  )
  const clipId = useId()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<{ i: number; tipLeft: number; tipTop: number } | null>(null)
  const [w, setW] = useState(0)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef(false)

  const { lanes, durationS } = useMemo(
    () => ({
      lanes: view ? threatLanes(view) : [],
      durationS: view?.durationS ?? scenarioDurationS(scenario),
    }),
    [scenario, view],
  )
  const scopedLanes = useMemo(
    () => (horizon.scoped ? lanes.map((lane) => censorLane(lane, horizon)) : lanes),
    [lanes, horizon],
  )
  const rows = useMemo(() => visibleLanes(scopedLanes, openGroups), [scopedLanes, openGroups])
  const endS = horizon.scoped ? Math.min(durationS, horizon.horizonS) : durationS

  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [view])

  const x = useMemo(() => {
    return (t: number) => Math.round((Math.min(durationS, Math.max(0, t)) / durationS) * w)
  }, [durationS, w])

  const svg = useMemo(
    () => (
      <svg className="engstrip-svg" width={w} height={rows.length * LANE_H}>
        {horizon.scoped && (
          <defs>
            <clipPath id={clipId}>
              <rect width={x(endS)} height={rows.length * LANE_H} />
            </clipPath>
          </defs>
        )}
        <g clipPath={horizon.scoped ? `url(#${clipId})` : undefined}>
          {rows.map((l, i) => (
            <LaneMarks key={l.key} lane={l} i={i} x={x} durationS={durationS} endS={endS} />
          ))}
        </g>
      </svg>
    ),
    [rows, w, x, durationS, endS, horizon.scoped, clipId],
  )

  const ticks = useMemo(() => {
    if (w <= 0) return []
    const step = tickStepS(durationS, w)
    const out: number[] = [0]
    for (let t = step; t < durationS; t += step) if (x(t) <= w - 30) out.push(t)
    return out
  }, [durationS, w, x])

  function timeFromEvent(e: React.PointerEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect()
    const t = ((e.clientX - rect.left) / rect.width) * durationS
    return Math.min(durationS, Math.max(0, t))
  }

  // Tooltip coordinates are strip-relative so the scroll container never clips it.
  function updateHover(e: React.PointerEvent<HTMLDivElement>) {
    const strip = stripRef.current
    if (!strip) return
    const plotRect = e.currentTarget.getBoundingClientRect()
    const stripRect = strip.getBoundingClientRect()
    const i = Math.floor((e.clientY - plotRect.top) / LANE_H)
    if (i < 0 || i >= rows.length) {
      setHover(null)
      return
    }
    const laneTop = plotRect.top - stripRect.top + i * LANE_H
    const below = laneTop + LANE_H + 2
    const tipTop = below + 20 > stripRect.height ? Math.max(0, laneTop - 20) : below
    const tipLeft = Math.max(
      GUTTER_W,
      Math.min(e.clientX - stripRect.left + 12, stripRect.width - 280),
    )
    setHover({ i, tipLeft, tipTop })
  }

  const tip = hover != null && rows[hover.i] != null ? rows[hover.i] : null

  return (
    <div
      className="engstrip"
      id={embedded ? undefined : 'engagement-strip'}
      ref={stripRef}
      role={horizon.scoped ? 'group' : undefined}
      aria-label={
        horizon.scoped
          ? horizon.horizonS < 0
            ? 'No outcomes observed yet'
            : `Outcomes through T+${formatTime(horizon.horizonS)}`
          : undefined
      }
    >
      {view && (
        <div className="engstrip-legend">
          <span>
            <i className="sw ramp" />
            classify
          </span>
          <span>
            <i className="sw win" />
            window
          </span>
          <span>
            <i className="sw shot" />
            shot
          </span>
          <span>
            <i className="sw arr" />
            arrival
          </span>
        </div>
      )}
      {!view && (
        <p className="muted small" role="status">
          {stripStateText(trial.selection)}
        </p>
      )}
      {view && (
        <div className="engstrip-scroll">
          <div className="engstrip-axis">
            <div className="engstrip-axis-gutter" style={{ width: GUTTER_W }} />
            <div className="engstrip-axis-track">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="engstrip-tick"
                  style={t === 0 ? { left: 0 } : { left: x(t), transform: 'translateX(-50%)' }}
                >
                  {formatTime(t)}
                </span>
              ))}
            </div>
          </div>
          <div className="engstrip-rows">
            <div className="engstrip-gutter" style={{ width: GUTTER_W }}>
              {rows.map((l) => (
                <div
                  key={l.key}
                  className={`engstrip-name${l.groupKey != null ? ' group' : ''}`}
                  title={l.label}
                  onClick={() => useStore.getState().select({ entityIds: l.entityIds })}
                >
                  {l.groupKey != null && (
                    <span
                      className={`chevron${openGroups.has(l.groupKey) ? ' open' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenGroups((prev) => {
                          const next = new Set(prev)
                          if (next.has(l.groupKey!)) next.delete(l.groupKey!)
                          else next.add(l.groupKey!)
                          return next
                        })
                      }}
                    >
                      ▸
                    </span>
                  )}
                  <span className="engstrip-name-text">{l.label}</span>
                </div>
              ))}
            </div>
            <div
              className="engstrip-plot"
              ref={plotRef}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                dragRef.current = true
                useStore.getState().scrubTo(timeFromEvent(e))
              }}
              onPointerMove={(e) => {
                if (dragRef.current) useStore.getState().scrubTo(timeFromEvent(e))
                updateHover(e)
              }}
              onPointerUp={() => {
                dragRef.current = false
              }}
              onPointerCancel={() => {
                dragRef.current = false
              }}
              onPointerLeave={() => {
                if (!dragRef.current) setHover(null)
              }}
            >
              {svg}
              {w > 0 && <Playhead w={w} durationS={durationS} />}
            </div>
          </div>
        </div>
      )}
      {tip != null && hover != null && (
        <div className="engstrip-tip" style={{ left: hover.tipLeft, top: hover.tipTop }}>
          <span className="name">{tip.label}</span> {tipText(tip, horizon.scoped)}
        </div>
      )}
    </div>
  )
})

/**
 * Run timeline model: one run's rows by side then kind (sensors, C2, tracks,
 * effectors, threats), each with spans and marks, censored at the observed
 * horizon. Pure: no React, no DOM. The contract is docs/timeline/SPEC.md
 * section 2.2.
 */

import type { Entity } from '../model/types'
import { entityActive } from '../model/types'
import { modelFor, pathDurationS } from '../model/scenario'
import type { EngagementEvent } from '../playback/attritionReport'
import { engagementIsKinetic, engagementReleaseS } from '../playback/engagementTiming'
import type { KillChainRoute } from '../playback/killChain'
import { killChainRoutes } from '../playback/killChain'
import { effectivePathDelayS } from '../playback/raid'
import type { SensorObservation, ThreatAssessment } from '../playback/sim'
import { trackId } from '../playback/tracker'
import type { ExecutionHorizon } from './horizon'
import { reached } from './horizon'
import type { TrialResultView } from './trialResult'

export type RunTimelineSide = 'blue' | 'red'
export type RunTimelineKind = 'sensor' | 'c2' | 'track' | 'effector' | 'threat'

export interface RunTimelineSpan {
  kind:
    | 'hold'
    | 'coast'
    | 'classify'
    | 'window'
    | 'prep'
    | 'flight'
    | 'burst'
    | 'dwell'
    | 'undetected'
    | 'ghost'
  startS: number
  endS: number
  /** Track estimate quality 0..1 for hold chunks; classification band for classify. */
  level?: number | 'unknown' | 'suspected' | 'hostile'
  label?: string
}

export interface RunTimelineMark {
  kind:
    | 'detect'
    | 'init'
    | 'firm'
    | 'drop'
    | 'assign'
    | 'release'
    | 'shot'
    | 'hard-kill'
    | 'mission-kill'
    | 'miss'
    | 'jam-decision'
    | 'arrival'
    | 'cpa'
  tS: number
  text?: string
  /** Rounds left after a release, or pk at an effect, as display text. */
  after?: string
}

export interface RunTimelineRow {
  key: string
  kind: RunTimelineKind
  label: string
  meta: string
  /** The board entity a click selects; null for a false track. */
  entityId: string | null
  spans: RunTimelineSpan[]
  marks: RunTimelineMark[]
  /** Sensor rows only: one per held track. */
  subLanes?: RunTimelineRow[]
}

export interface RunTimelineGroup {
  key: RunTimelineKind
  side: RunTimelineSide
  label: string
  rows: RunTimelineRow[]
}

export interface RunTimelineModel {
  durationS: number
  horizonS: number
  groups: RunTimelineGroup[]
}

/** Hold chunks for quality shading sit on this absolute grid, seconds. */
const CHUNK_S = 5
/** Censored models kept per view, as trialSeries keeps `recent`. */
const RECENT = 4

/** One sensor or false track's estimates, in time order. */
interface Series {
  t: number[]
  q: number[]
  coast: boolean[]
}

interface RawSpan {
  kind: 'hold' | 'coast'
  startS: number
  endS: number
}

/** One uncensored row and what the per-horizon pass needs to censor it. */
interface Lane {
  row: RunTimelineRow
  /** Earliest item time; Infinity with no item. */
  firstS: number
  /** Latest item or member time; -Infinity with none. */
  lastS: number
  /** Platform and threat rows appear from T+0, with or without items. */
  always: boolean
  /** Hold chunks of a clipped span read their level from this track. */
  quality?: Series
  /** Real track rows: member sensors, named in meta once reached. */
  members?: Array<{ name: string; fromS: number }>
  sub?: Lane[]
}

interface Derived {
  groups: Array<{ key: RunTimelineKind; side: RunTimelineSide; label: string; lanes: Lane[] }>
  recent: RunTimelineModel[]
}

const cache = new WeakMap<TrialResultView, Derived>()

const GROUPS: Array<{ key: RunTimelineKind; side: RunTimelineSide; label: string }> = [
  { key: 'sensor', side: 'blue', label: 'Sensors' },
  { key: 'c2', side: 'blue', label: 'C2' },
  { key: 'track', side: 'blue', label: 'Tracks' },
  { key: 'effector', side: 'blue', label: 'Effectors' },
  { key: 'threat', side: 'red', label: 'Threats' },
]

/** Quality of the latest estimate at or before tS; a tie reads the later append. */
function levelAt(series: Series, tS: number): number | undefined {
  let lo = 0
  let hi = series.t.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (series.t[mid] <= tS) lo = mid + 1
    else hi = mid
  }
  return lo > 0 ? series.q[lo - 1] : undefined
}

function pushSpan(
  spans: RunTimelineSpan[],
  kind: RunTimelineSpan['kind'],
  startS: number,
  endS: number,
  extra: Pick<RunTimelineSpan, 'level' | 'label'> = {},
): void {
  if (endS > startS) spans.push({ kind, startS, endS, ...extra })
}

/** Hold cut on the absolute 5 s grid; each chunk reads the estimate at its end. */
function pushHold(spans: RunTimelineSpan[], raw: RawSpan, series?: Series): void {
  let startS = raw.startS
  while (startS < raw.endS) {
    const endS = Math.min(raw.endS, (Math.floor(startS / CHUNK_S) + 1) * CHUNK_S)
    const level = series ? levelAt(series, endS) : undefined
    pushSpan(spans, 'hold', startS, endS, level === undefined ? {} : { level })
    startS = endS
  }
}

/** Sub-lane spans: chunked holds with levels, whole coasts. */
function laneSpans(raw: RawSpan[], series?: Series): RunTimelineSpan[] {
  const spans: RunTimelineSpan[] = []
  for (const s of raw) {
    if (s.kind === 'hold') pushHold(spans, s, series)
    else pushSpan(spans, 'coast', s.startS, s.endS)
  }
  return spans
}

/** Hold and coast of one observation, as trialSeries laddersAt splits them. */
function observationSpans(obs: SensorObservation, stepS: number, durationS: number): RawSpan[] {
  const out: RawSpan[] = []
  const push = (kind: RawSpan['kind'], startS: number, endS: number) => {
    if (endS > startS) out.push({ kind, startS, endS })
  }
  for (const [start, end] of obs.intervals) {
    const stop = Math.min(durationS, end + stepS)
    let cursor = start
    for (const [coastStart, coastEnd] of obs.coastIntervals ?? []) {
      if (coastStart > stop || coastEnd < cursor) continue
      if (coastStart > cursor) push('hold', cursor, coastStart)
      const coastStop = Math.min(stop, coastEnd + stepS)
      push('coast', Math.max(cursor, coastStart), coastStop)
      cursor = coastStop
    }
    push('hold', cursor, stop)
  }
  return out
}

/** A false track: each estimate covers one step; coasting estimates coast. */
function estimateSpans(series: Series, stepS: number, durationS: number): RawSpan[] {
  const out: RawSpan[] = []
  for (let i = 0; i < series.t.length; i += 1) {
    const startS = series.t[i]
    const endS = Math.min(durationS, startS + stepS)
    if (endS <= startS) continue
    const kind = series.coast[i] ? 'coast' : 'hold'
    const last = out[out.length - 1]
    if (last && last.kind === kind && last.endS >= startS) last.endS = Math.max(last.endS, endS)
    else out.push({ kind, startS, endS })
  }
  return out
}

/** The sensor row: hold where any sub-lane holds, coast where some coast and none hold. */
function unionSpans(raw: RawSpan[]): RunTimelineSpan[] {
  const edges: Array<[number, number, number]> = []
  for (const s of raw) {
    const hold = s.kind === 'hold' ? 1 : 0
    edges.push([s.startS, hold, 1 - hold], [s.endS, -hold, hold - 1])
  }
  edges.sort((a, b) => a[0] - b[0])
  const out: RunTimelineSpan[] = []
  let holds = 0
  let coasts = 0
  let i = 0
  while (i < edges.length) {
    const t = edges[i][0]
    while (i < edges.length && edges[i][0] === t) {
      holds += edges[i][1]
      coasts += edges[i][2]
      i += 1
    }
    if (i === edges.length) break
    const kind = holds > 0 ? 'hold' : coasts > 0 ? 'coast' : null
    if (!kind) continue
    const last = out[out.length - 1]
    if (last && last.kind === kind && last.endS === t) last.endS = edges[i][0]
    else out.push({ kind, startS: t, endS: edges[i][0] })
  }
  return out
}

/** Classification ramp: each rung to the next rung or the end, never before `fromS`. */
function pushRamp(
  spans: RunTimelineSpan[],
  a: ThreatAssessment,
  fromS: number,
  endS: number,
): void {
  const c = a.classificationAtS
  const rungs: Array<['unknown' | 'suspected' | 'hostile', number]> = []
  if (c.unknownAtS != null) rungs.push(['unknown', c.unknownAtS])
  if (c.suspectedAtS != null) rungs.push(['suspected', c.suspectedAtS])
  if (c.hostileAtS != null) rungs.push(['hostile', c.hostileAtS])
  rungs.forEach(([level, atS], i) => {
    const next = i + 1 < rungs.length ? rungs[i + 1][1] : endS
    pushSpan(spans, 'classify', Math.max(atS, fromS), Math.min(next, endS), { level })
  })
}

function effectMark(event: EngagementEvent, text: string): RunTimelineMark {
  const kind =
    event.channel === 'jam'
      ? 'jam-decision'
      : event.killDelta === 1
        ? event.softShot
          ? 'mission-kill'
          : 'hard-kill'
        : 'miss'
  return { kind, tS: event.tEffectS, text, after: `pk ${event.pk.toFixed(2)}` }
}

/** Sorts the row's items and records the item extent the censor pass reads. */
function laneOf(row: RunTimelineRow, always: boolean, extra: Partial<Lane> = {}): Lane {
  row.spans.sort((a, b) => a.startS - b.startS)
  row.marks.sort((a, b) => a.tS - b.tS)
  let firstS = Infinity
  let lastS = -Infinity
  for (const s of row.spans) {
    firstS = Math.min(firstS, s.startS)
    lastS = Math.max(lastS, s.endS)
  }
  for (const m of row.marks) {
    firstS = Math.min(firstS, m.tS)
    lastS = Math.max(lastS, m.tS)
  }
  for (const sub of extra.sub ?? []) lastS = Math.max(lastS, sub.lastS)
  for (const member of extra.members ?? []) lastS = Math.max(lastS, member.fromS)
  return { row, firstS, lastS, always, ...extra }
}

function derive(view: TrialResultView): Derived {
  const cached = cache.get(view)
  if (cached) return cached
  const { scenario, durationS } = view
  const stepS = view.manifest.sweepStepS
  const cover = (endS: number) => Math.min(durationS, endS + stepS)
  const byId = new Map<string, Entity>(scenario.entities.map((e) => [e.id, e]))
  const nameOf = (id: string) => byId.get(id)?.name ?? id
  const modelName = (e: Entity) => modelFor(scenario, e)?.name ?? ''
  const enabled = (kind: Entity['kind']) =>
    scenario.entities.filter((e) => e.kind === kind && entityActive(e))
  const sensors = enabled('sensor')
  const paths = new Map(scenario.paths.map((p) => [p.entityId, p]))
  const events = [...view.attrition.events].sort((a, b) => a.tS - b.tS)

  // Observations per sensor in assessment order, and the sensor tracks they name.
  const held = new Map<string, Array<{ a: ThreatAssessment; obs: SensorObservation }>>()
  const real = new Map<string, Series>()
  const sensorIds = new Set(sensors.map((s) => s.id))
  for (const a of view.assessments) {
    for (const obs of a.sensorObservations ?? []) {
      if (!sensorIds.has(obs.sensorId)) continue
      const list = held.get(obs.sensorId) ?? []
      list.push({ a, obs })
      held.set(obs.sensorId, list)
      real.set(trackId(obs.sensorId, a.uasId), { t: [], q: [], coast: [] })
    }
  }

  // One pass over the estimates: each read of the retained ledger allocates.
  const falseTracks = new Map<string, { sensorId: string; n: number; series: Series }>()
  const falseBySensor = new Map<string, string[]>()
  const unmatched = new Set<string>()
  const prefixes = sensors.map((s) => [s.id, `${s.id}:false:`] as const)
  for (const estimate of view.result.tracks ?? []) {
    const id = estimate.id
    let series = real.get(id)
    if (!series && !unmatched.has(id)) {
      let entry = falseTracks.get(id)
      if (!entry) {
        const hit = prefixes.find(([, prefix]) => id.startsWith(prefix))
        if (hit) {
          entry = { sensorId: hit[0], n: falseTracks.size + 1, series: { t: [], q: [], coast: [] } }
          falseTracks.set(id, entry)
          const list = falseBySensor.get(hit[0]) ?? []
          list.push(id)
          falseBySensor.set(hit[0], list)
        } else unmatched.add(id)
      }
      series = entry?.series
    }
    if (!series) continue
    series.t.push(estimate.state.tS)
    series.q.push(estimate.quality)
    series.coast.push(estimate.coasting)
  }
  // A hand-built history may be out of time order; the tracker's never is.
  for (const series of [...real.values(), ...[...falseTracks.values()].map((f) => f.series)]) {
    if (series.t.every((t, i) => i === 0 || series.t[i - 1] <= t)) continue
    const order = series.t.map((_, i) => i).sort((a, b) => series.t[a] - series.t[b] || a - b)
    series.t = order.map((i) => series.t[i])
    series.q = order.map((i) => series.q[i])
    series.coast = order.map((i) => series.coast[i])
  }
  const falseLabel = (id: string) => `False track ${falseTracks.get(id)!.n}`

  // Sensors: one sub-lane per held threat, then one per false track.
  const sensorLanes = sensors.map((sensor) => {
    const subs: Lane[] = []
    const raw: RawSpan[] = []
    for (const { a, obs } of held.get(sensor.id) ?? []) {
      const name = nameOf(a.uasId)
      const spans = observationSpans(obs, stepS, durationS)
      raw.push(...spans)
      const quality = real.get(trackId(sensor.id, a.uasId))!
      const row: RunTimelineRow = {
        key: `sensor:${sensor.id}:${a.uasId}`,
        kind: 'sensor',
        label: name,
        meta: '',
        entityId: a.uasId,
        spans: laneSpans(spans, quality),
        marks: obs.intervals.map(([startS]) => ({
          kind: 'detect' as const,
          tS: startS,
          text: name,
        })),
      }
      subs.push(laneOf(row, false, { quality }))
    }
    for (const id of falseBySensor.get(sensor.id) ?? []) {
      const { series } = falseTracks.get(id)!
      const spans = estimateSpans(series, stepS, durationS)
      raw.push(...spans)
      const row: RunTimelineRow = {
        key: `sensor:${sensor.id}:${id}`,
        kind: 'sensor',
        label: falseLabel(id),
        meta: '',
        entityId: null,
        spans: laneSpans(spans, series),
        marks: [{ kind: 'detect', tS: series.t[0], text: falseLabel(id) }],
      }
      subs.push(laneOf(row, false, { quality: series }))
    }
    const row: RunTimelineRow = {
      key: `sensor:${sensor.id}`,
      kind: 'sensor',
      label: sensor.name,
      meta: modelName(sensor),
      entityId: sensor.id,
      spans: unionSpans(raw),
      marks: subs.flatMap((sub) => sub.row.marks),
      subLanes: subs.map((sub) => sub.row),
    }
    return laneOf(row, true, { sub: subs })
  })

  // Kill-chain routes once per threat; the last C2 on the route assigns.
  const assessments = new Map(view.assessments.map((a) => [a.uasId, a]))
  const routes = new Map<string, Map<string, KillChainRoute>>()
  const assignerOf = (event: EngagementEvent): string | undefined => {
    let byEffector = routes.get(event.uasId)
    if (!byEffector) {
      const a = assessments.get(event.uasId)
      byEffector = killChainRoutes(scenario, new Set(a?.detectingSensorIds ?? []))
      routes.set(event.uasId, byEffector)
    }
    return byEffector.get(event.effectorId)?.viaC2Ids.at(-1)
  }
  const c2Marks = new Map<string, RunTimelineMark[]>()
  const addC2 = (c2Id: string, mark: RunTimelineMark) => {
    const list = c2Marks.get(c2Id) ?? []
    list.push(mark)
    c2Marks.set(c2Id, list)
  }
  for (const a of view.assessments) {
    const fused = a.fusedTrack
    // An empty c2Id is sensor-level fusion: no node formed the track.
    if (!fused || fused.c2Id === '') continue
    const text = nameOf(a.uasId)
    addC2(fused.c2Id, { kind: 'init', tS: fused.initAtS, text })
    if (a.stableTrackAtS != null) addC2(fused.c2Id, { kind: 'firm', tS: a.stableTrackAtS, text })
  }
  for (const event of events) {
    const c2Id = assignerOf(event)
    if (c2Id) addC2(c2Id, { kind: 'assign', tS: event.tS, text: nameOf(event.uasId) })
  }
  const c2Lanes = enabled('c2').map((c2) =>
    laneOf(
      {
        key: `c2:${c2.id}`,
        kind: 'c2',
        label: c2.name,
        meta: modelName(c2),
        entityId: c2.id,
        spans: [],
        marks: c2Marks.get(c2.id) ?? [],
      },
      true,
    ),
  )

  // Threat outcome times shared by the track and threat rows.
  const eventsOn = new Map<string, EngagementEvent[]>()
  for (const event of events) {
    const list = eventsOn.get(event.uasId) ?? []
    list.push(event)
    eventsOn.set(event.uasId, list)
  }
  const killAtS = (a: ThreatAssessment): number | null => {
    const count = Math.max(1, byId.get(a.uasId)?.formation?.count ?? 1)
    const kills = (eventsOn.get(a.uasId) ?? [])
      .filter((e) => e.killDelta === 1)
      .map((e) => e.tEffectS)
      .sort((x, y) => x - y)
    return kills.length >= count ? kills[count - 1] : null
  }
  const lastSweepS = (a: ThreatAssessment): number => {
    const path = paths.get(a.uasId)
    if (!path) return durationS
    return Math.min(durationS, effectivePathDelayS(scenario, path) + pathDurationS(scenario, path))
  }
  const modeled = view.assessments.filter((a) => a.status !== 'no-path')

  // Tracks: one per fused track, then one per false track.
  const trackLanes: Lane[] = []
  for (const a of modeled) {
    const fused = a.fusedTrack
    if (!fused) continue
    const endS = Math.min(fused.lastAtS + stepS, durationS)
    const spans: RunTimelineSpan[] = []
    // A fused track cannot be classified before it exists.
    pushRamp(spans, a, fused.initAtS, endS)
    const marks: RunTimelineMark[] = [{ kind: 'init', tS: fused.initAtS }]
    if (a.stableTrackAtS != null) marks.push({ kind: 'firm', tS: a.stableTrackAtS })
    for (const event of eventsOn.get(a.uasId) ?? [])
      marks.push({ kind: 'assign', tS: event.tS, text: nameOf(event.effectorId) })
    const arrived = a.arrivalS != null && a.arrivalS <= fused.lastAtS
    // The last fused step lies before the threat's last sweep sample.
    const lost = fused.lastAtS + stepS <= lastSweepS(a) + 1e-9
    if (lost && killAtS(a) == null && !arrived)
      marks.push({ kind: 'drop', tS: fused.lastAtS + stepS })
    const members = fused.members.map((m) => ({ name: nameOf(m.sensorId), fromS: m.fromS }))
    const row: RunTimelineRow = {
      key: `track:${a.uasId}`,
      kind: 'track',
      label: `${nameOf(a.uasId)} track`,
      meta: members.map((m) => m.name).join(', '),
      entityId: a.uasId,
      spans,
      marks,
    }
    trackLanes.push(laneOf(row, false, { members }))
  }
  for (const [id, { sensorId, series }] of falseTracks) {
    const lastS = series.t[series.t.length - 1] + stepS
    const marks: RunTimelineMark[] = [{ kind: 'init', tS: series.t[0] }]
    if (lastS <= durationS) marks.push({ kind: 'drop', tS: lastS })
    const spans: RunTimelineSpan[] = estimateSpans(series, stepS, durationS).map((s) => ({ ...s }))
    const row: RunTimelineRow = {
      key: `track:${id}`,
      kind: 'track',
      label: falseLabel(id),
      meta: nameOf(sensorId),
      entityId: null,
      spans,
      marks,
    }
    trackLanes.push(laneOf(row, false))
  }

  // Effectors: per event in assignment order.
  const effectorLanes = enabled('effector').map((effector) => {
    const magazine = modelFor(scenario, effector)?.effector?.magazineSize
    const spans: RunTimelineSpan[] = []
    const marks: RunTimelineMark[] = []
    let assigned = 0
    for (const event of events) {
      if (event.effectorId !== effector.id) continue
      assigned += 1
      const text = nameOf(event.uasId)
      const release = engagementReleaseS(event, scenario)
      if (release == null) {
        pushSpan(spans, 'prep', event.tS, event.tEffectS, { label: 'release time unavailable' })
      } else {
        pushSpan(spans, 'prep', event.tS, release, { label: text })
        const kind = engagementIsKinetic(event)
          ? 'flight'
          : event.channelClass === 'ew'
            ? 'dwell'
            : 'burst'
        pushSpan(spans, kind, release, event.tEffectS, { label: text })
        marks.push({
          kind: 'release',
          tS: release,
          text,
          ...(magazine != null ? { after: `${Math.max(0, magazine - assigned)} left` } : {}),
        })
      }
      marks.push(effectMark(event, text))
    }
    const name = modelName(effector)
    const meta = magazine != null ? [name, `${magazine} rds`].filter(Boolean).join(' · ') : name
    return laneOf(
      {
        key: `effector:${effector.id}`,
        kind: 'effector',
        label: effector.name,
        meta,
        entityId: effector.id,
        spans,
        marks,
      },
      true,
    )
  })

  // Threats: one per assessment with a flight path.
  const threatLanes = modeled.map((a) => {
    const entity = byId.get(a.uasId)
    const path = paths.get(a.uasId)
    const startS = path ? effectivePathDelayS(scenario, path) : 0
    const killS = killAtS(a)
    const killedFirst = killS != null && (a.arrivalS == null || killS <= a.arrivalS)
    const endS = killedFirst ? killS : (a.arrivalS ?? lastSweepS(a))
    const spans: RunTimelineSpan[] = []
    pushSpan(spans, 'undetected', startS, a.firstDetectS ?? endS)
    pushRamp(spans, a, -Infinity, endS)
    for (const window of a.effectorWindows) {
      const label = nameOf(window.effectorId)
      for (const [from, to] of window.intervals)
        pushSpan(spans, 'window', from, cover(to), { label })
    }
    if (killS != null && a.arrivalS != null && killS < a.arrivalS)
      pushSpan(spans, 'ghost', killS, a.arrivalS)
    const marks: RunTimelineMark[] = []
    for (const event of eventsOn.get(a.uasId) ?? []) {
      const text = nameOf(event.effectorId)
      const release = engagementReleaseS(event, scenario)
      if (release != null) marks.push({ kind: 'shot', tS: release, text })
      marks.push(effectMark(event, text))
    }
    if (a.arrivalS != null && !killedFirst) marks.push({ kind: 'arrival', tS: a.arrivalS })
    if (a.arrivalS == null && killS == null && a.cpaS != null)
      marks.push({ kind: 'cpa', tS: a.cpaS })
    const count = Math.max(1, entity?.formation?.count ?? 1)
    const name = entity ? modelName(entity) : ''
    return laneOf(
      {
        key: `threat:${a.uasId}`,
        kind: 'threat',
        label: nameOf(a.uasId),
        meta: [name, count > 1 ? `×${count}` : ''].filter(Boolean).join(' '),
        entityId: a.uasId,
        spans,
        marks,
      },
      true,
    )
  })

  const lanes: Record<RunTimelineKind, Lane[]> = {
    sensor: sensorLanes,
    c2: c2Lanes,
    track: trackLanes,
    effector: effectorLanes,
    threat: threatLanes,
  }
  const derived: Derived = {
    groups: GROUPS.map((g) => ({ ...g, lanes: lanes[g.key] })),
    recent: [],
  }
  cache.set(view, derived)
  return derived
}

/** One row at the horizon; a row whose items all lie at or before it is returned as is. */
function censor(lane: Lane, h: ExecutionHorizon): RunTimelineRow | null {
  if (!lane.always && !reached(lane.firstS, h)) return null
  if (lane.lastS <= h.horizonS) return lane.row
  const { row } = lane
  const marks: RunTimelineMark[] = []
  for (const mark of row.marks) {
    if (!reached(mark.tS, h)) break
    marks.push(mark)
  }
  const spans: RunTimelineSpan[] = []
  for (const span of row.spans) {
    if (!reached(span.startS, h)) break
    if (span.endS <= h.horizonS) {
      spans.push(span)
      continue
    }
    if (h.horizonS <= span.startS) continue
    const clipped: RunTimelineSpan = { ...span, endS: h.horizonS }
    // The chunk holding the horizon never reads a later estimate.
    if (lane.quality && span.kind === 'hold' && span.level !== undefined) {
      const level = levelAt(lane.quality, h.horizonS)
      if (level === undefined) delete clipped.level
      else clipped.level = level
    }
    spans.push(clipped)
  }
  const out: RunTimelineRow = { ...row, spans, marks }
  if (lane.members)
    out.meta = lane.members
      .filter((m) => reached(m.fromS, h))
      .map((m) => m.name)
      .join(', ')
  if (lane.sub) {
    const subLanes: RunTimelineRow[] = []
    for (const sub of lane.sub) {
      const censored = censor(sub, h)
      if (censored) subLanes.push(censored)
    }
    out.subLanes = subLanes
  }
  return out
}

/**
 * The run timeline of one trial through the observed horizon: the lesser of
 * `horizonS` and the view's `observedThroughS`. NaN reads as nothing observed.
 */
export function runTimelineOf(view: TrialResultView, horizonS: number): RunTimelineModel {
  const derived = derive(view)
  const H = Number.isNaN(horizonS) ? -Infinity : Math.min(horizonS, view.observedThroughS)
  const hit = derived.recent.find((m) => m.horizonS === H)
  if (hit) return hit
  const h: ExecutionHorizon = { scoped: true, horizonS: H }
  const groups: RunTimelineGroup[] = []
  for (const { lanes, ...group } of derived.groups) {
    const rows: RunTimelineRow[] = []
    for (const lane of lanes) {
      const row = censor(lane, h)
      if (row) rows.push(row)
    }
    if (rows.length > 0) groups.push({ ...group, rows })
  }
  const model: RunTimelineModel = { durationS: view.durationS, horizonS: H, groups }
  derived.recent.unshift(model)
  if (derived.recent.length > RECENT) derived.recent.pop()
  return model
}

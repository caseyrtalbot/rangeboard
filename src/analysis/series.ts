/**
 * Series builders for the chart kit. Every builder is pure: the same scenario
 * object gives the same arrays, and the only cache is the engagement picture
 * that `engagementPicture` already keeps per scenario object.
 *
 * Every series is sampled on the engine DT grid from t = 0 through
 * `scenarioDurationS`: `values.length === sampleCount(scenario)`, index i is
 * t = i * DT, NaN where the quantity is undefined. A `step` series holds its
 * value from the first grid step at or after the event that set it.
 *
 * Per-track hues come from `trackSlots`: the first five tracks by first
 * detection take `CHART_SLOT_TOKENS`, the rest fold into `OTHER_TOKEN`. A
 * consumer filters AFTER that map, so a hidden track keeps its slot. Status
 * tokens color marks only, never a series.
 *
 * A builder may return `LadderRow[]` instead: spans are in seconds on the
 * same grid, and an inclusive DT interval [a, b] covers [a, b + DT) on the
 * ladder so a one-sample hold has width DT.
 */
import type { ChartMark, LadderRow, LadderSpan, Series } from '../charts/types'
import { CHART_SLOT_TOKENS, OTHER_TOKEN } from '../charts/tokens'
import { pathLength } from '../geometry/geo'
import { slantRangeM } from '../geometry/slant'
import type { Entity, Scenario, SpecModel } from '../model/types'
import { entityActive, mountHeightOf } from '../model/types'
import type { AttritionReport, EngagementEvent } from '../playback/attrition'
import { effectivePathDelayS } from '../playback/raid'
import type { SensorObservation, ThreatAssessment } from '../playback/sim'
import type { BandSeries, McSummary } from '../playback/mcRun'
import { DT } from '../playback/clock'
import { entityPosAt, threatAltitudeFt } from '../playback/tracks'
import { killChainRoutes } from '../playback/killChain'
import { buildTrackTimeline, PHASE_STYLE, trackStatesAt } from '../playback/trackState'
import type { TrackPhase } from '../playback/trackState'
import { modelFor, pathSpeed, scenarioDurationS } from '../model/scenario'
import { engagementPicture } from './impact'
import { buildLiveTimeline, liveKpisAt } from './liveStats'
import type { LiveKpis } from './liveStats'
import { FT_TO_M } from './sensorEnv'
import { threatPictureAt } from './threatAggregation'

/** Grid-snap tolerance: an event time a rounding error before a step still lands on it. */
const EPS = 1e-9

/** Phase index by `PHASE_STYLE` key order: undetected 0 through ghost 6. */
const PHASE_INDEX: Record<TrackPhase, number> = Object.fromEntries(
  Object.keys(PHASE_STYLE).map((k, i) => [k, i]),
) as Record<TrackPhase, number>

/** Sample count on the DT grid from t = 0 through scenarioDurationS: ceil(duration / DT) + 1. */
export function sampleCount(scenario: Scenario): number {
  return Math.ceil(scenarioDurationS(scenario) / DT) + 1
}

/**
 * Ships alive per step: the ship count, stepping down by killDelta at each
 * kill event's effect time. The threat pane's residual and the Monte Carlo
 * per-threat band read this one rule.
 */
export function residualOnGrid(report: AttritionReport, uasId: string, n: number): number[] {
  const shipCount = report.threats.find((x) => x.uasId === uasId)?.shipCount ?? 1
  const residual = new Array<number>(n).fill(shipCount)
  const effects = report.events
    .filter((ev) => ev.uasId === uasId && ev.killDelta > 0)
    .sort((x, y) => x.tEffectS - y.tEffectS)
  let landed = 0
  for (const ev of effects) {
    landed += ev.killDelta
    holdFrom(residual, ev.tEffectS, shipCount - landed)
  }
  return residual
}

/** A fresh grid of NaN. */
function grid(n: number): number[] {
  return new Array<number>(n).fill(Number.NaN)
}

/** First grid index whose time is at or after tS; 0 for a negative time. */
function stepIndex(tS: number): number {
  return Math.max(0, Math.ceil(tS / DT - EPS))
}

/** Hold `value` from the step at or after tS to the end of the grid. */
function holdFrom(values: number[], tS: number, value: number): void {
  for (let i = stepIndex(tS); i < values.length; i += 1) values[i] = value
}

/** Entity display name, else its id. */
function nameOf(scenario: Scenario, id: string): string {
  return scenario.entities.find((e) => e.id === id)?.name ?? id
}

/** Track hue slots by first detection. See the module note for the rule. */
export function trackSlots(scenario: Scenario): Map<string, string> {
  const { assessments } = engagementPicture(scenario)
  const order = new Map(scenario.entities.map((e, i) => [e.id, i]))
  const rank = (a: ThreatAssessment) => order.get(a.uasId) ?? Number.MAX_SAFE_INTEGER
  const sorted = [...assessments].sort((a, b) => {
    const ta = a.firstDetectS
    const tb = b.firstDetectS
    if (ta != null && tb != null && ta !== tb) return ta - tb
    if ((ta == null) !== (tb == null)) return ta == null ? 1 : -1
    return rank(a) - rank(b)
  })
  const slots = new Map<string, string>()
  sorted.forEach((a, i) => slots.set(a.uasId, CHART_SLOT_TOKENS[i] ?? OTHER_TOKEN))
  return slots
}

/**
 * Vertical marks for one track: `ARR` at arrival (danger), else `CPA` at the
 * closest approach (warn), `SHOT` at the first salvo (accent), `GATE` at the
 * ROE gate (accent). Each only when the time is a finite number.
 */
export function trackMarks(scenario: Scenario, uasId: string): ChartMark[] {
  const { assessments, report } = engagementPicture(scenario)
  const a = assessments.find((x) => x.uasId === uasId)
  if (!a) return []
  const att = report.threats.find((x) => x.uasId === uasId)
  const marks: ChartMark[] = []
  if (a.arrivalS != null && Number.isFinite(a.arrivalS)) {
    marks.push({ tS: a.arrivalS, label: 'ARR', color: 'danger' })
  } else if (a.cpaS != null && Number.isFinite(a.cpaS)) {
    marks.push({ tS: a.cpaS, label: 'CPA', color: 'warn' })
  }
  const shotS = att?.firstShotS
  if (shotS != null && Number.isFinite(shotS)) {
    marks.push({ tS: shotS, label: 'SHOT', color: 'accent' })
  }
  if (a.engageGateS != null && Number.isFinite(a.engageGateS)) {
    marks.push({ tS: a.engageGateS, label: 'GATE', color: 'accent' })
  }
  return marks
}

interface KpiSpec {
  key: keyof LiveKpis
  label: string
  unit: string | null
  color: string
}

const KPI_SPECS: KpiSpec[] = [
  { key: 'detected', label: 'Detected tracks', unit: null, color: 'chart-1' },
  { key: 'classified', label: 'Classified tracks', unit: null, color: 'chart-2' },
  { key: 'targetable', label: 'Targetable tracks', unit: null, color: 'accent' },
  { key: 'engaged', label: 'Engaged tracks', unit: null, color: 'chart-3' },
  { key: 'kineticShots', label: 'Kinetic shots', unit: null, color: 'accent' },
  { key: 'deSalvos', label: 'DE salvos', unit: null, color: 'accent' },
  { key: 'jamSalvos', label: 'Jam salvos', unit: null, color: 'ew' },
  { key: 'expectedKills', label: 'Expected kills', unit: 'ships', color: 'chart-4' },
  { key: 'lateKills', label: 'Late kills', unit: 'ships', color: 'accent' },
  { key: 'arrivedTracks', label: 'Arrived tracks', unit: null, color: 'accent' },
  { key: 'leakerShips', label: 'Leaker ships', unit: 'ships', color: 'chart-5' },
]

/**
 * One `step` series per `LiveKpis` counter, sampled from one live timeline:
 * `kpi.detected`, `kpi.classified`, `kpi.targetable`, `kpi.engaged`,
 * `kpi.kineticShots`, `kpi.deSalvos`, `kpi.jamSalvos`, `kpi.expectedKills`,
 * `kpi.lateKills`, `kpi.arrivedTracks`, `kpi.leakerShips`.
 */
export function kpiSeries(scenario: Scenario): Series[] {
  const { assessments, report } = engagementPicture(scenario)
  const tl = buildLiveTimeline(assessments, report)
  const n = sampleCount(scenario)
  const values = KPI_SPECS.map(() => grid(n))
  for (let i = 0; i < n; i += 1) {
    const k = liveKpisAt(tl, i * DT)
    KPI_SPECS.forEach((spec, j) => {
      values[j][i] = spec.key === 'leakerShips' && report.totals.reportedLeakers == null ? NaN : k[spec.key]
    })
  }
  return KPI_SPECS.map((spec, j) => ({
    id: `kpi.${spec.key}`,
    label: spec.label,
    unit: spec.unit,
    values: values[j],
    color: spec.color,
    kind: 'step',
  }))
}

/**
 * Single-scan Pd on the t = 0 grid. `pdSeries[k]` sits at
 * `pdSeriesStartS + k * DT` (the first scan taken; `firstDetectS` for a radar
 * with no scan model); NaN before that step and after the series ends.
 * The sweep grid starts at the path delay, so an off-grid delay puts every
 * observation time between two t = 0 steps; `stepIndex` is the one rule that
 * places it, shared with the hold flag so both series land on the same step.
 */
function pdOnGrid(obs: SensorObservation, n: number): number[] | null {
  if (!obs.pdSeries) return null
  const values = grid(n)
  const offset = stepIndex(obs.pdSeriesStartS ?? obs.firstDetectS)
  obs.pdSeries.forEach((pd, k) => {
    const i = offset + k
    if (i >= 0 && i < n) values[i] = pd
  })
  return values
}

/** 0/1 hold flag per step: 1 inside any of the observation's inclusive intervals. */
export function heldOnGrid(obs: SensorObservation, n: number): number[] {
  const values = new Array<number>(n).fill(0)
  for (const [startS, endS] of obs.intervals) {
    const last = Math.min(n - 1, Math.floor(endS / DT + EPS))
    for (let i = stepIndex(startS); i <= last; i += 1) values[i] = 1
  }
  return values
}

/**
 * Slant range from a phase center to a track at each step, meters. NaN for
 * a track with no path. Before its path delay `entityPosAt` places the
 * track at the path start, so the series is finite from t = 0.
 */
function slantOnGrid(
  scenario: Scenario,
  uas: Entity,
  from: { x: number; y: number },
  fromHeightM: number,
  n: number,
): number[] {
  const values = grid(n)
  if (!scenario.paths.some((p) => p.entityId === uas.id)) return values
  const dAltM = threatAltitudeFt(scenario, uas) * FT_TO_M - fromHeightM
  for (let i = 0; i < n; i += 1) {
    const pos = entityPosAt(scenario, uas, i * DT)
    values[i] = slantRangeM(Math.hypot(pos.x - from.x, pos.y - from.y), dAltM)
  }
  return values
}

/**
 * Per track this sensor observed: `pd.<uasId>` (single-scan Pd, `line`, only
 * for an observation with a `pdSeries`), `slant.<uasId>` (slant range from
 * the phase center, `line`, meters) and `held.<uasId>` (0/1 hold flag,
 * `step`). Every series takes the track's hue slot.
 */
export function sensorSeries(scenario: Scenario, sensorId: string): Series[] {
  const sensor = scenario.entities.find((e) => e.id === sensorId)
  if (!sensor) return []
  const { assessments } = engagementPicture(scenario)
  const slots = trackSlots(scenario)
  const n = sampleCount(scenario)
  const spec: SpecModel | undefined = modelFor(scenario, sensor)
  const heightM = mountHeightOf(spec?.sensor ?? {})
  const out: Series[] = []
  for (const a of assessments) {
    const obs = a.sensorObservations?.find((o) => o.sensorId === sensorId)
    if (!obs) continue
    const uas = scenario.entities.find((e) => e.id === a.uasId)
    if (!uas) continue
    const color = slots.get(a.uasId) ?? OTHER_TOKEN
    const name = uas.name
    const pd = pdOnGrid(obs, n)
    if (pd) {
      out.push({
        id: `pd.${a.uasId}`,
        label: `Pd ${name}`,
        unit: null,
        values: pd,
        color,
        kind: 'line',
      })
    }
    out.push({
      id: `slant.${a.uasId}`,
      label: `Slant range ${name}`,
      unit: 'm',
      values: slantOnGrid(scenario, uas, sensor.pos, heightM, n),
      color,
      kind: 'line',
    })
    out.push({
      id: `held.${a.uasId}`,
      label: `Held ${name}`,
      unit: null,
      values: heldOnGrid(obs, n),
      color,
      kind: 'step',
    })
  }
  return out
}

/**
 * Per engaged track: `pk.<uasId>` (latest per-shot Pk of this effector against
 * the track, `step`, track hue slot). `rounds` (`step`, magazine rounds left,
 * only for a finite `magazineSize`) drops by one at each salvo of any channel,
 * as the engine's own round counter does.
 * `salvos` (`step`, accent) counts this effector's events of every channel.
 */
export function effectorSeries(scenario: Scenario, effectorId: string): Series[] {
  const effector = scenario.entities.find((e) => e.id === effectorId)
  if (!effector) return []
  const { report } = engagementPicture(scenario)
  const slots = trackSlots(scenario)
  const n = sampleCount(scenario)
  const events = report.events.filter((ev) => ev.effectorId === effectorId)
  const out: Series[] = []

  const byTrack = new Map<string, EngagementEvent[]>()
  for (const ev of events) {
    const list = byTrack.get(ev.uasId)
    if (list) list.push(ev)
    else byTrack.set(ev.uasId, [ev])
  }
  for (const [uasId, list] of byTrack) {
    const values = grid(n)
    // Events arrive in assignment order, so each hold overwrites the last.
    for (const ev of list) holdFrom(values, ev.tS, ev.pk)
    out.push({
      id: `pk.${uasId}`,
      label: `Pk ${nameOf(scenario, uasId)}`,
      unit: null,
      values,
      color: slots.get(uasId) ?? OTHER_TOKEN,
      kind: 'step',
    })
  }

  const magazine = modelFor(scenario, effector)?.effector?.magazineSize
  if (magazine != null && Number.isFinite(magazine)) {
    const values = new Array<number>(n).fill(magazine)
    let left = magazine
    for (const ev of events) {
      left -= 1
      holdFrom(values, ev.tS, left)
    }
    out.push({
      id: 'rounds',
      label: 'Rounds left',
      unit: 'rounds',
      values,
      color: 'accent',
      kind: 'step',
    })
  }

  const salvos = new Array<number>(n).fill(0)
  events.forEach((ev, k) => holdFrom(salvos, ev.tS, k + 1))
  out.push({
    id: 'salvos',
    label: 'Salvos',
    unit: null,
    values: salvos,
    color: 'accent',
    kind: 'step',
  })
  return out
}

/**
 * For one track: `pd.<sensorId>` per radar observation with a `pdSeries`
 * (`line`, colored by observation order), `residual` (`step`, ships: the
 * ship count minus the kill mass landed by t, so it ends at
 * shipCount - expectedKills - expectedLateKills, `chart-1`) and `phase`
 * (`step`, the `PHASE_STYLE` key index 0..6, accent).
 */
export function threatSeries(scenario: Scenario, uasId: string): Series[] {
  const { assessments, report } = engagementPicture(scenario)
  const a = assessments.find((x) => x.uasId === uasId)
  if (!a) return []
  const n = sampleCount(scenario)
  const out: Series[] = []

  let slot = 0
  for (const obs of a.sensorObservations ?? []) {
    const pd = pdOnGrid(obs, n)
    if (!pd) continue
    out.push({
      id: `pd.${obs.sensorId}`,
      label: `Pd ${nameOf(scenario, obs.sensorId)}`,
      unit: null,
      values: pd,
      color: CHART_SLOT_TOKENS[slot] ?? OTHER_TOKEN,
      kind: 'line',
    })
    slot += 1
  }

  const residual = residualOnGrid(report, uasId, n)
  out.push({
    id: 'residual',
    label: 'Residual ships',
    unit: 'ships',
    values: residual,
    color: 'chart-1',
    kind: 'step',
  })

  const tl = buildTrackTimeline(scenario, assessments, report)
  const phase = grid(n)
  for (let i = 0; i < n; i += 1) {
    const state = trackStatesAt(tl, i * DT).get(uasId)
    if (state) phase[i] = PHASE_INDEX[state.phase]
  }
  out.push({
    id: 'phase',
    label: 'Phase',
    unit: null,
    values: phase,
    color: 'accent',
    kind: 'step',
  })
  return out
}

/**
 * System timing: `latency.<uasId>` per track (`step`, seconds: first shot
 * minus first detection, held from the first shot on; NaN for a track never
 * shot at) and `hop.<effectorId>` per routed effector (`line`, seconds: the
 * kill-chain route latency, constant over the grid, accent).
 */
export function systemSeries(scenario: Scenario): Series[] {
  const { assessments, report } = engagementPicture(scenario)
  const slots = trackSlots(scenario)
  const n = sampleCount(scenario)
  const out: Series[] = []

  for (const a of assessments) {
    const att = report.threats.find((x) => x.uasId === a.uasId)
    const values = grid(n)
    if (a.firstDetectS != null && att?.firstShotS != null) {
      holdFrom(values, att.firstShotS, att.firstShotS - a.firstDetectS)
    }
    out.push({
      id: `latency.${a.uasId}`,
      label: `Detect to shot ${nameOf(scenario, a.uasId)}`,
      unit: 's',
      values,
      color: slots.get(a.uasId) ?? OTHER_TOKEN,
      kind: 'step',
    })
  }

  // The engine charges each threat its own route from the sensors that
  // detected it, so the hop series is per (effector, threat).
  for (const a of assessments) {
    if (a.detectingSensorIds.length === 0) continue
    const routes = killChainRoutes(scenario, new Set(a.detectingSensorIds))
    for (const route of routes.values()) {
      out.push({
        id: `hop.${route.effectorId}.${a.uasId}`,
        label: `Route latency ${nameOf(scenario, route.effectorId)} to ${nameOf(scenario, a.uasId)}`,
        unit: 's',
        values: new Array<number>(n).fill(route.latencyS),
        color: 'accent',
        kind: 'line',
      })
    }
  }
  return out
}

/** One legend entry of the sensor track ladder. */
export interface LadderStyle {
  label: string
  color: string
}

/** The span kinds of the sensor track ladder. */
type TrackLadderKind = 'search' | 'init' | 'track' | 'coast' | 'drop'

/**
 * The one style table of the sensor track ladder. search takes the
 * `PHASE_STYLE.searching` color, init 'warn', track 'danger', coast the
 * mockup COAST grey (`PHASE_STYLE` has no coast entry) and drop 'accent'.
 * Color is a token name or a hex, as `Series.color`.
 */
export const TRACK_LADDER_STYLE: Record<TrackLadderKind, LadderStyle> = {
  search: { label: 'Search', color: PHASE_STYLE.searching.color },
  init: { label: 'Init', color: 'warn' },
  track: { label: 'Track', color: 'danger' },
  coast: { label: 'Coast', color: '#5b6a74' },
  drop: { label: 'Drop', color: 'accent' },
}

/**
 * Start and end time of a track's path: the effective delay (path plus wave,
 * the same start the sweep uses) and the delay plus the flight time. Null
 * for a track with no path.
 */
function pathWindow(scenario: Scenario, uasId: string): [number, number] | null {
  const path = scenario.paths.find((p) => p.entityId === uasId)
  if (!path) return null
  const startS = effectivePathDelayS(scenario, path)
  return [startS, startS + pathLength(path.points) / pathSpeed(scenario, path)]
}

function trackSpan(kind: TrackLadderKind, startS: number, endS: number): LadderSpan {
  return { startS, endS, color: TRACK_LADDER_STYLE[kind].color, label: kind }
}

/**
 * The spans of `kind` over [fromS, toS) minus every coast window in `coasts`
 * (each already widened to the ladder rule). Emits nothing for an empty range.
 */
function minusCoasts(
  kind: TrackLadderKind,
  fromS: number,
  toS: number,
  coasts: Array<[number, number]>,
): LadderSpan[] {
  const out: LadderSpan[] = []
  let cursor = fromS
  for (const [ca, cb] of coasts) {
    if (cb <= cursor || ca >= toS) continue
    if (ca > cursor) out.push(trackSpan(kind, cursor, ca))
    cursor = Math.max(cursor, cb)
  }
  if (cursor < toS) out.push(trackSpan(kind, cursor, toS))
  return out
}

/**
 * Ladder spans of one observation. The partition rule:
 *   search: [pathStartS, firstDetectS) when firstDetectS > pathStartS.
 *   init:   [firstDetectS, trackInitAtS) when trackInitAtS is non-null and
 *           later than firstDetectS, minus any coast inside it (M-of-N lets
 *           a missed scan precede initiation, so the engine does put one there).
 *   track:  each hold interval, clipped to start at trackInitAtS (else at
 *           firstDetectS), minus every coast.
 *   coast:  each coast interval as is.
 *   drop:   a zero-width span at the ladder end of every interval that ends
 *           more than DT before the path end.
 * Every span end is clamped to the duration; the sweep samples one step past
 * the path end.
 */
function observationSpans(
  obs: SensorObservation,
  pathStartS: number,
  pathEndS: number,
  durationS: number,
): LadderSpan[] {
  const clamp = (t: number) => Math.min(t, durationS)
  const coasts = obs.coastIntervals.map(([a, b]): [number, number] => [a, clamp(b + DT)])
  const init = obs.trackInitAtS
  const trackFromS = init ?? obs.firstDetectS
  const spans: LadderSpan[] = []
  if (obs.firstDetectS > pathStartS) {
    spans.push(trackSpan('search', pathStartS, clamp(obs.firstDetectS)))
  }
  // The M-of-N window can span a drop, so init fills only where the sensor held the track.
  if (init != null && init > obs.firstDetectS) {
    for (const [a, b] of obs.intervals) {
      const startS = Math.max(a, obs.firstDetectS)
      const endS = Math.min(clamp(b + DT), clamp(init))
      if (endS > startS) spans.push(...minusCoasts('init', startS, endS, coasts))
    }
  }
  for (const [a, b] of obs.intervals) {
    const endS = clamp(b + DT)
    spans.push(...minusCoasts('track', Math.max(a, trackFromS), endS, coasts))
    if (b < pathEndS - DT) spans.push(trackSpan('drop', endS, endS))
  }
  for (const [a, b] of coasts) spans.push(trackSpan('coast', a, b))
  // Stable: a drop at the same time as a following span draws first.
  return spans.sort((x, y) => x.startS - y.startS || (x.endS - x.startS) - (y.endS - y.startS))
}

/**
 * One row per track this sensor observed (assessment order, as `sensorSeries`).
 * Row id = uasId, label = the entity name. Spans partition the observation
 * per `observationSpans` and never overlap; each takes
 * `TRACK_LADDER_STYLE[kind].color` and carries the kind as its label. A track
 * with no path gives no row.
 */
export function trackLadderRows(scenario: Scenario, sensorId: string): LadderRow[] {
  const { assessments } = engagementPicture(scenario)
  const durationS = scenarioDurationS(scenario)
  const rows: LadderRow[] = []
  for (const a of assessments) {
    const obs = a.sensorObservations?.find((o) => o.sensorId === sensorId)
    if (!obs) continue
    const window = pathWindow(scenario, a.uasId)
    if (!window) continue
    rows.push({
      id: a.uasId,
      label: nameOf(scenario, a.uasId),
      spans: observationSpans(obs, window[0], window[1], durationS),
    })
  }
  return rows
}

/**
 * Tracks this sensor holds per step: `scanLoad` (`step`, tracks, chart-1),
 * the count of this sensor's observations whose `held.<uasId>` flag is 1.
 * Zeros, never NaN, when the sensor observed nothing or the id is unknown.
 */
export function scanLoadSeries(scenario: Scenario, sensorId: string): Series {
  const values = new Array<number>(sampleCount(scenario)).fill(0)
  for (const s of sensorSeries(scenario, sensorId)) {
    if (!s.id.startsWith('held.')) continue
    s.values.forEach((v, i) => {
      if (v === 1) values[i] += 1
    })
  }
  return {
    id: 'scanLoad',
    label: 'Tracks held',
    unit: 'tracks',
    values,
    color: 'chart-1',
    kind: 'step',
  }
}

const finite = (v: number | undefined): v is number => v != null && Number.isFinite(v)

/**
 * One pass over `sensorSeries` of every active sensor.
 *
 * Tracks held: at step i, the count of tracks whose `held.<uasId>` flag is 1
 * for at least one enabled sensor. Mean Pd: at step i, over those held
 * tracks, take per track the largest finite `pd.<uasId>` among the sensors
 * holding it, then the mean over tracks; NaN when no held track has a
 * finite Pd at that step.
 */
function heldPass(scenario: Scenario): { tracks: number[]; meanPd: number[] } {
  const n = sampleCount(scenario)
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e))
  const held = new Map<string, number[][]>()
  const pd = new Map<string, number[][]>()
  for (const sensor of sensors) {
    for (const s of sensorSeries(scenario, sensor.id)) {
      const dot = s.id.indexOf('.')
      const kind = s.id.slice(0, dot)
      const uasId = s.id.slice(dot + 1)
      const target = kind === 'held' ? held : kind === 'pd' ? pd : null
      if (!target || !uasId) continue
      const list = target.get(uasId) ?? []
      list.push(s.values)
      target.set(uasId, list)
    }
  }
  const tracks = new Array<number>(n).fill(0)
  const meanPd = grid(n)
  for (let i = 0; i < n; i += 1) {
    let count = 0
    let pdSum = 0
    let pdCount = 0
    for (const [uasId, flags] of held) {
      if (!flags.some((f) => f[i] === 1)) continue
      count += 1
      let best = Number.NaN
      for (const values of pd.get(uasId) ?? []) {
        const v = values[i]
        if (finite(v) && (!finite(best) || v > best)) best = v
      }
      if (finite(best)) {
        pdSum += best
        pdCount += 1
      }
    }
    tracks[i] = count
    if (pdCount > 0) meanPd[i] = pdSum / pdCount
  }
  return { tracks, meanPd }
}

/**
 * `tracksHeld` (`step`, tracks, chart-1): at step i, the count of tracks
 * whose `held.<uasId>` flag is 1 for at least one enabled sensor.
 */
export function heldTracksSeries(scenario: Scenario): Series {
  const { tracks } = heldPass(scenario)
  return {
    id: 'tracksHeld',
    label: 'Tracks held',
    unit: 'tracks',
    values: tracks,
    color: 'chart-1',
    kind: 'step',
  }
}

/**
 * `meanPd` (`line`, Pd, chart-4): at step i, over the held tracks, take per
 * track the largest finite `pd.<uasId>` among the sensors holding it, then
 * the mean over tracks; NaN when no held track has a finite Pd at that step.
 */
export function meanHeldPdSeries(scenario: Scenario): Series {
  const { meanPd } = heldPass(scenario)
  return {
    id: 'meanPd',
    label: 'Mean Pd of held tracks',
    unit: 'Pd',
    values: meanPd,
    color: 'chart-4',
    kind: 'line',
  }
}

/** `salvosInFlight` (`step`, chart-2): at step i, events with tS <= t < tEffectS. */
export function salvosInFlightSeries(scenario: Scenario): Series {
  const { report } = engagementPicture(scenario)
  const n = sampleCount(scenario)
  const inFlight = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i += 1) {
    const t = i * DT
    inFlight[i] = report.events.filter((ev) => ev.tS <= t && t < ev.tEffectS).length
  }
  return {
    id: 'salvosInFlight',
    label: 'Salvos in flight',
    unit: null,
    values: inFlight,
    color: 'chart-2',
    kind: 'step',
  }
}

/**
 * One `step` series per threat group (`threatPictureAt` over the whole run):
 * `group.<groupId>`, the element-wise sum of its members' residual ships,
 * colored by group index through `CHART_SLOT_TOKENS`.
 */
export function groupResidualSeries(scenario: Scenario): Series[] {
  const { assessments, report } = engagementPicture(scenario)
  const n = sampleCount(scenario)
  const groups = threatPictureAt(scenario, assessments, report, Number.POSITIVE_INFINITY, new Map())
  return groups.map((group, index) => {
    const values = grid(n)
    for (const member of group.members) {
      const residual = threatSeries(scenario, member.uasId).find((s) => s.id === 'residual')
      if (!residual) continue
      for (let i = 0; i < n; i += 1) {
        const v = residual.values[i]
        if (!finite(v)) continue
        values[i] = finite(values[i]) ? values[i] + v : v
      }
    }
    return {
      id: `group.${group.id}`,
      label: group.label,
      unit: 'ships',
      values,
      color: CHART_SLOT_TOKENS[index] ?? OTHER_TOKEN,
      kind: 'step',
    }
  })
}

/** This effector's events in release order. */
function effectorEvents(scenario: Scenario, effectorId: string): EngagementEvent[] {
  const { report } = engagementPicture(scenario)
  return report.events.filter((ev) => ev.effectorId === effectorId).sort((a, b) => a.tS - b.tS)
}

/**
 * Salvo marks of one effector in time order: per event `REL` at tS (accent)
 * and `FX` at tEffectS (danger, or ew for a jam salvo).
 */
export function salvoMarks(scenario: Scenario, effectorId: string): ChartMark[] {
  const marks: ChartMark[] = []
  for (const ev of effectorEvents(scenario, effectorId)) {
    marks.push({ tS: ev.tS, label: 'REL', color: 'accent' })
    marks.push({ tS: ev.tEffectS, label: 'FX', color: ev.channel === 'jam' ? 'ew' : 'danger' })
  }
  return marks.sort((a, b) => a.tS - b.tS)
}

/**
 * Release-to-effect ladder of one effector: one row per engaged track in
 * first-event order, id = uasId, label = the entity name, one span per event
 * [tS, tEffectS] in the track's hue slot, label 'salvo'. A zero-flight-time
 * event gives startS === endS.
 */
export function releaseLadderRows(scenario: Scenario, effectorId: string): LadderRow[] {
  const slots = trackSlots(scenario)
  const rows = new Map<string, LadderRow>()
  for (const ev of effectorEvents(scenario, effectorId)) {
    let row = rows.get(ev.uasId)
    if (!row) {
      row = { id: ev.uasId, label: nameOf(scenario, ev.uasId), spans: [] }
      rows.set(ev.uasId, row)
    }
    row.spans.push({
      startS: ev.tS,
      endS: ev.tEffectS,
      color: slots.get(ev.uasId) ?? OTHER_TOKEN,
      label: 'salvo',
    })
  }
  return [...rows.values()]
}

/**
 * The phase ladder of one track: one row, id = uasId, label 'Phase'.
 * Consecutive steps with the same `trackStatesAt` phase form one span
 * [i * DT, (j + 1) * DT) clamped to the duration; 'undetected' draws no
 * span; every other phase takes the `PHASE_STYLE` color and label. A row
 * with no spans for an unknown id.
 */
export function phaseLadderRow(scenario: Scenario, uasId: string): LadderRow {
  const row: LadderRow = { id: uasId, label: 'Phase', spans: [] }
  const { assessments, report } = engagementPicture(scenario)
  if (!assessments.some((a) => a.uasId === uasId)) return row
  const tl = buildTrackTimeline(scenario, assessments, report)
  const n = sampleCount(scenario)
  const durationS = scenarioDurationS(scenario)
  let current: TrackPhase = 'undetected'
  let startI = 0
  for (let i = 0; i <= n; i += 1) {
    const phase: TrackPhase =
      i < n ? (trackStatesAt(tl, i * DT).get(uasId)?.phase ?? 'undetected') : 'undetected'
    if (i < n && phase === current) continue
    const style = PHASE_STYLE[current]
    if (style.color != null) {
      row.spans.push({
        startS: startI * DT,
        endS: Math.min(i * DT, durationS),
        color: style.color,
        label: style.label,
      })
    }
    current = phase
    startI = i
  }
  return row
}

/** The summary band a series id maps to; null when the summary carries none for it. */
function bandFor(summary: McSummary, id: string, uasId?: string): BandSeries | null {
  switch (id) {
    case 'kpi.expectedKills':
      return summary.kills
    case 'kpi.leakerShips':
      return summary.leakers
    case 'kpi.detected':
      return summary.detected
    case 'kpi.engaged':
      return summary.engaged
    case 'tracksHeld':
      return summary.tracked
    case 'residual':
      return uasId ? (summary.perThreat[uasId]?.residual ?? null) : null
    default:
      return null
  }
}

/**
 * Mean lines and replicate quantile bands share the same samples. Unsupported quantities
 * remain explicitly deterministic; missing/mismatched supported estimates stay unavailable.
 */
export function withBands(series: Series[], summary: McSummary | null, uasId?: string): Series[] {
  const covered = new Set(['kpi.expectedKills', 'kpi.leakerShips', 'kpi.detected', 'kpi.engaged', 'tracksHeld', 'residual'])
  return series.map((s) => {
    if (!summary || !covered.has(s.id)) return { ...s, label: `${s.label} · planning envelope` }
    const band = bandFor(summary, s.id, uasId)
    const vectors = band && [band.mean, band.p10, band.p90, band.p025, band.p975]
    if (!band || summary.replicates < 1 || !vectors?.every((values) =>
      values.length === s.values.length && values.every(Number.isFinite))) {
      return { ...s, label: `${s.label} · MC estimate unavailable`, values: s.values.map(() => NaN), band80: undefined, band95: undefined }
    }
    // Leakers have no defined display value without a defended asset. The engine's
    // partition zero must not manufacture a chart of perfect defence in that case.
    const mask = (values: number[]) => s.id === 'kpi.leakerShips'
      ? values.map((value, i) => Number.isFinite(s.values[i]) ? value : NaN)
      : values
    return {
      ...s,
      label: `${s.label} · MC mean`,
      values: mask(band.mean),
      band80: [mask(band.p10), mask(band.p90)],
      band95: [mask(band.p025), mask(band.p975)],
    }
  })
}

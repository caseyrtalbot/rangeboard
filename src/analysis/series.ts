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
 */
import type { ChartMark, Series } from '../charts/types'
import { CHART_SLOT_TOKENS, OTHER_TOKEN } from '../charts/tokens'
import { slantRangeM } from '../geometry/slant'
import type { Entity, Scenario, SpecModel } from '../model/types'
import { mountHeightOf } from '../model/types'
import type { EngagementEvent } from '../playback/attrition'
import type { SensorObservation, ThreatAssessment } from '../playback/sim'
import { DT, entityPosAt, killChainRoutes, threatAltitudeFt } from '../playback/sim'
import { buildTrackTimeline, PHASE_STYLE, trackStatesAt } from '../playback/trackState'
import type { TrackPhase } from '../playback/trackState'
import { modelFor, scenarioDurationS } from '../state/store'
import { engagementPicture } from './impact'
import { buildLiveTimeline, liveKpisAt } from './liveStats'
import type { LiveKpis } from './liveStats'
import { FT_TO_M } from './sensorEnv'

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
      values[j][i] = k[spec.key]
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
 * `firstDetectS + k * DT`; NaN before first detection and after the series ends.
 * The sweep grid starts at the path delay, so an off-grid delay puts every
 * observation time between two t = 0 steps; `stepIndex` is the one rule that
 * places it, shared with the hold flag so both series land on the same step.
 */
function pdOnGrid(obs: SensorObservation, n: number): number[] | null {
  if (!obs.pdSeries) return null
  const values = grid(n)
  const offset = stepIndex(obs.firstDetectS)
  obs.pdSeries.forEach((pd, k) => {
    const i = offset + k
    if (i >= 0 && i < n) values[i] = pd
  })
  return values
}

/** 0/1 hold flag per step: 1 inside any of the observation's inclusive intervals. */
function heldOnGrid(obs: SensorObservation, n: number): number[] {
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

  const att = report.threats.find((x) => x.uasId === uasId)
  const shipCount = att?.shipCount ?? 1
  const residual = new Array<number>(n).fill(shipCount)
  const effects = report.events
    .filter((ev) => ev.uasId === uasId && ev.killDelta > 0)
    .sort((x, y) => x.tEffectS - y.tEffectS)
  let landed = 0
  for (const ev of effects) {
    landed += ev.killDelta
    holdFrom(residual, ev.tEffectS, shipCount - landed)
  }
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

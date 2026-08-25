import type { EffectorSpec, Entity, FlightPath, Scenario, Vec2 } from '../model/types'
import type { ThreatAssessment, ThreatClassification } from './sim'
import type { AttritionReport, EngagementEvent } from './attrition'
import { SHIP_DEAD_BELOW } from './attrition'
import { memberPositions } from './sim'
import { posAtTime } from '../geometry/geo'
import { effectivePathDelayS } from './raid'
import { profileFor } from '../model/integration'

/**
 * Per-track playback state for the board. buildTrackTimeline prefix-aggregates
 * the whole-run forecast (threat assessments plus the engagement ledger) once
 * per scenario; the query functions then answer "what does this track look
 * like at sim time t" with binary searches, cheap enough for the rAF frame
 * rate. Pure TS: no React, no Konva, no DOM, no store imports.
 *
 * Nothing here is stored. The engine has no discrete kill event and no
 * track-state field, so a ghost is expected residual below the engine's own
 * SHIP_DEAD_BELOW cutoff, a jammed track is the engine's continue-jam
 * probability replayed to time t, and every pulse is a function of sim time so
 * a paused run freezes it.
 *
 * Time semantics match the ledger: a salvo is assigned at tS and its effect
 * lands at tEffectS. Expenditure counts at tS; kill mass and jam mass count at
 * tEffectS.
 */

/** Seconds a zero-flight-time effect (beam, instantaneous burst) stays drawn. */
export const BEAM_DISPLAY_S = 0.6

/** Pulse period, seconds. */
export const BLINK_PERIOD_S = 0.5

/**
 * Hold tolerance, seconds. The sweep samples every 0.5 s, so a query between
 * two samples still counts as held (same rule as heldAt in
 * src/analysis/threatAggregation.ts).
 */
const HOLD_TOLERANCE_S = 0.25

/**
 * Track lifecycle, highest precedence first:
 * ghost > engaged > targeted > identified > tracked > searching > undetected.
 */
export type TrackPhase =
  | 'undetected' | 'searching' | 'tracked' | 'identified'
  | 'targeted' | 'engaged' | 'ghost'

/**
 * Canonical phase presentation. One table, so the canvas ring and the
 * telemetry pill can never drift apart. `color` is null for 'undetected',
 * which takes the entity color and draws no ring.
 */
export const PHASE_STYLE = {
  undetected: { label: 'UNDETECTED', color: null },
  searching: { label: 'SEARCHING', color: '#82887e' },
  tracked: { label: 'TRACKED', color: '#d9a441' },
  identified: { label: 'HOSTILE', color: '#c4564a' },
  targeted: { label: 'TARGETED', color: '#c4564a' },
  engaged: { label: 'ENGAGED', color: '#c4564a' },
  ghost: { label: 'GHOST', color: '#6a7178' },
} as const satisfies Record<TrackPhase, { label: string; color: string | null }>

export interface TrackFileState {
  uasId: string
  phase: TrackPhase
  /** Any sensor has held it at or before t. */
  detected: boolean
  /** A sensor holds it at t. */
  heldNow: boolean
  holdingSensorIds: string[]
  /** Ladder rung reached by t. */
  classification: ThreatClassification
  /** Inside a usable ROE-gated effector window at t. */
  targetedNow: boolean
  /** Salvos assigned whose effect has not landed at t. */
  incomingSalvos: number
  /** Salvos assigned at or before t (kinetic plus jam). */
  salvosAssigned: number
  kineticSalvos: number
  jamSalvos: number
  /** Effects landed at or before t. */
  effectsLanded: number
  /** Expected kill mass landed at or before t, in ships. */
  expectedKills: number
  shipCount: number
  /** shipCount minus expectedKills, floored at 0. */
  residual: number
  /** residual / shipCount, 0..1. */
  residualFraction: number
  /** Probability the track is degraded by a 'continue' jam at t, 0..1. */
  jammedFraction: number
  /** residualFraction < SHIP_DEAD_BELOW. */
  eliminated: boolean
  /** Effect time at which it first fell below the cutoff; null while alive. */
  eliminatedAtS: number | null
  /** True when the dominant landed kill mass came from jammers. */
  eliminatedBySoft: boolean
  arrivalS: number | null
  arrived: boolean
}

/** A salvo drawn on the canvas between launch and effect. */
export interface ShotInFlight {
  effectorId: string
  uasId: string
  shipIdx: number
  tS: number
  tEffectS: number
  /** 0 at launch, 1 at effect. Always 1 for zero-flight-time effects. */
  progress: number
  channel: 'kill' | 'jam'
  softShot: boolean
  pk: number
  /** Effector world position. */
  from: Vec2
  /** Target ship world position at tEffectS. */
  to: Vec2
  mode: EffectorEngagementMode
}

/**
 * How the weapon guides, which drives what the canvas draws.
 * 'semi-active' - the effector keeps illuminating or steering the round, so its
 *   glyph stays FILLED for the whole time of flight and the guidance line stays
 *   bright.
 * 'active' - the round guides itself, so the glyph BLINKS at launch and then
 *   returns to outline while a seeker ring rides the round.
 * 'beam' - continuous directed energy or jamming: no discrete round, a pulsing
 *   dashed beam for the dwell, glyph stays FILLED.
 */
export type EffectorEngagementMode = 'semi-active' | 'active' | 'beam'

/** Effector glyph treatment at t. 'idle' draws the outline frame only. */
export type EffectorLiveState = 'idle' | 'semi-active' | 'active' | 'beam'

/** Researched guidance value to draw treatment. */
const GUIDANCE_MODE: Record<'fc-uplink' | 'c2-cue' | 'self' | 'operator', EffectorEngagementMode> = {
  'fc-uplink': 'semi-active',
  operator: 'semi-active',
  'c2-cue': 'active',
  self: 'active',
}

/** Effector-type fallback when no integration profile carries a guidance. */
const TYPE_MODE: Record<EffectorSpec['effectorType'], EffectorEngagementMode> = {
  interceptor: 'active',
  gun: 'semi-active',
  net: 'semi-active',
  jammer: 'beam',
  de: 'beam',
  hpm: 'beam',
}

/**
 * Guidance mapping, read from the researched integration profile
 * (`profileFor(specId)?.guidance` in src/model/integration.ts):
 *   fc-uplink -> semi-active, operator -> semi-active,
 *   c2-cue    -> active,      self     -> active.
 * Fallback by effector type when no profile exists:
 *   interceptor -> active, gun -> semi-active, net -> semi-active,
 *   jammer | de | hpm -> beam (these always win, profile or not).
 * An effector with neither a profile nor a spec draws semi-active: the calmest
 * treatment, with no pulse for a weapon whose guidance is unknown.
 */
export function effectorEngagementMode(
  specId: string | null,
  effectorType: EffectorSpec['effectorType'] | undefined,
): EffectorEngagementMode {
  // Directed energy and jamming have no discrete round, so the beam treatment
  // outranks whatever guidance the profile claims.
  if (effectorType && TYPE_MODE[effectorType] === 'beam') return 'beam'
  const guidance = profileFor(specId)?.guidance
  if (guidance) return GUIDANCE_MODE[guidance]
  return effectorType ? TYPE_MODE[effectorType] : 'semi-active'
}

/** One sensor's hold history against one track, ascending. */
interface HoldSeries {
  sensorId: string
  intervals: Array<[number, number]>
  /** Parallel to intervals: interval start times, for the binary search. */
  starts: number[]
}

/** Everything one threat needs, pre-sorted into prefix arrays. */
interface TrackSeries {
  uasId: string
  shipCount: number
  holds: HoldSeries[]
  firstDetectS: number | null
  /** Ladder times ascending; rungs[i] is the highest rung reached by rungTS[i]. */
  rungTS: number[]
  rungs: ThreatClassification[]
  /** Usable ROE-gated window; null unless the status is 'engageable'. */
  windowS: [number, number] | null
  arrivalS: number | null
  /** Salvo assignment times ascending, split by expenditure channel. */
  kineticTS: number[]
  jamTS: number[]
  assignTS: number[]
  /** Per-salvo end of draw ascending: tEffectS, or tS + BEAM_DISPLAY_S. */
  liveEndTS: number[]
  /** Effect times ascending with the running expected-kill mass. */
  effectTS: number[]
  killPrefix: number[]
  /** 'continue' jam effect times ascending with the running formation jam probability. */
  jamEffectTS: number[]
  jammedPrefix: number[]
  eliminatedAtS: number | null
  eliminatedBySoft: boolean
}

/** One ledger salvo with its geometry and draw window resolved at build time. */
interface ShotRecord {
  effectorId: string
  uasId: string
  shipIdx: number
  tS: number
  tEffectS: number
  /** Draw ends here: tEffectS, or tS + BEAM_DISPLAY_S at zero flight time. */
  liveEndS: number
  channel: 'kill' | 'jam'
  softShot: boolean
  pk: number
  from: Vec2
  to: Vec2
  mode: EffectorEngagementMode
}

/** Built once per (scenario, assessments, report). Opaque to callers. */
export interface TrackTimeline {
  tracks: TrackSeries[]
  /** Every salvo, assignment time ascending. */
  shots: ShotRecord[]
  /** Parallel to shots: assignment times, for the range scan. */
  shotTS: number[]
  /** Longest draw span over every salvo; bounds the live-shot scan window. */
  maxSpanS: number
}

/** Count of sorted values <= t (upper bound by binary search). */
function countAtMost(sorted: number[], t: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** First index whose value is >= t (lower bound by binary search). */
function lowerBound(sorted: number[], t: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Prefix value for the first n entries; 0 when n is 0. */
function prefixAt(prefix: number[], n: number): number {
  return n > 0 ? prefix[n - 1] : 0
}

function ascending(a: number, b: number): number {
  return a - b
}

/** Rung order on the derived classification ladder. */
const RUNG_RANK: Record<ThreatClassification, number> = {
  pending: 0,
  unknown: 1,
  suspected: 2,
  hostile: 3,
}

/** The 0.25 s tolerant hold test over one sensor's ascending, disjoint intervals. */
function heldIn(series: HoldSeries, tS: number): boolean {
  // Candidates are the intervals that already started; ends ascend with
  // starts, so the newest candidate carries the greatest end. The one before
  // it is checked as well in case the tolerance widens two neighbours across
  // the same instant.
  const n = countAtMost(series.starts, tS + HOLD_TOLERANCE_S)
  for (let i = n - 1; i >= 0 && i >= n - 2; i--) {
    const [start, end] = series.intervals[i]
    if (tS >= start - HOLD_TOLERANCE_S && tS <= end + HOLD_TOLERANCE_S) return true
  }
  return false
}

/** Effective path speed: override, spec cruise, or 15 m/s (matches store.pathSpeed). */
function speedFor(scenario: Scenario, path: FlightPath): number {
  if (path.speedMps && path.speedMps > 0) return path.speedMps
  const entity = scenario.entities.find((e) => e.id === path.entityId)
  const model = entity ? scenario.library.find((m) => m.id === entity.specId) : undefined
  return model?.uas?.cruiseSpeedMps ?? 15
}

/** Last instant the salvo is drawn. A zero-flight-time effect holds for BEAM_DISPLAY_S. */
function drawEndS(ev: EngagementEvent): number {
  return ev.tEffectS > ev.tS ? ev.tEffectS : ev.tS + BEAM_DISPLAY_S
}

export function buildTrackTimeline(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
): TrackTimeline {
  const eventsByThreat = new Map<string, EngagementEvent[]>()
  for (const ev of report.events) {
    const list = eventsByThreat.get(ev.uasId)
    if (list) list.push(ev)
    else eventsByThreat.set(ev.uasId, [ev])
  }

  const tracks: TrackSeries[] = []
  for (const a of assessments) {
    if (a.status === 'no-path') continue
    const entity = scenario.entities.find((e) => e.id === a.uasId)
    const att = report.threats.find((x) => x.uasId === a.uasId)
    const formationCount =
      entity?.formation && entity.formation.count > 1 ? entity.formation.count : 1
    const shipCount = att ? att.shipCount : formationCount
    const evs = eventsByThreat.get(a.uasId) ?? []

    const kineticTS: number[] = []
    const jamTS: number[] = []
    const assignTS: number[] = []
    const liveEndTS: number[] = []
    for (const ev of evs) {
      assignTS.push(ev.tS)
      if (ev.softShot) jamTS.push(ev.tS)
      else kineticTS.push(ev.tS)
      liveEndTS.push(drawEndS(ev))
    }
    kineticTS.sort(ascending)
    jamTS.sort(ascending)
    assignTS.sort(ascending)
    liveEndTS.sort(ascending)

    const byEffect = [...evs].sort((x, y) => x.tEffectS - y.tEffectS)
    const effectTS: number[] = []
    const killPrefix: number[] = []
    const softPrefix: number[] = []
    let killSum = 0
    let softSum = 0
    for (const ev of byEffect) {
      killSum += ev.killDelta
      if (ev.softShot) softSum += ev.killDelta
      effectTS.push(ev.tEffectS)
      killPrefix.push(killSum)
      softPrefix.push(softSum)
    }

    // Ghost cutoff: the first effect that drops expected residual below the
    // engine's own expected-dead threshold. killDelta never goes negative, so
    // residual only falls and the latch is one-way by construction.
    let eliminatedAtS: number | null = null
    if (shipCount > 0) {
      for (let i = 0; i < byEffect.length; i++) {
        if (Math.max(0, shipCount - killPrefix[i]) / shipCount < SHIP_DEAD_BELOW) {
          eliminatedAtS = effectTS[i]
          break
        }
      }
    }
    let eliminatedBySoft = false
    if (eliminatedAtS != null) {
      const n = countAtMost(effectTS, eliminatedAtS)
      const soft = prefixAt(softPrefix, n)
      eliminatedBySoft = soft > prefixAt(killPrefix, n) - soft
    }

    // Engine rule (attrition applyEffect): a 'continue' jam compounds per ship
    // as jammed += (1 - jammed) * pk, then averages over the formation exactly
    // the way ThreatAttrition.continueJamProb does.
    const jammed = new Array<number>(Math.max(1, shipCount)).fill(0)
    const jamEffectTS: number[] = []
    const jammedPrefix: number[] = []
    let jamSum = 0
    for (const ev of byEffect) {
      if (ev.channel !== 'jam') continue
      const i = Math.min(Math.max(ev.shipIdx, 0), jammed.length - 1)
      const before = jammed[i]
      jammed[i] = before + (1 - before) * ev.pk
      jamSum += jammed[i] - before
      jamEffectTS.push(ev.tEffectS)
      jammedPrefix.push(shipCount > 0 ? jamSum / shipCount : 0)
    }

    const cls = a.classificationAtS
    const ladder: Array<{ t: number; rung: ThreatClassification }> = []
    if (cls.unknownAtS != null) ladder.push({ t: cls.unknownAtS, rung: 'unknown' })
    if (cls.suspectedAtS != null) ladder.push({ t: cls.suspectedAtS, rung: 'suspected' })
    if (cls.hostileAtS != null) ladder.push({ t: cls.hostileAtS, rung: 'hostile' })
    ladder.sort((x, y) => x.t - y.t)
    const rungTS: number[] = []
    const rungs: ThreatClassification[] = []
    let reached: ThreatClassification = 'pending'
    for (const step of ladder) {
      if (RUNG_RANK[step.rung] > RUNG_RANK[reached]) reached = step.rung
      rungTS.push(step.t)
      rungs.push(reached)
    }

    const holds: HoldSeries[] = (a.sensorObservations ?? []).map((obs) => {
      const intervals = [...obs.intervals].sort((x, y) => x[0] - y[0])
      return { sensorId: obs.sensorId, intervals, starts: intervals.map((iv) => iv[0]) }
    })

    tracks.push({
      uasId: a.uasId,
      shipCount,
      holds,
      firstDetectS: a.firstDetectS,
      rungTS,
      rungs,
      windowS: a.status === 'engageable' ? a.windowS : null,
      arrivalS: a.arrivalS,
      kineticTS,
      jamTS,
      assignTS,
      liveEndTS,
      effectTS,
      killPrefix,
      jamEffectTS,
      jammedPrefix,
      eliminatedAtS,
      eliminatedBySoft,
    })
  }

  const effectorById = new Map<string, Entity>()
  const modeById = new Map<string, EffectorEngagementMode>()
  for (const e of scenario.entities) {
    if (e.kind !== 'effector') continue
    effectorById.set(e.id, e)
    const spec = scenario.library.find((m) => m.id === e.specId)?.effector
    modeById.set(e.id, effectorEngagementMode(e.specId, spec?.effectorType))
  }

  // Target geometry is fixed once the effect time is known, so each salvo's
  // endpoint resolves here and no path sampling runs per frame.
  const membersByThreat = new Map<string, (t: number) => Vec2[]>()
  const membersAt = (uasId: string, t: number): Vec2[] => {
    let sampler = membersByThreat.get(uasId)
    if (!sampler) {
      const uas = scenario.entities.find((e) => e.id === uasId)
      const path = scenario.paths.find((p) => p.entityId === uasId)
      const cache = new Map<number, Vec2[]>()
      sampler = (at: number) => {
        let members = cache.get(at)
        if (!members) {
          if (!path || path.points.length < 2) {
            members = [uas?.pos ?? { x: 0, y: 0 }]
          } else {
            const sample = posAtTime(
              path.points,
              speedFor(scenario, path),
              effectivePathDelayS(scenario, path),
              at,
            )
            members = uas ? memberPositions(uas, sample.pos, sample.headingDeg) : [sample.pos]
          }
          cache.set(at, members)
        }
        return members
      }
      membersByThreat.set(uasId, sampler)
    }
    return sampler(t)
  }

  const shots: ShotRecord[] = []
  let maxSpanS = 0
  for (const ev of report.events) {
    const members = membersAt(ev.uasId, ev.tEffectS)
    const to = members[Math.min(Math.max(ev.shipIdx, 0), members.length - 1)]
    const from = effectorById.get(ev.effectorId)?.pos ?? { x: 0, y: 0 }
    const liveEndS = drawEndS(ev)
    if (liveEndS - ev.tS > maxSpanS) maxSpanS = liveEndS - ev.tS
    shots.push({
      effectorId: ev.effectorId,
      uasId: ev.uasId,
      shipIdx: ev.shipIdx,
      tS: ev.tS,
      tEffectS: ev.tEffectS,
      liveEndS,
      channel: ev.channel,
      softShot: ev.softShot,
      pk: ev.pk,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      mode: modeById.get(ev.effectorId) ?? 'semi-active',
    })
  }
  shots.sort((x, y) => x.tS - y.tS)

  return { tracks, shots, shotTS: shots.map((s) => s.tS), maxSpanS }
}

/** Track state for every threat with a flight path, keyed by uasId. */
export function trackStatesAt(tl: TrackTimeline, tS: number): Map<string, TrackFileState> {
  const out = new Map<string, TrackFileState>()
  for (const tr of tl.tracks) {
    const holdingSensorIds: string[] = []
    for (const series of tr.holds) {
      if (heldIn(series, tS)) holdingSensorIds.push(series.sensorId)
    }
    const heldNow = holdingSensorIds.length > 0
    const detected = heldNow || (tr.firstDetectS != null && tr.firstDetectS <= tS)
    const rungN = countAtMost(tr.rungTS, tS)
    const classification = rungN > 0 ? tr.rungs[rungN - 1] : 'pending'
    const targetedNow = tr.windowS != null && tS >= tr.windowS[0] && tS <= tr.windowS[1]

    const kineticSalvos = countAtMost(tr.kineticTS, tS)
    const jamSalvos = countAtMost(tr.jamTS, tS)
    const incomingSalvos = countAtMost(tr.assignTS, tS) - countAtMost(tr.liveEndTS, tS)
    const effectsLanded = countAtMost(tr.effectTS, tS)
    const expectedKills = prefixAt(tr.killPrefix, effectsLanded)
    const residual = Math.max(0, tr.shipCount - expectedKills)
    const residualFraction = tr.shipCount > 0 ? residual / tr.shipCount : 0
    const jammedFraction = prefixAt(tr.jammedPrefix, countAtMost(tr.jamEffectTS, tS))
    const eliminated = tr.eliminatedAtS != null && tS >= tr.eliminatedAtS

    let phase: TrackPhase = 'undetected'
    if (eliminated) phase = 'ghost'
    else if (incomingSalvos > 0) phase = 'engaged'
    else if (targetedNow) phase = 'targeted'
    else if (classification === 'hostile') phase = 'identified'
    else if (heldNow) phase = 'tracked'
    else if (detected) phase = 'searching'

    out.set(tr.uasId, {
      uasId: tr.uasId,
      phase,
      detected,
      heldNow,
      holdingSensorIds,
      classification,
      targetedNow,
      incomingSalvos,
      salvosAssigned: kineticSalvos + jamSalvos,
      kineticSalvos,
      jamSalvos,
      effectsLanded,
      expectedKills,
      shipCount: tr.shipCount,
      residual,
      residualFraction,
      jammedFraction,
      eliminated,
      eliminatedAtS: eliminated ? tr.eliminatedAtS : null,
      eliminatedBySoft: eliminated && tr.eliminatedBySoft,
      arrivalS: tr.arrivalS,
      arrived: tr.arrivalS != null && tS >= tr.arrivalS,
    })
  }
  return out
}

/**
 * Salvos whose draw window contains t. Every live salvo was assigned within
 * maxSpanS of t, so the scan touches one bounded slice of the sorted ledger.
 */
function liveShots(tl: TrackTimeline, tS: number): ShotRecord[] {
  const hi = countAtMost(tl.shotTS, tS)
  const lo = lowerBound(tl.shotTS, tS - tl.maxSpanS)
  const out: ShotRecord[] = []
  for (let i = lo; i < hi; i++) {
    if (tS < tl.shots[i].liveEndS) out.push(tl.shots[i])
  }
  return out
}

/** Salvos currently drawn. Zero-flight-time salvos stay for BEAM_DISPLAY_S. */
export function shotsInFlightAt(tl: TrackTimeline, tS: number): ShotInFlight[] {
  return liveShots(tl, tS).map((s) => ({
    effectorId: s.effectorId,
    uasId: s.uasId,
    shipIdx: s.shipIdx,
    tS: s.tS,
    tEffectS: s.tEffectS,
    progress:
      s.tEffectS > s.tS ? Math.min(1, Math.max(0, (tS - s.tS) / (s.tEffectS - s.tS))) : 1,
    channel: s.channel,
    softShot: s.softShot,
    pk: s.pk,
    from: s.from,
    to: s.to,
    mode: s.mode,
  }))
}

/** Effector glyph treatment at t, keyed by effector id. Absent means idle. */
export function effectorStatesAt(tl: TrackTimeline, tS: number): Map<string, EffectorLiveState> {
  const out = new Map<string, EffectorLiveState>()
  for (const s of liveShots(tl, tS)) {
    if (!out.has(s.effectorId)) out.set(s.effectorId, s.mode)
  }
  return out
}

/** True on the lit half of the pulse. Derived from sim time, never a timer. */
export function blinkOn(tS: number): boolean {
  const phase = ((tS % BLINK_PERIOD_S) + BLINK_PERIOD_S) % BLINK_PERIOD_S
  return phase < BLINK_PERIOD_S / 2
}

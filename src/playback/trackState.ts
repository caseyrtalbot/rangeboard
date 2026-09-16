import type { EffectorSpec, Entity, Scenario, Vec2 } from '../model/types'
import type { ThreatAssessment, ThreatClassification } from './sim'
import type { AttritionReport, EngagementEvent } from './attritionReport'
import { intervalIndexAt } from './intercept'
import { SHIP_DEAD_BELOW } from './pk'
import { DANGER_INK } from '../ui/ink'
import { memberPositions, sampleFlightPath } from './tracks'
import { profileFor } from '../model/integration'
import { engineKeyOf } from '../model/scenario'
import { engagementIsKinetic, engagementReleaseS } from './engagementTiming'

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
 * Time semantics match the ledger: assignment is tS, physical release is
 * tReleaseS, and effect is tEffectS. Expenditure counts at assignment; kill
 * mass and jam mass count at effect. Unknown legacy release never draws flight.
 */

/** Display-only hold for a beam or dwell with no modeled duration. */
export const BEAM_DISPLAY_S = 0.6

/** Pulse period, seconds. */
export const BLINK_PERIOD_S = 0.5

/**
 * Hold tolerance, seconds. The sweep samples every 0.5 s, so a query between
 * two samples still counts as held (same rule as heldAt in
 * src/analysis/threatAggregation.ts).
 */
const HOLD_TOLERANCE_S = 0.25

/** 'Continue' jam probability at which a track reads JAMMED between dwells. */
const JAMMED_AT = 0.5

/**
 * The one EW color: the jam beam, the jammed diamond, and the J badge all
 * read as the same channel. Cyan on purpose: no kill-chain rung in
 * PHASE_STYLE uses the hue, so a jammed track never reads as another rung.
 * 7.9:1 against the board background.
 */
export const EW_JAM_COLOR = '#5ad1e0'

/**
 * Track lifecycle, highest precedence first:
 * ghost > engaged > targeted > identified > tracked > searching > undetected.
 * ENGAGED latches: see TrackFileState.firstSalvoAtS.
 */
export type TrackPhase =
  'undetected' | 'searching' | 'tracked' | 'identified' | 'targeted' | 'engaged' | 'ghost'

/**
 * Canonical phase presentation. One table, so the canvas ring and the
 * telemetry pill can never drift apart. `color` is null for 'undetected',
 * which takes the entity color and draws no ring. Contrast is measured
 * against the board background (--bg #16181a); every value clears the 3:1
 * graphic floor there and on the two darker basemaps.
 *   searching  #82887e  dim grey,   4.89:1. Held once, not held now.
 *   tracked    #d9a441  amber,      7.91:1. A sensor holds it.
 *   identified #c4564a  brick red,  4.05:1. DANGER_INK, so the ring
 *              matches every other hostile mark on the board.
 *   targeted   #bb6499  plum,       4.57:1. The one free hue on this palette,
 *              so a weapon-assigned track reads as neither amber nor red.
 *   engaged    #f2795e  hot coral,  6.50:1. Same family as HOSTILE and 1.6x
 *              brighter, because rounds are in the air. It pulses as well.
 *   ghost      #6a7178  dim steel,  3.60:1. Defeated, and deliberately quiet.
 * HOSTILE and ENGAGED separate by value, TARGETED separates from both by hue,
 * so no pair depends on one channel alone.
 */
export const PHASE_STYLE = {
  undetected: { label: 'UNDETECTED', color: null },
  searching: { label: 'SEARCHING', color: '#82887e' },
  tracked: { label: 'TRACKED', color: '#d9a441' },
  identified: { label: 'HOSTILE', color: DANGER_INK },
  targeted: { label: 'TARGETED', color: '#bb6499' },
  engaged: { label: 'ENGAGED', color: '#f2795e' },
  ghost: { label: 'DEFEATED', color: '#6a7178' },
} as const satisfies Record<TrackPhase, { label: string; color: string | null }>

export interface TrackFileState {
  uasId: string
  phase: TrackPhase
  /** Any sensor has held it at or before t. */
  detected: boolean
  /** A sensor holds it at t. */
  heldNow: boolean
  holdingSensorIds: string[]
  /** Held at t, and every holding sensor is coasting: extrapolation after a missed scan, no measurement. */
  coasting: boolean
  /** Ladder rung reached by t. */
  classification: ThreatClassification
  /** Inside a usable ROE-gated effector window at t. */
  targetedNow: boolean
  /** Salvos assigned whose effect has not landed at t. */
  incomingSalvos: number
  /**
   * Assignment time of the first salvo against this track, null while none has
   * been assigned. The ENGAGED latch: a beam is incoming for only
   * BEAM_DISPLAY_S, so a phase driven by incomingSalvos would flicker.
   */
  firstSalvoAtS: number | null
  /** Salvos assigned at or before t, every expenditure channel summed. */
  salvosAssigned: number
  /** Kinetic rounds (interceptor, gun, net) assigned at or before t. */
  kineticSalvos: number
  /** Directed-energy bursts (DE, HPM) assigned at or before t. */
  deSalvos: number
  /** EW dwells (jammer) assigned at or before t. */
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
  /**
   * Effective jamming holds on this track at t: an EW dwell is live now, or
   * the compounded 'continue' jam probability is at or above JAMMED_AT. Only
   * dwells the engine actually fired count, and the engine only fires when
   * the jam physics close (bands, alignment, power; src/analysis/ewPhysics.ts),
   * so this flag is what the board's jammed symbology keys on.
   */
  jammedNow: boolean
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
  /** Physical release; resolved from explicit metadata or the captured scenario. */
  tReleaseS: number
  tEffectS: number
  /** Kinetic: 0 at release, approaching 1 at effect. Beams always use 1. */
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
type EffectorEngagementMode = 'semi-active' | 'active' | 'beam'

/**
 * Effector glyph treatment at t. 'idle' draws the outline frame only.
 * 'preparing' marks assignment before release; unknown legacy release uses
 * 'timing-unavailable' and never implies that a round has launched.
 * 'depleted' means the magazine is spent; a live salvo outranks it, so the
 * guidance treatment still plays out on the last round in flight.
 */
export type EffectorLiveState =
  'idle' | 'preparing' | 'timing-unavailable' | 'semi-active' | 'active' | 'beam' | 'depleted'

/** Researched guidance value to draw treatment. */
const GUIDANCE_MODE: Record<'fc-uplink' | 'c2-cue' | 'self' | 'operator', EffectorEngagementMode> =
  {
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
 * Draw treatment from the integration profile's guidance (GUIDANCE_MODE), else
 * by effector type (TYPE_MODE). Beam types always win. With neither a profile
 * nor a spec: semi-active, the calmest treatment.
 */
export function effectorEngagementMode(
  specId: string | null,
  effectorType: EffectorSpec['effectorType'] | undefined,
): EffectorEngagementMode {
  if (effectorType && TYPE_MODE[effectorType] === 'beam') return 'beam'
  const guidance = profileFor(specId)?.guidance
  if (guidance) return GUIDANCE_MODE[guidance]
  return effectorType ? TYPE_MODE[effectorType] : 'semi-active'
}

/** Ascending, disjoint inclusive intervals with their start times, for the binary search. */
interface IntervalSeries {
  intervals: Array<[number, number]>
  /** Parallel to intervals: interval start times. */
  starts: number[]
}

/** One sensor's hold history against one track, ascending. */
interface HoldSeries extends IntervalSeries {
  sensorId: string
  /** Spans inside intervals the sensor held by extrapolation after a missed scan. */
  coast: IntervalSeries
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
  /**
   * Salvo assignment times ascending, split by EngagementEvent.channelClass:
   * kinetic rounds, directed-energy bursts, and EW dwells are three different
   * expenditures, so a directed-energy effector never inflates a round count.
   */
  kineticTS: number[]
  deTS: number[]
  jamTS: number[]
  assignTS: number[]
  /** End of pending/display window; only zero-duration beams extend past effect. */
  liveEndTS: number[]
  /** EW dwell draw windows ascending (both jam and soft-kill channel). */
  ewLiveStartTS: number[]
  ewLiveEndTS: number[]
  /** Effect times ascending with the running expected-kill mass. */
  effectTS: number[]
  killPrefix: number[]
  /**
   * Step function of the mean formation 'continue' jam probability:
   * jamStepVal[i] holds from jamStepTS[i] until the next step. Steps rise at
   * dwell effects and drop when a hold's illumination interval ends, matching
   * the engine's JamHold rule, so the JAMMED cue releases the moment the
   * track leaves a fixed jam cone.
   */
  jamStepTS: number[]
  jamStepVal: number[]
  eliminatedAtS: number | null
  eliminatedBySoft: boolean
}

/** One ledger salvo with its geometry and draw window resolved at build time. */
interface ShotRecord {
  effectorId: string
  uasId: string
  shipIdx: number
  tS: number
  /** Null when legacy launch timing cannot be reconstructed. */
  tReleaseS: number | null
  tEffectS: number
  /** Effect time, with a display-only hold for zero-duration beam/dwell events. */
  liveEndS: number
  channel: 'kill' | 'jam'
  softShot: boolean
  pk: number
  from: Vec2
  to: Vec2
  mode: EffectorEngagementMode
}

/**
 * One effector's magazine history. Rounds count at assignment, exactly the way
 * the engine spends them and the way systemTelemetry reads capacity, so the
 * board and the side panel call the same weapon empty at the same instant.
 */
interface EffectorSeries {
  effectorId: string
  /** Assignment times ascending. */
  assignTS: number[]
  /** Rounds carried. null means unlimited (jammer, DE, HPM): never depleted. */
  magazineSize: number | null
}

/** Built once per (scenario, assessments, report). Opaque to callers. */
export interface TrackTimeline {
  tracks: TrackSeries[]
  /** Magazine history per effector entity, for the depleted glyph cue. */
  effectors: EffectorSeries[]
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
function heldIn(series: IntervalSeries, tS: number): boolean {
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

/** Kinetic zero-flight intervals have no travel; only beams get a display hold. */
function drawEndS(ev: EngagementEvent, releaseS: number | null): number {
  return !engagementIsKinetic(ev) && releaseS != null && ev.tEffectS === releaseS
    ? releaseS + BEAM_DISPLAY_S
    : ev.tEffectS
}

interface TimelineEntry {
  scenario: Scenario
  report: AttritionReport
  timeline: TrackTimeline
}

const timelineCache = new WeakMap<ThreatAssessment[], TimelineEntry>()

/**
 * `buildTrackTimeline`, cached by the picture it derives from. The key is the
 * assessments array of `engagementPicture(scenario)`, one per engine identity
 * (`engineKeyOf`), so the timeline lives exactly as long as its picture and
 * the bounded picture cache bounds the timelines too; a key on the scenario
 * would pin every evicted picture through the undo history. The entry checks
 * the scenario and report identities so a fresh picture never reads a stale
 * timeline. Never pass a spread or cloned scenario.
 */
export function trackTimelineOf(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
): TrackTimeline {
  const key = engineKeyOf(scenario)
  const hit = timelineCache.get(assessments)
  if (hit && hit.scenario === key && hit.report === report) return hit.timeline
  const timeline = buildTrackTimeline(key, assessments, report)
  timelineCache.set(assessments, { scenario: key, report, timeline })
  return timeline
}

/** Shot-only trial timeline: reuse physical timing without preparing forecast ghosts. */
export function trialShotTimelineOf(scenario: Scenario, report: AttritionReport): TrackTimeline {
  const hit = trialShotCache.get(report)
  if (hit?.scenario === scenario) return hit.timeline
  const timeline = buildTrackTimeline(scenario, [], report)
  trialShotCache.set(report, { scenario, timeline })
  return timeline
}

const trialShotCache = new WeakMap<
  AttritionReport,
  { scenario: Scenario; timeline: TrackTimeline }
>()

/** Prefix-aggregate the whole-run forecast. Pure; `trackTimelineOf` is the cached entry. */
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
    const deTS: number[] = []
    const jamTS: number[] = []
    const assignTS: number[] = []
    const liveEndTS: number[] = []
    const ewLiveStartTS: number[] = []
    const ewLiveEndTS: number[] = []
    for (const ev of evs) {
      assignTS.push(ev.tS)
      const releaseS = engagementReleaseS(ev, scenario)
      if (ev.channelClass === 'ew') {
        jamTS.push(ev.tS)
        if (releaseS != null) {
          ewLiveStartTS.push(releaseS)
          ewLiveEndTS.push(drawEndS(ev, releaseS))
        }
      } else if (ev.channelClass === 'directed-energy') deTS.push(ev.tS)
      else kineticTS.push(ev.tS)
      liveEndTS.push(drawEndS(ev, releaseS))
    }
    kineticTS.sort(ascending)
    deTS.sort(ascending)
    jamTS.sort(ascending)
    assignTS.sort(ascending)
    liveEndTS.sort(ascending)
    ewLiveStartTS.sort(ascending)
    ewLiveEndTS.sort(ascending)

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

    // Ghost cutoff: the first effect that drops residual below SHIP_DEAD_BELOW.
    // killDelta is never negative, so the latch is one-way.
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

    // Engine rule (JamHold): per (ship, jammer) the dwells compound inside one
    // in-range interval and the hold drops to zero at its end; independent
    // jammers combine as 1 - product of misses. No interval data (a hand-built
    // ledger) means the hold never lapses, like the engine's intervalIdx -1.
    const nShips = Math.max(1, shipCount)
    const windowsByEffector = new Map(a.effectorWindows.map((w) => [w.effectorId, w.intervals]))
    const jamGroups = new Map<string, EngagementEvent[]>()
    for (const ev of byEffect) {
      if (ev.channel !== 'jam') continue
      const ship = Math.min(Math.max(ev.shipIdx, 0), nShips - 1)
      const key = `${ship}|${ev.effectorId}`
      const list = jamGroups.get(key)
      if (list) list.push(ev)
      else jamGroups.set(key, [ev])
    }
    const jamBreaks: Array<{ t: number; ship: number; key: string; value: number }> = []
    for (const [key, evs] of jamGroups) {
      const ship = Number(key.slice(0, key.indexOf('|')))
      const intervals = windowsByEffector.get(evs[0].effectorId)
      let value = 0
      let curIdx = Number.NaN // never equals anything, so the first dwell inits
      let curEndS: number | null = null
      for (const ev of evs) {
        const idx = intervalIndexAt(intervals, ev.tEffectS)
        if (idx !== curIdx) {
          if (curEndS != null && value > 0) jamBreaks.push({ t: curEndS, ship, key, value: 0 })
          value = 0
          curIdx = idx
          curEndS = idx >= 0 && intervals ? intervals[idx][1] : null
        }
        value += (1 - value) * ev.pk
        jamBreaks.push({ t: ev.tEffectS, ship, key, value })
      }
      if (curEndS != null && value > 0) jamBreaks.push({ t: curEndS, ship, key, value: 0 })
    }
    jamBreaks.sort((x, y) => x.t - y.t)
    const holdsByShip: Array<Map<string, number>> = Array.from({ length: nShips }, () => new Map())
    const jamStepTS: number[] = []
    const jamStepVal: number[] = []
    for (let i = 0; i < jamBreaks.length; i++) {
      const b = jamBreaks[i]
      holdsByShip[b.ship].set(b.key, b.value)
      // Fold every same-instant break in before emitting one step.
      if (i + 1 < jamBreaks.length && jamBreaks[i + 1].t <= b.t + 1e-9) continue
      let jamSum = 0
      for (const holds of holdsByShip) {
        let unjammed = 1
        for (const v of holds.values()) unjammed *= 1 - v
        jamSum += 1 - unjammed
      }
      jamStepTS.push(b.t)
      jamStepVal.push(shipCount > 0 ? jamSum / shipCount : 0)
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
      const coast = [...(obs.coastIntervals ?? [])].sort((x, y) => x[0] - y[0])
      return {
        sensorId: obs.sensorId,
        intervals,
        starts: intervals.map((iv) => iv[0]),
        coast: { intervals: coast, starts: coast.map((iv) => iv[0]) },
      }
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
      deTS,
      jamTS,
      assignTS,
      liveEndTS,
      ewLiveStartTS,
      ewLiveEndTS,
      effectTS,
      killPrefix,
      jamStepTS,
      jamStepVal,
      eliminatedAtS,
      eliminatedBySoft,
    })
  }

  const effectorById = new Map<string, Entity>()
  const modeById = new Map<string, EffectorEngagementMode>()
  const effectors: EffectorSeries[] = []
  for (const e of scenario.entities) {
    if (e.kind !== 'effector') continue
    effectorById.set(e.id, e)
    const spec = scenario.library.find((m) => m.id === e.specId)?.effector
    modeById.set(e.id, effectorEngagementMode(e.specId, spec?.effectorType))
    effectors.push({
      effectorId: e.id,
      assignTS: report.events
        .filter((ev) => ev.effectorId === e.id)
        .map((ev) => ev.tS)
        .sort(ascending),
      magazineSize: spec?.magazineSize ?? null,
    })
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
            const sample = sampleFlightPath(scenario, path, at)
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
    const tReleaseS = engagementReleaseS(ev, scenario)
    const liveEndS = drawEndS(ev, tReleaseS)
    if (liveEndS - ev.tS > maxSpanS) maxSpanS = liveEndS - ev.tS
    shots.push({
      effectorId: ev.effectorId,
      uasId: ev.uasId,
      shipIdx: ev.shipIdx,
      tS: ev.tS,
      tReleaseS,
      tEffectS: ev.tEffectS,
      liveEndS,
      channel: ev.channel,
      softShot: ev.softShot,
      pk: ev.pk,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      mode: !engagementIsKinetic(ev)
        ? 'beam'
        : (modeById.get(ev.effectorId) ?? effectorEngagementMode(null, ev.effectorType)),
    })
  }
  shots.sort((x, y) => x.tS - y.tS)

  return { tracks, effectors, shots, shotTS: shots.map((s) => s.tS), maxSpanS }
}

/** Track state for every threat with a flight path, keyed by uasId. */
export function trackStatesAt(tl: TrackTimeline, tS: number): Map<string, TrackFileState> {
  const out = new Map<string, TrackFileState>()
  for (const tr of tl.tracks) {
    const holdingSensorIds: string[] = []
    let coasting = false
    for (const series of tr.holds) {
      if (!heldIn(series, tS)) continue
      holdingSensorIds.push(series.sensorId)
      const inCoast = heldIn(series.coast, tS)
      // One sensor with a live measurement makes the track measured, not coasting.
      coasting = holdingSensorIds.length === 1 ? inCoast : coasting && inCoast
    }
    const heldNow = holdingSensorIds.length > 0
    const detected = heldNow || (tr.firstDetectS != null && tr.firstDetectS <= tS)
    const rungN = countAtMost(tr.rungTS, tS)
    const classification = rungN > 0 ? tr.rungs[rungN - 1] : 'pending'
    const targetedNow = tr.windowS != null && tS >= tr.windowS[0] && tS <= tr.windowS[1]

    const kineticSalvos = countAtMost(tr.kineticTS, tS)
    const deSalvos = countAtMost(tr.deTS, tS)
    const jamSalvos = countAtMost(tr.jamTS, tS)
    const incomingSalvos = countAtMost(tr.assignTS, tS) - countAtMost(tr.liveEndTS, tS)
    const effectsLanded = countAtMost(tr.effectTS, tS)
    const expectedKills = prefixAt(tr.killPrefix, effectsLanded)
    const residual = Math.max(0, tr.shipCount - expectedKills)
    const residualFraction = tr.shipCount > 0 ? residual / tr.shipCount : 0
    const jammedFraction = prefixAt(tr.jamStepVal, countAtMost(tr.jamStepTS, tS))
    const eliminated = tr.eliminatedAtS != null && tS >= tr.eliminatedAtS
    // Each dwell start pairs with one dwell end, so starts-so-far minus
    // ends-so-far counts the dwells live at t even when dwells overlap.
    const ewDwellLive = countAtMost(tr.ewLiveStartTS, tS) - countAtMost(tr.ewLiveEndTS, tS) > 0
    const jammedNow = !eliminated && (ewDwellLive || jammedFraction >= JAMMED_AT)

    // Stays null until the first shot is taken: no field here may read ahead of t.
    const firstSalvoAtS = tr.assignTS.length > 0 && tS >= tr.assignTS[0] ? tr.assignTS[0] : null

    let phase: TrackPhase = 'undetected'
    if (eliminated) phase = 'ghost'
    else if (firstSalvoAtS != null) phase = 'engaged'
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
      coasting,
      classification,
      targetedNow,
      incomingSalvos,
      firstSalvoAtS,
      salvosAssigned: kineticSalvos + deSalvos + jamSalvos,
      kineticSalvos,
      deSalvos,
      jamSalvos,
      effectsLanded,
      expectedKills,
      shipCount: tr.shipCount,
      residual,
      residualFraction,
      jammedFraction,
      jammedNow,
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

/** Released salvos only. Kinetic zero-flight intervals never fabricate travel. */
export function shotsInFlightAt(tl: TrackTimeline, tS: number): ShotInFlight[] {
  return liveShots(tl, tS)
    .filter(
      (s): s is ShotRecord & { tReleaseS: number } => s.tReleaseS != null && tS >= s.tReleaseS,
    )
    .map((s) => ({
      effectorId: s.effectorId,
      uasId: s.uasId,
      shipIdx: s.shipIdx,
      tS: s.tS,
      tReleaseS: s.tReleaseS,
      tEffectS: s.tEffectS,
      progress:
        s.mode !== 'beam' && s.tEffectS > s.tReleaseS
          ? Math.min(1, Math.max(0, (tS - s.tReleaseS) / (s.tEffectS - s.tReleaseS)))
          : 1,
      channel: s.channel,
      softShot: s.softShot,
      pk: s.pk,
      from: s.from,
      to: s.to,
      mode: s.mode,
    }))
}

/**
 * Effector glyph treatment at t, keyed by effector id. Absent means idle.
 * A drawn salvo wins, so the guidance treatment always plays out; a weapon
 * with nothing left to fire then reads 'depleted' for the rest of the run.
 */
export function effectorStatesAt(tl: TrackTimeline, tS: number): Map<string, EffectorLiveState> {
  const out = new Map<string, EffectorLiveState>()
  for (const s of liveShots(tl, tS)) {
    const state =
      s.tReleaseS == null ? 'timing-unavailable' : tS < s.tReleaseS ? 'preparing' : s.mode
    const current = out.get(s.effectorId)
    // A released round keeps its guidance cue while the next round prepares.
    if (current == null || current === 'preparing' || current === 'timing-unavailable') {
      out.set(s.effectorId, state)
    }
  }
  for (const e of tl.effectors) {
    if (e.magazineSize == null || out.has(e.effectorId)) continue
    if (countAtMost(e.assignTS, tS) >= e.magazineSize) out.set(e.effectorId, 'depleted')
  }
  return out
}

/** True on the lit half of the pulse. Derived from sim time, never a timer. */
export function blinkOn(tS: number): boolean {
  const phase = ((tS % BLINK_PERIOD_S) + BLINK_PERIOD_S) % BLINK_PERIOD_S
  return phase < BLINK_PERIOD_S / 2
}

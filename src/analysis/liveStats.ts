import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport } from '../playback/attrition'

/**
 * Live prefix-aggregation over the engagement ledger. buildLiveTimeline sorts
 * the whole-run forecast (events, detections, arrivals) once per scenario;
 * liveKpisAt then answers "what has happened by sim time t" with binary
 * searches, cheap enough for the playback frame rate. Pure TS, no DOM, no
 * store imports.
 *
 * Time semantics match the engine ledger: expenditure (shots, jam salvos)
 * counts at assignment time tS; kills count at effect time tEffectS; a threat
 * is detected at its firstDetectS and arrived at its arrivalS. All bounds are
 * inclusive (an event at exactly t has happened by t).
 *
 * Leakers stay consistent with kills at every instant: an arrived threat
 * contributes its ship count minus the kill mass landed on it by t, so a kill
 * effect after arrival moves mass from Leakers to Exp kills at the effect
 * time, and both converge to the run-final totals.
 */

/** One arrived threat's contribution to the live leaker count. */
interface ArrivalTrack {
  /** Ships in the formation (1 when no attrition row exists). */
  shipCount: number
  /** This threat's kill-effect times ascending, with killPrefix[i] = kill mass through effect i. */
  effectTS: number[]
  killPrefix: number[]
}

export interface LiveTimeline {
  /** Kinetic salvo assignment times, ascending. */
  kineticTS: number[]
  /** Jammer salvo assignment times (every jam behavior), ascending. */
  jamTS: number[]
  /** Effect times ascending; effectKillPrefix[i] = expected-kill mass removed through effect i. */
  effectTS: number[]
  effectKillPrefix: number[]
  /** First-detection times over threats with paths, ascending. */
  detectTS: number[]
  /** Arrival times ascending; arrivalTracks[i] is the threat arriving at arrivalTS[i]. */
  arrivalTS: number[]
  arrivalTracks: ArrivalTrack[]
  /** Threat tracks in play (assessments with a flight path). */
  trackCount: number
  /** Total ships across those tracks. */
  raidSize: number
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

/** Prefix value for the first n entries; 0 when n is 0. */
function prefixAt(prefix: number[], n: number): number {
  return n > 0 ? prefix[n - 1] : 0
}

export function buildLiveTimeline(
  assessments: ThreatAssessment[],
  report: AttritionReport,
): LiveTimeline {
  const kineticTS: number[] = []
  const jamTS: number[] = []
  for (const ev of report.events) {
    if (ev.softShot) jamTS.push(ev.tS)
    else kineticTS.push(ev.tS)
  }
  // events arrive in assignment-time order; per-channel subsequences stay sorted.

  const effects = report.events
    .map((ev) => ({ t: ev.tEffectS, kill: ev.killDelta, uasId: ev.uasId }))
    .sort((a, b) => a.t - b.t)
  const effectTS = effects.map((e) => e.t)
  const effectKillPrefix: number[] = []
  let killSum = 0
  for (const e of effects) {
    killSum += e.kill
    effectKillPrefix.push(killSum)
  }

  // Per-threat kill-effect timelines (already in tEffect order from the
  // global sort above), for the live per-arrival leaker math.
  const perThreat = new Map<string, ArrivalTrack>()
  for (const e of effects) {
    let tr = perThreat.get(e.uasId)
    if (!tr) {
      tr = { shipCount: 1, effectTS: [], killPrefix: [] }
      perThreat.set(e.uasId, tr)
    }
    tr.effectTS.push(e.t)
    tr.killPrefix.push((tr.killPrefix[tr.killPrefix.length - 1] ?? 0) + e.kill)
  }

  const detectTS: number[] = []
  const arrivals: Array<{ t: number; track: ArrivalTrack }> = []
  let trackCount = 0
  for (const a of assessments) {
    if (a.status === 'no-path') continue
    trackCount++
    if (a.firstDetectS != null) detectTS.push(a.firstDetectS)
    if (a.arrivalS != null) {
      const att = report.threats.find((x) => x.uasId === a.uasId)
      const track = perThreat.get(a.uasId) ?? { shipCount: 1, effectTS: [], killPrefix: [] }
      // No attrition row means no shots resolved: every ship arrives.
      track.shipCount = att ? att.shipCount : 1
      arrivals.push({ t: a.arrivalS, track })
    }
  }
  detectTS.sort((a, b) => a - b)
  arrivals.sort((a, b) => a.t - b.t)

  return {
    kineticTS,
    jamTS,
    effectTS,
    effectKillPrefix,
    detectTS,
    arrivalTS: arrivals.map((x) => x.t),
    arrivalTracks: arrivals.map((x) => x.track),
    trackCount,
    raidSize: report.totals.raidSize,
  }
}

export interface LiveKpis {
  /** Threat tracks first detected by t. */
  detected: number
  /** Kinetic salvos assigned by t. */
  kineticShots: number
  /** Jam salvos assigned by t. */
  jamSalvos: number
  /** Expected-kill mass applied by t (effects landed). */
  expectedKills: number
  /** Threat tracks past arrival at the defended asset by t. */
  arrivedTracks: number
  /**
   * Surviving expected ships among those arrived tracks: per arrived threat,
   * shipCount minus the kill mass landed on it by t. Complementary with
   * expectedKills at every t and converges to the run-final leaker total.
   */
  leakerShips: number
}

export function liveKpisAt(tl: LiveTimeline, tS: number): LiveKpis {
  const arrivedTracks = countAtMost(tl.arrivalTS, tS)
  let leakerShips = 0
  for (let i = 0; i < arrivedTracks; i++) {
    const tr = tl.arrivalTracks[i]
    leakerShips += tr.shipCount - prefixAt(tr.killPrefix, countAtMost(tr.effectTS, tS))
  }
  return {
    detected: countAtMost(tl.detectTS, tS),
    kineticShots: countAtMost(tl.kineticTS, tS),
    jamSalvos: countAtMost(tl.jamTS, tS),
    expectedKills: prefixAt(tl.effectKillPrefix, countAtMost(tl.effectTS, tS)),
    arrivedTracks,
    leakerShips,
  }
}

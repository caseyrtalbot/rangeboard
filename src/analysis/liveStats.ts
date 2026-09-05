import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport } from '../playback/attritionReport'
import { expectedDeadTimes } from './threatAggregation'

/**
 * Live prefix-aggregation over the engagement ledger. buildLiveTimeline sorts
 * the whole-run forecast (events, detections, arrivals) once per scenario;
 * liveKpisAt then answers "what has happened by sim time t" with binary
 * searches, cheap enough for the playback frame rate. Pure TS, no DOM, no
 * store imports.
 *
 * Time semantics match the engine ledger: expenditure (kinetic rounds,
 * directed-energy bursts, EW salvos) counts at assignment time tS; kill mass
 * counts at effect time tEffectS; a threat is detected at its firstDetectS
 * and arrives at its arrivalS. Arrival is the defended-boundary crossing from
 * sim.ts, not the closest approach. All bounds are inclusive: an event at
 * exactly t has happened by t.
 *
 * ARRIVAL RULE, the same rule attrition.ts applies to the run totals. A
 * defeat that lands after the threat was already over the defended asset did
 * not protect the asset. Only kill mass stamped lateEffect: false may reduce
 * leakerShips, and only that mass is reported as expectedKills. Post-arrival
 * mass is reported apart as lateKills, so the operator still sees the
 * intercept without it un-leaking a threat that already reached the asset.
 * One consequence is a useful property: an arrived threat's leaker mass is
 * frozen at its arrival time, because every non-late effect on it has landed
 * by then. The live leaker count only rises.
 *
 * Expenditure splits on EngagementEvent.channelClass, which says what the
 * salvo COST. softShot says how the salvo KILLS (the soft/jam channel) and is
 * not an expenditure channel: a DE or HPM burst is a hard kill that fires no
 * round, so it belongs in deSalvos and never in kineticShots.
 *
 * An expected-dead track is not a target. A threat whose expected residual
 * has fallen below the engine's SHIP_DEAD_BELOW cutoff leaves the targetable
 * count even while its ROE window is still open, which keeps this surface
 * consistent with trackState's ghost latch, systemTelemetry's targetsNow and
 * threatAggregation's targetableNow.
 */

/** One ROE-gated usable window, with the time its threat becomes expected dead. */
interface LiveTargetWindow {
  startS: number
  endS: number
  /** Expected-dead time from the ledger; null when the threat is never eliminated. */
  deadAtS: number | null
}

export interface LiveTimeline {
  /** Kinetic salvo assignment times (interceptor, gun, net), ascending. */
  kineticTS: number[]
  /** Directed-energy burst assignment times (DE, HPM), ascending. */
  deTS: number[]
  /** EW salvo assignment times (jammer, every jam behavior), ascending. */
  jamTS: number[]
  /**
   * Effect times ascending. effectKillPrefix[i] = PRE-ARRIVAL kill mass
   * through effect i; effectLateKillPrefix[i] = post-arrival kill mass
   * through effect i. The two prefixes share one time axis, so a single
   * binary search answers both.
   */
  effectTS: number[]
  effectKillPrefix: number[]
  effectLateKillPrefix: number[]
  /** First-detection times over threats with paths, ascending. */
  detectTS: number[]
  /** Hostile-classification times, ascending (the engine's identification proxy). */
  classifyTS: number[]
  /** First salvo assignment per engaged threat, ascending. */
  engageTS: number[]
  /** ROE-gated usable target windows, each carrying its threat's dead time. */
  targetWindows: LiveTargetWindow[]
  /**
   * Arrival times ascending. arrivalLeakerPrefix[i] = leaker ship mass over
   * the first i + 1 arrivals. A threat's leaker mass is its ship count minus
   * the kill mass that landed at or before its own arrival, so it is a
   * constant from arrival onward and prefix-sums cleanly.
   */
  arrivalTS: number[]
  arrivalLeakerPrefix: number[]
  /** Threat tracks in play (assessments with a flight path). */
  trackCount: number
  trackIds: string[]
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
  const deTS: number[] = []
  const jamTS: number[] = []
  for (const ev of report.events) {
    // Expenditure channel, not kill channel: softShot marks the soft-kill
    // (jam) channel and would file every DE and HPM burst as a round fired.
    if (ev.channelClass === 'ew') jamTS.push(ev.tS)
    else if (ev.channelClass === 'directed-energy') deTS.push(ev.tS)
    else kineticTS.push(ev.tS)
  }
  // events arrive in assignment-time order; per-channel subsequences stay sorted.

  const effects = report.events
    .map((ev) => ({
      t: ev.tEffectS,
      kill: ev.killDelta,
      late: ev.lateEffect,
      uasId: ev.uasId,
    }))
    .sort((a, b) => a.t - b.t)
  const effectTS = effects.map((e) => e.t)
  const effectKillPrefix: number[] = []
  const effectLateKillPrefix: number[] = []
  let killSum = 0
  let lateSum = 0
  for (const e of effects) {
    if (e.late) lateSum += e.kill
    else killSum += e.kill
    effectKillPrefix.push(killSum)
    effectLateKillPrefix.push(lateSum)
  }

  // Pre-arrival kill mass per threat: the only mass that defended the asset,
  // so the only mass allowed to reduce that threat's leaker contribution.
  const preArrivalKill = new Map<string, number>()
  for (const e of effects) {
    if (e.late) continue
    preArrivalKill.set(e.uasId, (preArrivalKill.get(e.uasId) ?? 0) + e.kill)
  }
  const deadAtS = expectedDeadTimes(report)

  const detectTS: number[] = []
  const classifyTS: number[] = []
  const targetWindows: LiveTargetWindow[] = []
  const trackIds: string[] = []
  const arrivals: Array<{ t: number; leakerShips: number }> = []
  let trackCount = 0
  for (const a of assessments) {
    if (a.status === 'no-path') continue
    trackCount++
    trackIds.push(a.uasId)
    if (a.firstDetectS != null) detectTS.push(a.firstDetectS)
    if (a.classificationAtS.hostileAtS != null) classifyTS.push(a.classificationAtS.hostileAtS)
    if (a.status === 'engageable' && a.windowS != null) {
      targetWindows.push({
        startS: a.windowS[0],
        endS: a.windowS[1],
        deadAtS: deadAtS.get(a.uasId) ?? null,
      })
    }
    if (a.arrivalS != null) {
      const att = report.threats.find((x) => x.uasId === a.uasId)
      // No attrition row means no shots resolved: every ship arrives.
      const shipCount = att ? att.shipCount : 1
      const leakerShips = Math.max(0, shipCount - (preArrivalKill.get(a.uasId) ?? 0))
      arrivals.push({ t: a.arrivalS, leakerShips })
    }
  }
  detectTS.sort((a, b) => a - b)
  classifyTS.sort((a, b) => a - b)
  arrivals.sort((a, b) => a.t - b.t)
  const arrivalLeakerPrefix: number[] = []
  let leakSum = 0
  for (const arrival of arrivals) {
    leakSum += arrival.leakerShips
    arrivalLeakerPrefix.push(leakSum)
  }
  const firstEngageByThreat = new Map<string, number>()
  for (const ev of report.events) {
    if (!firstEngageByThreat.has(ev.uasId)) firstEngageByThreat.set(ev.uasId, ev.tS)
  }
  const engageTS = [...firstEngageByThreat.values()].sort((a, b) => a - b)

  return {
    kineticTS,
    deTS,
    jamTS,
    effectTS,
    effectKillPrefix,
    effectLateKillPrefix,
    detectTS,
    classifyTS,
    engageTS,
    targetWindows,
    arrivalTS: arrivals.map((x) => x.t),
    arrivalLeakerPrefix,
    trackCount,
    trackIds,
    raidSize: report.totals.raidSize,
  }
}

export interface LiveKpis {
  /** Threat tracks first detected by t. */
  detected: number
  /** Threat tracks promoted to hostile classification by t. */
  classified: number
  /**
   * Threat tracks inside a currently usable, ROE-gated effector window and
   * not yet expected dead. A ghost track holds no target slot.
   */
  targetable: number
  /** Threat tracks with at least one salvo assigned by t. */
  engaged: number
  /** Kinetic salvos (interceptor, gun, net) assigned by t. */
  kineticShots: number
  /** Directed-energy bursts (DE, HPM) assigned by t. */
  deSalvos: number
  /** EW salvos (jammer) assigned by t. */
  jamSalvos: number
  /**
   * DEFEAT mass: expected kill mass landed by t whose effect was at or before
   * its threat's arrival. Converges to AttritionTotals.expectedKills.
   */
  expectedKills: number
  /**
   * Kill mass landed by t whose effect was strictly after its threat's
   * arrival. Real destruction that arrived too late to defend the asset, so
   * it is reported apart and never reduces leakerShips. Converges to
   * AttritionTotals.expectedLateKills.
   */
  lateKills: number
  /** Threat tracks past arrival at the defended asset by t. */
  arrivedTracks: number
  /**
   * Expected ship mass that reached the asset: per arrived threat, its ship
   * count minus the PRE-ARRIVAL kill mass landed on it. Fixed at each
   * threat's arrival, so this count never falls, and it converges exactly to
   * AttritionTotals.expectedLeakers. A threat that never crosses a defended
   * boundary leaks nothing here and nothing there: its survivors sit in
   * AttritionTotals.expectedNoArrival instead.
   */
  leakerShips: number
}

export function liveKpisAt(tl: LiveTimeline, tS: number): LiveKpis {
  const effectN = countAtMost(tl.effectTS, tS)
  return {
    detected: countAtMost(tl.detectTS, tS),
    classified: countAtMost(tl.classifyTS, tS),
    targetable: tl.targetWindows.filter(
      (w) => tS >= w.startS && tS <= w.endS && (w.deadAtS == null || tS < w.deadAtS),
    ).length,
    engaged: countAtMost(tl.engageTS, tS),
    kineticShots: countAtMost(tl.kineticTS, tS),
    deSalvos: countAtMost(tl.deTS, tS),
    jamSalvos: countAtMost(tl.jamTS, tS),
    expectedKills: prefixAt(tl.effectKillPrefix, effectN),
    lateKills: prefixAt(tl.effectLateKillPrefix, effectN),
    arrivedTracks: countAtMost(tl.arrivalTS, tS),
    leakerShips: prefixAt(tl.arrivalLeakerPrefix, countAtMost(tl.arrivalTS, tS)),
  }
}

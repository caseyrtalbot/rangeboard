import type { Scenario } from '../model/types'
import type { AttritionReport } from '../playback/attritionReport'
import type { ThreatAssessment } from '../playback/sim'
import type { DetectionHit } from '../playback/detection'
import { waveIndexFor } from '../playback/raid'
import { THREAT_TACTICS } from '../playback/tactics'
import { SHIP_DEAD_BELOW } from '../playback/pk'

export interface ThreatOperationalRow {
  uasId: string
  name: string
  modelName: string
  tacticId: string | null
  tacticName: string | null
  waveIndex: number | null
  shipCount: number
  status: ThreatAssessment['status']
  detected: boolean
  trackNow: boolean
  trackedAtDecision: boolean
  identified: boolean
  targetAcquired: boolean
  targetableNow: boolean
  engaged: boolean
  effectObserved: boolean
  effectMet: boolean
  firstDetectS: number | null
  hostileAtS: number | null
  firstShotS: number | null
  /** First effect that actually removed kill mass; a 'continue' jam dwell is not one. */
  firstEffectS: number | null
  /** First 'continue' jam effect (track degrade, no mass removed); null when never jammed. */
  firstJamEffectS: number | null
  arrivalS: number | null
  trackContinuity: number | null
  longestTrackGapS: number | null
  salvos: number
  expectedKills: number
  expectedResidual: number
  residualPct: number
}

export interface ThreatOperationalGroup {
  id: string
  label: string
  tacticId: string | null
  tacticName: string | null
  waveIndex: number | null
  modelName: string
  tracks: number
  ships: number
  detected: number
  trackNow: number
  trackedAtDecision: number
  identified: number
  targetAcquired: number
  targetableNow: number
  engaged: number
  effectMet: number
  salvos: number
  expectedKills: number
  expectedResidual: number
  residualPct: number
  earliestDetectS: number | null
  earliestEngageS: number | null
  minimumTrackContinuity: number | null
  longestTrackGapS: number | null
  members: ThreatOperationalRow[]
}

function tacticIdFromNotes(notes: string): string | null {
  const match = /^([A-Z]+-(?:LR|TAC)-\d+)\s+ship\s+/i.exec(notes.trim())
  return match?.[1]?.toUpperCase() ?? null
}

function timeReached(value: number | null, tS: number | null): boolean {
  return value != null && tS != null && value <= tS + 1e-9
}

function heldAt(intervals: Array<[number, number]>, tS: number): boolean {
  return intervals.some(([start, end]) => tS >= start - 0.25 && tS <= end + 0.25)
}

function minTime(values: Array<number | null>): number | null {
  let min: number | null = null
  for (const value of values) if (value != null && (min == null || value < min)) min = value
  return min
}

/**
 * Time each threat's expected residual first falls below the engine's
 * expected-dead cutoff, keyed by uasId. This is the same rule trackState.ts
 * latches its GHOST phase on: residual fraction strictly below
 * SHIP_DEAD_BELOW, prefix-aggregated over the ledger in effect-time order.
 * killDelta is never negative, so residual only falls and the latch is
 * one-way by construction. Threats that never reach the cutoff are absent
 * from the map.
 *
 * Late kill mass counts here exactly like pre-arrival mass. Whether a defeat
 * defended the asset is a CREDIT question (see EngagementEvent.lateEffect);
 * whether the airframe still flies is a survival question, and a late kill
 * still destroys it. Shared by systemTelemetry.targetsNow, liveStats
 * targetable, and targetableNow below, so every telemetry surface stops
 * calling an expected-dead track a target at the same instant.
 */
export function expectedDeadTimes(report: AttritionReport): Map<string, number> {
  const shipCounts = new Map(report.threats.map((row) => [row.uasId, row.shipCount]))
  const byThreat = new Map<string, AttritionReport['events']>()
  for (const event of report.events) {
    const events = byThreat.get(event.uasId) ?? []
    events.push(event)
    byThreat.set(event.uasId, events)
  }
  const out = new Map<string, number>()
  for (const [uasId, events] of byThreat) {
    // No attrition row means no resolved formation: treat it as one ship.
    const shipCount = shipCounts.get(uasId) ?? 1
    if (shipCount <= 0) continue
    let killed = 0
    for (const event of [...events].sort((a, b) => a.tEffectS - b.tEffectS)) {
      killed += event.killDelta
      if (Math.max(0, shipCount - killed) / shipCount < SHIP_DEAD_BELOW) {
        out.set(uasId, event.tEffectS)
        break
      }
    }
  }
  return out
}

/** Track quality up to t, not the whole run. Null before the first detection. */
export function trackQualityAt(
  assessment: ThreatAssessment,
  tS: number | null,
): { continuity: number; longestGapS: number } | null {
  if (tS == null || assessment.firstDetectS == null || tS < assessment.firstDetectS) return null
  if (!Number.isFinite(tS)) {
    return assessment.trackQuality
      ? {
          continuity: assessment.trackQuality.continuity,
          longestGapS: assessment.trackQuality.longestGapS,
        }
      : null
  }
  const start = assessment.firstDetectS
  const intervals = (assessment.sensorObservations ?? [])
    .flatMap((observation) => observation.intervals)
    .map(([from, to]) => [Math.max(start, from), Math.min(tS, to)] as [number, number])
    .filter(([from, to]) => to >= from)
    .sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const interval of intervals) {
    const previous = merged[merged.length - 1]
    if (!previous || interval[0] > previous[1] + 0.5 + 1e-9) merged.push([...interval])
    else previous[1] = Math.max(previous[1], interval[1])
  }
  const totalSamples = Math.max(1, Math.floor((tS - start) / 0.5 + 1e-9) + 1)
  const heldSamples = merged.reduce(
    (sum, [from, to]) => sum + Math.floor((to - from) / 0.5 + 1e-9) + 1,
    0,
  )
  let longestGapS = 0
  let previousEnd = start - 0.5
  for (const [from, to] of merged) {
    longestGapS = Math.max(longestGapS, Math.max(0, from - previousEnd - 0.5))
    previousEnd = to
  }
  longestGapS = Math.max(longestGapS, Math.max(0, tS - previousEnd))
  return { continuity: Math.min(1, heldSamples / totalSamples), longestGapS }
}

/**
 * Complete threat picture at one observed time. Tactic raids are partitioned
 * by tactic, wave, and platform so large mixed raids stay readable without
 * erasing their timing or decoy/platform differences.
 */
export function threatPictureAt(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
  tS: number | null,
  currentHits: Map<string, DetectionHit[]>,
): ThreatOperationalGroup[] {
  const attrition = new Map(report.threats.map((row) => [row.uasId, row]))
  const deadAtS = expectedDeadTimes(report)
  const eventsByThreat = new Map<string, AttritionReport['events']>()
  for (const event of report.events) {
    const events = eventsByThreat.get(event.uasId) ?? []
    events.push(event)
    eventsByThreat.set(event.uasId, events)
  }
  const groups = new Map<string, ThreatOperationalGroup>()
  for (const assessment of assessments) {
    if (assessment.status === 'no-path') continue
    const entity = scenario.entities.find((candidate) => candidate.id === assessment.uasId)
    const model = scenario.library.find((candidate) => candidate.id === entity?.specId)
    const att = attrition.get(assessment.uasId)
    const events = eventsByThreat.get(assessment.uasId) ?? []
    const visibleEvents = tS == null ? [] : events.filter((event) => event.tS <= tS + 1e-9)
    const landed = tS == null ? [] : events.filter((event) => event.tEffectS <= tS + 1e-9)
    const shipCount = att?.shipCount ?? entity?.formation?.count ?? 1
    const expectedKills = landed.reduce((sum, event) => sum + event.killDelta, 0)
    const expectedResidual = Math.max(0, shipCount - expectedKills)
    const tacticId = entity ? tacticIdFromNotes(entity.notes) : null
    const tactic = tacticId ? THREAT_TACTICS.find((candidate) => candidate.id === tacticId) : null
    const waveIndex = entity ? waveIndexFor(scenario.raid, entity.id) : null
    const modelName = model?.name.split(':').pop()?.trim() ?? entity?.name ?? assessment.uasId
    // An effect is the first EFFECT only when it removed kill mass. A
    // 'continue' jam dwell degrades the track and removes nothing, so it
    // reports separately instead of claiming the first-effect time.
    const firstEffectS = minTime(
      events.filter((event) => event.killDelta > 0).map((event) => event.tEffectS),
    )
    const firstJamEffectS = minTime(
      events.filter((event) => event.channel === 'jam').map((event) => event.tEffectS),
    )
    const trackQuality = trackQualityAt(assessment, tS)
    const decisionS = att?.firstShotS ?? assessment.windowS?.[0] ?? assessment.arrivalS
    const trackedAtDecision =
      decisionS != null &&
      (assessment.sensorObservations ?? []).some((observation) =>
        heldAt(observation.intervals, decisionS),
      )
    // An expected-dead track is not a target. targetableNow is a gauge, so it
    // drops the instant the residual crosses the cutoff. targetAcquired is a
    // milestone latch, so it asks the same question at the moment the window
    // opened: a ghost can never be acquired, and a track that was acquired
    // while it still flew keeps that history after it is killed.
    const deadS = deadAtS.get(assessment.uasId) ?? null
    const targetAcquired =
      tS != null &&
      assessment.status === 'engageable' &&
      assessment.windowS != null &&
      assessment.windowS[0] <= tS + 1e-9 &&
      (deadS == null || assessment.windowS[0] < deadS)
    const targetableNow =
      tS != null &&
      assessment.status === 'engageable' &&
      assessment.windowS != null &&
      tS >= assessment.windowS[0] - 1e-9 &&
      tS <= assessment.windowS[1] + 1e-9 &&
      (deadS == null || tS < deadS)
    const row: ThreatOperationalRow = {
      uasId: assessment.uasId,
      name: entity?.name ?? assessment.uasId,
      modelName,
      tacticId,
      tacticName: tactic?.name ?? null,
      waveIndex,
      shipCount,
      status: assessment.status,
      detected: timeReached(assessment.firstDetectS, tS),
      trackNow: currentHits.has(assessment.uasId),
      trackedAtDecision,
      identified: timeReached(assessment.classificationAtS.hostileAtS, tS),
      targetAcquired,
      targetableNow,
      engaged: visibleEvents.length > 0,
      effectObserved: landed.length > 0,
      effectMet: shipCount > 0 && expectedResidual / shipCount <= SHIP_DEAD_BELOW + 1e-9,
      firstDetectS: assessment.firstDetectS,
      hostileAtS: assessment.classificationAtS.hostileAtS,
      firstShotS: att?.firstShotS ?? null,
      firstEffectS,
      firstJamEffectS,
      arrivalS: assessment.arrivalS,
      trackContinuity: trackQuality?.continuity ?? null,
      longestTrackGapS: trackQuality?.longestGapS ?? null,
      salvos: visibleEvents.length,
      expectedKills,
      expectedResidual,
      residualPct: shipCount > 0 ? (expectedResidual / shipCount) * 100 : 0,
    }
    const key = `${tacticId ?? 'manual'}:${waveIndex ?? 'none'}:${entity?.specId ?? modelName}`
    let group = groups.get(key)
    if (!group) {
      const wave = waveIndex == null ? '' : ` · Wave ${waveIndex + 1}`
      group = {
        id: key,
        label: tactic ? `${tactic.id} · ${tactic.name}${wave} · ${modelName}` : `${modelName}${wave}`,
        tacticId,
        tacticName: tactic?.name ?? null,
        waveIndex,
        modelName,
        tracks: 0,
        ships: 0,
        detected: 0,
        trackNow: 0,
        trackedAtDecision: 0,
        identified: 0,
        targetAcquired: 0,
        targetableNow: 0,
        engaged: 0,
        effectMet: 0,
        salvos: 0,
        expectedKills: 0,
        expectedResidual: 0,
        residualPct: 0,
        earliestDetectS: null,
        earliestEngageS: null,
        minimumTrackContinuity: null,
        longestTrackGapS: null,
        members: [],
      }
      groups.set(key, group)
    }
    group.members.push(row)
    group.tracks += 1
    group.ships += shipCount
    group.detected += row.detected ? 1 : 0
    group.trackNow += row.trackNow ? 1 : 0
    group.trackedAtDecision += row.trackedAtDecision ? 1 : 0
    group.identified += row.identified ? 1 : 0
    group.targetAcquired += row.targetAcquired ? 1 : 0
    group.targetableNow += row.targetableNow ? 1 : 0
    group.engaged += row.engaged ? 1 : 0
    group.effectMet += row.effectMet ? 1 : 0
    group.salvos += row.salvos
    group.expectedKills += row.expectedKills
    group.expectedResidual += row.expectedResidual
    if (row.detected && row.firstDetectS != null) {
      group.earliestDetectS =
        group.earliestDetectS == null
          ? row.firstDetectS
          : Math.min(group.earliestDetectS, row.firstDetectS)
    }
    if (row.engaged && row.firstShotS != null) {
      group.earliestEngageS =
        group.earliestEngageS == null
          ? row.firstShotS
          : Math.min(group.earliestEngageS, row.firstShotS)
    }
    if (row.trackContinuity != null) {
      group.minimumTrackContinuity =
        group.minimumTrackContinuity == null
          ? row.trackContinuity
          : Math.min(group.minimumTrackContinuity, row.trackContinuity)
    }
    if (row.longestTrackGapS != null) {
      group.longestTrackGapS =
        group.longestTrackGapS == null
          ? row.longestTrackGapS
          : Math.max(group.longestTrackGapS, row.longestTrackGapS)
    }
  }
  for (const group of groups.values()) {
    group.residualPct = group.ships > 0 ? (group.expectedResidual / group.ships) * 100 : 0
  }
  return [...groups.values()]
}

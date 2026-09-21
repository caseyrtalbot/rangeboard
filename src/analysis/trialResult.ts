import type { Scenario } from '../model/types'
import { entityActive, runSettings } from '../model/types'
import { scenarioDurationS } from '../model/scenario'
import { idHash } from '../geometry/prng'
import { analysisBasisSignature } from '../state/analysisBasis'
import type { AttritionReport } from '../playback/attritionReport'
import type { ThreatAssessment } from '../playback/sim'
import type { SensorScanObservation } from '../playback/detection'
import type { TrialJamDecision, TrialManifest, TrialResult } from '../playback/trialTypes'
import { sameManifest } from '../playback/trialTypes'
import { TRIAL_DRAW_POLICY_VERSION, TRIAL_ENGINE_REVISION } from '../playback/trialTypes'
import type { RunValidityAssessment } from './runValidity'
import type { EngagementPicture } from './impact'
import { engagementPicture } from './impact'
import { applyOverrides } from '../model/applyOverrides'

export interface TrialResultView {
  scenario: Scenario
  manifest: TrialManifest
  result: TrialResult
  attrition: AttritionReport
  assessments: ThreatAssessment[]
  observations: SensorScanObservation[]
  jamDecisions: TrialJamDecision[]
  durationS: number
  /** Retained result bound; transport observation further caps queries at the selector. */
  observedThroughS: number
  hasActiveAsset: boolean
  validity: RunValidityAssessment | null
}

export interface TrialCounts {
  preArrivalHardKills: number
  preArrivalSoftKills: number
  lateHardKills: number
  lateSoftKills: number
  arrivedUndefeated: number
  noModelsArrival: number
  activeAtHorizon: number
  detectedTracks: number
  engagedTracks: number
  totalTracks: number
}

export type TrialSummary =
  | { status: 'ready'; counts: TrialCounts; validity: RunValidityAssessment | null }
  | {
      status: 'preparing' | 'error' | 'idle' | 'cancelled'
      errorMessage?: string
      validity: RunValidityAssessment | null
    }

export interface TrialSnapshot {
  runId: string
  observedThroughS: number
  horizon: {
    kind: 'completed-trial' | 'bounded-observation'
    durationS: number
    observedThroughS: number
  }
  counts: TrialCounts
  tracksRendered: boolean
  reportedLeakers: number | null
  summary?: TrialSummary
}

// Optional retained metadata is additive: absent validity stays unavailable and
// the playback clock is never fabricated here.
type CapturedResult = TrialResult & {
  observedThroughS?: number
  validity?: RunValidityAssessment | null
}
const views = new WeakMap<TrialResult, WeakMap<Scenario, TrialResultView>>()
const signatures = new WeakMap<Scenario, string>()
type CountKey = 'preArrivalHardKills' | 'preArrivalSoftKills' | 'lateHardKills' | 'lateSoftKills'
interface CountIndex {
  effects: Record<CountKey, number[]>
  arrivals: number[]
  detections: number[]
  engagements: number[]
  population: number
  noArrival: number
  tracks: number
}
const indexes = new WeakMap<TrialResultView, CountIndex>()

function countAt(times: number[], t: number): number {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (times[mid] <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function trialResultOf(
  scenario: Scenario,
  manifest: TrialManifest,
  result: CapturedResult,
): TrialResultView {
  const cached = views.get(result)?.get(scenario)
  if (cached && sameManifest(cached.manifest, manifest)) return cached
  let signature = signatures.get(scenario)
  if (signature == null) {
    signature = analysisBasisSignature(scenario)
    signatures.set(scenario, signature)
  }
  if (
    !manifest.runId ||
    manifest.basisSignature !== signature ||
    manifest.seed !== runSettings(scenario).seed ||
    manifest.replicateIndex !== idHash(manifest.runId) ||
    manifest.basis !== 'nominal-aleatory' ||
    manifest.engineRevision !== TRIAL_ENGINE_REVISION ||
    manifest.drawPolicyVersion !== TRIAL_DRAW_POLICY_VERSION ||
    !(manifest.buildRevision === null || typeof manifest.buildRevision === 'string')
  )
    throw new Error('Invalid trial manifest or scenario basis')
  if (
    !result?.manifest ||
    !sameManifest(manifest, result.manifest) ||
    !Array.isArray(result.assessments) ||
    !Array.isArray(result.observations) ||
    !Array.isArray(result.jamDecisions) ||
    !result.report?.totals ||
    !Array.isArray(result.report.events) ||
    !Array.isArray(result.report.threats) ||
    !Array.isArray(result.report.effectors)
  )
    throw new Error('Incomplete or mismatched trial result')
  const entities = new Map(
    scenario.entities.filter((e) => e.kind === 'uas' && entityActive(e)).map((e) => [e.id, e]),
  )
  const assessments = new Map(result.assessments.map((a) => [a.uasId, a]))
  if (
    assessments.size !== entities.size ||
    result.assessments.length !== entities.size ||
    [...entities.keys()].some((id) => !assessments.has(id))
  )
    throw new Error('Incomplete trial assessments')
  const modeled = result.assessments.filter((a) => a.status !== 'no-path')
  const rows = new Map(result.report.threats.map((row) => [row.uasId, row]))
  if (
    rows.size !== modeled.length ||
    result.report.threats.length !== modeled.length ||
    modeled.some(
      (a) =>
        rows.get(a.uasId)?.shipCount !== Math.max(1, entities.get(a.uasId)?.formation?.count ?? 1),
    )
  ) {
    throw new Error('Incomplete trial member ledger')
  }
  const jamKeys = new Set<string>()
  const removed = new Set<string>()
  for (const event of result.report.events) {
    const entity = entities.get(event.uasId)
    if (
      !entity ||
      !Number.isInteger(event.shipIdx) ||
      event.shipIdx < 0 ||
      event.shipIdx >= Math.max(1, entity.formation?.count ?? 1) ||
      !Number.isFinite(event.tS) ||
      !Number.isFinite(event.tEffectS) ||
      event.tS < 0 ||
      event.tEffectS < event.tS ||
      (event.killDelta !== 0 && event.killDelta !== 1)
    )
      throw new Error('Invalid sampled member effect')
    if (event.channel === 'jam')
      jamKeys.add(JSON.stringify([event.effectorId, event.uasId, event.tEffectS]))
    const key = JSON.stringify([event.uasId, event.shipIdx])
    if (event.killDelta === 1) {
      if (removed.has(key) || event.channel !== 'kill')
        throw new Error('Duplicate sampled member removal')
      removed.add(key)
    }
  }
  for (const observation of result.observations) {
    const entity = entities.get(observation.uasId)
    if (
      !entity ||
      !Number.isFinite(observation.tS) ||
      observation.tS < 0 ||
      !Array.isArray(observation.members) ||
      observation.members.some(
        (m) =>
          !Number.isInteger(m.memberIdx) ||
          m.memberIdx < 0 ||
          m.memberIdx >= Math.max(1, entity.formation?.count ?? 1) ||
          !Number.isInteger(m.drawIndex) ||
          m.drawIndex < 0 ||
          !Number.isFinite(m.slantM) ||
          m.slantM < 0 ||
          typeof m.detected !== 'boolean' ||
          typeof m.classified !== 'boolean' ||
          (m.pd !== null && (!Number.isFinite(m.pd) || m.pd < 0 || m.pd > 1)),
      )
    )
      throw new Error('Invalid retained trial scan')
  }
  const decisionKeys = new Set<string>()
  for (const decision of result.jamDecisions) {
    const key = JSON.stringify([decision.effectorId, decision.uasId, decision.tEffectS])
    if (
      !jamKeys.has(key) ||
      (decision.outcome !== 0 && decision.outcome !== 1) ||
      !Number.isFinite(decision.probability) ||
      decision.probability < 0 ||
      decision.probability > 1
    )
      throw new Error('Invalid retained trial jam decision')
    decisionKeys.add(key)
  }
  if ([...jamKeys].some((key) => !decisionKeys.has(key)))
    throw new Error('Incomplete trial jam decisions')
  const durationS = scenarioDurationS(scenario)
  const observedThroughS = result.observedThroughS ?? durationS
  if (!Number.isFinite(observedThroughS) || observedThroughS < 0)
    throw new Error('Invalid trial observation bound')
  const view: TrialResultView = {
    scenario,
    manifest,
    result,
    attrition: result.report,
    assessments: result.assessments,
    observations: result.observations,
    jamDecisions: result.jamDecisions,
    durationS,
    observedThroughS: Math.min(durationS, observedThroughS),
    hasActiveAsset: scenario.entities.some((e) => e.kind === 'asset' && entityActive(e)),
    validity: result.validity ?? null,
  }
  const byScenario = views.get(result) ?? new WeakMap<Scenario, TrialResultView>()
  byScenario.set(scenario, view)
  views.set(result, byScenario)
  return view
}

function indexOf(view: TrialResultView): CountIndex {
  const cached = indexes.get(view)
  if (cached) return cached
  const effects: CountIndex['effects'] = {
    preArrivalHardKills: [],
    preArrivalSoftKills: [],
    lateHardKills: [],
    lateSoftKills: [],
  }
  const removals = new Map<string, number>()
  const assessments = new Map(view.assessments.map((a) => [a.uasId, a]))
  const engaged = new Map<string, number>()
  for (const event of view.attrition.events) {
    engaged.set(event.uasId, Math.min(engaged.get(event.uasId) ?? Infinity, event.tS))
    if (event.killDelta !== 1) continue
    const key: CountKey = event.lateEffect
      ? event.softShot
        ? 'lateSoftKills'
        : 'lateHardKills'
      : event.softShot
        ? 'preArrivalSoftKills'
        : 'preArrivalHardKills'
    effects[key].push(event.tEffectS)
    const arrival = assessments.get(event.uasId)?.arrivalS
    if (arrival != null && event.tEffectS <= arrival)
      removals.set(event.uasId, (removals.get(event.uasId) ?? 0) + 1)
  }
  const arrivals: number[] = []
  const detections: number[] = []
  let population = 0
  let noArrival = 0
  let tracks = 0
  const entities = new Map(view.scenario.entities.map((e) => [e.id, e]))
  for (const a of view.assessments) {
    const n = Math.max(1, entities.get(a.uasId)?.formation?.count ?? 1)
    population += n
    if (a.arrivalS == null) noArrival += n
    if (a.status === 'no-path') continue
    tracks++
    if (a.firstDetectS != null) detections.push(a.firstDetectS)
    if (a.arrivalS != null && view.hasActiveAsset) {
      for (let member = 0; member < n - (removals.get(a.uasId) ?? 0); member++)
        arrivals.push(a.arrivalS)
    }
  }
  const sort = (values: number[]) => values.sort((a, b) => a - b)
  Object.values(effects).forEach(sort)
  const index = {
    effects,
    arrivals: sort(arrivals),
    detections: sort(detections),
    engagements: sort([...engaged.values()]),
    population,
    noArrival,
    tracks,
  }
  indexes.set(view, index)
  return index
}

export function trialSnapshotAt(view: TrialResultView, horizonS: number): TrialSnapshot {
  const t = Math.min(Number.isNaN(horizonS) ? 0 : Math.max(0, horizonS), view.observedThroughS)
  const index = indexOf(view)
  const counts: TrialCounts = {
    preArrivalHardKills: countAt(index.effects.preArrivalHardKills, t),
    preArrivalSoftKills: countAt(index.effects.preArrivalSoftKills, t),
    lateHardKills: countAt(index.effects.lateHardKills, t),
    lateSoftKills: countAt(index.effects.lateSoftKills, t),
    arrivedUndefeated: countAt(index.arrivals, t),
    noModelsArrival: index.noArrival,
    activeAtHorizon: index.population,
    detectedTracks: countAt(index.detections, t),
    engagedTracks: countAt(index.engagements, t),
    totalTracks: index.tracks,
  }
  counts.activeAtHorizon -=
    counts.preArrivalHardKills +
    counts.preArrivalSoftKills +
    counts.lateHardKills +
    counts.lateSoftKills
  const complete = t >= view.durationS
  return {
    runId: view.manifest.runId,
    observedThroughS: t,
    horizon: {
      kind: complete ? 'completed-trial' : 'bounded-observation',
      durationS: view.durationS,
      observedThroughS: t,
    },
    counts,
    tracksRendered: index.tracks > 0,
    reportedLeakers: view.hasActiveAsset ? counts.arrivedUndefeated : null,
    ...(complete ? { summary: { status: 'ready' as const, counts, validity: view.validity } } : {}),
  }
}

/**
 * The deterministic forecast a trial is compared with: the engagement picture
 * of the captured scenario with the manifest's overrides applied, the values
 * the trial ran on. With no override this is the picture of the captured
 * scenario itself, the same object `applyOverrides` returns.
 */
export function trialForecast(view: TrialResultView): EngagementPicture {
  return engagementPicture(applyOverrides(view.scenario, view.manifest.overrides))
}

import type { Scenario } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport } from '../playback/attritionReport'
import type { McSummary, SensitivitySummary } from '../playback/mcRun'
import type { RunValidityAssessment } from '../analysis/runValidity'
import { assessRunValidity } from '../analysis/runValidity'
import { engagementReleaseS } from '../playback/engagementTiming'
import type { TrialCounts, TrialResultView, TrialSummary } from '../analysis/trialResult'
import { trialResultOf, trialSnapshotAt } from '../analysis/trialResult'
import type { TrialMemberState } from '../playback/trialTrackState'
import { trialTrackStatesAt } from '../playback/trialTrackState'
import type { TrialManifest, TrialJamDecision } from '../playback/trialTypes'
import type { SensorScanObservation } from '../playback/detection'
import { analysisBasisSignature } from '../state/analysisBasis'
import { applyOverrides } from '../model/applyOverrides'

export interface TrialResultGroup {
  basis: 'simulated-trial'
  parameterBasis: 'nominal-aleatory'
  independentlyInstrumented: false
  confidenceInterval: null
  horizon: { kind: 'completed-trial'; durationS: number; observedThroughS: number }
  population: { trackCount: number; memberCount: number; excludedNoPathIds: string[] }
  scenario: Scenario
  manifest: TrialManifest
  assessments: ThreatAssessment[]
  attrition: AttritionReport
  observations: SensorScanObservation[]
  jamDecisions: TrialJamDecision[]
  counts: TrialCounts
  members: TrialMemberState[]
  summary: TrialSummary
  validity: RunValidityAssessment
  measures: Record<string, string | number | boolean | null>
}

/** Export captured facts, revalidating at the boundary rather than trusting cached views. */
export function buildTrialResultGroup(trial: TrialResultView): TrialResultGroup {
  if (trial.manifest.basisSignature !== analysisBasisSignature(trial.scenario)) {
    throw new Error('Trial basis signature does not match its captured scenario')
  }
  const view = trialResultOf(trial.scenario, trial.manifest, {
    ...trial.result, observedThroughS: trial.observedThroughS, validity: trial.validity,
  })
  const snapshot = trialSnapshotAt(view, view.durationS)
  if (trial.durationS !== view.durationS || snapshot.horizon.kind !== 'completed-trial' || snapshot.summary?.status !== 'ready') {
    throw new Error('Cannot export an incomplete trial')
  }
  const members = trialTrackStatesAt(view, view.durationS).flatMap(track => track.members)
  const counts = snapshot.counts
  if (Object.values(counts).some(value => !Number.isInteger(value) || value < 0)) {
    throw new Error('Invalid trial counts')
  }
  // The requirement validity reads the values the trial ran, the manifest's overrides included.
  const validity = view.validity ?? assessRunValidity({
    ...applyOverrides(view.scenario, view.manifest.overrides), runMode: 'monte-carlo', uncertainty: 'aleatory',
  }, view.assessments)
  const tracks = view.assessments.filter(a => a.status !== 'no-path')
  const warnings = tracks.map(a => a.warningS).filter((t): t is number => t != null && Number.isFinite(t))
  const heldTracks = tracks.filter(a => (a.sensorObservations ?? []).some(sensor =>
    sensor.intervals.some(([start, end]) => start <= view.durationS && end > start))).length
  return {
    basis: 'simulated-trial', parameterBasis: 'nominal-aleatory',
    independentlyInstrumented: false, confidenceInterval: null,
    horizon: { ...snapshot.horizon, kind: 'completed-trial' },
    population: {
      trackCount: counts.totalTracks, memberCount: members.length,
      excludedNoPathIds: view.assessments.filter(a => a.status === 'no-path').map(a => a.uasId),
    },
    scenario: view.scenario, manifest: view.manifest, assessments: view.assessments,
    attrition: view.attrition, observations: view.observations, jamDecisions: view.jamDecisions,
    counts, members, summary: { ...snapshot.summary, validity }, validity,
    measures: {
      realization: 'One simulation realization; no ensemble confidence interval or independently observed T&E claim',
      buildRevision: view.manifest.buildRevision ?? 'Build revision unavailable',
      'events.tS': 'assignment/accounting time in seconds from T0',
      'events.tReleaseS': 'physical release time in seconds from T0',
      'events.tEffectS': 'modeled effect time in seconds from T0',
      'events.shipIdx': 'actual zero-based member index within the threat',
      'observations.members.drawIndex': 'draw rank, not member identity; memberIdx identifies the actual member',
      memberDenominator: members.length,
      trackDenominator: counts.totalTracks,
      population: 'Member counts include no-path members; track metrics exclude excludedNoPathIds',
      heldTracks,
      heldTracksDefinition: 'tracks with any retained held interval by the completed horizon; not current holds',
      noModelsArrival: 'members without a modeled arrival, including defeated and no-path members; not a disjoint outcome partition',
      activeAtHorizon: 'members without a reached hard or soft defeat, including arrivals and no-path members',
      lateEffects: 'Late hard and soft effects never subtract previously realized leakage',
      reportedLeakers: view.hasActiveAsset ? counts.arrivedUndefeated : null,
      protection: view.hasActiveAsset && tracks.length > 0 ? counts.arrivedUndefeated === 0 : null,
      protectionDefinition: 'no realized undefeated arrivals through the completed horizon; not a requirement verdict',
      warningS: view.hasActiveAsset && warnings.length > 0 ? Math.min(...warnings) : null,
      warningDefinition: 'minimum finite sampled track warning in seconds; null when unavailable',
    },
  }
}

interface ResultGroup {
  basis: 'planning-envelope' | 'monte-carlo-estimate' | 'paired-one-at-a-time'
  horizon: string
  validity: RunValidityAssessment
  measures: Record<string, string | number | boolean | null>
}

/** The basis belongs to each result group, even in a mixed run package. */
export interface RunResultGroups {
  assessments: ResultGroup
  attrition: ResultGroup
  requirements: ResultGroup
  summary: ResultGroup
  mcSummary?: ResultGroup
  sensitivity?: ResultGroup
  trial?: TrialResultGroup
}

/** Describe existing outputs without changing their values or statistical algorithms. */
export function runResultGroups(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
  mc: McSummary | null,
  sensitivity: SensitivitySummary | null,
  trial: TrialResultView | null = null,
): RunResultGroups {
  if (trial && trial.manifest.basisSignature !== analysisBasisSignature(scenario)) {
    throw new Error('Trial basis signature does not match the export package')
  }
  const envelope = assessRunValidity({ ...scenario, runMode: 'deterministic' }, assessments)
  const estimate = assessRunValidity({ ...scenario, runMode: 'monte-carlo' }, assessments)
  const group = (measures: ResultGroup['measures']): ResultGroup => ({
    basis: 'planning-envelope', horizon: 'full-run', validity: envelope, measures,
  })
  const recordedReleaseCount = report.events.filter(event => engagementReleaseS(event) != null).length
  const availableReleaseCount = report.events.filter(event => engagementReleaseS(event, scenario) != null).length
  const measurableLeakers = report.totals.reportedLeakers != null
  const groups: RunResultGroups = {
    assessments: group({
      population: 'active threat tracks; no-path records have no flight result',
      '*S, intervals, gates': 'seconds from run T0; null means the event or interval is undefined',
      '*M': 'meters; CPA distance is distinct from defended-boundary arrival',
      'sensorObservations.pdSeries': 'modeled per-scan detection probability, not a mean CI',
      'status, classification, hold': 'deterministic threshold states, not MC probabilities',
    }),
    attrition: group({
      raidSize: report.totals.raidSize,
      'expectedKills, expectedHardKills, expectedSoftKills': 'ships defeated at or before arrival',
      expectedLeakers: 'partition ships arriving undefeated; not a display value without an asset',
      expectedNoArrival: 'ships neither defeated nor arrived',
      expectedLateKills: 'ships destroyed after arrival; subset of leakers, not extra defeat',
      reportedLeakers: 'ships arriving undefeated; null without an active defended asset',
      leakersDefined: measurableLeakers,
      leakProbability: 'per-ship residual at arrival, not probability of passing a requirement',
      shotsFired: 'kinetic salvos', deSalvos: 'directed-energy bursts', jamSalvos: 'EW salvos',
      expectedRoundsRemaining: 'remaining magazine units under the effector expenditure channel',
      'events.tS': 'assignment time in seconds from T0; magazine, cooldown and salvo counts land here',
      'events.tReleaseS': 'physical release time in seconds from T0; assignment plus resolved engagement delay; optional in legacy records',
      'events.tEffectS': 'effect time in seconds from T0; kill or jam math lands here',
      releaseTiming: 'missing legacy release is reconstructable only from the captured effector delay; otherwise launch timing is unavailable; raw events remain unchanged',
      releaseTimingRecordedEvents: recordedReleaseCount,
      releaseTimingReconstructableEvents: availableReleaseCount - recordedReleaseCount,
      releaseTimingUnavailableEvents: report.events.length - availableReleaseCount,
      'events.killDelta': 'ship mass removed at effect, including late effects',
      'events.shipIdx': 'zero-based member index within the threat',
      'events.pk': 'planning per-shot kill probability',
    }),
    requirements: group({
      rule: 'existing deterministic per-track threshold tests, qualified by all validity findings',
      thresholds: 'scenario.requirements with documented defaults; no new acceptance threshold',
      'gate.met, gate.required': 'qualifying threat tracks, not ships or MC replicates',
      'report.met, report.required': 'passing gates and total gates',
      uncertainty: 'no MC probability-of-passing statistic or confidence interval is available',
    }),
    summary: group({
      raidSize: report.totals.raidSize,
      expectedLeakers: 'undefeated ships: arrival leakers plus no-arrival mass; pinned AAR meaning',
      leakProbability: 'undefeated ship mass divided by raidSize; null for an empty raid',
      'expectedKills, expectedHardKills, expectedSoftKills': 'pre-arrival defeated ships',
      expectedLateKills: 'post-arrival destroyed ships; does not reduce expectedLeakers',
      'firstDetectS, firstShotS, threats.*S': 'seconds from T0; null means undefined',
      'shotsFired, deSalvos, jamSalvos': 'kinetic salvos, directed-energy bursts, EW salvos',
      'threats.expectedShipsArriving': 'undefeated arriving ships for the named threat',
      'threats.expectedWarheadKg': 'planning warhead mass reaching the asset in kilograms',
      'outcome, impactSeverity': 'planning category, not a requirement verdict',
    }),
  }
  if (mc) groups.mcSummary = {
    basis: 'monte-carlo-estimate', horizon: 'DT grid for bands; full-run for scalar statistics',
    validity: estimate,
    measures: {
      raidSize: report.totals.raidSize,
      trackDenominator: assessments.filter(a => a.status !== 'no-path').length,
      'kills, leakers': 'ship counts; kills are pre-arrival, leakers are arrival partition counts',
      leakersDefined: measurableLeakers,
      leakersDisplay: 'unavailable without an active defended asset; zero with an asset and no arrival',
      'detected, tracked, engaged': 'threat-track counts, denominator trackDenominator',
      defeat: '100 * final kills.mean / raidSize; unavailable for raidSize=0',
      defeatInterval: '100 * final kills.lo/hi / raidSize in percent',
      'firstDetectS, firmTrackS, minWarningS, perThreat.firstDetectS':
        'conditional mean seconds, excluding replicates without a finite event time',
      firstDetectS: 'first single-scan hit; the deterministic run detects at pdDetect',
      firmTrackS: 'earliest stable track file over the tracks',
      'perThreat.killed': 'pre-arrival defeated ships',
      'perThreat.leaked': 'arrival partition ships; unavailable for display without an active asset',
      'perThreat.residual': 'ships surviving at grid time, including destruction after arrival',
      'perThreat.arrivalS': 'nominal geometry arrival in seconds; null with no crossing',
      'perEffector.kills': 'all event killDelta, including late effects, in ships',
      'perEffector.salvos': 'kinetic + directed-energy + EW salvos; not kinetic rounds alone',
      'lo, hi, interval': 'interval on the mean by method: t for a time; t clamped to the count support; Wilson for a 0/1 count, rule of three at 0 of n and n of n',
      'p10, p90, p025, p975': 'replicate quantiles, not mean confidence limits; unavailable under 10 (p10, p90) or 40 (p025, p975) replicates',
      'sd, se': 'replicate standard deviation and mean standard error, in the quantity unit',
      defined: 'finite replicate fraction n/total with a Wilson interval',
      'n, total': 'finite samples and replicates run; n=0 unavailable; JSON null preserves NaN',
      replicates: mc.replicates,
      stopped: 'precision stop concerns final leaker mean only; does not establish every measure precision',
      uncertainty: 'implemented draws and optional parameter spreads; excludes model discrepancy',
    },
  }
  if (sensitivity) groups.sensitivity = {
    basis: 'paired-one-at-a-time', horizon: 'full-run final leaker mean', validity: estimate,
    measures: {
      leakersDefined: measurableLeakers,
      nominal: 'mean arrival-partition ships with all parameters nominal',
      'rows.low, rows.high': 'mean ships at one parameter p10/p90, all other parameters nominal',
      'rows.swing': 'absolute difference of the two endpoint means, in ships',
      'rows.se': 'paired standard error of the swing over the replicates, in ships',
      uncertainty: 'paired seed and replicate draws; endpoints are not confidence limits or outcome quantiles',
      interval: 'no mean confidence interval on the endpoints; the swing carries its paired standard error',
      replicates: sensitivity.replicates,
    },
  }
  if (trial) groups.trial = buildTrialResultGroup(trial)
  return groups
}

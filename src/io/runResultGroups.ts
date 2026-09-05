import type { Scenario } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport } from '../playback/attrition'
import type { McSummary, SensitivitySummary } from '../playback/mcRun'
import type { RunValidityAssessment } from '../analysis/runValidity'
import { assessRunValidity } from '../analysis/runValidity'

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
}

/** Describe existing outputs without changing their values or statistical algorithms. */
export function runResultGroups(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
  mc: McSummary | null,
  sensitivity: SensitivitySummary | null,
): RunResultGroups {
  const envelope = assessRunValidity({ ...scenario, runMode: 'deterministic' }, assessments)
  const estimate = assessRunValidity({ ...scenario, runMode: 'monte-carlo' }, assessments)
  const group = (measures: ResultGroup['measures']): ResultGroup => ({
    basis: 'planning-envelope', horizon: 'full-run', validity: envelope, measures,
  })
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
      'events.tS, events.tEffectS': 'release and effect time in seconds from T0, respectively',
      'events.killDelta': 'ship mass removed at effect, including late effects',
      'events.shipIndex': 'zero-based member index within the threat',
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
      defeatInterval: '100 * final kills.lo/hi / raidSize in percent; half-width in percentage points',
      'firstDetectS, minWarningS, perThreat.firstDetectS':
        'conditional mean seconds, excluding replicates without a finite event time',
      'perThreat.killed': 'pre-arrival defeated ships',
      'perThreat.leaked': 'arrival partition ships; unavailable for display without an active asset',
      'perThreat.residual': 'ships surviving at grid time, including destruction after arrival',
      'perThreat.arrivalS': 'nominal geometry arrival in seconds; null with no crossing',
      'perEffector.kills': 'all event killDelta, including late effects, in ships',
      'perEffector.salvos': 'kinetic + directed-energy + EW salvos; not kinetic rounds alone',
      'lo, hi': 't confidence interval on the mean; unavailable with n<2',
      'p10, p90, p025, p975': 'replicate quantiles, not mean confidence limits',
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
      uncertainty: 'paired seed and replicate draws; endpoints are not confidence limits or outcome quantiles',
      interval: 'no mean confidence interval in the existing sensitivity summary',
      replicates: sensitivity.replicates,
    },
  }
  return groups
}

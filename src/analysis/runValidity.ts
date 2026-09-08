import type { RunValidity, Scenario } from '../model/types'
import { entityActive, runSettings } from '../model/types'
import { modelFor } from '../model/scenario'
import type { McSummary } from '../playback/mcRun'
import { DT } from '../playback/clock'
import { scanPeriodS } from './doctrineFactors'
import { radarPdModeled } from './sensorEnv'
import type { ThreatAssessment } from '../playback/sim'
import { spawnInRingViolations } from '../playback/detection'
import type { ModelId, ModelTag } from './fidelity'
import { MODEL_TAGS, modelsUsed } from './fidelity'
import type { RequirementGateId } from './requirements'

/**
 * RUN VALIDITY. One place decides whether a run can carry evidence at all,
 * so the toolbar chip, the requirement gates, and the exported record can
 * never disagree.
 *
 * The rule is the T&E rule, not a scoring rule: a result the run cannot
 * support is NOT a pass and NOT a fail. It is not evaluated. An
 * 'invalidating' finding removes the named tracks from the gates it lists,
 * because the measurement was never made. A 'limiting' finding leaves the
 * measurement standing but attaches the caveat that qualifies it.
 *
 * Pure TS: no store, no DOM, no caching. Derived live from the scenario and
 * the assessment sweep, never stored on the scenario.
 */

/** Stable finding kinds. One finding per kind per run; tracks list in uasIds. */
type RunValidityFindingId =
  | 'spawn-in-ring'
  | 'no-defended-asset'
  | 'environment-not-applied'
  | 'threat-without-path'
  | 'planning-envelope'
  | 'unvalidated-model'
  | 'forecast-trial-disagreement'

/**
 * 'invalidating' = the listed gates cannot be scored for the listed tracks.
 * 'limiting' = the listed gates are still scored, but they carry the caveat.
 */
type RunValiditySeverity = 'invalidating' | 'limiting'

/** One reason a run cannot carry the evidence it looks like it carries. */
export interface RunValidityFinding {
  /** Stable kind id. Safe as a React key and as an export field. */
  id: RunValidityFindingId
  severity: RunValiditySeverity
  /** Affected tracks. Empty when the finding is scenario-wide. */
  uasIds: string[]
  /**
   * Requirement gates this finding bears on. An 'invalidating' finding
   * INVALIDATES these gates for the tracks in uasIds; a 'limiting' finding
   * adds itself to these gates as a caveat.
   */
  gates: RequirementGateId[]
  /** Operator-readable statement of the problem. */
  message: string
}

export interface RunValidityAssessment {
  validity: RunValidity
  findings: RunValidityFinding[]
}

/** Completed simulated trial, compared only with the matching full-run ensemble. */
interface TrialComparison {
  assessments: ThreatAssessment[]
  kills: number
  mc: McSummary
}

function disagreementFinding(
  scenario: Scenario,
  forecast: ThreatAssessment[],
  trial: TrialComparison,
  spawn: RunValidityFinding | null,
): RunValidityFinding | null {
  const first = (rows: ThreatAssessment[]) => rows.filter(a => a.firstDetectS != null && Number.isFinite(a.firstDetectS))
    .sort((a, b) => a.firstDetectS! - b.firstDetectS!)[0]
  const predicted = first(forecast)
  const realized = first(trial.assessments)
  // Another technology may detect first; use the first radar's own retained hit.
  const radarHit = trial.assessments.flatMap(a => [
    ...(a.sensorObservations ?? []).map(o => ({ sensorId: o.sensorId, uasId: a.uasId, tS: o.firstDetectS })),
    { sensorId: a.firstDetectSensorId, uasId: a.uasId, tS: a.firstDetectS },
  ]).filter(hit => {
    const entity = scenario.entities.find(e => e.id === hit.sensorId)
    return hit.tS != null && Number.isFinite(hit.tS) && entity && modelFor(scenario, entity)?.sensor?.sensorType === 'radar'
  }).sort((a, b) => a.tS! - b.tS!)[0]
  const sensor = scenario.entities.find(e => e.id === radarHit?.sensorId)
  const target = scenario.entities.find(e => e.id === radarHit?.uasId)
  const spec = sensor && modelFor(scenario, sensor)?.sensor
  const period = spec ? scanPeriodS(spec, radarPdModeled(spec, target && modelFor(scenario, target)?.uas)) : null
  const messages: string[] = []
  if (predicted && realized && period != null && Math.abs(predicted.firstDetectS! - realized.firstDetectS!) > period) {
    messages.push(`First detect: deterministic forecast T+${predicted.firstDetectS} s; simulated trial T+${realized.firstDetectS} s. Difference exceeds one ${period} s scan period of ${sensor!.name}.`)
  }
  const i = Math.floor(trial.mc.durationS / DT)
  const lo = trial.mc.kills.lo[i]
  const hi = trial.mc.kills.hi[i]
  if (trial.mc.replicates >= 2 && Number.isFinite(trial.kills) && Number.isFinite(lo) && Number.isFinite(hi) &&
    (trial.kills < lo || trial.kills > hi)) {
    const population = Object.values(trial.mc.perThreat).reduce((sum, row) => sum + row.shipCount, 0)
    messages.push(`Kills before arrival: simulated trial ${trial.kills}/${population} members; ensemble 95 % mean band ${lo} to ${hi}/${population} members through T+${trial.mc.durationS} s.`)
  }
  if (!messages.length) return null
  if (spawn) messages.push(`Possible cause: spawn-in-ring. ${spawn.message}`)
  return { id: 'forecast-trial-disagreement', severity: 'limiting',
    uasIds: spawn?.uasIds ?? (realized ? [realized.uasId] : []), gates: [], message: messages.join(' ') }
}

/** Every gate. Used by findings that affect the whole kill chain. */
const ALL_GATES: RequirementGateId[] = ['detect', 'track', 'identify', 'target', 'engage', 'effect']

/** Gates whose measurement depends on sensor range performance. */
const SENSOR_GATES: RequirementGateId[] = ['detect', 'track', 'identify']

function nameOf(scenario: Scenario, id: string): string {
  return scenario.entities.find((e) => e.id === id)?.name ?? id
}

/** Covariates that differ from the calm standard day. Empty = standard day. */
function nonStandardCovariates(scenario: Scenario): string[] {
  const env = scenario.environment
  const out: string[] = []
  if ((env.precipitation ?? 'clear') !== 'clear') out.push(env.precipitation as string)
  if ((env.light ?? 'day') === 'night') out.push('night')
  if ((env.emBackground ?? 'rural') === 'urban') out.push('urban EM')
  if (env.windSpeedMps > 0) out.push(`wind ${env.windSpeedMps} m/s`)
  return out
}

/**
 * Threats whose flight path starts inside a sensor's effective detect ring.
 * The sensor holds the track at T0, so the run never exercises the search
 * problem and the Detect result is invalid by construction. The sweep itself
 * lives in sim.ts (spawnInRingViolations); this only groups it.
 */
function spawnInRingFinding(scenario: Scenario): RunValidityFinding | null {
  const violations = spawnInRingViolations(scenario)
  if (violations.length === 0) return null
  const sensorsByUas = new Map<string, string[]>()
  for (const v of violations) {
    const names = sensorsByUas.get(v.uasId) ?? []
    names.push(nameOf(scenario, v.sensorId))
    sensorsByUas.set(v.uasId, names)
  }
  const names = [...sensorsByUas.keys()].map((uasId) => nameOf(scenario, uasId))
  return {
    id: 'spawn-in-ring',
    severity: 'invalidating',
    uasIds: [...sensorsByUas.keys()],
    gates: ['detect'],
    message: `First detection not assessed: ${names.join(', ')} ${names.length === 1 ? 'starts' : 'start'} inside detection coverage.`,
  }
}

/**
 * Run validity and every finding behind it.
 *
 * validity is the rollup: 'invalid' when any finding invalidates a gate,
 * 'valid-limited' when only caveats apply, 'valid' when the run is clean, and
 * 'pending' when no track was assessed, because nothing has been measured
 * yet.
 */
export function assessRunValidity(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  table: Record<ModelId, ModelTag> = MODEL_TAGS,
  comparison?: TrialComparison,
): RunValidityAssessment {
  const findings: RunValidityFinding[] = []

  const spawn = spawnInRingFinding(scenario)
  if (spawn) findings.push(spawn)
  if (comparison) {
    const disagreement = disagreementFinding(scenario, assessments, comparison, spawn)
    if (disagreement) findings.push(disagreement)
  }

  const assets = scenario.entities.filter((e) => e.kind === 'asset' && entityActive(e))
  if (assets.length === 0) {
    findings.push({
      id: 'no-defended-asset',
      severity: 'limiting',
      uasIds: [],
      gates: ['detect', 'track'],
      message:
        'No defended asset is placed. Warning time, arrival and leakage are not measurable.',
    })
  }

  const covariates = nonStandardCovariates(scenario)
  if (!scenario.environment.apply && covariates.length > 0) {
    findings.push({
      id: 'environment-not-applied',
      severity: 'limiting',
      uasIds: [],
      gates: SENSOR_GATES,
      message: `Environment effects are off while these covariates are set: ${covariates.join(', ')}. Sensor ranges use calm standard-day performance.`,
    })
  }

  // A threat with no flight path never moves, so no gate can score it. The
  // sweep reports status 'no-path'; a UAS the sweep never saw counts too.
  const noPath = new Set(assessments.filter((a) => a.status === 'no-path').map((a) => a.uasId))
  const assessed = new Set(assessments.map((a) => a.uasId))
  for (const e of scenario.entities) {
    if (e.kind !== 'uas' || !entityActive(e)) continue
    if (assessed.has(e.id)) continue
    if (!scenario.paths.some((p) => p.entityId === e.id)) noPath.add(e.id)
  }
  if (noPath.size > 0) {
    const names = [...noPath].map((id) => nameOf(scenario, id))
    findings.push({
      id: 'threat-without-path',
      severity: 'limiting',
      uasIds: [...noPath],
      gates: ALL_GATES,
      message: `These threats have no flight path, so every gate excludes them: ${names.join(', ')}.`,
    })
  }

  // A deterministic run reports the threshold envelope, not an estimate, so it
  // is at best valid-limited however clean the laydown is.
  if (runSettings(scenario).runMode === 'deterministic') {
    findings.push({
      id: 'planning-envelope',
      severity: 'limiting',
      uasIds: [],
      gates: ALL_GATES,
      message: 'Point values from the threshold envelope. Run Monte Carlo for an interval.',
    })
  }

  const unvalidated = modelsUsed(scenario, table).filter((t) => t.validation === 'none')
  if (unvalidated.length > 0) {
    const labels = unvalidated.map((t) => t.label).join(', ')
    findings.push({
      id: 'unvalidated-model',
      severity: 'limiting',
      uasIds: [],
      gates: ALL_GATES,
      message: `These models are not validated: ${labels}. Their outputs are planning factors.`,
    })
  }

  const validity: RunValidity =
    assessments.length === 0
      ? 'pending'
      : findings.some((f) => f.severity === 'invalidating')
        ? 'invalid'
        : findings.length > 0
          ? 'valid-limited'
          : 'valid'
  return { validity, findings }
}

/** Track ids an invalidating finding removes from one gate's population. */
export function invalidatedTracksForGate(
  findings: RunValidityFinding[],
  gateId: RequirementGateId,
): Set<string> {
  const out = new Set<string>()
  for (const f of findings) {
    if (f.severity !== 'invalidating' || !f.gates.includes(gateId)) continue
    for (const id of f.uasIds) out.add(id)
  }
  return out
}

/** Findings that bear on one gate, in report order. */
export function findingsForGate(
  findings: RunValidityFinding[],
  gateId: RequirementGateId,
): RunValidityFinding[] {
  return findings.filter((f) => f.gates.includes(gateId))
}

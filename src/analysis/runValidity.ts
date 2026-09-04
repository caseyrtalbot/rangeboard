import type { RunValidity, Scenario } from '../model/types'
import { entityActive, runSettings } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import { spawnInRingViolations } from '../playback/sim'
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
export type RunValidityFindingId =
  | 'spawn-in-ring'
  | 'no-defended-asset'
  | 'environment-not-applied'
  | 'threat-without-path'
  | 'planning-envelope'
  | 'unvalidated-model'

/**
 * 'invalidating' = the listed gates cannot be scored for the listed tracks.
 * 'limiting' = the listed gates are still scored, but they carry the caveat.
 */
export type RunValiditySeverity = 'invalidating' | 'limiting'

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
  const lines = [...sensorsByUas.entries()].map(
    ([uasId, sensors]) => `${nameOf(scenario, uasId)} held by ${sensors.join(', ')}`,
  )
  return {
    id: 'spawn-in-ring',
    severity: 'invalidating',
    uasIds: [...sensorsByUas.keys()],
    gates: ['detect'],
    message: `Flight paths start inside a detect ring (detected at T0): ${lines.join('; ')}`,
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
): RunValidityAssessment {
  const findings: RunValidityFinding[] = []

  const spawn = spawnInRingFinding(scenario)
  if (spawn) findings.push(spawn)

  const assets = scenario.entities.filter((e) => e.kind === 'asset' && entityActive(e))
  if (assets.length === 0) {
    findings.push({
      id: 'no-defended-asset',
      severity: 'limiting',
      uasIds: [],
      gates: ['detect', 'track'],
      message:
        'No defended asset is placed. Warning time is not measurable, and no track has an arrival time.',
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

import type { EffectorSpec, Entity, FireDoctrine, SensorRole, SensorSpec } from '../model/types'
import { defaultSensorRole } from '../model/types'

/**
 * Per-system doctrine planning factors. The scenario-level FireDoctrine
 * numbers are ONE dial for the whole laydown; real systems differ, so with
 * doctrine enabled the engine derives each system's factors here instead:
 * spec override first, then the role/type table, then the scenario value as
 * the last-resort fallback. All values are planning factors, not measured
 * performance.
 *
 * Sources of variation the tables encode:
 *   TRACK INITIATION scales with revisit rate. A dedicated fire-control or
 *   staring track radar confirms a track in a couple of hits; a rotating
 *   early-warning search radar needs several full scan revolutions.
 *   BDA depends on how the kill is observed. A laser operator watches the
 *   burn-through in the same optic (seconds); an interceptor kill is
 *   confirmed by watching the track drop; a net capture needs the capture
 *   aircraft to report before anyone re-engages.
 *   COMMIT PK follows cost per shot. A cheap, fast-recycling shot (DE, gun)
 *   is worth taking early at modest Pk; a counted interceptor holds for a
 *   quality firing solution.
 */

/** Continuous hold needed to initiate a stable track file, by sensor role, s. */
export const TRACK_INIT_S: Record<SensorRole, number> = {
  'fire-control': 2,
  tracking: 3,
  'target-acquisition': 4,
  classification: 5,
  surveillance: 6,
  'early-warning': 8,
}

/** Battle-damage-assessment dwell after a salvo's effect, by effector type, s. */
export const BDA_S: Record<EffectorSpec['effectorType'], number> = {
  de: 3,
  hpm: 3,
  gun: 5,
  interceptor: 10,
  net: 20,
  jammer: 5,
}

/** Hold-fire commit Pk by effector type: cheap fast shots commit earlier. */
export const PK_COMMIT: Record<EffectorSpec['effectorType'], number> = {
  de: 0.2,
  hpm: 0.2,
  gun: 0.25,
  interceptor: 0.35,
  net: 0.35,
  jammer: 0,
}

/**
 * Default kill-chain edge latency by (from, to) kind, seconds, charged when
 * doctrine is enabled and the connection sets no latencyS of its own.
 * Machine-to-machine track forwarding is fast; an engage order still has a
 * human on the loop. With doctrine off, an unset latencyS stays 0 (legacy).
 */
export function defaultLinkLatencyS(fromKind: Entity['kind'], toKind: Entity['kind']): number {
  if (fromKind === 'c2' && toKind === 'effector') return 3
  if (fromKind === 'c2' && toKind === 'c2') return 2
  return 2 // sensor -> c2, sensor -> effector
}

/**
 * Declaration dwell multiplier when a second phenomenology already confirms
 * the track at declaration start: correlated ID halves the operator's
 * decision time. Single-source ID pays the full dwell.
 */
export const CONFIRMED_DECLARE_FACTOR = 0.5

/** Track initiation time for one sensor: spec override, role table, fallback. */
export function trackInitSFor(spec: SensorSpec, doctrine: FireDoctrine): number {
  return spec.trackInitS ?? TRACK_INIT_S[defaultSensorRole(spec)] ?? doctrine.trackFirmS
}

/** BDA dwell for one effector: spec override, type table, fallback. */
export function bdaSFor(spec: EffectorSpec, doctrine: FireDoctrine): number {
  return spec.bdaS ?? BDA_S[spec.effectorType] ?? doctrine.bdaS
}

/** Commit Pk for one effector: spec override, type table, fallback. */
export function commitPkFor(spec: EffectorSpec, doctrine: FireDoctrine): number {
  return spec.commitPk ?? PK_COMMIT[spec.effectorType] ?? doctrine.pkCommit
}

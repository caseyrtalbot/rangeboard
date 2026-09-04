import type { RequirementThresholds } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS } from '../model/types'

/**
 * The engine's three probabilistic outcomes, resolved by one policy per run.
 * The deterministic policy keeps the expected-value arithmetic; the Monte
 * Carlo policy draws each outcome from a seeded stream. The id and time
 * arguments are unused by both (reserved for a correlated policy).
 */
export interface DrawPolicy {
  /** Radar scan outcome. Deterministic: pd >= pdDetect. MC: rng() < pd. */
  detect(pd: number, sensorId: string, uasId: string, tS: number): boolean
  /** Salvo outcome. Deterministic: returns pk as mass. MC: 0 or 1. */
  kill(pk: number, effectorId: string, uasId: string, shipIdx: number, tS: number): number
  /** Jam dwell outcome, same shape. */
  jam(p: number, effectorId: string, uasId: string, tS: number): number
}

/**
 * Single-scan Pd a radar contact must reach to count as DETECT: the test's
 * threshold, never an engine constant.
 */
function pdDetectOf(thresholds: RequirementThresholds): number {
  const pd = thresholds.pdDetect
  // A saved 0 would detect every admitted member out to the instrumented cap.
  return pd > 0 && pd < 1 ? pd : DEFAULT_REQUIREMENT_THRESHOLDS.pdDetect
}

/** Expected-value policy: a threshold test for detection, probability mass for kill and jam. */
export function deterministicPolicy(thresholds: RequirementThresholds): DrawPolicy {
  const pdDetect = pdDetectOf(thresholds)
  return {
    detect: (pd) => pd >= pdDetect,
    kill: (pk) => pk,
    jam: (p) => p,
  }
}

/** Replicate policy: one rng() call per draw, in engine order; outcomes are 0 or 1. */
export function monteCarloPolicy(
  rng: () => number,
  _thresholds: RequirementThresholds,
): DrawPolicy {
  return {
    detect: (pd) => rng() < pd,
    kill: (pk) => (rng() < pk ? 1 : 0),
    jam: (p) => (rng() < p ? 1 : 0),
  }
}

import type { RequirementThresholds } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS } from '../model/types'
import { hashU01, idHash } from '../geometry/prng'
import { stepIndex } from './sim'

/** Draw kinds, one integer per engine draw point. */
export const DRAW_KIND = { detect: 1, kill: 2, jam: 3, phase: 4, param: 5 } as const
export type DrawKind = keyof typeof DRAW_KIND

/**
 * The engine's five probabilistic outcomes, resolved by one policy per run.
 * The deterministic policy keeps the expected-value arithmetic; the Monte
 * Carlo policy draws each outcome from a counter key built from the id, time
 * and index arguments, so the same draw point gives the same value whatever
 * else the run does (common random numbers across laydowns).
 */
export interface DrawPolicy {
  /**
   * Radar scan outcome for one admitted member (memberIdx: its index in the
   * admitted list, nearest first). Deterministic: pd >= pdDetect. MC: u < pd.
   */
  detect(pd: number, sensorId: string, uasId: string, tS: number, memberIdx: number): boolean
  /**
   * Salvo outcome. salvoIdx: salvos this effector committed at this ship
   * before this one, every channel together: the kill draw key.
   * Deterministic: returns pk as mass. MC: 0 or 1. tS is unused by both.
   */
  kill(
    pk: number,
    effectorId: string,
    uasId: string,
    shipIdx: number,
    salvoIdx: number,
    tS: number,
  ): number
  /** Jam dwell outcome, same shape, keyed by the effect step. */
  jam(p: number, effectorId: string, uasId: string, tS: number): number
  /** Scan phase as a fraction of the period, in [0, 1). Deterministic: 0. MC: one uniform. */
  phase(sensorId: string): number
  /** Parameter sample for one uncertain field, a uniform in [0, 1). Deterministic: 0.5. */
  param(modelId: string, field: string): number
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
    phase: () => 0,
    param: () => 0.5,
  }
}

/**
 * Counter-based replicate policy. No stream: every draw is a pure function
 * of its key (seed, replicate, kind, the ids, the indices, the step), so a
 * draw point reads the same uniform in every laydown that reaches it, and
 * replicate i depends on i only. Outcomes are 0 or 1.
 */
export function monteCarloPolicy(
  seed: number,
  replicate: number,
  _thresholds: RequirementThresholds,
): DrawPolicy {
  const hashes = new Map<string, number>()
  const h = (id: string): number => {
    let v = hashes.get(id)
    if (v === undefined) {
      v = idHash(id)
      hashes.set(id, v)
    }
    return v
  }
  const u = (kind: number, a: string, b: number, c: number, d: number) =>
    hashU01(seed, replicate, kind, h(a), b, c, d)
  return {
    detect: (pd, sensorId, uasId, tS, memberIdx) =>
      u(DRAW_KIND.detect, sensorId, h(uasId), memberIdx, stepIndex(tS)) < pd,
    kill: (pk, effectorId, uasId, shipIdx, salvoIdx) =>
      u(DRAW_KIND.kill, effectorId, h(uasId), shipIdx, salvoIdx) < pk ? 1 : 0,
    jam: (p, effectorId, uasId, tS) =>
      u(DRAW_KIND.jam, effectorId, h(uasId), 0, stepIndex(tS)) < p ? 1 : 0,
    phase: (sensorId) => u(DRAW_KIND.phase, sensorId, 0, 0, 0),
    param: (modelId, field) => u(DRAW_KIND.param, modelId, h(field), 0, 0),
  }
}

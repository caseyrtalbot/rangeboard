/**
 * Parameter draws per replicate: the loop end every runner agrees on, and
 * the Latin hypercube layout of the `param` draw under `sampling: 'lhs'`.
 * Replicate i takes, per uncertain field, stratum `perm(i)` of N strata,
 * where `perm` is a keyed bijection on [0, N) that depends only on (seed,
 * modelId, field, N), and its position in the stratum is the keyed `param`
 * draw. So replicate i is a pure function of (seed, i, N): a pool worker
 * on indices 500..524 and the Node runner draw what the single worker draws,
 * and two scenarios with one seed and N share their draws (common random
 * numbers). `'independent'` keeps the raw `param` draw.
 */
import type { McSettings } from '../model/types'
import { hashU01, idHash } from '../geometry/prng'
import type { ParamSampler } from '../analysis/uncertainty'
import type { DrawPolicy } from './policy'

/**
 * The replicate the loop ends at without a stop: `stopCap` under a
 * half-width target, else `replicates`. The count of Latin hypercube strata.
 */
export function loopEnd(settings: McSettings): number {
  return settings.targetHalfWidth != null ? settings.stopCap : settings.replicates
}

/** The draw kind of the stratum shuffle; the policy's kinds are 1 to 5 and 7 to 10 (policy.ts DRAW_KIND). */
const LHS_KIND = 6

/**
 * The stratum permutation of one field: a Fisher-Yates shuffle of [0, n)
 * whose swaps read keyed uniforms, so the same (seed, modelId, field, n)
 * gives the same bijection on any thread. O(n) once per field per loop.
 */
export function lhsPermutation(seed: number, modelId: string, field: string, n: number): number[] {
  const perm = Array.from({ length: n }, (_, i) => i)
  const model = idHash(modelId)
  const key = idHash(field)
  for (let j = n - 1; j > 0; j -= 1) {
    const r = Math.floor(hashU01(seed, n, LHS_KIND, model, key, j, 0) * (j + 1))
    const t = perm[j]
    perm[j] = perm[r]
    perm[r] = t
  }
  return perm
}

/**
 * The parameter sampler of each replicate under `settings`, over `n`
 * strata (the loop end). Under `'lhs'` the field's stratum comes from
 * `lhsPermutation`, cached per field for the life of the loop, and the
 * position inside it from `policy.param`; a replicate index at or over `n`
 * has no stratum and throws. Under `'independent'` the sampler is
 * `policy.param` itself.
 */
export function paramDraws(
  settings: McSettings,
  n: number,
): (policy: DrawPolicy, replicate: number) => ParamSampler {
  if (settings.sampling !== 'lhs') return (policy) => (m, f) => policy.param(m, f)
  const { seed } = settings
  const strata = new Map<string, number[]>()
  const permOf = (modelId: string, field: string): number[] => {
    const key = `${modelId} ${field}`
    let perm = strata.get(key)
    if (!perm) {
      perm = lhsPermutation(seed, modelId, field, n)
      strata.set(key, perm)
    }
    return perm
  }
  return (policy, replicate) => {
    if (replicate >= n) {
      throw new Error(`Replicate ${replicate} is outside the ${n} Latin hypercube strata`)
    }
    return (m, f) => (permOf(m, f)[replicate] + policy.param(m, f)) / n
  }
}

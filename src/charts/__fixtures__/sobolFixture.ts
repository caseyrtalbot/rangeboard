/**
 * One Morris screening and one Saltelli Sobol result over seed-library fields, for
 * the chart and widget tests. Every `spread` is what `spreadFor` returns: no seed
 * provenance row carries a spread, so `PF_SPREAD` answers for all six fields. Model
 * ids and field keys are real. The numbers are plausible, not measured: every total
 * index sits above its first-order index, every interval brackets its value, and
 * `engageTimeS` carries a negative first-order lower bound so the clamp path has a
 * case. `fields` is in library order and `ranking` is by the total index.
 */
import type { UncertainField } from '../../analysis/parameterBasis'
import type { BootstrapInterval, MorrisResult, SobolResult } from '../../playback/mcTypes'

const BOOTSTRAP = 200
const CONFIDENCE = 0.95

/** A bootstrap interval at the fixture's resample count and confidence. */
const ci = (value: number, lo: number, hi: number): BootstrapInterval => ({
  value,
  lo,
  hi,
  bootstrap: BOOTSTRAP,
  confidence: CONFIDENCE,
})

const detectRangeM: UncertainField = {
  modelId: 'lib-rps42',
  field: 'detectRangeM',
  spread: { kind: 'lognormal', sigmaDb: 3 },
}
const pk: UncertainField = {
  modelId: 'lib-coyote',
  field: 'pk',
  spread: { kind: 'beta', successes: 17, trials: 20, pseudo: true },
}
const engageTimeS: UncertainField = {
  modelId: 'lib-coyote',
  field: 'engageTimeS',
  spread: { kind: 'triangular', lo: -0.2, hi: 0.3 },
}
const rcsM2: UncertainField = {
  modelId: 'lib-mavic3',
  field: 'rcsM2',
  spread: { kind: 'lognormal', sigmaDb: 6 },
}
const trackInitS: UncertainField = {
  modelId: 'lib-kurfs',
  field: 'trackInitS',
  spread: { kind: 'triangular', lo: -0.3, hi: 0.5 },
}
const targetS: UncertainField = {
  modelId: 'lib-coyote',
  field: 'targetS',
  spread: { kind: 'triangular', lo: -0.3, hi: 0.5 },
}

/** The four fields Morris kept, base 256, so 256 * (4 + 2) = 1536 engine runs. */
export const SOBOL_FIXTURE: SobolResult = {
  method: 'saltelli',
  base: 256,
  evaluations: 1536,
  fields: [
    { field: pk, firstOrder: ci(0.24, 0.19, 0.3), total: ci(0.31, 0.25, 0.38) },
    { field: engageTimeS, firstOrder: ci(0.04, -0.012, 0.09), total: ci(0.09, 0.05, 0.14) },
    { field: detectRangeM, firstOrder: ci(0.3, 0.24, 0.36), total: ci(0.42, 0.35, 0.49) },
    { field: rcsM2, firstOrder: ci(0.11, 0.06, 0.16), total: ci(0.18, 0.13, 0.24) },
  ],
  ranking: [2, 0, 3, 1],
  response: 'leakers',
  seed: 4821,
}

/**
 * Ten trajectories over six fields, so 10 * (6 + 1) = 70 engine runs. `mu` is signed in
 * leakers: a longer detection range lowers the leaker count, so its mean effect is
 * negative. `kept` names the four fields the Sobol result carries.
 */
export const MORRIS_FIXTURE: MorrisResult = {
  method: 'morris',
  trajectories: 10,
  fields: [
    { field: detectRangeM, mu: -1.72, muStar: 1.84, sigma: 0.62 },
    { field: pk, mu: -1.38, muStar: 1.41, sigma: 0.44 },
    { field: trackInitS, mu: 0.11, muStar: 0.18, sigma: 0.09 },
    { field: rcsM2, mu: 0.88, muStar: 0.96, sigma: 0.51 },
    { field: targetS, mu: 0.04, muStar: 0.07, sigma: 0.03 },
    { field: engageTimeS, mu: 0.47, muStar: 0.52, sigma: 0.22 },
  ],
  ranking: [0, 1, 3, 5, 2, 4],
  kept: [0, 1, 3, 5],
  response: 'leakers',
  seed: 4821,
  evaluations: 70,
}

import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import type { Scenario } from '../model/types'
import { runSettings } from '../model/types'
import type { McPartial } from './mcRun'
import { replicateRangeLoop, runReplicates } from './mcRun'
import { monteCarloPolicy } from './policy'
import { lhsPermutation, loopEnd, paramDraws } from './sampling'

/** The JIATF-401 laydown under total uncertainty with no stop rule. */
function base(sampling: 'lhs' | 'independent', replicates = 24) {
  const s = parseAutosave(JSON.stringify(fixture))
  return { ...s, replicates, targetHalfWidth: null, uncertainty: 'total' as const, sampling }
}

/** The partial of one range, driven to its end. */
function range(scenario: Scenario, start: number, end: number): McPartial {
  const loop = replicateRangeLoop(scenario, start, end)
  let next = loop.next()
  while (!next.done) next = loop.next()
  return next.value
}

describe('loopEnd', () => {
  it('is the cap under a target and the replicate count without one', () => {
    const s = base('lhs', 24)
    expect(loopEnd(runSettings(s))).toBe(24)
    expect(loopEnd(runSettings({ ...s, targetHalfWidth: 0.5 }))).toBe(2000)
    expect(loopEnd(runSettings({ ...s, targetHalfWidth: 0.5, stopCap: 300 }))).toBe(300)
  })
})

describe('lhsPermutation', () => {
  it('is a bijection on [0, n) keyed by seed, model, field and n', () => {
    const p = lhsPermutation(4821, 'lib-kurfs', 'detectRangeM', 50)
    expect([...p].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i))
    expect(lhsPermutation(4821, 'lib-kurfs', 'detectRangeM', 50)).toEqual(p)
    expect(lhsPermutation(4822, 'lib-kurfs', 'detectRangeM', 50)).not.toEqual(p)
    expect(lhsPermutation(4821, 'lib-kurfs', 'trackInitS', 50)).not.toEqual(p)
    expect(lhsPermutation(4821, 'lib-kurfs', 'detectRangeM', 51).slice(0, 50)).not.toEqual(p)
    expect(lhsPermutation(7, 'x', 'y', 1)).toEqual([0])
  })
})

describe('paramDraws', () => {
  it('lhs puts replicate i in stratum perm(i) at the keyed position; independent keeps the raw draw', () => {
    const s = base('lhs', 20)
    const settings = runSettings(s)
    const draws = paramDraws(settings, 20)
    const perm = lhsPermutation(settings.seed, 'lib-coyote', 'pk', 20)
    const strata = new Set<number>()
    for (let i = 0; i < 20; i += 1) {
      const policy = monteCarloPolicy(settings.seed, i, s.requirements)
      const u = draws(policy, i)('lib-coyote', 'pk') as number
      expect(u).toBe((perm[i] + policy.param('lib-coyote', 'pk')) / 20)
      strata.add(Math.floor(u * 20))
    }
    // Every stratum is used exactly once.
    expect(strata.size).toBe(20)
    expect(() => draws(monteCarloPolicy(settings.seed, 20, s.requirements), 20)).toThrow(/strata/)
    const raw = paramDraws(runSettings(base('independent', 20)), 20)
    const p3 = monteCarloPolicy(settings.seed, 3, s.requirements)
    expect(raw(p3, 3)('lib-coyote', 'pk')).toBe(p3.param('lib-coyote', 'pk'))
  })
})

describe('the range loop under lhs', () => {
  it('a slice of the range loop equals the same slice of the full loop', () => {
    const s = base('lhs', 24)
    const full = range(s, 0, 24)
    const slice = range(s, 9, 17)
    expect(slice.indices).toEqual([9, 10, 11, 12, 13, 14, 15, 16])
    expect(slice.leakers).toEqual(full.leakers.slice(9, 17))
    expect(slice.kills).toEqual(full.kills.slice(9, 17))
    expect(slice.raidFirstDetect).toEqual(full.raidFirstDetect.slice(9, 17))
    slice.threatIds.forEach((_, t) => {
      expect(slice.threatKilled[t]).toEqual(full.threatKilled[t].slice(9, 17))
    })
    // The strata count is the loop end, not the range: 24 here, and 24 under a
    // target with cap 24 (the floor must sit under the cap or both reset).
    const capped = range({ ...s, targetHalfWidth: 0.5, stopFloor: 10, stopCap: 24 }, 9, 17)
    expect(capped.leakers).toEqual(slice.leakers)
    expect(capped.raidFirstDetect).toEqual(slice.raidFirstDetect)
    // A cap of 25 is another layout: the strata move.
    const other = range({ ...s, targetHalfWidth: 0.5, stopFloor: 10, stopCap: 25 }, 9, 17)
    expect(other.raidFirstDetect).not.toEqual(slice.raidFirstDetect)
  })

  it('lhs and independent give different draws under total and the same aleatory run', () => {
    const lhs = runReplicates(base('lhs', 24))
    const raw = runReplicates(base('independent', 24))
    expect(JSON.stringify(lhs)).not.toBe(JSON.stringify(raw))
    const aleatory = (sampling: 'lhs' | 'independent') =>
      runReplicates({ ...base(sampling, 24), uncertainty: 'aleatory' })
    expect(JSON.stringify(aleatory('lhs'))).toBe(JSON.stringify(aleatory('independent')))
  })
})

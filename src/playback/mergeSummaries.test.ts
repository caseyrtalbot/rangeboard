import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import type { McPartial, McSummary, UncertaintyMode } from '../engine'
import { finishSummary, replicateRangeLoop, runReplicates } from './mcRun'
import { contiguousPrefix, mergePartials } from './mergeSummaries'

/**
 * Merged ranges of the JIATF-401 laydown (sensitivity.parity.test.ts) give
 * the summary of the sequential loop over the same indices: replicate i is a
 * pure function of i, and the merge orders rows by index.
 */
function base(uncertainty: UncertaintyMode) {
  const s = parseAutosave(JSON.stringify(fixture))
  return { ...s, replicates: 20, targetHalfWidth: null, uncertainty }
}

/** The partial of one range, driven to its end. */
function range(scenario: ReturnType<typeof base>, start: number, end: number): McPartial {
  const loop = replicateRangeLoop(scenario, start, end)
  let next = loop.next()
  while (!next.done) next = loop.next()
  return next.value
}

/** The summary less the wall time the loop measured. */
function timeless(summary: McSummary): Omit<McSummary, 'elapsedMs'> {
  const { elapsedMs: _elapsedMs, ...rest } = summary
  return rest
}

describe('mergePartials', () => {
  it.each(['aleatory', 'total'] as const)(
    'two ranges in either order finish to the sequential summary (%s)',
    (uncertainty) => {
      const scenario = base(uncertainty)
      const whole = runReplicates(scenario)
      expect(whole.stopped).toEqual({ rule: 'replicates', at: 20 })
      const lo = range(scenario, 0, 10)
      const hi = range(scenario, 10, 20)
      expect(lo.indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect(hi.indices).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
      for (const parts of [[lo, hi], [hi, lo]]) {
        const merged = mergePartials(parts)
        expect(merged.indices).toEqual(range(scenario, 0, 20).indices)
        const summary = finishSummary(scenario, merged, whole.stopped, 0)
        expect(summary.replicates).toBe(20)
        expect(timeless(summary)).toEqual(timeless(whole))
      }
    },
  )

  it('uneven ranges merge the same as the whole range', () => {
    const scenario = base('total')
    const whole = range(scenario, 0, 20)
    const merged = mergePartials([range(scenario, 7, 20), range(scenario, 0, 7)])
    const { elapsedMs: _a, ...wholeRows } = whole
    const { elapsedMs: _b, ...mergedRows } = merged
    expect(mergedRows).toEqual(wholeRows)
    expect(timeless(finishSummary(scenario, merged, { rule: 'replicates', at: 20 }, 0)))
      .toEqual(timeless(finishSummary(scenario, whole, { rule: 'replicates', at: 20 }, 0)))
  })

  it('a partial survives structuredClone and a merge of one partial is itself', () => {
    const scenario = base('aleatory')
    const part = range(scenario, 3, 8)
    expect(mergePartials([structuredClone(part)])).toEqual(part)
    expect(mergePartials([part, range(scenario, 8, 8)])).toEqual(part)
  })

  it('a duplicate index throws, as does an empty list', () => {
    const scenario = base('aleatory')
    expect(() => mergePartials([range(scenario, 0, 5), range(scenario, 4, 8)]))
      .toThrow(/replicate 4 is present twice/)
    expect(() => mergePartials([])).toThrow(/at least one partial/)
  })
})

describe('contiguousPrefix', () => {
  it('drops the rows past the first gap and keeps a gapless partial as it is', () => {
    const scenario = base('aleatory')
    const whole = range(scenario, 0, 20)
    expect(contiguousPrefix(whole)).toBe(whole)
    expect(contiguousPrefix(mergePartials([range(scenario, 0, 0)]))).toEqual(mergePartials([range(scenario, 0, 0)]))
    // A pool that stops at 7 with a chunk in flight at 12 keeps 0..6 only.
    const gapped = mergePartials([range(scenario, 0, 7), range(scenario, 12, 15)])
    const prefix = contiguousPrefix(gapped)
    expect(prefix.indices).toEqual([0, 1, 2, 3, 4, 5, 6])
    const { retained: _r, elapsedMs: _e, ...prefixRows } = prefix
    const { retained: _r2, elapsedMs: _e2, ...sevenRows } = range(scenario, 0, 7)
    expect(prefixRows).toEqual(sevenRows)
    // The summary of the prefix is the summary of the sequential run of 0..6.
    const stopped = { rule: 'halfWidth' as const, at: 7 }
    expect(timeless(finishSummary(scenario, prefix, stopped, 0)))
      .toEqual(timeless(finishSummary(scenario, range(scenario, 0, 7), stopped, 0)))
  })

  it('a partial that starts past zero has an empty prefix', () => {
    const scenario = base('aleatory')
    const late = contiguousPrefix(range(scenario, 3, 8))
    expect(late.indices).toEqual([])
    expect(late.leakers).toEqual([])
    expect(late.threatKilled.every((row) => row.length === 0)).toBe(true)
    // The track and effector lists survive: they are geometry, not replicate rows.
    expect(late.threatIds).toEqual(range(scenario, 3, 8).threatIds)
    expect(late.effectorIds).toEqual(range(scenario, 3, 8).effectorIds)
  })
})

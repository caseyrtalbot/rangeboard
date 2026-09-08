import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import { runReplicates, SENSITIVITY_RESPONSES, sensitivityLoop } from './mcRun'

/**
 * Fixed-ID numerical parity for the sensitivity loop on the captured JIATF-401
 * firing laydown (Giraffe 1X, KuRFS, FAAD C2, Coyote; Mavic 3 spawned 18 km
 * north), seed 4821, 30 replicates. Every number below was captured from the
 * loop before S4 (multi-response rows) and must not move: an engine slice
 * changes what is recorded, never what is computed for an existing path.
 * Keys are `${modelId}.${field}`; values are [swing, se] on the end-of-run
 * leaker mean, in the row order the summary reports.
 */
const EXPECTED: Array<[string, number, number]> = [
  ['lib-coyote.pk', 0.1, 0.055708601453115555],
  ['lib-kurfs.detectRangeM', 0.03333333333333333, 0.03333333333333332],
  ['lib-mavic3.rcsM2', 0.03333333333333333, 0.03333333333333332],
  ['lib-kurfs.trackInitS', 0, 0],
  ['lib-giraffe1x.detectRangeM', 0, 0],
  ['lib-giraffe1x.trackInitS', 0, 0],
  ['lib-coyote.engageTimeS', 0, 0],
  ['lib-coyote.targetS', 0, 0],
  ['lib-coyote.bdaS', 0, 0],
  ['con-mtnvzhmr-27.latencyS', 0, 0],
  ['con-mtnvzhmr-28.latencyS', 0, 0],
  ['con-mtnvzhmx-2a.latencyS', 0, 0],
  ['doctrine.declareHostileS', 0, 0],
]

describe('sensitivityLoop parity on the JIATF-401 laydown', () => {
  // The full loop runs 27 replicate sets of 30; shared CI took about 3 s.
  it('keeps the leaker swing and paired se of every field', () => {
    const s = parseAutosave(JSON.stringify(fixture))
    expect(s.seed).toBe(4821)
    expect(s.replicates).toBe(30)
    const loop = sensitivityLoop(s)
    let next = loop.next()
    while (!next.done) next = loop.next()
    const summary = next.value
    expect(summary.stat).toBe('leakers')
    expect(summary.seed).toBe(4821)
    expect(summary.replicates).toBe(30)
    expect('stopped' in summary).toBe(false)
    expect(summary.nominal).toBe(0.03333333333333333)
    const rows = summary.rows.map((r) => [`${r.modelId}.${r.field}`, r.swing, r.se])
    expect(rows).toEqual(EXPECTED)
    // S4: every row carries the five responses; the headline fields alias leakers.
    for (const r of summary.rows) {
      expect(Object.keys(r.responses!)).toEqual([...SENSITIVITY_RESPONSES])
      expect(r.responses!.leakers).toMatchObject({ lo: r.low, hi: r.high, swing: r.swing, se: r.se })
      for (const key of SENSITIVITY_RESPONSES) {
        const stat = r.responses![key]
        expect(stat.swing).toBe(Math.abs(stat.hi - stat.lo))
        expect(stat.defined.lo).toEqual({ p: 1, lo: expect.any(Number), hi: 1 })
      }
    }
    // A field that moves nothing runs the nominal scenario on both sides, so
    // its responses are the scalars replicateLoop records for the same base.
    const base = { ...s, uncertainty: 'aleatory' as const, targetHalfWidth: null }
    const mc = runReplicates(base)
    const salvos = Object.values(mc.perEffector).reduce((sum, e) => sum + e.salvos.mean, 0)
    const still = summary.rows.filter((r) => r.swing === 0)
    expect(still.length).toBeGreaterThan(0)
    for (const r of still) {
      expect(r.responses!.leakers.lo).toBe(mc.leakers.mean.at(-1))
      expect(r.responses!.kills.lo).toBe(mc.kills.mean.at(-1))
      expect(r.responses!.firstDetectS.lo).toBe(mc.firstDetectS.mean)
      expect(r.responses!.minWarningS.lo).toBe(mc.minWarningS.mean)
      expect(r.responses!.salvos.lo).toBeCloseTo(salvos, 12)
    }
  }, 30000)
})

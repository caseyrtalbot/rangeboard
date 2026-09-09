import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import { wilson } from '../analysis/stats'
import { runSensitivity } from './mcRun'

/**
 * The JIATF-401 firing laydown with every sensor removed: no replicate
 * detects, so the time responses are undefined on both sides of every field
 * and keep their definedness, while the counts still read.
 */
describe('sensitivity responses with no detection', () => {
  it('an undefined time keeps its definedness statistic', () => {
    const s = parseAutosave(JSON.stringify(fixture))
    const sensorIds = new Set(s.entities.filter((e) => e.kind === 'sensor').map((e) => e.id))
    expect(sensorIds.size).toBeGreaterThan(0)
    s.entities = s.entities.filter((e) => !sensorIds.has(e.id))
    s.connections = s.connections.filter((c) => !sensorIds.has(c.fromId) && !sensorIds.has(c.toId))
    const summary = runSensitivity(s)
    expect(summary.rows.length).toBeGreaterThan(0)
    const none = wilson(0, summary.replicates)
    for (const r of summary.rows) {
      for (const key of ['firstDetectS', 'minWarningS'] as const) {
        const stat = r.responses![key]
        expect(Number.isNaN(stat.lo)).toBe(true)
        expect(Number.isNaN(stat.hi)).toBe(true)
        expect(Number.isNaN(stat.swing)).toBe(true)
        expect(Number.isNaN(stat.se)).toBe(true)
        expect(stat.defined.lo).toEqual({ p: none.p, lo: none.lo, hi: none.hi })
        expect(stat.defined.hi).toEqual(stat.defined.lo)
      }
      // Nothing fires: every ship leaks on both sides.
      expect(r.responses!.salvos).toMatchObject({ lo: 0, hi: 0, swing: 0, se: 0 })
      expect(r.responses!.kills).toMatchObject({ lo: 0, hi: 0, swing: 0, se: 0 })
      expect(r.responses!.leakers.lo).toBe(summary.nominal)
      expect(r.responses!.leakers.defined.lo.p).toBe(1)
      expect(r.swing).toBe(0)
    }
  })
})

import { describe, expect, it } from 'vitest'
import type { RunTimelineRow } from '../../analysis/runTimeline'
import { foldThreats, GROUP_AT } from './fold'

function threat(id: string, label: string): RunTimelineRow {
  return {
    key: `threat:${id}`,
    kind: 'threat',
    label,
    meta: '',
    entityId: id,
    spans: [],
    marks: [],
  }
}

describe('foldThreats', () => {
  it('keeps every row plain at GROUP_AT rows or fewer', () => {
    const rows = Array.from({ length: GROUP_AT }, (_, i) => threat(`s${i}`, `Shahed ${i + 1}`))
    const entries = foldThreats(rows)
    expect(entries).toHaveLength(GROUP_AT)
    entries.forEach((entry, i) => expect(entry).toEqual({ t: 'row', row: rows[i] }))
    expect(entries.every((entry, i) => entry.t === 'row' && entry.row === rows[i])).toBe(true)
  })

  it('folds same-named threats past GROUP_AT and keeps a single base plain', () => {
    const shahed = Array.from({ length: 12 }, (_, i) => threat(`s${i}`, `Shahed ${i + 1}`))
    const lancet = [threat('l1', 'Lancet 1'), threat('l2', 'Lancet 2')]
    const orlan = threat('o', 'Orlan 3')
    const rows = [lancet[0], ...shahed.slice(0, 6), orlan, ...shahed.slice(6), lancet[1]]
    const before = [...rows]
    const entries = foldThreats(rows)
    expect(entries.map((e) => (e.t === 'fold' ? e.key : e.row.key))).toEqual([
      'fold:Lancet',
      'fold:Shahed',
      'threat:o',
    ])
    const [lancetFold, shahedFold] = entries
    expect(lancetFold).toMatchObject({ t: 'fold', label: 'Lancet ×2' })
    expect(shahedFold).toMatchObject({ t: 'fold', label: 'Shahed ×12' })
    // Members are the model's row objects in model order, never copies.
    if (shahedFold.t !== 'fold' || lancetFold.t !== 'fold') throw new Error('expected folds')
    expect(shahedFold.rows.every((row, i) => row === shahed[i])).toBe(true)
    expect(lancetFold.rows[1]).toBe(lancet[1])
    expect(rows).toEqual(before)
    expect(rows.every((row, i) => row === before[i])).toBe(true)
  })
})

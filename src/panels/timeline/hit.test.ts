import { describe, expect, it } from 'vitest'
import type { RunTimelineGroup, RunTimelineRow } from '../../analysis/runTimeline'
import { hitAt, lineAt, MARK_HIT_PX } from './hit'
import type { Placed } from './layout'

const gun: RunTimelineRow = {
  key: 'effector:gun',
  kind: 'effector',
  label: 'Gun',
  meta: '',
  entityId: 'gun',
  spans: [
    { kind: 'prep', startS: 30, endS: 40 },
    { kind: 'burst', startS: 40, endS: 52 },
  ],
  marks: [
    { kind: 'release', tS: 40, after: '3 left' },
    { kind: 'miss', tS: 52, after: 'pk 0.30' },
  ],
}
const jammer: RunTimelineRow = {
  ...gun,
  key: 'effector:jam',
  label: 'Jammer',
  entityId: 'jam',
  spans: [{ kind: 'dwell', startS: 45, endS: 90 }],
  marks: [{ kind: 'release', tS: 45 }],
}
const group: RunTimelineGroup = { key: 'effector', side: 'blue', label: 'Effectors', rows: [] }

const lines: Placed[] = [
  { t: 'group', key: 'group:effector', group, open: false, shown: 2, y: 0, h: 18 },
  { t: 'summary', key: 'summary:effector', group, rows: [gun, jammer], y: 18, h: 18 },
  { t: 'row', key: gun.key, row: gun, open: false, inFold: false, y: 36, h: 18 },
]

describe('lineAt', () => {
  it('finds the line that contains y, top inclusive and bottom exclusive', () => {
    expect(lineAt(lines, 0)?.key).toBe('group:effector')
    expect(lineAt(lines, 17.9)?.key).toBe('group:effector')
    expect(lineAt(lines, 18)?.key).toBe('summary:effector')
    expect(lineAt(lines, 53.9)?.key).toBe(gun.key)
    expect(lineAt(lines, 54)).toBeNull()
    expect(lineAt(lines, -1)).toBeNull()
    expect(lineAt([], 5)).toBeNull()
  })
})

describe('hitAt', () => {
  const pxPerS = 2
  const reach = MARK_HIT_PX / pxPerS

  it('takes the nearest mark within the reach, before any span', () => {
    expect(hitAt(lines, 40 + reach, 40, pxPerS)).toEqual({
      t: 'mark',
      row: gun,
      mark: gun.marks[0],
    })
    expect(hitAt(lines, 51, 40, pxPerS)).toEqual({ t: 'mark', row: gun, mark: gun.marks[1] })
  })

  it('takes the span under the time past the mark reach', () => {
    expect(hitAt(lines, 40 + reach + 0.5, 40, pxPerS)).toEqual({
      t: 'span',
      row: gun,
      span: gun.spans[1],
    })
    expect(hitAt(lines, 31, 40, pxPerS)).toEqual({ t: 'span', row: gun, span: gun.spans[0] })
    expect(hitAt(lines, 60, 40, pxPerS)).toBeNull()
  })

  it('gives a summary line the member drawn on top', () => {
    // Both rows release within reach of 42.5; the later row wins the tie.
    expect(hitAt(lines, 42.5, 20, pxPerS)).toMatchObject({ t: 'mark', row: jammer })
    expect(hitAt(lines, 48.5, 20, pxPerS)).toEqual({
      t: 'span',
      row: jammer,
      span: jammer.spans[0],
    })
    expect(hitAt(lines, 35, 20, pxPerS)).toEqual({ t: 'span', row: gun, span: gun.spans[0] })
  })

  it('hits nothing on a group header, below the lines or at no scale', () => {
    expect(hitAt(lines, 40, 5, pxPerS)).toBeNull()
    expect(hitAt(lines, 40, 80, pxPerS)).toBeNull()
    expect(hitAt(lines, 40, 40, 0)).toBeNull()
    expect(hitAt(lines, Number.NaN, 40, pxPerS)).toBeNull()
  })
})

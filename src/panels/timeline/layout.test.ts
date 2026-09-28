import { describe, expect, it } from 'vitest'
import type { RunTimelineModel, RunTimelineRow } from '../../analysis/runTimeline'
import { lineWindow, MIN_OVERSCAN_PX, playheadX, stripLayout, type Placed } from './layout'

function row(kind: RunTimelineRow['kind'], id: string, label: string): RunTimelineRow {
  return { key: `${kind}:${id}`, kind, label, meta: '', entityId: id, spans: [], marks: [] }
}

// Sixteen threats: twelve Shahed and two Lancet share base names; two stand alone.
const shahed = Array.from({ length: 12 }, (_, i) => row('threat', `s${i + 1}`, `Shahed ${i + 1}`))
const lancet = [row('threat', 'l1', 'Lancet 1'), row('threat', 'l2', 'Lancet 2')]
const threats = [
  lancet[0],
  ...shahed.slice(0, 6),
  row('threat', 'orlan', 'Orlan'),
  ...shahed.slice(6),
  row('threat', 'gerbera', 'Gerbera'),
  lancet[1],
]
const radar: RunTimelineRow = {
  ...row('sensor', 'radar', 'Radar'),
  subLanes: [row('track', 'radar:s1', 'Shahed 1'), row('track', 'radar:s2', 'Shahed 2')],
}
const model: RunTimelineModel = {
  durationS: 600,
  horizonS: 600,
  groups: [
    { key: 'sensor', side: 'blue', label: 'Sensors', rows: [radar, row('sensor', 'eo', 'EO')] },
    { key: 'threat', side: 'red', label: 'Threats', rows: threats },
  ],
}

const CLOSED = { openGroups: [], openSensors: [], openFolds: [], hiddenRows: [] }
const keys = (lines: Placed[]) => lines.map((line) => line.key)
const find = (lines: Placed[], key: string) => lines.find((line) => line.key === key)

describe('stripLayout', () => {
  it('draws a fold row only inside an open threat group', () => {
    const closed = stripLayout(model, CLOSED)
    expect(closed.lines.some((line) => line.t === 'fold')).toBe(false)
    expect(keys(closed.lines)).toEqual([
      'group:sensor',
      'summary:sensor',
      'group:threat',
      'summary:threat',
    ])
    const open = stripLayout(model, { ...CLOSED, openGroups: ['threat'] })
    expect(keys(open.lines).slice(2)).toEqual([
      'group:threat',
      'fold:Lancet',
      'fold:Shahed',
      'threat:orlan',
      'threat:gerbera',
    ])
    expect(find(open.lines, 'fold:Shahed')).toMatchObject({ label: 'Shahed ×12', open: false })
    // Lines stack with no gap.
    open.lines.forEach((line, i) => {
      if (i > 0) expect(line.y).toBe(open.lines[i - 1].y + open.lines[i - 1].h)
    })
  })

  it('expands an open fold to its members, marked in-fold', () => {
    const { lines } = stripLayout(model, {
      ...CLOSED,
      openGroups: ['threat'],
      openFolds: ['fold:Shahed'],
    })
    const at = keys(lines).indexOf('fold:Shahed')
    const members = lines.slice(at + 1, at + 13)
    expect(keys(members)).toEqual(shahed.map((r) => r.key))
    expect(members.every((line) => line.t === 'row' && line.inFold)).toBe(true)
    expect(find(lines, 'fold:Shahed')).toMatchObject({ open: true })
    expect(find(lines, 'threat:l1')).toBeUndefined()
  })

  it('drops a hidden member from its fold, its label and its rows, and counts it', () => {
    const layout = stripLayout(model, {
      ...CLOSED,
      openGroups: ['threat'],
      openFolds: ['fold:Shahed'],
      hiddenRows: ['threat:s3'],
    })
    const fold = find(layout.lines, 'fold:Shahed')
    expect(fold).toMatchObject({ t: 'fold', label: 'Shahed ×11' })
    if (fold?.t !== 'fold') throw new Error('expected a fold')
    expect(fold.rows).toHaveLength(11)
    expect(fold.rows).not.toContain(shahed[2])
    expect(find(layout.lines, 'threat:s3')).toBeUndefined()
    expect(layout.hiddenCount).toBe(1)
  })

  it('skips a fold whose members are all hidden', () => {
    const layout = stripLayout(model, {
      ...CLOSED,
      openGroups: ['threat'],
      hiddenRows: ['threat:l1', 'threat:l2'],
    })
    expect(find(layout.lines, 'fold:Lancet')).toBeUndefined()
    expect(find(layout.lines, 'fold:Shahed')).toBeDefined()
    expect(layout.hiddenCount).toBe(2)
  })

  it('drops a hidden sensor with its sub-lanes', () => {
    const state = { ...CLOSED, openGroups: ['sensor' as const], openSensors: ['sensor:radar'] }
    const shown = stripLayout(model, state)
    expect(keys(shown.lines).slice(0, 5)).toEqual([
      'group:sensor',
      'sensor:radar',
      'track:radar:s1',
      'track:radar:s2',
      'sensor:eo',
    ])
    const hidden = stripLayout(model, { ...state, hiddenRows: ['sensor:radar'] })
    expect(keys(hidden.lines).slice(0, 2)).toEqual(['group:sensor', 'sensor:eo'])
    expect(hidden.lines.some((line) => line.t === 'sub')).toBe(false)
    expect(find(hidden.lines, 'group:sensor')).toMatchObject({ shown: 1 })
    expect(hidden.hiddenCount).toBe(1)
  })

  it('leaves a hidden row out of a collapsed group summary', () => {
    const { lines } = stripLayout(model, { ...CLOSED, hiddenRows: ['threat:orlan'] })
    const summary = find(lines, 'summary:threat')
    if (summary?.t !== 'summary') throw new Error('expected a summary')
    expect(summary.rows).toHaveLength(15)
    expect(summary.rows.some((r) => r.key === 'threat:orlan')).toBe(false)
    expect(
      summary.rows.every((r, i) => r === threats.filter((t) => t.key !== 'threat:orlan')[i]),
    ).toBe(true)
  })
})

describe('playheadX', () => {
  it('stops one pixel inside the plot at the run end and follows the clock before it', () => {
    expect(playheadX(40, 600, 5)).toBe(200)
    expect(playheadX(600, 600, 5)).toBe(2999)
    expect(playheadX(0, 600, 0)).toBe(0)
  })
})

describe('lineWindow', () => {
  // Thirty 18 px lines: 540 px.
  const lines = Array.from({ length: 30 }, (_, i) => ({
    ...stripLayout(model, CLOSED).lines[0],
    key: `l${i}`,
    y: i * 18,
    h: 18,
  })) as Placed[]

  it('takes the view plus one view height of overscan, at least the floor', () => {
    expect(MIN_OVERSCAN_PX).toBe(120)
    // 180 to 234 px; the overscan is the 120 px floor: 60 to 354 px, lines 3 to 19.
    expect(lineWindow(lines, 180, 54)).toEqual({ first: 3, last: 20 })
    // A 200 px view overscans 200 px: -20 to 580 px, every line from 0.
    expect(lineWindow(lines, 180, 200)).toEqual({ first: 0, last: 30 })
  })

  it('clamps at both ends', () => {
    expect(lineWindow(lines, 0, 36)).toEqual({ first: 0, last: 9 })
    // Scrolled to the bottom: 504 to 540 px, 384 px and down.
    expect(lineWindow(lines, 504, 36)).toEqual({ first: 21, last: 30 })
  })

  it('draws every line for an unmeasured view and none from an empty list', () => {
    expect(lineWindow(lines, 0, Infinity)).toEqual({ first: 0, last: 30 })
    expect(lineWindow([], 100, 200)).toEqual({ first: 0, last: 0 })
  })
})

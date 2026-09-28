import { beforeEach, describe, expect, it } from 'vitest'
import type { RunTimelineGroup, RunTimelineRow } from '../../analysis/runTimeline'
import { useStore } from '../../state/store'
import { installTrial } from '../analysis/trialTestState'
import type { Placed } from './layout'
import { scrollTopFor, selectedLineKeys, selectRunTimelineRow } from './useRunTimelineSelection'

function row(kind: RunTimelineRow['kind'], id: string, entityId: string | null): RunTimelineRow {
  return { key: `${kind}:${id}`, kind, label: id, meta: '', entityId, spans: [], marks: [] }
}

const radar = row('sensor', 'radar', 'radar')
const trackA = row('track', 'T1', 'orlan') // a real track carries its threat's id
const falseTrack = row('track', 'F1', null)
const orlan = row('threat', 'orlan', 'orlan')
const shahed = row('threat', 'shahed', 'shahed')
const sensors: RunTimelineGroup = { key: 'sensor', side: 'blue', label: 'Sensors', rows: [radar] }
const threats: RunTimelineGroup = {
  key: 'threat',
  side: 'red',
  label: 'Threats',
  rows: [orlan, shahed],
}

const lines: Placed[] = [
  { t: 'group', key: 'group:sensor', group: sensors, open: true, shown: 1, y: 0, h: 18 },
  { t: 'row', key: radar.key, row: radar, open: true, inFold: false, y: 18, h: 18 },
  { t: 'sub', key: trackA.key, row: trackA, y: 36, h: 14 },
  { t: 'sub', key: falseTrack.key, row: falseTrack, y: 50, h: 14 },
  { t: 'group', key: 'group:threat', group: threats, open: false, shown: 2, y: 64, h: 18 },
  { t: 'summary', key: 'summary:threat', group: threats, rows: [orlan, shahed], y: 82, h: 18 },
  { t: 'fold', key: 'fold:x', label: '2 threats', rows: [shahed], open: false, y: 100, h: 18 },
]

describe('selectedLineKeys', () => {
  it('matches a row, a sub-lane, a summary and a fold by member, never a group', () => {
    expect([...selectedLineKeys(lines, ['radar'])]).toEqual([radar.key])
    expect([...selectedLineKeys(lines, ['orlan'])]).toEqual([trackA.key, 'summary:threat'])
    expect([...selectedLineKeys(lines, ['shahed'])]).toEqual(['summary:threat', 'fold:x'])
  })

  it('returns one shared empty set for no selection, no match or a false track', () => {
    const empty = selectedLineKeys(lines, [])
    expect(empty.size).toBe(0)
    expect(selectedLineKeys(lines, ['nobody'])).toBe(empty)
    expect(selectedLineKeys([], ['radar'])).toBe(empty)
    // A false track has no entity, so no id ever reaches its line.
    expect(selectedLineKeys(lines, ['radar', 'orlan']).has(falseTrack.key)).toBe(false)
  })
})

describe('scrollTopFor', () => {
  it('scrolls to the nearest edge and not at all when the line is visible', () => {
    expect(scrollTopFor(20, 18, 100, 200)).toBe(20) // above: top edge
    expect(scrollTopFor(300, 18, 100, 200)).toBe(118) // below: bottom edge
    expect(scrollTopFor(150, 18, 100, 200)).toBeNull() // inside
    expect(scrollTopFor(100, 200, 100, 200)).toBeNull() // exactly fits
    expect(scrollTopFor(290, 18, 100, 200)).toBe(108) // partly below
  })

  it('aligns the top of a line taller than the view', () => {
    expect(scrollTopFor(400, 300, 100, 200)).toBe(400)
  })
})

describe('selectRunTimelineRow', () => {
  beforeEach(() => {
    installTrial(3)
    useStore.getState().clearSelection()
  })

  it('selects an entity row on the board', () => {
    selectRunTimelineRow(radar)
    expect(useStore.getState().selection.entityIds).toEqual(['radar'])
  })

  it('selects the threat for a track row', () => {
    selectRunTimelineRow(trackA)
    expect(useStore.getState().selection.entityIds).toEqual(['orlan'])
  })

  it('leaves the selection as it is for a false track', () => {
    selectRunTimelineRow(radar)
    const before = useStore.getState().selection
    selectRunTimelineRow(falseTrack)
    expect(useStore.getState().selection).toBe(before)
  })
})

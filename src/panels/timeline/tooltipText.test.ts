import { describe, expect, it } from 'vitest'
import type {
  RunTimelineMark,
  RunTimelineModel,
  RunTimelineRow,
  RunTimelineSpan,
} from '../../analysis/runTimeline'
import { headerText, horizonText, liveHit, tooltipText } from './tooltipText'

const row: RunTimelineRow = {
  key: 'effector:gun',
  kind: 'effector',
  label: 'Gun',
  meta: '',
  entityId: 'gun',
  spans: [],
  marks: [],
}
const mark = (m: RunTimelineMark) => tooltipText({ t: 'mark', row, mark: m }, 200)
const span = (s: RunTimelineSpan) => tooltipText({ t: 'span', row, span: s }, 200)

describe('tooltipText marks', () => {
  it.each([
    ['detect', 'Detect'],
    ['init', 'Track init'],
    ['firm', 'Firm track'],
    ['drop', 'Track dropped'],
    ['assign', 'Assignment'],
    ['release', 'Release'],
    ['shot', 'Shot'],
    ['hard-kill', 'Hard kill'],
    ['mission-kill', 'Mission kill'],
    ['miss', 'Miss'],
    ['jam-decision', 'Jam decision'],
    ['arrival', 'Arrival'],
    ['cpa', 'CPA'],
  ] as const)('titles %s as %s with its time', (kind, title) => {
    const text = mark({ kind, tS: 75.6 })
    expect(text.title).toBe(title)
    expect(text.subject).toBe('Gun')
    expect(text.data).toEqual(['T+1:15'])
    expect(text.notes).toEqual([])
  })

  it('carries the mark text and after, and no value the mark lacks', () => {
    expect(mark({ kind: 'hard-kill', tS: 90, text: 'UAS-3', after: 'pk 0.85' })).toMatchObject({
      notes: ['UAS-3'],
      data: ['T+1:30', 'pk 0.85'],
    })
    expect(mark({ kind: 'release', tS: 40, text: 'UAS-3', after: '3 left' }).data).toEqual([
      'T+0:40',
      '3 left',
    ])
    // A detect mark's text repeats the row label; it is not printed twice.
    expect(mark({ kind: 'detect', tS: 5, text: 'Gun' }).notes).toEqual([])
  })

  it('adds the word capped for a flight-capped effect, and only for one', () => {
    expect(mark({ kind: 'hard-kill', tS: 90, text: 'UAS-3', capped: true }).notes).toEqual([
      'UAS-3',
      'capped',
    ])
    expect(mark({ kind: 'hard-kill', tS: 90, text: 'UAS-3' }).notes).toEqual(['UAS-3'])
  })
})

describe('tooltipText spans', () => {
  it.each([
    ['hold', 'Hold'],
    ['coast', 'Coast'],
    ['window', 'Window'],
    ['prep', 'Preparation'],
    ['flight', 'Flight'],
    ['burst', 'Burst'],
    ['dwell', 'Dwell'],
    ['undetected', 'Undetected'],
    ['ghost', 'Ghost'],
  ] as const)('titles %s as %s with start, end and duration', (kind, title) => {
    const text = span({ kind, startS: 30, endS: 52 })
    expect(text.title).toBe(title)
    expect(text.data).toEqual(['T+0:30 to T+0:52', '22 s'])
  })

  it('titles a classify span by its band', () => {
    expect(span({ kind: 'classify', startS: 0, endS: 9, level: 'unknown' }).title).toBe('Unknown')
    expect(span({ kind: 'classify', startS: 0, endS: 9, level: 'suspected' }).title).toBe(
      'Suspected',
    )
    expect(span({ kind: 'classify', startS: 0, endS: 9, level: 'hostile' }).title).toBe('Hostile')
    // The band text is the title; no quality line.
    expect(span({ kind: 'classify', startS: 0, endS: 9, level: 'hostile' }).data).toEqual([
      'T+0:00 to T+0:09',
      '9.0 s',
    ])
  })

  it('prints a hold chunk quality to two decimals and a span label', () => {
    expect(span({ kind: 'hold', startS: 10, endS: 15, level: 0.8264 }).data).toEqual([
      'T+0:10 to T+0:15',
      '5.0 s',
      'quality 0.83',
    ])
    expect(span({ kind: 'prep', startS: 30, endS: 40, label: 'UAS-3' }).notes).toEqual(['UAS-3'])
  })
})

describe('horizonText', () => {
  it('reads the horizon, or that nothing is observed', () => {
    expect(mark({ kind: 'miss', tS: 1 }).horizon).toBe('Shown through T+3:20')
    expect(horizonText(-Infinity)).toBe('No outcomes observed yet')
  })
})

describe('headerText', () => {
  it('reads Complete at the run end once the horizon reaches it, else the horizon line', () => {
    expect(headerText(1500, 1500)).toBe('Complete · T+25:00')
    expect(headerText(1499, 1500)).toBe('Shown through T+24:59')
    expect(headerText(-Infinity, 1500)).toBe('No outcomes observed yet')
    // A run of no length is never complete.
    expect(headerText(0, 0)).toBe('Shown through T+0:00')
  })
})

describe('liveHit', () => {
  const model: RunTimelineModel = { durationS: 60, horizonS: 30, groups: [] }
  const hit = { t: 'mark', row, mark: { kind: 'detect', tS: 12 } } as const

  it('keeps the hit while its model is current', () => {
    expect(liveHit({ hit, model }, model)).toBe(hit)
  })

  it('shows nothing for a new model object, or when nothing is held', () => {
    expect(liveHit({ hit, model }, { ...model, horizonS: 32 })).toBeNull()
    expect(liveHit(null, model)).toBeNull()
  })
})

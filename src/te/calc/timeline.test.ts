/**
 * Timeline fixtures F-08, F-13, F-24, F-26, F-27 and event arithmetic
 * (MASTER-CALCULATIONS 3.2).
 */

import { describe, expect, it } from 'vitest'
import type { TeRun } from '../model/types'
import { emptyCard, emptyRun } from '../model/empty'
import { chainSegments, eventTimeS, missionMargin, segmentS } from './timeline'

function makeRun(events: Array<{ mark: string; at: string }>, startAt: string | null): TeRun {
  const run = emptyRun('run-1', emptyCard('card-1', 'TC-001'))
  run.startAt = startAt
  run.events = events.map((e, i) => ({ id: `ev-${i}`, mark: e.mark, at: e.at, note: '' }))
  return run
}

const START = '2026-08-01T10:00:00.000Z'

describe('eventTimeS', () => {
  it('measures seconds from run start to the first matching event', () => {
    const run = makeRun(
      [
        { mark: 'detect', at: '2026-08-01T10:00:30.000Z' },
        { mark: 'detect', at: '2026-08-01T10:00:45.000Z' },
      ],
      START,
    )
    expect(eventTimeS(run, 'detect')).toBe(30)
  })

  it('takes the earliest event even when logged out of order', () => {
    const run = makeRun(
      [
        { mark: 'detect', at: '2026-08-01T10:00:45.000Z' },
        { mark: 'detect', at: '2026-08-01T10:00:30.000Z' },
      ],
      START,
    )
    expect(eventTimeS(run, 'detect')).toBe(30)
  })

  it('is null without a start or a matching event', () => {
    expect(eventTimeS(makeRun([{ mark: 'detect', at: START }], null), 'detect')).toBeNull()
    expect(eventTimeS(makeRun([], START), 'detect')).toBeNull()
  })
})

describe('segmentS', () => {
  const run = makeRun(
    [
      { mark: 'detect', at: '2026-08-01T10:00:30.000Z' },
      { mark: 'track', at: '2026-08-01T10:00:42.000Z' },
      { mark: 'handoff', at: '2026-08-01T10:00:50.500Z' },
    ],
    START,
  )

  it('measures the elapsed time between two marks', () => {
    expect(segmentS(run, 'detect', 'track')).toBe(12)
    expect(segmentS(run, 'track', 'handoff')).toBe(8.5)
  })

  it('is null when either mark is absent', () => {
    expect(segmentS(run, 'detect', 'intercept')).toBeNull()
    expect(segmentS(run, 'launch', 'track')).toBeNull()
  })
})

describe('chainSegments', () => {
  it('builds consecutive pairs and keeps missing segments null', () => {
    const run = makeRun(
      [
        { mark: 'detect', at: '2026-08-01T10:00:30.000Z' },
        { mark: 'track', at: '2026-08-01T10:00:42.000Z' },
      ],
      START,
    )
    expect(chainSegments(run, ['detect', 'track', 'handoff'])).toEqual([
      { from: 'detect', to: 'track', seconds: 12 },
      { from: 'track', to: 'handoff', seconds: null },
    ])
  })
})

describe('missionMargin', () => {
  it('F-08: 42 - 36 - 4 leaves a 2 s margin, met', () => {
    const r = missionMargin(42, 36, 4)
    expect(r.margin).toBe(2)
    expect(r.verdict).toBe('met')
  })

  it('F-13: 120 - 80 - 10 leaves a 30 s margin, met', () => {
    const r = missionMargin(120, 80, 10)
    expect(r.margin).toBe(30)
    expect(r.verdict).toBe('met')
  })

  it('F-24: configuration A is -14 s, configuration B is +33 s', () => {
    const a = missionMargin(76, 80, 10)
    expect(a.margin).toBe(-14)
    expect(a.verdict).toBe('borderline')
    const b = missionMargin(123, 80, 10)
    expect(b.margin).toBe(33)
    expect(b.verdict).toBe('met')
  })

  it('F-26: faster threat leaves a 15.4 s margin', () => {
    const r = missionMargin(3690 / 35, 80, 10)
    expect(r.margin).toBeCloseTo(15.4, 1)
    expect(r.verdict).toBe('met')
  })

  it('F-27: longer engagement gives B +13 s and A -34 s', () => {
    const b = missionMargin(123, 100, 10)
    expect(b.margin).toBe(13)
    expect(b.verdict).toBe('met')
    const a = missionMargin(76, 100, 10)
    expect(a.margin).toBe(-34)
    expect(a.verdict).toBe('missed')
  })

  it('is borderline when available equals required within the band', () => {
    expect(missionMargin(40, 38, 4).verdict).toBe('borderline')
    expect(missionMargin(42, 38, 4).verdict).toBe('borderline')
    expect(missionMargin(30, 40, 4).verdict).toBe('missed')
  })
})

/**
 * Timeline fixtures F-08, F-13, F-24, F-26, F-27 and event arithmetic
 * (MASTER-CALCULATIONS).
 */

import { describe, expect, it } from 'vitest'
import type { TeRun } from '../model/types'
import { emptyCard, emptyRun } from '../model/empty'
import { eventTimeS } from './timeline'

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


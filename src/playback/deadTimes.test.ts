import { describe, expect, it } from 'vitest'
import { mixedTrial, trialEvent } from './__fixtures__/trialFixture'
import type { AttritionReport, EngagementEvent, ThreatAttrition } from './attritionReport'
import { deadRecords, deadTimeOf, expectedDeadTimes } from './deadTimes'
import { SHIP_DEAD_BELOW } from './pk'

/** A ledger over the fixture report: `rows` replace the threat rows. */
function reportOf(events: EngagementEvent[], rows?: ThreatAttrition[]): AttritionReport {
  const { result } = mixedTrial()
  const row = result.report.threats[0]
  return {
    ...result.report,
    threats: rows ?? [{ ...row, uasId: 'u', shipCount: 1 }],
    events,
  }
}

function rowOf(uasId: string, shipCount: number): ThreatAttrition {
  const { result } = mixedTrial()
  return { ...result.report.threats[0], uasId, shipCount }
}

const kill = (over: Partial<EngagementEvent>) =>
  trialEvent({ uasId: 'u', shipIdx: 0, killDelta: 1, ...over })
const jam = (over: Partial<EngagementEvent>) =>
  kill({
    softShot: true,
    effectorId: 'jammer',
    effectorType: 'jammer',
    channelClass: 'ew',
    ...over,
  })

describe('deadTimeOf', () => {
  it('kills a single ship at the effect that drops it below the cutoff', () => {
    const report = reportOf([
      kill({ tEffectS: 7, killDelta: 0 }),
      kill({ tEffectS: 10, killDelta: 1 }),
      kill({ tEffectS: 12, killDelta: 0 }),
    ])
    expect(deadTimeOf(report, 'u')).toEqual({ tS: 10, soft: false, late: false, mixed: false })
    expect(expectedDeadTimes(report)).toEqual(new Map([['u', 10]]))
  })

  it('kills a formation of 2 at the effect that kills its last ship, in effect-time order', () => {
    // Ledger order is assignment order; the later-assigned salvo lands first.
    const report = reportOf(
      [kill({ tS: 1, tEffectS: 20, shipIdx: 0 }), kill({ tS: 2, tEffectS: 10, shipIdx: 1 })],
      [rowOf('u', 2)],
    )
    expect(deadTimeOf(report, 'u')!.tS).toBe(20)
    const one = reportOf([kill({ tEffectS: 10, shipIdx: 1 })], [rowOf('u', 2)])
    expect(deadTimeOf(one, 'u')).toBeNull()
    expect(expectedDeadTimes(one).size).toBe(0)
  })

  it('keeps a formation of 21 alive through 20 removals and kills it at the 21st', () => {
    const events: EngagementEvent[] = []
    for (let ship = 0; ship < 20; ship++) events.push(kill({ tEffectS: ship + 1, shipIdx: ship }))
    const twenty = reportOf(events, [rowOf('u', 21)])
    // The old residual rule read 1 / 21 < 0.05 as dead here; the engine still fires at ship 20.
    expect(deadTimeOf(twenty, 'u')).toBeNull()
    const all = reportOf([...events, kill({ tEffectS: 30, shipIdx: 20 })], [rowOf('u', 21)])
    expect(deadTimeOf(all, 'u')!.tS).toBe(30)
  })

  it('needs survival strictly below the cutoff: 0.95 removed leaves the ship alive', () => {
    expect(SHIP_DEAD_BELOW).toBe(0.05)
    // 1 - 0.95 is 0.050000000000000044 in IEEE double, on or above the cutoff.
    expect(1 - 0.95 < SHIP_DEAD_BELOW).toBe(false)
    expect(deadTimeOf(reportOf([kill({ tEffectS: 5, killDelta: 0.95 })]), 'u')).toBeNull()
    expect(deadTimeOf(reportOf([kill({ tEffectS: 5, killDelta: 0.96 })]), 'u')!.tS).toBe(5)
  })

  it('leaves two 0.5 salvos on two different ships alive', () => {
    const report = reportOf(
      [
        kill({ tEffectS: 5, shipIdx: 0, killDelta: 0.5 }),
        kill({ tEffectS: 6, shipIdx: 1, killDelta: 0.5 }),
      ],
      [rowOf('u', 2)],
    )
    expect(deadTimeOf(report, 'u')).toBeNull()
  })

  it('leaves residuals 0.0 and 0.09 on ships 0 and 1 alive', () => {
    // The old residual rule read 0.09 / 2 < 0.05 as dead; the engine still targets ship 1.
    const report = reportOf(
      [
        kill({ tEffectS: 5, shipIdx: 0, killDelta: 1 }),
        kill({ tEffectS: 6, shipIdx: 1, killDelta: 0.91 }),
      ],
      [rowOf('u', 2)],
    )
    expect(deadTimeOf(report, 'u')).toBeNull()
  })

  it('reads soft from the latching salvo', () => {
    const report = reportOf([
      kill({ tEffectS: 5, killDelta: 0.3 }),
      jam({ tEffectS: 8, killDelta: 0.7 }),
    ])
    expect(deadTimeOf(report, 'u')).toEqual({ tS: 8, soft: true, late: false, mixed: false })
    const hardLast = reportOf([
      jam({ tEffectS: 5, killDelta: 0.7 }),
      kill({ tEffectS: 8, killDelta: 0.3 }),
    ])
    expect(deadTimeOf(hardLast, 'u')!.soft).toBe(false)
  })

  it('reads late from the latching salvo', () => {
    const report = reportOf([
      kill({ tEffectS: 5, killDelta: 0 }),
      kill({ tEffectS: 9, lateEffect: true }),
    ])
    expect(deadTimeOf(report, 'u')).toEqual({ tS: 9, soft: false, late: true, mixed: false })
  })

  it('flags a mixed defeat when the ship latches include a hard and a soft kill', () => {
    const report = reportOf(
      [kill({ tEffectS: 5, shipIdx: 0 }), jam({ tEffectS: 9, shipIdx: 1 })],
      [rowOf('u', 2)],
    )
    expect(deadTimeOf(report, 'u')).toEqual({ tS: 9, soft: true, late: false, mixed: true })
    const allSoft = reportOf(
      [jam({ tEffectS: 5, shipIdx: 0 }), jam({ tEffectS: 9, shipIdx: 1 })],
      [rowOf('u', 2)],
    )
    expect(deadTimeOf(allSoft, 'u')).toEqual({ tS: 9, soft: true, late: false, mixed: false })
  })

  it('takes the caller formation count when the threat has no row', () => {
    const report = reportOf([kill({ tEffectS: 5, shipIdx: 0 })], [])
    expect(deadTimeOf(report, 'u', 2)).toBeNull()
    expect(deadTimeOf(report, 'u', 1)!.tS).toBe(5)
    // The row wins over the caller's count.
    const rowed = reportOf([kill({ tEffectS: 5, shipIdx: 0 })], [rowOf('u', 1)])
    expect(deadTimeOf(rowed, 'u', 3)!.tS).toBe(5)
  })

  it('takes max shipIdx plus one with no row and no count', () => {
    const report = reportOf(
      [kill({ tEffectS: 5, shipIdx: 0 }), kill({ tEffectS: 6, shipIdx: 2 })],
      [],
    )
    // Ship 1 never appears in the ledger, so it lives.
    expect(deadTimeOf(report, 'u')).toBeNull()
    const full = reportOf(
      [
        kill({ tEffectS: 5, shipIdx: 0 }),
        kill({ tEffectS: 6, shipIdx: 2 }),
        kill({ tEffectS: 7, shipIdx: 1 }),
      ],
      [],
    )
    expect(deadTimeOf(full, 'u')!.tS).toBe(7)
  })

  it('is null for a threat with no events or a non-positive ship count', () => {
    const report = reportOf([], [rowOf('u', 1)])
    expect(deadTimeOf(report, 'u')).toBeNull()
    expect(deadTimeOf(report, 'unknown')).toBeNull()
    const zero = reportOf([kill({ tEffectS: 5 })], [rowOf('u', 0)])
    expect(deadTimeOf(zero, 'u')).toBeNull()
  })

  it('returns equal records on a second call from the per-report cache', () => {
    const report = reportOf(
      [kill({ tEffectS: 5, shipIdx: 0 }), jam({ tEffectS: 9, shipIdx: 1 })],
      [rowOf('u', 2)],
    )
    const first = deadTimeOf(report, 'u')
    expect(deadTimeOf(report, 'u')).toEqual(first)
    expect(deadRecords(report)).toEqual(new Map([['u', first]]))
    expect(expectedDeadTimes(report)).toEqual(expectedDeadTimes(report))
  })

  it('matches the old residual rule on the mixed fixture (whole-ship draws)', () => {
    const { result } = mixedTrial()
    // swarm: five ships, four removed (ships 1 to 4), ship 0 lives; moving: three ships, one removed.
    expect(expectedDeadTimes(result.report).size).toBe(0)
    expect(deadTimeOf(result.report, 'swarm')).toBeNull()
    expect(deadTimeOf(result.report, 'moving')).toBeNull()
  })
})

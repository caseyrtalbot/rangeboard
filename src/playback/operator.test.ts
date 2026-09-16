import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { C2Spec, Entity, Scenario } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS } from '../model/types'
import { hashU01, idHash } from '../geometry/prng'
import { stepIndex } from './clock'
import { createOperatorQueue, decisionLatencyS, firstC2Of, overloadFactor } from './operator'
import type { DrawPolicy } from './policy'
import { deterministicPolicy, DRAW_KIND, monteCarloPolicy } from './policy'
import type { ThreatAssessment } from './sim'

const T = DEFAULT_REQUIREMENT_THRESHOLDS
/** Phi(1), the standard normal cdf at one sigma. */
const PHI_1 = 0.8413447460685429

describe('decision latency', () => {
  it('reproduces the median at u 0.5 and median times 10^(sigma/10) at u Phi(1)', () => {
    expect(decisionLatencyS(8, 3, 0.5)).toBeCloseTo(8, 9)
    expect(decisionLatencyS(8, 3, PHI_1)).toBeCloseTo(8 * Math.pow(10, 0.3), 6)
    expect(decisionLatencyS(8, 3, 1 - PHI_1)).toBeCloseTo(8 / Math.pow(10, 0.3), 6)
  })

  it('a null or zero sigma is a fixed latency at the median; a null median is zero', () => {
    expect(decisionLatencyS(8, null, 0.99)).toBe(8)
    expect(decisionLatencyS(8, undefined, 0.01)).toBe(8)
    expect(decisionLatencyS(8, 0, 0.9)).toBe(8)
    expect(decisionLatencyS(0, 3, 0.9)).toBe(0)
    expect(decisionLatencyS(Number.NaN, 3, 0.9)).toBe(0)
  })

  it('a uniform of exactly 0 or 1 stays finite', () => {
    expect(Number.isFinite(decisionLatencyS(8, 3, 0))).toBe(true)
    expect(Number.isFinite(decisionLatencyS(8, 3, 1))).toBe(true)
  })
})

describe('overload', () => {
  it('scales linearly above capacity and not below it', () => {
    expect(overloadFactor(5, 10)).toBe(1)
    expect(overloadFactor(10, 10)).toBe(1)
    expect(overloadFactor(15, 10)).toBeCloseTo(1.5, 12)
    expect(overloadFactor(20, 10)).toBe(2)
    expect(overloadFactor(40, 10)).toBe(4)
  })

  it('no stated capacity never overloads', () => {
    expect(overloadFactor(100, null)).toBe(1)
    expect(overloadFactor(100, undefined)).toBe(1)
    expect(overloadFactor(100, 0)).toBe(1)
  })
})

describe('operator queue', () => {
  const C2: C2Spec = { decisionLatencyS: 6, decisionLatencySigmaDb: 3, operatorTrackCapacity: 2 }

  /** Radar -> c2 link, one c2 with the given spec (or none). */
  function fixture(c2: C2Spec | null): Scenario {
    const scenario = emptyScenario()
    const ent = (id: string, kind: Entity['kind'], specId: string | null): Entity => ({
      id,
      kind,
      specId,
      name: id,
      pos: { x: 0, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    })
    scenario.library.push({
      id: 'tst-c2',
      name: 'C2',
      description: '',
      color: '#fff',
      builtin: false,
      kind: 'c2',
      ...(c2 ? { c2 } : {}),
    })
    scenario.entities = [
      ent('radar', 'sensor', null),
      ent('c2', 'c2', 'tst-c2'),
      ent('other-c2', 'c2', 'tst-c2'),
    ]
    scenario.connections = [{ id: 'l1', fromId: 'radar', toId: 'c2', label: '' }]
    return scenario
  }

  /** A minimal assessment: tracked from firstDetectS to lastTrackS by the radar. */
  function tracked(uasId: string, firstDetectS: number, lastTrackS: number): ThreatAssessment {
    return {
      uasId,
      firstDetectS,
      detectingSensorIds: ['radar'],
      trackQuality: { heldSamples: 0, totalSamples: 0, continuity: 1, longestGapS: 0, lastTrackS },
    } as unknown as ThreatAssessment
  }

  function spy(
    base: DrawPolicy,
  ): DrawPolicy & { latencyCalls: Array<[string, string, number, number]> } {
    const p = {
      ...base,
      latencyCalls: [] as Array<[string, string, number, number]>,
      latency(c2Id: string, uasId: string, tS: number, decision: number) {
        p.latencyCalls.push([c2Id, uasId, tS, decision])
        return base.latency(c2Id, uasId, tS, decision)
      },
    }
    return p
  }

  it('no c2 spec adds zero and consumes no draw', () => {
    const policy = spy(monteCarloPolicy(1, 0, T))
    const q = createOperatorQueue(fixture(null), [tracked('u1', 0, 100)], policy)
    expect(q.active).toBe(false)
    expect(q.delayS('c2', 'u1', 10, 0)).toEqual({ extraS: 0, floored: false, decided: false })
    expect(q.loadAt('c2', 10)).toBe(0)
    expect(policy.latencyCalls).toEqual([])
    // A spec with no median is the same as no spec.
    const capacityOnly = createOperatorQueue(
      fixture({ operatorTrackCapacity: 4 }),
      [tracked('u1', 0, 100)],
      policy,
    )
    expect(capacityOnly.active).toBe(false)
    expect(capacityOnly.delayS('c2', 'u1', 10, 0)).toEqual({
      extraS: 0,
      floored: false,
      decided: false,
    })
  })

  it('the noOperatorQueue switch adds zero and consumes no draw', () => {
    const scenario = fixture(C2)
    scenario.physics = ['noOperatorQueue']
    const policy = spy(monteCarloPolicy(1, 0, T))
    const q = createOperatorQueue(scenario, [tracked('u1', 0, 100)], policy)
    expect(q.active).toBe(false)
    expect(q.delayS('c2', 'u1', 10, 0)).toEqual({ extraS: 0, floored: false, decided: false })
    expect(policy.latencyCalls).toEqual([])
  })

  it('a decision reads the kind-10 uniform keyed by (c2, uas, step) and adds the lognormal excess over the median', () => {
    const policy = spy(monteCarloPolicy(4821, 3, T))
    const q = createOperatorQueue(fixture(C2), [tracked('u1', 0, 100)], policy)
    expect(q.active).toBe(true)
    const tS = 12.5
    const u = hashU01(4821, 3, DRAW_KIND.latency, idHash('c2'), idHash('u1'), 0, stepIndex(tS))
    const u1 = hashU01(4821, 3, DRAW_KIND.latency, idHash('c2'), idHash('u1'), 1, stepIndex(tS))
    expect(u1).not.toBe(u)
    expect(DRAW_KIND.latency).toBe(10)
    // One real track at the c2 (load 1 <= capacity 2): no overload.
    expect(q.loadAt('c2', tS)).toBe(1)
    // The floor at 0 is reported: a draw under the median charges nothing and stamps the decision.
    const raw = decisionLatencyS(6, 3, u) - 6
    const raw1 = decisionLatencyS(6, 3, u1) - 6
    const first = q.delayS('c2', 'u1', tS, 0)
    expect(first.extraS).toBeCloseTo(Math.max(0, raw), 12)
    expect(first.floored).toBe(raw < 0)
    expect(first.decided).toBe(true)
    const second = q.delayS('c2', 'u1', tS, 1)
    expect(second.extraS).toBeCloseTo(Math.max(0, raw1), 12)
    expect(second.floored).toBe(raw1 < 0)
    expect(policy.latencyCalls).toEqual([
      ['c2', 'u1', tS, 0],
      ['c2', 'u1', tS, 1],
    ])
    // A c2 that is not on the map adds zero and is no decision.
    expect(q.delayS('nobody', 'u1', tS, 0)).toEqual({ extraS: 0, floored: false, decided: false })
  })

  it('the deterministic policy adds nothing at the median; overload adds (load / capacity - 1) medians', () => {
    const threats = [
      tracked('u1', 0, 100),
      tracked('u2', 0, 100),
      tracked('u3', 50, 100),
      tracked('u4', 50, 100),
    ]
    const q = createOperatorQueue(fixture(C2), threats, deterministicPolicy(T))
    // Two tracks at t 10 (capacity 2): the median, so no extra. Four at t 60: twice the median, one median extra.
    expect(q.loadAt('c2', 10)).toBe(2)
    // The median draw gives a raw excess of exactly 0, which is not a floor.
    expect(q.delayS('c2', 'u1', 10, 0)).toEqual({ extraS: 0, floored: false, decided: true })
    expect(q.loadAt('c2', 60)).toBe(4)
    expect(q.delayS('c2', 'u1', 60, 0).extraS).toBeCloseTo(6, 12)
    expect(q.delayS('c2', 'u1', 60, 0).floored).toBe(false)
    // Nothing tracked after the last held sample.
    expect(q.loadAt('c2', 101)).toBe(0)
    // The other c2 has no feeding radar: no load and no extra, but it states a median, so it decides.
    expect(q.loadAt('other-c2', 60)).toBe(0)
    expect(q.delayS('other-c2', 'u1', 60, 0)).toEqual({ extraS: 0, floored: false, decided: true })
  })

  it('a threat with no detection is not a track', () => {
    const none = {
      uasId: 'u0',
      firstDetectS: null,
      detectingSensorIds: [],
    } as unknown as ThreatAssessment
    const q = createOperatorQueue(fixture(C2), [none], deterministicPolicy(T))
    expect(q.loadAt('c2', 10)).toBe(0)
  })

  it('the C2 node of a route is its first c2, null for a direct route', () => {
    expect(firstC2Of({ viaC2Ids: ['a', 'b'] })).toBe('a')
    expect(firstC2Of({ viaC2Ids: [] })).toBeNull()
  })
})

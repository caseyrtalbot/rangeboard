import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { C2Spec, Entity, Scenario, SpecModel, Vec2 } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, MOUNT_HEIGHT_M } from '../model/types'
import { FT_TO_M } from '../analysis/sensorEnv'
import { resolveEngagements } from './attrition'
import { monteCarloPolicy } from './policy'
import { assessAllThreats, assessThreat } from './sim'

/**
 * Operator queue on the doctrine fixture (attrition.doctrine.test.ts) with a
 * C2 node between the radar and the interceptor. Deterministic policy: every
 * latency uniform is 0.5, so a decision lands on its median and the queue adds
 * nothing over the doctrine dwells; only overload adds (load / capacity - 1)
 * medians per decision (declare, assign). The target flies east at 40 m/s from x = -1210 through the
 * 1000 m ring of an interceptor at the origin: in range from t = 5.5 to 55.
 */

const RADAR: SpecModel = {
  id: 'tst-radar', name: 'test radar', kind: 'sensor', description: '', color: '#fff', builtin: false,
  sensor: {
    sensorType: 'radar', role: 'surveillance', rangeBasis: 'planning',
    detectRangeM: 50000, classifyRangeM: null, sectorDeg: 360,
  },
}

const TARGET: SpecModel = {
  id: 'tst-uas', name: 'test uas', kind: 'uas', description: '', color: '#fff', builtin: false,
  uas: {
    group: 4, airframe: 'fixed-wing', cruiseSpeedMps: 40, maxSpeedMps: 60, enduranceMin: 60,
    altBandFt: [0, 5000], navMode: 'rf-manual', emissionsNote: '',
  },
}

const INTERCEPTOR: SpecModel = {
  id: 'tst-int', name: 'test interceptor', kind: 'effector', description: '', color: '#fff', builtin: false,
  effector: { effectorType: 'interceptor', minRangeM: 0, maxRangeM: 1000, engageTimeS: 0 },
}

function c2Model(c2: C2Spec | null): SpecModel {
  return {
    id: 'tst-c2', name: 'test c2', kind: 'c2', description: '', color: '#fff', builtin: false,
    ...(c2 ? { c2 } : {}),
  }
}

const FIXTURE_ALT_FT = MOUNT_HEIGHT_M / FT_TO_M

function ent(id: string, kind: Entity['kind'], specId: string, pos: Vec2): Entity {
  return {
    id, name: id, kind, specId, pos, headingDeg: 0, color: null, notes: '',
    ...(kind === 'uas' ? { altitudeFt: FIXTURE_ALT_FT } : {}),
  }
}

/** Radar -> c2 -> interceptor, all at the origin; doctrine on or off. */
function build(c2: C2Spec | null, doctrine: boolean): Scenario {
  const scenario = emptyScenario()
  scenario.roe = 'tight'
  scenario.doctrine = {
    enabled: doctrine, trackFirmS: 5, declareHostileS: 10, targetS: 5, bdaS: 10, pkCommit: 0.35,
    opportunities: 2, launchPolicy: 'max-range', launchRangeFraction: 2 / 3,
  }
  scenario.library = [...scenario.library, RADAR, TARGET, INTERCEPTOR, c2Model(c2)]
  scenario.entities = [
    ent('radar', 'sensor', RADAR.id, { x: 0, y: 0 }),
    ent('c2', 'c2', 'tst-c2', { x: 0, y: 0 }),
    ent('int', 'effector', INTERCEPTOR.id, { x: 0, y: 0 }),
    ent('uas', 'uas', TARGET.id, { x: -1210, y: 0 }),
  ]
  scenario.connections = [
    { id: 'l1', fromId: 'radar', toId: 'c2', label: '' },
    { id: 'l2', fromId: 'c2', toId: 'int', label: '' },
  ]
  scenario.paths = [{ id: 'p', entityId: 'uas', points: [{ x: -1210, y: 0 }, { x: 3000, y: 0 }], speedMps: 40, startDelayS: 0 }]
  return scenario
}

const firstShot = (s: Scenario) => resolveEngagements(s).threats[0].firstShotS

describe('operator queue at the gates (attrition.ts)', () => {
  it('legacy path: two median decisions under capacity leave the first shot where the doctrine put it', () => {
    const base = build(null, false)
    // ROE tight: the gate is hostile ID at the first sample inside the ring (t = 5.5), no link latency.
    expect(assessThreat(base, 'uas').engageGateS).toBe(5.5)
    expect(firstShot(base)).toBe(5.5)
    const withC2 = build({ decisionLatencyS: 5, decisionLatencySigmaDb: null, operatorTrackCapacity: 10 }, false)
    expect(assessAllThreats(withC2)).toEqual(assessAllThreats(base))
    expect(firstShot(withC2)).toBe(5.5)
  })

  it('doctrine path: median decisions leave the release-ready time unchanged', () => {
    const base = build(null, true)
    // Gate 16 (doctrine fixture), 2 s + 3 s default hops, 8 s interceptor target dwell: ready at 29.
    const a = assessThreat(base, 'uas')
    expect(a.effectorGates?.[0].gateS).toBe(16)
    expect(a.effectorGates?.[0].readyS).toBe(29)
    expect(firstShot(base)).toBe(29)
    const withC2 = build({ decisionLatencyS: 4, decisionLatencySigmaDb: null }, true)
    expect(firstShot(withC2)).toBe(29)
  })

  it('overload adds (load / capacity - 1) medians per decision', () => {
    // One real track at the c2 with capacity 0.5: factor 2, so each 5 s decision adds 5 s; two decisions add 10 s.
    const withC2 = build({ decisionLatencyS: 5, decisionLatencySigmaDb: null, operatorTrackCapacity: 0.5 }, false)
    expect(firstShot(withC2)).toBeCloseTo(15.5, 9)
  })

  it('the noOperatorQueue switch restores the baseline timeline', () => {
    for (const doctrine of [false, true]) {
      const base = build(null, doctrine)
      const withC2 = build({ decisionLatencyS: 5, decisionLatencySigmaDb: 3, operatorTrackCapacity: 1 }, doctrine)
      withC2.physics = ['noOperatorQueue']
      expect(resolveEngagements(withC2)).toEqual(resolveEngagements(base))
    }
  })

  it('counts the decisions and the ones the floor at 0 caught', () => {
    // Sigma 3 dB with capacity 10 (no overload): a latency uniform under 0.5
    // draws below the median, so the raw excess is negative and the floor
    // catches that decision. Seed 4821: replicate 2 floors both decisions and
    // the shot stays at the unfloored gate, replicate 1 floors one of two, and
    // replicate 0 floors neither, so both waits are charged.
    const s = build({ decisionLatencyS: 5, decisionLatencySigmaDb: 3, operatorTrackCapacity: 10 }, false)
    const run = (i: number) =>
      resolveEngagements(s, undefined, monteCarloPolicy(4821, i, DEFAULT_REQUIREMENT_THRESHOLDS))

    const both = run(2)
    expect(both.totals.operatorDecisions).toBe(2)
    expect(both.totals.operatorFlooredDecisions).toBe(2)
    expect(both.threats[0].firstShotS).toBe(5.5)

    const one = run(1)
    expect(one.totals.operatorDecisions).toBe(2)
    expect(one.totals.operatorFlooredDecisions).toBe(1)
    expect(one.threats[0].firstShotS).toBeGreaterThan(5.5)

    const neither = run(0)
    expect(neither.totals.operatorDecisions).toBe(2)
    expect(neither.totals.operatorFlooredDecisions).toBe(0)
  })

  it('the deterministic median draw and an inactive queue count nothing floored', () => {
    // The deterministic policy draws the median: the raw excess is exactly 0,
    // which is not a floor, so the stamp stays silent on the Play timeline.
    const median = resolveEngagements(build({ decisionLatencyS: 5, decisionLatencySigmaDb: 3, operatorTrackCapacity: 10 }, false))
    expect(median.totals.operatorDecisions).toBe(2)
    expect(median.totals.operatorFlooredDecisions).toBe(0)

    // No c2 spec: the queue is inactive and takes no decision at all.
    const inactive = resolveEngagements(build(null, false))
    expect(inactive.totals.operatorDecisions).toBe(0)
    expect(inactive.totals.operatorFlooredDecisions).toBe(0)

    // The switch is the same inactive queue on a laydown that states a median.
    const off = build({ decisionLatencyS: 5, decisionLatencySigmaDb: 3, operatorTrackCapacity: 10 }, false)
    off.physics = ['noOperatorQueue']
    const switched = resolveEngagements(off, undefined, monteCarloPolicy(4821, 2, DEFAULT_REQUIREMENT_THRESHOLDS))
    expect(switched.totals.operatorDecisions).toBe(0)
    expect(switched.totals.operatorFlooredDecisions).toBe(0)
  })

  it('a route with no C2 node adds nothing', () => {
    const withC2 = build({ decisionLatencyS: 5, decisionLatencySigmaDb: null }, false)
    // Bypass the c2: radar -> interceptor direct.
    withC2.connections = [{ id: 'l3', fromId: 'radar', toId: 'int', label: '' }]
    const base = build(null, false)
    base.connections = [{ id: 'l3', fromId: 'radar', toId: 'int', label: '' }]
    expect(resolveEngagements(withC2)).toEqual(resolveEngagements(base))
  })
})

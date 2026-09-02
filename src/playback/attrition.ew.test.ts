import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type {
  Connection,
  Entity,
  FlightPath,
  Scenario,
  SpecModel,
  UasSpec,
  Vec2,
} from '../model/types'
import { defaultJamBehavior } from '../model/types'
import { resolveEngagements } from './attrition'

/**
 * EW effect asymmetry (WS2). Same controlled geometry as attrition.test.ts:
 * group 4 fixed-wing target (size penalty 1.0, no evasion), effector pk set in
 * the test, first DT-grid shot at t = 5.5 and d = 990 m, so
 * falloff = 1 - 0.3 * 0.99 = 0.703 and per-shot Pk = 0.5 * 0.703 = 0.3515.
 */

const SENSOR: SpecModel = {
  id: 'tst-radar',
  name: 'test radar',
  kind: 'sensor',
  description: '',
  color: '#fff',
  builtin: false,
  sensor: {
    sensorType: 'radar',
    role: 'surveillance',
    detectRangeM: 50000,
    classifyRangeM: null,
    sectorDeg: 360,
  },
}

/** Group 4 fixed-wing: size penalty 1.0 and no evasion penalty. */
function target(patch: Partial<UasSpec>): SpecModel {
  return {
    id: 'tst-uas',
    name: 'test uas',
    kind: 'uas',
    description: '',
    color: '#fff',
    builtin: false,
    uas: {
      group: 4,
      airframe: 'fixed-wing',
      cruiseSpeedMps: 40,
      maxSpeedMps: 60,
      enduranceMin: 60,
      altBandFt: [0, 5000],
      navMode: 'gps',
      emissionsNote: '',
      ...patch,
    },
  }
}

function effectorModel(
  id: string,
  effectorType: 'jammer' | 'interceptor',
  patch: Partial<NonNullable<SpecModel['effector']>>,
): SpecModel {
  return {
    id,
    name: id,
    kind: 'effector',
    description: '',
    color: '#fff',
    builtin: false,
    effector: {
      effectorType,
      minRangeM: 0,
      maxRangeM: 1000,
      engageTimeS: 0,
      ...patch,
    },
  }
}

let seq = 0
function ent(kind: Entity['kind'], specId: string, pos: Vec2, extra?: Partial<Entity>): Entity {
  seq += 1
  return {
    id: `${kind}-${seq}`,
    name: `${kind}-${seq}`,
    kind,
    specId,
    pos,
    headingDeg: 0,
    color: null,
    notes: '',
    ...extra,
  }
}

function link(fromId: string, toId: string): Connection {
  seq += 1
  return { id: `con-${seq}`, fromId, toId, label: '' }
}

function flight(entityId: string, points: Vec2[], speedMps = 40): FlightPath {
  seq += 1
  return { id: `path-${seq}`, entityId, points, speedMps, startDelayS: 0 }
}

/**
 * Sensor at the origin feeding every given effector (all at the origin), one
 * threat flying east through the 1000 m envelopes.
 */
function scenarioWith(
  targetModel: SpecModel,
  effectorModels: SpecModel[],
): { scenario: Scenario; effIds: string[]; uasId: string } {
  const scenario = emptyScenario()
  scenario.library = [...scenario.library, SENSOR, targetModel, ...effectorModels]
  const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
  const effs = effectorModels.map((m) => ent('effector', m.id, { x: 0, y: 0 }))
  const uas = ent('uas', targetModel.id, { x: -1210, y: 0 })
  scenario.entities = [sensor, ...effs, uas]
  scenario.connections = effs.map((e) => link(sensor.id, e.id))
  scenario.paths = [
    flight(uas.id, [
      { x: -1210, y: 0 },
      { x: 3000, y: 0 },
    ]),
  ]
  return { scenario, effIds: effs.map((e) => e.id), uasId: uas.id }
}

describe('defaultJamBehavior', () => {
  const uas = (patch: Partial<UasSpec>): UasSpec => target(patch).uas!
  it('defaults drift for gps and continue for mixed', () => {
    expect(defaultJamBehavior(uas({ navMode: 'gps' }))).toBe('drift')
    expect(defaultJamBehavior(uas({ navMode: 'mixed' }))).toBe('continue')
    expect(defaultJamBehavior(uas({ navMode: 'rf-manual' }))).toBe('drift')
  })
  it('respects an explicit spec value', () => {
    expect(defaultJamBehavior(uas({ navMode: 'gps', jamBehavior: 'return-home' }))).toBe(
      'return-home',
    )
    expect(defaultJamBehavior(uas({ navMode: 'mixed', jamBehavior: 'drift' }))).toBe('drift')
  })
})

describe('jammer vs jam-immune threat', () => {
  it('takes zero shots at a fiber-guided threat', () => {
    const { scenario, effIds } = scenarioWith(target({ navMode: 'fiber' }), [
      effectorModel('tst-jam', 'jammer', { pk: 0.5, salvoCooldownS: 2 }),
    ])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(0)
    expect(t.firstShotS).toBeNull()
    expect(t.expectedHardKills).toBe(0)
    expect(t.expectedSoftKills).toBe(0)
    expect(t.leakProbability).toBe(1)
    expect(r.effectors.find((e) => e.effectorId === effIds[0])!.shotsFired).toBe(0)
    // These laydowns place no asset, so the undefeated ship never arrives
    // anywhere: it is never-arrived mass, not a leaker.
    expect(r.totals.expectedLeakers).toBe(0)
    expect(r.totals.expectedNoArrival).toBe(1)
    expect(r.totals.reportedLeakers).toBeNull()
  })
})

describe('jammer reach is the effective range against the target', () => {
  it('a hardened link (jamResistDb) shortens the envelope the jammer fires inside', () => {
    // 6 dB of link margin quarters the power ratio, so the 1000 m placard
    // closes at 500 m. Flying east at 40 m/s from x = -1210, the first DT
    // sample inside 500 m is t = 18 (x = -490); at full reach it is t = 5.5.
    const jam = effectorModel('tst-jam', 'jammer', { pk: 0.5, salvoCooldownS: 2 })
    const plain = resolveEngagements(scenarioWith(target({ navMode: 'gps' }), [jam]).scenario)
    const hard = resolveEngagements(
      scenarioWith(target({ navMode: 'gps', jamResistDb: 6 }), [jam]).scenario,
    )
    expect(plain.threats[0].firstShotS).toBeCloseTo(5.5, 5)
    expect(hard.threats[0].firstShotS).toBeCloseTo(18, 5)
    // A jam dwell is EW expenditure, never a kinetic round.
    expect(hard.threats[0].shotsFired).toBe(0)
    expect(hard.threats[0].jamSalvos).toBeGreaterThan(0)
    expect(hard.threats[0].jamSalvos).toBeLessThan(plain.threats[0].jamSalvos)
  })
})

describe('soft kill ends the approach (drift, return-home)', () => {
  it('soft-kills a GPS threat: flagged soft, not hard', () => {
    // One jam at t = 5.5, d = 990: Pk = 0.5 * 0.703 = 0.3515. Jammer
    // expenditure lands in jamSalvos, never in the kinetic shotsFired.
    const { scenario, effIds, uasId } = scenarioWith(target({ navMode: 'gps' }), [
      effectorModel('tst-jam', 'jammer', { pk: 0.5, salvoCooldownS: 1000 }),
    ])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.uasId).toBe(uasId)
    expect(t.shotsFired).toBe(0)
    expect(t.jamSalvos).toBe(1)
    expect(t.firstShotS).toBeCloseTo(5.5, 6)
    expect(t.expectedSoftKills).toBeCloseTo(0.3515, 6)
    expect(t.expectedHardKills).toBe(0)
    expect(t.expectedKills).toBeCloseTo(0.3515, 6)
    expect(t.leakProbability).toBeCloseTo(1 - 0.3515, 6)
    expect(t.continueJamProb).toBe(0)
    expect(t.killedByEffectorId).toBe(effIds[0])
    expect(t.killedBySoft).toBe(true)
    expect(r.totals.expectedSoftKills).toBeCloseTo(0.3515, 6)
    expect(r.totals.expectedHardKills).toBe(0)
    expect(r.totals.expectedKills).toBeCloseTo(0.3515, 6)
  })

  it('treats return-home like drift: a soft mission kill', () => {
    const { scenario } = scenarioWith(target({ navMode: 'gps', jamBehavior: 'return-home' }), [
      effectorModel('tst-jam', 'jammer', { pk: 0.5, salvoCooldownS: 1000 }),
    ])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.expectedSoftKills).toBeCloseTo(0.3515, 6)
    expect(t.expectedHardKills).toBe(0)
    expect(t.killedBySoft).toBe(true)
  })
})

describe('continue behavior still leaks', () => {
  it('jams a mixed-nav threat without killing it', () => {
    const { scenario } = scenarioWith(target({ navMode: 'mixed' }), [
      effectorModel('tst-jam', 'jammer', { pk: 0.5, salvoCooldownS: 1000 }),
    ])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(0)
    expect(t.jamSalvos).toBe(1)
    expect(t.expectedHardKills).toBe(0)
    expect(t.expectedSoftKills).toBe(0)
    expect(t.expectedKills).toBe(0)
    expect(t.leakProbability).toBe(1)
    expect(t.continueJamProb).toBeCloseTo(0.3515, 6)
    expect(t.killedByEffectorId).toBeNull()
    // 'continue' still leaks in the doctrinal sense, but with no asset on the
    // board there is no boundary to leak past.
    expect(t.arrived).toBe(false)
    expect(r.totals.expectedLeakers).toBe(0)
    expect(r.totals.expectedNoArrival).toBe(1)
    expect(r.totals.reportedLeakers).toBeNull()
  })

  it('drops the kill-shot degrade once the target leaves the jam envelope', () => {
    // Jamming is illumination-bound. The dwell lands at t = 5.5 (jam prob
    // 0.3515). The interceptor's 4 km envelope opens at t = 0, so it fires
    // at 0 with a 60 s flight: the effect lands at t = 60, after the target
    // exits the 1 km jam envelope near t = 55. The hold has lapsed by then,
    // so the kill takes NO jam degrade: d(60) = 1190 of 4000, falloff
    // 0.91075, kill = 0.5 * 0.91075 (a degraded kill would read 0.4073).
    const { scenario } = scenarioWith(target({ navMode: 'mixed' }), [
      effectorModel('tst-jam', 'jammer', { pk: 0.5, salvoCooldownS: 1000 }),
      effectorModel('tst-int', 'interceptor', {
        pk: 0.5,
        maxRangeM: 4000,
        engageTimeS: 60,
        salvoCooldownS: 1000,
      }),
    ])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.jamSalvos).toBe(1)
    expect(t.expectedHardKills).toBeCloseTo(0.5 * 0.91075, 6)
    // The reported jam figure reads at the last dwell, where the hold held.
    expect(t.continueJamProb).toBeCloseTo(0.3515, 6)
  })

  it('degrades the hard-kill shot that follows the jam', () => {
    // Jammer fires first in entity order at t = 5.5: jammed = 0.3515.
    // Interceptor kill the same tick: 0.3515 * (1 - 0.3 * 0.3515) = 0.314434325.
    const { scenario, effIds } = scenarioWith(target({ navMode: 'mixed' }), [
      effectorModel('tst-jam', 'jammer', { pk: 0.5, salvoCooldownS: 1000 }),
      effectorModel('tst-int', 'interceptor', { pk: 0.5, salvoCooldownS: 1000 }),
    ])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(1) // the interceptor's kill shot
    expect(t.jamSalvos).toBe(1) // the jammer's salvo, split out
    expect(t.expectedHardKills).toBeCloseTo(0.3515 * (1 - 0.3 * 0.3515), 6)
    expect(t.expectedSoftKills).toBe(0)
    expect(t.leakProbability).toBeCloseTo(1 - 0.3515 * (1 - 0.3 * 0.3515), 6)
    expect(t.continueJamProb).toBeCloseTo(0.3515, 6)
    expect(t.killedByEffectorId).toBe(effIds[1])
    expect(t.killedBySoft).toBe(false)
  })
})

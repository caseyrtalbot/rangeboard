import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Connection, Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { resolveEngagements } from './attrition'

/**
 * Hand-built scenarios with controlled specs so per-shot Pk is exactly
 * computable: group 4 fixed-wing target (size penalty 1.0, no evasion),
 * effector pk set in the test, distance falloff from known geometry.
 */

/** Search radar big enough to detect the whole play area at t = 0. */
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
const TARGET: SpecModel = {
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
  },
}

function interceptor(patch: Partial<NonNullable<SpecModel['effector']>>): SpecModel {
  return {
    id: 'tst-int',
    name: 'test interceptor',
    kind: 'effector',
    description: '',
    color: '#fff',
    builtin: false,
    effector: {
      effectorType: 'interceptor',
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
 * Sensor and effector at the origin, sensor -> effector direct kill chain,
 * one threat flying east through the effector envelope.
 * Detection at t = 0; the threat crosses into the 1000 m ring at t = 5.25,
 * so the first DT-grid shot lands at t = 5.5 at 990 m.
 */
function singleThreatScenario(effectorModel: SpecModel): {
  scenario: Scenario
  effId: string
  uasId: string
} {
  const scenario = emptyScenario()
  scenario.library = [...scenario.library, SENSOR, TARGET, effectorModel]
  const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
  const eff = ent('effector', effectorModel.id, { x: 0, y: 0 })
  const uas = ent('uas', TARGET.id, { x: -1210, y: 0 })
  scenario.entities = [sensor, eff, uas]
  scenario.connections = [link(sensor.id, eff.id)]
  scenario.paths = [
    flight(uas.id, [
      { x: -1210, y: 0 },
      { x: 3000, y: 0 },
    ]),
  ]
  return { scenario, effId: eff.id, uasId: uas.id }
}

describe('single threat, single effector window math', () => {
  it('fires once with a long cooldown and reports the exact expected values', () => {
    // pk 0.5, one shot at t = 5.5 and d = 990 m:
    // falloff = 1 - 0.3 * 990/1000 = 0.703; Pk = 0.5 * 0.703 = 0.3515.
    const { scenario, effId, uasId } = singleThreatScenario(
      interceptor({ pk: 0.5, magazineSize: 10, salvoCooldownS: 1000 }),
    )
    const r = resolveEngagements(scenario)

    expect(r.threats).toHaveLength(1)
    const t = r.threats[0]
    expect(t.uasId).toBe(uasId)
    expect(t.shipCount).toBe(1)
    expect(t.shotsFired).toBe(1)
    expect(t.firstShotS).toBeCloseTo(5.5, 6)
    expect(t.leakProbability).toBeCloseTo(1 - 0.3515, 6)
    expect(t.expectedKills).toBeCloseTo(0.3515, 6)
    expect(t.killedByEffectorId).toBe(effId)

    const e = r.effectors.find((x) => x.effectorId === effId)!
    expect(e.shotsFired).toBe(1)
    expect(e.expectedRoundsRemaining).toBe(9)

    expect(r.totals.raidSize).toBe(1)
    expect(r.totals.shotsFired).toBe(1)
    expect(r.totals.expectedLeakers).toBeCloseTo(1 - 0.3515, 6)
  })

  it('applies type-baseline defaults when the spec has no pk fields (old saves)', () => {
    const { scenario, effId } = singleThreatScenario(interceptor({}))
    const r = resolveEngagements(scenario)
    const e = r.effectors.find((x) => x.effectorId === effId)!
    expect(r.threats[0].shotsFired).toBeGreaterThan(0)
    expect(e.expectedRoundsRemaining).toBeNull() // no magazine field = unlimited
    expect(r.threats[0].leakProbability).toBeLessThan(1)
  })
})

describe('magazine exhaustion mid-raid', () => {
  it('stops shooting when the expected-rounds ledger is empty', () => {
    // Window is ~50 s and the cooldown 2 s, but only 2 rounds are carried.
    // Shot 1: t = 5.5, d = 990, Pk = 0.5 * 0.703 = 0.3515.
    // Shot 2: t = 7.5, d = 910, Pk = 0.5 * 0.727 = 0.3635.
    const { scenario, effId } = singleThreatScenario(
      interceptor({ pk: 0.5, magazineSize: 2, salvoCooldownS: 2 }),
    )
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(2)
    expect(t.leakProbability).toBeCloseTo((1 - 0.3515) * (1 - 0.3635), 6)
    const e = r.effectors.find((x) => x.effectorId === effId)!
    expect(e.shotsFired).toBe(2)
    expect(e.expectedRoundsRemaining).toBe(0)
  })
})

describe('formation shot splitting', () => {
  it('spreads shots across the ships of a formation', () => {
    // 3 ships, 3 rounds, high pk: each salvo aims at the ship most likely to
    // be alive, so each ship is shot once. Concentrating on one ship could
    // never exceed 1.0 expected kills; splitting yields ~1.9.
    const { scenario, uasId } = singleThreatScenario(
      interceptor({ pk: 0.9, magazineSize: 3, salvoCooldownS: 0.5 }),
    )
    const uas = scenario.entities.find((e) => e.id === uasId)!
    uas.formation = { count: 3, shape: 'line', spacingM: 20 }
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shipCount).toBe(3)
    expect(t.shotsFired).toBe(3)
    expect(t.expectedKills).toBeGreaterThan(1.5)
    expect(t.leakProbability).toBeLessThan(0.5)
    expect(r.totals.raidSize).toBe(3)
  })
})

describe('out-of-window threats', () => {
  it('takes zero shots when the path never enters the effector envelope', () => {
    const { scenario } = singleThreatScenario(
      interceptor({ pk: 0.5, magazineSize: 10, salvoCooldownS: 2 }),
    )
    // Move the flight path 5 km south: detected, but never in range.
    scenario.paths = [
      flight(scenario.paths[0].entityId, [
        { x: -1210, y: 5000 },
        { x: 3000, y: 5000 },
      ]),
    ]
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(0)
    expect(t.firstShotS).toBeNull()
    expect(t.leakProbability).toBe(1)
    expect(t.expectedKills).toBe(0)
    expect(t.killedByEffectorId).toBeNull()
    expect(r.totals.expectedLeakers).toBe(1)
    expect(r.effectors.every((e) => e.shotsFired === 0)).toBe(true)
  })

  it('never shoots at a threat whose kill chain is not connected', () => {
    const { scenario } = singleThreatScenario(
      interceptor({ pk: 0.5, magazineSize: 10, salvoCooldownS: 2 }),
    )
    scenario.connections = [] // sensor no longer feeds the effector
    const r = resolveEngagements(scenario)
    expect(r.threats[0].shotsFired).toBe(0)
    expect(r.threats[0].leakProbability).toBe(1)
  })
})

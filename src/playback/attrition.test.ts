import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Connection, Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { distanceFalloff, resolveEngagements } from './attrition'

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

/*
 * Ordering-correctness note for the assignment-to-effect latency model.
 *
 * A salvo assigned at t takes effect at tEffect = t + engageTimeS. The
 * question: may attrition.ts apply ship-state mutations immediately at
 * assignment time, or must it buffer them until tEffect?
 *
 * Double-killing probability mass is impossible under EITHER ordering.
 * Every kill shot multiplies ship.alive by (1 - pk'), so final survival is
 * the product of (1 - pk') over all shots — a product commutes, the same
 * mass is never subtracted twice, and total expected kills = 1 - product no
 * matter how assignments interleave with effects. A single effector also
 * cannot re-fire before its own effect lands in any case that changes state
 * twice ambiguously (interceptor cooldowns are >= 30 s).
 *
 * Ordering DOES matter for the jam coupling term, so effects are buffered.
 * A kill shot's magnitude is alive * pk * (1 - 0.3 * jammed), and jammed
 * enters non-multiplicatively. Jammer engage times are 0-20 s while
 * interceptor engage times are 45-120 s, so assignment order and effect
 * order diverge: an interceptor assigned BEFORE a jam takes hold can strike
 * AFTER it, and its firing solution must be degraded. Applying mutations at
 * assignment time would read `jammed` at the wrong time. attrition.ts
 * therefore queues every nonzero-latency effect and applies the queue in
 * tEffect order ahead of each sweep step (flushing leftovers after the
 * sweep); zero-latency effects apply inline, preserving the pre-latency
 * same-tick jam-then-kill coupling. The 'degrades a delayed kill shot' test
 * below locks in the effect-order behavior.
 *
 * Ship selection in formations reads the state applied so far: outcomes of
 * salvos still in flight are unknown at assignment time, so aiming is not
 * clairvoyant about them.
 */

/** Group 4 fixed-wing on mixed nav: jams 'continue' (degraded track, still inbound). */
const TARGET_MIXED: SpecModel = {
  ...TARGET,
  id: 'tst-uas-mixed',
  uas: { ...TARGET.uas!, navMode: 'mixed' },
}

function jammer(patch: Partial<NonNullable<SpecModel['effector']>>): SpecModel {
  return {
    id: 'tst-jam',
    name: 'test jammer',
    kind: 'effector',
    description: '',
    color: '#fff',
    builtin: false,
    effector: {
      effectorType: 'jammer',
      minRangeM: 0,
      maxRangeM: 1000,
      engageTimeS: 0,
      ...patch,
    },
  }
}

/**
 * Long-envelope variant of singleThreatScenario: sensor plus every effector
 * at the origin, one threat from x = -4210 flying east at 40 m/s to endX.
 * A 4000 m envelope opens at t = 5.25 (first DT-grid shot t = 5.5 at 3990 m)
 * and, with endX = 4000, holds for ~200 s — long enough for 120 s engage
 * times to resolve inside the window.
 */
function longScenario(
  effectorModels: SpecModel[],
  endX = 4000,
  targetModel: SpecModel = TARGET,
): { scenario: Scenario; effIds: string[]; uasId: string } {
  const scenario = emptyScenario()
  scenario.library = [...scenario.library, SENSOR, targetModel, ...effectorModels]
  const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
  const effs = effectorModels.map((m) => ent('effector', m.id, { x: 0, y: 0 }))
  const uas = ent('uas', targetModel.id, { x: -4210, y: 0 })
  scenario.entities = [sensor, ...effs, uas]
  scenario.connections = effs.map((e) => link(sensor.id, e.id))
  scenario.paths = [
    flight(uas.id, [
      { x: -4210, y: 0 },
      { x: endX, y: 0 },
    ]),
  ]
  return { scenario, effIds: effs.map((e) => e.id), uasId: uas.id }
}

describe('distanceFalloff envelope honesty', () => {
  it('is zero beyond max range, 0.7 at max range, 1 at the muzzle', () => {
    expect(distanceFalloff(1000.1, 1000)).toBe(0)
    expect(distanceFalloff(3000, 1000)).toBe(0)
    expect(distanceFalloff(1000, 1000)).toBeCloseTo(0.7, 9)
    expect(distanceFalloff(0, 1000)).toBe(1)
  })
  it('is zero for a degenerate max range', () => {
    expect(distanceFalloff(500, 0)).toBe(0)
  })
})

describe('assignment-to-effect latency (engageTimeS)', () => {
  it('fires at window open but credits the kill with tEffect geometry', () => {
    // 4000 m envelope, engage time 120 s. Window opens at W = 5.25 (grid
    // 5.5); path ends at x = 990 so the envelope holds through t = 130.
    // One assignment at t = 5.5 (firstShotS = W grid); the intercept lands
    // at tEffect = 125.5 where x = -4210 + 40 * 125.5 = 810, so
    // falloff = 1 - 0.3 * 810/4000 = 0.93925 and kill = 0.5 * 0.93925.
    // No kill can exist before W + 120: the companion test below shows an
    // envelope that ends before W + 120 yields zero kills.
    const { scenario, effIds: [effId] } = longScenario(
      [interceptor({ pk: 0.5, maxRangeM: 4000, engageTimeS: 120, magazineSize: 4, salvoCooldownS: 1000 })],
      990,
    )
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.firstShotS).toBeCloseTo(5.5, 6) // assignment time, at/after W
    expect(t.shotsFired).toBe(1)
    expect(t.expectedKills).toBeCloseTo(0.5 * (1 - 0.3 * (810 / 4000)), 6)
    expect(t.killedByEffectorId).toBe(effId)
    const e = r.effectors.find((x) => x.effectorId === effId)!
    expect(e.expectedRoundsRemaining).toBe(3) // magazine spent at assignment
  })

  it('takes zero shots when the window is shorter than engageTimeS', () => {
    // Same geometry but the path ends at x = 590: the envelope holds only
    // ~115 s < 120 s, so no assignment can take effect inside it. This is
    // the attrition-side twin of the sim.ts 'window-too-short' status.
    const { scenario, effIds: [effId] } = longScenario(
      [interceptor({ pk: 0.5, maxRangeM: 4000, engageTimeS: 120, magazineSize: 4, salvoCooldownS: 1000 })],
      590,
    )
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(0)
    expect(t.firstShotS).toBeNull()
    expect(t.expectedKills).toBe(0)
    expect(t.leakProbability).toBe(1)
    expect(r.effectors.find((x) => x.effectorId === effId)!.expectedRoundsRemaining).toBe(4)
  })

  it('holds one effector whose own window is too short while another fires', () => {
    // A (4000 m, engage 0) makes the threat engageable with a ~200 s window
    // and kills at t = 5.5, d = 3990. B (1000 m, engage 120) only holds the
    // target for ~50 s — its intercept could never land inside its own
    // envelope, so it must not fire even though the threat is engageable.
    const modelA = interceptor({ pk: 0.5, maxRangeM: 4000, engageTimeS: 0, salvoCooldownS: 1000 })
    const modelB = {
      ...interceptor({ pk: 0.9, maxRangeM: 1000, engageTimeS: 120, magazineSize: 10, salvoCooldownS: 2 }),
      id: 'tst-int-b',
      name: 'test interceptor b',
    }
    const { scenario, effIds } = longScenario([modelA, modelB])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(1)
    expect(t.expectedKills).toBeCloseTo(0.5 * (1 - 0.3 * (3990 / 4000)), 6)
    expect(t.killedByEffectorId).toBe(effIds[0])
    expect(r.effectors.find((x) => x.effectorId === effIds[1])!.shotsFired).toBe(0)
    expect(r.effectors.find((x) => x.effectorId === effIds[1])!.expectedRoundsRemaining).toBe(10)
  })

  it('never exceeds the magazine regardless of window length', () => {
    // ~200 s window, 2 s cooldown, 30 s engage time, 2 rounds: assignments
    // at t = 5.5 and 7.5 empty the magazine; effects land at 35.5 and 37.5
    // (x = -2790 and -2710), each on the same lone ship.
    const { scenario, effIds: [effId] } = longScenario([
      interceptor({ pk: 0.5, maxRangeM: 4000, engageTimeS: 30, magazineSize: 2, salvoCooldownS: 2 }),
    ])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(2)
    const pk1 = 0.5 * (1 - 0.3 * (2790 / 4000))
    const pk2 = 0.5 * (1 - 0.3 * (2710 / 4000))
    expect(t.expectedKills).toBeCloseTo(1 - (1 - pk1) * (1 - pk2), 6)
    const e = r.effectors.find((x) => x.effectorId === effId)!
    expect(e.shotsFired).toBe(2)
    expect(e.expectedRoundsRemaining).toBe(0)
  })

  it('degrades a delayed kill shot with the jam state at tEffect', () => {
    // Interceptor (entity order first) is ASSIGNED at t = 5.5, before the
    // jam exists, but its intercept lands at 125.5, long after the 'continue'
    // jam takes hold at 5.5 (jam Pk = 0.5 * (1 - 0.3 * 3990/4000)).
    // Effect-order bookkeeping must degrade the kill by the jammed track:
    // kill = pkEff * (1 - 0.3 * jam) with pkEff = 0.5 * (1 - 0.3 * 810/4000).
    // Assignment-order bookkeeping would leave the kill undegraded.
    const jamModel = jammer({ pk: 0.5, maxRangeM: 4000, engageTimeS: 0, salvoCooldownS: 1000 })
    const { scenario, effIds } = longScenario(
      [
        interceptor({ pk: 0.5, maxRangeM: 4000, engageTimeS: 120, salvoCooldownS: 1000 }),
        jamModel,
      ],
      4000,
      TARGET_MIXED,
    )
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    const jam = 0.5 * (1 - 0.3 * (3990 / 4000))
    const pkEff = 0.5 * (1 - 0.3 * (810 / 4000))
    expect(t.shotsFired).toBe(2)
    expect(t.continueJamProb).toBeCloseTo(jam, 6)
    expect(t.expectedHardKills).toBeCloseTo(pkEff * (1 - 0.3 * jam), 6)
    expect(t.expectedSoftKills).toBe(0)
    expect(t.killedByEffectorId).toBe(effIds[0])
    expect(t.killedBySoft).toBe(false)
  })
})

describe('jammer latency', () => {
  it('keeps engageTimeS 0 jammer behavior identical to the pre-latency model', () => {
    // Same numbers as the ew suite: one jam at t = 5.5, d = 990,
    // soft kill = 0.5 * (1 - 0.3 * 0.99) = 0.3515 against a GPS (drift) target.
    const { scenario, effId } = singleThreatScenario(
      jammer({ pk: 0.5, salvoCooldownS: 1000 }),
    )
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(1)
    expect(t.firstShotS).toBeCloseTo(5.5, 6)
    expect(t.expectedSoftKills).toBeCloseTo(0.3515, 6)
    expect(t.expectedHardKills).toBe(0)
    expect(t.killedByEffectorId).toBe(effId)
    expect(t.killedBySoft).toBe(true)
  })

  it('applies a small engage time at tEffect and still soft-kills', () => {
    // Assigned at t = 5.5, jam holds at 10.5 where x = -790:
    // soft kill = 0.5 * (1 - 0.3 * 790/1000) = 0.3815.
    const { scenario } = singleThreatScenario(
      jammer({ pk: 0.5, engageTimeS: 5, salvoCooldownS: 1000 }),
    )
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(1)
    expect(t.firstShotS).toBeCloseTo(5.5, 6)
    expect(t.expectedSoftKills).toBeCloseTo(0.5 * (1 - 0.3 * (790 / 1000)), 6)
    expect(t.expectedHardKills).toBe(0)
    expect(t.killedBySoft).toBe(true)
  })
})

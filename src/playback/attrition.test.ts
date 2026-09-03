import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Connection, Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { MOUNT_HEIGHT_M } from '../model/types'
import { FT_TO_M } from '../analysis/sensorEnv'
import {
  distanceFalloff,
  expenditureChannel,
  isHardKill,
  resolveEngagements,
  SHIP_DEAD_BELOW,
} from './attrition'
import { assessAllThreats } from './sim'

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

/**
 * Fixture altitude: the threat flies at the default mount height, so the
 * slant range equals the ground range and the hand-derived geometry below
 * stays exact. The radio horizon between two 4 m heights is 16.5 km, beyond
 * every play area here.
 */
const FIXTURE_ALT_FT = MOUNT_HEIGHT_M / FT_TO_M

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
    ...(kind === 'uas' ? { altitudeFt: FIXTURE_ALT_FT } : {}),
    ...extra,
  }
}

function link(fromId: string, toId: string): Connection {
  seq += 1
  return { id: `con-${seq}`, fromId, toId, label: '' }
}

/** Defended asset. Omit the radius to take the DEFAULT_DEFENDED_RADIUS_M 500 m. */
function asset(pos: Vec2, defendedRadiusM?: number): Entity {
  seq += 1
  return {
    id: `asset-${seq}`,
    name: `asset-${seq}`,
    kind: 'asset',
    specId: null,
    pos,
    headingDeg: 0,
    color: null,
    notes: '',
    ...(defendedRadiusM != null ? { defendedRadiusM } : {}),
  }
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
  const scenario = legacyScenario()
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
    // No asset on this board, so the surviving mass never arrived anywhere.
    // The old expectation charged it as a leaker, which is the conflation the
    // partition removes.
    expect(r.totals.expectedLeakers).toBe(0)
    expect(r.totals.expectedNoArrival).toBeCloseTo(1 - 0.3515, 6)
    expect(r.totals.reportedLeakers).toBeNull()
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
    // Undefeated and never over an asset: never-arrived, not a leaker.
    expect(t.arrived).toBe(false)
    expect(r.totals.expectedLeakers).toBe(0)
    expect(r.totals.expectedNoArrival).toBe(1)
    expect(r.totals.reportedLeakers).toBeNull()
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
 * Ship selection reads the applied state discounted by salvos still in
 * flight: outcomes of pending salvos are unknown at assignment time, so
 * aiming is not clairvoyant about them — it multiplies survival by their
 * expected (1 - Pk) instead, which spreads simultaneous volleys across
 * ships (see the fire-distribution suite below).
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
  const scenario = legacyScenario()
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
    expect(t.shotsFired).toBe(1) // kinetic channel: the interceptor
    expect(t.jamSalvos).toBe(1) // jammer expenditure splits out
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
    // soft kill = 0.5 * (1 - 0.3 * 0.99) = 0.3515 against a GPS (drift)
    // target. Jammer expenditure counts in jamSalvos, not shotsFired.
    const { scenario, effId } = singleThreatScenario(
      jammer({ pk: 0.5, salvoCooldownS: 1000 }),
    )
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(0)
    expect(t.jamSalvos).toBe(1)
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
    expect(t.shotsFired).toBe(0)
    expect(t.jamSalvos).toBe(1)
    expect(t.firstShotS).toBeCloseTo(5.5, 6)
    expect(t.expectedSoftKills).toBeCloseTo(0.5 * (1 - 0.3 * (790 / 1000)), 6)
    expect(t.expectedHardKills).toBe(0)
    expect(t.killedBySoft).toBe(true)
  })
})

describe('fire distribution: survival cutoff', () => {
  it('shifts to the next threat once the first is expected dead, with bounded shots', () => {
    // Two identical threats on the same lane; B launches 60 s after A, so
    // A's window [5.5, 55.0] closes before B's [65.5, 115.0] opens.
    // Interceptor: pk 0.9, cooldown 2, magazine 10.
    //   A: shots at t = 5.5 (d 990, Pk 0.6327), 7.5 (910, 0.6543),
    //      9.5 (830, 0.6759). Survival 0.3673*0.3457*0.3241 = 0.0412 <
    //      SHIP_DEAD_BELOW -> the fourth opportunity (t = 11.5) and every
    //      later one HOLDS: ~22 window opportunities go unused.
    //   B: same three shots at 65.5/67.5/69.5 from the held rounds.
    // The pre-cutoff engine spent all 10 rounds on A and starved B.
    const scenario = legacyScenario()
    const model = interceptor({ pk: 0.9, magazineSize: 10, salvoCooldownS: 2 })
    scenario.library = [...scenario.library, SENSOR, TARGET, model]
    const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
    const eff = ent('effector', model.id, { x: 0, y: 0 })
    const uasA = ent('uas', TARGET.id, { x: -1210, y: 0 })
    const uasB = ent('uas', TARGET.id, { x: -1210, y: 0 })
    scenario.entities = [sensor, eff, uasA, uasB]
    scenario.connections = [link(sensor.id, eff.id)]
    const pathA = flight(uasA.id, [{ x: -1210, y: 0 }, { x: 3000, y: 0 }])
    const pathB = flight(uasB.id, [{ x: -1210, y: 0 }, { x: 3000, y: 0 }])
    pathB.startDelayS = 60
    scenario.paths = [pathA, pathB]

    const r = resolveEngagements(scenario)
    const pk1 = 0.9 * (1 - 0.3 * (990 / 1000))
    const pk2 = 0.9 * (1 - 0.3 * (910 / 1000))
    const pk3 = 0.9 * (1 - 0.3 * (830 / 1000))
    const survival = (1 - pk1) * (1 - pk2) * (1 - pk3)
    // The bound the doctrine guarantees: three salvos cross the cutoff.
    expect(survival).toBeLessThan(SHIP_DEAD_BELOW)

    const a = r.threats.find((t) => t.uasId === uasA.id)!
    const b = r.threats.find((t) => t.uasId === uasB.id)!
    expect(a.shotsFired).toBe(3) // no salvo ever lands on an expected-dead ship
    expect(a.expectedKills).toBeCloseTo(1 - survival, 6)
    expect(b.shotsFired).toBe(3) // rounds held for the follow-on threat
    expect(b.firstShotS).toBeCloseTo(65.5, 6)
    expect(b.expectedKills).toBeCloseTo(1 - survival, 6)
    expect(r.effectors[0].expectedRoundsRemaining).toBe(4)
  })
})

describe('fire distribution: in-flight discounting', () => {
  it('spreads a same-tick volley from two effectors across two ships', () => {
    // 2-ship line formation (spacing 20: both deep inside the 4000 m
    // envelope), two identical interceptors with engageTimeS 10 so the
    // first salvo is still IN FLIGHT when the second effector assigns in
    // the same sweep step. Effective survival discounts the pending salvo:
    // effector 1 aims at ship 0 (exact tie -> lower index), which drops
    // ship 0's effective survival to 1 - Pk, so effector 2 aims at ship 1.
    // Without the discount both salvos would stack on ship 0.
    // Both effects land at tEffect = 15.5 (x = -3590):
    // Pk ~ 0.5 * (1 - 0.3 * 3590/4000) = 0.365375 per ship (the wingman
    // sits ~20 m off the lane; its Pk differs only in the 6th decimal).
    const modelA = interceptor({ pk: 0.5, maxRangeM: 4000, engageTimeS: 10, magazineSize: 1, salvoCooldownS: 1000 })
    const modelB = {
      ...interceptor({ pk: 0.5, maxRangeM: 4000, engageTimeS: 10, magazineSize: 1, salvoCooldownS: 1000 }),
      id: 'tst-int-b2',
      name: 'test interceptor b2',
    }
    const { scenario, uasId } = longScenario([modelA, modelB])
    const uas = scenario.entities.find((e) => e.id === uasId)!
    uas.formation = { count: 2, shape: 'line', spacingM: 20 }

    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shipCount).toBe(2)
    expect(t.shotsFired).toBe(2)
    // Both assignments happen at the same tick and hit DIFFERENT ships.
    expect(r.events).toHaveLength(2)
    expect(r.events[0].tS).toBeCloseTo(5.5, 6)
    expect(r.events[1].tS).toBeCloseTo(5.5, 6)
    expect([r.events[0].shipIdx, r.events[1].shipIdx].sort()).toEqual([0, 1])
    // Independent ships: kills add, instead of the second salvo grinding
    // the first ship's residual.
    const pk = 0.5 * (1 - 0.3 * (3590 / 4000))
    expect(t.expectedKills).toBeCloseTo(2 * pk, 4)
  })
})

describe('fire distribution: continue-jam saturation', () => {
  it('stops jam salvos once the track is saturated', () => {
    // Mixed-nav target ('continue'): jamming degrades the track but never
    // kills, so without a saturation stop the jammer would salvo every
    // 2 s cooldown for the whole ~50 s window (~25 salvos). Three jams
    // at t = 5.5/7.5/9.5 (Pk 0.6327/0.6543/0.6759) leave un-jammed
    // probability 0.0412 < SHIP_DEAD_BELOW: the track is saturated and
    // every later opportunity holds.
    const jamModel = jammer({ pk: 0.9, salvoCooldownS: 2 })
    const scenario = legacyScenario()
    scenario.library = [...scenario.library, SENSOR, TARGET_MIXED, jamModel]
    const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
    const eff = ent('effector', jamModel.id, { x: 0, y: 0 })
    const uas = ent('uas', TARGET_MIXED.id, { x: -1210, y: 0 })
    scenario.entities = [sensor, eff, uas]
    scenario.connections = [link(sensor.id, eff.id)]
    scenario.paths = [flight(uas.id, [{ x: -1210, y: 0 }, { x: 3000, y: 0 }])]

    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    const pk1 = 0.9 * (1 - 0.3 * (990 / 1000))
    const pk2 = 0.9 * (1 - 0.3 * (910 / 1000))
    const pk3 = 0.9 * (1 - 0.3 * (830 / 1000))
    const unjammed = (1 - pk1) * (1 - pk2) * (1 - pk3)
    expect(unjammed).toBeLessThan(SHIP_DEAD_BELOW) // saturation in 3 salvos
    expect(t.jamSalvos).toBe(3)
    expect(t.shotsFired).toBe(0)
    expect(t.continueJamProb).toBeCloseTo(1 - unjammed, 6)
    expect(t.expectedKills).toBe(0) // 'continue' still leaks
    expect(t.leakProbability).toBe(1)
  })
})

describe('expenditure split: kinetic vs jam', () => {
  it('counts kinetic and jammer salvos in separate ledgers, events included', () => {
    // Interceptor (entity order first) and jammer, one salvo each at
    // t = 5.5, d = 990, both zero latency. The interceptor's kill applies
    // before the jam this tick: kill = 0.5 * 0.703 = 0.3515.
    const jamModel = jammer({ pk: 0.5, salvoCooldownS: 1000 })
    const intModel = interceptor({ pk: 0.5, salvoCooldownS: 1000 })
    const scenario = legacyScenario()
    scenario.library = [...scenario.library, SENSOR, TARGET_MIXED, intModel, jamModel]
    const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
    const int = ent('effector', intModel.id, { x: 0, y: 0 })
    const jam = ent('effector', jamModel.id, { x: 0, y: 0 })
    const uas = ent('uas', TARGET_MIXED.id, { x: -1210, y: 0 })
    scenario.entities = [sensor, int, jam, uas]
    scenario.connections = [link(sensor.id, int.id), link(sensor.id, jam.id)]
    scenario.paths = [flight(uas.id, [{ x: -1210, y: 0 }, { x: 3000, y: 0 }])]

    const r = resolveEngagements(scenario)
    expect(r.totals.shotsFired).toBe(1)
    expect(r.totals.jamSalvos).toBe(1)
    const intRow = r.effectors.find((e) => e.effectorId === int.id)!
    expect(intRow.shotsFired).toBe(1)
    expect(intRow.jamSalvos).toBe(0)
    const jamRow = r.effectors.find((e) => e.effectorId === jam.id)!
    expect(jamRow.shotsFired).toBe(0)
    expect(jamRow.jamSalvos).toBe(1)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(1)
    expect(t.jamSalvos).toBe(1)
    // Ledger: one event per channel; only the kill removes survival mass.
    const killEvents = r.events.filter((e) => e.channel === 'kill')
    const jamEvents = r.events.filter((e) => e.channel === 'jam')
    expect(killEvents).toHaveLength(1)
    expect(jamEvents).toHaveLength(1)
    expect(killEvents[0].softShot).toBe(false)
    expect(jamEvents[0].softShot).toBe(true)
    expect(jamEvents[0].killDelta).toBe(0)
    expect(killEvents[0].killDelta).toBeCloseTo(0.3515, 6)
    expect(killEvents[0].killDelta).toBeCloseTo(t.expectedHardKills, 9)
  })
})

/*
 * ===================== ARRIVAL RULE (late kills) ==========================
 * A defeat whose effect lands after the threat was already inside the
 * defended asset's boundary destroyed an airframe but protected nothing. The
 * engine used to credit that mass as a defeat, so a laydown whose every
 * intercept arrived after the threat was overhead reported a near-perfect
 * defeat rate. Kill physics is unchanged; the CREDIT now splits at arrival.
 */
describe('kills credited against arrival at the defended asset', () => {
  /** Interceptor whose single intercept lands at t = 125.5, x = 810. */
  const slowInterceptor = () =>
    interceptor({
      pk: 0.5,
      maxRangeM: 4000,
      engageTimeS: 120,
      magazineSize: 1,
      salvoCooldownS: 1000,
    })

  /** Pk of that intercept: 0.5 * (1 - 0.3 * 810/4000) = 0.469625. */
  const INTERCEPT_PK = 0.5 * (1 - 0.3 * (810 / 4000))

  it('banks a post-arrival kill as late mass and still counts a leaker', () => {
    // Threat from x = -4210 east at 40 m/s. Asset at x = -2000 with the
    // default 500 m boundary: inside when x is in [-2500, -1500], so the
    // first 0.5 s sample inside is t = 43.0 (x = -2490).
    // Gate (tight ROE) is 5.5, the salvo is assigned there, and the intercept
    // lands at 125.5, long after the threat was overhead.
    const { scenario, effIds: [effId], uasId } = longScenario([slowInterceptor()])
    scenario.entities.push(asset({ x: -2000, y: 0 }))

    const a = assessAllThreats(scenario).find((x) => x.uasId === uasId)!
    expect(a.arrivalS).toBeCloseTo(43, 9)

    const r = resolveEngagements(scenario, [a])
    const t = r.threats[0]
    expect(t.shotsFired).toBe(1)
    expect(r.events).toHaveLength(1)
    expect(r.events[0].tEffectS).toBeCloseTo(125.5, 9)
    expect(r.events[0].lateEffect).toBe(true)
    expect(r.events[0].killDelta).toBeCloseTo(INTERCEPT_PK, 9)

    // The airframe still dies; the credit is just not a defeat.
    expect(t.expectedKills).toBe(0)
    expect(t.expectedHardKills).toBe(0)
    expect(t.expectedSoftKills).toBe(0)
    expect(t.expectedLateKills).toBeCloseTo(INTERCEPT_PK, 9)
    expect(t.expectedLateHardKills).toBeCloseTo(INTERCEPT_PK, 9)
    expect(t.expectedLateSoftKills).toBe(0)
    expect(t.leakProbability).toBe(1) // nothing was removed before arrival
    expect(t.killedByEffectorId).toBe(effId) // the ledger still names the shooter

    expect(r.totals.expectedKills).toBe(0)
    expect(r.totals.expectedLateKills).toBeCloseTo(INTERCEPT_PK, 9)
    expect(r.totals.expectedLeakers).toBe(1)
    // Leakers complement the DEFEAT mass alone; late mass never shrinks them.
    expect(r.totals.expectedKills + r.totals.expectedLeakers).toBeCloseTo(r.totals.raidSize, 9)
  })

  it('credits the identical intercept as a defeat when it lands before arrival', () => {
    // Same salvo, same geometry, same 0.469625 kill mass. Only the asset
    // moves: at x = 3000 the boundary is first crossed at t = 168.0, well
    // after the intercept lands at 125.5.
    const { scenario, uasId } = longScenario([slowInterceptor()])
    scenario.entities.push(asset({ x: 3000, y: 0 }))

    const a = assessAllThreats(scenario).find((x) => x.uasId === uasId)!
    expect(a.arrivalS).toBeCloseTo(168, 9)

    const r = resolveEngagements(scenario, [a])
    const t = r.threats[0]
    expect(r.events[0].lateEffect).toBe(false)
    expect(t.expectedKills).toBeCloseTo(INTERCEPT_PK, 9)
    expect(t.expectedHardKills).toBeCloseTo(INTERCEPT_PK, 9)
    expect(t.expectedLateKills).toBe(0)
    expect(t.leakProbability).toBeCloseTo(1 - INTERCEPT_PK, 9)
    expect(r.totals.expectedLeakers).toBeCloseTo(1 - INTERCEPT_PK, 9)
  })

  it('is not late when the effect lands exactly at arrival', () => {
    // A 10 m boundary at x = 810 is crossed only on the sample where the
    // intercept itself lands: arrival 125.5, tEffect 125.5. Late means
    // STRICTLY after, so this one still defends the asset.
    const { scenario, uasId } = longScenario([slowInterceptor()])
    scenario.entities.push(asset({ x: 810, y: 0 }, 10))

    const a = assessAllThreats(scenario).find((x) => x.uasId === uasId)!
    expect(a.arrivalS).toBeCloseTo(125.5, 9)

    const r = resolveEngagements(scenario, [a])
    expect(r.events[0].lateEffect).toBe(false)
    expect(r.threats[0].expectedKills).toBeCloseTo(INTERCEPT_PK, 9)
    expect(r.threats[0].expectedLateKills).toBe(0)
  })

  it('has no late mass at all when no asset is placed', () => {
    // Nothing to arrive at: the whole ledger stays pre-arrival, so an
    // asset-free laydown reports exactly what it did before the split.
    const { scenario } = longScenario([slowInterceptor()])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(r.events[0].lateEffect).toBe(false)
    expect(t.expectedKills).toBeCloseTo(INTERCEPT_PK, 9)
    expect(t.expectedLateKills).toBe(0)
    expect(r.totals.expectedLateKills).toBe(0)
  })
})

/*
 * ================== EXPENDITURE CHANNEL (kinetic/DE/EW) ===================
 * isHardKill answers what a salvo DESTROYS; expenditureChannel answers what
 * it COSTS. Directed energy is a hard kill that fires no round, so its
 * expenditure used to land in shotsFired and read on the board as
 * interceptors that were never launched.
 */
describe('expenditure channel split', () => {
  it('maps every effector type to its expenditure channel', () => {
    expect(expenditureChannel('interceptor')).toBe('kinetic')
    expect(expenditureChannel('gun')).toBe('kinetic')
    expect(expenditureChannel('net')).toBe('kinetic')
    expect(expenditureChannel('de')).toBe('directed-energy')
    expect(expenditureChannel('hpm')).toBe('directed-energy')
    expect(expenditureChannel('jammer')).toBe('ew')
  })

  it('keeps the kill channel untouched: DE and HPM stay hard kills', () => {
    expect(isHardKill('de')).toBe(true)
    expect(isHardKill('hpm')).toBe(true)
    expect(isHardKill('jammer')).toBe(false)
  })

  it('counts an HPM burst as directed energy, never as a round fired', () => {
    // Same geometry as the kinetic suite: one salvo at t = 5.5, d = 990,
    // Pk = 0.5 * 0.703 = 0.3515. The burst is a hard kill with no round.
    const hpm: SpecModel = {
      ...interceptor({ pk: 0.5, salvoCooldownS: 1000 }),
      id: 'tst-hpm',
      name: 'test hpm',
      effector: {
        effectorType: 'hpm',
        minRangeM: 0,
        maxRangeM: 1000,
        engageTimeS: 0,
        pk: 0.5,
        salvoCooldownS: 1000,
      },
    }
    const { scenario, effId } = singleThreatScenario(hpm)
    const r = resolveEngagements(scenario)

    const t = r.threats[0]
    expect(t.shotsFired).toBe(0) // kinetic ledger stays empty
    expect(t.deSalvos).toBe(1)
    expect(t.jamSalvos).toBe(0)
    // Kill math is unchanged: still a hard kill, still not soft.
    expect(t.expectedHardKills).toBeCloseTo(0.3515, 6)
    expect(t.expectedSoftKills).toBe(0)
    expect(t.expectedKills).toBeCloseTo(0.3515, 6)
    expect(t.killedBySoft).toBe(false)

    const e = r.effectors.find((x) => x.effectorId === effId)!
    expect(e.shotsFired).toBe(0)
    expect(e.deSalvos).toBe(1)
    expect(e.jamSalvos).toBe(0)
    expect(e.expectedRoundsRemaining).toBeNull() // no magazine to spend

    expect(r.totals.shotsFired).toBe(0)
    expect(r.totals.deSalvos).toBe(1)
    expect(r.totals.jamSalvos).toBe(0)

    const ev = r.events[0]
    expect(ev.effectorType).toBe('hpm')
    expect(ev.channelClass).toBe('directed-energy')
    expect(ev.channel).toBe('kill')
    expect(ev.softShot).toBe(false) // DE is not EW, and it is not soft
  })

  it('splits one interceptor, one DE, and one jammer three ways', () => {
    // Interceptor, DE, and jammer all at the origin against a mixed-nav
    // target, one salvo each at t = 5.5. Three effectors, three ledgers.
    const intModel = interceptor({ pk: 0.5, salvoCooldownS: 1000 })
    const deModel: SpecModel = {
      ...intModel,
      id: 'tst-de',
      name: 'test de',
      effector: {
        effectorType: 'de',
        minRangeM: 0,
        maxRangeM: 1000,
        engageTimeS: 0,
        pk: 0.5,
        salvoCooldownS: 1000,
      },
    }
    const jamModel = jammer({ pk: 0.5, salvoCooldownS: 1000 })
    const scenario = legacyScenario()
    scenario.library = [...scenario.library, SENSOR, TARGET_MIXED, intModel, deModel, jamModel]
    const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
    const int = ent('effector', intModel.id, { x: 0, y: 0 })
    const de = ent('effector', deModel.id, { x: 0, y: 0 })
    const jam = ent('effector', jamModel.id, { x: 0, y: 0 })
    const uas = ent('uas', TARGET_MIXED.id, { x: -1210, y: 0 })
    scenario.entities = [sensor, int, de, jam, uas]
    scenario.connections = [link(sensor.id, int.id), link(sensor.id, de.id), link(sensor.id, jam.id)]
    scenario.paths = [flight(uas.id, [{ x: -1210, y: 0 }, { x: 3000, y: 0 }])]

    const r = resolveEngagements(scenario)
    expect(r.totals.shotsFired).toBe(1)
    expect(r.totals.deSalvos).toBe(1)
    expect(r.totals.jamSalvos).toBe(1)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(1)
    expect(t.deSalvos).toBe(1)
    expect(t.jamSalvos).toBe(1)
    expect(r.effectors.find((x) => x.effectorId === int.id)!.shotsFired).toBe(1)
    expect(r.effectors.find((x) => x.effectorId === de.id)!.deSalvos).toBe(1)
    expect(r.effectors.find((x) => x.effectorId === jam.id)!.jamSalvos).toBe(1)
    expect(r.events.map((e) => e.channelClass)).toEqual(['kinetic', 'directed-energy', 'ew'])
  })
})

/*
 * ================== RAID PARTITION (defeated / leaked / no arrival) =======
 * Every ship lands in exactly one bucket and the three sum to raidSize.
 * The engine used to report raidSize minus kills as leakers, which charged a
 * fly-by, and every ship of an asset-free run, as though it had reached a
 * defended asset.
 */
describe('raid partition', () => {
  /**
   * Sensor and interceptor at the origin, asset at x = 2000.
   * Threat A runs the lane through the 1000 m envelope and crosses the 500 m
   * boundary at t = 68.0 (x = 1510). Threat B runs a parallel lane 5000 m
   * south: detected by the 50 km radar, never inside the envelope, and never
   * within 500 m of the asset.
   */
  function partitionScenario(withAsset = true): {
    scenario: Scenario
    aId: string
    bId: string
  } {
    const scenario = legacyScenario()
    const model = interceptor({ pk: 0.5, magazineSize: 1, salvoCooldownS: 1000 })
    scenario.library = [...scenario.library, SENSOR, TARGET, model]
    const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
    const eff = ent('effector', model.id, { x: 0, y: 0 })
    const a = ent('uas', TARGET.id, { x: -1210, y: 0 })
    const b = ent('uas', TARGET.id, { x: -1210, y: 5000 })
    scenario.entities = [sensor, eff, a, b]
    if (withAsset) scenario.entities.push(asset({ x: 2000, y: 0 }))
    scenario.connections = [link(sensor.id, eff.id)]
    scenario.paths = [
      flight(a.id, [{ x: -1210, y: 0 }, { x: 3000, y: 0 }]),
      flight(b.id, [{ x: -1210, y: 5000 }, { x: 3000, y: 5000 }]),
    ]
    return { scenario, aId: a.id, bId: b.id }
  }

  it('splits a raid into defeated, leaked, and never-arrived mass', () => {
    // A: one shot at t = 5.5, d = 990, Pk = 0.5 * 0.703 = 0.3515, landing
    // long before its arrival at t = 68.0. So A contributes 0.3515 defeat
    // mass and 0.6485 leaker mass.
    // B: never engaged and never inside the boundary, so its whole ship is
    // never-arrived mass. It is NOT a leaker.
    const { scenario, aId, bId } = partitionScenario()
    const assessments = assessAllThreats(scenario)
    expect(assessments.find((x) => x.uasId === aId)!.arrivalS).toBeCloseTo(68, 9)
    expect(assessments.find((x) => x.uasId === bId)!.arrivalS).toBeNull()

    const r = resolveEngagements(scenario, assessments)
    const a = r.threats.find((t) => t.uasId === aId)!
    const b = r.threats.find((t) => t.uasId === bId)!

    expect(a.arrived).toBe(true)
    expect(a.expectedKills).toBeCloseTo(0.3515, 6)
    expect(a.expectedLeakers).toBeCloseTo(0.6485, 6)
    expect(a.expectedNoArrival).toBe(0)

    expect(b.arrived).toBe(false)
    expect(b.expectedKills).toBe(0)
    expect(b.expectedLeakers).toBe(0)
    expect(b.expectedNoArrival).toBe(1)

    expect(r.totals.raidSize).toBe(2)
    expect(r.totals.expectedKills).toBeCloseTo(0.3515, 6)
    expect(r.totals.expectedLeakers).toBeCloseTo(0.6485, 6)
    expect(r.totals.expectedNoArrival).toBe(1)
    // The identity the buckets exist to guarantee.
    expect(
      r.totals.expectedKills + r.totals.expectedLeakers + r.totals.expectedNoArrival,
    ).toBeCloseTo(r.totals.raidSize, 9)
    // Every row partitions its own ships the same way.
    for (const t of r.threats) {
      expect(t.expectedKills + t.expectedLeakers + t.expectedNoArrival).toBeCloseTo(
        t.shipCount,
        9,
      )
    }
  })

  it('reports a measured zero when an asset exists and nothing reaches it', () => {
    // Only the fly-by lane, with the asset still on the board. Zero leakers
    // here is a real measurement, so reportedLeakers is the number 0.
    const { scenario, aId } = partitionScenario()
    scenario.entities = scenario.entities.filter((e) => e.id !== aId)
    scenario.paths = scenario.paths.filter((p) => p.entityId !== aId)

    const r = resolveEngagements(scenario)
    expect(r.totals.raidSize).toBe(1)
    expect(r.totals.expectedLeakers).toBe(0)
    expect(r.totals.expectedNoArrival).toBe(1)
    expect(r.totals.reportedLeakers).toBe(0)
  })

  it('reports leakers as NOT MEASURABLE when no asset is placed', () => {
    // Same two threats, asset removed. Nothing can leak past a boundary that
    // does not exist, so the whole undefeated mass is never-arrived and the
    // display figure is null. Printing 0 here would read as perfect defence.
    const { scenario } = partitionScenario(false)
    const r = resolveEngagements(scenario)
    expect(r.totals.raidSize).toBe(2)
    expect(r.totals.expectedKills).toBeCloseTo(0.3515, 6)
    expect(r.totals.expectedLeakers).toBe(0)
    expect(r.totals.expectedNoArrival).toBeCloseTo(2 - 0.3515, 6)
    expect(r.totals.reportedLeakers).toBeNull()
    expect(r.threats.every((t) => !t.arrived)).toBe(true)
    expect(
      r.totals.expectedKills + r.totals.expectedLeakers + r.totals.expectedNoArrival,
    ).toBeCloseTo(r.totals.raidSize, 9)
  })

  it('keeps late kill mass inside the leaker count, never subtracted from it', () => {
    // The late-kill laydown: the only intercept lands at t = 125.5, well
    // after arrival at t = 43.0. The ship is destroyed, but it leaked first,
    // so the leaker bucket carries the whole ship and expectedLateKills is a
    // sub-measure of it rather than a deduction.
    const { scenario } = longScenario([
      interceptor({
        pk: 0.5,
        maxRangeM: 4000,
        engageTimeS: 120,
        magazineSize: 1,
        salvoCooldownS: 1000,
      }),
    ])
    scenario.entities.push(asset({ x: -2000, y: 0 }))
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.arrived).toBe(true)
    expect(t.expectedLateKills).toBeCloseTo(0.5 * (1 - 0.3 * (810 / 4000)), 9)
    expect(t.expectedKills).toBe(0)
    expect(t.expectedLeakers).toBe(1) // the full ship leaked
    expect(t.expectedNoArrival).toBe(0)
    expect(r.totals.reportedLeakers).toBe(1)
    expect(r.totals.expectedLeakers).toBeGreaterThan(r.totals.expectedLateKills)
  })
})

describe('altitude geometry in the envelope', () => {
  function atAltitude(scenario: Scenario, altitudeFt: number): void {
    scenario.entities = scenario.entities.map((e) => (e.kind === 'uas' ? { ...e, altitudeFt } : e))
  }

  it('takes zero shots at a threat above the effector ceiling', () => {
    const { scenario } = singleThreatScenario(
      interceptor({ pk: 0.5, magazineSize: 10, salvoCooldownS: 1000, maxAltitudeFt: 3000 }),
    )
    atAltitude(scenario, 14000)
    const r = resolveEngagements(scenario)
    expect(r.threats[0].shotsFired).toBe(0)
    expect(r.threats[0].expectedKills).toBe(0)
  })

  it('opens the window on slant range and charges the falloff at the slant', () => {
    // 600 m above the 4 m mount: the 1000 m envelope is an 800 m ground ring.
    // The threat crosses it at t = 10.25 (1210 - 800 = 410 m at 40 m/s), so
    // the first DT-grid shot is at t = 10.5 with ground 790 m, slant
    // hypot(790, 600) = 992.02 m; one step earlier the slant is 1008 m.
    const { scenario } = singleThreatScenario(
      interceptor({ pk: 0.5, magazineSize: 10, salvoCooldownS: 1000 }),
    )
    atAltitude(scenario, (600 + MOUNT_HEIGHT_M) / FT_TO_M)
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    const slantM = Math.hypot(790, 600)
    expect(t.shotsFired).toBe(1)
    expect(t.firstShotS).toBeCloseTo(10.5, 6)
    expect(t.expectedKills).toBeCloseTo(0.5 * (1 - 0.3 * (slantM / 1000)), 6)
  })
})

/**
 * Legacy instant-release engine (doctrine off). These fixtures assert the
 * pre-doctrine numbers: the ROE gate alone opens the window and every ready
 * effector volleys. New scenarios default to the doctrinal sequence.
 */
function legacyScenario(): ReturnType<typeof emptyScenario> {
  const s = emptyScenario()
  s.doctrine = { ...s.doctrine!, enabled: false }
  return s
}

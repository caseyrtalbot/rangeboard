import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { RCS_PLANNING_M2 } from '../model/rcsFactors'
import type {
  Connection,
  EffectorSpec,
  Entity,
  FlightPath,
  Scenario,
  SpecModel,
  UasSpec,
  Vec2,
} from '../model/types'
import { MOUNT_HEIGHT_M } from '../model/types'
import { FT_TO_M } from '../analysis/sensorEnv'
import { distanceFalloff, resolveEngagements } from './attrition'
import { assessAllThreats } from './sim'
import { buildAarSummary } from '../analysis/aar'

/**
 * INDEPENDENT ADVERSARIAL VERIFICATION of the latency/connectivity fixes.
 * Every expected number below is derived by hand in the comment above the
 * assertion; none is copied from engine output. Scenarios pin environment
 * apply = false so spec ranges are exact, and use a group 4 fixed-wing
 * target (size penalty 1.0, no evasion penalty) so per-shot
 * Pk = pk * distanceFalloff exactly.
 *
 * Shared timing model (verified against sim.ts / attrition.ts):
 * - assessThreat samples at DT = 0.5 from the path delay (0 here), so an
 *   envelope entered at continuous time W is first sampled at the next grid
 *   point ceil(W / 0.5) * 0.5.
 * - resolveEngagements sweeps t = 0, 0.5, 1.0, ... An assignment at t needs
 *   gate <= t, t inside an in-range interval, and tEffect = t + engageTimeS
 *   inside the interval set of the SAME effector.
 */

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

function flight(entityId: string, points: Vec2[], speedMps = 40): FlightPath {
  seq += 1
  return { id: `path-${seq}`, entityId, points, speedMps, startDelayS: 0 }
}

/**
 * Omni radar, classify null (no fire-control promotion path), exact range:
 * the range is quoted against the Group 4 target below (refRcsM2 = its RCS
 * tier), so the RCS scaling factor is exactly 1 and the arithmetic in the
 * cases stays spec-exact.
 */
function radarModel(id: string, detectRangeM = 50000): SpecModel {
  return {
    id,
    name: id,
    kind: 'sensor',
    description: '',
    color: '#fff',
    builtin: false,
    sensor: {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM,
      classifyRangeM: null,
      sectorDeg: 360,
      refRcsM2: RCS_PLANNING_M2[4],
    },
  }
}

/** Group 4 fixed-wing: SIZE_PENALTY 1.0, no FPV evasion penalty. */
function uasModel(id: string, patch?: Partial<UasSpec>): SpecModel {
  return {
    id,
    name: id,
    kind: 'uas',
    description: '',
    color: '#fff',
    builtin: false,
    uas: {
      group: 4,
      airframe: 'fixed-wing',
      // Placard case, so the Pd model reproduces the fourth-root law exactly.
      swerling: 1,
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

function effModel(id: string, spec: Partial<EffectorSpec>): SpecModel {
  return {
    id,
    name: id,
    kind: 'effector',
    description: '',
    color: '#fff',
    builtin: false,
    effector: {
      effectorType: 'interceptor',
      minRangeM: 0,
      maxRangeM: 1000,
      engageTimeS: 0,
      ...spec,
    },
  }
}

/** Empty scenario with environment effects OFF so all ranges are spec-exact. */
function base(): Scenario {
  const s = legacyScenario()
  s.environment.apply = false
  return s
}

/*
 * Standard crossing geometry used by most cases below.
 * Threat starts at (-2010, 0), flies due east at 40 m/s to (2010, 0).
 * Sensor and effector(s) sit at the origin. x(t) = -2010 + 40 t.
 * For a co-located 1000 m envelope: |x| <= 1000 gives the continuous
 * interval t in [25.25, 75.25]; DT-grid samples give [25.5, 75.0]
 * (t = 25.0 -> x = -1010 out; t = 25.5 -> x = -990 in;
 *  t = 75.0 -> x =  990 in;  t = 75.5 -> x = 1010 out).
 * Tight-ROE gate: detected from t = 0 (50 km radar), 144 kph > 50 kph makes
 * the track suspected at t = 0, hostile at the first grid step with distance
 * to a CONNECTED effector <= its max range: t = 25.5.
 */
function crossing(effectorModels: SpecModel[], connectTo?: string[]) {
  const scenario = base()
  const radar = radarModel(`vr-radar-${++seq}`)
  const target = uasModel(`vr-uas-${++seq}`)
  scenario.library = [...scenario.library, radar, target, ...effectorModels]
  const sensor = ent('sensor', radar.id, { x: 0, y: 0 })
  const effs = effectorModels.map((m) => ent('effector', m.id, { x: 0, y: 0 }))
  const uas = ent('uas', target.id, { x: -2010, y: 0 })
  scenario.entities = [sensor, ...effs, uas]
  const connected = connectTo ?? effectorModels.map((m) => m.id)
  scenario.connections = effs
    .filter((e) => connected.includes(e.specId!))
    .map((e) => link(sensor.id, e.id))
  scenario.paths = [
    flight(uas.id, [
      { x: -2010, y: 0 },
      { x: 2010, y: 0 },
    ]),
  ]
  return { scenario, effIds: effs.map((e) => e.id), uasId: uas.id, sensorId: sensor.id }
}

describe('CLAIM 1 - assignment latency, closed-form single interceptor', () => {
  it('derives firstShotS, shot count, and the survival product by hand', () => {
    // Interceptor: maxRange 1000, engageTime 10, pk 0.6, cooldown 20, mag 10.
    // Window (grid): [25.5, 75.0]. Gate (tight): hostile at t = 25.5.
    //
    // Sweep:
    //   t = 25.5: gate met, t in window, tEffect = 35.5 <= 75.0 -> SHOT 1.
    //             nextReady = 45.5.
    //   t = 45.5: tEffect = 55.5 <= 75.0 -> SHOT 2. nextReady = 65.5.
    //   t = 65.5: tEffect = 75.5 > 75.0 -> NO SHOT (target would have exited
    //             the envelope before the intercept arrives).
    //   t in (65.5, 75.0]: tEffect = t + 10 > 75.0 always -> no more shots.
    // Total shots = 2, firstShotS = 25.5, rounds remaining = 8.
    //
    // Kill math at tEffect (not at assignment):
    //   Shot 1 lands t = 35.5: x = -2010 + 40*35.5 = -590, d = 590.
    //     falloff = 1 - 0.3*(590/1000) = 0.823; Pk1 = 0.6*0.823 = 0.4938.
    //   Shot 2 lands t = 55.5: x = -2010 + 40*55.5 = 210, d = 210.
    //     falloff = 1 - 0.3*(210/1000) = 0.937; Pk2 = 0.6*0.937 = 0.5622.
    // Survival = (1-0.4938)(1-0.5622) = 0.5062*0.4378 = 0.22161436.
    // expectedKills = 0.77838564; leak = 0.22161436.
    const model = effModel(`vr-int-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 10,
      pk: 0.6,
      salvoCooldownS: 20,
      magazineSize: 10,
    })
    const { scenario, effIds: [effId] } = crossing([model])

    const a = assessAllThreats(scenario)[0]
    expect(a.status).toBe('engageable')
    expect(a.engageGateS).toBeCloseTo(25.5, 9)
    expect(a.classificationAtS.hostileAtS).toBeCloseTo(25.5, 9)
    // Window: gate 25.5 clamps the [25.5, 75.0] interval to itself.
    expect(a.windowS).toEqual([25.5, 75])
    expect(a.windowEffectorId).toBe(effId)

    const r = resolveEngagements(scenario, [a])
    const t = r.threats[0]
    expect(t.firstShotS).toBeCloseTo(25.5, 9)
    expect(t.shotsFired).toBe(2)
    const pk1 = 0.6 * (1 - 0.3 * (590 / 1000)) // 0.4938
    const pk2 = 0.6 * (1 - 0.3 * (210 / 1000)) // 0.5622
    expect(t.expectedKills).toBeCloseTo(1 - (1 - pk1) * (1 - pk2), 6) // 0.778386
    expect(t.leakProbability).toBeCloseTo((1 - pk1) * (1 - pk2), 6) // 0.221614
    expect(t.expectedHardKills).toBeCloseTo(t.expectedKills, 9)
    expect(t.expectedSoftKills).toBe(0)
    expect(t.killedByEffectorId).toBe(effId)
    const e = r.effectors.find((x) => x.effectorId === effId)!
    expect(e.shotsFired).toBe(2)
    expect(e.expectedRoundsRemaining).toBe(8)
  })

  it('cross-surface: totals identity and buildAarSummary agree with the report', () => {
    // Same scenario as above. raidSize 1 = kills + leakers must hold to 1e-9,
    // and the AAR summary must carry the report totals through unchanged.
    const model = effModel(`vr-int-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 10,
      pk: 0.6,
      salvoCooldownS: 20,
      magazineSize: 10,
    })
    const { scenario } = crossing([model])
    const assessments = assessAllThreats(scenario)
    const r = resolveEngagements(scenario, assessments)

    // The raid partitions three ways, not two: defeated, arrived undefeated,
    // and never arrived. This laydown places no asset, so the 0.22161436
    // survivor mass is never-arrived and the leaker bucket is empty.
    expect(
      Math.abs(
        r.totals.raidSize -
          (r.totals.expectedKills + r.totals.expectedLeakers + r.totals.expectedNoArrival),
      ),
    ).toBeLessThan(1e-9)
    expect(r.totals.expectedLeakers).toBe(0)
    expect(r.totals.expectedNoArrival).toBeCloseTo(0.22161436, 6)
    expect(r.totals.reportedLeakers).toBeNull() // not measurable, never 0

    const aar = buildAarSummary(scenario, assessments, r, [])
    expect(aar.raidSize).toBe(r.totals.raidSize)
    expect(aar.expectedKills).toBe(r.totals.expectedKills)
    expect(aar.expectedHardKills).toBe(r.totals.expectedHardKills)
    expect(aar.expectedSoftKills).toBe(r.totals.expectedSoftKills)
    // AarSummary carries UNDEFEATED ships (leakers plus never-arrived), the
    // combined figure its pinned shape has always stored.
    expect(aar.expectedLeakers).toBeCloseTo(
      r.totals.expectedLeakers + r.totals.expectedNoArrival,
      9,
    )
    expect(aar.shotsFired).toBe(r.totals.shotsFired)
    // Hand values: firstDetect t = 0 (d = 2010 < 50 km), first shot 25.5.
    expect(aar.firstDetectS).toBeCloseTo(0, 9)
    expect(aar.firstShotS).toBeCloseTo(25.5, 9)
    // leakProbability = undefeated / raidSize = 0.22161436.
    expect(aar.leakProbability).toBeCloseTo(0.22161436, 6)
  })
})

describe('CLAIM 1 refutation (a) - threat exits the envelope before the effect', () => {
  it('never fires a shot whose intercept would land after window close', () => {
    // engageTime 40, cooldown 5, magazine 20 in the same [25.5, 75.0] window.
    // Valid assignments need t + 40 <= 75.0, so t <= 35.0.
    //   t = 25.5: SHOT (tEffect 65.5). nextReady 30.5.
    //   t = 30.5: SHOT (tEffect 70.5). nextReady 35.5.
    //   t = 35.5: tEffect 75.5 > 75.0 -> blocked; all later t blocked too.
    // A latency-ignoring engine would fire at 25.5 + 5k <= 75.0: 10 shots.
    // Correct count = 2.
    //
    // Kill math at tEffect:
    //   t = 65.5: x = -2010 + 2620 =  610, falloff = 1 - 0.183 = 0.817,
    //             Pk = 0.6*0.817 = 0.4902.
    //   t = 70.5: x = -2010 + 2820 =  810, falloff = 1 - 0.243 = 0.757,
    //             Pk = 0.6*0.757 = 0.4542.
    // kills = 1 - 0.5098*0.5458 = 1 - 0.27824884 = 0.72175116.
    const model = effModel(`vr-int-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 40,
      pk: 0.6,
      salvoCooldownS: 5,
      magazineSize: 20,
    })
    const { scenario, effIds: [effId] } = crossing([model])
    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(2)
    expect(t.firstShotS).toBeCloseTo(25.5, 9)
    const pkA = 0.6 * (1 - 0.3 * (610 / 1000))
    const pkB = 0.6 * (1 - 0.3 * (810 / 1000))
    expect(t.expectedKills).toBeCloseTo(1 - (1 - pkA) * (1 - pkB), 6) // 0.721751
    expect(r.effectors.find((x) => x.effectorId === effId)!.expectedRoundsRemaining).toBe(18)
  })
})

describe('CLAIM 1 refutation (b) - no kill before gate + engageTimeS', () => {
  it('holds fire until the ROE gate, then credits tEffect geometry only', () => {
    // ROE free, tiny 400 m radar: the envelope opens at 25.5 but detection
    // (|x| <= 400 -> t in [40.25, 60.25], grid 40.5) gates the first shot.
    // Interceptor: maxRange 1000, engageTime 30, pk 0.6, cooldown 1000.
    // Window = [max(25.5, 40.5), 75.0] = [40.5, 75.0], len 34.5 >= 30.
    //   First (and only) shot: t = 40.5, tEffect = 70.5 <= 75.0.
    // Kill lands at gate + engageTime = 70.5, never earlier:
    //   x(70.5) = -2010 + 2820 = 810, falloff = 0.757, Pk = 0.4542.
    // Buggy alternatives this excludes:
    //   effect at assignment geometry x(40.5) = -390 -> Pk = 0.6*0.883 = 0.5298
    //   shot at window open (ignoring gate) t=25.5, d=990 -> Pk = 0.4218
    const model = effModel(`vr-int-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 30,
      pk: 0.6,
      salvoCooldownS: 1000,
      magazineSize: 5,
    })
    const { scenario } = crossing([model])
    scenario.roe = 'free'
    // Shrink the radar to 400 m (environment apply is off, so exact).
    const radarSpec = scenario.library.find((m) => m.sensor && m.id.startsWith('vr-radar'))!
    radarSpec.sensor!.detectRangeM = 400

    const a = assessAllThreats(scenario)[0]
    expect(a.firstDetectS).toBeCloseTo(40.5, 9)
    expect(a.engageGateS).toBeCloseTo(40.5, 9)
    expect(a.status).toBe('engageable')
    expect(a.windowS).toEqual([40.5, 75])

    const r = resolveEngagements(scenario, [a])
    const t = r.threats[0]
    expect(t.shotsFired).toBe(1)
    expect(t.firstShotS).toBeCloseTo(40.5, 9) // NOT 25.5 (window open)
    const pkCorrect = 0.6 * (1 - 0.3 * (810 / 1000)) // 0.4542 at tEffect 70.5
    expect(t.expectedKills).toBeCloseTo(pkCorrect, 6)
    // Explicitly refute the two buggy geometries.
    expect(Math.abs(t.expectedKills - 0.5298)).toBeGreaterThan(1e-3)
    expect(Math.abs(t.expectedKills - 0.4218)).toBeGreaterThan(1e-3)
  })

  it('a post-gate window shorter than engageTimeS yields no shots at all', () => {
    // Same laydown, engageTime 40 > post-gate window length 34.5:
    // no assignment can land inside the envelope, so status degrades to
    // window-too-short and the attrition sweep takes zero shots.
    const model = effModel(`vr-int-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 40,
      pk: 0.6,
      salvoCooldownS: 1000,
      magazineSize: 5,
    })
    const { scenario } = crossing([model])
    scenario.roe = 'free'
    const radarSpec = scenario.library.find((m) => m.sensor && m.id.startsWith('vr-radar'))!
    radarSpec.sensor!.detectRangeM = 400

    const a = assessAllThreats(scenario)[0]
    expect(a.status).toBe('window-too-short')
    const r = resolveEngagements(scenario, [a])
    expect(r.threats[0].shotsFired).toBe(0)
    expect(r.threats[0].expectedKills).toBe(0)
    expect(r.threats[0].leakProbability).toBe(1)
  })
})

describe('CLAIM 2 - distanceFalloff is zero beyond max range', () => {
  it('is 0 past max range, 0.7 at max range, 1 at the muzzle, 0 when degenerate', () => {
    expect(distanceFalloff(1000 + 1e-6, 1000)).toBe(0)
    expect(distanceFalloff(999999, 1000)).toBe(0)
    // At exactly max range: 1 - 0.3*1 = 0.7 (in-envelope, consistent with
    // pointInSector's inclusive d <= rangeM).
    expect(distanceFalloff(1000, 1000)).toBeCloseTo(0.7, 12)
    expect(distanceFalloff(0, 1000)).toBe(1)
    expect(distanceFalloff(500, 0)).toBe(0)
    expect(distanceFalloff(0, 0)).toBe(0)
    expect(distanceFalloff(10, -5)).toBe(0)
  })
})

describe('CLAIM 3 - magazine cap with a very long window and short cooldown', () => {
  it('stops at exactly magazineSize shots despite ~100 firing opportunities', () => {
    // Threat from (-4210, 0) east at 40 to (4000, 0); 4000 m envelope:
    // |x| <= 4000 -> t in [5.25, 205.25], grid opens 5.5 (~200 s window).
    // Cooldown 2 s -> ~100 opportunities; magazine 3.
    // Gate: hostile at first grid step with d <= 4000: t = 5.5.
    // Shots at t = 5.5, 7.5, 9.5, then rounds = 0 forever.
    //   t = 5.5: x = -3990, falloff = 1 - 0.3*(3990/4000) = 0.70075,
    //            Pk = 0.6*0.70075 = 0.420450
    //   t = 7.5: x = -3910, falloff = 0.70675, Pk = 0.424050
    //   t = 9.5: x = -3830, falloff = 0.71275, Pk = 0.427650
    // Survival = 0.57955 * 0.57595 * 0.57235 = 0.19104575 (to 8 dp);
    // kills = 0.80895425.
    const model = effModel(`vr-int-${++seq}`, {
      maxRangeM: 4000,
      engageTimeS: 0,
      pk: 0.6,
      salvoCooldownS: 2,
      magazineSize: 3,
    })
    const scenario = base()
    const radar = radarModel(`vr-radar-${++seq}`)
    const target = uasModel(`vr-uas-${++seq}`)
    scenario.library = [...scenario.library, radar, target, model]
    const sensor = ent('sensor', radar.id, { x: 0, y: 0 })
    const eff = ent('effector', model.id, { x: 0, y: 0 })
    const uas = ent('uas', target.id, { x: -4210, y: 0 })
    scenario.entities = [sensor, eff, uas]
    scenario.connections = [link(sensor.id, eff.id)]
    scenario.paths = [
      flight(uas.id, [
        { x: -4210, y: 0 },
        { x: 4000, y: 0 },
      ]),
    ]

    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    expect(t.shotsFired).toBe(3) // never 4+, never the ~100 the window allows
    expect(t.firstShotS).toBeCloseTo(5.5, 9)
    const pk1 = 0.6 * (1 - 0.3 * (3990 / 4000))
    const pk2 = 0.6 * (1 - 0.3 * (3910 / 4000))
    const pk3 = 0.6 * (1 - 0.3 * (3830 / 4000))
    expect(t.expectedKills).toBeCloseTo(1 - (1 - pk1) * (1 - pk2) * (1 - pk3), 6) // 0.808954
    const e = r.effectors.find((x) => x.effectorId === eff.id)!
    expect(e.shotsFired).toBe(3)
    expect(e.expectedRoundsRemaining).toBe(0)
  })
})

describe('CLAIM 1 refutation (d) - buffered jam lands between assignment and effect', () => {
  it('degrades the delayed kill with the jam state at tEffect, both effects buffered', () => {
    // Mixed-nav target (jam behavior 'continue'). Both effectors at origin,
    // 4000 m range; threat (-4210,0) -> (4000,0) at 40; window [5.5, 205.5],
    // gate 5.5.
    // Interceptor (listed FIRST, so assigned first): engageTime 60, pk 0.5.
    //   Assigned t = 5.5, lands 65.5: x = -4210 + 2620 = -1590,
    //   falloff = 1 - 0.3*(1590/4000) = 0.88075, pkI = 0.440375.
    // Jammer: engageTime 10, pk 0.5.
    //   Assigned t = 5.5, lands 15.5: x = -4210 + 620 = -3590,
    //   falloff = 1 - 0.3*(3590/4000) = 0.73075, pkJ = 0.365375.
    // Both effects enter the pending queue OUT of tEffect order
    // (kill@65.5 pushed before jam@15.5). Correct tEffect ordering applies
    // the jam first, so the kill is degraded:
    //   hard = pkI * (1 - 0.3*pkJ) = 0.440375 * 0.8903875 = 0.392104
    // Assignment-order bookkeeping would yield the undegraded 0.440375
    // (difference 0.048 -> detectable at 6 decimals).
    const intModel = effModel(`vr-int-${++seq}`, {
      maxRangeM: 4000,
      engageTimeS: 60,
      pk: 0.5,
      salvoCooldownS: 1000,
      magazineSize: 2,
    })
    const jamModel = effModel(`vr-jam-${++seq}`, {
      effectorType: 'jammer',
      maxRangeM: 4000,
      engageTimeS: 10,
      pk: 0.5,
      salvoCooldownS: 1000,
    })
    const scenario = base()
    const radar = radarModel(`vr-radar-${++seq}`)
    const target = uasModel(`vr-uas-${++seq}`, { navMode: 'mixed' }) // 'continue'
    scenario.library = [...scenario.library, radar, target, intModel, jamModel]
    const sensor = ent('sensor', radar.id, { x: 0, y: 0 })
    const interceptor = ent('effector', intModel.id, { x: 0, y: 0 })
    const jammer = ent('effector', jamModel.id, { x: 0, y: 0 })
    const uas = ent('uas', target.id, { x: -4210, y: 0 })
    scenario.entities = [sensor, interceptor, jammer, uas]
    scenario.connections = [link(sensor.id, interceptor.id), link(sensor.id, jammer.id)]
    scenario.paths = [
      flight(uas.id, [
        { x: -4210, y: 0 },
        { x: 4000, y: 0 },
      ]),
    ]

    const r = resolveEngagements(scenario)
    const t = r.threats[0]
    const pkI = 0.5 * (1 - 0.3 * (1590 / 4000)) // 0.440375
    const pkJ = 0.5 * (1 - 0.3 * (3590 / 4000)) // 0.365375
    expect(t.shotsFired).toBe(1) // kinetic (interceptor) only
    expect(t.jamSalvos).toBe(1) // jammer expenditure splits out
    expect(t.continueJamProb).toBeCloseTo(pkJ, 6)
    expect(t.expectedHardKills).toBeCloseTo(pkI * (1 - 0.3 * pkJ), 6) // 0.392104
    expect(t.expectedSoftKills).toBe(0) // 'continue' jams are not mission kills
    expect(t.killedByEffectorId).toBe(interceptor.id)
    expect(t.killedBySoft).toBe(false)
    // Refute assignment-order bookkeeping (undegraded kill).
    expect(Math.abs(t.expectedHardKills - pkI)).toBeGreaterThan(1e-3)
    expect(t.leakProbability).toBeCloseTo(1 - pkI * (1 - 0.3 * pkJ), 6)
  })
})

describe('CLAIM 4 refutation (e) - unconnected in-range effector', () => {
  it('keeps raw geometry in effectorWindows but never in status, windows, or shots', () => {
    // A (connected): 1000 m, grid window [25.5, 75.0].
    // B (NOT connected): 4000 m at the origin; the whole flight is inside it,
    // grid interval [0, 101] (duration = ceil(4020/40) = 101; the final
    // clamped sample at t = 101 sits at (2010, 0), d = 2010 <= 4000).
    // If B leaked into the derived surfaces:
    //   - hostile would fire at t = 0 (d = 2010 <= 4000, ratio 0.5)
    //   - windowS would be [0, 101] (len 101 > 49.5) with effector B
    // Correct: hostile 25.5 (A only), windowS [25.5, 75.0], effector A,
    // B fires zero shots, effectorWindows still lists B's raw [0, 101].
    const modelA = effModel(`vr-intA-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 0,
      pk: 0.6,
      salvoCooldownS: 1000,
      magazineSize: 10,
    })
    const modelB = effModel(`vr-intB-${++seq}`, {
      maxRangeM: 4000,
      engageTimeS: 0,
      pk: 0.9,
      salvoCooldownS: 1,
      magazineSize: 50,
    })
    const { scenario, effIds } = crossing([modelA, modelB], [modelA.id])
    const [aId, bId] = effIds

    const a = assessAllThreats(scenario)[0]
    expect(a.status).toBe('engageable')
    expect(a.classificationAtS.hostileAtS).toBeCloseTo(25.5, 9) // NOT 0 via B
    expect(a.engageGateS).toBeCloseTo(25.5, 9)
    expect(a.windowS).toEqual([25.5, 75]) // NOT [0, 101] via B
    expect(a.windowEffectorId).toBe(aId)
    // Raw geometry for BOTH effectors is retained.
    const winA = a.effectorWindows.find((w) => w.effectorId === aId)!
    const winB = a.effectorWindows.find((w) => w.effectorId === bId)!
    expect(winA.intervals).toEqual([[25.5, 75]])
    expect(winB.intervals).toEqual([[0, 101]])

    const r = resolveEngagements(scenario, [a])
    const t = r.threats[0]
    // Only A fires: one shot at window open t = 25.5, d = 990,
    // Pk = 0.6*(1 - 0.3*0.99) = 0.6*0.703 = 0.4218.
    expect(t.shotsFired).toBe(1)
    expect(t.expectedKills).toBeCloseTo(0.6 * (1 - 0.3 * (990 / 1000)), 6) // 0.4218
    expect(t.killedByEffectorId).toBe(aId)
    const rowB = r.effectors.find((x) => x.effectorId === bId)!
    expect(rowB.shotsFired).toBe(0)
    expect(rowB.expectedRoundsRemaining).toBe(50)
  })
})

describe('CLAIM 4/1 refutation (f) - sector-limited effector', () => {
  it('takes zero shots at a threat that crosses the circle outside the wedge', () => {
    // 90 deg sector, heading 0 (north = -y). Threat crosses west-east along
    // y = +500 (south of the effector): every bearing from the effector to
    // the threat lies in (90, 270) deg, angle difference from north >= 90 >
    // 45 = sector half-width, so the threat is NEVER in the wedge even
    // though it is inside the 1000 m circle for |x| <= sqrt(1000^2-500^2)
    // ~ 866 m. Plain-distance proximity still promotes the track hostile
    // (d_min = 500 <= 1000), but with no in-range interval the status is
    // window-too-short and no shot exists.
    const model = effModel(`vr-sec-${++seq}`, {
      maxRangeM: 1000,
      sectorDeg: 90,
      engageTimeS: 0,
      pk: 0.6,
      salvoCooldownS: 1000,
    })
    const scenario = base()
    const radar = radarModel(`vr-radar-${++seq}`)
    const target = uasModel(`vr-uas-${++seq}`)
    scenario.library = [...scenario.library, radar, target, model]
    const sensor = ent('sensor', radar.id, { x: 0, y: 0 })
    const eff = ent('effector', model.id, { x: 0, y: 0 }, { headingDeg: 0 })
    const uas = ent('uas', target.id, { x: -2010, y: 500 })
    scenario.entities = [sensor, eff, uas]
    scenario.connections = [link(sensor.id, eff.id)]
    scenario.paths = [
      flight(uas.id, [
        { x: -2010, y: 500 },
        { x: 2010, y: 500 },
      ]),
    ]

    const a = assessAllThreats(scenario)[0]
    expect(a.effectorWindows.find((w) => w.effectorId === eff.id)).toBeUndefined()
    expect(a.status).toBe('window-too-short')
    const r = resolveEngagements(scenario, [a])
    expect(r.threats[0].shotsFired).toBe(0)
    expect(r.threats[0].expectedKills).toBe(0)
    expect(r.threats[0].leakProbability).toBe(1)

    // Positive control: face the wedge south (heading 180) and the same
    // crossing IS engaged. In-sector needs |bearing - 180| <= 45, i.e.
    // |x| <= 500 (bearing(origin -> (+-500, 500)) = 135/225 deg exactly):
    // t in [37.75, 62.75], grid window [38.0, 62.5].
    // Gate: hostile at first grid step with d <= 1000 (plain distance):
    // d(t)^2 = x^2 + 500^2 <= 1e6 -> |x| <= 866.03 -> t >= 28.60 -> 29.0.
    // One shot (cooldown 1000) at window open t = 38.0: x = -490,
    // d = sqrt(490^2 + 500^2) = sqrt(490100) ~ 700.07,
    // Pk = 0.6 * (1 - 0.3 * 700.07/1000) = 0.473987.
    eff.headingDeg = 180
    const a2 = assessAllThreats(scenario)[0]
    expect(a2.status).toBe('engageable')
    expect(a2.classificationAtS.hostileAtS).toBeCloseTo(29.0, 9)
    expect(a2.windowS).toEqual([38, 62.5])
    const r2 = resolveEngagements(scenario, [a2])
    const t2 = r2.threats[0]
    expect(t2.shotsFired).toBe(1)
    expect(t2.firstShotS).toBeCloseTo(38.0, 9)
    expect(t2.expectedKills).toBeCloseTo(0.6 * (1 - 0.3 * (Math.hypot(490, 500) / 1000)), 6)
  })
})

describe('documented semantics - interval SET containment allows dead-zone crossings', () => {
  it('an assignment in one interval may land in a later interval of the same effector', () => {
    // Claim 1 as stated requires t and tEffect inside the same effector's
    // in-range interval SET (the union), not the same contiguous interval.
    // Donut effector B: minRange 500, maxRange 1000, engageTime 30. The
    // crossing gives B two intervals: 500 <= |x| <= 1000 ->
    // approach grid [25.5, 37.5], departure grid [63.0, 75.0], with a dead
    // zone between. Long-range effector A (4000 m, engageTime 0, pk 0.2,
    // mag 1) makes the threat engageable and sets gate = 0 (d = 2010 <= 4000
    // at t = 0 -> hostile immediately).
    //   A: one shot at t = 0, d = 2010, Pk = 0.2*(1 - 0.3*2010/4000)
    //      = 0.2*0.84925 = 0.16985.
    //   B: t in [25.5, 32.5] has tEffect in [55.5, 62.5] = dead zone (no
    //      shot); t = 33.0 (inside interval 1) has tEffect = 63.0 = start of
    //      interval 2 -> SHOT across the dead zone. Effect at t = 63.0:
    //      x = 510, Pk = 0.6*(1 - 0.3*0.51) = 0.6*0.847 = 0.5082.
    // kills = 1 - (1-0.16985)(1-0.5082) = 1 - 0.83015*0.4918 = 0.59173223.
    const modelA = effModel(`vr-intA-${++seq}`, {
      maxRangeM: 4000,
      engageTimeS: 0,
      pk: 0.2,
      salvoCooldownS: 1000,
      magazineSize: 1,
    })
    const modelB = effModel(`vr-intB-${++seq}`, {
      minRangeM: 500,
      maxRangeM: 1000,
      engageTimeS: 30,
      pk: 0.6,
      salvoCooldownS: 1000,
      magazineSize: 5,
    })
    const { scenario, effIds } = crossing([modelA, modelB])
    const a = assessAllThreats(scenario)[0]
    const winB = a.effectorWindows.find((w) => w.effectorId === effIds[1])!
    expect(winB.intervals).toEqual([
      [25.5, 37.5],
      [63, 75],
    ])
    const r = resolveEngagements(scenario, [a])
    const t = r.threats[0]
    expect(t.shotsFired).toBe(2)
    const rowB = r.effectors.find((x) => x.effectorId === effIds[1])!
    expect(rowB.shotsFired).toBe(1)
    const pkA = 0.2 * (1 - 0.3 * (2010 / 4000))
    const pkB = 0.6 * (1 - 0.3 * (510 / 1000))
    expect(t.expectedKills).toBeCloseTo(1 - (1 - pkA) * (1 - pkB), 6) // 0.591732
    expect(t.killedByEffectorId).toBe(effIds[1]) // B's 0.42188 > A's 0.16985
  })
})

/*
 * ================= FORMATION ENVELOPE GEOMETRY (Defect A fixed) ============
 * In-range intervals are member-union geometry: a threat is in-range of an
 * effector when ANY formation member is inside the envelope (min range, max
 * range, sector). Ship selection re-verifies the same test per ship at
 * tEffect: shots go only to ships physically inside the envelope; when no
 * ship is inside, the effector holds fire (no magazine spend, no cooldown).
 */

describe('formation member outside the envelope never draws fire', () => {
  it('re-engages the surviving lead instead of wasting rounds at a 5 km wingman', () => {
    // 2-ship line formation, spacing 5000 m. Flight heading east puts the
    // wingman at (x, +5000): >= 5000 m from the origin effector at all
    // times, far beyond its 1000 m envelope. The member-union window is the
    // lead's interval [25.5, 75.0] alone (the wingman adds nothing), and
    // every salvo must pick an IN-ENVELOPE ship: the wingman is never
    // eligible, so all three rounds re-engage the lead.
    //   Shot 1 (t = 25.5): lead only eligible, d = 990,
    //     Pk1 = 0.9*(1 - 0.297) = 0.9*0.703 = 0.6327. lead alive = 0.3673.
    //   Shot 2 (t = 27.5): wingman (alive 1.0) is OUTSIDE -> lead again,
    //     d = 910, Pk2 = 0.9*(1 - 0.273) = 0.9*0.727 = 0.6543.
    //   Shot 3 (t = 29.5): lead again, d = 830,
    //     Pk3 = 0.9*(1 - 0.249) = 0.9*0.751 = 0.6759.
    // lead survival = 0.3673*0.3457*0.3241 = 0.04115280 (8 dp);
    // kills = 1 - 0.04115280 = 0.95884720 (wingman contributes none);
    // leak = (0.04115280 + 1)/2 = 0.52057640.
    const model = effModel(`vr-int-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 0,
      pk: 0.9,
      salvoCooldownS: 2,
      magazineSize: 3,
    })
    const { scenario, uasId, effIds: [effId] } = crossing([model])
    const uas = scenario.entities.find((e) => e.id === uasId)!
    uas.formation = { count: 2, shape: 'line', spacingM: 5000 }

    const a = assessAllThreats(scenario)[0]
    // Member union with an always-outside wingman = the lead interval alone.
    expect(a.effectorWindows.find((w) => w.effectorId === effId)!.intervals).toEqual([[25.5, 75]])
    expect(a.windowS).toEqual([25.5, 75])

    const r = resolveEngagements(scenario, [a])
    const t = r.threats[0]
    expect(t.shipCount).toBe(2)
    expect(t.shotsFired).toBe(3) // all three at the lead, none wasted
    const pk1 = 0.9 * (1 - 0.3 * (990 / 1000)) // 0.6327
    const pk2 = 0.9 * (1 - 0.3 * (910 / 1000)) // 0.6543
    const pk3 = 0.9 * (1 - 0.3 * (830 / 1000)) // 0.6759
    const leadSurvival = (1 - pk1) * (1 - pk2) * (1 - pk3) // 0.04115280
    expect(t.expectedKills).toBeCloseTo(1 - leadSurvival, 6) // 0.958847
    expect(t.leakProbability).toBeCloseTo((leadSurvival + 1) / 2, 6) // 0.520576
    expect(r.effectors[0].expectedRoundsRemaining).toBe(0)
  })
})

describe('wingman-only envelope crossing draws fire', () => {
  it('engages the ship that flies over the effector while the lead stays 5 km out', () => {
    // The LEAD flies along y = -5000 (never within 5000 m of the effector)
    // while the line-formation wingman at (x, -5000+5000) = (x, 0) crosses
    // directly OVER the origin effector. Member-union geometry opens the
    // window from the wingman: |x| <= 1000 -> t in [25.25, 75.25], grid
    // [25.5, 75.0]. Ship selection aims at the only in-envelope ship (the
    // wingman); the lead is never eligible.
    // One shot (cooldown 1000) at t = 25.5: wingman at (-990, 0), d = 990,
    // Pk = 0.9*(1 - 0.297) = 0.9*0.703 = 0.6327.
    // kills = 0.6327; leak = (0.3673 + 1)/2 = 0.68365; rounds 10 -> 9.
    const model = effModel(`vr-int-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 0,
      pk: 0.9,
      salvoCooldownS: 1000,
      magazineSize: 10,
    })
    const scenario = base()
    const radar = radarModel(`vr-radar-${++seq}`)
    const target = uasModel(`vr-uas-${++seq}`)
    scenario.library = [...scenario.library, radar, target, model]
    const sensor = ent('sensor', radar.id, { x: 0, y: 0 })
    const eff = ent('effector', model.id, { x: 0, y: 0 })
    const uas = ent('uas', target.id, { x: -2010, y: -5000 }, {
      formation: { count: 2, shape: 'line', spacingM: 5000 },
    })
    scenario.entities = [sensor, eff, uas]
    scenario.connections = [link(sensor.id, eff.id)]
    scenario.paths = [
      flight(uas.id, [
        { x: -2010, y: -5000 },
        { x: 2010, y: -5000 },
      ]),
    ]

    // Tight ROE stays 'not-confirmed': the classification ladder's proximity
    // promotion reads the lead position (min d = 5000, ratio 5 > 1, never
    // hostile). That is ROE/track semantics, not envelope geometry, and is
    // unchanged by the member-union fix.
    const aTight = assessAllThreats(scenario)[0]
    expect(aTight.status).toBe('not-confirmed')

    scenario.roe = 'free'
    const aFree = assessAllThreats(scenario)[0]
    expect(aFree.status).toBe('engageable') // window from the wingman member
    expect(aFree.effectorWindows.find((w) => w.effectorId === eff.id)!.intervals).toEqual([
      [25.5, 75],
    ])
    expect(aFree.windowS).toEqual([25.5, 75])
    expect(aFree.windowEffectorId).toBe(eff.id)
    const r = resolveEngagements(scenario, [aFree])
    const t = r.threats[0]
    expect(t.shotsFired).toBe(1)
    expect(t.firstShotS).toBeCloseTo(25.5, 9)
    const pk = 0.9 * (1 - 0.3 * (990 / 1000)) // 0.6327 at the wingman
    expect(t.expectedKills).toBeCloseTo(pk, 6)
    expect(t.leakProbability).toBeCloseTo((1 - pk + 1) / 2, 6) // 0.68365
    expect(r.effectors[0].expectedRoundsRemaining).toBe(9)
  })
})

describe('member-union intervals split by ship: column formation', () => {
  it('holds rounds between member windows and engages each ship inside its own', () => {
    // 2-ship column, spacing 3000 m: the trail ship flies 3000 m behind the
    // lead on the same track. Path extended to (5010, 0) so the trail
    // finishes its crossing (duration 7020/40 = 175.5 s).
    //   Lead in the 1000 m envelope: |x| <= 1000 -> grid [25.5, 75.0].
    //   Trail x = -5010 + 40t: |x| <= 1000 -> t in [100.25, 150.25],
    //     grid [100.5, 150.0].
    // Member-union intervals: [[25.5, 75.0], [100.5, 150.0]] with a dead gap
    // between. Gate (tight): hostile at t = 25.5 (lead d <= 1000).
    // Usable-window pick: both gated lengths are 49.5 -> tie -> first wins:
    // windowS = [25.5, 75.0].
    // Sweep (cooldown 30, magazine 10, pk 0.6, engageTime 0):
    //   t = 25.5:  interval 1; lead (d 990) eligible, trail at -3990 not.
    //              Pk1 = 0.6*0.703 = 0.4218. lead alive 0.5782. ready 55.5.
    //   t = 55.5:  interval 1; lead x = 210 eligible (trail -2790 not);
    //              lead re-engaged though trail is "most alive".
    //              Pk2 = 0.6*(1 - 0.063) = 0.5622. lead alive 0.25313596.
    //   t = 85.5+: NO interval contains t -> no target -> rounds HELD
    //              (no spend, no cooldown) across the gap.
    //   t = 100.5: interval 2; trail at -990 eligible, lead at 2010 not.
    //              Pk3 = 0.4218. trail alive 0.5782. ready 130.5.
    //   t = 130.5: interval 2; trail x = 210: Pk4 = 0.5622.
    //              trail alive 0.25313596.
    // Per ship: kills = 1 - 0.5782*0.4378 = 0.74686404.
    // Totals: 4 shots, rounds 10 - 4 = 6, expectedKills = 1.49372808,
    // leakProbability = 0.25313596.
    const model = effModel(`vr-int-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 0,
      pk: 0.6,
      salvoCooldownS: 30,
      magazineSize: 10,
    })
    const { scenario, uasId, effIds: [effId] } = crossing([model])
    const uas = scenario.entities.find((e) => e.id === uasId)!
    uas.formation = { count: 2, shape: 'column', spacingM: 3000 }
    scenario.paths[0].points[1] = { x: 5010, y: 0 }

    const a = assessAllThreats(scenario)[0]
    expect(a.status).toBe('engageable')
    expect(a.classificationAtS.hostileAtS).toBeCloseTo(25.5, 9)
    expect(a.effectorWindows.find((w) => w.effectorId === effId)!.intervals).toEqual([
      [25.5, 75],
      [100.5, 150],
    ])
    expect(a.windowS).toEqual([25.5, 75]) // 49.5 s tie -> first interval wins

    const r = resolveEngagements(scenario, [a])
    const t = r.threats[0]
    expect(t.shotsFired).toBe(4)
    expect(t.firstShotS).toBeCloseTo(25.5, 9)
    const pkNear = 0.6 * (1 - 0.3 * (990 / 1000)) // 0.4218
    const pkFar = 0.6 * (1 - 0.3 * (210 / 1000)) // 0.5622
    const perShipSurvival = (1 - pkNear) * (1 - pkFar) // 0.25313596
    expect(t.expectedKills).toBeCloseTo(2 * (1 - perShipSurvival), 6) // 1.493728
    expect(t.leakProbability).toBeCloseTo(perShipSurvival, 6) // 0.253136
    const e = r.effectors.find((x) => x.effectorId === effId)!
    expect(e.shotsFired).toBe(4)
    expect(e.expectedRoundsRemaining).toBe(6) // rounds held across the gap
  })
})

/*
 * ================= USABLE-WINDOW SELECTION (Defect B fixed) ================
 * A gated interval is usable for effector E when its gated length covers E's
 * OWN engage time. Status is engageable when ANY connected effector has a
 * usable interval; windowS carries the longest usable interval. A long
 * window only usable by a slow effector no longer shadows a shorter window
 * a fast effector can use.
 */

describe('longest window no longer shadows a usable shorter one', () => {
  it('goes engageable via the fast effector and kills with its exact number', () => {
    // A: 4000 m envelope, engageTime 120. Whole flight inside it:
    // gated interval [0, 101] (gate 0: hostile at t = 0, d = 2010 <= 4000),
    // length 101 < 120 -> NOT usable for A.
    // B: 1000 m envelope, engageTime 0, gated interval [25.5, 75.0],
    // length 49.5 >= 0 -> usable -> status engageable, windowS = B's window.
    // Resolve: A can never place tEffect = t + 120 inside its [0, 101]
    // interval set (needs t <= -19), so A holds all 5 rounds. B fires once
    // (cooldown 1000) at window open t = 25.5, d = 990:
    // Pk = 0.6*(1 - 0.297) = 0.6*0.703 = 0.4218.
    // kills = 0.4218; leak = 0.5782.
    const modelA = effModel(`vr-intA-${++seq}`, {
      maxRangeM: 4000,
      engageTimeS: 120,
      pk: 0.5,
      salvoCooldownS: 1000,
      magazineSize: 5,
    })
    const modelB = effModel(`vr-intB-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 0,
      pk: 0.6,
      salvoCooldownS: 1000,
      magazineSize: 5,
    })
    const { scenario, effIds } = crossing([modelA, modelB])
    const a = assessAllThreats(scenario)[0]
    expect(a.engageGateS).toBeCloseTo(0, 9)
    expect(a.status).toBe('engageable') // B's usable window decides
    expect(a.windowS).toEqual([25.5, 75]) // longest USABLE, not longest gated
    expect(a.windowEffectorId).toBe(effIds[1])
    // A's raw geometry is still reported.
    expect(a.effectorWindows.find((w) => w.effectorId === effIds[0])!.intervals).toEqual([
      [0, 101],
    ])
    const r = resolveEngagements(scenario, [a])
    const t = r.threats[0]
    expect(r.totals.shotsFired).toBe(1)
    expect(t.firstShotS).toBeCloseTo(25.5, 9)
    const pkB = 0.6 * (1 - 0.3 * (990 / 1000)) // 0.4218
    expect(t.expectedKills).toBeCloseTo(pkB, 6)
    expect(t.leakProbability).toBeCloseTo(1 - pkB, 6)
    expect(t.killedByEffectorId).toBe(effIds[1])
    const rowA = r.effectors.find((x) => x.effectorId === effIds[0])!
    expect(rowA.shotsFired).toBe(0) // A's own window stays unusable
    expect(rowA.expectedRoundsRemaining).toBe(5)
  })

  it('stays window-too-short when NO connected effector has a usable interval', () => {
    // A alone: gated interval [0, 101] < engageTime 120 -> not usable ->
    // window-too-short, with windowS carrying the longest gated interval as
    // informative geometry. resolveEngagements populates no windows and
    // takes zero shots.
    const modelA = effModel(`vr-intA-${++seq}`, {
      maxRangeM: 4000,
      engageTimeS: 120,
      pk: 0.5,
      salvoCooldownS: 1000,
      magazineSize: 5,
    })
    const { scenario, effIds: [aId] } = crossing([modelA])
    const a = assessAllThreats(scenario)[0]
    expect(a.status).toBe('window-too-short')
    expect(a.windowS).toEqual([0, 101]) // informative: longest gated interval
    expect(a.windowEffectorId).toBe(aId)
    const r = resolveEngagements(scenario, [a])
    expect(r.totals.shotsFired).toBe(0)
    expect(r.threats[0].leakProbability).toBe(1)
  })
})

/*
 * ================= ROUTE LATENCY IS CHARGED FROM THE GATE =================
 * assessThreat charges engageTimeS + route latency against window USABILITY.
 * resolveEngagements used to charge the same latency as an absolute floor
 * measured from T0, so once the ROE gate landed later than the latency the
 * delay disappeared entirely (a 90 s chain with a gate at T+1333.5 still
 * fired at T+1333.5). The cue has to traverse the chain AFTER the track
 * becomes engageable, so the charge is now relative to the gate.
 */

describe('CLAIM 5 - route latency delays the trigger, not just the window', () => {
  /** Standard crossing, 1000 m envelope, one shot available. */
  function latencyCase(latencyS: number) {
    const model = effModel(`vr-lat-${++seq}`, {
      maxRangeM: 1000,
      engageTimeS: 0,
      pk: 0.6,
      salvoCooldownS: 1000,
      magazineSize: 5,
    })
    const { scenario, effIds } = crossing([model])
    scenario.connections[0].latencyS = latencyS
    const a = assessAllThreats(scenario)[0]
    return { scenario, a, effId: effIds[0], r: resolveEngagements(scenario, [a]) }
  }

  it('holds the first salvo until gate + route latency', () => {
    // Window (grid) [25.5, 75.0]; tight-ROE gate 25.5 (first sample with
    // d <= 1000). Route latency 20 s over the single sensor -> effector link.
    // Usability: needS = engageTimeS 0 + latency 20 = 20 <= 49.5 gated
    // length, so the threat stays engageable.
    // First legal assignment: 25.5 + 20 = 45.5, engageTime 0 so the effect
    // lands there too. x(45.5) = -2010 + 1820 = -190, d = 190,
    // falloff = 1 - 0.3 * 0.19 = 0.943, Pk = 0.6 * 0.943 = 0.5658.
    const { a, r } = latencyCase(20)
    expect(a.status).toBe('engageable')
    expect(a.engageGateS).toBeCloseTo(25.5, 9)
    expect(a.windowS).toEqual([25.5, 75])

    const t = r.threats[0]
    expect(t.shotsFired).toBe(1)
    expect(t.firstShotS).toBeCloseTo(45.5, 9)
    // The refutation: an absolute floor from T0 vanishes behind a later gate,
    // leaving delta 0. The charge must be the full latency.
    expect(t.firstShotS! - a.engageGateS!).toBeCloseTo(20, 9)
    expect(t.expectedKills).toBeCloseTo(0.6 * (1 - 0.3 * (190 / 1000)), 6) // 0.5658
    // Explicitly refute the un-delayed geometry at the gate (d = 990).
    expect(Math.abs(t.expectedKills - 0.4218)).toBeGreaterThan(1e-3)
  })

  it('fires at the gate itself when the chain has no latency', () => {
    // Same laydown, latency 0: first shot at the gate, d = 990,
    // Pk = 0.6 * 0.703 = 0.4218. This is the control for the case above.
    const { a, r } = latencyCase(0)
    const t = r.threats[0]
    expect(t.firstShotS).toBeCloseTo(25.5, 9)
    expect(t.firstShotS! - a.engageGateS!).toBe(0)
    expect(t.expectedKills).toBeCloseTo(0.6 * (1 - 0.3 * (990 / 1000)), 6) // 0.4218
  })

  it('spends nothing when the latency pushes the trigger past the window', () => {
    // Latency 60 s: 25.5 + 60 = 85.5 > 75.0 window close. The magazine is
    // untouched and the shot never happens. assessThreat still calls the
    // threat window-too-short here, since needS 60 > the 49.5 gated length.
    const { a, r, effId } = latencyCase(60)
    expect(a.status).toBe('window-too-short')
    expect(r.threats[0].shotsFired).toBe(0)
    expect(r.threats[0].firstShotS).toBeNull()
    expect(r.effectors.find((x) => x.effectorId === effId)!.expectedRoundsRemaining).toBe(5)
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

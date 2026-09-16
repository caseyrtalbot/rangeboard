import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Connection, Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { MOUNT_HEIGHT_M } from '../model/types'
import { FT_TO_M } from '../analysis/sensorEnv'
import { resolveEngagements } from './attrition'
import { assessAllThreats, assessThreat } from './sim'

/**
 * Doctrinal fire-control tests. Fixture geometry mirrors attrition.test.ts:
 * group 4 fixed-wing target (size penalty 1.0, no evasion), radar and
 * effector at known positions, target flying east at 40 m/s from x = -1210.
 * Per-system factors (doctrineFactors.ts): the test radar's 'surveillance'
 * role initiates a track in 6 s; hostile classification lands at t = 5.5
 * (first sample inside the 1000 m effector ring); single-phenomenology ID
 * pays the full 10 s declaration dwell, so the gate is max(5.5, 6) + 10 =
 * 16; the sensor->effector link sets no latencyS, so doctrine charges the
 * 2 s default hop, then the interceptor's 8 s TARGET dwell (TARGET_S), so
 * the effector is release-ready at t = 26 and no shot leaves earlier.
 */

const RADAR: SpecModel = {
  id: 'tst-radar',
  name: 'test radar',
  kind: 'sensor',
  description: '',
  color: '#fff',
  builtin: false,
  sensor: {
    sensorType: 'radar',
    role: 'surveillance',
    // Planning basis: these tests pin the doctrine gate arithmetic on the
    // TRACK_INIT_S role table. A Pd-modeled radar would scan at SCAN_S
    // (2 s) and initiate at its third scan.
    rangeBasis: 'planning',
    detectRangeM: 50000,
    classifyRangeM: null,
    sectorDeg: 360,
  },
}

const RF_SENSOR: SpecModel = {
  id: 'tst-rf',
  name: 'test rf sensor',
  kind: 'sensor',
  description: '',
  color: '#fff',
  builtin: false,
  sensor: {
    sensorType: 'rf',
    role: 'early-warning',
    detectRangeM: 50000,
    classifyRangeM: null,
    sectorDeg: 360,
  },
}

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
    navMode: 'rf-manual',
    emissionsNote: '',
  },
}

function interceptor(id: string, patch: Partial<NonNullable<SpecModel['effector']>>): SpecModel {
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
function ent(kind: Entity['kind'], specId: string, pos: Vec2): Entity {
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

interface Built {
  scenario: Scenario
  uasId: string
  effIds: string[]
}

/** Radar at origin, effectors as given, one threat flying east through them. */
function build(sensorModel: SpecModel, effectorModels: SpecModel[], effPos: Vec2[]): Built {
  const scenario = emptyScenario()
  scenario.roe = 'free'
  scenario.doctrine = {
    enabled: true,
    trackFirmS: 5,
    declareHostileS: 10,
    targetS: 5,
    bdaS: 10,
    pkCommit: 0.35,
    opportunities: 2,
    launchPolicy: 'pk-commit',
    launchRangeFraction: 2 / 3,
  }
  scenario.library = [...scenario.library, sensorModel, TARGET, ...effectorModels]
  const sensor = ent('sensor', sensorModel.id, { x: 0, y: 0 })
  const effs = effectorModels.map((m, i) => ent('effector', m.id, effPos[i]))
  const uas = ent('uas', TARGET.id, { x: -1210, y: 0 })
  scenario.entities = [sensor, ...effs, uas]
  scenario.connections = effs.map((e) => link(sensor.id, e.id))
  scenario.paths = [
    flight(uas.id, [
      { x: -1210, y: 0 },
      { x: 3000, y: 0 },
    ]),
  ]
  return { scenario, uasId: uas.id, effIds: effs.map((e) => e.id) }
}

describe('doctrine gate (sim.ts)', () => {
  it('RF-only detection never builds a stable track: no-stable-track, no gate', () => {
    const { scenario, uasId } = build(RF_SENSOR, [interceptor('tst-int', {})], [{ x: 0, y: 0 }])
    const a = assessThreat(scenario, uasId)
    expect(a.firstDetectS).toBe(0)
    expect(a.stableTrackAtS).toBeNull()
    expect(a.status).toBe('no-stable-track')
    expect(a.engageGateS).toBeNull()
    const report = resolveEngagements(scenario)
    expect(report.totals.shotsFired).toBe(0)
  })

  it('radar hold: gate = max(hostileAtS, stable track) + declaration dwell', () => {
    const { scenario, uasId } = build(RADAR, [interceptor('tst-int', {})], [{ x: 0, y: 0 }])
    const a = assessThreat(scenario, uasId)
    // Continuous radar hold from t = 0; surveillance role initiates in 6 s.
    expect(a.stableTrackAtS).toBe(6)
    // Hostile at the first sample inside the effector ring (t = 5.5).
    expect(a.classificationAtS.hostileAtS).toBe(5.5)
    expect(a.engageGateS).toBe(16)
    expect(a.declaredHostileAtS).toBe(16)
    expect(a.effectorGates?.length).toBe(1)
    // TARGET: gate + 2 s default hop + 8 s interceptor target dwell.
    expect(a.effectorGates?.[0].readyS).toBe(26)
    // The usable window opens at release-ready, not at the declaration.
    expect(a.windowS?.[0]).toBe(26)
    expect(a.status).toBe('engageable')
  })

  it('spec targetS overrides the TARGET_S type table', () => {
    const { scenario, uasId } = build(
      RADAR,
      [interceptor('tst-int', { targetS: 1 })],
      [{ x: 0, y: 0 }],
    )
    const a = assessThreat(scenario, uasId)
    expect(a.effectorGates?.[0].gateS).toBe(16)
    expect(a.effectorGates?.[0].readyS).toBe(19)
  })

  it('spec trackInitS overrides the role table', () => {
    const fastRadar: SpecModel = {
      ...RADAR,
      id: 'tst-radar-fast',
      sensor: { ...RADAR.sensor!, trackInitS: 2 },
    }
    const { scenario, uasId } = build(fastRadar, [interceptor('tst-int', {})], [{ x: 0, y: 0 }])
    const a = assessThreat(scenario, uasId)
    expect(a.stableTrackAtS).toBe(2)
    // Gate: max(hostile 5.5, firm 2) + 10.
    expect(a.engageGateS).toBe(15.5)
  })

  it('route-aware: a firm track from an unrouted radar authorizes nothing', () => {
    // RF sensor feeds the effector; the radar detects but connects to nothing,
    // so its track file never reaches the shooter.
    const { scenario, uasId } = build(RF_SENSOR, [interceptor('tst-int', {})], [{ x: 0, y: 0 }])
    const radar = ent('sensor', RADAR.id, { x: 0, y: 0 })
    scenario.library = [...scenario.library, RADAR]
    scenario.entities = [...scenario.entities, radar]
    const a = assessThreat(scenario, uasId)
    // The radar track IS firm; it just reaches no shooter.
    expect(a.stableTrackAtS).toBe(6)
    expect(a.effectorGates?.length ?? 0).toBe(0)
    expect(a.status).toBe('no-stable-track')
    expect(resolveEngagements(scenario).totals.shotsFired).toBe(0)
  })

  it('two-phenomenology confirmation halves the declaration dwell', () => {
    const { scenario, uasId } = build(RADAR, [interceptor('tst-int', {})], [{ x: 0, y: 0 }])
    // Add an RF sensor: the rf-manual target is heard from t = 0, so the
    // track is two-tech confirmed before declaration starts.
    const rf = ent('sensor', RF_SENSOR.id, { x: 0, y: 0 })
    scenario.library = [...scenario.library, RF_SENSOR]
    scenario.entities = [...scenario.entities, rf]
    const a = assessThreat(scenario, uasId)
    expect(a.firstConfirmS).toBe(0)
    // max(hostile 5.5, firm 6) + 10 * 0.5.
    expect(a.engageGateS).toBe(11)
  })

  it('doctrine off keeps the legacy ROE-free gate', () => {
    const { scenario, uasId } = build(RADAR, [interceptor('tst-int', {})], [{ x: 0, y: 0 }])
    scenario.doctrine = { ...scenario.doctrine!, enabled: false }
    const a = assessThreat(scenario, uasId)
    expect(a.engageGateS).toBe(0)
    expect(a.declaredHostileAtS).toBeNull()
    // Stable-track time stays informative even with doctrine off.
    expect(a.stableTrackAtS).toBe(6)
  })
})

describe('doctrine fire control (attrition.ts)', () => {
  it('shoot-look-shoot: one salvo in flight, re-engage after effect + BDA', () => {
    const { scenario } = build(
      RADAR,
      [interceptor('tst-int', { engageTimeS: 5, salvoCooldownS: 1 })],
      [{ x: 0, y: 0 }],
    )
    const report = resolveEngagements(scenario)
    expect(report.events.length).toBe(2)
    // Gate 16 + 2 s default link latency + 8 s interceptor target dwell;
    // second shot only after effect (31) + the interceptor BDA dwell (10).
    expect(report.events[0].tS).toBeCloseTo(26, 5)
    expect(report.events[1].tS).toBeCloseTo(41, 5)
  })

  it('per-type factors: DE commits earlier and re-attacks faster', () => {
    const de: SpecModel = {
      id: 'tst-de',
      name: 'tst-de',
      kind: 'effector',
      description: '',
      color: '#fff',
      builtin: false,
      effector: {
        effectorType: 'de',
        minRangeM: 0,
        maxRangeM: 1000,
        engageTimeS: 5,
        salvoCooldownS: 1,
        pk: 0.45,
      },
    }
    const { scenario } = build(RADAR, [de], [{ x: 0, y: 0 }])
    const report = resolveEngagements(scenario)
    // DE target dwell is 5 s (type table): release-ready at 16 + 2 + 5 = 23.
    // DE BDA is 3 s: re-attack every engage (5) + BDA (3) = 8 s.
    expect(report.events.length).toBeGreaterThan(1)
    expect(report.events[0].tS).toBeCloseTo(23, 5)
    expect(report.events[1].tS - report.events[0].tS).toBeCloseTo(8, 5)
    expect(report.totals.deSalvos).toBe(report.events.length)
  })

  it('best-Pk shooter takes the shot; the other holds fire', () => {
    const { scenario, effIds } = build(
      RADAR,
      [
        interceptor('tst-lo', { engageTimeS: 10, salvoCooldownS: 1, pk: 0.5 }),
        interceptor('tst-hi', { engageTimeS: 10, salvoCooldownS: 1, pk: 0.8 }),
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
    )
    const report = resolveEngagements(scenario)
    const hiId = effIds[1]
    // Same position, same falloff: the higher base Pk wins the assignment,
    // and shoot-look-shoot keeps the second shooter silent that tick.
    const first = report.events.filter((e) => e.tS === report.events[0].tS)
    expect(first.length).toBe(1)
    expect(first[0].effectorId).toBe(hiId)
  })

  it('holds fire below pkCommit until the deadline, then fires', () => {
    const { scenario } = build(
      RADAR,
      [interceptor('tst-int', { engageTimeS: 10, salvoCooldownS: 1 })],
      [{ x: 0, y: 0 }],
    )
    // Unreachable commit Pk (spec override): only the deadline can trigger
    // the shot. With no asset, the deadline is the last launch whose effect
    // stays inside the envelope window [5.5, 55]: t = 45.
    const model = scenario.library.find((m) => m.id === 'tst-int')!
    model.effector = { ...model.effector!, commitPk: 0.99 }
    const report = resolveEngagements(scenario)
    expect(report.events.length).toBe(1)
    expect(report.events[0].tS).toBeCloseTo(45, 5)
  })

  it('doctrine spends fewer rounds than the legacy volley for a similar defeat', () => {
    // Slow crosser (10 m/s) through one shooter's ring: doctrine off opens fire
    // the moment the window and gate allow, at max-range falloff, and volleys on
    // cooldown; doctrine holds each shot for pkCommit and inserts the BDA
    // dwell, so every round it does spend carries a better Pk.
    const make = (enabled: boolean) => {
      const built = build(
        RADAR,
        [interceptor('tst-a', { engageTimeS: 10, salvoCooldownS: 5, pk: 0.45 })],
        [{ x: 0, y: 0 }],
      )
      built.scenario.doctrine = { ...built.scenario.doctrine!, enabled }
      built.scenario.paths[0].speedMps = 10
      return resolveEngagements(built.scenario, assessAllThreats(built.scenario))
    }
    const legacy = make(false)
    const doctrinal = make(true)
    expect(doctrinal.totals.shotsFired).toBeLessThan(legacy.totals.shotsFired)
    // Both drive the single ship to expected-dead territory.
    expect(legacy.totals.expectedKills).toBeGreaterThan(0.9)
    expect(doctrinal.totals.expectedKills).toBeGreaterThan(0.9)
  })
})

describe('launch policy (attrition.ts)', () => {
  /**
   * Zero fly-out interceptor at the origin, ring 1000 m: in range for
   * t in [5.5, 55], release-ready at 26 (gate 16 + hop 2 + target 8). The
   * threat is at x = -170 m at t = 26 and closes 20 m per sample.
   */
  const make = (patch: Partial<Scenario['doctrine'] & object>, commitPk?: number) => {
    const built = build(RADAR, [interceptor('tst-int', { salvoCooldownS: 100 })], [{ x: 0, y: 0 }])
    built.scenario.doctrine = { ...built.scenario.doctrine!, ...patch }
    if (commitPk != null) {
      const model = built.scenario.library.find((m) => m.id === 'tst-int')!
      model.effector = { ...model.effector!, commitPk }
    }
    return resolveEngagements(built.scenario)
  }

  it('max-range releases at the first release-ready opportunity', () => {
    // Commit Pk unreachable: only the policy (not Pk) can volunteer the shot.
    const report = make({ launchPolicy: 'max-range' }, 0.99)
    expect(report.events[0].tS).toBeCloseTo(26, 5)
  })

  it('range-fraction holds until the intercept point is inside the fraction of max range', () => {
    // 0.1 x 1000 m = 100 m: the threat is 170 m out at 26, inside 100 m at
    // t = 28 (x = -90 m).
    const report = make({ launchPolicy: 'range-fraction', launchRangeFraction: 0.1 }, 0.99)
    expect(report.events[0].tS).toBeCloseTo(28, 5)
    // The default 2/3 rule is already satisfied at release-ready here.
    expect(make({ launchPolicy: 'range-fraction' }, 0.99).events[0].tS).toBeCloseTo(26, 5)
  })

  it('pk-commit releases once the Pk at the effect point reaches the commit Pk', () => {
    // Pk = 0.8 x (1 - 0.3 d/1000): 0.759 at 170 m, so a 0.76 commit holds
    // one sample (150 m -> 0.764).
    expect(make({ launchPolicy: 'pk-commit' }, 0.76).events[0].tS).toBeCloseTo(26.5, 5)
    expect(make({ launchPolicy: 'pk-commit' }, 0.7).events[0].tS).toBeCloseTo(26, 5)
  })

  it('latest holds to the deadline: the last launch inside the window', () => {
    const report = make({ launchPolicy: 'latest' })
    expect(report.events.length).toBe(1)
    expect(report.events[0].tS).toBeCloseTo(55, 5)
  })

  it('the deadline forces the shot under every policy', () => {
    for (const launchPolicy of ['max-range', 'range-fraction', 'pk-commit', 'latest'] as const) {
      const report = make({ launchPolicy, launchRangeFraction: 0.0001 }, 0.99)
      expect(report.events.length, launchPolicy).toBeGreaterThan(0)
    }
  })
})

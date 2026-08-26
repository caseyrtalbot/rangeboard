import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Connection, Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { resolveEngagements } from './attrition'
import { assessAllThreats, assessThreat } from './sim'

/**
 * Doctrinal fire-control tests. Fixture geometry mirrors attrition.test.ts:
 * group 4 fixed-wing target (size penalty 1.0, no evasion), radar and
 * effector at known positions, target flying east at 40 m/s from x = -1210.
 * Detection at t = 0; hostile classification lands at t = 5.5 (the first
 * sample inside the 1000 m effector ring, nearestRatio <= 1); a 5 s track
 * firm time makes the stable track at t = 5; the 10 s declaration dwell puts
 * the doctrine gate at 15.5.
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
    bdaS: 10,
    pkCommit: 0.35,
    opportunities: 2,
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
    // Continuous radar hold from t = 0; firm at trackFirmS = 5.
    expect(a.stableTrackAtS).toBe(5)
    // Hostile at the first sample inside the effector ring (t = 5.5).
    expect(a.classificationAtS.hostileAtS).toBe(5.5)
    expect(a.engageGateS).toBe(15.5)
    expect(a.declaredHostileAtS).toBe(15.5)
    expect(a.status).toBe('engageable')
  })

  it('doctrine off keeps the legacy ROE-free gate', () => {
    const { scenario, uasId } = build(RADAR, [interceptor('tst-int', {})], [{ x: 0, y: 0 }])
    scenario.doctrine = { ...scenario.doctrine!, enabled: false }
    const a = assessThreat(scenario, uasId)
    expect(a.engageGateS).toBe(0)
    expect(a.declaredHostileAtS).toBeNull()
    // Stable-track time stays informative even with doctrine off.
    expect(a.stableTrackAtS).toBe(5)
  })
})

describe('doctrine fire control (attrition.ts)', () => {
  it('shoot-look-shoot: one salvo in flight, re-engage after effect + BDA', () => {
    const { scenario } = build(
      RADAR,
      [interceptor('tst-int', { engageTimeS: 10, salvoCooldownS: 1 })],
      [{ x: 0, y: 0 }],
    )
    const report = resolveEngagements(scenario)
    expect(report.events.length).toBe(2)
    // Gate 15.5; second shot only after effect (25.5) + bdaS (10).
    expect(report.events[0].tS).toBeCloseTo(15.5, 5)
    expect(report.events[1].tS).toBeCloseTo(35.5, 5)
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
    // Unreachable commit Pk: only the deadline can trigger the shot. With no
    // asset, the deadline is the last launch whose effect stays inside the
    // envelope window [5.5, 55]: t = 45.
    scenario.doctrine = { ...scenario.doctrine!, pkCommit: 0.99 }
    const report = resolveEngagements(scenario)
    expect(report.events.length).toBe(1)
    expect(report.events[0].tS).toBeCloseTo(45, 5)
  })

  it('doctrine spends fewer rounds than the legacy volley for a similar defeat', () => {
    // Slow crosser (10 m/s) through one shooter's ring: legacy opens fire the
    // moment the window and gate allow, at max-range falloff, and volleys on
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

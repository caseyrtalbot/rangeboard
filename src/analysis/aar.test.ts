import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Connection, Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { assessAllThreats } from '../playback/sim'
import { resolveEngagements } from '../playback/attrition'
import { buildAarSummary } from './aar'

/**
 * One scenario with all three outcomes: an interceptor hard-kills threat A,
 * a jammer soft-kills GPS threat B, and threat C flies a lane no effector
 * reaches, so it leaks. Lanes are 10 km apart so engagements never cross.
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

/** Group 4 fixed-wing GPS: size penalty 1.0, no evasion, jammable, drifts. */
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

const INTERCEPTOR: SpecModel = {
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
    pk: 0.9,
    magazineSize: 5,
    salvoCooldownS: 2,
  },
}

const JAMMER: SpecModel = {
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
    pk: 0.6,
    salvoCooldownS: 5,
  },
}

let seq = 0
function ent(kind: Entity['kind'], specId: string, pos: Vec2, name?: string): Entity {
  seq += 1
  return {
    id: `${kind}-${seq}`,
    name: name ?? `${kind}-${seq}`,
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

function flight(entityId: string, y: number): FlightPath {
  seq += 1
  return {
    id: `path-${seq}`,
    entityId,
    points: [
      { x: -1210, y },
      { x: 3000, y },
    ],
    speedMps: 40,
    startDelayS: 0,
  }
}

function mixedScenario(): {
  scenario: Scenario
  intId: string
  jamId: string
  aId: string
  bId: string
  cId: string
} {
  const scenario = emptyScenario()
  scenario.library = [...scenario.library, SENSOR, TARGET, INTERCEPTOR, JAMMER]
  const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
  const int = ent('effector', INTERCEPTOR.id, { x: 0, y: 0 }, 'Interceptor Alpha')
  const jam = ent('effector', JAMMER.id, { x: 0, y: 10000 }, 'Jammer Bravo')
  const a = ent('uas', TARGET.id, { x: -1210, y: 0 }, 'Threat A')
  const b = ent('uas', TARGET.id, { x: -1210, y: 10000 }, 'Threat B')
  const c = ent('uas', TARGET.id, { x: -1210, y: 20000 }, 'Threat C')
  scenario.entities = [sensor, int, jam, a, b, c]
  scenario.connections = [link(sensor.id, int.id), link(sensor.id, jam.id)]
  scenario.paths = [flight(a.id, 0), flight(b.id, 10000), flight(c.id, 20000)]
  return { scenario, intId: int.id, jamId: jam.id, aId: a.id, bId: b.id, cId: c.id }
}

function summarize(scenario: Scenario) {
  return buildAarSummary(scenario, assessAllThreats(scenario), resolveEngagements(scenario))
}

describe('buildAarSummary on a mixed hard-kill / soft-kill / leaker raid', () => {
  const { scenario, intId, jamId, aId, bId, cId } = mixedScenario()
  const aar = summarize(scenario)

  it('reports totals for the whole raid', () => {
    expect(aar.raidSize).toBe(3)
    expect(aar.roe).toBe('tight')
    expect(aar.expectedHardKills).toBeGreaterThan(0.9)
    expect(aar.expectedSoftKills).toBeGreaterThan(0.9)
    expect(aar.expectedKills).toBeCloseTo(aar.expectedHardKills + aar.expectedSoftKills, 9)
    expect(aar.expectedLeakers).toBeCloseTo(3 - aar.expectedKills, 9)
    expect(aar.expectedLeakers).toBeGreaterThan(1) // threat C always leaks
    expect(aar.leakProbability).toBeCloseTo(aar.expectedLeakers / 3, 9)
  })

  it('reports first detection and first shot', () => {
    expect(aar.firstDetectS).toBe(0)
    expect(aar.firstShotS).toBeCloseTo(5.5, 6)
  })

  it('lists shots and magazines by effector with captured names', () => {
    const int = aar.effectors.find((e) => e.effectorId === intId)!
    expect(int.name).toBe('Interceptor Alpha')
    expect(int.effectorType).toBe('interceptor')
    expect(int.shotsFired).toBe(5)
    expect(int.magazineSize).toBe(5)
    expect(int.expectedRoundsRemaining).toBe(0)

    const jam = aar.effectors.find((e) => e.effectorId === jamId)!
    expect(jam.name).toBe('Jammer Bravo')
    expect(jam.effectorType).toBe('jammer')
    expect(jam.shotsFired).toBeGreaterThan(0)
    expect(jam.expectedRoundsRemaining).toBeNull()
    expect(jam.magazineSize).toBeNull()

    expect(aar.shotsFired).toBe(int.shotsFired + jam.shotsFired)
  })

  it('builds per-threat timeline rows: detect, classify, engage, outcome', () => {
    const a = aar.threats.find((t) => t.uasId === aId)!
    expect(a.name).toBe('Threat A')
    expect(a.detectS).toBe(0)
    expect(a.detectSensorName).toBe('sensor-1')
    expect(a.unknownAtS).toBe(0)
    expect(a.suspectedAtS).toBe(0) // 144 kph > 50 kph on first detection
    expect(a.hostileAtS).not.toBeNull()
    expect(a.engageS).toBeCloseTo(5.5, 6)
    expect(a.outcome).toBe('hard-kill')
    expect(a.expectedHardKills).toBeGreaterThan(0.9)
    expect(a.expectedSoftKills).toBe(0)
    expect(a.killedByName).toBe('Interceptor Alpha')

    const b = aar.threats.find((t) => t.uasId === bId)!
    expect(b.outcome).toBe('soft-kill')
    expect(b.expectedHardKills).toBe(0)
    expect(b.expectedSoftKills).toBeGreaterThan(0.9)
    expect(b.killedByName).toBe('Jammer Bravo')

    const c = aar.threats.find((t) => t.uasId === cId)!
    expect(c.detectS).toBe(0)
    expect(c.hostileAtS).toBeNull() // never inside a connected effector ring
    expect(c.engageS).toBeNull()
    expect(c.shotsFired).toBe(0)
    expect(c.leakProbability).toBe(1)
    expect(c.outcome).toBe('not-engaged')
    expect(c.killedByName).toBeNull()
  })

  it('is JSON-serializable and round-trips intact', () => {
    const round = JSON.parse(JSON.stringify(aar))
    expect(round).toEqual(aar)
  })
})

describe('buildAarSummary edge cases', () => {
  it('summarizes an empty scenario without errors', () => {
    const scenario = emptyScenario()
    const aar = summarize(scenario)
    expect(aar.raidSize).toBe(0)
    expect(aar.leakProbability).toBeNull()
    expect(aar.firstDetectS).toBeNull()
    expect(aar.firstShotS).toBeNull()
    expect(aar.threats).toEqual([])
  })

  it('labels an engaged threat that still probably arrives as a leaker', () => {
    const { scenario, aId } = mixedScenario()
    // One weak shot: Pk far below 0.5, so the threat likely leaks through.
    scenario.library = scenario.library.map((m) =>
      m.id === INTERCEPTOR.id
        ? { ...m, effector: { ...m.effector!, pk: 0.2, magazineSize: 1 } }
        : m,
    )
    const aar = summarize(scenario)
    const a = aar.threats.find((t) => t.uasId === aId)!
    expect(a.shotsFired).toBe(1)
    expect(a.leakProbability).toBeGreaterThan(0.5)
    expect(a.outcome).toBe('leaker')
  })
})

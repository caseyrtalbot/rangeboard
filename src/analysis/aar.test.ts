import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Connection, Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { assessAllThreats } from '../playback/sim'
import { resolveEngagements } from '../playback/attrition'
import { buildAarSummary } from './aar'
import { assessLeakerImpacts } from './impact'

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

/** Directed energy: a hard kill that fires no round, so it spends deSalvos. */
const HPM: SpecModel = {
  id: 'tst-hpm',
  name: 'test hpm',
  kind: 'effector',
  description: '',
  color: '#fff',
  builtin: false,
  effector: {
    effectorType: 'hpm',
    minRangeM: 0,
    maxRangeM: 1000,
    engageTimeS: 0,
    pk: 0.7,
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
  const assessments = assessAllThreats(scenario)
  const report = resolveEngagements(scenario)
  return buildAarSummary(
    scenario,
    assessments,
    report,
    assessLeakerImpacts(scenario, assessments, report),
  )
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
    // expectedLeakers is UNDEFEATED ships: everything the defence did not
    // defeat before arrival, whether or not it ever crossed a boundary.
    expect(aar.expectedLeakers).toBeCloseTo(3 - aar.expectedKills, 9)
    expect(aar.expectedLeakers).toBeGreaterThan(1) // threat C is never engaged
    expect(aar.leakProbability).toBeCloseTo(aar.expectedLeakers / 3, 9)
  })

  it('splits the undefeated mass and reports late intercepts apart', () => {
    // No asset is placed, so nothing can arrive: every undefeated ship sits
    // in the never-arrived bucket and no defeat can be late.
    expect(aar.expectedNoArrival).toBeCloseTo(aar.expectedLeakers, 9)
    expect(aar.expectedLateKills).toBe(0)
    expect(
      aar.expectedKills + aar.expectedNoArrival! + (aar.expectedLeakers - aar.expectedNoArrival!),
    ).toBeCloseTo(aar.raidSize, 9)
  })

  it('reports first detection and first shot', () => {
    expect(aar.firstDetectS).toBe(0)
    expect(aar.firstShotS).toBeCloseTo(5.5, 6)
  })

  it('lists shots and magazines by effector with captured names', () => {
    const int = aar.effectors.find((e) => e.effectorId === intId)!
    expect(int.name).toBe('Interceptor Alpha')
    expect(int.effectorType).toBe('interceptor')
    // Doctrine: fire stops once the target is expected dead. Three salvos
    // at pk 0.9 (Pk 0.6327/0.6543/0.6759 by falloff) leave survival
    // 0.041 < SHIP_DEAD_BELOW, so the last two rounds are held.
    expect(int.shotsFired).toBe(3)
    expect(int.deSalvos).toBe(0)
    expect(int.jamSalvos).toBe(0)
    expect(int.magazineSize).toBe(5)
    expect(int.expectedRoundsRemaining).toBe(2)

    const jam = aar.effectors.find((e) => e.effectorId === jamId)!
    expect(jam.name).toBe('Jammer Bravo')
    expect(jam.effectorType).toBe('jammer')
    // Jammer expenditure is jam salvos, never kinetic shots. Five soft-kill
    // salvos (cooldown 5 s) push survival below the cutoff; then it holds.
    expect(jam.shotsFired).toBe(0)
    expect(jam.deSalvos).toBe(0)
    expect(jam.jamSalvos).toBe(5)
    expect(jam.expectedRoundsRemaining).toBeNull()
    expect(jam.magazineSize).toBeNull()

    expect(aar.shotsFired).toBe(int.shotsFired) // kinetic only
    expect(aar.deSalvos).toBe(0)
    expect(aar.jamSalvos).toBe(jam.jamSalvos)
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

describe('AAR engagement-potential (I&W) fields', () => {
  /** OWA threat into a defended asset at the path end; no defenses. */
  function owaScenario(): { scenario: Scenario; uasId: string } {
    const scenario = emptyScenario()
    const owa: SpecModel = {
      ...TARGET,
      id: 'tst-owa',
      uas: {
        ...TARGET.uas!,
        airframe: 'one-way-attack',
        warheadKg: 40,
        effectRadiusM: 50,
        weaponProfile: 'impact',
      },
    }
    scenario.library = [...scenario.library, owa]
    const uas = ent('uas', owa.id, { x: -1000, y: 0 }, 'OWA Threat')
    const asset = ent('asset', TARGET.id, { x: 0, y: 0 }, 'CP Main')
    scenario.entities = [uas, asset]
    scenario.paths = [
      {
        id: 'path-owa',
        entityId: uas.id,
        points: [
          { x: -1000, y: 0 },
          { x: 0, y: 0 },
        ],
        speedMps: 40,
        startDelayS: 0,
      },
    ]
    return { scenario, uasId: uas.id }
  }

  it('carries the impact fields on the threat row', () => {
    const { scenario, uasId } = owaScenario()
    const aar = summarize(scenario)
    const row = aar.threats.find((t) => t.uasId === uasId)!
    expect(row.assetName).toBe('CP Main')
    // Arrival is the defended-boundary crossing (default 500 m protected
    // radius), so 1,000 m out at 40 m/s crosses at T+12.5 s, not at impact.
    expect(row.arrivalS).toBeCloseTo(12.5, 1)
    expect(row.assetInWez).toBe(true)
    expect(row.expectedShipsArriving).toBe(1)
    expect(row.expectedWarheadKg).toBe(40)
    expect(row.impactSeverity).toBe('severe')
  })

  it('round-trips the optional fields through JSON intact', () => {
    const aar = summarize(owaScenario().scenario)
    const round = JSON.parse(JSON.stringify(aar))
    expect(round).toEqual(aar)
  })

  it('accepts an old-shape pin whose rows lack the impact fields', () => {
    const aar = summarize(owaScenario().scenario)
    // A scorecard pinned before the I&W fields existed: strip them.
    const pin = JSON.parse(JSON.stringify(aar)) as typeof aar
    for (const t of pin.threats) {
      const rec = t as unknown as Record<string, unknown>
      delete rec.assetName
      delete rec.arrivalS
      delete rec.assetInWez
      delete rec.expectedShipsArriving
      delete rec.expectedWarheadKg
      delete rec.impactSeverity
    }
    const round = JSON.parse(JSON.stringify(pin)) as typeof aar
    expect(round).toEqual(pin)
    expect(round.threats[0].impactSeverity).toBeUndefined()
    expect(round.threats[0].expectedShipsArriving).toBeUndefined()
    // The pre-existing row contract still reads normally.
    expect(round.threats[0].name).toBe('OWA Threat')
    expect(round.threats[0].outcome).toBe('not-engaged')
  })
})

describe('AAR directed-energy engagement', () => {
  /** The same lane as threat A, defended by an HPM emitter instead. */
  function hpmScenario(): { scenario: Scenario; hpmId: string; aId: string } {
    const scenario = emptyScenario()
    scenario.library = [...scenario.library, SENSOR, TARGET, HPM]
    const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
    const hpm = ent('effector', HPM.id, { x: 0, y: 0 }, 'HPM Charlie')
    const a = ent('uas', TARGET.id, { x: -1210, y: 0 }, 'Threat A')
    scenario.entities = [sensor, hpm, a]
    scenario.connections = [link(sensor.id, hpm.id)]
    scenario.paths = [flight(a.id, 0)]
    return { scenario, hpmId: hpm.id, aId: a.id }
  }

  const { scenario, hpmId, aId } = hpmScenario()
  const aar = summarize(scenario)

  it('counts the bursts as directed energy, never as rounds fired', () => {
    const hpm = aar.effectors.find((e) => e.effectorId === hpmId)!
    expect(hpm.effectorType).toBe('hpm')
    expect(hpm.deSalvos).toBeGreaterThan(0)
    expect(hpm.shotsFired).toBe(0)
    expect(hpm.jamSalvos).toBe(0)
    expect(aar.deSalvos).toBe(hpm.deSalvos)
    expect(aar.shotsFired).toBe(0)
  })

  it('does not report a directed-energy engagement as never engaged', () => {
    // aarOutcome tested only shotsFired and jamSalvos, so a DE or HPM
    // engagement that defeated the threat reported 'not-engaged'.
    const row = aar.threats.find((t) => t.uasId === aId)!
    expect(row.deSalvos).toBeGreaterThan(0)
    expect(row.shotsFired).toBe(0)
    expect(row.outcome).toBe('hard-kill')
    expect(aar.expectedHardKills).toBeGreaterThan(0.9)
  })

  it('is JSON-serializable and round-trips intact', () => {
    expect(JSON.parse(JSON.stringify(aar))).toEqual(aar)
  })
})

describe('AAR late intercepts', () => {
  /**
   * An interceptor whose effect lands 30 s after assignment, sited at a
   * defended asset the threat crosses first. The kill still happens; it just
   * lands too late to have defended the asset.
   */
  function lateScenario(): { scenario: Scenario; uasId: string } {
    const scenario = emptyScenario()
    const slow: SpecModel = {
      ...INTERCEPTOR,
      id: 'tst-slow-int',
      effector: { ...INTERCEPTOR.effector!, engageTimeS: 30, maxRangeM: 4000 },
    }
    scenario.library = [...scenario.library, SENSOR, TARGET, slow]
    const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
    const int = ent('effector', slow.id, { x: 0, y: 0 }, 'Slow Interceptor')
    const asset = ent('asset', TARGET.id, { x: 0, y: 0 }, 'CP Main')
    const uas = ent('uas', TARGET.id, { x: -1210, y: 0 }, 'Threat A')
    scenario.entities = [sensor, int, asset, uas]
    scenario.connections = [link(sensor.id, int.id)]
    scenario.paths = [flight(uas.id, 0)]
    return { scenario, uasId: uas.id }
  }

  const { scenario } = lateScenario()
  const aar = summarize(scenario)

  it('reports the late mass apart and never adds it to the defeat', () => {
    expect(aar.expectedLateKills).toBeGreaterThan(0)
    // The defeat number carries PRE-ARRIVAL mass only.
    expect(aar.expectedKills).toBeCloseTo(
      aar.expectedHardKills + aar.expectedSoftKills,
      9,
    )
    expect(aar.expectedKills + aar.expectedLeakers).toBeCloseTo(aar.raidSize, 9)
    // Late mass sits inside the undefeated bucket, so the two overlap.
    expect(aar.expectedLateKills!).toBeLessThanOrEqual(aar.expectedLeakers + 1e-9)
  })

  it('records that the threat arrived, so the undefeated mass is a real leak', () => {
    expect(aar.expectedNoArrival).toBeCloseTo(0, 9)
  })
})

describe('AarSummary pinned-shape tolerance', () => {
  it('accepts an old pin that lacks every field added after it was made', () => {
    const aar = summarize(mixedScenario().scenario)
    const pin = JSON.parse(JSON.stringify(aar)) as typeof aar
    const drop = (record: Record<string, unknown>, keys: string[]) => {
      for (const key of keys) delete record[key]
    }
    drop(pin as unknown as Record<string, unknown>, [
      'deSalvos',
      'jamSalvos',
      'expectedNoArrival',
      'expectedLateKills',
    ])
    for (const e of pin.effectors) {
      drop(e as unknown as Record<string, unknown>, ['deSalvos', 'jamSalvos'])
    }
    for (const t of pin.threats) {
      drop(t as unknown as Record<string, unknown>, ['deSalvos', 'jamSalvos'])
    }
    const round = JSON.parse(JSON.stringify(pin)) as typeof aar
    expect(round).toEqual(pin)
    expect(round.deSalvos).toBeUndefined()
    expect(round.expectedLateKills).toBeUndefined()
    expect(round.expectedNoArrival).toBeUndefined()
    expect(round.effectors[0].deSalvos).toBeUndefined()
    // Every field the pin has always carried still reads normally.
    expect(round.raidSize).toBe(3)
    expect(round.shotsFired).toBe(3)
    expect(round.expectedLeakers).toBeGreaterThan(1)
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

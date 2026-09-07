import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, FlightPath, Scenario, SpecModel, UasSpec, Vec2 } from '../model/types'
import { assessAllThreats } from '../playback/sim'
import type { AttritionReport, ThreatAttrition } from '../playback/attritionReport'
import { resolveEngagements } from '../playback/attrition'
import {
  assessLeakerImpacts,
  engagementPicture,
  severityFor,
  threatWezList,
  wezKindFor,
  wezRadiusM,
} from './impact'
import { markPresentationVariant } from '../model/scenario'
import { fillScenario } from '../io/persist'
import captured from '../playback/__fixtures__/layered-acoustic-merops.json'
import harness from '../../docs/field-te/evidence/perf-2026-09-06/scenario.json'

/** UAS model builder; base spec has none of the weapon fields (legacy shape). */
function uasModel(patch: Partial<UasSpec>, id = 'tst-uas'): SpecModel {
  return {
    id,
    name: 'test uas',
    kind: 'uas',
    description: '',
    color: '#fff',
    builtin: false,
    uas: {
      group: 3,
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

const SENSOR_MODEL: SpecModel = {
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

let seq = 0
function ent(kind: Entity['kind'], specId: string | null, pos: Vec2, extra?: Partial<Entity>): Entity {
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

function flight(entityId: string, points: Vec2[]): FlightPath {
  seq += 1
  return { id: `path-${seq}`, entityId, points, speedMps: 40, startDelayS: 0 }
}

/**
 * One threat flying 1 km west-to-east into the origin, one asset at assetPos,
 * no defenses (never engaged, every ship arrives).
 */
function scenarioWith(
  model: SpecModel,
  assetPos: Vec2 | null,
  extra?: Partial<Entity>,
): { scenario: Scenario; uasId: string; assetId: string | null } {
  const scenario = emptyScenario()
  scenario.library = [...scenario.library, model]
  const uas = ent('uas', model.id, { x: -1000, y: 0 }, extra)
  const asset = assetPos ? ent('asset', null, assetPos) : null
  scenario.entities = asset ? [uas, asset] : [uas]
  scenario.paths = [
    flight(uas.id, [
      { x: -1000, y: 0 },
      { x: 0, y: 0 },
    ]),
  ]
  return { scenario, uasId: uas.id, assetId: asset?.id ?? null }
}

function impactsFor(scenario: Scenario, report?: AttritionReport) {
  const assessments = assessAllThreats(scenario)
  return assessLeakerImpacts(scenario, assessments, report ?? resolveEngagements(scenario))
}

/** Hand-built attrition row: assessLeakerImpacts composes, it does not sweep. */
function reportWith(uasId: string, patch: Partial<ThreatAttrition>): AttritionReport {
  const row: ThreatAttrition = {
    uasId,
    shipCount: 1,
    expectedKills: 0,
    expectedHardKills: 0,
    expectedSoftKills: 0,
    expectedLateKills: 0,
    expectedLateHardKills: 0,
    expectedLateSoftKills: 0,
    arrived: true,
    expectedLeakers: 0,
    expectedNoArrival: 0,
    leakProbability: 1,
    continueJamProb: 0,
    firstShotS: null,
    shotsFired: 0,
    deSalvos: 0,
    jamSalvos: 0,
    killedByEffectorId: null,
    killedBySoft: false,
    ...patch,
  }
  // Keep the fixture self-consistent: the raid partition follows shipCount,
  // the defeat mass, and whether the threat crossed a boundary.
  const undefeated = row.shipCount - row.expectedKills
  row.expectedLeakers = row.arrived ? undefeated : 0
  row.expectedNoArrival = row.arrived ? 0 : undefeated
  return {
    threats: [row],
    effectors: [],
    totals: {
      raidSize: row.shipCount,
      expectedKills: row.expectedKills,
      expectedHardKills: row.expectedHardKills,
      expectedSoftKills: row.expectedSoftKills,
      expectedLateKills: row.expectedLateKills,
      expectedLeakers: row.expectedLeakers,
      expectedNoArrival: row.expectedNoArrival,
      reportedLeakers: row.expectedLeakers,
      shotsFired: row.shotsFired,
      deSalvos: row.deSalvos,
      jamSalvos: row.jamSalvos,
    },
    events: [],
  }
}

describe('wezKindFor / wezRadiusM', () => {
  it('is none for undefined and non-UAS models', () => {
    expect(wezKindFor(undefined)).toBe('none')
    expect(wezRadiusM(undefined)).toBeNull()
    expect(wezKindFor(SENSOR_MODEL)).toBe('none')
    expect(wezRadiusM(SENSOR_MODEL)).toBeNull()
  })

  it('uses the explicit effect radius for impact profiles', () => {
    const m = uasModel({ weaponProfile: 'impact', warheadKg: 40, effectRadiusM: 50 })
    expect(wezKindFor(m)).toBe('impact')
    expect(wezRadiusM(m)).toBe(50)
  })

  it('falls back to the warhead-mass planning tier when the radius is unset', () => {
    expect(wezRadiusM(uasModel({ weaponProfile: 'impact', warheadKg: 40 }))).toBe(80)
    expect(wezRadiusM(uasModel({ weaponProfile: 'impact', warheadKg: 4 }))).toBe(30)
  })

  it('returns null, not zero, when both radius and warhead are unknown', () => {
    expect(wezRadiusM(uasModel({ weaponProfile: 'impact' }))).toBeNull()
  })

  it('uses standoffRangeM for standoff profiles and null when unset', () => {
    const m = uasModel({ weaponProfile: 'standoff', standoffRangeM: 8000 })
    expect(wezKindFor(m)).toBe('standoff')
    expect(wezRadiusM(m)).toBe(8000)
    expect(wezRadiusM(uasModel({ weaponProfile: 'standoff' }))).toBeNull()
  })

  it('derives the kind for legacy models saved before the weapon fields', () => {
    expect(wezKindFor(uasModel({ airframe: 'one-way-attack' }))).toBe('impact')
    expect(wezKindFor(uasModel({ airframe: 'fpv' }))).toBe('impact')
    expect(wezKindFor(uasModel({ airframe: 'quad', oneWay: true }))).toBe('impact')
    expect(wezKindFor(uasModel({ airframe: 'fixed-wing' }))).toBe('none')
    expect(wezRadiusM(uasModel({ airframe: 'fixed-wing' }))).toBeNull()
    // A legacy release-range platform reads as standoff.
    expect(wezKindFor(uasModel({ standoffRangeM: 8000 }))).toBe('standoff')
  })

  it('respects an explicit none even when weapon numbers are set', () => {
    const m = uasModel({ weaponProfile: 'none', warheadKg: 40, effectRadiusM: 50 })
    expect(wezKindFor(m)).toBe('none')
    expect(wezRadiusM(m)).toBeNull()
  })
})

describe('severityFor tier boundaries', () => {
  it('is null outside the WEZ regardless of mass', () => {
    expect(severityFor(false, 10, 400)).toBeNull()
  })
  it('floor is exclusive: 0.05 ships stays silent, above it warns LOW', () => {
    expect(severityFor(true, 0.05, 0)).toBeNull()
    expect(severityFor(true, 0.051, 0)).toBe('low')
  })
  it('MODERATE bounds are inclusive: 0.25 ships or 5 kg', () => {
    expect(severityFor(true, 0.25, 0)).toBe('moderate')
    expect(severityFor(true, 0.24, 5)).toBe('moderate')
    expect(severityFor(true, 0.24, 4.99)).toBe('low')
  })
  it('SEVERE bounds are inclusive: 1.0 ships or 20 kg', () => {
    expect(severityFor(true, 1.0, 0)).toBe('severe')
    expect(severityFor(true, 0.99, 20)).toBe('severe')
    expect(severityFor(true, 0.99, 19.9)).toBe('moderate')
  })
  it('unknown warhead (0 kg) falls back to ships only', () => {
    expect(severityFor(true, 0.5, 0)).toBe('moderate')
    expect(severityFor(true, 0.1, 0)).toBe('low')
  })
})

describe('threatWezList', () => {
  const impactModel = uasModel({ weaponProfile: 'impact', warheadKg: 40, effectRadiusM: 50 })

  it('centers an impact WEZ at the path end', () => {
    const { scenario, uasId } = scenarioWith(impactModel, null)
    const [wez] = threatWezList(scenario)
    expect(wez).toMatchObject({
      uasId,
      kind: 'impact',
      radiusM: 50,
      planCenter: { x: 0, y: 0 },
      hasPath: true,
    })
  })

  it('draws at the rest position with hasPath false when there is no path', () => {
    const { scenario } = scenarioWith(impactModel, null)
    scenario.paths = []
    const [wez] = threatWezList(scenario)
    expect(wez.planCenter).toEqual({ x: -1000, y: 0 })
    expect(wez.hasPath).toBe(false)
  })

  it('merges coincident impact WEZs into one drawable with a ship count', () => {
    const { scenario, uasId } = scenarioWith(impactModel, null)
    // Two more ships aimed at the same impact point, as the tactic builder
    // creates them; plus one aimed 500 m away, which must stay separate.
    const clones = [1, 2].map((i) => ent('uas', impactModel.id, { x: -1000, y: 200 * i }))
    const offAim = ent('uas', impactModel.id, { x: -1000, y: 900 })
    scenario.entities = [...scenario.entities, ...clones, offAim]
    scenario.paths = [
      ...scenario.paths,
      ...clones.map((c) =>
        flight(c.id, [
          { x: -1000, y: c.pos.y },
          { x: 0, y: 0 },
        ]),
      ),
      flight(offAim.id, [
        { x: -1000, y: 900 },
        { x: 500, y: 0 },
      ]),
    ]
    const list = threatWezList(scenario)
    expect(list).toHaveLength(2)
    const merged = list.find((w) => w.uasId === uasId)!
    expect(merged.count).toBe(3)
    expect(merged.planCenter).toEqual({ x: 0, y: 0 })
    const single = list.find((w) => w.uasId === offAim.id)!
    expect(single.count).toBe(1)
  })

  it('centers a standoff ring on the platform rest position', () => {
    const m = uasModel({ weaponProfile: 'standoff', standoffRangeM: 8000 })
    const { scenario } = scenarioWith(m, null)
    const [wez] = threatWezList(scenario)
    expect(wez.kind).toBe('standoff')
    expect(wez.radiusM).toBe(8000)
    expect(wez.planCenter).toEqual({ x: -1000, y: 0 })
  })

  it('excludes weaponless kinds, unknown radii, and disabled threats', () => {
    const none = scenarioWith(uasModel({ weaponProfile: 'none' }), null)
    expect(threatWezList(none.scenario)).toEqual([])
    const unknown = scenarioWith(uasModel({ weaponProfile: 'impact' }), null)
    expect(threatWezList(unknown.scenario)).toEqual([])
    const disabled = scenarioWith(impactModel, null, { enabled: false })
    expect(threatWezList(disabled.scenario)).toEqual([])
  })
})

describe('assessLeakerImpacts', () => {
  const impactModel = uasModel({ weaponProfile: 'impact', warheadKg: 40, effectRadiusM: 50 })

  it('warns SEVERE when the asset sits inside the WEZ at arrival', () => {
    const { scenario, assetId } = scenarioWith(impactModel, { x: 0, y: 0 })
    const [imp] = impactsFor(scenario)
    expect(imp.assetId).toBe(assetId)
    expect(imp.assetInWez).toBe(true)
    // ARRIVAL is the defended-boundary crossing, not the impact point. The
    // threat starts 1,000 m out at 40 m/s and the default protected radius is
    // 500 m, so it is inside the boundary after 500 m of travel: T+12.5 s.
    expect(imp.arrivalS).toBeCloseTo(12.5, 1)
    // CPA is a different question: nearest approach is the impact point at
    // T+25 s, which is what the WEZ containment test reads.
    expect(imp.cpaS).toBeCloseTo(25, 1)
    expect(imp.expectedShipsArriving).toBe(1)
    expect(imp.expectedWarheadKg).toBe(40)
    expect(imp.severity).toBe('severe') // 40 kg >= 20 and 1.0 ships >= 1.0
  })

  it('is silent when the asset sits outside the WEZ (CPA > r)', () => {
    const { scenario } = scenarioWith(impactModel, { x: 0, y: 320 })
    const [imp] = impactsFor(scenario)
    expect(imp.assetInWez).toBe(false)
    expect(imp.severity).toBeNull()
  })

  it('assumes inside when the radius is unknown and scores from ships only', () => {
    const { scenario } = scenarioWith(uasModel({ weaponProfile: 'impact' }), { x: 0, y: 320 })
    const [imp] = impactsFor(scenario)
    expect(imp.assetInWez).toBe(true) // conservative: unknown r never hides a threat
    expect(imp.expectedWarheadKg).toBe(0) // unknown warhead, never an invented mass
    expect(imp.severity).toBe('severe') // 1.0 ships, ships-only criteria
  })

  it('warns from CPA when the threat never crosses the defended boundary', () => {
    // Standoff shooter passing 700 m abeam: outside the 500 m protected
    // boundary, so it never arrives, but the asset is well inside its 8 km
    // WEZ. Engagement potential is a CPA question, never an arrival question.
    const m = uasModel({ weaponProfile: 'standoff', standoffRangeM: 8000, warheadKg: 40 })
    const { scenario, assetId } = scenarioWith(m, { x: 0, y: 700 })
    const [imp] = impactsFor(scenario)
    expect(imp.arrivalS).toBeNull()
    expect(imp.cpaS).not.toBeNull()
    expect(imp.assetId).toBe(assetId)
    expect(imp.assetInWez).toBe(true)
    expect(imp.severity).toBe('severe')
  })

  it('never warns for weaponless platforms even on a direct approach', () => {
    const { scenario } = scenarioWith(uasModel({ weaponProfile: 'none' }), { x: 0, y: 0 })
    const [imp] = impactsFor(scenario)
    expect(imp.assetInWez).toBe(false)
    expect(imp.severity).toBeNull()
  })

  it("passes a 'continue' jam through as data without dropping the tier", () => {
    const { scenario, uasId } = scenarioWith(impactModel, { x: 0, y: 0 })
    const [imp] = impactsFor(scenario, reportWith(uasId, { continueJamProb: 0.62 }))
    expect(imp.jamDegradedProb).toBe(0.62)
    expect(imp.expectedShipsArriving).toBe(1) // still inbound
    expect(imp.severity).toBe('severe')
  })

  it('excludes drift/return-home soft kills from expectedShipsArriving', () => {
    const { scenario, uasId } = scenarioWith(impactModel, { x: 0, y: 0 })
    // 2 ships, 1.2 expected drift mission kills: only 0.4 survival per ship.
    const report = reportWith(uasId, {
      shipCount: 2,
      expectedSoftKills: 1.2,
      expectedKills: 1.2,
      leakProbability: 0.4,
    })
    const [imp] = impactsFor(scenario, report)
    expect(imp.expectedShipsArriving).toBeCloseTo(0.8, 9)
    expect(imp.expectedWarheadKg).toBeCloseTo(32, 9)
    expect(imp.severity).toBe('severe') // 32 kg >= 20
  })

  it('treats a threat with no attrition row as fully arriving', () => {
    const { scenario, uasId } = scenarioWith(impactModel, { x: 0, y: 0 })
    const empty: AttritionReport = {
      threats: [],
      effectors: [],
      totals: {
        raidSize: 0,
        expectedKills: 0,
        expectedHardKills: 0,
        expectedSoftKills: 0,
        expectedLateKills: 0,
        expectedLeakers: 0,
        expectedNoArrival: 0,
        reportedLeakers: 0,
        shotsFired: 0,
        deSalvos: 0,
        jamSalvos: 0,
      },
      events: [],
    }
    scenario.entities = scenario.entities.map((e) =>
      e.id === uasId ? { ...e, formation: { count: 3, shape: 'line' as const, spacingM: 30 } } : e,
    )
    const [imp] = impactsFor(scenario, empty)
    expect(imp.expectedShipsArriving).toBe(3)
    expect(imp.jamDegradedProb).toBe(0)
  })

  it('skips threats without a flight path', () => {
    const { scenario } = scenarioWith(impactModel, { x: 0, y: 0 })
    scenario.paths = []
    expect(impactsFor(scenario)).toEqual([])
  })
})

describe('engagementPicture incremental assessments', () => {
  const base = fillScenario(captured as unknown as Scenario)
  const fresh = (s: Scenario) => JSON.stringify(assessAllThreats(s))
  const moved = (s: Scenario, id: string): Scenario => ({
    ...s,
    entities: s.entities.map((e) => (e.id === id ? { ...e, pos: { x: e.pos.x + 5, y: e.pos.y } } : e)),
  })
  const firstOf = (s: Scenario, test: (e: Entity) => boolean) => s.entities.find(test)!.id

  // This parity matrix runs the full engine for every edit; shared CI took 5.9 s.
  it('reuses every assessment across an edit no threat reads, and recomputes exactly otherwise', () => {
    let prev = engagementPicture(base)
    expect(JSON.stringify(prev.assessments)).toBe(fresh(base))
    // A marker is never an engine input, so a move of one carries every
    // assessment object over.
    const marker: Entity = {
      id: 'marker-1',
      name: 'marker',
      kind: 'marker',
      specId: null,
      pos: { x: 0, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    }
    prev = engagementPicture({ ...base, entities: [...base.entities, marker] })
    let next = moved({ ...base, entities: [...base.entities, marker] }, marker.id)
    let picture = engagementPicture(next)
    expect(JSON.stringify(picture.assessments)).toBe(fresh(next))
    expect(picture.assessments.every((a, i) => a === prev.assessments[i])).toBe(true)
    // A presentation edit reads the same engine objects.
    prev = picture
    next = { ...next, name: 'renamed', testCards: [] }
    picture = engagementPicture(next)
    expect(picture.assessments.every((a, i) => a === prev.assessments[i])).toBe(true)
    // Every other kind of edit must match a fresh run byte for byte.
    const edits: Array<(s: Scenario) => Scenario> = [
      (s) => moved(s, firstOf(s, (e) => e.kind === 'sensor' && e.name.startsWith('RPS-42'))),
      (s) => moved(s, firstOf(s, (e) => e.kind === 'effector')),
      (s) => moved(s, firstOf(s, (e) => e.kind === 'asset')),
      (s) => moved(s, firstOf(s, (e) => e.kind === 'c2')),
      (s) => moved(s, firstOf(s, (e) => e.kind === 'uas')),
      (s) => ({
        ...s,
        entities: s.entities.map((e) => (e.kind === 'sensor' && e.name.startsWith('KuRFS') ? { ...e, enabled: false } : e)),
      }),
      (s) => ({ ...s, environment: { ...s.environment, apply: !s.environment.apply } }),
      (s) => ({ ...s, requirements: { ...s.requirements, pdDetect: 0.6 } }),
      (s) => ({ ...s, paths: s.paths.map((p) => ({ ...p, speedMps: (p.speedMps || 20) + 1 })) }),
      (s) => ({ ...s, connections: s.connections.slice(1) }),
      (s) => ({ ...s, roe: s.roe === 'free' ? 'tight' : 'free' }),
    ]
    for (const edit of edits) {
      next = edit(next)
      picture = engagementPicture(next)
      expect(JSON.stringify(picture.assessments)).toBe(fresh(next))
    }
  }, 15_000)

  it('reuses every assessment when a sensor the technology gate refuses is moved', () => {
    // The harness scenario: its RF sensors hear none of its threats, so the
    // first sensor the harness moves is no input to any assessment.
    const scenario = fillScenario(harness as unknown as Scenario)
    const prev = engagementPicture(scenario)
    const rf = firstOf(scenario, (e) => e.kind === 'sensor')
    expect(scenario.entities.find((e) => e.id === rf)!.name.startsWith('RfOne')).toBe(true)
    const next = moved(scenario, rf)
    const picture = engagementPicture(next)
    expect(JSON.stringify(picture.assessments)).toBe(fresh(next))
    expect(picture.assessments.every((a, i) => a === prev.assessments[i])).toBe(true)
  })
})

describe('engagementPicture memoization', () => {
  it('returns the same computation for the same scenario object', () => {
    const { scenario } = scenarioWith(
      uasModel({ weaponProfile: 'impact', warheadKg: 40, effectRadiusM: 50 }),
      { x: 0, y: 0 },
    )
    const a = engagementPicture(scenario)
    expect(engagementPicture(scenario)).toBe(a)
    // mutate() replaces the scenario object; a new object recomputes.
    const clone = JSON.parse(JSON.stringify(scenario)) as Scenario
    expect(engagementPicture(clone)).not.toBe(a)
  })

  it('reuses the picture of a presentation variant and bounds the retained pictures', () => {
    const { scenario } = scenarioWith(
      uasModel({ weaponProfile: 'impact', warheadKg: 40, effectRadiusM: 50 }),
      { x: 0, y: 0 },
    )
    const a = engagementPicture(scenario)
    const stamped = { ...scenario, observedPresetId: 'sensors' }
    markPresentationVariant(stamped, scenario)
    expect(engagementPicture(stamped)).toBe(a)
    // Nine other scenarios push the first out of the retained set; the most recent stays.
    const others = Array.from({ length: 9 }, () => ({ ...scenario }))
    const pictures = others.map((s) => engagementPicture(s))
    expect(engagementPicture(others[8])).toBe(pictures[8])
    expect(engagementPicture(scenario)).not.toBe(a)
  })
})

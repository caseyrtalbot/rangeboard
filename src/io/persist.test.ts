import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { AarSummary, EngagePolicy, Entity, Scenario, ScorecardSnap } from '../model/types'
import type { AttritionReport } from '../playback/attrition'
import type { ThreatAssessment } from '../playback/sim'
import { aarExportObject, fillScenario, runExportObject } from './persist'

/** A save written before the roe field existed. */
function legacySave(engageOn?: EngagePolicy): Scenario {
  const s = emptyScenario()
  delete s.roe
  if (engageOn) s.engageOn = engageOn
  return s
}

describe('engageOn -> roe load migration', () => {
  it("maps engageOn 'detected' to weapons free", () => {
    expect(fillScenario(legacySave('detected')).roe).toBe('free')
  })

  it("maps engageOn 'confirmed' to weapons tight", () => {
    expect(fillScenario(legacySave('confirmed')).roe).toBe('tight')
  })

  it('defaults to tight when neither field exists', () => {
    expect(fillScenario(legacySave()).roe).toBe('tight')
  })

  it('an explicit roe wins over a legacy engageOn', () => {
    const s: Scenario = { ...legacySave('detected'), roe: 'hold' }
    expect(fillScenario(s).roe).toBe('hold')
  })

  it('keeps saved fields while filling defaults', () => {
    const s = legacySave('confirmed')
    s.name = 'Old save'
    const out = fillScenario(s)
    expect(out.name).toBe('Old save')
    expect(out.schemaVersion).toBe(1)
  })
})

describe('geoRef load fill', () => {
  it('loads a save made before geoRef existed with null', () => {
    const s = emptyScenario()
    delete (s as { geoRef?: unknown }).geoRef
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(out.geoRef).toBeNull()
  })

  it('keeps a saved geoRef', () => {
    const s = emptyScenario()
    s.geoRef = { lat: 32.9866, lon: -114.3355 }
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(out.geoRef).toEqual({ lat: 32.9866, lon: -114.3355 })
  })
})

/** A summary the size a real pin stores; every field JSON-safe. */
function sampleSummary(): AarSummary {
  return {
    roe: 'tight',
    raidSize: 2,
    expectedHardKills: 0.9,
    expectedSoftKills: 0.4,
    expectedKills: 1.3,
    expectedLeakers: 0.7,
    leakProbability: 0.35,
    firstDetectS: 0,
    firstShotS: 5.5,
    shotsFired: 6,
    effectors: [
      {
        effectorId: 'eff-1',
        name: 'Interceptor Alpha',
        effectorType: 'interceptor',
        shotsFired: 6,
        expectedRoundsRemaining: 4,
        magazineSize: 10,
      },
    ],
    threats: [
      {
        uasId: 'uas-1',
        name: 'Threat A',
        shipCount: 2,
        detectS: 0,
        detectSensorName: 'Radar',
        unknownAtS: 0,
        suspectedAtS: 0,
        hostileAtS: 5.5,
        engageS: 5.5,
        shotsFired: 6,
        expectedHardKills: 0.9,
        expectedSoftKills: 0.4,
        leakProbability: 0.35,
        outcome: 'hard-kill',
        killedByName: 'Interceptor Alpha',
      },
    ],
  }
}

describe('scorecard pins across save shapes', () => {
  it('loads an old-shape pinned scorecard that has no AAR fields', () => {
    const s = legacySave('confirmed')
    const oldPin: ScorecardSnap = {
      id: 'scc-1',
      name: 'Config 1',
      score: 55,
      parts: { warning: 1, coverage: 1, confirm: 0.5, engage: 0.5 },
    }
    s.scorecards = [oldPin]
    const out = fillScenario(s)
    expect(out.scorecards).toHaveLength(1)
    expect(out.scorecards![0].score).toBe(55)
    expect(out.scorecards![0].aar).toBeUndefined()
  })

  it('round-trips a pin that carries the AAR summary', () => {
    const s = emptyScenario()
    s.scorecards = [
      {
        id: 'scc-2',
        name: 'Config 2',
        score: 70,
        parts: { warning: 1, coverage: 1, confirm: 1, engage: 1, attrition: 0.65 },
        aar: sampleSummary(),
      },
    ]
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(out.scorecards![0].aar).toEqual(sampleSummary())
  })
})

describe('AAR export payload', () => {
  it('is valid JSON-serializable with the summary shape', () => {
    const obj = aarExportObject('Demo Laydown', sampleSummary())
    expect(obj.rangeboardAar).toBe(1)
    expect(obj.scenario).toBe('Demo Laydown')
    const round = JSON.parse(JSON.stringify(obj)) as typeof obj
    expect(round).toEqual(obj)
    expect(round.summary.raidSize).toBe(2)
    expect(round.summary.threats[0].outcome).toBe('hard-kill')
    expect(round.summary.effectors[0].expectedRoundsRemaining).toBe(4)
  })

  it('builds a run-scoped package with configuration, ledger, and model-basis labels', () => {
    const scenario = emptyScenario()
    scenario.name = 'Clean run demo'
    const attrition: AttritionReport = {
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
        reportedLeakers: null,
        shotsFired: 0,
        deSalvos: 0,
        jamSalvos: 0,
      },
      events: [],
    }
    const out = runExportObject(
      scenario,
      {
        id: 'simrun-1',
        label: 'RUN-0001',
        sequence: 1,
        startedAt: '2026-08-24T19:00:00.000Z',
        completedAt: '2026-08-24T19:01:00.000Z',
        durationS: 60,
        observedThroughS: 60,
      },
      [],
      attrition,
      sampleSummary(),
    )
    expect(out.rangeboardRun).toBe(1)
    expect(out.dataBasis).toEqual({
      kind: 'deterministic-planning-model',
      sampleStepS: 0.5,
      independentlyInstrumented: false,
      runScoped: true,
    })
    expect(out.run.label).toBe('RUN-0001')
    expect(out.scenario.name).toBe('Clean run demo')
    expect(out.requirements.overall).toBe('not-evaluated')
    expect(out.requirements.gates).toHaveLength(6)
    expect(out.validity.validity).toBe('pending')
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })
})

describe('requirement threshold load fill', () => {
  it('fills the defaults on a save made before requirements existed', () => {
    const s = emptyScenario()
    delete (s as { requirements?: unknown }).requirements
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(out.requirements).toEqual({ maxResidualPerTrack: 0.1, minWarningS: null })
    expect(out.schemaVersion).toBe(1)
  })

  it('keeps saved thresholds', () => {
    const s = emptyScenario()
    s.requirements = { maxResidualPerTrack: 0.02, minWarningS: 120 }
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(out.requirements).toEqual({ maxResidualPerTrack: 0.02, minWarningS: 120 })
  })

  it('fills only the missing threshold when a save carries one of them', () => {
    const s = emptyScenario()
    s.requirements = { minWarningS: 90 } as Scenario['requirements']
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(out.requirements).toEqual({ maxResidualPerTrack: 0.1, minWarningS: 90 })
  })
})

function entity(id: string, kind: Entity['kind'], specId: string | null, x: number): Entity {
  return {
    id,
    name: id.toUpperCase(),
    kind,
    specId,
    pos: { x, y: 0 },
    headingDeg: 0,
    color: null,
    notes: '',
  }
}

function emptyAttrition(): AttritionReport {
  return {
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
      reportedLeakers: null,
      shotsFired: 0,
      deSalvos: 0,
      jamSalvos: 0,
    },
    events: [],
  }
}

function runMeta() {
  return {
    id: 'simrun-2',
    label: 'RUN-0002',
    sequence: 2,
    startedAt: '2026-08-24T19:00:00.000Z',
    completedAt: '2026-08-24T19:01:00.000Z',
    durationS: 60,
    observedThroughS: 60,
  }
}

describe('run export validity record', () => {
  /** Threat spawning inside a 10 km radar ring: the detect result is invalid. */
  function spawnInRingRun() {
    const scenario = emptyScenario()
    scenario.entities.push(entity('s1', 'sensor', 'lib-lstar', 0))
    scenario.entities.push(entity('u1', 'uas', 'lib-mavic3', 2800))
    scenario.paths.push({
      id: 'p1',
      entityId: 'u1',
      points: [{ x: 2800, y: 0 }, { x: 22800, y: 0 }],
      speedMps: 15,
      startDelayS: 0,
    })
    const assessment: ThreatAssessment = {
      uasId: 'u1',
      status: 'engageable',
      firstDetectS: 0,
      firstDetectSensorId: 's1',
      firstConfirmS: 0,
      techs: ['radar'],
      swarmMerged: false,
      cpaAssetId: null,
      cpaS: null,
      cpaDistanceM: null,
      assetId: null,
      closestApproachM: null,
      arrivalS: null,
      warningS: null,
      windowS: null,
      windowEffectorId: null,
      classificationAtS: { unknownAtS: 0, suspectedAtS: 0, hostileAtS: 0 },
      engageGateS: 0,
      detectingSensorIds: ['s1'],
      effectorWindows: [],
    }
    return runExportObject(scenario, runMeta(), [assessment], emptyAttrition(), sampleSummary())
  }

  it('records the invalid run and the finding behind it', () => {
    const out = spawnInRingRun()
    expect(out.validity.validity).toBe('invalid')
    expect(out.validity.findings.map((f) => f.id)).toContain('spawn-in-ring')
    const spawn = out.validity.findings.find((f) => f.id === 'spawn-in-ring')!
    expect(spawn.severity).toBe('invalidating')
    expect(spawn.uasIds).toEqual(['u1'])
    expect(spawn.gates).toEqual(['detect'])
  })

  it('does not score the detect gate on the invalidated track', () => {
    const detect = spawnInRingRun().requirements.gates.find((g) => g.id === 'detect')!
    expect(detect.status).toBe('not-evaluated')
    // Both findings that bear on Detect: the invalidating spawn and the
    // limiting laydown with no defended asset.
    expect(detect.caveats).toHaveLength(2)
    expect(detect.caveats[0]).toContain('1 track not scored here')
    expect(detect.notEvaluatedReason).toBe('every track is invalidated by a run validity finding')
  })

  it('keeps the dataBasis block and stays JSON-serializable', () => {
    const out = spawnInRingRun()
    expect(out.dataBasis).toEqual({
      kind: 'deterministic-planning-model',
      sampleStepS: 0.5,
      independentlyInstrumented: false,
      runScoped: true,
    })
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })
})

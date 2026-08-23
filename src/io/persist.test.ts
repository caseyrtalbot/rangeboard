import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { AarSummary, EngagePolicy, Scenario, ScorecardSnap } from '../model/types'
import { aarExportObject, fillScenario } from './persist'

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
})

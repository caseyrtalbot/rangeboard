import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../model/seed'
import type {
  AarSummary,
  EngagePolicy,
  Entity,
  Provenance,
  Scenario,
  ScorecardSnap,
  SpecModel,
} from '../model/types'
import { runSettings } from '../model/types'
import type { AttritionReport } from '../playback/attrition'
import type { McSummary, Stat } from '../playback/mcRun'
import type { ThreatAssessment } from '../playback/sim'
import {
  aarExportObject,
  adoptSeedProvenance,
  fillScenario,
  loadAutosave,
  runExportObject,
  scenarioHasWork,
} from './persist'

import { SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX } from './storageKeys'


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
      semantics: 'planning-envelope',
      sampleStepS: 0.5,
      independentlyInstrumented: false,
      runScoped: true,
    })
    expect(out.run.label).toBe('RUN-0001')
    expect(out.scenario.name).toBe('Clean run demo')
    expect(out.requirements.overall).toBe('not-evaluated')
    expect(out.requirements.gates).toHaveLength(6)
    expect(out.validity.validity).toBe('pending')
    // The empty-laydown models: environment on and fire doctrine on.
    expect(out.models.map((m) => m.id)).toEqual(['environment', 'doctrine'])
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })
})

describe('run export Monte Carlo basis', () => {
  function mcSummary(): McSummary {
    const stat: Stat = {
      mean: 1, sd: 0, se: 0, lo: 1, hi: 1, conf: 0.95,
      p10: 1, p90: 1, p025: 1, p975: 1, n: 5, total: 5,
      defined: { p: 1, lo: 0.57, hi: 1 },
    }
    const band = {
      mean: [0, 1], lo: [0, 1], hi: [0, 1], p10: [0, 1], p90: [0, 1], p025: [0, 1], p975: [0, 1],
    }
    return {
      seed: 77,
      replicates: 5,
      stopped: { rule: 'replicates', at: 5 },
      durationS: 0.5,
      kills: band,
      leakers: band,
      detected: band,
      tracked: band,
      engaged: band,
      firstDetectS: stat,
      minWarningS: stat,
      perThreat: {},
      perEffector: {},
      elapsedMs: 12,
    }
  }

  it('exports a replicate-mode scenario with no finished run as the envelope', () => {
    const scenario = emptyScenario()
    scenario.runMode = 'monte-carlo'
    const out = runExportObject(scenario, runMeta(), [], emptyAttrition(), sampleSummary())
    expect(out.dataBasis.kind).toBe('deterministic-planning-model')
    expect(out.dataBasis.semantics).toBe('planning-envelope')
    expect(out.models.map((m) => m.id)).not.toContain('draw-policy')
    expect(out.validity.findings.map((f) => f.id)).toContain('planning-envelope')
    expect(out.scenario.runMode).toBe('monte-carlo')
  })

  it('labels a replicate run with its seed and count and carries the summary', () => {
    const summary = mcSummary()
    // The run mode is a scenario fact, and `models` reads it, so the fixture
    // sets it as a replicate run would.
    const scenario = emptyScenario()
    scenario.runMode = 'monte-carlo'
    const out = runExportObject(
      scenario,
      runMeta(),
      [],
      emptyAttrition(),
      sampleSummary(),
      summary,
    )
    expect(out.dataBasis.kind).toBe('monte-carlo')
    expect(out.dataBasis.semantics).toBe('estimate')
    expect(out.dataBasis.seed).toBe(77)
    expect(out.dataBasis.replicates).toBe(5)
    expect(out.dataBasis.stopped).toEqual({ rule: 'replicates', at: 5 })
    expect(out.mcSummary).toBe(summary)
    // The empty laydown under Monte Carlo: environment, fire doctrine, draw policy.
    expect(out.models.map((m) => m.id)).toEqual(['environment', 'doctrine', 'draw-policy'])
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })

  it('keeps the deterministic basis and no mcSummary key without a summary', () => {
    const out = runExportObject(emptyScenario(), runMeta(), [], emptyAttrition(), sampleSummary())
    expect(out.dataBasis.kind).toBe('deterministic-planning-model')
    expect(out.dataBasis.semantics).toBe('planning-envelope')
    expect('seed' in out.dataBasis).toBe(false)
    expect('mcSummary' in out).toBe(false)
  })
})

describe('requirement threshold load fill', () => {
  it('fills the defaults on a save made before requirements existed', () => {
    const s = emptyScenario()
    delete (s as { requirements?: unknown }).requirements
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(out.requirements).toEqual({ maxResidualPerTrack: 0.1, minWarningS: null, pdDetect: 0.5, pdTrackCumulative: 0.9 })
    expect(out.schemaVersion).toBe(1)
  })

  it('keeps saved thresholds', () => {
    const s = emptyScenario()
    s.requirements = { maxResidualPerTrack: 0.02, minWarningS: 120, pdDetect: 0.8, pdTrackCumulative: 0.95 }
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(out.requirements).toEqual({ maxResidualPerTrack: 0.02, minWarningS: 120, pdDetect: 0.8, pdTrackCumulative: 0.95 })
  })

  it('fills only the missing threshold when a save carries one of them', () => {
    const s = emptyScenario()
    s.requirements = { minWarningS: 90 } as Scenario['requirements']
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(out.requirements).toEqual({ maxResidualPerTrack: 0.1, minWarningS: 90, pdDetect: 0.5, pdTrackCumulative: 0.9 })
  })
})

describe('run settings load fill', () => {
  it('fills the run mode, seed and replicate count on a save made before they existed', () => {
    const s = emptyScenario()
    delete s.runMode
    delete s.seed
    delete s.replicates
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(runSettings(out)).toEqual({
      runMode: 'deterministic',
      seed: 4821,
      replicates: 100,
      targetHalfWidth: null,
    })
    expect(out.schemaVersion).toBe(1)
  })

  it('reads a null target half-width through runSettings on a save without the field', () => {
    const s = emptyScenario()
    delete s.targetHalfWidth
    const out = fillScenario(JSON.parse(JSON.stringify(s)) as Scenario)
    expect(runSettings(out).targetHalfWidth).toBeNull()
    expect(runSettings({ ...out, targetHalfWidth: 0.2 }).targetHalfWidth).toBe(0.2)
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
    // Every finding that bears on Detect: the invalidating spawn, the limiting
    // laydown with no defended asset, the deterministic envelope and the
    // unvalidated models.
    expect(detect.caveats).toHaveLength(4)
    expect(detect.caveats[0]).toContain('1 track not scored here')
    expect(detect.notEvaluatedReason).toBe('every track is invalidated by a run validity finding')
  })

  it('keeps the dataBasis block and stays JSON-serializable', () => {
    const out = spawnInRingRun()
    expect(out.dataBasis).toEqual({
      kind: 'deterministic-planning-model',
      semantics: 'planning-envelope',
      sampleStepS: 0.5,
      independentlyInstrumented: false,
      runScoped: true,
    })
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })
})

describe('seed library and preset merge on load', () => {
  /** A save whose library and presets predate later seed additions. */
  function staleSave(): Scenario {
    const s = emptyScenario()
    s.library = s.library.slice(0, 3)
    s.systemPresets = s.systemPresets.slice(0, 1)
    return s
  }

  it('gives an old save every seed model and preset added since', () => {
    const seeds = emptyScenario()
    const filled = fillScenario(staleSave())
    expect(filled.library).toHaveLength(seeds.library.length)
    expect(filled.systemPresets).toHaveLength(seeds.systemPresets.length)
    for (const seed of seeds.library) {
      expect(filled.library.some((m) => m.id === seed.id), seed.id).toBe(true)
    }
    for (const seed of seeds.systemPresets) {
      expect(filled.systemPresets.some((p) => p.id === seed.id), seed.id).toBe(true)
    }
  })

  it('keeps a user edit to a seed model instead of restoring the seed value', () => {
    const save = staleSave()
    save.library[0] = { ...save.library[0], name: 'Renamed by the user' }
    const filled = fillScenario(save)
    const edited = filled.library.find((m) => m.id === save.library[0].id)!
    expect(edited.name).toBe('Renamed by the user')
    expect(filled.library.filter((m) => m.id === edited.id)).toHaveLength(1)
  })

  it('keeps custom models and does not duplicate any id', () => {
    const save = staleSave()
    save.library.push({
      id: 'lib-custom-1',
      name: 'Custom sensor',
      kind: 'sensor',
      description: '',
      color: '#888888',
      builtin: false,
      sensor: { sensorType: 'radar', detectRangeM: 1000, classifyRangeM: null, sectorDeg: 360 },
    })
    const filled = fillScenario(save)
    expect(filled.library.some((m) => m.id === 'lib-custom-1')).toBe(true)
    const ids = filled.library.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('takes the whole seed set when a save carries no library at all', () => {
    const save = emptyScenario()
    delete (save as Partial<Scenario>).library
    const filled = fillScenario(save)
    expect(filled.library).toHaveLength(emptyScenario().library.length)
  })
})

describe('deleted seed ids on load', () => {
  it('does not restore a seed model or preset the user deleted', () => {
    const s = emptyScenario()
    const model = s.library[0]
    const preset = s.systemPresets[0]
    s.library = s.library.filter((m) => m.id !== model.id)
    s.systemPresets = s.systemPresets.filter((p) => p.id !== preset.id)
    s.deletedSeedIds = [model.id, preset.id]
    const filled = fillScenario(s)
    expect(filled.library.some((m) => m.id === model.id)).toBe(false)
    expect(filled.systemPresets.some((p) => p.id === preset.id)).toBe(false)
    expect(filled.deletedSeedIds).toEqual([model.id, preset.id])
  })

  it('defaults to an empty list on a save made before the field existed', () => {
    const s = emptyScenario()
    delete s.deletedSeedIds
    expect(fillScenario(s).deletedSeedIds).toEqual([])
  })
})

describe('observed lens preset on load', () => {
  it('defaults to null on an older save and keeps a saved lens id', () => {
    const s = emptyScenario()
    delete s.observedPresetId
    expect(fillScenario(s).observedPresetId).toBeNull()
    const observed = emptyScenario()
    observed.observedPresetId = 'sensors'
    expect(fillScenario(observed).observedPresetId).toBe('sensors')
  })
})

describe('nested object load fill', () => {
  it('fills doctrine, mcda weights, underlay, and raid fields an old save lacks', () => {
    const s = emptyScenario() as unknown as Record<string, unknown>
    s.doctrine = { enabled: true }
    s.mcdaWeights = { warning: 5 }
    s.underlay = { dataUrl: null }
    s.raid = {}
    const filled = fillScenario(s as unknown as Scenario)
    const empty = emptyScenario()
    expect(filled.doctrine).toEqual({ ...empty.doctrine, enabled: true })
    expect(filled.mcdaWeights).toEqual({ ...empty.mcdaWeights, warning: 5 })
    expect(filled.underlay).toEqual(empty.underlay)
    expect(filled.raid).toEqual({ waves: [] })
  })

  it('a doctrine record saved before launch policies existed adopts the doctrinal sequence', () => {
    const s = emptyScenario() as unknown as Record<string, unknown>
    // Pre-launch-policy shape: enabled false was the default of the day.
    s.doctrine = { enabled: false, trackFirmS: 5, declareHostileS: 10, bdaS: 10, pkCommit: 0.35, opportunities: 2 }
    const filled = fillScenario(s as unknown as Scenario)
    expect(filled.doctrine?.enabled).toBe(true)
    expect(filled.doctrine?.launchPolicy).toBe('pk-commit')
    expect(filled.doctrine?.declareHostileS).toBe(10)
  })

  it('a doctrine record with a launch policy keeps its enabled flag', () => {
    const s = emptyScenario()
    s.doctrine = { ...s.doctrine!, enabled: false }
    expect(fillScenario(s).doctrine?.enabled).toBe(false)
  })
})

// The node test env has no Web Storage or window; both get stand-ins.
function stubStorage(raw: string | null): Map<string, string> {
  const store = new Map<string, string>()
  if (raw != null) store.set(SCENARIO_KEY, raw)
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  return store
}

describe('autosave recovery', () => {
  afterEach(() => vi.unstubAllGlobals())

  function recoveryKeys(store: Map<string, string>): string[] {
    return [...store.keys()].filter((k) => k.startsWith(SCENARIO_RECOVERY_PREFIX))
  }

  it('copies an unparseable save to a recovery key and tells the user', () => {
    const store = stubStorage('{not json')
    const alert = vi.fn()
    vi.stubGlobal('window', { alert })
    expect(loadAutosave()).toBeNull()
    const keys = recoveryKeys(store)
    expect(keys).toHaveLength(1)
    expect(store.get(keys[0])).toBe('{not json')
    expect(store.get(SCENARIO_KEY)).toBe('{not json')
    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert.mock.calls[0][0]).toContain(keys[0])
  })

  it('copies a save with another schema version to a recovery key', () => {
    const raw = JSON.stringify({ ...emptyScenario(), schemaVersion: 2 })
    const store = stubStorage(raw)
    expect(loadAutosave()).toBeNull()
    const keys = recoveryKeys(store)
    expect(keys).toHaveLength(1)
    expect(store.get(keys[0])).toBe(raw)
  })

  it('loads a valid save without writing a recovery key', () => {
    const store = stubStorage(JSON.stringify({ ...emptyScenario(), name: 'kept' }))
    expect(loadAutosave()?.name).toBe('kept')
    expect(recoveryKeys(store)).toHaveLength(0)
  })

  it('returns null and writes nothing when no save exists', () => {
    const store = stubStorage(null)
    expect(loadAutosave()).toBeNull()
    expect(store.size).toBe(0)
  })
})

describe('scenarioHasWork', () => {
  it('is false for an empty board and true once an entity, path, or boundary exists', () => {
    const s = emptyScenario()
    expect(scenarioHasWork(s)).toBe(false)
    expect(scenarioHasWork({ ...s, boundaries: [{ id: 'b', name: 'b', type: 'range', points: [], closed: true, altBandFt: null }] })).toBe(true)
    expect(scenarioHasWork({ ...s, paths: [{ id: 'p', entityId: 'e', points: [], speedMps: null, startDelayS: 0 }] })).toBe(true)
  })
})

/** A sensor model with two spec fields and one source row on updateRateS. */
function seedModel(): SpecModel {
  return {
    id: 'lib-x',
    name: 'X radar',
    kind: 'sensor',
    description: '',
    color: '#888888',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM: 4000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
      updateRateS: 1,
    },
    provenance: [
      {
        field: 'updateRateS',
        value: '1 s',
        source: 'a maker page',
        url: 'https://example.test/x',
        date: '2026-09-04',
        basis: 'reference',
      },
      {
        field: 'detectRangeM',
        value: '4000 m',
        source: 'a maker page',
        url: 'https://example.test/x',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  }
}

describe('adoptSeedProvenance', () => {
  it('gives an unedited field the seed row', () => {
    const seed = seedModel()
    const saved: SpecModel = { ...seed, provenance: undefined }
    const out = adoptSeedProvenance(saved, seed)
    expect(out.provenance?.map((r) => r.field)).toEqual(['updateRateS', 'detectRangeM'])
  })

  it('gives an edited field no row', () => {
    const seed = seedModel()
    const saved: SpecModel = {
      ...seed,
      sensor: { ...seed.sensor!, updateRateS: 4 },
      provenance: undefined,
    }
    const out = adoptSeedProvenance(saved, seed)
    expect(out.provenance?.map((r) => r.field)).toEqual(['detectRangeM'])
  })

  it('keeps a saved row over the seed row for the same field', () => {
    const seed = seedModel()
    const mine: Provenance = {
      field: 'updateRateS',
      value: '1 s',
      source: 'my note',
      url: null,
      date: '2026-01-01',
      basis: 'pf',
    }
    const out = adoptSeedProvenance({ ...seed, provenance: [mine] }, seed)
    expect(out.provenance?.find((r) => r.field === 'updateRateS')).toEqual(mine)
    expect(out.provenance).toHaveLength(2)
  })

  it('returns a custom model unchanged', () => {
    const seed = seedModel()
    const saved: SpecModel = { ...seed, builtin: false, provenance: undefined }
    expect(adoptSeedProvenance(saved, seed)).toBe(saved)
  })

  it('returns the same object when every seed row is already there', () => {
    const seed = seedModel()
    const saved: SpecModel = { ...seed }
    expect(adoptSeedProvenance(saved, seed)).toBe(saved)
  })
})

describe('seed provenance reaches an existing save', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** A save whose Giraffe 1X copy predates the provenance rows. */
  function saveWithoutGiraffeRows(): Scenario {
    const s = emptyScenario()
    s.library = s.library.map((m) =>
      m.id === 'lib-giraffe1x' ? { ...m, provenance: undefined } : m,
    )
    return s
  }

  it('fillScenario adopts the updateRateS row', () => {
    const filled = fillScenario(saveWithoutGiraffeRows())
    const giraffe = filled.library.find((m) => m.id === 'lib-giraffe1x')
    expect(giraffe?.provenance?.map((r) => r.field)).toContain('updateRateS')
  })

  it('loads that save without writing a recovery key', () => {
    const store = stubStorage(JSON.stringify(saveWithoutGiraffeRows()))
    const loaded = loadAutosave()
    const giraffe = loaded?.library.find((m) => m.id === 'lib-giraffe1x')
    expect(giraffe?.provenance?.some((r) => r.field === 'updateRateS')).toBe(true)
    expect([...store.keys()].filter((k) => k.startsWith(SCENARIO_RECOVERY_PREFIX))).toHaveLength(0)
  })
})

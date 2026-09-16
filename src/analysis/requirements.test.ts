import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, FlightPath, Scenario } from '../model/types'
import type { AttritionReport } from '../playback/attritionReport'
import { SHIP_DEAD_BELOW } from '../playback/pk'
import type { ThreatAssessment } from '../playback/sim'
import { buildRequirementGateReport } from './requirements'

function fixture() {
  const scenario = emptyScenario()
  const asset: Entity = {
    id: 'a1',
    name: 'Command post',
    kind: 'asset',
    specId: null,
    pos: { x: 20000, y: 0 },
    headingDeg: 0,
    color: null,
    notes: '',
  }
  const threat: Entity = {
    id: 'u1',
    name: 'Threat 1',
    kind: 'uas',
    specId: 'lib-mavic3',
    pos: { x: 0, y: 0 },
    headingDeg: 0,
    color: null,
    notes: '',
  }
  const path: FlightPath = {
    id: 'p1',
    entityId: threat.id,
    points: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ],
    speedMps: 10,
    startDelayS: 0,
  }
  scenario.entities.push(asset, threat)
  scenario.paths.push(path)
  scenario.roe = 'free'
  const assessment: ThreatAssessment = {
    uasId: threat.id,
    status: 'engageable',
    firstDetectS: 10,
    firstDetectSensorId: 's1',
    firstConfirmS: 15,
    techs: ['radar'],
    swarmMerged: false,
    cpaAssetId: asset.id,
    cpaS: 50,
    cpaDistanceM: 0,
    assetId: asset.id,
    closestApproachM: 0,
    arrivalS: 50,
    warningS: 40,
    windowS: [20, 40],
    windowEffectorId: 'e1',
    classificationAtS: { unknownAtS: 10, suspectedAtS: 10, hostileAtS: 15 },
    engageGateS: 10,
    detectingSensorIds: ['s1'],
    sensorObservations: [
      {
        sensorId: 's1',
        sensorType: 'radar',
        firstDetectS: 10,
        lastDetectS: 40,
        firstClassifyS: 15,
        heldSamples: 61,
        resolvedEver: true,
        // Slant: 1 km ground range to a 300 ft threat from a 4 m phase
        // center, matching the sensor this fixture adds. The gate report
        // reads the detect times, not the range.
        minSlantM: 1004,
        intervals: [[10, 40]],
        trackInitAtS: null,
        coastIntervals: [],
      },
    ],
    effectorWindows: [{ effectorId: 'e1', intervals: [[20, 40]] }],
  }
  const report: AttritionReport = {
    threats: [
      {
        uasId: threat.id,
        shipCount: 1,
        expectedKills: 0.96,
        expectedHardKills: 0.96,
        expectedSoftKills: 0,
        expectedLateKills: 0,
        expectedLateHardKills: 0,
        expectedLateSoftKills: 0,
        arrived: true,
        expectedLeakers: 0.04,
        expectedNoArrival: 0,
        leakProbability: 0.04,
        continueJamProb: 0,
        firstShotS: 20,
        shotsFired: 2,
        deSalvos: 0,
        jamSalvos: 0,
        killedByEffectorId: 'e1',
        killedBySoft: false,
      },
    ],
    effectors: [],
    totals: {
      raidSize: 1,
      expectedKills: 0.96,
      expectedHardKills: 0.96,
      expectedSoftKills: 0,
      expectedLateKills: 0,
      expectedLeakers: 0.04,
      expectedNoArrival: 0,
      reportedLeakers: 0.04,
      shotsFired: 2,
      deSalvos: 0,
      jamSalvos: 0,
    },
    events: [],
  }
  return { scenario, assessment, report }
}

/**
 * Sensor whose 10 km ring covers the fixture threat spawn at the origin.
 * Elevation: the LSTAR cone is [0, 30] deg, so the sensor stands 1 km off
 * the spawn, not on it. A 300 ft Mavic 3 over the spawn then sits at 5.0 deg
 * from the 4 m phase center, inside the cone; directly overhead it is at
 * 90 deg, in the cone of silence, and the sensor holds nothing.
 */
function addSensorCoveringSpawn(scenario: Scenario): void {
  scenario.entities.push({
    id: 's1',
    name: 'LSTAR',
    kind: 'sensor',
    specId: 'lib-lstar',
    pos: { x: 0, y: 1000 },
    headingDeg: 0,
    color: null,
    notes: '',
  })
}

function gateOf(result: ReturnType<typeof buildRequirementGateReport>, id: string) {
  return result.gates.find((g) => g.id === id)!
}

describe('non-compensating requirement gates', () => {
  it('passes only when every requirement passes', () => {
    const { scenario, assessment, report } = fixture()
    const result = buildRequirementGateReport(scenario, [assessment], report)
    expect(result.overall).toBe('pass')
    expect(result.met).toBe(6)
    expect(result.gates.every((gate) => gate.status === 'pass')).toBe(true)
    // A deterministic run carries the planning-envelope and unvalidated-model
    // caveats on every gate; no other caveat applies here.
    expect(result.gates.every((gate) => gate.caveats.length === 2)).toBe(true)
    expect(result.gates.every((gate) => gate.notEvaluatedReason === null)).toBe(true)
  })

  it('does not let other gates compensate for a failed identification requirement', () => {
    const { scenario, assessment, report } = fixture()
    assessment.classificationAtS.hostileAtS = null
    const result = buildRequirementGateReport(scenario, [assessment], report)
    expect(result.overall).toBe('fail')
    expect(result.met).toBe(5)
    expect(gateOf(result, 'identify').status).toBe('fail')
  })

  it('marks engagement requirements not evaluated under weapons hold', () => {
    const { scenario, assessment, report } = fixture()
    scenario.roe = 'hold'
    const result = buildRequirementGateReport(scenario, [assessment], report)
    expect(result.overall).toBe('not-evaluated')
    expect(
      result.gates.filter((gate) => ['target', 'engage', 'effect'].includes(gate.id)),
    ).toHaveLength(3)
    expect(gateOf(result, 'effect').status).toBe('not-evaluated')
    expect(gateOf(result, 'effect').notEvaluatedReason).toBe(
      'ROE hold: the run assigns no engagements',
    )
  })
})

describe('the Effect requirement is test-defined, not an engine constant', () => {
  it('defaults to a threshold that is not the engine fire-cutoff', () => {
    expect(emptyScenario().requirements.maxResidualPerTrack).toBe(0.1)
    expect(emptyScenario().requirements.maxResidualPerTrack).not.toBe(SHIP_DEAD_BELOW)
  })

  it('names the scenario as the source of the threshold', () => {
    const { scenario, assessment, report } = fixture()
    const gate = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'effect')
    expect(gate.detail).toBe(
      '0.04 expected ships residual · requirement ≤10% per track (scenario setting)',
    )
  })

  it('says residual is not measurable when no asset is placed', () => {
    // reportedLeakers is null for an asset-free laydown. Printing 0.00 there
    // would read as a perfect defence, so the gate names the missing asset.
    const { scenario, assessment, report } = fixture()
    report.totals.reportedLeakers = null
    const gate = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'effect')
    expect(gate.detail).toBe(
      'residual not measurable: no defended asset placed · requirement ≤10% per track (scenario setting)',
    )
    expect(gate.detail).not.toContain('0.00')
  })

  it('fails a residual the engine cutoff alone would have passed', () => {
    const { scenario, assessment, report } = fixture()
    // 0.045 sits below SHIP_DEAD_BELOW (0.05), so the engine stops firing here.
    // The test asks for 3%, so this fails.
    report.threats[0].leakProbability = 0.045
    scenario.requirements.maxResidualPerTrack = 0.03
    const result = buildRequirementGateReport(scenario, [assessment], report)
    const gate = gateOf(result, 'effect')
    expect(gate.status).toBe('fail')
    expect(gate.failures).toEqual([{ uasId: 'u1', name: 'Threat 1', reason: '4.5% residual' }])
    expect(gate.detail).toContain('requirement ≤3% per track (scenario setting)')
    expect(result.overall).toBe('fail')
  })

  it('passes the same residual against a looser test threshold', () => {
    const { scenario, assessment, report } = fixture()
    report.threats[0].leakProbability = 0.045
    scenario.requirements.maxResidualPerTrack = 0.05
    expect(
      gateOf(buildRequirementGateReport(scenario, [assessment], report), 'effect').status,
    ).toBe('pass')
  })
})

describe('Detect is a performance test, not a presence test', () => {
  it('drops a spawn-in-ring track from the population and says why', () => {
    const { scenario, assessment, report } = fixture()
    addSensorCoveringSpawn(scenario)
    const result = buildRequirementGateReport(scenario, [assessment], report)
    const detect = gateOf(result, 'detect')
    expect(detect.status).toBe('not-evaluated')
    expect(detect.met).toBe(0)
    expect(detect.notEvaluatedReason).toBe('every track is invalidated by a run validity finding')
    // The spawn caveat, then the two run-basis caveats of a deterministic run.
    expect(detect.caveats).toHaveLength(3)
    expect(detect.caveats[0]).toBe(
      '1 track not scored here. First detection not assessed: Threat 1 starts inside detection coverage.',
    )
    // The invalidated track still scores every gate the finding does not touch.
    expect(gateOf(result, 'track').status).toBe('pass')
    expect(gateOf(result, 'track').required).toBe(1)
    expect(result.overall).toBe('not-evaluated')
  })

  it('fails a detection that does not precede arrival', () => {
    const { scenario, assessment, report } = fixture()
    assessment.firstDetectS = 60
    assessment.warningS = -10
    const detect = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'detect')
    expect(detect.status).toBe('fail')
    expect(detect.failures[0].reason).toBe('detected 1:00, not before arrival 0:50')
  })

  it('fails a warning time below the scenario requirement', () => {
    const { scenario, assessment, report } = fixture()
    scenario.requirements.minWarningS = 60
    const detect = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'detect')
    expect(detect.status).toBe('fail')
    expect(detect.failures[0].reason).toBe('0:40 warning, requirement 1:00')
    expect(detect.detail).toBe(
      'minimum warning 0:40 · requirement ≥1:00 warning (scenario setting)',
    )
  })

  it('passes a warning time at or above the scenario requirement', () => {
    const { scenario, assessment, report } = fixture()
    scenario.requirements.minWarningS = 40
    expect(
      gateOf(buildRequirementGateReport(scenario, [assessment], report), 'detect').status,
    ).toBe('pass')
  })

  it('says no defended asset is placed instead of no asset warning time', () => {
    const { scenario, assessment, report } = fixture()
    scenario.entities = scenario.entities.filter((e) => e.kind !== 'asset')
    assessment.arrivalS = null
    assessment.warningS = null
    const detect = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'detect')
    expect(detect.status).toBe('pass')
    expect(detect.detail).toBe('no defended asset placed')
    expect(detect.caveats[0]).toContain('No defended asset is placed')
  })

  it('does not score a warning requirement it cannot measure', () => {
    const { scenario, assessment, report } = fixture()
    scenario.entities = scenario.entities.filter((e) => e.kind !== 'asset')
    scenario.requirements.minWarningS = 60
    assessment.arrivalS = null
    assessment.warningS = null
    const detect = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'detect')
    expect(detect.status).toBe('not-evaluated')
    expect(detect.notEvaluatedReason).toBe(
      'a warning time requirement is set but no defended asset is placed',
    )
  })
})

describe('Track keeps a decision point without an arrival', () => {
  it('falls back to closest approach when the threat never arrives', () => {
    const { scenario, assessment, report } = fixture()
    assessment.arrivalS = null
    assessment.warningS = null
    assessment.windowS = null
    assessment.cpaS = 30
    report.threats[0].firstShotS = null
    const track = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'track')
    expect(track.status).toBe('pass')
    expect(track.metric).toBe('1/1 held')
    expect(track.detail).toContain('closest approach')
  })

  it('reports no decision point when there is no arrival and no closest approach', () => {
    const { scenario, assessment, report } = fixture()
    assessment.arrivalS = null
    assessment.warningS = null
    assessment.windowS = null
    assessment.cpaS = null
    report.threats[0].firstShotS = null
    const track = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'track')
    expect(track.status).toBe('fail')
    expect(track.failures[0].reason).toBe('no decision point')
  })

  it('fails a track the sensors dropped before closest approach', () => {
    const { scenario, assessment, report } = fixture()
    assessment.arrivalS = null
    assessment.warningS = null
    assessment.windowS = null
    assessment.cpaS = 90
    report.threats[0].firstShotS = null
    const track = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'track')
    expect(track.status).toBe('fail')
    expect(track.failures[0].reason).toBe('not held at 1:30')
  })
})

describe('gate populations exclude tracks with no flight path', () => {
  it('counts only pathed tracks and carries the caveat', () => {
    const { scenario, assessment, report } = fixture()
    scenario.entities.push({
      id: 'u2',
      name: 'Threat 2',
      kind: 'uas',
      specId: 'lib-mavic3',
      pos: { x: 5000, y: 5000 },
      headingDeg: 0,
      color: null,
      notes: '',
    })
    const noPath: ThreatAssessment = { ...assessment, uasId: 'u2', status: 'no-path' }
    const result = buildRequirementGateReport(scenario, [assessment, noPath], report)
    expect(gateOf(result, 'identify').required).toBe(1)
    expect(gateOf(result, 'identify').caveats[0]).toContain('Threat 2')
    expect(result.overall).toBe('pass')
  })
})

describe('C2 requirement basis', () => {
  it('keeps deterministic gate decisions and envelope caveats under MC settings', () => {
    const { scenario, assessment, report } = fixture()
    const det = buildRequirementGateReport(scenario, [assessment], report)
    scenario.runMode = 'monte-carlo'
    const mc = buildRequirementGateReport(scenario, [assessment], report, {
      validity: 'valid',
      findings: [],
    })
    expect(mc.basis).toBe('planning-envelope')
    expect(mc.overall).toBe(det.overall)
    expect(
      mc.gates.every((gate) => gate.caveats.some((text) => text.includes('threshold envelope'))),
    ).toBe(true)
  })

  it('explains a fully typed route blocked by missing fire-control uplink', () => {
    const { scenario, assessment, report } = fixture()
    assessment.status = 'no-fc-uplink'
    const target = gateOf(buildRequirementGateReport(scenario, [assessment], report), 'target')
    expect(target.status).toBe('fail')
    expect(target.failures[0].reason).toContain(
      'route has no fire-control sensor; geometry only, no shot',
    )
  })
})

import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, FlightPath } from '../model/types'
import type { AttritionReport } from '../playback/attrition'
import type { ThreatAssessment } from '../playback/sim'
import { buildRequirementGateReport } from './requirements'

function fixture() {
  const scenario = emptyScenario()
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
    points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
    speedMps: 10,
    startDelayS: 0,
  }
  scenario.entities.push(threat)
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
    assetId: 'a1',
    arrivalS: 50,
    closestApproachM: 0,
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
        intervals: [[10, 40]],
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
        leakProbability: 0.04,
        continueJamProb: 0,
        firstShotS: 20,
        shotsFired: 2,
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
      expectedLeakers: 0.04,
      shotsFired: 2,
      jamSalvos: 0,
    },
    events: [],
  }
  return { scenario, assessment, report }
}

describe('non-compensating requirement gates', () => {
  it('passes only when every requirement passes', () => {
    const { scenario, assessment, report } = fixture()
    const result = buildRequirementGateReport(scenario, [assessment], report)
    expect(result.overall).toBe('pass')
    expect(result.met).toBe(6)
    expect(result.gates.every((gate) => gate.status === 'pass')).toBe(true)
  })

  it('does not let other gates compensate for a failed identification requirement', () => {
    const { scenario, assessment, report } = fixture()
    assessment.classificationAtS.hostileAtS = null
    const result = buildRequirementGateReport(scenario, [assessment], report)
    expect(result.overall).toBe('fail')
    expect(result.met).toBe(5)
    expect(result.gates.find((gate) => gate.id === 'identify')?.status).toBe('fail')
  })

  it('marks engagement requirements not evaluated under weapons hold', () => {
    const { scenario, assessment, report } = fixture()
    scenario.roe = 'hold'
    const result = buildRequirementGateReport(scenario, [assessment], report)
    expect(result.overall).toBe('not-evaluated')
    expect(result.gates.filter((gate) => ['target', 'engage', 'effect'].includes(gate.id)))
      .toHaveLength(3)
    expect(result.gates.find((gate) => gate.id === 'effect')?.status).toBe('not-evaluated')
  })
})

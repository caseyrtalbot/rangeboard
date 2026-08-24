import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, FlightPath } from '../model/types'
import type { AttritionReport } from '../playback/attrition'
import type { ThreatAssessment } from '../playback/sim'
import { threatPictureAt } from './threatAggregation'

function addThreat(
  scenario: ReturnType<typeof emptyScenario>,
  id: string,
  note: string,
  wave: number,
) {
  const entity: Entity = {
    id,
    name: `THR-G3-OWA-01 ${id}`,
    kind: 'uas',
    specId: 'lib-shahed136',
    pos: { x: 0, y: 0 },
    headingDeg: 0,
    color: null,
    notes: note,
  }
  const path: FlightPath = {
    id: `p-${id}`,
    entityId: id,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    speedMps: 10,
    startDelayS: 0,
  }
  scenario.entities.push(entity)
  scenario.paths.push(path)
  while ((scenario.raid?.waves.length ?? 0) <= wave) {
    scenario.raid = { waves: [...(scenario.raid?.waves ?? []), { startDelayS: 0, entityIds: [] }] }
  }
  scenario.raid!.waves[wave].entityIds.push(id)
}

function assessment(id: string): ThreatAssessment {
  return {
    uasId: id,
    status: 'engageable',
    firstDetectS: 5,
    firstDetectSensorId: 's1',
    firstConfirmS: null,
    techs: ['radar'],
    swarmMerged: false,
    assetId: null,
    arrivalS: 20,
    closestApproachM: 0,
    warningS: 15,
    windowS: [8, 15],
    windowEffectorId: 'e1',
    classificationAtS: { unknownAtS: 5, suspectedAtS: 5, hostileAtS: 7 },
    engageGateS: 5,
    detectingSensorIds: ['s1'],
    effectorWindows: [{ effectorId: 'e1', intervals: [[8, 15]] }],
  }
}

describe('threatPictureAt', () => {
  it('partitions large tactics by tactic, wave, and platform while retaining every member', () => {
    const scenario = emptyScenario()
    scenario.raid = { waves: [] }
    addThreat(scenario, '1', 'RUS-LR-01 ship 1 of 3', 0)
    addThreat(scenario, '2', 'RUS-LR-01 ship 2 of 3', 0)
    addThreat(scenario, '3', 'RUS-LR-01 ship 3 of 3', 1)
    const report: AttritionReport = {
      threats: [],
      effectors: [],
      totals: {
        raidSize: 3,
        expectedKills: 0,
        expectedHardKills: 0,
        expectedSoftKills: 0,
        expectedLeakers: 3,
        shotsFired: 0,
        jamSalvos: 0,
      },
      events: [],
    }
    const groups = threatPictureAt(
      scenario,
      [assessment('1'), assessment('2'), assessment('3')],
      report,
      10,
      new Map(),
    )
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ tacticId: 'RUS-LR-01', waveIndex: 0, tracks: 2 })
    expect(groups[1]).toMatchObject({ tacticId: 'RUS-LR-01', waveIndex: 1, tracks: 1 })
    expect(groups.flatMap((group) => group.members)).toHaveLength(3)
  })
})

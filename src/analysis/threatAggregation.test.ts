import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, FlightPath } from '../model/types'
import type { AttritionReport, EngagementEvent, ThreatAttrition } from '../playback/attrition'
import type { ThreatAssessment } from '../playback/sim'
import { expectedDeadTimes, threatPictureAt, trackQualityAt } from './threatAggregation'

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

function assessment(id: string, over: Partial<ThreatAssessment> = {}): ThreatAssessment {
  return {
    uasId: id,
    status: 'engageable',
    firstDetectS: 5,
    firstDetectSensorId: 's1',
    firstConfirmS: null,
    techs: ['radar'],
    swarmMerged: false,
    cpaAssetId: null,
    cpaS: null,
    cpaDistanceM: null,
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
    ...over,
  }
}

function event(over: Partial<EngagementEvent>): EngagementEvent {
  return {
    tS: 10,
    tEffectS: 12,
    effectorId: 'e1',
    uasId: '1',
    shipIdx: 0,
    channel: 'kill',
    softShot: false,
    effectorType: 'interceptor',
    channelClass: 'kinetic',
    lateEffect: false,
    pk: 0.5,
    killDelta: 0,
    ...over,
  }
}

function threatAtt(uasId: string, shipCount: number): ThreatAttrition {
  return {
    uasId,
    shipCount,
    expectedKills: 0,
    expectedHardKills: 0,
    expectedSoftKills: 0,
    expectedLateKills: 0,
    expectedLateHardKills: 0,
    expectedLateSoftKills: 0,
    arrived: true,
    expectedLeakers: shipCount,
    expectedNoArrival: 0,
    leakProbability: 1,
    continueJamProb: 0,
    firstShotS: null,
    shotsFired: 0,
    deSalvos: 0,
    jamSalvos: 0,
    killedByEffectorId: null,
    killedBySoft: false,
  }
}

function reportOf(events: EngagementEvent[] = [], threats: ThreatAttrition[] = []): AttritionReport {
  return {
    threats,
    effectors: [],
    totals: {
      raidSize: threats.reduce((sum, row) => sum + row.shipCount, 0),
      expectedKills: 0,
      expectedHardKills: 0,
      expectedSoftKills: 0,
      expectedLateKills: 0,
      expectedLeakers: threats.reduce((sum, row) => sum + row.shipCount, 0),
      expectedNoArrival: 0,
      reportedLeakers: threats.reduce((sum, row) => sum + row.shipCount, 0),
      shotsFired: events.filter((e) => e.channelClass === 'kinetic').length,
      deSalvos: events.filter((e) => e.channelClass === 'directed-energy').length,
      jamSalvos: events.filter((e) => e.channelClass === 'ew').length,
    },
    events,
  }
}

/** One threat with a path, ready for a single-row picture. */
function oneThreatScenario() {
  const scenario = emptyScenario()
  scenario.raid = { waves: [] }
  addThreat(scenario, '1', 'RUS-LR-01 ship 1 of 1', 0)
  return scenario
}

describe('threatPictureAt', () => {
  it('partitions large tactics by tactic, wave, and platform while retaining every member', () => {
    const scenario = emptyScenario()
    scenario.raid = { waves: [] }
    addThreat(scenario, '1', 'RUS-LR-01 ship 1 of 3', 0)
    addThreat(scenario, '2', 'RUS-LR-01 ship 2 of 3', 0)
    addThreat(scenario, '3', 'RUS-LR-01 ship 3 of 3', 1)
    const groups = threatPictureAt(
      scenario,
      [assessment('1'), assessment('2'), assessment('3')],
      reportOf(),
      10,
      new Map(),
    )
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ tacticId: 'RUS-LR-01', waveIndex: 0, tracks: 2 })
    expect(groups[1]).toMatchObject({ tacticId: 'RUS-LR-01', waveIndex: 1, tracks: 1 })
    expect(groups.flatMap((group) => group.members)).toHaveLength(3)
  })
})

describe('first effect time', () => {
  it('is the first effect that removed kill mass, not a jam dwell', () => {
    const scenario = oneThreatScenario()
    // A 'continue' jam degrades the track at T+12 and removes nothing; the
    // interceptor removes 0.5 ships at T+30. The first EFFECT is T+30.
    const report = reportOf(
      [
        event({ tS: 10, tEffectS: 12, channel: 'jam', softShot: true, channelClass: 'ew', effectorType: 'jammer' }),
        event({ tS: 25, tEffectS: 30, killDelta: 0.5 }),
      ],
      [threatAtt('1', 1)],
    )
    const [group] = threatPictureAt(scenario, [assessment('1')], report, 60, new Map())
    expect(group.members[0].firstEffectS).toBe(30)
    expect(group.members[0].firstJamEffectS).toBe(12)
  })

  it('is null when every salvo was a zero-mass jam dwell', () => {
    const scenario = oneThreatScenario()
    const report = reportOf(
      [event({ tS: 10, tEffectS: 12, channel: 'jam', softShot: true, channelClass: 'ew', effectorType: 'jammer' })],
      [threatAtt('1', 1)],
    )
    const [group] = threatPictureAt(scenario, [assessment('1')], report, 60, new Map())
    expect(group.members[0].firstEffectS).toBeNull()
    expect(group.members[0].firstJamEffectS).toBe(12)
  })
})

describe('an expected-dead track is not a target', () => {
  const deadReport = () =>
    reportOf([event({ tS: 15, tEffectS: 20, killDelta: 0.97 })], [threatAtt('1', 1)])

  it('drops targetableNow at the ghost cutoff while the window is still open', () => {
    const scenario = oneThreatScenario()
    const a = assessment('1', { windowS: [8, 60], effectorWindows: [{ effectorId: 'e1', intervals: [[8, 60]] }] })
    const at = (tS: number) => threatPictureAt(scenario, [a], deadReport(), tS, new Map())[0].members[0]
    expect(at(19.9).targetableNow).toBe(true)
    // residual 0.03 of 1 ship is below SHIP_DEAD_BELOW: a ghost.
    expect(at(20).targetableNow).toBe(false)
    expect(at(50).targetableNow).toBe(false)
  })

  it('keeps targetAcquired when the track was acquired while it still flew', () => {
    const scenario = oneThreatScenario()
    const a = assessment('1', { windowS: [8, 60], effectorWindows: [{ effectorId: 'e1', intervals: [[8, 60]] }] })
    const row = threatPictureAt(scenario, [a], deadReport(), 50, new Map())[0].members[0]
    expect(row.targetAcquired).toBe(true)
    expect(row.targetableNow).toBe(false)
  })

  it('never acquires a track whose window opens after it is already dead', () => {
    const scenario = oneThreatScenario()
    const a = assessment('1', { windowS: [40, 60], effectorWindows: [{ effectorId: 'e1', intervals: [[40, 60]] }] })
    const row = threatPictureAt(scenario, [a], deadReport(), 50, new Map())[0].members[0]
    expect(row.targetAcquired).toBe(false)
    expect(row.targetableNow).toBe(false)
  })

  it('leaves a damaged but living formation targetable', () => {
    const scenario = oneThreatScenario()
    const a = assessment('1', { windowS: [8, 60], effectorWindows: [{ effectorId: 'e1', intervals: [[8, 60]] }] })
    const report = reportOf([event({ tS: 15, tEffectS: 20, killDelta: 1.5 })], [threatAtt('1', 2)])
    const row = threatPictureAt(scenario, [a], report, 50, new Map())[0].members[0]
    expect(row.targetableNow).toBe(true)
  })
})

describe('expectedDeadTimes', () => {
  it('latches at the first effect that drops residual below the cutoff', () => {
    const report = reportOf(
      [
        event({ tS: 10, tEffectS: 20, killDelta: 0.9 }),
        event({ tS: 25, tEffectS: 30, killDelta: 0.07 }),
        event({ tS: 35, tEffectS: 40, killDelta: 0.02 }),
      ],
      [threatAtt('1', 1)],
    )
    // 0.9 leaves 0.10 residual (alive); 0.97 leaves 0.03 (dead at T+30).
    expect(expectedDeadTimes(report).get('1')).toBe(30)
  })

  it('counts late kill mass: a late kill still destroys the airframe', () => {
    const report = reportOf(
      [event({ tS: 10, tEffectS: 90, killDelta: 0.97, lateEffect: true })],
      [threatAtt('1', 1)],
    )
    expect(expectedDeadTimes(report).get('1')).toBe(90)
  })

  it('omits threats that never reach the cutoff', () => {
    const report = reportOf([event({ tS: 10, tEffectS: 20, killDelta: 0.5 })], [threatAtt('1', 1)])
    expect(expectedDeadTimes(report).has('1')).toBe(false)
  })
})

describe('trackQualityAt', () => {
  it('counts a coast inside the hold interval as held', () => {
    // One radar holds [5, 20] with a coast over [10, 14]: continuity reads the
    // intervals, so the coast leaves no gap (D16).
    const a = assessment('1', {
      sensorObservations: [
        {
          sensorId: 's1',
          sensorType: 'radar',
          firstDetectS: 5,
          lastDetectS: 20,
          firstClassifyS: null,
          heldSamples: 31,
          resolvedEver: true,
          minSlantM: 2000,
          intervals: [[5, 20]],
          trackInitAtS: 7,
          coastIntervals: [[10, 14]],
        },
      ],
    })
    expect(trackQualityAt(a, 12)).toEqual({ continuity: 1, longestGapS: 0 })
    expect(trackQualityAt(a, 20)).toEqual({ continuity: 1, longestGapS: 0 })
  })
})

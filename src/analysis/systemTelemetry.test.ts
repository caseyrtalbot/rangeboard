import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity } from '../model/types'
import type { AttritionReport, EngagementEvent, ThreatAttrition } from '../playback/attritionReport'
import type { SensorObservation, ThreatAssessment } from '../playback/sim'
import type { DetectionHit } from '../playback/detection'
import { systemTelemetryAt } from './systemTelemetry'

function entity(id: string, kind: Entity['kind'], specId: string, systemId?: string): Entity {
  return {
    id,
    name: id,
    kind,
    specId,
    pos: { x: 0, y: 0 },
    headingDeg: 0,
    color: null,
    notes: '',
    systemId,
  }
}

function observation(sensorId: string, intervals: Array<[number, number]>): SensorObservation {
  const [firstDetectS] = intervals[0]
  const lastDetectS = intervals[intervals.length - 1][1]
  return {
    sensorId,
    sensorType: 'radar',
    firstDetectS,
    lastDetectS,
    firstClassifyS: firstDetectS + 3,
    heldSamples: Math.round((lastDetectS - firstDetectS) / 0.5) + 1,
    resolvedEver: true,
    // Slant: hand-built observation. 3 km closest approach, a plausible hold
    // for the seeded radar; systemTelemetryAt reads the intervals, not this.
    minSlantM: 3000,
    intervals,
    trackInitAtS: null,
    coastIntervals: [],
  }
}

function assessment(over: Partial<ThreatAssessment> & { uasId: string }): ThreatAssessment {
  return {
    status: 'engageable',
    firstDetectS: 5,
    firstDetectSensorId: 'sensor',
    firstConfirmS: null,
    techs: ['radar'],
    swarmMerged: false,
    cpaAssetId: null,
    cpaS: null,
    cpaDistanceM: null,
    assetId: null,
    arrivalS: 60,
    closestApproachM: null,
    warningS: 55,
    windowS: [10, 30],
    windowEffectorId: 'effector',
    classificationAtS: { unknownAtS: 5, suspectedAtS: 5, hostileAtS: 10 },
    engageGateS: 5,
    detectingSensorIds: ['sensor'],
    sensorObservations: [observation('sensor', [[5, 30]])],
    effectorWindows: [{ effectorId: 'effector', intervals: [[10, 30]] }],
    ...over,
  }
}

function event(over: Partial<EngagementEvent>): EngagementEvent {
  return {
    tS: 10,
    tEffectS: 11,
    effectorId: 'effector',
    uasId: 'threat',
    shipIdx: 0,
    channel: 'kill',
    softShot: false,
    effectorType: 'gun',
    channelClass: 'kinetic',
    lateEffect: false,
    pk: 0.5,
    killDelta: 0.5,
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

function reportOf(events: EngagementEvent[], threats: ThreatAttrition[] = []): AttritionReport {
  return {
    threats,
    effectors: [],
    totals: {
      raidSize: threats.reduce((sum, row) => sum + row.shipCount, 0),
      expectedKills: 0.5,
      expectedHardKills: 0.5,
      expectedSoftKills: 0,
      expectedLateKills: 0,
      expectedLeakers: 0.5,
      expectedNoArrival: 0,
      reportedLeakers: 0.5,
      shotsFired: events.filter((e) => e.channelClass === 'kinetic').length,
      deSalvos: events.filter((e) => e.channelClass === 'directed-energy').length,
      jamSalvos: events.filter((e) => e.channelClass === 'ew').length,
    },
    events,
  }
}

/** Sensor to C2 to gun, all in one system, plus one threat entity. */
function killChainScenario() {
  const scenario = emptyScenario()
  const sensor = entity('sensor', 'sensor', 'lib-lstar', 'sys1')
  const c2 = entity('c2', 'c2', 'lib-faadc2', 'sys1')
  const effector = entity('effector', 'effector', 'lib-xm914', 'sys1')
  const threat = entity('threat', 'uas', 'lib-shahed136')
  scenario.entities.push(sensor, c2, effector, threat)
  scenario.connections.push(
    { id: 'c1', fromId: sensor.id, toId: c2.id, label: '' },
    { id: 'c2', fromId: c2.id, toId: effector.id, label: '' },
  )
  return scenario
}

describe('systemTelemetryAt', () => {
  it('reports live sensor, C2, effector, effect, and capacity data by component', () => {
    const scenario = killChainScenario()
    const hits = new Map<string, DetectionHit[]>([
      [
        'threat',
        // Slant: hand-built hit, 3 km from the phase center. Nothing in
        // systemTelemetryAt reads it; the hit's presence is what counts.
        [
          {
            sensorId: 'sensor',
            sensorType: 'radar',
            classified: true,
            resolved: true,
            slantM: 3000,
            pd: null,
          },
        ],
      ],
    ])
    const groups = systemTelemetryAt(
      scenario,
      [assessment({ uasId: 'threat' })],
      reportOf([event({})]),
      12,
      hits,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      activeComponents: 3,
      componentCount: 3,
      tracksNow: 1,
      tracksSeen: 1,
      salvosAssigned: 1,
      effectsLanded: 1,
      expectedKills: 0.5,
    })
    expect(groups[0].components.find((row) => row.entityId === 'sensor')).toMatchObject({
      state: 'tracking',
      tracksNow: 1,
      tracksSeen: 1,
      classifications: 1,
    })
    expect(groups[0].components.find((row) => row.entityId === 'c2')).toMatchObject({
      state: 'routing',
      tracksNow: 1,
      downstreamEffectors: 1,
    })
    expect(groups[0].components.find((row) => row.entityId === 'effector')).toMatchObject({
      state: 'cooldown',
      targetsNow: 1,
      salvosAssigned: 1,
      effectsLanded: 1,
      capacityRemaining: 29,
    })
  })

  it('does not report an expected-dead track as a target', () => {
    const scenario = killChainScenario()
    const a = assessment({ uasId: 'threat' })
    // 0.97 of one ship removed at T+11: residual 0.03 is below the engine's
    // SHIP_DEAD_BELOW cutoff, so the track is a ghost from T+11 onward. The
    // window still runs to T+30 and the route is still up.
    const dead = reportOf([event({ killDelta: 0.97 })], [threatAtt('threat', 1)])
    const alive = reportOf([event({ killDelta: 0.5 })], [threatAtt('threat', 1)])
    const at = (report: AttritionReport, tS: number) =>
      systemTelemetryAt(scenario, [a], report, tS, new Map())[0].components.find(
        (row) => row.entityId === 'effector',
      )!
    // Cooldown ends at T+20; the state can read 'target' from then on.
    expect(at(alive, 25)).toMatchObject({ targetsNow: 1, state: 'target' })
    expect(at(dead, 25)).toMatchObject({ targetsNow: 0, state: 'ready' })
    // Before the effect lands the track is still a live target.
    expect(at(dead, 10.9).targetsNow).toBe(1)
  })

  it('separates integrated track-seconds from union hold time', () => {
    const scenario = killChainScenario()
    scenario.entities.push(entity('threat2', 'uas', 'lib-shahed136'))
    // Two threats, one radar, both held from T+0 to T+300, cursor at 300 s.
    const assessments = [
      assessment({
        uasId: 'threat',
        firstDetectS: 0,
        sensorObservations: [observation('sensor', [[0, 300]])],
      }),
      assessment({
        uasId: 'threat2',
        firstDetectS: 0,
        sensorObservations: [observation('sensor', [[0, 300]])],
      }),
    ]
    const [group] = systemTelemetryAt(scenario, assessments, reportOf([]), 300, new Map())
    const radar = group.components.find((row) => row.entityId === 'sensor')!
    // Integrated: 300.5 sensor-seconds per track, two tracks. This is a
    // loading measure, not a clock reading.
    expect(radar.trackSeconds).toBeCloseTo(601, 9)
    // Union: the radar held at least one track for the whole 300 s run, once.
    expect(radar.holdSeconds).toBeCloseTo(300.5, 9)
    expect(radar.holdSeconds).toBeLessThanOrEqual(300 + 0.5)
  })

  it('merges overlapping holds and adds disjoint ones in union hold time', () => {
    const scenario = killChainScenario()
    scenario.entities.push(entity('threat2', 'uas', 'lib-shahed136'))
    const assessments = [
      assessment({
        uasId: 'threat',
        firstDetectS: 0,
        // Held 0 to 40, then again 100 to 120.
        sensorObservations: [observation('sensor', [[0, 40], [100, 120]])],
      }),
      assessment({
        uasId: 'threat2',
        firstDetectS: 20,
        // Overlaps the first hold and extends it to 60.
        sensorObservations: [observation('sensor', [[20, 60]])],
      }),
    ]
    const [group] = systemTelemetryAt(scenario, assessments, reportOf([]), 200, new Map())
    const radar = group.components.find((row) => row.entityId === 'sensor')!
    // Integrated: (40.5 + 20.5) + 40.5 = 101.5 track-seconds.
    expect(radar.trackSeconds).toBeCloseTo(101.5, 9)
    // Union: [0,60] and [100,120] = 60.5 + 20.5 = 81 clock seconds.
    expect(radar.holdSeconds).toBeCloseTo(81, 9)
  })

  it('clips union hold time at the cursor', () => {
    const scenario = killChainScenario()
    const assessments = [
      assessment({
        uasId: 'threat',
        firstDetectS: 10,
        sensorObservations: [observation('sensor', [[10, 300]])],
      }),
    ]
    const [group] = systemTelemetryAt(scenario, assessments, reportOf([]), 60, new Map())
    const radar = group.components.find((row) => row.entityId === 'sensor')!
    expect(radar.holdSeconds).toBeCloseTo(50.5, 9)
  })
})

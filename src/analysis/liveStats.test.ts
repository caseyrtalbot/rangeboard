import { describe, expect, it } from 'vitest'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport, EngagementEvent, ThreatAttrition } from '../playback/attrition'
import { resolveEngagements } from '../playback/attrition'
import { assessAllThreats } from '../playback/sim'
import { emptyScenario } from '../model/seed'
import type { Entity, SpecModel, Vec2 } from '../model/types'
import { buildLiveTimeline, liveKpisAt } from './liveStats'

function assessment(over: Partial<ThreatAssessment>): ThreatAssessment {
  return {
    uasId: 'u1',
    status: 'engageable',
    firstDetectS: null,
    firstDetectSensorId: null,
    firstConfirmS: null,
    techs: [],
    swarmMerged: false,
    cpaAssetId: null,
    cpaS: null,
    cpaDistanceM: null,
    assetId: null,
    arrivalS: null,
    closestApproachM: null,
    warningS: null,
    windowS: null,
    windowEffectorId: null,
    classificationAtS: { unknownAtS: null, suspectedAtS: null, hostileAtS: null },
    engageGateS: null,
    detectingSensorIds: [],
    effectorWindows: [],
    ...over,
  }
}

function event(over: Partial<EngagementEvent>): EngagementEvent {
  return {
    tS: 0,
    tEffectS: 0,
    effectorId: 'e1',
    uasId: 'u1',
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

function reportOf(
  events: EngagementEvent[],
  threats: AttritionReport['threats'] = [],
  raidSize = 0,
  totals: Partial<AttritionReport['totals']> = {},
): AttritionReport {
  const expectedKills = events
    .filter((e) => !e.lateEffect)
    .reduce((sum, e) => sum + e.killDelta, 0)
  return {
    threats,
    effectors: [],
    totals: {
      raidSize,
      expectedKills,
      expectedHardKills: expectedKills,
      expectedSoftKills: 0,
      expectedLateKills: events
        .filter((e) => e.lateEffect)
        .reduce((sum, e) => sum + e.killDelta, 0),
      expectedLeakers: raidSize - expectedKills,
      expectedNoArrival: 0,
      reportedLeakers: raidSize - expectedKills,
      shotsFired: events.filter((e) => e.channelClass === 'kinetic').length,
      deSalvos: events.filter((e) => e.channelClass === 'directed-energy').length,
      jamSalvos: events.filter((e) => e.channelClass === 'ew').length,
      ...totals,
    },
    events,
  }
}

function threatAtt(
  uasId: string,
  shipCount: number,
  leakProbability: number,
  over: Partial<ThreatAttrition> = {},
): ThreatAttrition {
  return {
    uasId,
    shipCount,
    expectedKills: shipCount * (1 - leakProbability),
    expectedHardKills: shipCount * (1 - leakProbability),
    expectedSoftKills: 0,
    expectedLateKills: 0,
    expectedLateHardKills: 0,
    expectedLateSoftKills: 0,
    arrived: true,
    expectedLeakers: shipCount * leakProbability,
    expectedNoArrival: 0,
    leakProbability,
    continueJamProb: 0,
    firstShotS: null,
    shotsFired: 1,
    deSalvos: 0,
    jamSalvos: 0,
    killedByEffectorId: null,
    killedBySoft: false,
    ...over,
  }
}

describe('buildLiveTimeline / liveKpisAt', () => {
  it('is all zeros before anything happens', () => {
    const tl = buildLiveTimeline(
      [assessment({ firstDetectS: 30, arrivalS: 100 })],
      reportOf([event({ tS: 40, tEffectS: 45, killDelta: 0.6 })], [threatAtt('u1', 1, 0.4)], 1),
    )
    expect(liveKpisAt(tl, 0)).toEqual({
      detected: 0,
      classified: 0,
      targetable: 0,
      engaged: 0,
      kineticShots: 0,
      deSalvos: 0,
      jamSalvos: 0,
      expectedKills: 0,
      lateKills: 0,
      arrivedTracks: 0,
      leakerShips: 0,
    })
  })

  it('counts shots at assignment time and kills at effect time, inclusive bounds', () => {
    const tl = buildLiveTimeline(
      [assessment({ firstDetectS: 10 })],
      reportOf([event({ tS: 40, tEffectS: 45, killDelta: 0.6 })]),
    )
    expect(liveKpisAt(tl, 39.9).kineticShots).toBe(0)
    expect(liveKpisAt(tl, 40).kineticShots).toBe(1)
    expect(liveKpisAt(tl, 44.9).expectedKills).toBe(0)
    expect(liveKpisAt(tl, 45).expectedKills).toBeCloseTo(0.6)
  })

  it('tracks classify, targetable-now, and first-engagement stages separately', () => {
    const tl = buildLiveTimeline(
      [
        assessment({
          classificationAtS: { unknownAtS: 10, suspectedAtS: 15, hostileAtS: 20 },
          windowS: [25, 40],
        }),
      ],
      reportOf([event({ tS: 30, tEffectS: 35, killDelta: 0.4 })]),
    )
    expect(liveKpisAt(tl, 19).classified).toBe(0)
    expect(liveKpisAt(tl, 20).classified).toBe(1)
    expect(liveKpisAt(tl, 24.5).targetable).toBe(0)
    expect(liveKpisAt(tl, 25).targetable).toBe(1)
    expect(liveKpisAt(tl, 40).targetable).toBe(1)
    expect(liveKpisAt(tl, 40.5).targetable).toBe(0)
    expect(liveKpisAt(tl, 29.5).engaged).toBe(0)
    expect(liveKpisAt(tl, 30).engaged).toBe(1)
  })

  it('accumulates killDelta in effect order even when it differs from assignment order', () => {
    // Second salvo assigned later but lands earlier (shorter engage time).
    const tl = buildLiveTimeline(
      [assessment({})],
      reportOf([
        event({ tS: 10, tEffectS: 30, killDelta: 0.5 }),
        event({ tS: 12, tEffectS: 14, killDelta: 0.2 }),
      ]),
    )
    expect(liveKpisAt(tl, 14).expectedKills).toBeCloseTo(0.2)
    expect(liveKpisAt(tl, 29).expectedKills).toBeCloseTo(0.2)
    expect(liveKpisAt(tl, 30).expectedKills).toBeCloseTo(0.7)
  })

  it('counts detections and arrivals per track, with surviving mass on arrival', () => {
    const tl = buildLiveTimeline(
      [
        assessment({ uasId: 'u1', firstDetectS: 20, arrivalS: 100 }),
        assessment({ uasId: 'u2', firstDetectS: 50, arrivalS: 80 }),
        assessment({ uasId: 'u3' }), // never detected, never arrives
      ],
      reportOf(
        [
          // 2.4 expected kills land on u1 before it arrives.
          event({ uasId: 'u1', tS: 55, tEffectS: 60, killDelta: 1.2 }),
          event({ uasId: 'u1', tS: 65, tEffectS: 70, killDelta: 1.2 }),
        ],
        [threatAtt('u1', 3, 0.2), threatAtt('u2', 1, 1)],
        4,
      ),
    )
    expect(tl.trackCount).toBe(3)
    expect(tl.raidSize).toBe(4)
    expect(liveKpisAt(tl, 20).detected).toBe(1)
    expect(liveKpisAt(tl, 60).detected).toBe(2)
    const t80 = liveKpisAt(tl, 80)
    expect(t80.arrivedTracks).toBe(1)
    expect(t80.leakerShips).toBeCloseTo(1) // u2 arrives untouched
    const t100 = liveKpisAt(tl, 100)
    expect(t100.arrivedTracks).toBe(2)
    expect(t100.leakerShips).toBeCloseTo(1 + 3 * 0.2)
  })

  it('treats a pathed threat without an attrition row as fully surviving', () => {
    const tl = buildLiveTimeline([assessment({ uasId: 'ux', arrivalS: 40 })], reportOf([], [], 1))
    expect(liveKpisAt(tl, 40).leakerShips).toBe(1)
  })

  it('ignores no-path assessments', () => {
    const tl = buildLiveTimeline(
      [assessment({ status: 'no-path', firstDetectS: 5, arrivalS: 9 })],
      reportOf([]),
    )
    expect(tl.trackCount).toBe(0)
    expect(liveKpisAt(tl, 99).detected).toBe(0)
    expect(liveKpisAt(tl, 99).arrivedTracks).toBe(0)
  })
})

describe('late effects never un-leak an arrived threat', () => {
  // Captured run: asset 3,000 m out, the threat is over it at T+66.5 s, and
  // all six salvos land from T+90 to T+251.5 s. Every one of the 0.970
  // credited kill mass landed after the threat was already overhead. The old
  // rule moved that mass from Leakers to Exp kills and reported a defended
  // asset; the leaker had already arrived.
  const ARRIVAL_S = 66.5
  const LATE = [
    { tS: 80, tEffectS: 90, killDelta: 0.6 },
    { tS: 112, tEffectS: 122.5, killDelta: 0.24 },
    { tS: 145, tEffectS: 155, killDelta: 0.08 },
    { tS: 177, tEffectS: 187.5, killDelta: 0.03 },
    { tS: 209, tEffectS: 219, killDelta: 0.012 },
    { tS: 241, tEffectS: 251.5, killDelta: 0.008 },
  ]
  const report = reportOf(
    LATE.map((e) => event({ ...e, lateEffect: true })),
    [
      threatAtt('u1', 1, 1, {
        expectedKills: 0,
        expectedHardKills: 0,
        expectedLateKills: 0.97,
        expectedLateHardKills: 0.97,
        shotsFired: 6,
      }),
    ],
    1,
  )
  const tl = buildLiveTimeline([assessment({ uasId: 'u1', arrivalS: ARRIVAL_S })], report)

  it('holds the leaker at the full ship count through every late effect', () => {
    for (const t of [ARRIVAL_S, 90, 122.5, 155, 187.5, 219, 251.5, 400]) {
      expect(liveKpisAt(tl, t).leakerShips).toBeCloseTo(1, 9)
    }
  })

  it('credits no defeat mass and reports the late mass apart', () => {
    expect(liveKpisAt(tl, 400).expectedKills).toBe(0)
    expect(liveKpisAt(tl, 122.4).lateKills).toBeCloseTo(0.6, 9)
    expect(liveKpisAt(tl, 122.5).lateKills).toBeCloseTo(0.84, 9)
    expect(liveKpisAt(tl, 400).lateKills).toBeCloseTo(0.97, 9)
  })

  it('agrees with the run-final totals', () => {
    const end = liveKpisAt(tl, 400)
    expect(end.expectedKills).toBeCloseTo(report.totals.expectedKills, 9)
    expect(end.lateKills).toBeCloseTo(report.totals.expectedLateKills, 9)
    expect(end.leakerShips).toBeCloseTo(report.totals.expectedLeakers, 9)
  })
})

describe('live values converge to the run-final AttritionTotals', () => {
  // u1: one pre-arrival interceptor round, one late HPM burst.
  // u2: one 'continue' jam dwell (no mass) then a pre-arrival soft kill.
  const events = [
    event({ uasId: 'u1', tS: 40, tEffectS: 50, killDelta: 0.8 }),
    event({
      uasId: 'u1',
      tS: 90,
      tEffectS: 120,
      killDelta: 0.5,
      lateEffect: true,
      effectorType: 'hpm',
      channelClass: 'directed-energy',
      effectorId: 'e2',
    }),
    event({
      uasId: 'u2',
      tS: 20,
      tEffectS: 25,
      channel: 'jam',
      softShot: true,
      effectorType: 'jammer',
      channelClass: 'ew',
      effectorId: 'e3',
      killDelta: 0,
    }),
    event({
      uasId: 'u2',
      tS: 30,
      tEffectS: 35,
      softShot: true,
      effectorType: 'jammer',
      channelClass: 'ew',
      effectorId: 'e3',
      killDelta: 0.9,
    }),
  ]
  const report = reportOf(
    events,
    [
      threatAtt('u1', 2, 0.6, {
        expectedKills: 0.8,
        expectedHardKills: 0.8,
        expectedLateKills: 0.5,
        expectedLateHardKills: 0.5,
        deSalvos: 1,
      }),
      threatAtt('u2', 1, 0.1, {
        expectedKills: 0.9,
        expectedHardKills: 0,
        expectedSoftKills: 0.9,
        shotsFired: 0,
        jamSalvos: 2,
      }),
    ],
    3,
    { expectedHardKills: 0.8, expectedSoftKills: 0.9 },
  )
  const tl = buildLiveTimeline(
    [
      assessment({ uasId: 'u1', arrivalS: 100 }),
      assessment({ uasId: 'u2', arrivalS: 60 }),
    ],
    report,
  )

  it('matches every run-final total at the end of the run', () => {
    const end = liveKpisAt(tl, 1000)
    expect(end.expectedKills).toBeCloseTo(report.totals.expectedKills, 9) // 1.7
    expect(end.lateKills).toBeCloseTo(report.totals.expectedLateKills, 9) // 0.5
    expect(end.leakerShips).toBeCloseTo(report.totals.expectedLeakers, 9) // 1.3
    expect(end.kineticShots).toBe(report.totals.shotsFired) // 1
    expect(end.deSalvos).toBe(report.totals.deSalvos) // 1
    expect(end.jamSalvos).toBe(report.totals.jamSalvos) // 2
  })

  it('keeps defeats and leakers complementary against the raid at every t', () => {
    // Every threat arrives here, so kills + leakers = raidSize once the last
    // threat is over its asset. Before that the raid is still in the air.
    for (const t of [100, 120, 200, 1000]) {
      const k = liveKpisAt(tl, t)
      expect(k.expectedKills + k.leakerShips).toBeCloseTo(tl.raidSize, 9)
    }
  })

  it('never lets the live leaker count fall', () => {
    let previous = 0
    for (let t = 0; t <= 200; t += 0.5) {
      const now = liveKpisAt(tl, t).leakerShips
      expect(now).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = now
    }
  })
})

describe('expenditure splits by channel class, not by kill channel', () => {
  it('files directed-energy bursts apart from kinetic rounds', () => {
    // Four Leonidas HPM salvos: hard kills (softShot false) that fire no
    // round. Bucketing on softShot reported all four as kinetic.
    const tl = buildLiveTimeline(
      [assessment({})],
      reportOf([
        event({ tS: 10, tEffectS: 12 }),
        event({ tS: 20, tEffectS: 21, effectorType: 'hpm', channelClass: 'directed-energy' }),
        event({ tS: 25, tEffectS: 26, effectorType: 'hpm', channelClass: 'directed-energy' }),
        event({ tS: 30, tEffectS: 31, effectorType: 'de', channelClass: 'directed-energy' }),
        event({ tS: 35, tEffectS: 36, effectorType: 'hpm', channelClass: 'directed-energy' }),
        event({
          tS: 40,
          tEffectS: 41,
          softShot: true,
          channel: 'jam',
          effectorType: 'jammer',
          channelClass: 'ew',
        }),
      ]),
    )
    const end = liveKpisAt(tl, 100)
    expect(end.kineticShots).toBe(1)
    expect(end.deSalvos).toBe(4)
    expect(end.jamSalvos).toBe(1)
    const mid = liveKpisAt(tl, 25)
    expect(mid.kineticShots).toBe(1)
    expect(mid.deSalvos).toBe(2)
    expect(mid.jamSalvos).toBe(0)
  })

  it('counts a jammer soft KILL as EW expenditure, not as a kinetic round', () => {
    const tl = buildLiveTimeline(
      [assessment({})],
      reportOf([
        event({
          tS: 21,
          tEffectS: 21,
          softShot: true,
          channel: 'kill',
          effectorType: 'jammer',
          channelClass: 'ew',
          killDelta: 0.3,
        }),
      ]),
    )
    const end = liveKpisAt(tl, 30)
    expect(end.kineticShots).toBe(0)
    expect(end.jamSalvos).toBe(1)
    expect(end.expectedKills).toBeCloseTo(0.3)
  })
})

describe('an expected-dead track is not targetable', () => {
  it('drops out of targetable at the ghost cutoff, window still open', () => {
    const tl = buildLiveTimeline(
      [assessment({ uasId: 'u1', windowS: [10, 200] })],
      reportOf(
        [
          event({ uasId: 'u1', tS: 40, tEffectS: 50, killDelta: 0.96 }),
          event({ uasId: 'u1', tS: 60, tEffectS: 70, killDelta: 0.03 }),
        ],
        [threatAtt('u1', 1, 0.01)],
        1,
      ),
    )
    expect(liveKpisAt(tl, 49.9).targetable).toBe(1)
    // residual 0.04 of 1 ship is below SHIP_DEAD_BELOW: a ghost, not a target.
    expect(liveKpisAt(tl, 50).targetable).toBe(0)
    expect(liveKpisAt(tl, 150).targetable).toBe(0)
  })

  it('keeps a damaged but living track targetable', () => {
    const tl = buildLiveTimeline(
      [assessment({ uasId: 'u1', windowS: [10, 200] })],
      reportOf(
        [event({ uasId: 'u1', tS: 40, tEffectS: 50, killDelta: 1.5 })],
        [threatAtt('u1', 2, 0.25)],
        2,
      ),
    )
    // residual 0.5 of 2 ships = 25%: still a live formation.
    expect(liveKpisAt(tl, 150).targetable).toBe(1)
  })
})

/**
 * End-to-end against the real engine. The live leaker KPI and
 * AttritionTotals.expectedLeakers are computed by two different code paths
 * (an arrival-ordered prefix here, a per-threat partition there) from the
 * same rule, so they must land on the same number even when part of the raid
 * never crosses a boundary.
 */
describe('leakerShips converges to AttritionTotals.expectedLeakers', () => {
  const RADAR: SpecModel = {
    id: 'ls-radar',
    name: 'ls radar',
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
  const TARGET: SpecModel = {
    id: 'ls-uas',
    name: 'ls uas',
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
  const INT: SpecModel = {
    id: 'ls-int',
    name: 'ls int',
    kind: 'effector',
    description: '',
    color: '#fff',
    builtin: false,
    effector: {
      effectorType: 'interceptor',
      minRangeM: 0,
      maxRangeM: 1000,
      engageTimeS: 0,
      pk: 0.5,
      magazineSize: 1,
      salvoCooldownS: 1000,
    },
  }

  let seq = 0
  function ent(kind: Entity['kind'], specId: string | null, pos: Vec2): Entity {
    seq += 1
    return {
      id: `ls-${kind}-${seq}`,
      name: `ls-${kind}-${seq}`,
      kind,
      specId,
      pos,
      headingDeg: 0,
      color: null,
      notes: '',
    }
  }

  /** Threat A runs the lane past a defended asset; threat B flies 5 km wide. */
  function run() {
    const scenario = legacyScenario()
    scenario.library = [...scenario.library, RADAR, TARGET, INT]
    const sensor = ent('sensor', RADAR.id, { x: 0, y: 0 })
    const eff = ent('effector', INT.id, { x: 0, y: 0 })
    const a = ent('uas', TARGET.id, { x: -1210, y: 0 })
    const b = ent('uas', TARGET.id, { x: -1210, y: 5000 })
    const asset = ent('asset', null, { x: 2000, y: 0 })
    scenario.entities = [sensor, eff, a, b, asset]
    scenario.connections = [{ id: 'ls-c1', fromId: sensor.id, toId: eff.id, label: '' }]
    scenario.paths = [
      {
        id: 'ls-p1',
        entityId: a.id,
        points: [{ x: -1210, y: 0 }, { x: 3000, y: 0 }],
        speedMps: 40,
        startDelayS: 0,
      },
      {
        id: 'ls-p2',
        entityId: b.id,
        points: [{ x: -1210, y: 5000 }, { x: 3000, y: 5000 }],
        speedMps: 40,
        startDelayS: 0,
      },
    ]
    const assessments = assessAllThreats(scenario)
    const report = resolveEngagements(scenario, assessments)
    return { assessments, report }
  }

  it('agrees exactly, and the fly-by leaks in neither surface', () => {
    const { assessments, report } = run()
    const end = liveKpisAt(buildLiveTimeline(assessments, report), 1e6)
    // Threat A leaks 1 - 0.3515; threat B never crosses a boundary.
    expect(end.leakerShips).toBeCloseTo(0.6485, 6)
    expect(end.leakerShips).toBeCloseTo(report.totals.expectedLeakers, 9)
    expect(end.expectedKills).toBeCloseTo(report.totals.expectedKills, 9)
    // The fly-by's ship is accounted for, just not as a leaker.
    expect(report.totals.expectedNoArrival).toBe(1)
    expect(end.arrivedTracks).toBe(1)
    expect(report.totals.raidSize).toBe(2)
  })
})

/**
 * Legacy instant-release engine (doctrine off). These fixtures assert the
 * pre-doctrine numbers: the ROE gate alone opens the window and every ready
 * effector volleys. New scenarios default to the doctrinal sequence.
 */
function legacyScenario(): ReturnType<typeof emptyScenario> {
  const s = emptyScenario()
  s.doctrine = { ...s.doctrine!, enabled: false }
  return s
}

import { describe, expect, it } from 'vitest'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport, EngagementEvent } from '../playback/attrition'
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
    pk: 0.5,
    killDelta: 0,
    ...over,
  }
}

function reportOf(
  events: EngagementEvent[],
  threats: AttritionReport['threats'] = [],
  raidSize = 0,
): AttritionReport {
  return {
    threats,
    effectors: [],
    totals: {
      raidSize,
      expectedKills: 0,
      expectedHardKills: 0,
      expectedSoftKills: 0,
      expectedLeakers: 0,
      shotsFired: events.filter((e) => !e.softShot).length,
      jamSalvos: events.filter((e) => e.softShot).length,
    },
    events,
  }
}

function threatAtt(
  uasId: string,
  shipCount: number,
  leakProbability: number,
): AttritionReport['threats'][number] {
  return {
    uasId,
    shipCount,
    expectedKills: shipCount * (1 - leakProbability),
    expectedHardKills: shipCount * (1 - leakProbability),
    expectedSoftKills: 0,
    leakProbability,
    continueJamProb: 0,
    firstShotS: null,
    shotsFired: 1,
    jamSalvos: 0,
    killedByEffectorId: null,
    killedBySoft: false,
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
      kineticShots: 0,
      jamSalvos: 0,
      expectedKills: 0,
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

  it('splits kinetic shots from jam salvos', () => {
    const tl = buildLiveTimeline(
      [assessment({})],
      reportOf([
        event({ tS: 10, tEffectS: 12 }),
        event({ tS: 11, tEffectS: 11, softShot: true, channel: 'jam' }),
        event({ tS: 20, tEffectS: 22 }),
        event({ tS: 21, tEffectS: 21, softShot: true, channel: 'kill', killDelta: 0.3 }),
      ]),
    )
    const mid = liveKpisAt(tl, 15)
    expect(mid.kineticShots).toBe(1)
    expect(mid.jamSalvos).toBe(1)
    const end = liveKpisAt(tl, 30)
    expect(end.kineticShots).toBe(2)
    expect(end.jamSalvos).toBe(2)
    expect(end.expectedKills).toBeCloseTo(0.3)
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

  it('moves mass from Leakers to Exp kills when an effect lands after arrival', () => {
    const tl = buildLiveTimeline(
      [assessment({ uasId: 'u1', arrivalS: 50 })],
      reportOf(
        [event({ uasId: 'u1', tS: 40, tEffectS: 60, killDelta: 0.6 })],
        [threatAtt('u1', 1, 0.4)],
        1,
      ),
    )
    // Arrived before the effect lands: the whole ship is still a leaker.
    expect(liveKpisAt(tl, 50).leakerShips).toBeCloseTo(1)
    expect(liveKpisAt(tl, 59.9).leakerShips).toBeCloseTo(1)
    // The effect at t=60 removes mass from Leakers at the same instant it
    // appears in Exp kills.
    const t60 = liveKpisAt(tl, 60)
    expect(t60.expectedKills).toBeCloseTo(0.6)
    expect(t60.leakerShips).toBeCloseTo(0.4)
    // Kills + surviving arrived mass stay complementary at every sampled t
    // and converge to the end state (shipCount * leakProbability).
    for (const t of [50, 55, 59.9, 60, 100]) {
      const k = liveKpisAt(tl, t)
      expect(k.expectedKills + k.leakerShips).toBeCloseTo(1)
    }
    expect(liveKpisAt(tl, 1000).leakerShips).toBeCloseTo(1 * 0.4)
  })

  it('treats a pathed threat without an attrition row as fully surviving', () => {
    const tl = buildLiveTimeline(
      [assessment({ uasId: 'ux', arrivalS: 40 })],
      reportOf([], [], 1),
    )
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

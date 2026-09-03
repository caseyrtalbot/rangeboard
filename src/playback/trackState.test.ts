import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { profileFor } from '../model/integration'
import type { Connection, Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import type { SensorObservation, ThreatAssessment } from './sim'
import { assessAllThreats } from './sim'
import type { AttritionReport, EngagementEvent } from './attrition'
import { resolveEngagements, SHIP_DEAD_BELOW } from './attrition'
import {
  BEAM_DISPLAY_S,
  BLINK_PERIOD_S,
  blinkOn,
  buildTrackTimeline,
  effectorEngagementMode,
  effectorStatesAt,
  PHASE_STYLE,
  shotsInFlightAt,
  trackStatesAt,
} from './trackState'
import type { TrackPhase } from './trackState'

/**
 * Hand-built assessments and ledgers (the liveStats.test.ts idiom) pin the
 * derivation rules exactly; the real seeded scenarios at the end cross-check
 * the jam rule and the shot geometry against the engine itself.
 */

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
    closestApproachM: null,
    arrivalS: null,
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

function observation(
  sensorId: string,
  intervals: Array<[number, number]>,
  coastIntervals: Array<[number, number]> = [],
): SensorObservation {
  return {
    sensorId,
    sensorType: 'radar',
    firstDetectS: intervals[0][0],
    lastDetectS: intervals[intervals.length - 1][1],
    firstClassifyS: null,
    heldSamples: intervals.length,
    resolvedEver: true,
    // Slant: hand-built observation, 2 km closest approach. trackStateAt
    // reads the intervals, never the range.
    minSlantM: 2000,
    intervals,
    trackInitAtS: null,
    coastIntervals,
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

/** Jammer salvo: soft kill channel AND ew expenditure channel. */
function jamEvent(over: Partial<EngagementEvent>): EngagementEvent {
  return event({ softShot: true, effectorType: 'jammer', channelClass: 'ew', ...over })
}

function threatAtt(uasId: string, shipCount: number): AttritionReport['threats'][number] {
  return {
    uasId,
    shipCount,
    expectedKills: 0,
    expectedHardKills: 0,
    expectedSoftKills: 0,
    expectedLateKills: 0,
    expectedLateHardKills: 0,
    expectedLateSoftKills: 0,
    arrived: false,
    expectedLeakers: 0,
    expectedNoArrival: shipCount,
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

function reportOf(
  events: EngagementEvent[],
  threats: AttritionReport['threats'] = [],
): AttritionReport {
  return {
    threats,
    effectors: [],
    totals: {
      raidSize: threats.reduce((s, t) => s + t.shipCount, 0),
      expectedKills: 0,
      expectedHardKills: 0,
      expectedSoftKills: 0,
      expectedLateKills: 0,
      expectedLeakers: 0,
      expectedNoArrival: 0,
      reportedLeakers: null,
      shotsFired: events.filter((e) => e.channelClass === 'kinetic').length,
      deSalvos: events.filter((e) => e.channelClass === 'directed-energy').length,
      jamSalvos: events.filter((e) => e.channelClass === 'ew').length,
    },
    events,
  }
}

/** State of the single hand-built track 'u1' at t. */
function stateAt(
  a: ThreatAssessment,
  report: AttritionReport,
  tS: number,
  scenario: Scenario = emptyScenario(),
) {
  return trackStatesAt(buildTrackTimeline(scenario, [a], report), tS).get('u1')!
}

describe('effectorEngagementMode', () => {
  it('maps every researched guidance value', () => {
    expect(profileFor('lib-coyote')?.guidance).toBe('fc-uplink')
    expect(profileFor('lib-roadrunner')?.guidance).toBe('c2-cue')
    expect(profileFor('lib-merops')?.guidance).toBe('self')
    expect(profileFor('lib-smash')?.guidance).toBe('operator')

    expect(effectorEngagementMode('lib-coyote', 'interceptor')).toBe('semi-active')
    expect(effectorEngagementMode('lib-roadrunner', 'interceptor')).toBe('active')
    expect(effectorEngagementMode('lib-merops', 'interceptor')).toBe('active')
    expect(effectorEngagementMode('lib-smash', 'gun')).toBe('semi-active')
  })

  it('falls back by effector type when no profile exists', () => {
    expect(profileFor('lib-not-a-real-spec')).toBeNull()
    expect(effectorEngagementMode(null, 'interceptor')).toBe('active')
    expect(effectorEngagementMode(null, 'gun')).toBe('semi-active')
    expect(effectorEngagementMode(null, 'net')).toBe('semi-active')
    expect(effectorEngagementMode(null, 'jammer')).toBe('beam')
    expect(effectorEngagementMode(null, 'de')).toBe('beam')
    expect(effectorEngagementMode(null, 'hpm')).toBe('beam')
    expect(effectorEngagementMode('lib-not-a-real-spec', 'gun')).toBe('semi-active')
  })

  it('gives jammer, de, and hpm the beam treatment over any profile', () => {
    expect(effectorEngagementMode('lib-coyote', 'jammer')).toBe('beam')
    expect(effectorEngagementMode('lib-roadrunner', 'de')).toBe('beam')
    expect(effectorEngagementMode('lib-merops', 'hpm')).toBe('beam')
    expect(effectorEngagementMode('lib-smash', 'jammer')).toBe('beam')
    // The seeded pairings themselves: operator jammer, c2-cue HPM, self DE.
    expect(effectorEngagementMode('lib-modi', 'jammer')).toBe('beam')
    expect(effectorEngagementMode('lib-leonidas', 'hpm')).toBe('beam')
    expect(effectorEngagementMode('lib-phel', 'de')).toBe('beam')
  })

  it('draws semi-active when neither a profile nor a spec is known', () => {
    expect(effectorEngagementMode(null, undefined)).toBe('semi-active')
  })
})

/** WCAG relative luminance, for the phase color contrast check. */
function luminance(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const r = channel(parseInt(hex.slice(1, 3), 16))
  const g = channel(parseInt(hex.slice(3, 5), 16))
  const b = channel(parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

describe('PHASE_STYLE', () => {
  /** Every phase that draws a ring. 'undetected' takes the entity color. */
  const rungs = ['searching', 'tracked', 'identified', 'targeted', 'engaged', 'ghost'] as const

  it('gives every rung its own color', () => {
    // identified, targeted and engaged all used to be '#c4564a', so the ring
    // could not tell HOSTILE, TARGETED and ENGAGED apart.
    const colors = rungs.map((p) => PHASE_STYLE[p].color)
    expect(new Set(colors).size).toBe(rungs.length)
    expect(PHASE_STYLE.undetected.color).toBeNull()
  })

  it('keeps HOSTILE on the shared danger token and names a defeated track', () => {
    expect(PHASE_STYLE.identified.color).toBe('#c4564a')
    expect(PHASE_STYLE.ghost.label).toBe('DEFEATED')
  })

  it('clears the 3:1 graphic contrast floor on every basemap background', () => {
    // --bg, .canvas-host.airspace and .canvas-host.sat in src/index.css.
    for (const bg of ['#16181a', '#131619', '#0e0f10']) {
      for (const rung of rungs) {
        expect(contrast(PHASE_STYLE[rung].color, bg)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('separates HOSTILE from ENGAGED by value, not by hue alone', () => {
    expect(contrast(PHASE_STYLE.identified.color, PHASE_STYLE.engaged.color)).toBeGreaterThan(1.5)
  })
})

describe('blinkOn', () => {
  it('lights the first half of every period', () => {
    expect(BLINK_PERIOD_S).toBe(0.5)
    expect(blinkOn(0)).toBe(true)
    expect(blinkOn(0.24)).toBe(true)
    expect(blinkOn(0.25)).toBe(false)
    expect(blinkOn(0.49)).toBe(false)
    expect(blinkOn(0.5)).toBe(true)
  })

  it('is deterministic and periodic, including before t = 0', () => {
    for (const t of [0, 0.1, 0.3, 1.7, 12.45, 300.02]) {
      expect(blinkOn(t)).toBe(blinkOn(t))
      expect(blinkOn(t)).toBe(blinkOn(t + BLINK_PERIOD_S))
      expect(blinkOn(t)).toBe(blinkOn(t + BLINK_PERIOD_S * 10))
    }
    expect(blinkOn(-0.1)).toBe(false)
    expect(blinkOn(-0.4)).toBe(true)
  })
})

describe('phase transitions and precedence', () => {
  // One sensor holds [10, 20] then [40, 60]. Hostile at 45, usable window
  // [50, 70], a salvo assigned at 62 landing at 66 that all but wipes the
  // single ship, then a second salvo assigned at 70.
  const a = assessment({
    firstDetectS: 10,
    classificationAtS: { unknownAtS: 10, suspectedAtS: 12, hostileAtS: 45 },
    windowS: [50, 70],
    arrivalS: 80,
    sensorObservations: [
      observation('s1', [
        [10, 20],
        [40, 60],
      ]),
    ],
  })
  const report = reportOf(
    [
      event({ tS: 62, tEffectS: 66, killDelta: 0.99 }),
      event({ tS: 70, tEffectS: 74, killDelta: 0.005 }),
    ],
    [threatAtt('u1', 1)],
  )
  const phaseAt = (tS: number): TrackPhase => stateAt(a, report, tS).phase

  it('walks the whole lifecycle in order', () => {
    expect(phaseAt(5)).toBe('undetected')
    expect(phaseAt(15)).toBe('tracked')
    expect(phaseAt(30)).toBe('searching')
    expect(phaseAt(45)).toBe('identified')
    expect(phaseAt(55)).toBe('targeted')
    expect(phaseAt(62)).toBe('engaged')
    expect(phaseAt(66)).toBe('ghost')
    expect(phaseAt(200)).toBe('ghost')
  })

  it('applies the precedence order at every overlap', () => {
    // ghost outranks engaged: the second salvo is in flight at t = 71.
    expect(stateAt(a, report, 71).incomingSalvos).toBe(1)
    expect(phaseAt(71)).toBe('ghost')
    // engaged outranks targeted: t = 62 sits inside the window.
    expect(stateAt(a, report, 62).targetedNow).toBe(true)
    // targeted outranks identified: t = 55 is hostile and inside the window.
    expect(stateAt(a, report, 55).classification).toBe('hostile')
    // identified outranks tracked: t = 45 is hostile and still held.
    expect(stateAt(a, report, 45).heldNow).toBe(true)
    // tracked outranks searching, searching outranks undetected.
    expect(stateAt(a, report, 15).detected).toBe(true)
    expect(stateAt(a, report, 30).detected).toBe(true)
    expect(stateAt(a, report, 30).heldNow).toBe(false)
  })

  it('holds the track with the repo 0.25 s sample tolerance', () => {
    expect(stateAt(a, report, 9.7).heldNow).toBe(false)
    expect(stateAt(a, report, 9.75).heldNow).toBe(true)
    expect(stateAt(a, report, 20.25).heldNow).toBe(true)
    expect(stateAt(a, report, 20.3).heldNow).toBe(false)
    expect(stateAt(a, report, 39.7).heldNow).toBe(false)
    expect(stateAt(a, report, 39.75).heldNow).toBe(true)
    // Tolerance can lead first detection; detected must never lag heldNow.
    expect(stateAt(a, report, 9.75).detected).toBe(true)
    expect(stateAt(a, report, 9.75).phase).toBe('tracked')
  })

  it('coasts only while every holding sensor is inside one of its coast intervals', () => {
    // s1 holds [10, 30] and coasts [20, 24.5] inside it; s2 measures over [22, 23].
    const coast = assessment({
      firstDetectS: 10,
      sensorObservations: [observation('s1', [[10, 30]], [[20, 24.5]]), observation('s2', [[22, 23]])],
    })
    const empty = reportOf([])
    expect(stateAt(coast, empty, 15).coasting).toBe(false)
    expect(stateAt(coast, empty, 20).coasting).toBe(true)
    expect(stateAt(coast, empty, 24.5).coasting).toBe(true)
    // The coast test carries the 0.25 s hold tolerance.
    expect(stateAt(coast, empty, 24.75).coasting).toBe(true)
    expect(stateAt(coast, empty, 24.8).coasting).toBe(false)
    // A second sensor with a live measurement makes the track measured.
    expect(stateAt(coast, empty, 22.5).holdingSensorIds).toEqual(['s1', 's2'])
    expect(stateAt(coast, empty, 22.5).coasting).toBe(false)
    // Coast is held: the phase stays TRACKED, no new rung.
    expect(stateAt(coast, empty, 20).heldNow).toBe(true)
    expect(stateAt(coast, empty, 20).phase).toBe('tracked')
    expect(stateAt(coast, empty, 35).coasting).toBe(false)
  })

  it('climbs the classification ladder and lists the holding sensors', () => {
    const two = assessment({
      firstDetectS: 10,
      classificationAtS: { unknownAtS: 10, suspectedAtS: 12, hostileAtS: 45 },
      sensorObservations: [observation('s1', [[10, 20]]), observation('s2', [[15, 50]])],
    })
    const empty = reportOf([])
    expect(stateAt(two, empty, 9).classification).toBe('pending')
    expect(stateAt(two, empty, 10).classification).toBe('unknown')
    expect(stateAt(two, empty, 12).classification).toBe('suspected')
    expect(stateAt(two, empty, 44.9).classification).toBe('suspected')
    expect(stateAt(two, empty, 45).classification).toBe('hostile')
    expect(stateAt(two, empty, 12).holdingSensorIds).toEqual(['s1'])
    expect(stateAt(two, empty, 16).holdingSensorIds).toEqual(['s1', 's2'])
    expect(stateAt(two, empty, 30).holdingSensorIds).toEqual(['s2'])
    expect(stateAt(two, empty, 60).holdingSensorIds).toEqual([])
  })

  it('targets only inside a usable window on an engageable track', () => {
    const win = assessment({ firstDetectS: 0, windowS: [50, 70] })
    const empty = reportOf([])
    expect(stateAt(win, empty, 49.9).targetedNow).toBe(false)
    expect(stateAt(win, empty, 50).targetedNow).toBe(true)
    expect(stateAt(win, empty, 70).targetedNow).toBe(true)
    expect(stateAt(win, empty, 70.1).targetedNow).toBe(false)
    // Same geometry, but the status is not engageable: never targetable.
    const short = assessment({ firstDetectS: 0, status: 'window-too-short', windowS: [50, 70] })
    expect(stateAt(short, empty, 60).targetedNow).toBe(false)
    expect(stateAt(short, empty, 60).phase).toBe('searching')
  })

  it('latches ENGAGED from the first salvo to the end of the run', () => {
    // A beam holds incoming for BEAM_DISPLAY_S only, so a phase driven by
    // incomingSalvos dropped back to TARGETED between dwells and flickered.
    const beams = reportOf(
      [
        jamEvent({ tS: 52, tEffectS: 52 }),
        jamEvent({ tS: 56, tEffectS: 56 }),
        jamEvent({ tS: 60, tEffectS: 60 }),
      ],
      [threatAtt('u1', 1)],
    )
    expect(stateAt(a, beams, 51.9).phase).toBe('targeted')
    expect(stateAt(a, beams, 52).phase).toBe('engaged')
    // Between dwells: nothing is incoming, and the phase must not fall back.
    expect(stateAt(a, beams, 54).incomingSalvos).toBe(0)
    expect(stateAt(a, beams, 54).phase).toBe('engaged')
    expect(stateAt(a, beams, 58).phase).toBe('engaged')
    // Past the window and past every dwell, the latch still holds.
    expect(stateAt(a, beams, 90).targetedNow).toBe(false)
    expect(stateAt(a, beams, 90).phase).toBe('engaged')
    expect(stateAt(a, beams, 1e6).phase).toBe('engaged')
  })

  it('reports the first salvo time and leaves it null before any shot', () => {
    expect(stateAt(a, report, 61.9).firstSalvoAtS).toBeNull()
    expect(stateAt(a, report, 62).firstSalvoAtS).toBe(62)
    expect(stateAt(a, report, 200).firstSalvoAtS).toBe(62)
    expect(stateAt(a, reportOf([]), 200).firstSalvoAtS).toBeNull()
  })

  it('keeps ghost above the latch', () => {
    // The track is eliminated at 66 and salvos keep arriving after it.
    expect(stateAt(a, report, 65.9).phase).toBe('engaged')
    expect(stateAt(a, report, 66).phase).toBe('ghost')
    expect(stateAt(a, report, 71).firstSalvoAtS).toBe(62)
    expect(stateAt(a, report, 71).phase).toBe('ghost')
  })

  it('reports arrival and skips no-path assessments', () => {
    const arr = assessment({ arrivalS: 80 })
    expect(stateAt(arr, reportOf([]), 79.9).arrived).toBe(false)
    expect(stateAt(arr, reportOf([]), 80).arrived).toBe(true)
    expect(stateAt(arr, reportOf([]), 80).arrivalS).toBe(80)
    const tl = buildTrackTimeline(emptyScenario(), [assessment({ status: 'no-path' })], reportOf([]))
    expect(trackStatesAt(tl, 100).size).toBe(0)
  })
})

describe('ghost cutoff', () => {
  const four = [threatAtt('u1', 4)]

  it('needs residual strictly below SHIP_DEAD_BELOW', () => {
    expect(SHIP_DEAD_BELOW).toBe(0.05)
    // 3.8 of 4 ships lands residualFraction on exactly the cutoff.
    const at = stateAt(assessment({}), reportOf([event({ tEffectS: 10, killDelta: 3.8 })], four), 10)
    expect(at.residual).toBeCloseTo(0.2, 9)
    expect(at.residualFraction).toBeCloseTo(0.05, 9)
    expect(at.eliminated).toBe(false)
    expect(at.eliminatedAtS).toBeNull()
    // Not a ghost. It is ENGAGED, not 'undetected': a salvo was assigned at
    // t = 0 and the phase latches. The old expectation encoded the flicker.
    expect(at.phase).toBe('engaged')
  })

  it('flips at the first effect below the cutoff and reports that effect time', () => {
    const report = reportOf(
      [
        event({ tEffectS: 10, killDelta: 3.8 }),
        event({ tEffectS: 20, killDelta: 0.1 }),
        event({ tEffectS: 30, killDelta: 0.05 }),
      ],
      four,
    )
    const a = assessment({})
    expect(stateAt(a, report, 19.9).eliminated).toBe(false)
    const on = stateAt(a, report, 20)
    expect(on.eliminated).toBe(true)
    expect(on.eliminatedAtS).toBe(20)
    expect(on.phase).toBe('ghost')
    // Later effects never move the recorded cutoff time.
    expect(stateAt(a, report, 30).eliminatedAtS).toBe(20)
    expect(stateAt(a, report, 1e6).eliminatedAtS).toBe(20)
  })

  it('latches one way: a later effect can never un-eliminate the track', () => {
    // A residual-restoring effect is impossible in the engine; feed one anyway
    // to prove the latch is a time comparison, not a live threshold test.
    const report = reportOf(
      [event({ tEffectS: 10, killDelta: 3.95 }), event({ tEffectS: 20, killDelta: -3 })],
      four,
    )
    const a = assessment({})
    expect(stateAt(a, report, 10).eliminated).toBe(true)
    const after = stateAt(a, report, 20)
    expect(after.residualFraction).toBeGreaterThan(SHIP_DEAD_BELOW)
    expect(after.eliminated).toBe(true)
    expect(after.eliminatedAtS).toBe(10)
    expect(after.phase).toBe('ghost')
  })

  it('counts a lone airframe as one ship when no attrition row exists', () => {
    const at = stateAt(assessment({}), reportOf([event({ tEffectS: 5, killDelta: 0.96 })]), 5)
    expect(at.shipCount).toBe(1)
    expect(at.residualFraction).toBeCloseTo(0.04, 9)
    expect(at.eliminated).toBe(true)
  })
})

describe('eliminatedBySoft', () => {
  it('is true when the landed jam mass dominates at the cutoff', () => {
    const report = reportOf([
      jamEvent({ tEffectS: 10, killDelta: 0.6 }),
      event({ tEffectS: 20, killDelta: 0.36 }),
    ])
    const at = stateAt(assessment({}), report, 20)
    expect(at.eliminated).toBe(true)
    expect(at.eliminatedAtS).toBe(20)
    expect(at.eliminatedBySoft).toBe(true)
  })

  it('is false when the landed kinetic mass dominates at the cutoff', () => {
    const report = reportOf([
      jamEvent({ tEffectS: 10, killDelta: 0.36 }),
      event({ tEffectS: 20, killDelta: 0.6 }),
    ])
    const at = stateAt(assessment({}), report, 20)
    expect(at.eliminated).toBe(true)
    expect(at.eliminatedBySoft).toBe(false)
  })

  it('stays false while the track is alive', () => {
    const report = reportOf([
      jamEvent({ tEffectS: 10, killDelta: 0.6 }),
      event({ tEffectS: 20, killDelta: 0.36 }),
    ])
    const at = stateAt(assessment({}), report, 15)
    expect(at.eliminated).toBe(false)
    expect(at.eliminatedBySoft).toBe(false)
    expect(at.eliminatedAtS).toBeNull()
  })
})

describe('jammedFraction', () => {
  it('compounds per ship then averages over the formation', () => {
    // Engine rule: jammed += (1 - jammed) * pk per ship, mean over shipCount.
    const report = reportOf(
      [
        jamEvent({ tEffectS: 10, channel: 'jam', pk: 0.5, shipIdx: 0 }),
        jamEvent({ tEffectS: 20, channel: 'jam', pk: 0.5, shipIdx: 0 }),
        jamEvent({ tEffectS: 30, channel: 'jam', pk: 0.4, shipIdx: 1 }),
      ],
      [threatAtt('u1', 2)],
    )
    const a = assessment({})
    expect(stateAt(a, report, 9.9).jammedFraction).toBe(0)
    expect(stateAt(a, report, 10).jammedFraction).toBeCloseTo(0.25, 9)
    expect(stateAt(a, report, 20).jammedFraction).toBeCloseTo(0.375, 9)
    expect(stateAt(a, report, 30).jammedFraction).toBeCloseTo(0.575, 9)
    expect(stateAt(a, report, 1e6).jammedFraction).toBeCloseTo(0.575, 9)
  })

  it('ignores kill-channel salvos, jammer-fired ones included', () => {
    const report = reportOf([
      jamEvent({ tEffectS: 10, channel: 'kill', pk: 0.9, killDelta: 0.5 }),
      event({ tEffectS: 20, channel: 'kill', softShot: false, pk: 0.9, killDelta: 0.2 }),
    ])
    expect(stateAt(assessment({}), report, 100).jammedFraction).toBe(0)
  })

  it('accumulates in effect order, not assignment order', () => {
    const report = reportOf([
      jamEvent({ tS: 10, tEffectS: 40, channel: 'jam', pk: 0.5 }),
      jamEvent({ tS: 12, tEffectS: 14, channel: 'jam', pk: 0.5 }),
    ])
    const a = assessment({})
    expect(stateAt(a, report, 14).jammedFraction).toBeCloseTo(0.5, 9)
    expect(stateAt(a, report, 39.9).jammedFraction).toBeCloseTo(0.5, 9)
    expect(stateAt(a, report, 40).jammedFraction).toBeCloseTo(0.75, 9)
  })

  it('releases the hold when the illumination interval ends', () => {
    // Jamming is illumination: the hold is valid only while the track stays
    // inside the jammer's in-range interval that produced the dwells. Past
    // the interval (behind a fixed cone) the link recovers and the JAMMED
    // cue must drop.
    const a = assessment({ effectorWindows: [{ effectorId: 'e1', intervals: [[5, 30]] }] })
    const report = reportOf(
      [
        jamEvent({ tS: 10, tEffectS: 10, channel: 'jam', pk: 0.5 }),
        jamEvent({ tS: 20, tEffectS: 20, channel: 'jam', pk: 0.5 }),
      ],
      [threatAtt('u1', 1)],
    )
    expect(stateAt(a, report, 15).jammedFraction).toBeCloseTo(0.5, 9)
    expect(stateAt(a, report, 29.9).jammedFraction).toBeCloseTo(0.75, 9)
    expect(stateAt(a, report, 31).jammedFraction).toBe(0)
    expect(stateAt(a, report, 31).jammedNow).toBe(false)
  })

  it('starts a fresh hold on re-entry into a later interval', () => {
    const a = assessment({
      effectorWindows: [{ effectorId: 'e1', intervals: [[5, 30], [50, 70]] }],
    })
    const report = reportOf(
      [
        jamEvent({ tS: 10, tEffectS: 10, channel: 'jam', pk: 0.5 }),
        jamEvent({ tS: 20, tEffectS: 20, channel: 'jam', pk: 0.5 }),
        jamEvent({ tS: 60, tEffectS: 60, channel: 'jam', pk: 0.5 }),
      ],
      [threatAtt('u1', 1)],
    )
    expect(stateAt(a, report, 25).jammedFraction).toBeCloseTo(0.75, 9)
    expect(stateAt(a, report, 40).jammedFraction).toBe(0)
    // Re-entry compounds from zero, not from the lapsed 0.75.
    expect(stateAt(a, report, 60).jammedFraction).toBeCloseTo(0.5, 9)
    expect(stateAt(a, report, 71).jammedFraction).toBe(0)
  })
})

describe('salvo counting', () => {
  const report = reportOf([
    event({ tS: 10, tEffectS: 14 }),
    jamEvent({ tS: 11, tEffectS: 15, channel: 'jam' }),
    event({ tS: 30, tEffectS: 34, killDelta: 0.2 }),
  ])
  const a = assessment({})

  it('splits kinetic from jam expenditure at assignment time', () => {
    expect(stateAt(a, report, 9.9).salvosAssigned).toBe(0)
    const mid = stateAt(a, report, 11)
    expect(mid.kineticSalvos).toBe(1)
    expect(mid.deSalvos).toBe(0)
    expect(mid.jamSalvos).toBe(1)
    expect(mid.salvosAssigned).toBe(2)
    const end = stateAt(a, report, 40)
    expect(end.kineticSalvos).toBe(2)
    expect(end.deSalvos).toBe(0)
    expect(end.jamSalvos).toBe(1)
    expect(end.salvosAssigned).toBe(3)
  })

  it('keeps directed energy out of the kinetic and EW counts', () => {
    // A DE burst is a hard kill that fires no round: it belongs in deSalvos
    // alone. Counting it as kinetic reported interceptors that never flew.
    const mixed = reportOf([
      event({ tS: 10, tEffectS: 14, killDelta: 0.2 }),
      event({
        tS: 12,
        tEffectS: 12,
        effectorType: 'hpm',
        channelClass: 'directed-energy',
        killDelta: 0.3,
      }),
      event({
        tS: 13,
        tEffectS: 13,
        effectorType: 'de',
        channelClass: 'directed-energy',
        killDelta: 0.1,
      }),
      jamEvent({ tS: 14, tEffectS: 14, channel: 'jam' }),
    ])
    const end = stateAt(assessment({}), mixed, 20)
    expect(end.kineticSalvos).toBe(1)
    expect(end.deSalvos).toBe(2)
    expect(end.jamSalvos).toBe(1)
    expect(end.salvosAssigned).toBe(4)
    // Each channel starts counting at its own assignment time.
    expect(stateAt(assessment({}), mixed, 11.9).deSalvos).toBe(0)
    expect(stateAt(assessment({}), mixed, 12).deSalvos).toBe(1)
    expect(stateAt(assessment({}), mixed, 13).deSalvos).toBe(2)
  })

  it('counts effects and kill mass at effect time', () => {
    expect(stateAt(a, report, 13.9).effectsLanded).toBe(0)
    expect(stateAt(a, report, 14).effectsLanded).toBe(1)
    expect(stateAt(a, report, 33.9).expectedKills).toBe(0)
    expect(stateAt(a, report, 34).expectedKills).toBeCloseTo(0.2, 9)
  })
})

describe('incomingSalvos', () => {
  it('counts a salvo from launch up to but not including its effect', () => {
    const report = reportOf([event({ tS: 10, tEffectS: 20 })])
    const a = assessment({})
    expect(stateAt(a, report, 9.9).incomingSalvos).toBe(0)
    expect(stateAt(a, report, 10).incomingSalvos).toBe(1)
    expect(stateAt(a, report, 10).phase).toBe('engaged')
    expect(stateAt(a, report, 19.9).incomingSalvos).toBe(1)
    expect(stateAt(a, report, 20).incomingSalvos).toBe(0)
    // The phase is latched, so it does not fall back when the round lands.
    // This assertion used to read 'undetected', which encoded the flicker.
    expect(stateAt(a, report, 20).phase).toBe('engaged')
  })

  it('holds a zero-flight-time salvo incoming for BEAM_DISPLAY_S', () => {
    expect(BEAM_DISPLAY_S).toBe(0.6)
    const report = reportOf([event({ tS: 10, tEffectS: 10, killDelta: 0.2 })])
    const a = assessment({})
    expect(stateAt(a, report, 9.9).incomingSalvos).toBe(0)
    const on = stateAt(a, report, 10)
    // The effect has already landed; the beam is still drawn.
    expect(on.incomingSalvos).toBe(1)
    expect(on.effectsLanded).toBe(1)
    expect(on.phase).toBe('engaged')
    expect(stateAt(a, report, 10.55).incomingSalvos).toBe(1)
    expect(stateAt(a, report, 10.7).incomingSalvos).toBe(0)
  })

  it('adds up concurrent salvos', () => {
    const report = reportOf([
      event({ tS: 10, tEffectS: 20 }),
      event({ tS: 12, tEffectS: 16 }),
      event({ tS: 30, tEffectS: 30 }),
    ])
    const a = assessment({})
    expect(stateAt(a, report, 11).incomingSalvos).toBe(1)
    expect(stateAt(a, report, 12).incomingSalvos).toBe(2)
    expect(stateAt(a, report, 16).incomingSalvos).toBe(1)
    expect(stateAt(a, report, 25).incomingSalvos).toBe(0)
    expect(stateAt(a, report, 30).incomingSalvos).toBe(1)
  })
})

/** Group 4 fixed-wing target: size penalty 1.0 and no evasion penalty. */
const TARGET: SpecModel = {
  id: 'tst-uas',
  name: 'test uas',
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

const SENSOR: SpecModel = {
  id: 'tst-radar',
  name: 'test radar',
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

function effectorModel(
  id: string,
  effectorType: NonNullable<SpecModel['effector']>['effectorType'],
  patch: Partial<NonNullable<SpecModel['effector']>> = {},
): SpecModel {
  return {
    id,
    name: id,
    kind: 'effector',
    description: '',
    color: '#fff',
    builtin: false,
    effector: { effectorType, minRangeM: 0, maxRangeM: 1000, engageTimeS: 0, ...patch },
  }
}

let seq = 0
function ent(kind: Entity['kind'], specId: string, pos: Vec2, extra?: Partial<Entity>): Entity {
  seq += 1
  return {
    id: `${kind}-${seq}`,
    name: `${kind}-${seq}`,
    kind,
    specId,
    pos,
    headingDeg: 0,
    color: null,
    notes: '',
    ...extra,
  }
}

function link(fromId: string, toId: string): Connection {
  seq += 1
  return { id: `con-${seq}`, fromId, toId, label: '' }
}

function flight(entityId: string, points: Vec2[], speedMps: number): FlightPath {
  seq += 1
  return { id: `path-${seq}`, entityId, points, speedMps, startDelayS: 0 }
}

describe('shot geometry and effector state', () => {
  /** Effector off the flight line so from and to cannot be confused. */
  function shotScenario(model: SpecModel): { scenario: Scenario; effId: string; uasId: string } {
    const scenario = emptyScenario()
    scenario.library = [...scenario.library, TARGET, model]
    const eff = ent('effector', model.id, { x: 100, y: -50 })
    const uas = ent('uas', TARGET.id, { x: 0, y: 0 })
    scenario.entities = [eff, uas]
    scenario.paths = [
      flight(
        uas.id,
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        10,
      ),
    ]
    return { scenario, effId: eff.id, uasId: uas.id }
  }

  it('anchors the salvo at the effector and at the target ship position at effect time', () => {
    const { scenario, effId, uasId } = shotScenario(effectorModel('tst-int', 'interceptor'))
    const report = reportOf([
      event({ effectorId: effId, uasId, tS: 10, tEffectS: 20, killDelta: 0.3 }),
    ])
    const tl = buildTrackTimeline(scenario, [assessment({ uasId })], report)
    const shots = shotsInFlightAt(tl, 15)
    expect(shots).toHaveLength(1)
    expect(shots[0].from).toEqual({ x: 100, y: -50 })
    // 10 m/s for 20 s along the path.
    expect(shots[0].to.x).toBeCloseTo(200, 6)
    expect(shots[0].to.y).toBeCloseTo(0, 6)
    expect(shots[0].mode).toBe('active')
    expect(shots[0].channel).toBe('kill')
  })

  it('runs progress from 0 at launch to 1 at effect and then drops the round', () => {
    const { scenario, effId, uasId } = shotScenario(effectorModel('tst-int', 'interceptor'))
    const report = reportOf([event({ effectorId: effId, uasId, tS: 10, tEffectS: 20 })])
    const tl = buildTrackTimeline(scenario, [assessment({ uasId })], report)
    expect(shotsInFlightAt(tl, 9.9)).toHaveLength(0)
    expect(shotsInFlightAt(tl, 10)[0].progress).toBeCloseTo(0, 9)
    expect(shotsInFlightAt(tl, 15)[0].progress).toBeCloseTo(0.5, 9)
    expect(shotsInFlightAt(tl, 19)[0].progress).toBeCloseTo(0.9, 9)
    expect(shotsInFlightAt(tl, 20)).toHaveLength(0)
  })

  it('keeps a zero-flight-time salvo at progress 1 for BEAM_DISPLAY_S', () => {
    const { scenario, effId, uasId } = shotScenario(effectorModel('tst-jam', 'jammer'))
    const report = reportOf([
      jamEvent({ effectorId: effId, uasId, tS: 10, tEffectS: 10, channel: 'jam' }),
    ])
    const tl = buildTrackTimeline(scenario, [assessment({ uasId })], report)
    expect(shotsInFlightAt(tl, 10)[0].progress).toBe(1)
    expect(shotsInFlightAt(tl, 10)[0].mode).toBe('beam')
    expect(shotsInFlightAt(tl, 10.55)).toHaveLength(1)
    expect(shotsInFlightAt(tl, 10.7)).toHaveLength(0)
  })

  it('draws a round whose target is already a ghost', () => {
    const { scenario, effId, uasId } = shotScenario(effectorModel('tst-int', 'interceptor'))
    const report = reportOf(
      [
        event({ effectorId: effId, uasId, tS: 0, tEffectS: 5, killDelta: 0.99 }),
        event({ effectorId: effId, uasId, tS: 10, tEffectS: 20 }),
      ],
      [threatAtt(uasId, 1)],
    )
    const tl = buildTrackTimeline(scenario, [assessment({ uasId })], report)
    expect(trackStatesAt(tl, 15).get(uasId)!.phase).toBe('ghost')
    expect(shotsInFlightAt(tl, 15)).toHaveLength(1)
  })

  it('reports an effector state only while one of its salvos is drawn', () => {
    const { scenario, effId, uasId } = shotScenario(effectorModel('tst-gun', 'gun'))
    const report = reportOf([event({ effectorId: effId, uasId, tS: 10, tEffectS: 20 })])
    const tl = buildTrackTimeline(scenario, [assessment({ uasId })], report)
    expect(effectorStatesAt(tl, 9.9).size).toBe(0)
    expect(effectorStatesAt(tl, 15).get(effId)).toBe('semi-active')
    expect(effectorStatesAt(tl, 20).size).toBe(0)
  })

  it('reads a spent magazine as depleted for the rest of the run', () => {
    const { scenario, effId, uasId } = shotScenario(
      effectorModel('tst-int', 'interceptor', { magazineSize: 2 }),
    )
    const report = reportOf([
      event({ effectorId: effId, uasId, tS: 10, tEffectS: 20 }),
      event({ effectorId: effId, uasId, tS: 30, tEffectS: 40 }),
    ])
    const tl = buildTrackTimeline(scenario, [assessment({ uasId })], report)
    // One round left and nothing in flight: still a plain idle glyph.
    expect(effectorStatesAt(tl, 25).size).toBe(0)
    // The last round is flying, so the guidance treatment still wins.
    expect(effectorStatesAt(tl, 35).get(effId)).toBe('active')
    expect(effectorStatesAt(tl, 40).get(effId)).toBe('depleted')
    expect(effectorStatesAt(tl, 1e6).get(effId)).toBe('depleted')
  })

  it('counts the magazine at assignment, the way the engine spends it', () => {
    const { scenario, effId, uasId } = shotScenario(
      effectorModel('tst-int', 'interceptor', { magazineSize: 1 }),
    )
    const report = reportOf([event({ effectorId: effId, uasId, tS: 10, tEffectS: 20 })])
    const tl = buildTrackTimeline(scenario, [assessment({ uasId })], report)
    expect(effectorStatesAt(tl, 9.9).size).toBe(0)
    expect(effectorStatesAt(tl, 20).get(effId)).toBe('depleted')
  })

  it('never depletes an unlimited magazine', () => {
    for (const type of ['jammer', 'de', 'hpm'] as const) {
      const { scenario, effId, uasId } = shotScenario(effectorModel(`tst-${type}`, type))
      const report = reportOf([
        jamEvent({ effectorId: effId, uasId, tS: 10, tEffectS: 10, channel: 'jam' }),
      ])
      const tl = buildTrackTimeline(scenario, [assessment({ uasId })], report)
      expect(effectorStatesAt(tl, 10).get(effId)).toBe('beam')
      expect(effectorStatesAt(tl, 1e6).size).toBe(0)
    }
  })
})

describe('against the engine', () => {
  /** Sensor and effector at the origin, one threat flying east through the envelope. */
  function runScenario(model: SpecModel, uasModel: SpecModel) {
    const scenario = emptyScenario()
    scenario.library = [...scenario.library, SENSOR, uasModel, model]
    const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
    const eff = ent('effector', model.id, { x: 0, y: 0 })
    const uas = ent('uas', uasModel.id, { x: -1210, y: 0 })
    scenario.entities = [sensor, eff, uas]
    scenario.connections = [link(sensor.id, eff.id)]
    scenario.paths = [
      flight(
        uas.id,
        [
          { x: -1210, y: 0 },
          { x: 3000, y: 0 },
        ],
        40,
      ),
    ]
    scenario.roe = 'free'
    const assessments = assessAllThreats(scenario)
    const report = resolveEngagements(scenario, assessments)
    return { scenario, assessments, report, uasId: uas.id, effId: eff.id }
  }

  it('replays continueJamProb exactly at the last dwell, then releases', () => {
    // 'mixed' nav gives the 'continue' jam behavior: the threat presses on
    // with a degraded track, so the engine fills continueJamProb. With no
    // asset placed the engine reads that figure at the last dwell effect.
    const mixed: SpecModel = { ...TARGET, uas: { ...TARGET.uas!, navMode: 'mixed' } }
    const { scenario, assessments, report, uasId } = runScenario(
      effectorModel('tst-jam', 'jammer', { pk: 0.5, salvoCooldownS: 2 }),
      mixed,
    )
    const row = report.threats.find((t) => t.uasId === uasId)!
    expect(row.jamSalvos).toBeGreaterThan(1)
    expect(row.continueJamProb).toBeGreaterThan(0)

    const tl = buildTrackTimeline(scenario, assessments, report)
    const lastDwellS = Math.max(
      ...report.events.filter((e) => e.channelClass === 'ew').map((e) => e.tEffectS),
    )
    const held = trackStatesAt(tl, lastDwellS).get(uasId)!
    expect(held.jammedFraction).toBeCloseTo(row.continueJamProb, 9)
    // Illumination-bound: once the threat has flown out of the jammer's
    // in-range interval, the hold lapses and the track reads un-jammed.
    const end = trackStatesAt(tl, 1e6).get(uasId)!
    expect(end.jammedFraction).toBe(0)
    expect(end.jammedNow).toBe(false)
    expect(end.jamSalvos).toBe(row.jamSalvos)
    expect(end.kineticSalvos).toBe(row.shotsFired)
  })

  it('converges expected kills and residual to the engine totals', () => {
    const { scenario, assessments, report, uasId } = runScenario(
      effectorModel('tst-int', 'interceptor', { pk: 0.5, salvoCooldownS: 2 }),
      TARGET,
    )
    const row = report.threats.find((t) => t.uasId === uasId)!
    const tl = buildTrackTimeline(scenario, assessments, report)
    const end = trackStatesAt(tl, 1e6).get(uasId)!
    expect(end.shipCount).toBe(row.shipCount)
    expect(end.expectedKills).toBeCloseTo(row.expectedKills, 9)
    expect(end.residualFraction).toBeCloseTo(row.leakProbability, 9)
    expect(end.effectsLanded).toBe(report.events.length)
    expect(end.incomingSalvos).toBe(0)
  })

  it('detects, classifies, and targets a real track through playback', () => {
    const { scenario, assessments, report, uasId, effId } = runScenario(
      effectorModel('tst-int', 'interceptor', { pk: 0.5, salvoCooldownS: 2 }),
      TARGET,
    )
    const a = assessments.find((x) => x.uasId === uasId)!
    expect(a.status).toBe('engageable')
    expect(a.firstDetectS).not.toBeNull()
    const tl = buildTrackTimeline(scenario, assessments, report)

    expect(trackStatesAt(tl, 0).get(uasId)!.heldNow).toBe(true)
    expect(trackStatesAt(tl, 0).get(uasId)!.holdingSensorIds).toHaveLength(1)

    const firstShot = report.events[0]
    const atShot = trackStatesAt(tl, firstShot.tS).get(uasId)!
    expect(atShot.phase).toBe('engaged')
    expect(effectorStatesAt(tl, firstShot.tS).get(effId)).toBe('active')

    // Every sampled instant stays internally consistent.
    for (let t = 0; t <= 120; t += 0.5) {
      const s = trackStatesAt(tl, t).get(uasId)!
      expect(s.salvosAssigned).toBe(s.kineticSalvos + s.deSalvos + s.jamSalvos)
      expect(s.incomingSalvos).toBeGreaterThanOrEqual(0)
      expect(s.residualFraction).toBeGreaterThanOrEqual(0)
      expect(s.residualFraction).toBeLessThanOrEqual(1)
      expect(s.eliminated).toBe(s.eliminatedAtS != null)
    }
  })

  it('averages the jam probability over a real formation', () => {
    const mixed: SpecModel = { ...TARGET, uas: { ...TARGET.uas!, navMode: 'mixed' } }
    const scenario = emptyScenario()
    const jammer = effectorModel('tst-jam', 'jammer', { pk: 0.5, salvoCooldownS: 2 })
    scenario.library = [...scenario.library, SENSOR, mixed, jammer]
    const sensor = ent('sensor', SENSOR.id, { x: 0, y: 0 })
    const eff = ent('effector', jammer.id, { x: 0, y: 0 })
    const uas = ent('uas', mixed.id, { x: -1210, y: 0 }, {
      formation: { count: 3, shape: 'line', spacingM: 40 },
    })
    scenario.entities = [sensor, eff, uas]
    scenario.connections = [link(sensor.id, eff.id)]
    scenario.paths = [
      flight(
        uas.id,
        [
          { x: -1210, y: 0 },
          { x: 3000, y: 0 },
        ],
        40,
      ),
    ]
    scenario.roe = 'free'
    const assessments = assessAllThreats(scenario)
    const report = resolveEngagements(scenario, assessments)
    const row = report.threats.find((t) => t.uasId === uas.id)!
    expect(row.shipCount).toBe(3)

    const tl = buildTrackTimeline(scenario, assessments, report)
    const lastDwellS = Math.max(
      ...report.events.filter((e) => e.channelClass === 'ew').map((e) => e.tEffectS),
    )
    const held = trackStatesAt(tl, lastDwellS).get(uas.id)!
    expect(held.shipCount).toBe(3)
    expect(held.jammedFraction).toBeCloseTo(row.continueJamProb, 9)
    // The hold releases once the formation leaves the jam envelope.
    expect(trackStatesAt(tl, 1e6).get(uas.id)!.jammedFraction).toBe(0)
  })
})

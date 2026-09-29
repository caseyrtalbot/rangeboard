import { describe, expect, it } from 'vitest'
import {
  beamAndFormationTrial,
  mixedTrial,
  trialAssessment,
  trialEvent,
} from './__fixtures__/trialFixture'
import type { SensorScanObservation } from './detection'
import { deadTimeOf } from './deadTimes'
import { clipAtKill } from './killClip'
import type { FusedTrack, TrackEstimate } from './trackTypes'

const STEP = 0.5

function fused(tS: number): FusedTrack {
  return {
    id: 'fused:swarm',
    uasId: 'swarm',
    sensorIds: ['radar'],
    state: { x: 0, y: 0, vx: 0, vy: 0, tS },
    covariance: new Array(16).fill(0),
    quality: 1,
    hits: 1,
    misses: 0,
    coasting: false,
    source: 'estimate',
    c2Id: 'c2',
    memberTrackIds: ['radar:swarm'],
    fusedAtS: tS,
  }
}

function estimate(uasId: string | null, tS: number): TrackEstimate {
  return {
    id: uasId == null ? 'radar:false:0:0' : `radar:${uasId}`,
    uasId,
    sensorIds: ['radar'],
    state: { x: 0, y: 0, vx: 0, vy: 0, tS },
    covariance: new Array(16).fill(0),
    quality: 1,
    hits: 1,
    misses: 0,
    coasting: false,
    source: uasId == null ? 'false' : 'estimate',
  }
}

function scan(uasId: string, tS: number): SensorScanObservation {
  return {
    uasId,
    sensorId: 'radar',
    sensorType: 'radar',
    tS,
    gate: 'ok',
    cued: false,
    resolved: true,
    members: [],
  }
}

/** One threat swept to 20 s, held by two sensors, killed at 10 s. */
function killedAtTen() {
  const { result } = mixedTrial()
  const radar = {
    sensorId: 'radar',
    sensorType: 'radar' as const,
    firstDetectS: 1,
    lastDetectS: 20,
    firstClassifyS: 12,
    heldSamples: 39,
    resolvedEver: true,
    minSlantM: 20,
    intervals: [
      [1, 6],
      [8, 20],
    ] as Array<[number, number]>,
    trackInitAtS: 3,
    coastIntervals: [[5, 6]] as Array<[number, number]>,
    pdSeries: Array.from({ length: 41 }, (_, i) => i / 41),
    pdSeriesStartS: 0,
  }
  const late = { ...radar, sensorId: 'eo', sensorType: 'eo-ir' as const, firstDetectS: 12 }
  const a = trialAssessment('swarm', {
    firstDetectS: 1,
    firstConfirmS: 12,
    techs: ['radar', 'eo-ir'],
    detectingSensorIds: ['radar', 'eo'],
    sensorObservations: [radar, late],
    fusedTracks: [fused(1), fused(9.5), fused(10), fused(10.5)],
  })
  const other = trialAssessment('moving', { fusedTracks: [fused(15)] })
  const report = {
    ...result.report,
    threats: [
      { ...result.report.threats[0], uasId: 'swarm', shipCount: 1 },
      { ...result.report.threats[0], uasId: 'moving', shipCount: 1 },
    ],
    // One ship: the salvos aim at shipIdx 0 (the fixture default is a formation ship).
    events: [
      trialEvent({ tS: 5, tEffectS: 7, shipIdx: 0, killDelta: 0 }),
      trialEvent({ tS: 8, tEffectS: 10, shipIdx: 0, killDelta: 1 }),
    ],
  }
  return { a, other, report }
}

describe('clipAtKill', () => {
  it('returns the same lists and assessments when no threat dies', () => {
    const { a, other, report } = killedAtTen()
    const none = { ...report, events: report.events.map((e) => ({ ...e, killDelta: 0 })) }
    const tracks = [estimate('swarm', 15)]
    const out = clipAtKill({ assessments: [a, other], report: none, stepS: STEP, tracks })
    expect(out.assessments[0]).toBe(a)
    expect(out.tracks).toBe(tracks)
  })

  it('ends the fused track, the holds and the coast at the kill and keeps the rest', () => {
    const { a, other, report } = killedAtTen()
    const out = clipAtKill({ assessments: [a, other], report, stepS: STEP })
    const swarm = out.assessments[0]
    // The sample at the kill measured a live target; the one after it did not.
    expect(swarm.fusedTracks!.map((f) => f.fusedAtS)).toEqual([1, 9.5, 10])
    const radar = swarm.sensorObservations![0]
    expect(radar.intervals).toEqual([
      [1, 6],
      [8, 10],
    ])
    expect(radar.coastIntervals).toEqual([[5, 6]])
    expect(radar.lastDetectS).toBe(10)
    // 20 samples were dropped from [8, 20].
    expect(radar.heldSamples).toBe(19)
    expect(radar.firstClassifyS).toBeNull()
    expect(radar.trackInitAtS).toBe(3)
    expect(radar.pdSeries).toHaveLength(21)
    // The sensor that first detected after the kill never held the live threat.
    expect(swarm.sensorObservations).toHaveLength(1)
    expect(swarm.detectingSensorIds).toEqual(['radar'])
    expect(swarm.techs).toEqual(['radar'])
    expect(swarm.firstConfirmS).toBeNull()
    // The report and the other threat are untouched.
    expect(out.assessments[1]).toBe(other)
    expect(a.fusedTracks).toHaveLength(4)
    expect(report.events[1].killDelta).toBe(1)
  })

  it('returns the same assessment for a killed threat with nothing to clip', () => {
    const { a, other, report } = killedAtTen()
    const late = {
      ...report,
      events: [report.events[0], { ...report.events[1], tS: 23, tEffectS: 25 }],
    }
    const out = clipAtKill({ assessments: [a, other], report: late, stepS: STEP })
    expect(out.assessments[0]).toBe(a)
  })

  it('ends a hold on the sweep grid for an off-grid kill', () => {
    const { a, other, report } = killedAtTen()
    const offGrid = {
      ...report,
      events: [report.events[0], { ...report.events[1], tEffectS: 10.3 }],
    }
    const out = clipAtKill({ assessments: [a, other], report: offGrid, stepS: STEP })
    const radar = out.assessments[0].sensorObservations![0]
    // The last sample at or before 10.3 is 10; [8, 10] holds 5 samples, [1, 6] holds 11.
    expect(radar.intervals).toEqual([
      [1, 6],
      [8, 10],
    ])
    const end = radar.intervals[1][1]
    expect(Number.isInteger(end / STEP)).toBe(true)
    // 36 samples swept, 16 kept: 39 - 20.
    expect(radar.heldSamples).toBe(19)
    expect(radar.lastDetectS).toBe(10)
    expect(Number.isInteger(radar.lastDetectS / STEP)).toBe(true)
    expect(radar.pdSeries).toHaveLength(21)
  })

  it('drops the killed threat estimates and scans past the kill, never a false track', () => {
    const { a, other, report } = killedAtTen()
    const tracks = [
      estimate('swarm', 10),
      estimate('swarm', 10.5),
      estimate('moving', 10.5),
      estimate(null, 10.5),
    ]
    const observations = [scan('swarm', 10), scan('swarm', 10.5), scan('moving', 10.5)]
    const out = clipAtKill({ assessments: [a, other], report, stepS: STEP, tracks, observations })
    expect(out.tracks!.map((t) => [t.uasId, t.state.tS])).toEqual([
      ['swarm', 10],
      ['moving', 10.5],
      [null, 10.5],
    ])
    expect(out.observations!.map((o) => [o.uasId, o.tS])).toEqual([
      ['swarm', 10],
      ['moving', 10.5],
    ])
  })
})

/** The `killedAtTen` ledger replaced by `events`; the swarm row keeps `shipCount`. */
function withEvents(events: ReturnType<typeof trialEvent>[], shipCount = 1) {
  const { a, other, report } = killedAtTen()
  const threats = report.threats.map((row) => (row.uasId === 'swarm' ? { ...row, shipCount } : row))
  return { a, other, report: { ...report, threats, events } }
}

const softEvent = (over: Partial<ReturnType<typeof trialEvent>>) =>
  trialEvent({
    shipIdx: 0,
    softShot: true,
    effectorId: 'jammer',
    effectorType: 'jammer',
    channelClass: 'ew',
    ...over,
  })

/** Where the swarm radar hold ends after a clip: the kill, or the swept end with no clip. */
function heldTo(out: ReturnType<typeof clipAtKill>): number {
  return out.assessments[0].sensorObservations![0].lastDetectS
}

describe('clipAtKill by kill type', () => {
  it('hard kinetic: clips at the kill', () => {
    const { a, other, report } = killedAtTen()
    expect(deadTimeOf(report, 'swarm')).toEqual({ tS: 10, soft: false, late: false, mixed: false })
    const out = clipAtKill({ assessments: [a, other], report, stepS: STEP })
    expect(heldTo(out)).toBe(10)
  })

  it('mission kill (drift): the airframe still flies, so nothing clips', () => {
    const { a, other, report } = withEvents([
      softEvent({ tS: 5, tEffectS: 7, killDelta: 0 }),
      softEvent({ tS: 8, tEffectS: 10, killDelta: 1 }),
    ])
    expect(deadTimeOf(report, 'swarm')).toEqual({ tS: 10, soft: true, late: false, mixed: false })
    const tracks = [estimate('swarm', 15)]
    const out = clipAtKill({ assessments: [a, other], report, stepS: STEP, tracks })
    expect(out.assessments[0]).toBe(a)
    expect(out.tracks).toBe(tracks)
  })

  it('mission kill (return-home): the same soft ledger, no clip, holds to the path end', () => {
    // The ledger carries no jamBehavior; drift and return-home both reach the
    // clip as a jammer kill, and both leave the airframe flying.
    const { a, other, report } = withEvents([softEvent({ tS: 8, tEffectS: 10, killDelta: 1 })])
    const out = clipAtKill({ assessments: [a, other], report, stepS: STEP })
    expect(heldTo(out)).toBe(20)
    expect(out.assessments[0].fusedTracks!.map((f) => f.fusedAtS)).toEqual([1, 9.5, 10, 10.5])
  })

  it('continue jam: not dead, no clip', () => {
    const { a, other, report } = withEvents([
      softEvent({ tS: 8, tEffectS: 10, channel: 'jam', killDelta: 0 }),
    ])
    expect(deadTimeOf(report, 'swarm')).toBeNull()
    expect(clipAtKill({ assessments: [a, other], report, stepS: STEP }).assessments[0]).toBe(a)
  })

  it('late hard: clips at the late effect', () => {
    const { a, other, report } = withEvents([
      trialEvent({ tS: 5, tEffectS: 7, shipIdx: 0, killDelta: 0 }),
      trialEvent({ tS: 8, tEffectS: 10, shipIdx: 0, killDelta: 1, lateEffect: true }),
    ])
    expect(deadTimeOf(report, 'swarm')).toEqual({ tS: 10, soft: false, late: true, mixed: false })
    expect(heldTo(clipAtKill({ assessments: [a, other], report, stepS: STEP }))).toBe(10)
  })

  it('late soft: no clip', () => {
    const { a, other, report } = withEvents([
      softEvent({ tS: 8, tEffectS: 10, killDelta: 1, lateEffect: true }),
    ])
    expect(deadTimeOf(report, 'swarm')).toEqual({ tS: 10, soft: true, late: true, mixed: false })
    expect(clipAtKill({ assessments: [a, other], report, stepS: STEP }).assessments[0]).toBe(a)
  })

  it('flight-capped: the capped effect kills at its tEffectS and clips there', () => {
    const { a, other, report } = withEvents([
      trialEvent({ tS: 5, tEffectS: 10, shipIdx: 0, killDelta: 1, flightCapped: true }),
    ])
    expect(report.events[0].flightCapped).toBe(true)
    expect(deadTimeOf(report, 'swarm')).toEqual({ tS: 10, soft: false, late: false, mixed: false })
    expect(heldTo(clipAtKill({ assessments: [a, other], report, stepS: STEP }))).toBe(10)
  })

  it('formation of 2: one removal leaves it alive, two hard removals clip at the second', () => {
    const one = withEvents([trialEvent({ tS: 5, tEffectS: 7, shipIdx: 0, killDelta: 1 })], 2)
    expect(deadTimeOf(one.report, 'swarm')).toBeNull()
    expect(
      clipAtKill({ assessments: [one.a, one.other], report: one.report, stepS: STEP })
        .assessments[0],
    ).toBe(one.a)
    const two = withEvents(
      [
        trialEvent({ tS: 5, tEffectS: 7, shipIdx: 0, killDelta: 1 }),
        trialEvent({ tS: 8, tEffectS: 10, shipIdx: 1, killDelta: 1 }),
      ],
      2,
    )
    expect(deadTimeOf(two.report, 'swarm')!.tS).toBe(10)
    expect(
      heldTo(clipAtKill({ assessments: [two.a, two.other], report: two.report, stepS: STEP })),
    ).toBe(10)
  })

  it('mixed defeat: one hard and one soft ship latch, no clip', () => {
    const { a, other, report } = withEvents(
      [
        trialEvent({ tS: 5, tEffectS: 7, shipIdx: 0, killDelta: 1 }),
        softEvent({ tS: 8, tEffectS: 10, shipIdx: 1, killDelta: 1 }),
      ],
      2,
    )
    expect(deadTimeOf(report, 'swarm')).toEqual({ tS: 10, soft: true, late: false, mixed: true })
    expect(clipAtKill({ assessments: [a, other], report, stepS: STEP }).assessments[0]).toBe(a)
  })

  it('leakage: an arrived threat with no kill mass is alive, no clip', () => {
    const { a, other, report } = withEvents([
      trialEvent({ tS: 5, tEffectS: 7, shipIdx: 0, killDelta: 0 }),
    ])
    const arrived = { ...a, arrivalS: 15 }
    expect(deadTimeOf(report, 'swarm')).toBeNull()
    expect(clipAtKill({ assessments: [arrived, other], report, stepS: STEP }).assessments[0]).toBe(
      arrived,
    )
  })

  it('no path: no events, null, no clip', () => {
    const { a, other, report } = withEvents([])
    const parked = { ...a, status: 'no-path' as const }
    expect(deadTimeOf(report, 'swarm')).toBeNull()
    expect(clipAtKill({ assessments: [parked, other], report, stepS: STEP }).assessments[0]).toBe(
      parked,
    )
  })
})

describe('clipAtKill on the engine fixture (DE, HPM, formation, jammer)', () => {
  const { result, ids } = beamAndFormationTrial()
  const hold = (uasId: string) =>
    result.assessments.find((a) => a.uasId === uasId)!.sensorObservations![0]
  const lastEstimateS = (uasId: string) =>
    Math.max(...result.tracks!.filter((t) => t.uasId === uasId).map((t) => t.state.tS))
  const hardAt = (uasId: string, tS: number) => {
    expect(deadTimeOf(result.report, uasId)).toEqual({ tS, soft: false, late: false, mixed: false })
    expect(hold(uasId).lastDetectS).toBe(tS)
    expect(hold(uasId).intervals).toEqual([[0, tS]])
    expect(lastEstimateS(uasId)).toBe(tS)
  }

  it('DE hard kill clips at the burst effect', () => {
    const de = result.report.events.filter((e) => e.uasId === ids.de)
    expect(de.map((e) => [e.effectorType, e.killDelta])).toEqual([['de', 1]])
    hardAt(ids.de, 105.5)
  })

  it('HPM hard kill clips at the killing burst, not the misses before it', () => {
    const hpm = result.report.events.filter((e) => e.uasId === ids.hpm)
    expect(hpm.every((e) => e.effectorType === 'hpm')).toBe(true)
    expect(hpm.map((e) => e.killDelta)).toEqual([0, 0, 0, 0, 0, 1])
    hardAt(ids.hpm, 128.5)
  })

  it('formation hard kill clips at the salvo that killed the second ship', () => {
    const salvos = result.report.events.filter((e) => e.uasId === ids.formation)
    expect(salvos.map((e) => [e.shipIdx, e.tEffectS, e.killDelta])).toEqual([
      [0, 108.5, 1],
      [1, 113.5, 1],
    ])
    expect(result.report.threats.find((t) => t.uasId === ids.formation)!.shipCount).toBe(2)
    hardAt(ids.formation, 113.5)
  })

  it('jammer mission kill (drift) is dead soft and holds to the path end', () => {
    expect(deadTimeOf(result.report, ids.jammed)).toEqual({
      tS: 99.5,
      soft: true,
      late: false,
      mixed: false,
    })
    // The airframe drifts on: the hold, the estimates and the fused track run to the path end.
    expect(hold(ids.jammed).lastDetectS).toBe(163)
    expect(lastEstimateS(ids.jammed)).toBe(163)
    const fused = result.assessments.find((a) => a.uasId === ids.jammed)!.fusedTracks!
    expect(fused[fused.length - 1].fusedAtS).toBe(163)
  })
})

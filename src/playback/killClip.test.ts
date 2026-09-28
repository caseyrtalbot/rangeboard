import { describe, expect, it } from 'vitest'
import { mixedTrial, trialAssessment, trialEvent } from './__fixtures__/trialFixture'
import type { SensorScanObservation } from './detection'
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
    events: [
      trialEvent({ tS: 5, tEffectS: 7, killDelta: 0 }),
      trialEvent({ tS: 8, tEffectS: 10, killDelta: 1 }),
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

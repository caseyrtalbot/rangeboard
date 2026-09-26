import { describe, expect, it } from 'vitest'
import firing from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { trialResultOf, trialSnapshotAt } from '../analysis/trialResult'
import { parseScenarioData } from '../io/persist'
import { buildTrialResultGroup } from '../io/runResultGroups'
import { analysisBasisSignature } from '../state/analysisBasis'
import { trackEstimateFixture } from './__fixtures__/trackEstimateFixture'
import { mixedTrial, trialAssessment } from './__fixtures__/trialFixture'
import { latestEstimatesAt, positionEllipse } from './trackEstimateView'
import type { FusedTrackSummary, ThreatAssessment } from './sim'
import type { FusedTrack, TrackEstimate } from './trackTypes'
import { runTrial } from './trial'
import { trialSweepAt } from './trialSweepAt'
import { createTrialManifest } from './trialTypes'
import { boundRetainedTrial, releaseRetainedTrial } from './retainTrial'

const round = (value: unknown) => JSON.parse(JSON.stringify(value))

/** The entry the bound copy keeps: no sensor ids and the position block only. */
const trimmed = ({ covariance, ...track }: TrackEstimate): TrackEstimate => ({
  ...track,
  sensorIds: [],
  covariance: [covariance[0], covariance[1], 0, 0, 0, covariance[5]],
})

/** The summary computed straight from the engine list, for comparison. */
const summaryOf = (fused: readonly FusedTrack[]): FusedTrackSummary => {
  const pairs = fused.flatMap((entry) =>
    entry.sensorIds.map((sensorId) => ({ sensorId, fromS: entry.fusedAtS })),
  )
  return {
    initAtS: fused[0].fusedAtS,
    lastAtS: fused.at(-1)!.fusedAtS,
    c2Id: fused[0].c2Id,
    members: pairs.filter(
      (pair, index) => pairs.findIndex((other) => other.sensorId === pair.sensorId) === index,
    ),
  }
}

const fusedEntry = (fusedAtS: number, c2Id: string, sensorIds: string[]): FusedTrack => ({
  id: `fused-${fusedAtS}`,
  uasId: 'swarm',
  sensorIds,
  state: { x: 0, y: 0, vx: 0, vy: 0, tS: fusedAtS },
  covariance: [1, 0, 0, 0, 0, 1],
  quality: 1,
  hits: 1,
  misses: 0,
  coasting: false,
  source: 'estimate',
  c2Id,
  memberTrackIds: [],
  fusedAtS,
})

/** Binds a hand-built trial whose only assessment is `assessment`. */
const boundOne = (assessment: ThreatAssessment): ThreatAssessment => {
  const { result } = mixedTrial()
  return boundRetainedTrial({ ...result, assessments: [assessment] }).assessments[0]
}

function firingTrial() {
  const scenario = parseScenarioData(structuredClone(firing))
  const manifest = createTrialManifest(scenario, 'retain-firing', analysisBasisSignature(scenario))
  const result = runTrial(scenario, manifest)
  return { scenario, manifest, result, bound: boundRetainedTrial({ ...result, manifest }) }
}

describe('bounded trial retention', () => {
  it('exports the same ledger, scans, members and counts as the engine trial', () => {
    const { scenario, manifest, result, bound } = firingTrial()
    const full = buildTrialResultGroup(trialResultOf(scenario, manifest, result))
    const retained = buildTrialResultGroup(trialResultOf(scenario, manifest, bound))
    expect(round(retained.attrition)).toEqual(round(full.attrition))
    expect(round(retained.observations)).toEqual(round(full.observations))
    expect(retained.jamDecisions).toEqual(full.jamDecisions)
    expect(round(retained.members)).toEqual(round(full.members))
    expect(retained.counts).toEqual(full.counts)
    expect(round(retained.assessments)).toEqual(
      round(
        full.assessments.map(({ fusedTracks, ...assessment }) =>
          fusedTracks && fusedTracks.length > 0
            ? { ...assessment, fusedTrack: summaryOf(fusedTracks) }
            : assessment,
        ),
      ),
    )
    expect(JSON.stringify(bound.assessments)).not.toContain('fusedTracks')
    expect(boundRetainedTrial(bound)).toBe(bound)
  })

  it('summarizes each non-empty fused-track list and keeps no reference to it', () => {
    const { result, bound } = firingTrial()
    const fused = result.assessments.filter((a) => (a.fusedTracks?.length ?? 0) > 0)
    expect(fused.length).toBeGreaterThan(0)
    for (const [index, assessment] of result.assessments.entries()) {
      const list = assessment.fusedTracks
      if (list && list.length > 0) {
        expect(bound.assessments[index].fusedTrack).toEqual(summaryOf(list))
      } else {
        expect(bound.assessments[index]).not.toHaveProperty('fusedTrack')
      }
    }
    const before = structuredClone(bound.assessments.map((a) => a.fusedTrack))
    for (const assessment of fused) {
      assessment.fusedTracks![0].sensorIds.push('mutated')
      assessment.fusedTracks![0].c2Id = 'mutated'
      assessment.fusedTracks![0].fusedAtS = -1
      assessment.fusedTracks!.length = 0
    }
    expect(bound.assessments.map((a) => a.fusedTrack)).toEqual(before)
  })

  it('adds no summary for an absent or empty list and keeps a carried summary', () => {
    const plain = boundOne(trialAssessment('swarm'))
    expect(plain).not.toHaveProperty('fusedTrack')
    expect(plain).not.toHaveProperty('fusedTracks')
    const empty = boundOne(trialAssessment('swarm', { fusedTracks: [] }))
    expect(empty).not.toHaveProperty('fusedTrack')
    expect(empty).not.toHaveProperty('fusedTracks')
    const carried: FusedTrackSummary = {
      initAtS: 2,
      lastAtS: 9,
      c2Id: 'c2-a',
      members: [{ sensorId: 'radar', fromS: 2 }],
    }
    expect(boundOne(trialAssessment('swarm', { fusedTrack: carried })).fusedTrack).toEqual(carried)
  })

  it('lists members in first-fed order with the step each first fed', () => {
    const bound = boundOne(
      trialAssessment('swarm', {
        fusedTracks: [fusedEntry(4, 'c2-a', ['radar']), fusedEntry(6, 'c2-b', ['radar', 'eo-1'])],
      }),
    )
    expect(bound.fusedTrack).toEqual({
      initAtS: 4,
      lastAtS: 6,
      c2Id: 'c2-a',
      members: [
        { sensorId: 'radar', fromS: 4 },
        { sensorId: 'eo-1', fromS: 6 },
      ],
    })
  })

  it('keeps the board ellipse and the sweep while dropping unread estimate fields', () => {
    const { scenario, manifest, result, bound } = firingTrial()
    const horizon = result.tracks![result.tracks!.length - 1].state.tS
    const picture = (tracks: typeof result.tracks) =>
      latestEstimatesAt(tracks, horizon).map((track) => ({
        id: track.id,
        x: track.state.x,
        y: track.state.y,
        tS: track.state.tS,
        coasting: track.coasting,
        source: track.source,
        ellipse: positionEllipse(track.covariance, 1),
      }))
    expect(picture(bound.tracks)).toEqual(picture(result.tracks))
    expect(bound.tracks!.every((track) => track.covariance.length === 6)).toBe(true)
    expect(bound.tracks!.every((track) => track.sensorIds.length === 0)).toBe(true)
    const fullView = trialResultOf(scenario, manifest, result)
    const boundView = trialResultOf(scenario, manifest, bound)
    for (const t of [0, horizon / 2, horizon]) {
      const left = trialSweepAt(fullView, t)
      const right = trialSweepAt(boundView, t)
      expect(right.sensors.map(({ observation: _observation, ...sensor }) => sensor)).toEqual(
        left.sensors.map(({ observation: _observation, ...sensor }) => sensor),
      )
      expect(round(right.sensors.map((sensor) => sensor.observation ?? null))).toEqual(
        round(left.sensors.map((sensor) => sensor.observation ?? null)),
      )
    }
    expect(trialSnapshotAt(boundView, horizon).counts).toEqual(
      trialSnapshotAt(fullView, horizon).counts,
    )
    // Every entry reads back every field the input carried, position block only.
    expect(round(bound.tracks)).toEqual(round(result.tracks!.map(trimmed)))
    const held = bound.tracks!
    releaseRetainedTrial(bound)
    expect(held).toHaveLength(0)
    expect(latestEstimatesAt(held, horizon)).toEqual([])
  })

  it('binds a cloned track history to the same entries as the source', () => {
    const { result } = mixedTrial()
    const tracks = trackEstimateFixture()
    const direct = boundRetainedTrial({ ...result, tracks })
    const cloned = boundRetainedTrial({
      ...structuredClone(result),
      tracks: structuredClone(tracks),
    })
    expect(cloned.tracks).toHaveLength(tracks.length)
    expect([...cloned.tracks!]).toEqual([...direct.tracks!])
    expect(cloned.tracks![3]).toEqual(trimmed(tracks[3]))
    expect(round(direct.tracks)).toEqual(round(tracks.map(trimmed)))
  })

  it('round-trips a hand-built scan ledger and leaves the source trial intact on release', () => {
    const { result } = mixedTrial()
    const events = result.report.events.length
    const scans = result.observations.length
    const bound = boundRetainedTrial(result)
    expect(round(bound.observations)).toEqual(round(result.observations))
    const held = bound.observations
    releaseRetainedTrial(bound)
    expect(held).toHaveLength(0)
    expect(bound.tracks ?? []).toHaveLength(0)
    expect(bound.report.events).toHaveLength(0)
    expect(result.observations).toHaveLength(scans)
    expect(result.report.events).toHaveLength(events)
  })

  it('leaves an unbound trial intact when the store replaces it', () => {
    const { result } = mixedTrial()
    const scans = result.observations.length
    const events = result.report.events.length
    releaseRetainedTrial(result)
    expect(result.observations).toHaveLength(scans)
    expect(result.report.events).toHaveLength(events)
  })
})

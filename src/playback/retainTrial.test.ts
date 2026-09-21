import { describe, expect, it } from 'vitest'
import firing from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { trialResultOf, trialSnapshotAt } from '../analysis/trialResult'
import { parseScenarioData } from '../io/persist'
import { buildTrialResultGroup } from '../io/runResultGroups'
import { analysisBasisSignature } from '../state/analysisBasis'
import { mixedTrial } from './__fixtures__/trialFixture'
import { latestEstimatesAt, positionEllipse } from './trackEstimateView'
import { runTrial } from './trial'
import { trialSweepAt } from './trialSweepAt'
import { createTrialManifest } from './trialTypes'
import { boundRetainedTrial, releaseRetainedTrial } from './retainTrial'

const round = (value: unknown) => JSON.parse(JSON.stringify(value))

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
      round(full.assessments.map(({ fusedTracks: _fused, ...assessment }) => assessment)),
    )
    expect(JSON.stringify(bound.assessments)).not.toContain('fusedTracks')
    expect(boundRetainedTrial(bound)).toBe(bound)
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

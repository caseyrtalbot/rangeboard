import { emptyScenario } from '../model/seed'
import { runTrial } from '../playback/trial'
import { trialMemberStatesAt } from '../playback/trialTrackState'
import { trialSweepAt } from '../playback/trialSweepAt'
import { describe, expect, it } from 'vitest'
import { mixedTrial, trialEvent } from '../playback/__fixtures__/trialFixture'
import { trialResultOf, trialSnapshotAt } from './trialResult'
import { createTrialManifest } from '../playback/trialTypes'
import { analysisBasisSignature } from '../state/analysisBasis'

describe('captured trial result', () => {
  it('caches matching results and rejects stale provenance or incomplete member ledgers', () => {
    const { scenario, manifest, result, view } = mixedTrial()
    expect(trialResultOf(scenario, manifest, result)).toBe(view)
    expect(() =>
      trialResultOf(scenario, { ...manifest, basisSignature: 'stale' }, result),
    ).toThrow()
    expect(() =>
      trialResultOf(scenario, manifest, { ...result, manifest: { ...manifest, runId: 'stale' } }),
    ).toThrow()
    expect(() =>
      trialResultOf(scenario, manifest, { ...result, assessments: result.assessments.slice(1) }),
    ).toThrow()
    for (const event of [
      { ...result.report.events[0], shipIdx: 99 },
      { ...result.report.events[0], killDelta: 0.5 },
    ]) {
      expect(() =>
        trialResultOf(scenario, manifest, {
          ...result,
          report: { ...result.report, events: [event] },
        }),
      ).toThrow()
    }
    expect(() =>
      trialResultOf(scenario, manifest, {
        ...result,
        report: { ...result.report, events: [...result.report.events, result.report.events[0]] },
      }),
    ).toThrow('Duplicate')
  })

  it('censors effect counts and keeps realized arrivals after late hard and soft defeats', () => {
    const { view } = mixedTrial()
    expect(trialSnapshotAt(view, 1.99).counts).toMatchObject({
      preArrivalHardKills: 0,
      preArrivalSoftKills: 0,
      activeAtHorizon: 11,
    })
    expect(trialSnapshotAt(view, 3).counts).toMatchObject({
      preArrivalHardKills: 2,
      preArrivalSoftKills: 1,
      activeAtHorizon: 8,
    })
    expect(trialSnapshotAt(view, 5).counts.arrivedUndefeated).toBe(3)
    expect(trialSnapshotAt(view, 9).counts).toMatchObject({
      lateHardKills: 1,
      lateSoftKills: 1,
      arrivedUndefeated: 3,
      activeAtHorizon: 6,
      totalTracks: 3,
      detectedTracks: 1,
      engagedTracks: 2,
      noModelsArrival: 6,
    })
    expect(trialSnapshotAt(view, 9).summary).toBeUndefined()
    expect(trialSnapshotAt(view, Infinity)).toMatchObject({
      observedThroughS: view.durationS,
      horizon: { kind: 'completed-trial' },
      summary: { status: 'ready', validity: null },
    })
  })

  it('caps retained observation and leaves unavailable asset leakage uncredited', () => {
    const { scenario, manifest, result } = mixedTrial()
    const bounded = trialResultOf(scenario, manifest, { ...result, observedThroughS: 1.99 })
    expect(trialSnapshotAt(bounded, 20)).toMatchObject({
      observedThroughS: 1.99,
      counts: { preArrivalHardKills: 0 },
    })
    const noAsset = { ...scenario, entities: scenario.entities.filter((e) => e.kind !== 'asset') }
    const nextManifest = createTrialManifest(
      noAsset,
      manifest.runId,
      analysisBasisSignature(noAsset),
    )
    const view = trialResultOf(noAsset, nextManifest, { ...result, manifest: nextManifest })
    expect(view.hasActiveAsset).toBe(false)
    expect(trialSnapshotAt(view, 20).counts.arrivedUndefeated).toBe(0)
  })
})

it('adapts an actual empty result and retains stored validity without invoking a forecast', () => {
  const scenario = emptyScenario()
  const manifest = createTrialManifest(scenario, 'empty', analysisBasisSignature(scenario))
  const validity = { validity: 'valid-limited' as const, findings: [] }
  const result = { ...runTrial(scenario, manifest), validity }
  const view = trialResultOf(scenario, manifest, result)
  expect(trialSnapshotAt(view, 60).counts.totalTracks).toBe(0)
  expect(trialSnapshotAt(view, 60).tracksRendered).toBe(false)
  expect(trialSnapshotAt(view, 60).summary?.validity).toBe(validity)
})

it('bounds all adapters and preserves active-asset definedness and tail censoring', () => {
  const { scenario, manifest, result } = mixedTrial()
  const bounded = trialResultOf(scenario, manifest, { ...result, observedThroughS: 1.99 })
  expect(trialMemberStatesAt(bounded, 'swarm', 60)[3].outcome).toBe('active')
  expect(trialSweepAt(bounded, 60).timeS).toBe(1.99)
  const disabled = {
    ...scenario,
    entities: scenario.entities.map((e) => (e.kind === 'asset' ? { ...e, enabled: false } : e)),
  }
  const nextManifest = createTrialManifest(disabled, 'disabled', analysisBasisSignature(disabled))
  const view = trialResultOf(disabled, nextManifest, { ...result, manifest: nextManifest })
  expect(view.hasActiveAsset).toBe(false)
  expect(view.attrition.totals.reportedLeakers).toBe(3)
  expect(trialMemberStatesAt(view, 'swarm', 60).every((m) => !m.leakageCredit)).toBe(true)
  const tail = trialResultOf(scenario, manifest, {
    ...result,
    report: {
      ...result.report,
      events: [
        ...result.report.events,
        trialEvent({ shipIdx: 0, tS: 59, tReleaseS: 60, tEffectS: 65, lateEffect: true }),
      ],
    },
  })
  expect(trialSnapshotAt(tail, Infinity).counts.lateHardKills).toBe(1)
  expect(trialMemberStatesAt(tail, 'swarm', Infinity)[0].outcome).toBe('active')
})

it('does not borrow an unobserved effect through the engine arrival-credit tolerance', () => {
  const { scenario, manifest, result } = mixedTrial()
  const at = 5 + 5e-10
  const view = trialResultOf(scenario, manifest, {
    ...result,
    report: {
      ...result.report,
      events: [
        ...result.report.events,
        trialEvent({ shipIdx: 0, tS: 4, tReleaseS: 4.5, tEffectS: at, lateEffect: false }),
      ],
    },
  })
  expect(trialSnapshotAt(view, 5).counts.arrivedUndefeated).toBe(3)
  expect(trialSnapshotAt(view, at).counts.arrivedUndefeated).toBe(3)
  expect(trialMemberStatesAt(view, 'swarm', at)[0]).toMatchObject({
    outcome: 'hard-kill',
    leakageCredit: true,
    lateEffect: false,
  })
})

it('accepts the actual fixed firing engine result and derives counts from reached removals', async () => {
  const { default: raw } =
    await import('../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json')
  const { parseScenarioData } = await import('../io/persist')
  const scenario = parseScenarioData(raw)
  const manifest = createTrialManifest(
    scenario,
    'adapter-real-firing',
    analysisBasisSignature(scenario),
  )
  const result = runTrial(scenario, manifest)
  const view = trialResultOf(scenario, manifest, result)
  const count = trialSnapshotAt(view, view.durationS).counts
  const reached = result.report.events.filter((e) => e.tEffectS <= view.durationS)
  expect(
    count.preArrivalHardKills +
      count.preArrivalSoftKills +
      count.lateHardKills +
      count.lateSoftKills,
  ).toBe(reached.reduce((sum, e) => sum + e.killDelta, 0))
  expect(view.observations).toBe(result.observations)
})

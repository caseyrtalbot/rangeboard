import { describe, expect, it, vi } from 'vitest'
import { mixedTrial, trialEvent } from '../playback/__fixtures__/trialFixture'
import { trialSeriesOf } from './trialSeries'
import { trialResultOf, trialSnapshotAt } from './trialResult'
import { trialKpisAt } from './liveStats'
import { trialThreatPictureAt } from './threatAggregation'
import { trialSystemTelemetryAt } from './systemTelemetry'
import * as forecast from './impact'
import { createTrialManifest } from '../playback/trialTypes'
import { analysisBasisSignature } from '../state/analysisBasis'

describe('trial series and analysis adapters', () => {
  it('matches realized counts across charts, KPI, threat rows and system telemetry', () => {
    const { view } = mixedTrial()
    const set = trialSeriesOf(view, 10)
    const count = trialSnapshotAt(view, 10).counts
    const kpi = trialKpisAt(view, 10)
    expect(set.kpi.find(s => s.id === 'kpi.expectedKills')!.values.at(-1)).toBe(count.preArrivalHardKills + count.preArrivalSoftKills)
    expect(set.kpi.find(s => s.id === 'kpi.leakerShips')!.values.at(-1)).toBe(count.arrivedUndefeated)
    expect(set.kpi.find(s => s.id === 'kpi.activeMembers')!.values.at(-1)).toBe(count.activeAtHorizon)
    expect(kpi.kills).toBe(3)
    const rows = trialThreatPictureAt(view, 10).flatMap(g => g.members)
    expect(rows.find(r => r.uasId === 'swarm')).toMatchObject({ kills: 4, survivors: 1, hardKillCount: 2, missionKillCount: 2, effectMet: false })
    expect(trialSystemTelemetryAt(view, 10).reduce((sum, g) => sum + g.kills, 0)).toBe(5)
    expect(set.effectors.gun.find(s => s.id === 'rounds')!.values.at(-1)).toBe(6)
    expect(set.effectors.gun.find(s => s.id === 'hits')!.values.at(-1)).toBe(3)
    expect(set.byEffectorType.find(s => s.id === 'jammer.hits')!.values.at(-1)).toBe(2)
    expect(set.bySystem.find(s => s.id === 'system.system-a.kills')!.values.at(-1)).toBe(3)
  })

  it('preserves raw bounds, censors decisions and emits no unreached times or bands', () => {
    const { view } = mixedTrial()
    const set = trialSeriesOf(view, 1.99)
    const lists = [set.kpi, set.residual, set.bySystem, set.byEffectorType,
      ...Object.values(set.sensors), ...Object.values(set.effectors), ...Object.values(set.threats)]
    for (const series of lists.flat()) {
      expect(series.basis).toBe('simulated-trial')
      expect(series.values).toHaveLength(4)
      expect(series.band80).toBeUndefined()
      expect(series.band95).toBeUndefined()
    }
    expect(set.kpi.find(s => s.id === 'kpi.expectedKills')!.values).toEqual([0, 0, 0, 0])
    expect([...set.phase, ...set.engagementLadder].flatMap(row => row.spans).every(span => span.startS <= 1.99 && span.endS <= 1.99)).toBe(true)
    expect(Object.values(set.marks).flat().every(mark => mark.tS <= 1.99)).toBe(true)
    const row = trialThreatPictureAt(view, 1).flatMap(g => g.members).find(r => r.uasId === 'swarm')!
    expect(row).toMatchObject({ status: null, kills: 0, survivors: 5, trackedAtDecision: false, arrivalS: null, firstShotS: null, firstEffectS: null, firstDetectS: null, hostileAtS: null })
    expect(trialSeriesOf(view, 1.99)).toBe(set)
    trialSeriesOf(view, 60)
    expect(trialSeriesOf(view, 1.99).kpi).toEqual(set.kpi)
  })

  it('keeps measured, held and coasting telemetry distinct, without forecast evaluation', () => {
    const spy = vi.spyOn(forecast, 'engagementPicture')
    try {
      const { view } = mixedTrial()
      const sensorAt = (t: number) => trialSystemTelemetryAt(view, t).flatMap(g => g.components).find(c => c.entityId === 'radar')!
      expect(sensorAt(1.1)).toMatchObject({ measuredTracks: 1, heldBetweenScans: 0, coastingTracks: 0 })
      expect(sensorAt(2.5)).toMatchObject({ measuredTracks: 0, heldBetweenScans: 1, coastingTracks: 0 })
      expect(sensorAt(3.5)).toMatchObject({ measuredTracks: 0, heldBetweenScans: 0, coastingTracks: 1, observedThroughS: 3.5 })
      const set = trialSeriesOf(view, 4)
      expect(set.sensors.radar.find(s => s.id === 'slant.swarm')!.values.at(-1)).toBe(50)
      expect(set.sensors.radar.find(s => s.id === 'detections')!.values.at(-1)).toBe(1)
      expect(set.sensors.radar.find(s => s.id === 'falseAlarms')!.values.every(Number.isNaN)).toBe(true)
      expect(spy).not.toHaveBeenCalled()
    } finally { vi.restoreAllMocks() }
  })

  it('keeps no-asset leakage unavailable and excludes tail effects from chart scaling', () => {
    const { scenario, result, manifest } = mixedTrial()
    const tail = trialResultOf(scenario, manifest, { ...result, report: { ...result.report, events: [...result.report.events,
      trialEvent({ shipIdx: 0, tS: 59, tReleaseS: 60, tEffectS: 65, lateEffect: true })] } })
    const set = trialSeriesOf(tail, Infinity)
    expect(set.observedThroughS).toBe(60)
    expect(Math.max(...set.effectors.gun.find(s => s.id === 'hits')!.values)).toBe(3)
    expect(Object.values(set.marks).flat().every(mark => mark.tS <= 60)).toBe(true)
    const noAsset = { ...scenario, entities: scenario.entities.filter(e => e.kind !== 'asset') }
    const nextManifest = createTrialManifest(noAsset, 'no-asset', analysisBasisSignature(noAsset))
    const view = trialResultOf(noAsset, nextManifest, { ...result, manifest: nextManifest })
    expect(trialKpisAt(view, 60).reportedLeakers).toBeNull()
    expect(trialSeriesOf(view, 60).kpi.find(s => s.id === 'kpi.leakerShips')!.values.every(Number.isNaN)).toBe(true)
  })
})

it('keeps a surviving member visible after the separate engine targeting cutoff', () => {
  const mixed = mixedTrial()
  const scenario = { ...mixed.scenario, entities: mixed.scenario.entities.map(e => e.id === 'swarm'
    ? { ...e, formation: { ...e.formation!, count: 21 } } : e) }
  const manifest = createTrialManifest(scenario, 'cutoff-survivor', analysisBasisSignature(scenario))
  const events = Array.from({ length: 20 }, (_, shipIdx) => trialEvent({ tS: 1, tReleaseS: 1.5, tEffectS: 2, shipIdx }))
  const result = { ...mixed.result, manifest, jamDecisions: [], report: { ...mixed.result.report, events,
    threats: mixed.result.report.threats.map(row => row.uasId === 'swarm' ? { ...row, shipCount: 21, firstShotS: 1 } : row) } }
  const view = trialResultOf(scenario, manifest, result)
  const row = trialThreatPictureAt(view, 3).flatMap(group => group.members).find(row => row.uasId === 'swarm')!
  expect(row).toMatchObject({ survivors: 1, kills: 20, effectMet: false, targetableNow: false })
  const set = trialSeriesOf(view, 3)
  expect(set.threats.swarm.find(s => s.id === 'residual')!.values.at(-1)).toBe(1)
  expect(set.threats.swarm.find(s => s.id === 'phase')!.values.at(-1)).not.toBe(6)
})

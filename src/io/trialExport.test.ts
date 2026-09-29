import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Scenario } from '../model/types'
import { beamAndFormationTrial, mixedTrial } from '../playback/__fixtures__/trialFixture'
import { deadTimeOf } from '../playback/deadTimes'
import { runTrial } from '../playback/trial'
import { createTrialManifest } from '../playback/trialTypes'
import { trialResultOf, trialSnapshotAt } from '../analysis/trialResult'
import type { TrialResultView } from '../analysis/trialResult'
import { trialTrackStatesAt } from '../playback/trialTrackState'
import { analysisBasisSignature } from '../state/analysisBasis'
import { engagementPicture } from '../analysis/impact'
import { buildAarSummary } from '../analysis/aar'
import { runReplicates, runSensitivity } from '../playback/mcRun'
import { exportRunRecord, parseScenarioData, runExportObject } from './persist'
import { buildTrialResultGroup, runResultGroups } from './runResultGroups'

function fixture(scenario: Scenario = mixedTrial().scenario) {
  // Capture the same default-filled schema-1 inputs a loaded Board scenario uses.
  scenario = parseScenarioData({
    ...scenario,
    replicates: 4,
    runMode: 'monte-carlo',
    uncertainty: 'total',
  })
  const manifest = createTrialManifest(
    scenario,
    'trial-export-fixed',
    analysisBasisSignature(scenario),
  )
  const result = runTrial(scenario, manifest)
  const view = trialResultOf(scenario, manifest, result)
  const { assessments, report, impacts } = engagementPicture(scenario)
  const summary = buildAarSummary(scenario, assessments, report, impacts)
  const run = {
    id: manifest.runId,
    label: 'RUN-0001',
    sequence: 1,
    startedAt: '2026-09-08T12:00:00Z',
    completedAt: '2026-09-08T12:01:00Z',
    durationS: view.durationS,
    observedThroughS: view.durationS,
  }
  const mc = runReplicates(scenario)
  const sensitivity = runSensitivity(scenario)
  const exportWith = (trial: TrialResultView | null = view) =>
    runExportObject(scenario, run, assessments, report, summary, mc, sensitivity, trial)
  return {
    scenario,
    manifest,
    result,
    view,
    assessments,
    report,
    summary,
    run,
    mc,
    sensitivity,
    exportWith,
  }
}

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('independent trial export group', () => {
  it('passes the optional trial through the downloadable run record', async () => {
    const f = fixture()
    let downloaded: Blob | undefined
    const anchor = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', { createElement: () => anchor })
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      downloaded = blob as Blob
      return 'blob:trial-export'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    exportRunRecord(
      f.scenario,
      f.run,
      f.assessments,
      f.report,
      f.summary,
      f.mc,
      f.sensitivity,
      f.view,
    )
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(anchor.download).toMatch(/\.run-0001\.run\.json$/)
    expect(JSON.parse(await downloaded!.text())).toEqual(json(f.exportWith()))
  })

  it('round-trips all trial facts alongside unchanged forecast, MC and sensitivity payloads', () => {
    const f = fixture()
    const saved = json(f.exportWith())
    const group = saved.resultGroups.trial!
    expect(saved.rangeboardRun).toBe(1)
    expect(group.scenario.schemaVersion).toBe(1)
    expect(group.manifest).toEqual(f.manifest)
    expect(typeof group.manifest.replicateIndex).toBe('number')
    expect(group.manifest.buildRevision).toBeNull()
    expect(group.measures.buildRevision).toBe('Build revision unavailable')
    expect(group.assessments).toEqual(json(f.result.assessments))
    expect(group.attrition).toEqual(json(f.result.report))
    expect(group.observations).toEqual(json(f.result.observations))
    expect(group.jamDecisions).toEqual(f.result.jamDecisions)
    expect(group.members).toEqual(
      json(trialTrackStatesAt(f.view, Infinity).flatMap((t) => t.members)),
    )
    expect(group.counts).toEqual(trialSnapshotAt(f.view, Infinity).counts)
    expect(Object.values(group.counts).every(Number.isInteger)).toBe(true)
    expect(group.summary).toMatchObject({
      status: 'ready',
      counts: group.counts,
      validity: group.validity,
    })
    expect(group.confidenceInterval).toBeNull()
    expect(group.independentlyInstrumented).toBe(false)
    expect(saved.sampledFields!.length).toBeGreaterThan(0)
    const withoutTrial = json(f.exportWith(null))
    const { trial: omitted, ...existingGroups } = saved.resultGroups
    expect(omitted).toBeDefined()
    expect({ ...saved, resultGroups: existingGroups }).toEqual(withoutTrial)
    expect('trial' in saved).toBe(false)
    expect(saved.packageBasis.dataBasisAppliesTo).not.toContain('trial')
    const imported = parseScenarioData(group.scenario)
    expect(analysisBasisSignature(imported)).toBe(f.manifest.basisSignature)
    expect(runTrial(imported, group.manifest).report.events).toEqual(group.attrition.events)
  })

  it('carries no milestone or track quality past a hard kill beside clipped holds', () => {
    const { scenario, manifest, result, ids } = beamAndFormationTrial()
    const view = trialResultOf(scenario, manifest, result)
    const group = json(buildTrialResultGroup(view))
    const exported = (id: string) => group.assessments.find((a) => a.uasId === id)!
    const swept = (id: string) => result.assessments.find((a) => a.uasId === id)!
    for (const id of [ids.de, ids.hpm, ids.formation]) {
      const cut = deadTimeOf(result.report, id)!.tS
      const a = exported(id)
      for (const t of [a.classificationAtS.hostileAtS, a.stableTrackAtS, a.declaredHostileAtS])
        if (t != null) expect(t).toBeLessThanOrEqual(cut)
      expect(swept(id).trackQuality!.totalSamples).toBeGreaterThan(a.trackQuality!.totalSamples)
      expect(a.trackQuality!.lastTrackS!).toBeLessThanOrEqual(cut)
      expect(a.trackQuality!.totalSamples).toBe(Math.floor((cut - a.firstDetectS!) / 0.5) + 1)
      expect(a.trackQuality!.continuity).toBe(
        a.trackQuality!.heldSamples / a.trackQuality!.totalSamples,
      )
    }
    // A mission-killed airframe still flies: its swept quality stands.
    expect(exported(ids.jammed).trackQuality).toEqual(swept(ids.jammed).trackQuality)
  })

  it('preserves mixed member outcomes, no-path disclosure, scan identity and realized leakage after late effects', () => {
    const { view, result } = mixedTrial()
    const group = json(buildTrialResultGroup(view))
    expect(group.attrition.events).toEqual(result.report.events)
    expect(group.observations).toEqual(result.observations)
    expect(group.jamDecisions).toEqual(result.jamDecisions)
    expect(group.population).toEqual({
      trackCount: 3,
      memberCount: 11,
      excludedNoPathIds: ['parked'],
    })
    expect(group.counts).toEqual({
      preArrivalHardKills: 2,
      preArrivalSoftKills: 1,
      lateHardKills: 1,
      lateSoftKills: 1,
      arrivedUndefeated: 3,
      noModelsArrival: 6,
      activeAtHorizon: 6,
      detectedTracks: 1,
      engagedTracks: 2,
      totalTracks: 3,
    })
    expect(group.members.filter((m) => m.leakageCredit)).toHaveLength(3)
    expect(group.measures).toMatchObject({ heldTracks: 1, trackDenominator: 3, reportedLeakers: 3 })
    expect(group.measures['events.tS']).toContain('assignment/accounting')
    expect(group.measures['events.tReleaseS']).toContain('physical release')
    expect(group.measures['events.tEffectS']).toContain('modeled effect')
    expect(group.measures['events.shipIdx']).toContain('actual zero-based member')
    expect(group.measures['observations.members.drawIndex']).toContain('not member identity')
  })

  it('keeps unavailable asset metrics and MC undefined times explicitly null', () => {
    const scenario = mixedTrial().scenario
    scenario.entities = scenario.entities.filter((e) => e.kind !== 'asset')
    const f = fixture(scenario)
    f.mc.firstDetectS = { ...f.mc.firstDetectS, mean: NaN, lo: NaN, hi: NaN, n: 0, total: 4 }
    const out = json(f.exportWith())
    expect(out.resultGroups.trial!.measures).toMatchObject({
      protection: null,
      warningS: null,
      reportedLeakers: null,
    })
    expect(out.mcSummary!.firstDetectS).toMatchObject({
      mean: null,
      lo: null,
      hi: null,
      n: 0,
      total: 4,
    })
    expect(out.resultGroups.trial!.validity.findings.map((finding) => finding.id)).toContain(
      'no-defended-asset',
    )
    expect(out.resultGroups.trial!.validity.findings.map((finding) => finding.id)).not.toContain(
      'planning-envelope',
    )
  })

  it('marks forecast plus trial as mixed while retaining the existing data basis scope', () => {
    const f = fixture()
    const out = runExportObject(
      f.scenario,
      f.run,
      f.assessments,
      f.report,
      f.summary,
      null,
      null,
      f.view,
    )
    expect(out.packageBasis).toEqual({
      semantics: 'mixed-result-groups',
      dataBasisAppliesTo: ['assessments', 'attrition', 'requirements', 'summary'],
    })
    expect(out.dataBasis.semantics).toBe('planning-envelope')
  })

  it('discloses null asset metrics without rewriting an inconsistent retained engine report', () => {
    const f = mixedTrial()
    const scenario = {
      ...f.scenario,
      entities: f.scenario.entities.map((e) => (e.kind === 'asset' ? { ...e, enabled: false } : e)),
    }
    const manifest = createTrialManifest(
      scenario,
      f.manifest.runId,
      analysisBasisSignature(scenario),
    )
    const view = trialResultOf(scenario, manifest, { ...f.result, manifest })
    const group = json(buildTrialResultGroup(view))
    expect(group.attrition).toEqual(f.result.report)
    expect(group.attrition.totals.reportedLeakers).toBe(3)
    expect(group.measures).toMatchObject({
      reportedLeakers: null,
      protection: null,
      warningS: null,
    })
  })

  it('rejects mismatched package identity and configuration, including direct group calls', () => {
    const f = fixture()
    expect(() => f.exportWith({ ...f.view, manifest: { ...f.manifest, runId: 'wrong' } })).toThrow(
      'run id',
    )
    expect(() =>
      f.exportWith({ ...f.view, manifest: { ...f.manifest, basisSignature: 'wrong' } }),
    ).toThrow('basis signature')
    expect(() =>
      runResultGroups(
        { ...f.scenario, seed: f.manifest.seed + 1 },
        f.assessments,
        f.report,
        null,
        null,
        f.view,
      ),
    ).toThrow('basis signature')
    expect(() =>
      f.exportWith({
        ...f.view,
        result: { ...f.result, manifest: { ...f.manifest, runId: 'wrong' } },
      }),
    ).toThrow('mismatched')
  })

  it('rejects incomplete retained observation, package completion and member ledgers', () => {
    const f = fixture()
    expect(() => f.exportWith({ ...f.view, observedThroughS: f.view.durationS - 1 })).toThrow(
      'incomplete',
    )
    expect(() => f.exportWith({ ...f.view, result: { ...f.result, assessments: [] } })).toThrow(
      'Incomplete',
    )
    expect(() =>
      f.exportWith({
        ...f.view,
        result: { ...f.result, report: { ...f.result.report, threats: [] } },
      }),
    ).toThrow('Incomplete')
    for (const run of [
      { ...f.run, completedAt: '' },
      { ...f.run, observedThroughS: 0 },
      { ...f.run, durationS: f.run.durationS + 1 },
      { ...f.run, observedThroughS: NaN },
    ]) {
      expect(() =>
        runExportObject(f.scenario, run, f.assessments, f.report, f.summary, null, null, f.view),
      ).toThrow('incomplete')
    }
  })
})

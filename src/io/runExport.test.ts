import { describe, expect, it } from 'vitest'
import probe from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { parseAutosave, runExportObject } from './persist'
import { parseRunRecordPackage, runRecordExportObject } from './runRecordPackage'
import type { RunRecord } from '../model/runRecord'
import { createRunManifest } from '../model/runRecord'
import { engagementPicture } from '../analysis/impact'
import { buildAarSummary } from '../analysis/aar'
import { runReplicates, runSensitivity } from '../playback/mcRun'
import { analysisBasisSignature } from '../state/analysisBasis'

function fixture() {
  const scenario = parseAutosave(JSON.stringify(probe))!
  scenario.runMode = 'monte-carlo'
  scenario.replicates = 4
  const { assessments, report, impacts } = engagementPicture(scenario)
  const summary = buildAarSummary(scenario, assessments, report, impacts)
  const mc = runReplicates(scenario)
  const run = {
    id: 'export-basis-check', label: 'RUN-0001', sequence: 1,
    startedAt: '2026-09-05T16:00:00Z', completedAt: '2026-09-05T16:10:00Z',
    durationS: mc.durationS, observedThroughS: mc.durationS,
  }
  return { scenario, assessments, report, summary, mc, run }
}

describe('run group basis and import compatibility', () => {
  it('keeps distinct deterministic and MC results without assigning one basis to both', () => {
    const f = fixture()
    const out = runExportObject(f.scenario, f.run, f.assessments, f.report, f.summary, f.mc)
    expect(f.report.totals.expectedKills).not.toBe(f.mc.kills.mean.at(-1))
    expect(out.attrition).toBe(f.report)
    expect(out.mcSummary).toBe(f.mc)
    expect(out.packageBasis).toEqual({ semantics: 'mixed-result-groups', dataBasisAppliesTo: ['mcSummary'] })
    expect(out.resultGroups.attrition.basis).toBe('planning-envelope')
    expect(out.resultGroups.mcSummary?.basis).toBe('monte-carlo-estimate')
    expect(out.resultGroups.requirements.validity.findings.map(x => x.id)).toContain('planning-envelope')
    expect(out.requirements.basis).toBe('planning-envelope')
    expect(out.configuration.analysisBasisSignature).toBe(analysisBasisSignature(f.scenario))
    // The embedded scenario remains a valid standalone import with identical analysis identity.
    const saved = JSON.parse(JSON.stringify(out))
    expect(analysisBasisSignature(parseAutosave(JSON.stringify(saved.scenario))!))
      .toBe(out.configuration.analysisBasisSignature)
    f.scenario.requirements.maxResidualPerTrack = 0.02
    expect(analysisBasisSignature(f.scenario)).not.toBe(out.configuration.analysisBasisSignature)
  })

  it('qualifies total-MC requirement payloads with the same envelope findings as their group', () => {
    const f = fixture()
    f.scenario.uncertainty = 'total'
    const out = runExportObject(f.scenario, f.run, f.assessments, f.report, f.summary, f.mc)
    const modelFinding = out.resultGroups.requirements.validity.findings
      .find(finding => finding.id === 'unvalidated-model')!
    expect(out.validity.findings.find(finding => finding.id === 'unvalidated-model')?.message)
      .toContain('Parameter spread')
    expect(modelFinding.message).not.toContain('Parameter spread')
    for (const gate of out.requirements.gates) {
      expect(gate.caveats).toContain(modelFinding.message)
      expect(gate.caveats.join(' ')).not.toContain('Parameter spread')
    }
  })

  it('exports envelope-only groups until a current replicate summary is supplied', () => {
    const f = fixture()
    const out = runExportObject(f.scenario, f.run, f.assessments, f.report, f.summary)
    expect(out.scenario.runMode).toBe('monte-carlo')
    expect(out.packageBasis.semantics).toBe('planning-envelope')
    expect(out.resultGroups.mcSummary).toBeUndefined()
    expect(out.resultGroups.sensitivity).toBeUndefined()
    expect(out.dataBasis.semantics).toBe('planning-envelope')
  })

  it('preserves undefined/single-sample time statistics across JSON without a claimed CI', () => {
    const f = fixture()
    f.mc.firstDetectS = { ...f.mc.firstDetectS, mean: NaN, lo: NaN, hi: NaN, n: 0, total: 4 }
    f.mc.minWarningS = { ...f.mc.minWarningS, mean: 12, lo: 12, hi: 12, n: 1, total: 4 }
    const out = JSON.parse(JSON.stringify(runExportObject(
      f.scenario, f.run, f.assessments, f.report, f.summary, f.mc,
    )))
    expect(out.mcSummary.firstDetectS).toMatchObject({ mean: null, lo: null, hi: null, n: 0, total: 4 })
    expect(out.mcSummary.minWarningS).toMatchObject({ mean: 12, n: 1, total: 4 })
    expect(out.resultGroups.mcSummary.measures['lo, hi, interval']).toContain('interval on the mean by method')
    expect(out.resultGroups.mcSummary.measures['p10, p90, p025, p975']).toContain('replicate quantiles')
    expect(out.resultGroups.mcSummary.measures['p10, p90, p025, p975']).toContain('unavailable under 10')
  })

  it('records non-unit raid denominators, no-asset definedness and late-effect distinctions', () => {
    const f = fixture()
    f.scenario = { ...f.scenario, entities: f.scenario.entities.filter(e => e.kind !== 'asset')
      .map(e => e.kind === 'uas'
        ? { ...e, formation: { count: 4, shape: 'line', spacingM: 5 } } : e) }
    const { assessments, report, impacts } = engagementPicture(f.scenario)
    const mc = runReplicates(f.scenario)
    const out = runExportObject(f.scenario, f.run, assessments, report,
      buildAarSummary(f.scenario, assessments, report, impacts), mc)
    expect(out.resultGroups.mcSummary?.measures.raidSize).toBe(4)
    expect(out.resultGroups.mcSummary?.measures.leakersDefined).toBe(false)
    expect(out.attrition.totals.reportedLeakers).toBeNull()
    expect(out.summary.expectedLeakers).toBe(report.totals.expectedLeakers + report.totals.expectedNoArrival)
    expect(out.resultGroups.mcSummary?.measures['perEffector.kills']).toContain('including late effects')
    expect(out.resultGroups.mcSummary?.measures.defeatInterval).toContain('in percent')
  })

  it('identifies sensitivity endpoints as paired parameter perturbations, not intervals', () => {
    const f = fixture()
    const sensitivity = runSensitivity(f.scenario)
    const out = runExportObject(f.scenario, f.run, f.assessments, f.report, f.summary, f.mc, sensitivity)
    expect(out.sensitivity).toBe(sensitivity)
    expect(out.resultGroups.sensitivity?.basis).toBe('paired-one-at-a-time')
    expect(out.resultGroups.sensitivity?.measures['rows.low, rows.high']).toContain('parameter p10/p90')
    expect(out.resultGroups.sensitivity?.measures.interval).toContain('no mean confidence interval')
  })
})

describe('run export physical launch timing', () => {
  it('preserves new ledger timing and identifies assignment, release, effect and shipIdx', () => {
    const f = fixture()
    expect(f.report.events.length).toBeGreaterThan(0)
    expect(f.report.events.every(event => event.tReleaseS != null)).toBe(true)
    const out = runExportObject(f.scenario, f.run, f.assessments, f.report, f.summary)
    const saved = JSON.parse(JSON.stringify(out))
    expect(saved.attrition.events).toEqual(f.report.events)
    const measures = out.resultGroups.attrition.measures
    expect(measures['events.tS']).toContain('assignment time')
    expect(measures['events.tReleaseS']).toContain('physical release time')
    expect(measures['events.tEffectS']).toContain('effect time')
    expect(measures['events.shipIdx']).toContain('zero-based member index')
    expect(measures['events.shipIndex']).toBeUndefined()
    expect(measures.releaseTimingRecordedEvents).toBe(f.report.events.length)
    expect(measures.releaseTimingReconstructableEvents).toBe(0)
    expect(measures.releaseTimingUnavailableEvents).toBe(0)
  })

  it('preserves omitted legacy fields and distinguishes reconstructable from unavailable release', () => {
    const f = fixture()
    const legacy = { ...f.report, events: f.report.events.map(event => {
      const copy = { ...event }
      delete copy.tReleaseS
      return copy
    }) }
    const known = runExportObject(f.scenario, f.run, f.assessments, legacy, f.summary)
    expect(known.resultGroups.attrition.measures.releaseTimingRecordedEvents).toBe(0)
    expect(known.resultGroups.attrition.measures.releaseTimingReconstructableEvents).toBe(legacy.events.length)
    expect(known.resultGroups.attrition.measures.releaseTimingUnavailableEvents).toBe(0)
    const withoutEffector = { ...f.scenario, entities: f.scenario.entities.filter(entity => entity.kind !== 'effector') }
    const unknown = runExportObject(withoutEffector, f.run, f.assessments, legacy, f.summary)
    const measures = unknown.resultGroups.attrition.measures
    expect(measures.releaseTimingReconstructableEvents).toBe(0)
    expect(measures.releaseTimingUnavailableEvents).toBe(legacy.events.length)
    expect(measures.releaseTiming).toContain('launch timing is unavailable')
    expect(JSON.parse(JSON.stringify(known)).attrition.events).toEqual(legacy.events)
    expect(JSON.parse(JSON.stringify(unknown)).attrition.events).toEqual(legacy.events)
    expect(legacy.events.every(event => !('tReleaseS' in event))).toBe(true)
  })
})

describe('saved run record round trip', () => {
  function record(): RunRecord {
    const f = fixture()
    const hash = analysisBasisSignature(f.scenario)
    return {
      id: 'run-round-trip', savedAt: '2026-09-15T12:00:00.000Z', label: 'Camp Able · saved',
      manifest: createRunManifest(f.scenario, f.run.id, hash),
      scenario: f.scenario, scenarioHash: hash, mc: f.mc, sensitivity: runSensitivity(f.scenario),
    }
  }

  it('returns an equal record through the export builder and the import parser', () => {
    const saved = record()
    expect(saved.sensitivity!.rows.length).toBeGreaterThan(0)
    // The file is what a download writes: JSON, so every NaN statistic is null on the way out.
    const file = JSON.parse(JSON.stringify(runRecordExportObject(saved)))
    expect(file.rangeboardRunRecord).toBe(1)
    expect(parseRunRecordPackage(file)).toEqual(saved)
    // A bare record, the shape a hand-written or store-dumped file carries, reads the same.
    expect(parseRunRecordPackage(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })

  it('refuses a debrief export, which carries no run manifest', () => {
    const f = fixture()
    const debrief = JSON.parse(JSON.stringify(runExportObject(f.scenario, f.run, f.assessments, f.report, f.summary, f.mc)))
    expect(() => parseRunRecordPackage(debrief)).toThrow(/no run manifest/)
  })

  it('names the field a malformed record fails on', () => {
    const saved = JSON.parse(JSON.stringify(runRecordExportObject(record())))
    const broken = (patch: (r: Record<string, unknown>) => void) => {
      const copy = JSON.parse(JSON.stringify(saved))
      patch(copy.record)
      return () => parseRunRecordPackage(copy)
    }
    expect(broken(r => { delete r.scenarioHash })).toThrow('runRecord.scenarioHash: expected a nonempty string')
    expect(broken(r => { (r.manifest as Record<string, unknown>).producer = 'worker' }))
      .toThrow('runRecord.manifest.producer: expected one of browser, cli')
    expect(broken(r => { (r.manifest as Record<string, unknown>).physicsSwitches = ['noSuchSwitch'] }))
      .toThrow('runRecord.manifest.physicsSwitches[0]: expected one of')
    expect(broken(r => { (r.mc as Record<string, unknown>).seed = null })).toThrow('runRecord.mc.seed')
  })
})

import { describe, expect, it } from 'vitest'
import probe from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { parseAutosave, runExportObject } from './persist'
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
    expect(out.resultGroups.mcSummary.measures['lo, hi']).toContain('unavailable with n<2')
    expect(out.resultGroups.mcSummary.measures['p10, p90, p025, p975']).toContain('replicate quantiles')
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
    expect(out.resultGroups.mcSummary?.measures.defeatInterval).toContain('percentage points')
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

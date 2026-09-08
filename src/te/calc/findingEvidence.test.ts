/**
 * Finding evidence resolution on the seed campaign: linked-run scope,
 * inclusion policy, actual-record precedence, derived text and fills.
 */

import { describe, expect, it } from 'vitest'
import type { TeCampaign, TeFinding } from '../model/types'
import { emptyFinding } from '../model/empty'
import { buildJiatf401 } from '../seed/jiatf401'
import { computeMeasure } from './measures'
import {
  derivedRunConfig,
  derivedRunLinks,
  evidenceDerivation,
  evidenceFills,
  findingComputations,
  findingLinkUpdate,
  resolveFindingEvidence,
} from './findingEvidence'

const c: TeCampaign = buildJiatf401()
const runId = (n: number) => `VLK-J401-RUN-${String(n).padStart(4, '0')}`
const finding = (patch: Partial<TeFinding>): TeFinding => ({ ...emptyFinding('F-test'), ...patch })

describe('linked-run scope and inclusion policy', () => {
  it('scopes statistics to the linked runs', () => {
    const f = finding({ measureIds: ['VLK-J401-M-001'], supportingRunIds: [runId(1), runId(2)] })
    const [comp] = findingComputations(c, f)
    expect(comp).toEqual(computeMeasure({ ...c, runs: c.runs.filter((r) => f.supportingRunIds.includes(r.id)) }, 'VLK-J401-M-001'))
    expect(comp.nIncluded).toBe(2)
    expect(findingComputations(c, { ...f, supportingRunIds: [] })[0].estimate).toBeNull()
  })

  it('counts only permitted evidence from invalid and conditional runs', () => {
    const invalid = finding({ measureIds: ['VLK-J401-M-001'], supportingRunIds: [runId(5)] })
    expect(findingComputations(c, invalid)[0]).toMatchObject({ nIncluded: 0, nValid: 0, estimate: null })
    const conditional = finding({ measureIds: ['VLK-J401-M-001', 'VLK-J401-M-004'], supportingRunIds: [runId(10)] })
    const [m1, m4] = findingComputations(c, conditional)
    expect(m1.nIncluded).toBe(0)
    expect(m4).toMatchObject({ nIncluded: 1, estimate: 2271 })
  })
})

describe('actual-record precedence', () => {
  it('lets actual threat, condition and configuration override the card', () => {
    const run = { ...c.runs[0], actualThreatId: 'THR-actual', actualConditionId: null, actualConfigId: 'CFG-actual' }
    const campaign = { ...c, runs: [run, ...c.runs.slice(1)] }
    const f = finding({ supportingRunIds: [run.id], contradictingRunIds: [runId(2)] })
    expect(derivedRunLinks(campaign, f)).toEqual({
      threatIds: ['THR-actual', 'VLK-J401-THR-001'],
      conditionIds: ['VLK-J401-COND-001'],
    })
    expect(derivedRunConfig(campaign, [run.id])).toBe('CFG-actual')
    expect(derivedRunConfig(campaign, [run.id, runId(2)])).toBeNull()
    expect(derivedRunConfig(c, [runId(1), runId(2)])).toBe('VLK-J401-CFG-001')
  })
})

describe('derived text', () => {
  it('keeps units, intervals, denominators and the threshold policy in the text', () => {
    const f = finding({
      measureIds: ['VLK-J401-M-001', 'VLK-J401-M-004'],
      supportingRunIds: [runId(1), runId(2), runId(5)],
      configId: 'VLK-J401-CFG-001',
      threatIds: ['VLK-J401-THR-001'],
      hypothesisId: 'VLK-J401-HYP-001',
    })
    const d = evidenceDerivation(c, f)
    expect(d.quantifiedResult).toMatch(/^VLK-J401-M-001 .*: 81\.5 s \[.*\] \(exact\), n=2$/m)
    expect(d.thresholdComparison).toContain('VLK-J401-M-001: estimate 81.5 vs threshold 90 s (')
    expect(d.thresholdComparison).toContain('VLK-J401-M-004: characterization only; no customer-approved threshold')
    expect(d.sampleAndIndependence).toContain('VLK-J401-M-001: 2 included of 3 attempted; unit: One independently reset threat presentation')
    expect(d.uncertaintyNote).toMatch(/^VLK-J401-M-001: \[.*\] \(exact\)/)
    expect(d.missingAndExcludedData).toContain('Across 3 linked run(s): 0 missing, 2 invalid, 0 censored observation(s); 0 excluded run(s).')
    expect(d.missingAndExcludedData).toContain(`${runId(5)}: invalid`)
    expect(d.appliesTo).toMatch(/^configuration .* v\d/)
    expect(d.comparisonWithPrediction).toMatch(/^Predicted: .*\. Observed: VLK-J401-M-001 81\.5 s, VLK-J401-M-004 .* m\.$/)
  })

  it('fills only empty fields and leaves judgments alone', () => {
    const f = finding({ measureIds: ['VLK-J401-M-001'], supportingRunIds: [runId(1)], quantifiedResult: 'My own words' })
    const fills = evidenceFills(c, f)
    expect(fills.quantifiedResult).toBeUndefined()
    expect(fills.sampleAndIndependence).toBe('VLK-J401-M-001: 1 included of 1 attempted; unit: One independently reset threat presentation')
    expect(fills).not.toHaveProperty('strength')
    expect(fills).not.toHaveProperty('appliesTo')
    const resolved = resolveFindingEvidence(c, f)
    expect(resolved.fills).toEqual(fills)
    expect(resolved.derivation.quantifiedResult).not.toBe('My own words')
    expect(resolved.computations).toHaveLength(1)
  })
})

describe('findingLinkUpdate', () => {
  it('builds one patch from a question pick with unambiguous chained records', () => {
    const one = findingLinkUpdate(c, finding({}), { questionId: 'VLK-J401-Q-005' })
    expect(one).toMatchObject({ questionId: 'VLK-J401-Q-005', hypothesisId: 'VLK-J401-HYP-005', measureIds: ['VLK-J401-M-010'] })
    const two = findingLinkUpdate(c, finding({}), { questionId: 'VLK-J401-Q-002' })
    expect(two.measureIds).toBeUndefined()
    expect(two.claimId).toBeUndefined()
    const kept = findingLinkUpdate(c, finding({ hypothesisId: 'VLK-J401-HYP-001' }), { questionId: 'VLK-J401-Q-005' })
    expect(kept.hypothesisId).toBeUndefined()
  })

  it('builds one patch from a run pick: configuration, threat, condition and evidence text', () => {
    const f = finding({ measureIds: ['VLK-J401-M-001'] })
    const patch = findingLinkUpdate(c, f, { supportingRunIds: [runId(1), runId(2)] })
    expect(patch).toMatchObject({
      supportingRunIds: [runId(1), runId(2)],
      configId: 'VLK-J401-CFG-001',
      threatIds: ['VLK-J401-THR-001'],
      conditionIds: ['VLK-J401-COND-001'],
    })
    expect(patch.quantifiedResult).toContain('n=2')
    expect(patch.appliesTo).toContain('configuration')
    expect(patch).not.toHaveProperty('strength')
    const explicit = findingLinkUpdate(c, finding({ configId: 'CFG-mine', threatIds: ['THR-mine'] }), { contradictingRunIds: [runId(1)] })
    expect(explicit.configId).toBeUndefined()
    expect(explicit.threatIds).toBeUndefined()
    expect(explicit.conditionIds).toEqual(['VLK-J401-COND-001'])
  })
})

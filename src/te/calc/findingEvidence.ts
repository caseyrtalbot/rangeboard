/**
 * Finding evidence resolution. Pure. Owns the linked-run scope of a
 * finding's statistics, actual-record precedence over card plans, the
 * inclusion policy through `computeMeasure`, and the derived evidence text.
 * Derivation only proposes: fills touch empty fields, and judgments
 * (strength, dispositions) are never written here.
 */

import type { TeCampaign, TeFinding } from '../model/types'
import { runEvidenceLabel } from '../validate'
import { computeMeasure } from './measures'
import type { MeasureComputation } from './measures'

function fmtNum(n: number): number {
  return Math.round(n * 1000) / 1000
}

function measureSummary(c: MeasureComputation): string {
  const estimate =
    c.estimate === null ? 'no estimate' : `${fmtNum(c.estimate)}${c.unit ? ` ${c.unit}` : ''}`
  const interval = c.interval
    ? ` [${fmtNum(c.interval.lo)}, ${fmtNum(c.interval.hi)}] (${c.interval.method})`
    : ''
  return `${c.measureId} ${c.name || 'unnamed'}: ${estimate}${interval}, n=${c.nIncluded}`
}

function linkedRunIds(f: TeFinding): string[] {
  return [...new Set([...f.supportingRunIds, ...f.contradictingRunIds])]
}

/** Computations for every measure the finding links, scoped to its linked runs. */
export function findingComputations(campaign: TeCampaign, f: TeFinding): MeasureComputation[] {
  const ids = new Set(linkedRunIds(f))
  const linked = { ...campaign, runs: campaign.runs.filter((r) => ids.has(r.id)) }
  return f.measureIds
    .map((id) => computeMeasure(linked, id))
    .filter((c): c is MeasureComputation => c !== null)
}

/** Threat and condition defaults from the linked runs (actual records win over the card). */
export function derivedRunLinks(
  campaign: TeCampaign,
  f: TeFinding,
): { threatIds: string[]; conditionIds: string[] } {
  const runs = linkedRunIds(f)
    .map((id) => campaign.runs.find((r) => r.id === id))
    .filter((r) => r !== undefined)
  const threatIds = new Set<string>()
  const conditionIds = new Set<string>()
  for (const r of runs) {
    const card = campaign.cards.find((x) => x.id === r.cardId)
    const t = r.actualThreatId ?? card?.threatId ?? null
    const cond = r.actualConditionId ?? card?.conditionId ?? null
    if (t) threatIds.add(t)
    if (cond) conditionIds.add(cond)
  }
  return { threatIds: [...threatIds], conditionIds: [...conditionIds] }
}

/** The one configuration the linked runs ran, or null when absent or ambiguous. */
export function derivedRunConfig(campaign: TeCampaign, runIds: string[]): string | null {
  const configIds = new Set<string>()
  for (const id of runIds) {
    const r = campaign.runs.find((x) => x.id === id)
    if (!r) continue
    const cfg = r.actualConfigId ?? campaign.cards.find((c) => c.id === r.cardId)?.configId ?? null
    if (cfg) configIds.add(cfg)
  }
  return configIds.size === 1 ? [...configIds][0] : null
}

export const EVIDENCE_TEXT_FIELDS = [
  'quantifiedResult',
  'thresholdComparison',
  'sampleAndIndependence',
  'uncertaintyNote',
  'missingAndExcludedData',
  'appliesTo',
  'doesNotApplyTo',
  'comparisonWithPrediction',
] as const

export type EvidenceTextField = (typeof EVIDENCE_TEXT_FIELDS)[number]

/** Derived text per evidence field; '' where the links give nothing. */
export type EvidenceDerivation = Record<EvidenceTextField, string>

/** Current derivation for every evidence field, ignoring stored text. */
export function evidenceDerivation(campaign: TeCampaign, f: TeFinding): EvidenceDerivation {
  const comps = findingComputations(campaign, f)
  const out: EvidenceDerivation = {
    quantifiedResult: comps.map(measureSummary).join('\n'),
    thresholdComparison: comps
      .filter((c) => c.estimate !== null)
      .map((c) => {
        const m = campaign.measures.find((x) => x.id === c.measureId)
        if (!m) return ''
        if (!c.thresholdShown || m.threshold === null) {
          return `${c.measureId}: characterization only; no customer-approved threshold`
        }
        return `${c.measureId}: estimate ${fmtNum(c.estimate!)} vs threshold ${m.threshold}${m.unit ? ` ${m.unit}` : ''} (${c.label})`
      })
      .filter((t) => t !== '')
      .join('\n'),
    sampleAndIndependence: comps
      .map((c) => {
        const m = campaign.measures.find((x) => x.id === c.measureId)
        const unitText = m && m.experimentalUnit.trim() !== '' ? `; unit: ${m.experimentalUnit}` : ''
        return `${c.measureId}: ${c.nIncluded} included of ${c.nAttempted} attempted${unitText}`
      })
      .join('\n'),
    uncertaintyNote: comps
      .filter((c) => c.interval !== null)
      .map(
        (c) =>
          `${c.measureId}: [${fmtNum(c.interval!.lo)}, ${fmtNum(c.interval!.hi)}] (${c.interval!.method})`,
      )
      .join('\n'),
    missingAndExcludedData: '',
    appliesTo: '',
    doesNotApplyTo: '',
    comparisonWithPrediction: '',
  }
  const linkedRuns = linkedRunIds(f)
    .map((id) => campaign.runs.find((r) => r.id === id))
    .filter((r) => r !== undefined)
  if (linkedRuns.length > 0) {
    let missing = 0
    let invalid = 0
    let censored = 0
    for (const r of linkedRuns) {
      for (const o of r.observations) {
        if (f.measureIds.length > 0 && !f.measureIds.includes(o.measureId)) continue
        if (o.status === 'missing') missing++
        if (o.status === 'invalid') invalid++
        if (o.status === 'censored') censored++
      }
    }
    const excluded = linkedRuns.filter((r) => r.excluded).length
    out.missingAndExcludedData =
      `Across ${linkedRuns.length} linked run(s): ${missing} missing, ${invalid} invalid, ${censored} censored observation(s); ${excluded} excluded run(s).\n` +
      linkedRuns.map((r) => `${r.id}: ${runEvidenceLabel(r)}`).join('\n')
  }
  const config = campaign.configs.find((x) => x.id === f.configId)
  const threats = f.threatIds
    .map((id) => campaign.threats.find((t) => t.id === id))
    .filter((t) => t !== undefined)
  const conds = f.conditionIds
    .map((id) => campaign.conditions.find((x) => x.id === id))
    .filter((x) => x !== undefined)
  out.appliesTo = [
    config ? `configuration ${config.name || config.id} ${config.version}` : '',
    ...threats.map((t) => t.name || t.id),
    ...conds.map((x) => x.name || x.id),
    ...threats.map((t) => t.permittedGeneralization),
    ...conds.map((x) => x.permittedGeneralization),
  ]
    .filter((t) => t.trim() !== '')
    .join('; ')
  out.doesNotApplyTo = [
    ...threats.map((t) => t.prohibitedGeneralization),
    ...conds.map((x) => x.prohibitedGeneralization),
  ]
    .filter((t) => t.trim() !== '')
    .join('; ')
  const hyp = campaign.hypotheses.find((h) => h.id === f.hypothesisId)
  if (hyp) {
    const observed = comps
      .filter((c) => c.estimate !== null)
      .map((c) => `${c.measureId} ${fmtNum(c.estimate!)}${c.unit ? ` ${c.unit}` : ''}`)
      .join(', ')
    out.comparisonWithPrediction = `Predicted: ${hyp.predictedValue || 'no prediction recorded'}. Observed: ${observed || 'no estimate'}.`
  }
  return out
}

/** Derived text for the evidence fields that are still empty. */
export function evidenceFills(campaign: TeCampaign, f: TeFinding): Partial<TeFinding> {
  const derived = evidenceDerivation(campaign, f)
  const patch: Partial<TeFinding> = {}
  for (const key of EVIDENCE_TEXT_FIELDS) {
    if (derived[key].trim() !== '' && f[key].trim() === '') patch[key] = derived[key]
  }
  return patch
}

export interface FindingEvidence {
  computations: MeasureComputation[]
  derivation: EvidenceDerivation
  fills: Partial<TeFinding>
}

/** Statistics, full derivation and permitted empty-field fills for one finding. */
export function resolveFindingEvidence(campaign: TeCampaign, f: TeFinding): FindingEvidence {
  return {
    computations: findingComputations(campaign, f),
    derivation: evidenceDerivation(campaign, f),
    fills: evidenceFills(campaign, f),
  }
}

/** The link fields a finding carries. */
export type FindingLinks = Partial<
  Pick<
    TeFinding,
    | 'questionId'
    | 'claimId'
    | 'hypothesisId'
    | 'configId'
    | 'supportingRunIds'
    | 'contradictingRunIds'
    | 'threatIds'
    | 'conditionIds'
    | 'measureIds'
  >
>

/**
 * One patch for a link change: the links, the unambiguous chained records a
 * question or run pick implies, run-derived threat and condition defaults,
 * and derived evidence text. Every fill lands only in an empty field.
 */
export function findingLinkUpdate(campaign: TeCampaign, f: TeFinding, links: FindingLinks): Partial<TeFinding> {
  const patch: Partial<TeFinding> = { ...links }
  const q = links.questionId
  if (q) {
    const hyps = campaign.hypotheses.filter((h) => h.questionId === q)
    if (hyps.length === 1 && !f.hypothesisId && patch.hypothesisId === undefined) patch.hypothesisId = hyps[0].id
    const claimIds = [...new Set(hyps.map((h) => h.claimId).filter((x): x is string => x !== null))]
    if (claimIds.length === 1 && !f.claimId && patch.claimId === undefined) patch.claimId = claimIds[0]
    const ms = campaign.measures.filter((m) => m.questionId === q)
    if (ms.length === 1 && f.measureIds.length === 0 && patch.measureIds === undefined) patch.measureIds = [ms[0].id]
  }
  const runsChanged = links.supportingRunIds !== undefined || links.contradictingRunIds !== undefined
  const merged: TeFinding = { ...f, ...patch }
  if (links.supportingRunIds !== undefined && !merged.configId) {
    const cfg = derivedRunConfig(campaign, merged.supportingRunIds)
    if (cfg) patch.configId = cfg
  }
  if (runsChanged) {
    const d = derivedRunLinks(campaign, merged)
    if (merged.threatIds.length === 0 && d.threatIds.length > 0) patch.threatIds = d.threatIds
    if (merged.conditionIds.length === 0 && d.conditionIds.length > 0) patch.conditionIds = d.conditionIds
  }
  return { ...patch, ...evidenceFills(campaign, { ...f, ...patch }) }
}

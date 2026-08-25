/**
 * Validation gates: the pocket rules and ordering rules rendered as hard
 * blockers or structured warnings (MASTER-DATAMODEL 4.7, MASTER-FORMS 5).
 * Blockers stop an action. Warnings render on gate dashboards.
 */

import type { TeCampaign, TeCard, TeFinding, TeRun } from './model/types'

export interface GateWarning {
  level: 'block' | 'warn'
  text: string
}

/** Unresolved [bracketed placeholder] text blocks card issue. */
export function hasPlaceholder(text: string): boolean {
  return /\[[^\]]*\]/.test(text)
}

/**
 * Template patches carry example link IDs and [placeholder] IDs. Keep only
 * links that resolve to records in this campaign; drop the rest so the
 * card-issue gate sees them as missing, not as satisfied.
 */
export function sanitizeCardTemplatePatch(
  c: TeCampaign,
  patch: Partial<TeCard>,
): Partial<TeCard> {
  const out = { ...patch }
  delete out.cardCode // the allocator's campaign-scoped code stands
  if (out.version && hasPlaceholder(out.version)) delete out.version
  if (out.questionIds)
    out.questionIds = out.questionIds.filter((id) => c.questions.some((x) => x.id === id))
  if (out.hypothesisIds)
    out.hypothesisIds = out.hypothesisIds.filter((id) => c.hypotheses.some((x) => x.id === id))
  if (out.measureIds)
    out.measureIds = out.measureIds.filter((id) => c.measures.some((x) => x.id === id))
  if (out.configId && !c.configs.some((x) => x.id === out.configId)) out.configId = null
  if (out.threatId && !c.threats.some((x) => x.id === out.threatId)) out.threatId = null
  if (out.conditionId && !c.conditions.some((x) => x.id === out.conditionId)) out.conditionId = null
  if (out.matrixCellId && !c.matrix.some((x) => x.id === out.matrixCellId)) out.matrixCellId = null
  if (out.linkedEntityIds) out.linkedEntityIds = out.linkedEntityIds.filter((id) => !hasPlaceholder(id))
  return out
}

/** Blockers that keep a card from advancing to issued. */
export function cardIssueBlockers(c: TeCampaign, card: TeCard): string[] {
  const out: string[] = []
  if (!card.title.trim()) out.push('Card has no title.')
  if (!card.purpose.trim()) out.push('Card has no purpose sentence.')
  if (card.questionIds.length === 0 || !c.questions.some((x) => x.id === card.questionIds[0]))
    out.push('Card links no question. No orphan runs.')
  if (card.measureIds.length === 0) out.push('Card links no measure.')
  if (!card.configId || !c.configs.some((x) => x.id === card.configId))
    out.push('Card links no configuration baseline. No configuration record, no comparison.')
  if (!card.threatId || !c.threats.some((x) => x.id === card.threatId))
    out.push('Card links no threat profile.')
  if (!card.conditionId) out.push('Card links no condition.')
  if (card.procedure.length === 0) out.push('Card has no procedure steps.')
  for (const step of card.procedure) {
    if (!step.action.trim()) out.push('A procedure step has no action.')
    if (!step.observableCompletion.trim())
      out.push(`Step "${step.action.slice(0, 40)}" has no observable completion criterion.`)
  }
  if (!card.coldReaderAt) out.push('Cold-reader check is not recorded.')
  if (card.coldReaderAt && !card.coldReaderBy.trim()) out.push('Cold-reader name is missing.')
  if (!card.dryRunAt) out.push('Dry-run check is not recorded.')
  if (card.dryRunAt && !card.dryRunBy.trim()) out.push('Dry-run lead name is missing.')
  const placeholderFields: Array<[string, string]> = [
    ['purpose', card.purpose],
    ['prediction', card.prediction],
    ['red initial state', card.redInitialState],
    ['expected result', card.expectedResult],
  ]
  for (const [name, value] of placeholderFields) {
    if (hasPlaceholder(value)) out.push(`Unresolved [placeholder] in ${name}.`)
  }
  const config = c.configs.find((x) => x.id === card.configId)
  if (config && !config.frozen) out.push('Configuration baseline is not frozen.')
  for (const mid of card.measureIds) {
    const m = c.measures.find((x) => x.id === mid)
    if (m && !m.frozen) out.push(`Measure ${m.id} is not frozen.`)
  }
  return [...new Set(out)]
}

/** Pocket rule 6: no issued card, no live run. */
export function canStartRun(card: TeCard | undefined): boolean {
  return card?.status === 'issued'
}

/** Only adjudicated, non-excluded runs enter analysis. */
export function runIncludable(run: TeRun): boolean {
  return run.validity !== 'pending' && !run.excluded
}

/** Pocket rule 8: no traceability, no finding. */
export function findingBlockers(f: TeFinding): string[] {
  const out: string[] = []
  if (!f.statement.trim()) out.push('Finding has no statement.')
  if (!f.questionId) out.push('Finding links no question.')
  if (f.supportingRunIds.length === 0 && f.contradictingRunIds.length === 0)
    out.push('Finding links no runs.')
  if (!f.configId) out.push('Finding names no exact configuration.')
  if (f.measureIds.length === 0) out.push('Finding links no measures.')
  if (!f.appliesTo.trim()) out.push('Finding states no applicability bounds.')
  return out
}

/** Closeout blocks while any question or claim is undisposed. */
export function closeoutBlockers(c: TeCampaign): string[] {
  const out: string[] = []
  for (const q of c.questions) {
    if (!q.disposition) out.push(`Question ${q.id} has no disposition.`)
  }
  for (const r of c.registers) {
    if (r.kind === 'claim' && !r.disposition) out.push(`Claim ${r.id} has no disposition.`)
  }
  const openActions = c.actions.filter((a) => a.status === 'open')
  if (openActions.length > 0)
    out.push(`${openActions.length} action(s) remain open without transfer. Fix in Deliver, Actions tab.`)
  return out
}

/** Qualification gate: the decision charter must be complete and bounded. */
export function qualificationBlockers(c: TeCampaign): string[] {
  const d = c.decision
  const out: string[] = []
  if (!d.authorizedDecisionOwner.trim()) out.push('No decision owner, no campaign.')
  if (!d.boundedChoice.trim()) out.push('The bounded choice is empty.')
  if (!d.decisionDate.trim()) out.push('No decision date.')
  if (!d.blockingUncertainty.trim()) out.push('No blocking uncertainty stated.')
  if (!d.acceptanceConditions.trim()) out.push('No acceptance conditions stated.')
  if (!c.charter.acceptance.relyingOrganization.trim())
    out.push('The evidence-acceptance path names no relying organization.')
  const infeasible = c.feasibility.filter((f) => f.score === 'infeasible')
  for (const f of infeasible) out.push(`Feasibility item "${f.item}" is infeasible.`)
  return out
}

/**
 * Design lint (12 checks). Warnings, not blockers: the design gate button
 * requires the user to acknowledge open warnings.
 */
export function designLint(c: TeCampaign): GateWarning[] {
  const out: GateWarning[] = []
  for (const q of c.questions) {
    const measures = c.measures.filter((m) => m.questionId === q.id)
    if (measures.length === 0)
      out.push({ level: 'warn', text: `Question ${q.id} has no measure.` })
    const vague = ['usable', 'early enough', 'reliably', 'effective', 'good']
      .filter((w) => q.wording.toLowerCase().includes(w))
    if (vague.length > 0)
      out.push({
        level: 'warn',
        text: `Question ${q.id} uses vague terms (${vague.join(', ')}). Quantify them.`,
      })
  }
  for (const m of c.measures) {
    if (!m.truth.primarySource.trim())
      out.push({ level: 'warn', text: `Measure ${m.id} has no truth source. No independent truth, no performance verdict.` })
    if (m.threshold != null && !m.thresholdSource)
      out.push({ level: 'warn', text: `Measure ${m.id} has a threshold without a source basis.` })
  }
  for (const h of c.hypotheses) {
    if (!h.refutingResult.trim())
      out.push({ level: 'warn', text: `Hypothesis ${h.id} states no result that would contradict it.` })
    if (!h.predictedValue.trim())
      out.push({ level: 'warn', text: `Hypothesis ${h.id} has no prediction. Predictions come before results.` })
  }
  for (const cell of c.matrix) {
    if (cell.plannedReps < cell.minValidEvidence)
      out.push({
        level: 'warn',
        text: `Matrix cell ${cell.id} plans fewer repetitions than its minimum valid evidence.`,
      })
  }
  if (c.matrix.length > 0) {
    const hasBaseline = c.matrix.some((cell) => cell.method.toLowerCase().includes('baseline'))
    if (!hasBaseline)
      out.push({ level: 'warn', text: 'The matrix has no baseline row.' })
  }
  return out
}

/** Live traceability health counts for the chain dashboard. */
export interface ChainHealth {
  questionsWithoutMeasures: number
  measuresWithoutTruth: number
  cardsWithoutRuns: number
  runsPendingAdjudication: number
  findingsWithoutRuns: number
  claimsUndisposed: number
}

export function chainHealth(c: TeCampaign): ChainHealth {
  return {
    questionsWithoutMeasures: c.questions.filter(
      (q) => !c.measures.some((m) => m.questionId === q.id),
    ).length,
    measuresWithoutTruth: c.measures.filter((m) => !m.truth.primarySource.trim()).length,
    cardsWithoutRuns: c.cards.filter(
      (card) => card.status === 'issued' && !c.runs.some((r) => r.cardId === card.id),
    ).length,
    runsPendingAdjudication: c.runs.filter((r) => r.validity === 'pending').length,
    findingsWithoutRuns: c.findings.filter(
      (f) => f.supportingRunIds.length === 0 && f.contradictingRunIds.length === 0,
    ).length,
    claimsUndisposed: c.registers.filter((r) => r.kind === 'claim' && !r.disposition).length,
  }
}

/** Record kinds that controlled deletion covers. */
export type DeleteImpactKind =
  | 'registers'
  | 'questions'
  | 'measures'
  | 'configs'
  | 'threats'
  | 'conditions'
  | 'cards'

function counted(n: number, noun: string): string[] {
  if (n === 0) return []
  return [`${n} ${noun}${n === 1 ? '' : 's'}`]
}

/**
 * Controlled deletion (SPEC section 11). Returns human-readable referrers of
 * a record. Empty result: the caller may remove after one inline confirm.
 * Nonempty result: the remove control stays disabled and lists the referrers;
 * the user clears the references first.
 */
export function deleteImpacts(c: TeCampaign, kind: DeleteImpactKind, id: string): string[] {
  const out: string[] = []
  switch (kind) {
    case 'registers': {
      const entry = c.registers.find((r) => r.id === id)
      const named =
        entry !== undefined &&
        entry.statement.trim() !== '' &&
        c.decision.blockingUncertainty.trim() === entry.statement.trim()
      if (named || c.decision.blockingUncertainty.includes(id))
        out.push('the blocking uncertainty')
      out.push(...counted(c.hypotheses.filter((h) => h.claimId === id).length, 'hypothesis'))
      out.push(...counted(c.cards.filter((x) => x.claimIds.includes(id)).length, 'card'))
      out.push(...counted(c.findings.filter((f) => f.claimId === id).length, 'finding'))
      break
    }
    case 'questions': {
      out.push(...counted(c.matrix.filter((x) => x.questionId === id).length, 'matrix cell'))
      out.push(...counted(c.cards.filter((x) => x.questionIds.includes(id)).length, 'card'))
      out.push(...counted(c.findings.filter((f) => f.questionId === id).length, 'finding'))
      out.push(...counted(c.measures.filter((m) => m.questionId === id).length, 'measure'))
      out.push(...counted(c.hypotheses.filter((h) => h.questionId === id).length, 'hypothesis'))
      break
    }
    case 'measures': {
      out.push(...counted(c.matrix.filter((x) => x.measureIds.includes(id)).length, 'matrix cell'))
      out.push(...counted(c.cards.filter((x) => x.measureIds.includes(id)).length, 'card'))
      out.push(...counted(c.findings.filter((f) => f.measureIds.includes(id)).length, 'finding'))
      out.push(
        ...counted(
          c.runs.filter((r) => r.observations.some((o) => o.measureId === id)).length,
          'run',
        ),
      )
      break
    }
    case 'configs': {
      out.push(...counted(c.matrix.filter((x) => x.configId === id).length, 'matrix cell'))
      out.push(...counted(c.cards.filter((x) => x.configId === id).length, 'card'))
      out.push(...counted(c.runs.filter((r) => r.actualConfigId === id).length, 'run'))
      out.push(...counted(c.findings.filter((f) => f.configId === id).length, 'finding'))
      break
    }
    case 'threats': {
      out.push(...counted(c.matrix.filter((x) => x.threatId === id).length, 'matrix cell'))
      out.push(...counted(c.cards.filter((x) => x.threatId === id).length, 'card'))
      out.push(...counted(c.runs.filter((r) => r.actualThreatId === id).length, 'run'))
      out.push(...counted(c.findings.filter((f) => f.threatIds.includes(id)).length, 'finding'))
      break
    }
    case 'conditions': {
      out.push(...counted(c.matrix.filter((x) => x.conditionId === id).length, 'matrix cell'))
      out.push(...counted(c.cards.filter((x) => x.conditionId === id).length, 'card'))
      out.push(...counted(c.runs.filter((r) => r.actualConditionId === id).length, 'run'))
      out.push(...counted(c.findings.filter((f) => f.conditionIds.includes(id)).length, 'finding'))
      break
    }
    case 'cards': {
      out.push(...counted(c.runs.filter((r) => r.cardId === id).length, 'run'))
      break
    }
  }
  return out
}

/**
 * Matrix planning. Pure: the Design panel previews a plan, the store adopts it in
 * one update. The sample-size and drop-order rules live here, not in click handlers.
 * The plan carries no ids; the store allocates them in plan order.
 */

import { attemptInflation, sampleSizeProportion } from '../calc/stats'
import { emptyMatrixCell } from './empty'
import type { TeCampaign, TeMatrixCell } from './types'

/** A cell the plan would add. The store owns identity, so the plan carries no id. */
export type PlannedMatrixCell = Omit<TeMatrixCell, 'id'>

/** Drop order of a cell nobody ranked (`emptyMatrixCell`). */
export const UNRANKED_DROP_ORDER = 99

/** A batch above this size is hard to execute; the preview says so. */
const LARGE_BATCH = 100

export interface MatrixPlanFactors {
  questionId: string | null
  hypothesisId: string | null
  configId: string | null
  threatId: string | null
  /** One cell lands per condition, in this order. */
  conditionIds: string[]
}

export interface MatrixPlanOptions {
  method: string
  /** Planned repetitions per cell. Null uses the question's required repetitions. */
  plannedReps?: number | null
  /** Adds a baseline row ahead of the picked conditions when the matrix has none. */
  addBaseline?: boolean
}

export interface MatrixPlan {
  /** Every cell to add, in add order. The baseline row, when planned, comes first. */
  cells: PlannedMatrixCell[]
  /** The planned baseline row; the same object as `cells[0]`, or null. */
  baseline: PlannedMatrixCell | null
  warnings: string[]
}

/** Cell defaults with a patch over them. Keeps one source for the empty shape. */
export function plannedCell(patch: Partial<PlannedMatrixCell> = {}): PlannedMatrixCell {
  const { id: _id, ...defaults } = emptyMatrixCell('')
  return { ...defaults, ...patch }
}

/** Repetitions the question's measures require. The largest wins; never below one. */
export function requiredRepetitions(campaign: TeCampaign, questionId: string | null): number {
  const reps = campaign.measures
    .filter((m) => m.questionId === questionId)
    .map((m) => m.requiredRepetitions ?? 1)
  return Math.max(1, ...reps)
}

export interface SampleSizeInput {
  /** Expected proportion, strictly between 0 and 1. */
  p: number | null
  halfWidth: number | null
  /** Share of attempts that yield a valid run, in (0, 1]. */
  validFraction: number | null
}

export interface SampleSizeSolution {
  /** Valid runs needed at 95% for one proportion, or null when the inputs do not solve. */
  validNeeded: number | null
  /** Attempts that yield those valid runs, or null without a valid fraction. */
  attempts: number | null
}

/** One sample-size computation for the measure field and for a cell's minimums. */
export function planSampleSize(input: SampleSizeInput): SampleSizeSolution {
  const { p, halfWidth, validFraction } = input
  const validNeeded =
    p != null && p > 0 && p < 1 && halfWidth != null && halfWidth > 0
      ? sampleSizeProportion(p, halfWidth)
      : null
  const attempts =
    validNeeded != null && validFraction != null && validFraction > 0 && validFraction <= 1
      ? attemptInflation(validNeeded, validFraction)
      : null
  return { validNeeded, attempts }
}

/**
 * Cell minimums from a solved sample size. Without an attempt inflation the planned
 * repetitions only grow; a cell never plans fewer runs than it needs valid.
 */
export function sampleSizeCellPatch(
  cell: Pick<TeMatrixCell, 'plannedReps'>,
  solution: SampleSizeSolution,
): Pick<TeMatrixCell, 'minValidEvidence' | 'plannedReps'> | null {
  if (solution.validNeeded == null) return null
  return {
    minValidEvidence: solution.validNeeded,
    plannedReps: solution.attempts ?? Math.max(cell.plannedReps, solution.validNeeded),
  }
}

/** Rank from priority: the lowest priority drops first. Mirrors the panel's ranking. */
export function dropOrderRanking(
  cells: readonly Pick<TeMatrixCell, 'id' | 'priority'>[],
): Array<{ id: string; dropOrder: number }> {
  return [...cells]
    .sort((a, b) => b.priority - a.priority)
    .map((cell, i) => ({ id: cell.id, dropOrder: i + 1 }))
}

/**
 * True when a comparison build still needs a baseline row. The method or the charter
 * makes the build a comparison; an existing baseline row settles it.
 */
export function baselineOffered(campaign: TeCampaign, method: string): boolean {
  const comparison = method.toLowerCase().includes('comparison') ||
    campaign.charter.engagementType === 'comparison'
  return comparison && !campaign.matrix.some((x) => x.method.toLowerCase().includes('baseline'))
}

/**
 * Cells for one add-cells build. Missing or dangling links never reach the plan, so
 * adopting it cannot fail campaign reference validation. Warnings are for the preview.
 */
export function planCells(
  campaign: TeCampaign,
  factors: MatrixPlanFactors,
  options: MatrixPlanOptions,
): MatrixPlan {
  const warnings: string[] = []
  const question = campaign.questions.find((q) => q.id === factors.questionId) ?? null
  const config = campaign.configs.find((x) => x.id === factors.configId) ?? null
  const threat = campaign.threats.find((x) => x.id === factors.threatId) ?? null
  const conditionIds = factors.conditionIds.filter((id) =>
    campaign.conditions.some((c) => c.id === id))
  if (!question) warnings.push('Pick a question.')
  if (!config) warnings.push('Pick a configuration.')
  if (!threat) warnings.push('Pick a threat.')
  if (conditionIds.length === 0) warnings.push('Pick at least one condition.')

  const hypothesis = campaign.hypotheses.find((h) => h.id === factors.hypothesisId) ?? null
  if (factors.hypothesisId && !hypothesis) warnings.push('The picked hypothesis is not in the campaign.')
  if (hypothesis && question && hypothesis.questionId !== question.id) {
    warnings.push('The picked hypothesis belongs to another question.')
  }
  const measureIds = campaign.measures
    .filter((m) => m.questionId === question?.id)
    .map((m) => m.id)
  if (question && measureIds.length === 0) warnings.push('The question has no measures.')

  const defaultReps = requiredRepetitions(campaign, question?.id ?? null)
  const plannedReps = options.plannedReps ?? defaultReps
  if (plannedReps < 1) warnings.push('Planned reps below one plans no runs.')

  const offered = baselineOffered(campaign, options.method)
  const wantsBaseline = offered && (options.addBaseline ?? true)
  if (offered && !wantsBaseline) {
    warnings.push('A comparison without a baseline row proves nothing.')
  }

  if (!question || !config || !threat || conditionIds.length === 0) {
    return { cells: [], baseline: null, warnings }
  }

  const base: Partial<PlannedMatrixCell> = {
    questionId: question.id,
    hypothesisId: hypothesis?.id ?? null,
    configId: config.id,
    threatId: threat.id,
    measureIds,
    plannedReps,
    minValidEvidence: Math.min(plannedReps, defaultReps),
  }
  const baseline = wantsBaseline
    ? plannedCell({ ...base, conditionId: conditionIds[0], method: 'baseline comparison' })
    : null
  const cells = [
    ...(baseline ? [baseline] : []),
    ...conditionIds.map((conditionId) =>
      plannedCell({ ...base, conditionId, method: options.method })),
  ]
  if (cells.length > LARGE_BATCH) {
    warnings.push(`${cells.length} cells plan ${cells.length * plannedReps} runs. Trim the batch or the reps.`)
  }
  return { cells, baseline, warnings }
}

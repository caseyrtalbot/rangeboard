/**
 * Draft card linking and filling.
 * One place decides how a card takes links and when derived text is written:
 * creation from a matrix cell, a cell picked on a card that already has links,
 * a single link change, the empty-field fill and the explicit refill.
 * Pure: the store applies the returned patch and keeps issued cards frozen.
 */

import type { TeCampaign, TeCard, TeMatrixCell } from './types'

/** The link fields a caller can choose. Text fields are never passed in. */
export type CardLinkSelection = Partial<
  Pick<
    TeCard,
    'matrixCellId' | 'questionIds' | 'hypothesisIds' | 'measureIds' | 'configId' | 'threatId' | 'conditionId'
  >
>

/** Event marks a card starts from when the conductor fills it from the design. */
export const DEFAULT_EVENT_MARKS = [
  'start recording',
  'start run',
  'threat enters eligibility region',
  'first detection',
  'first stable track',
  'usable C2 track',
  'operator decision',
  'protected-boundary crossing',
  'run complete',
  'stop recording',
]

/** Merge of two id lists: existing order first, no duplicates, no empty ids. */
function union(current: string[], added: string[]): string[] {
  return [...new Set([...current, ...added])].filter((id) => id !== '')
}

/** Links a new card takes from a matrix cell. The cell decides every field. */
export function newCardLinks(cell: TeMatrixCell): CardLinkSelection {
  return {
    matrixCellId: cell.id,
    questionIds: cell.questionId ? [cell.questionId] : [],
    hypothesisIds: cell.hypothesisId ? [cell.hypothesisId] : [],
    configId: cell.configId || null,
    threatId: cell.threatId || null,
    conditionId: cell.conditionId || null,
    measureIds: [...cell.measureIds],
  }
}

/**
 * Links after a cell is picked on a card that already has links.
 * Lists merge without duplicates. A single link moves to the cell's record
 * only where the cell names one, so an existing choice survives an empty cell
 * field.
 */
export function mergedCellLinks(card: TeCard, cell: TeMatrixCell): CardLinkSelection {
  return {
    matrixCellId: cell.id,
    questionIds: union(card.questionIds, cell.questionId ? [cell.questionId] : []),
    hypothesisIds: union(card.hypothesisIds, cell.hypothesisId ? [cell.hypothesisId] : []),
    configId: cell.configId || card.configId,
    threatId: cell.threatId || card.threatId,
    conditionId: cell.conditionId || card.conditionId,
    measureIds: union(card.measureIds, cell.measureIds),
  }
}

/**
 * Card text derived from the records the card links to.
 * With `all` false only empty fields fill; `all` true overwrites every
 * derived field (the explicit refill path).
 */
export function linkedRecordFill(c: TeCampaign, card: TeCard, all = false): Partial<TeCard> {
  const patch: Partial<TeCard> = {}
  const put = (key: keyof TeCard & string, current: string, next: string) => {
    if (next.trim() === '') return
    if (!all && current.trim() !== '') return
    ;(patch as Record<string, unknown>)[key] = next
  }
  const config = c.configs.find((x) => x.id === card.configId)
  if (config) {
    put(
      'systemStateNote',
      card.systemStateNote,
      [config.name && `${config.name} ${config.version}`, config.settingsAndModes]
        .filter((t) => t && t.trim() !== '')
        .join('; '),
    )
    put('trainingState', card.trainingState, config.operatorsAndTraining)
  }
  const threat = c.threats.find((x) => x.id === card.threatId)
  if (threat) {
    put('redControlled', card.redControlled, threat.redControlledVariables)
    put('redFixed', card.redFixed, threat.redFixedVariables)
    put('blinding', card.blinding, threat.blinding)
  }
  const cond = c.conditions.find((x) => x.id === card.conditionId)
  if (cond) {
    put(
      'conditionNote',
      card.conditionNote,
      [cond.name, cond.weatherAndIllumination, cond.emEnvironment]
        .filter((t) => t.trim() !== '')
        .join('; '),
    )
  }
  put(
    'operatingLimits',
    card.operatingLimits,
    c.authorities
      .filter((a) => a.status === 'active' && a.operatingLimits.trim() !== '')
      .map((a) => a.operatingLimits)
      .join('; '),
  )
  const measures = card.measureIds
    .map((id) => c.measures.find((m) => m.id === id))
    .filter((m) => m !== undefined)
  if (measures.length > 0) {
    put(
      'dataSources',
      card.dataSources,
      [
        ...new Set(
          measures.flatMap((m) => [m.truth.primarySource, m.truth.backupSource]).filter((t) => t.trim() !== ''),
        ),
      ].join('\n'),
    )
    put(
      'groundTruth',
      card.groundTruth,
      [
        ...new Set(
          measures
            .map((m) =>
              [m.truth.primarySource, m.truth.independenceFromSut].filter((t) => t.trim() !== '').join('; '),
            )
            .filter((t) => t !== ''),
        ),
      ].join('\n'),
    )
    const tolerances = measures
      .map((m) => m.truth.timeToleranceS)
      .filter((t): t is number => t !== null)
    if (tolerances.length > 0) {
      put(
        'commonTimeAndTolerance',
        card.commonTimeAndTolerance,
        `Common time base; tightest tolerance ${Math.min(...tolerances)} s`,
      )
    }
  }
  const cell = c.matrix.find((x) => x.id === card.matrixCellId)
  if (cell) put('orderAndBlocking', card.orderAndBlocking, cell.orderOrBlock)
  put(
    'resultThatCouldChangeDecision',
    card.resultThatCouldChangeDecision,
    c.decision.resultThatChangesChoice,
  )
  const q = card.questionIds.map((id) => c.questions.find((x) => x.id === id)).find((x) => x !== undefined)
  if (q) put('purpose', card.purpose, q.wording)
  const hyp = card.hypothesisIds
    .map((id) => c.hypotheses.find((h) => h.id === id))
    .find((h) => h !== undefined)
  if (hyp) {
    put(
      'prediction',
      card.prediction,
      [hyp.predictedValue, hyp.producesBehavior].filter((t) => t.trim() !== '').join('; '),
    )
  }
  return patch
}

/** A link change plus the empty-field fill the new links allow. */
export function linkPatch(c: TeCampaign, card: TeCard, links: CardLinkSelection): Partial<TeCard> {
  const next = { ...card, ...links }
  return { ...links, ...linkedRecordFill(c, next) }
}

/**
 * A matrix cell picked on an existing card: merged links plus their fill.
 * A cleared or unknown cell changes the cell link only and fills nothing.
 */
export function cellPatch(c: TeCampaign, card: TeCard, cellId: string | null): Partial<TeCard> {
  const cell = c.matrix.find((x) => x.id === cellId)
  if (!cell) return { matrixCellId: cellId }
  return linkPatch(c, card, mergedCellLinks(card, cell))
}

/** Empty-field fill from the links, plus the marks and preconditions a draft starts from. */
export function fillPatch(c: TeCampaign, card: TeCard): Partial<TeCard> {
  const patch: Partial<TeCard> = linkedRecordFill(c, card)
  if (card.eventMarks.length === 0) patch.eventMarks = [...DEFAULT_EVENT_MARKS]
  if (card.preconditions.length === 0 && c.authorities.length > 0) {
    patch.preconditions = c.authorities.map((a) => `${a.authorityType || 'authority'}: ${a.status}`)
  }
  return patch
}

/** The explicit refill: every derived field is written again from the links. */
export function refillPatch(c: TeCampaign, card: TeCard): Partial<TeCard> {
  return linkedRecordFill(c, card, true)
}

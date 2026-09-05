import type { TeCampaign } from '../model/types'
import { runtimeShapes } from '../../io/runtimeSchema'
import { idsOf, invalid, reference, validateShape } from '../../io/runtimeValidation'

export function validateCampaignShape(value: unknown, path = 'campaign'): asserts value is TeCampaign {
  validateShape(value, 'TeCampaign', path, true)
}

export function validateCampaignReferences(c: TeCampaign, path = 'campaign'): void {
  const collections = new Map<string, Set<string>>()
  for (const [key, value] of Object.entries(c)) {
    if (runtimeShapes.TeCampaign.properties?.[key] && Array.isArray(value) && value.every(v => v && typeof v === 'object' && 'id' in v)) {
      collections.set(key, idsOf(value, `${path}.${key}`))
    }
  }
  // Cross-campaign ancestry, Board entity links and specModelId are external
  // provenance, not campaign-local foreign keys. Their absence here is valid.
  const targets: Record<string, string> = {
    questionId: 'questions', questionIds: 'questions', claimId: 'registers', claimIds: 'registers',
    hypothesisId: 'hypotheses', hypothesisIds: 'hypotheses', measureId: 'measures', measureIds: 'measures',
    allowedMeasureIds: 'measures', configId: 'configs', actualConfigId: 'configs',
    threatId: 'threats', actualThreatId: 'threats', threatIds: 'threats',
    conditionId: 'conditions', actualConditionId: 'conditions', conditionIds: 'conditions',
    matrixCellId: 'matrix', cardId: 'cards', runId: 'runs', supportingRunIds: 'runs',
    contradictingRunIds: 'runs', deviationIds: 'deviations', anomalyIds: 'anomalies',
    findingId: 'findings', frameIds: 'frames', independentFactorIds: 'factors',
    heldFactorIds: 'factors', covariateFactorIds: 'factors',
  }
  function inspect(value: unknown, at: string): void {
    if (Array.isArray(value)) { value.forEach((v, i) => inspect(v, `${at}[${i}]`)); return }
    if (!value || typeof value !== 'object') return
    for (const [key, field] of Object.entries(value)) {
      const target = targets[key]
      if (target) {
        const ids = collections.get(target) ?? new Set<string>()
        if (Array.isArray(field)) field.forEach((id, i) => reference(id, ids, `${at}.${key}[${i}]`))
        else reference(field as string | null, ids, `${at}.${key}`, true)
      } else if (key === 'observations') inspect(field, `${at}.${key}`)
    }
  }
  for (const [key, value] of Object.entries(c)) if (Array.isArray(value)) inspect(value, `${path}.${key}`)
  c.runs.forEach((run, i) => {
    const card = c.cards.find(card => card.id === run.cardId)
    if (card && card.version !== run.cardVersion) invalid(`${path}.runs[${i}].cardVersion`, 'does not match referenced card version')
  })
}

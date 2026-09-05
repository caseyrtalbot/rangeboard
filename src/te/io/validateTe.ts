import type { TeCampaign } from '../model/types'
import { runtimeShapes } from '../../io/runtimeSchema'
import { idsOf, invalid, reference, validateShape } from '../../io/runtimeValidation'

export function validateCampaignShape(value: unknown, path = 'campaign'): asserts value is TeCampaign {
  validateShape(value, 'TeCampaign', path, true)
}

export function validateCampaignReferences(c: TeCampaign, path = 'campaign'): void {
  const collections = new Map<string, Set<string>>()
  const allIds = new Set<string>()
  for (const [key, value] of Object.entries(c)) {
    if (runtimeShapes.TeCampaign.properties?.[key] && Array.isArray(value) && value.every(v => v && typeof v === 'object' && 'id' in v)) {
      const ids = idsOf(value, `${path}.${key}`)
      for (const id of ids) {
        if (allIds.has(id)) invalid(`${path}.${key}`, `duplicate ID ${id} across record lists`)
        allIds.add(id)
      }
      collections.set(key, ids)
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
      } else if (['observations', 'observationAmendments', 'adjudications',
        'previous', 'corrected'].includes(key)) inspect(field, `${at}.${key}`)
    }
  }
  for (const [key, value] of Object.entries(c)) if (Array.isArray(value)) inspect(value, `${path}.${key}`)
  const versions = new Set<string>()
  const activeCodes = new Set<string>()
  for (const card of c.cards) {
    if (['issued', 'superseded'].includes(card.status) &&
        (!card.questionIds.length || !card.measureIds.length || !card.configId ||
          !card.threatId || !card.conditionId)) {
      invalid(`${path}.cards`, 'issued card version lacks required traceability links')
    }
    const key = JSON.stringify([card.cardCode, card.version])
    if (versions.has(key)) invalid(`${path}.cards`, 'duplicate card code/version')
    versions.add(key)
    if (card.status === 'issued' || card.status === 'draft') {
      if (activeCodes.has(card.cardCode)) invalid(`${path}.cards`, 'multiple active card versions')
      activeCodes.add(card.cardCode)
    }
  }
  c.runs.forEach((run, i) => {
    const card = c.cards.find(card => card.id === run.cardId)
    const observed = new Set<string>()
    for (const obs of run.observations) {
      if (observed.has(obs.measureId)) invalid(`${path}.runs[${i}].observations`, 'duplicate measure observation')
      observed.add(obs.measureId)
    }
    if (run.startAt && (!card || !['issued', 'superseded'].includes(card.status)))
      invalid(`${path}.runs[${i}].cardId`, 'execution requires an issued card version')
    if (card && card.version !== run.cardVersion)
      invalid(`${path}.runs[${i}].cardVersion`, 'does not match referenced card version')
    run.adjudications.forEach((entry, j) => {
      if (entry.version !== j + 1)
        invalid(`${path}.runs[${i}].adjudications[${j}].version`, 'expected sequential decision version')
    })
    const latest = run.adjudications.at(-1)
    if (latest && run.validity !== 'pending' && latest.validity !== run.validity)
      invalid(`${path}.runs[${i}].validity`, 'does not match the latest adjudication')
    const amendments = run.observationAmendments ?? []
    amendments.forEach((entry, j) => {
      if (!entry.by.trim() || !entry.reason.trim() || !entry.at.trim())
        invalid(`${path}.runs[${i}].observationAmendments[${j}]`, 'correction lacks attribution')
      if (j > 0 && JSON.stringify(amendments[j - 1].corrected) !== JSON.stringify(entry.previous))
        invalid(`${path}.runs[${i}].observationAmendments[${j}]`, 'broken observation history')
    })
    if (amendments.length && JSON.stringify(amendments.at(-1)!.corrected) !== JSON.stringify(run.observations))
      invalid(`${path}.runs[${i}].observations`, 'does not match the latest correction')
  })
}

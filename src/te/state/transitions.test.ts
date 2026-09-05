import { beforeEach, describe, expect, it } from 'vitest'
import { useTeStore } from './teStore'
import { buildJiatf401 } from '../seed/jiatf401'
import { computeMeasure } from '../calc/measures'
import { CHECKLIST_TEMPLATES } from '../seed/checklistTemplates'
import { deliveryBlockers, findingBlockers, runIncludable } from '../validate'
import { findingComputations } from '../ui/DeliverBlocks'
import { emptyFinding } from '../model/empty'
import { parseCampaignData, parseTeAutosave } from '../io/persistTe'

const store = () => useTeStore.getState()
const campaign = () => store().campaigns.find(c => c.id === store().activeCampaignId)!

beforeEach(() => {
  useTeStore.setState({ campaigns: [], activeCampaignId: null })
  store().loadCampaign(buildJiatf401())
})

describe('C4 authoritative record transitions', () => {
  it('rejects every generic issued-card edit and deletion, including bulk patches', () => {
    const c = campaign()
    const card = c.cards[0]
    store().patchItem('cards', card.id, { title: 'rewritten', status: 'draft' })
    store().bumpRecordVersion('cards', card.id)
    store().removeItem('cards', card.id)
    store().patchCampaign({ cards: [] })
    expect(campaign()).toEqual(c)
  })

  it('revises an issued version once, preserves old runs and locks superseded cards', () => {
    const c = campaign()
    const old = c.cards[0]
    const id = store().reviseCard(old.id)!
    expect(id).toBeTruthy()
    const revised = campaign().cards.find(card => card.id === id)!
    expect(revised).toMatchObject({ cardCode: old.cardCode, version: 'v2.0', status: 'draft' })
    expect(campaign().runs).toEqual(c.runs)
    expect(store().reviseCard(old.id)).toBeNull()
    expect(store().reviseCard(id)).toBeNull()
    store().patchItem('cards', old.id, { title: 'rewritten' })
    store().removeItem('cards', old.id)
    expect(campaign().cards.find(card => card.id === old.id)).toEqual({ ...old, status: 'superseded' })
    store().patchItem('cards', id, { title: 'New draft' })
    expect(campaign().cards.find(card => card.id === id)?.title).toBe('New draft')
  })

  it('rejects duplicate identities, cross-campaign references, and dangling deletions', () => {
    const c = campaign()
    store().addItem('questions', c.questions[0])
    store().patchItem('questions', c.questions[0].id, { id: 'renamed' })
    store().patchItem('findings', c.findings[0].id, { supportingRunIds: ['foreign-run'] })
    store().removeItem('measures', c.measures[0].id)
    store().removeItem('runs', c.runs[0].id)
    expect(campaign()).toEqual(c)
  })

  it('blocks status injection at creation and reissue of existing issued cards', () => {
    const c = campaign()
    const id = store().addCard({ status: 'issued', effectiveAt: 'forged' })
    expect(campaign().cards.find(card => card.id === id)?.status).toBe('draft')
    const original = c.cards[0]
    expect(store().issueCard(original.id).length).toBeGreaterThan(0)
    expect(campaign().cards[0]).toEqual(original)
  })

  it('blocks gate stamping, qualification bypass, and empty-package finalization', () => {
    store().createCampaign('Incomplete', 'C4')
    const c = campaign()
    store().passQualificationGate()
    store().approveDesign()
    store().markPackageDelivered()
    store().patchCampaign({ phase: 'closed', qualificationPassedAt: 'forged', designApprovedAt: 'forged' })
    expect(campaign()).toEqual(c)
  })

  it('requires explicit design-warning acknowledgement', () => {
    const c = campaign()
    store().createCampaign('Design', 'C4')
    store().patchCampaign({ decision: c.decision, charter: c.charter })
    store().passQualificationGate()
    expect(campaign().qualificationPassedAt).toBeTruthy()
    const q = store().addQuestion()
    store().patchItem('questions', q, { wording: 'Is it effective?' })
    store().approveDesign()
    expect(campaign().designApprovedAt).toBeNull()
    store().approveDesign(true)
    expect(campaign().designApprovedAt).toBeTruthy()
  })

  it('checks all card references and design approval at issue', () => {
    const old = campaign().cards[0]
    const id = store().reviseCard(old.id)!
    store().patchItem('cards', id, { coldReaderAt: old.coldReaderAt, dryRunAt: old.dryRunAt,
      procedure: old.procedure.map(step => ({ ...step, observableCompletion: 'Observed complete' })),
    })
    expect(store().issueCard(id)).toEqual([])
    const c = campaign()
    // Simulate a malformed external caller; the store boundary must still reject it.
    useTeStore.setState({ campaigns: [{ ...c, cards: c.cards.map(x => x.id === id ? {
      ...x, status: 'draft', questionIds: [...x.questionIds, 'foreign-question'],
    } : x) }] })
    expect(store().issueCard(id).length).toBeGreaterThan(0)
  })

  it('keeps invalid evidence available but out of every quantitative denominator', () => {
    const c = campaign()
    const run = c.runs.find(r => r.validity === 'invalid')!
    const mid = run.observations[0].measureId
    const result = computeMeasure({ ...c, runs: [run] }, mid)!
    expect(result.nIncluded).toBe(0)
    expect(result.nValid).toBe(0)
    expect(result.estimate).toBeNull()
    const f = store().addFinding()
    store().patchItem('findings', f, { supportingRunIds: [run.id] })
    expect(campaign().findings.find(x => x.id === f)?.supportingRunIds).toEqual([run.id])
  })

  it('rejects adjudication bypass and preserves prior decisions on amendment', () => {
    const c = campaign()
    const run = c.runs[0]
    store().patchItem('runs', run.id, { validity: 'invalid', adjudications: [], cardVersion: 'v99.0' })
    expect(campaign()).toEqual(c)
    store().adjudicateRun(run.id, 'invalid', 'Reviewer', 'Truth failure found')
    const updated = campaign().runs[0]
    expect(updated.adjudications.slice(0, -1)).toEqual(run.adjudications)
    expect(updated.adjudications.at(-1)?.reason).toBe('Truth failure found')
    expect(updated.validity).toBe('invalid')
  })

  it('cannot discard evidence-bearing runs or reuse their numbers', () => {
    const run = campaign().runs[0]
    store().discardRun(run.id)
    expect(campaign().runs.some(r => r.id === run.id)).toBe(true)
    const id = store().createRunFromCard(campaign().cards[0].id)!
    store().discardRun(id)
    expect(campaign().runs.some(r => r.id === id)).toBe(false)
    const next = store().createRunFromCard(campaign().cards[0].id)!
    expect(next).not.toBe(id)
  })

  it('protects frozen baseline snapshots and measure definitions', () => {
    const c = campaign()
    const config = c.configs[0]
    store().patchItem('configs', config.id, { frozen: false, scenarioSnapshot: null })
    store().patchItem('measures', c.measures[0].id, { frozen: false, name: 'changed' })
    expect(campaign()).toEqual(c)
  })

  it('validates complete findings at delivery while allowing empty drafts', () => {
    const f = store().addFinding()
    expect(campaign().findings.find(x => x.id === f)).toEqual(emptyFinding(f))
    store().markPackageDelivered()
    expect(campaign().evidencePackage.deliveredAt).toBeNull()
  })

  it('does not replace existing issued history through state adoption', () => {
    const c = campaign()
    const edited = structuredClone(c)
    edited.cards[0].title = 'silently changed by import'
    store().replaceState({ schemaVersion: 1, campaigns: [edited], activeCampaignId: edited.id })
    expect(campaign()).toEqual(c)
  })

  it('rejects duplicate card-code/version lineage on import and keeps old references on round trip', () => {
    const old = campaign().cards[0]
    store().reviseCard(old.id)
    const c = campaign()
    expect(parseCampaignData({ rangeboardCampaign: 1, campaign: c })).toEqual(c)
    expect(parseTeAutosave(JSON.stringify({ schemaVersion: 1, campaigns: [c], activeCampaignId: c.id })).campaigns[0]).toEqual(c)
    const duplicate = structuredClone(c)
    duplicate.cards.push({ ...duplicate.cards[0], id: 'different-id' })
    expect(() => parseCampaignData({ rangeboardCampaign: 1, campaign: duplicate })).toThrow()
  })
})


describe('C4 evidence and finalization acceptance', () => {
  function prepareDelivery() {
    const c = campaign()
    for (const q of c.questions) store().patchItem('questions', q.id, { disposition: 'answered' })
    for (const r of c.registers) if (r.kind === 'claim')
      store().patchItem('registers', r.id, { disposition: 'untested' })
    for (const action of c.actions) store().patchItem('actions', action.id, { status: 'transferred' })
    store().patchCampaign({ evidencePackage: {
      ...c.evidencePackage,
      methodAcceptance: 'Accepted for this illustrative walkthrough',
      evidenceAcceptance: 'Accepted for software verification only',
      finalAuthorityAndDate: 'Illustrative reviewer, 2026-09-05',
      sections: c.evidencePackage.sections.map(s => ({ ...s, content: 'Illustrative section completed' })),
    } })
  }

  it('finalizes a traceable package, rejects rewrites, closes, and reloads exactly', () => {
    prepareDelivery()
    expect(deliveryBlockers(campaign())).toEqual([])
    store().markPackageDelivered()
    const delivered = campaign()
    expect(delivered.evidencePackage.deliveredAt).toBeTruthy()
    store().patchItem('findings', delivered.findings[0].id, { statement: 'rewritten' })
    store().adjudicateRun(delivered.runs[0].id, 'invalid', 'Reviewer', 'changed')
    store().patchCampaign({ evidencePackage: { ...delivered.evidencePackage, deliveredAt: null } })
    expect(campaign()).toEqual(delivered)
    store().patchCampaign({ phase: 'closed' })
    expect(campaign().phase).toBe('closed')
    const c = campaign()
    expect(parseCampaignData({ rangeboardCampaign: 1, campaign: c })).toEqual(c)
    expect(parseTeAutosave(JSON.stringify({ schemaVersion: 1, campaigns: [c], activeCampaignId: c.id })).campaigns[0]).toEqual(c)
  })

  it('rejects fabricated finalized imports without changing live history', () => {
    const c = campaign()
    const forged = structuredClone(c)
    forged.evidencePackage.deliveredAt = '2026-09-05'
    forged.findings[0].supportingRunIds = ['foreign-run']
    expect(() => parseCampaignData({ rangeboardCampaign: 1, campaign: forged })).toThrow()
    store().loadCampaign(forged)
    expect(campaign()).toEqual(c)
  })

  it('uses one explicit policy for quantitative and fault-investigation evidence', () => {
    const r = campaign().runs[0]
    const mid = r.observations[0].measureId
    for (const validity of ['pending', 'invalid', 'valid', 'conditionally-valid'] as const) {
      for (const excluded of [false, true]) {
        const run = { ...r, validity, excluded, allowedMeasureIds: [mid] }
        expect(runIncludable(run, 'failure-investigation')).toBe(validity !== 'pending')
        expect(runIncludable(run, 'quantitative', mid)).toBe(!excluded &&
          (validity === 'valid' || validity === 'conditionally-valid'))
        expect(runIncludable(run, 'quantitative', 'another-measure')).toBe(!excluded && validity === 'valid')
      }
    }
  })

  it('requires qualified evidence limits for invalid, excluded, or disallowed trials', () => {
    const c = campaign()
    const run = c.runs.find(r => r.validity === 'invalid')!
    const f = { ...c.findings[0], supportingRunIds: [run.id], contradictingRunIds: [], missingAndExcludedData: '' }
    expect(findingBlockers(c, f).some(s => s.includes('Qualify'))).toBe(true)
    f.missingAndExcludedData = 'Fault investigation only: invalid geometry; no quantitative trial credit.'
    expect(findingBlockers(c, f)).toEqual([])
    expect(findingComputations(c, f).every(result => result.nIncluded === 0)).toBe(true)
  })

  it('scopes generated finding statistics to linked runs', () => {
    const c = campaign()
    const run = c.runs[0]
    const mid = run.observations.find(o => o.status === 'observed' && o.value !== null)!.measureId
    const f = { ...c.findings[0], measureIds: [mid], supportingRunIds: [run.id], contradictingRunIds: [] }
    expect(findingComputations(c, f)[0]).toEqual(computeMeasure({ ...c, runs: [run] }, mid))
    expect(findingComputations(c, { ...f, supportingRunIds: [] })[0].estimate).toBeNull()
  })

  it('retains original observation values and requires attribution and re-adjudication', () => {
    const c = campaign()
    const r = c.runs[0]
    const corrected = r.observations.map((o, i) => i === 0 ? { ...o, value: 123 } : o)
    store().patchItem('runs', r.id, { observations: corrected })
    store().amendRunObservations(r.id, corrected, '', 'typo')
    expect(campaign()).toEqual(c)
    store().amendRunObservations(r.id, corrected, 'Recorder', 'Corrected transcription from retained source')
    const amended = campaign().runs[0]
    expect(amended.validity).toBe('pending')
    expect(amended.observations).toEqual(corrected)
    expect(amended.adjudications).toEqual(r.adjudications)
    expect(amended.observationAmendments?.[0]).toMatchObject({ previous: r.observations, corrected })
    store().adjudicateRun(r.id, 'valid', 'Reviewer', 'Correction reviewed')
    const current = campaign().runs[0]
    expect(current.adjudications.at(-1)?.observations).toEqual(corrected)
    expect(parseCampaignData({ rangeboardCampaign: 1, campaign: campaign() }).runs[0]).toEqual(current)
  })

  it('requires an exclusion reason and keeps excluded evidence with zero trial credit', () => {
    const r = campaign().runs[0]
    store().setRunExcluded(r.id, true, '')
    expect(campaign().runs[0].excluded).toBe(false)
    store().setRunExcluded(r.id, true, 'Duplicate experimental unit')
    const excluded = campaign().runs[0]
    expect(excluded.exclusionReason).toBe('Duplicate experimental unit')
    expect(excluded.observations).toEqual(r.observations)
    expect(runIncludable(excluded, 'quantitative', r.observations[0].measureId)).toBe(false)
    expect(runIncludable(excluded, 'failure-investigation')).toBe(true)
  })

  it('rejects duplicate observations and stale counters cannot reuse an existing run identity', () => {
    const c = campaign()
    const r = c.runs[0]
    store().amendRunObservations(r.id, [...r.observations, r.observations[0]], 'Recorder', 'Duplicate')
    expect(campaign()).toEqual(c)
    useTeStore.setState({ campaigns: [{ ...c, seq: { ...c.seq, RUN: 0 } }] })
    const next = store().createRunFromCard(c.cards[0].id)
    expect(next).toBeTruthy()
    expect(c.runs.some(run => run.id === next)).toBe(false)
    expect(campaign().runs.slice(0, -1)).toEqual(c.runs)
  })
})


describe('C4 remaining transition boundaries', () => {
  it('requires completed checklist controls and preserves the completion record', () => {
    const id = store().startChecklist(CHECKLIST_TEMPLATES[0])
    store().patchItem('checklists', id, { completedAt: '2026-09-05' })
    const draft = campaign().checklists.find(c => c.id === id)!
    expect(draft.completedAt).toBeNull()
    store().patchItem('checklists', id, { items: draft.items.map(item => ({ ...item,
      state: 'checked', value: 'Recorded', completer: 'Reviewer', at: '2026-09-05',
    })), outcome: 'conditional-go' })
    store().patchItem('checklists', id, { completedAt: '2026-09-05' })
    expect(campaign().checklists.find(c => c.id === id)?.completedAt).toBeNull()
    store().patchItem('checklists', id, { conditionalLimits: 'Illustrative limits', completedAt: '2026-09-05' })
    const complete = campaign().checklists.find(c => c.id === id)!
    expect(complete.completedAt).toBeTruthy()
    store().patchItem('checklists', id, { items: [], completedAt: null })
    store().removeItem('checklists', id)
    expect(campaign().checklists.find(c => c.id === id)).toEqual(complete)
  })

  it('permits append-only drift notes without altering the frozen baseline', () => {
    const config = campaign().configs[0]
    const next = [...config.driftLog, { time: '2026-09-05', note: 'Observed drift, baseline unchanged' }]
    store().patchItem('configs', config.id, { driftLog: next })
    expect(campaign().configs[0]).toEqual({ ...config, driftLog: next })
    store().patchItem('configs', config.id, { driftLog: [] })
    expect(campaign().configs[0].driftLog).toEqual(next)
  })

  it('rejects issued imports without complete links and live attempts on draft cards', () => {
    const c = structuredClone(campaign())
    c.cards[0].conditionId = null
    expect(() => parseCampaignData({ rangeboardCampaign: 1, campaign: c })).toThrow('traceability')
    c.cards[0].conditionId = campaign().cards[0].conditionId
    c.cards[0].status = 'draft'
    expect(() => parseCampaignData({ rangeboardCampaign: 1, campaign: c })).toThrow('issued card version')
  })

  it('returns no allocated identity when a referenced creation is rejected', () => {
    const before = campaign()
    expect(store().addHypothesis('foreign-question')).toBe('')
    expect(store().addCard({ questionIds: ['foreign-question'] })).toBe('')
    expect(campaign()).toEqual(before)
  })
})


it('rejects broken adjudication and correction lineage on import', () => {
  const c = structuredClone(campaign())
  c.runs[0].adjudications[0].version = 4
  expect(() => parseCampaignData({ rangeboardCampaign: 1, campaign: c })).toThrow('sequential')
  const r = campaign().runs[0]
  const corrected = r.observations.map((o, i) => i === 0 ? { ...o, value: 42 } : o)
  store().amendRunObservations(r.id, corrected, 'Recorder', 'Source correction')
  const broken = structuredClone(campaign())
  broken.runs[0].observations[0].value = 55
  expect(() => parseCampaignData({ rangeboardCampaign: 1, campaign: broken })).toThrow('latest correction')
})


it('reports a rejected issue instead of success when another version is already issued', () => {
  const c = structuredClone(campaign())
  const old = c.cards[0]
  const reviewed = { ...old, id: 'reviewed-copy', version: 'v2.0', status: 'approved' as const,
    procedure: old.procedure.map(step => ({ ...step, observableCompletion: 'Completed' })),
  }
  c.cards.push(reviewed)
  store().loadCampaign(c)
  expect(store().issueCard(reviewed.id).length).toBeGreaterThan(0)
  expect(campaign().cards.find(card => card.id === reviewed.id)?.status).toBe('approved')
  expect(campaign().cards.find(card => card.id === old.id)?.status).toBe('issued')
})

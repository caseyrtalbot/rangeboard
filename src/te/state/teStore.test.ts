import { beforeEach, describe, expect, it } from 'vitest'
import { linkedRecordFill, useTeStore } from './teStore'
import { nextId, bumpMajor, bumpMinor, displayId } from '../model/ids'
import { deleteImpacts, hasPlaceholder } from '../validate'

function campaign() {
  const s = useTeStore.getState()
  return s.campaigns.find((c) => c.id === s.activeCampaignId)!
}

function prepareGates() {
  const st = useTeStore.getState()
  const c = campaign()
  st.patchCampaign({
    decision: { ...c.decision, authorizedDecisionOwner: 'Owner', boundedChoice: 'A or B',
      decisionDate: '2026-09-05', blockingUncertainty: 'Detection range', acceptanceConditions: 'Trial results' },
    charter: { ...c.charter, acceptance: { ...c.charter.acceptance, relyingOrganization: 'Test organization' } },
  })
  st.passQualificationGate()
  st.approveDesign(true)
}

function issueFixtureCard(id: string) {
  const st = useTeStore.getState()
  const card = campaign().cards.find(c => c.id === id)!
  const q = card.questionIds[0] ?? st.addQuestion()
  const m = card.measureIds[0] ?? st.addMeasure(q)
  const cfg = card.configId ?? st.addConfig()
  st.patchItem('measures', m, { frozen: true })
  st.patchItem('configs', cfg, { frozen: true })
  st.patchItem('cards', id, {
    purpose: 'Measure detection range', questionIds: [q], measureIds: [m], configId: cfg,
    threatId: card.threatId ?? st.addThreat(), conditionId: card.conditionId ?? st.addCondition(),
    procedure: [{ id: 'p1', action: 'Fly the route', role: 'red-threat-lead',
      observableCompletion: 'Route complete', canSilentlyInvalidate: false, isRecorderStartStop: false }],
    coldReaderAt: '2026-09-05', coldReaderBy: 'Reader', dryRunAt: '2026-09-05', dryRunBy: 'Lead',
  })
  prepareGates()
  expect(st.issueCard(id)).toEqual([])
}

beforeEach(() => {
  useTeStore.setState({ campaigns: [], activeCampaignId: null })
  useTeStore.getState().createCampaign('Test campaign', 'J401')
})

describe('id grammar', () => {
  it('allocates per-type monotonic sequences', () => {
    const a = nextId({}, 'J401', 'TC')
    expect(a.id).toBe('VLK-J401-TC-001')
    const b = nextId(a.seq, 'J401', 'TC')
    expect(b.id).toBe('VLK-J401-TC-002')
    const r = nextId(b.seq, 'J401', 'RUN')
    expect(r.id).toBe('VLK-J401-RUN-0001')
  })

  it('bumps versions and renders display ids', () => {
    expect(bumpMajor('v1.2')).toBe('v2.0')
    expect(bumpMinor('v1.2')).toBe('v1.3')
    expect(displayId('VLK-J401-TC-001', 'v1.2')).toBe('VLK-J401-TC-001-v1.2')
    expect(displayId('VLK-J401-RUN-0001')).toBe('VLK-J401-RUN-0001')
  })
})

describe('record creation', () => {
  it('allocates grammar ids for questions and measures', () => {
    const st = useTeStore.getState()
    const q1 = st.addQuestion()
    const q2 = st.addQuestion()
    expect(q1).toBe('VLK-J401-Q-001')
    expect(q2).toBe('VLK-J401-Q-002')
    const m = st.addMeasure(q1)
    expect(m).toBe('VLK-J401-M-001')
    expect(campaign().measures[0].questionId).toBe(q1)
  })

  it('gives cards an internal id plus a shared card code', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    const card = campaign().cards.find((c) => c.id === id)!
    expect(card.cardCode).toBe('VLK-J401-TC-001')
    expect(card.version).toBe('v1.0')
    expect(card.status).toBe('draft')
  })
})

describe('config duplication and version bumps', () => {
  it('duplicates the baseline, bumps minor, and clears the freeze', () => {
    const st = useTeStore.getState()
    const cfg = st.addConfig()
    st.patchItem('configs', cfg, {
      name: 'Baseline A',
      version: 'v1.2',
      hardwareAndSerials: 'radar SN 100',
      softwareVersions: 'C2 4.1',
      settingsAndModes: 'tight ROE',
      frozen: true,
      freezeTime: '2026-08-19T00:00:00Z',
      scenarioSnapshot: '{"name":"snap"}',
      driftLog: [{ time: '2026-08-19T00:00:00Z', note: 'captured' }],
    })
    const cloneId = st.duplicateConfig(cfg)!
    expect(cloneId).toBe('VLK-J401-CFG-002')
    const clone = campaign().configs.find((x) => x.id === cloneId)!
    expect(clone.name).toBe('Baseline A')
    expect(clone.hardwareAndSerials).toBe('radar SN 100')
    expect(clone.softwareVersions).toBe('C2 4.1')
    expect(clone.settingsAndModes).toBe('tight ROE')
    expect(clone.version).toBe('v1.3')
    expect(clone.frozen).toBe(false)
    expect(clone.freezeTime).toBe('')
    expect(clone.scenarioSnapshot).toBeNull()
    expect(clone.driftLog).toEqual([])
    // Source baseline is untouched.
    const src = campaign().configs.find((x) => x.id === cfg)!
    expect(src.frozen).toBe(true)
    expect(src.version).toBe('v1.2')
  })

  it('returns null for an unknown config', () => {
    expect(useTeStore.getState().duplicateConfig('nope')).toBeNull()
  })

  it('bumps a threat version by a minor step', () => {
    const st = useTeStore.getState()
    const thr = st.addThreat()
    st.bumpRecordVersion('threats', thr)
    expect(campaign().threats[0].version).toBe('v1.1')
    st.bumpRecordVersion('threats', thr)
    expect(campaign().threats[0].version).toBe('v1.2')
  })

  it('refuses to bump a frozen config', () => {
    const st = useTeStore.getState()
    const cfg = st.addConfig()
    st.patchItem('configs', cfg, { frozen: true })
    st.bumpRecordVersion('configs', cfg)
    expect(campaign().configs[0].version).toBe('v1.0')
    st.patchItem('configs', cfg, { frozen: false })
    st.bumpRecordVersion('configs', cfg)
    expect(campaign().configs[0].version).toBe('v1.0')
    expect(campaign().configs[0].frozen).toBe(true)
  })
})

describe('card lifecycle gates', () => {
  it('blocks issue until the card is complete', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    const blockers = st.issueCard(id)
    expect(blockers.length).toBeGreaterThan(0)
    expect(campaign().cards[0].status).toBe('draft')
  })

  it('issues a complete card and freezes it', () => {
    const st = useTeStore.getState()
    const q = st.addQuestion()
    const m = st.addMeasure(q)
    st.patchItem('measures', m, { frozen: true, truth: { primarySource: 'GPS truth pod', backupSource: '', independenceFromSut: 'separate receiver', timeToleranceS: 0.1} })
    const thr = st.addThreat()
    const cond = st.addCondition()
    const cfg = st.addConfig()
    st.patchItem('configs', cfg, { frozen: true })
    const id = st.addCard({
      title: 'Detection characterization',
      purpose: 'Measure first detection range.',
      questionIds: [q],
      measureIds: [m],
      threatId: thr,
      conditionId: cond,
      configId: cfg,
      procedure: [
        {
          id: 'p1',
          action: 'Launch the threat on the planned route.',
          role: 'red-threat-lead',
          observableCompletion: 'Threat airborne and on route.',
          canSilentlyInvalidate: false,
          isRecorderStartStop: false,
        },
      ],
      coldReaderAt: '2026-08-19T00:00:00Z',
      coldReaderBy: 'A. Reader',
      dryRunAt: '2026-08-19T00:00:00Z',
      dryRunBy: 'B. Runner',
    })
    prepareGates()
    const blockers = st.issueCard(id)
    expect(blockers).toEqual([])
    expect(campaign().cards.find((c) => c.id === id)!.status).toBe('issued')
  })

  it('revision supersedes the old version and keeps the card code', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    issueFixtureCard(id)
    const newId = st.reviseCard(id)!
    const c = campaign()
    const oldCard = c.cards.find((x) => x.id === id)!
    const newCard = c.cards.find((x) => x.id === newId)!
    expect(oldCard.status).toBe('superseded')
    expect(newCard.status).toBe('draft')
    expect(newCard.cardCode).toBe(oldCard.cardCode)
    expect(newCard.version).toBe('v2.0')
  })
})

describe('runs', () => {
  it('refuses a run from an unissued card', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    expect(st.createRunFromCard(id)).toBeNull()
  })

  it('creates versionless runs, marks events, and versions adjudications', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    // Exercise the gate before the execution actions.
    issueFixtureCard(id)
    const runId = st.createRunFromCard(id)!
    expect(runId).toBe('VLK-J401-RUN-0001')
    st.markRunEvent(runId, 'first-detection', 'radar')
    st.adjudicateRun(runId, 'valid', 'Board', 'clean run')
    st.patchItem('runs', runId, { allowedMeasureIds: campaign().cards[0].measureIds })
    st.adjudicateRun(runId, 'conditionally-valid', 'Board', 'late truth gap found')
    const run = campaign().runs[0]
    expect(run.events).toHaveLength(1)
    expect(run.validity).toBe('conditionally-valid')
    expect(run.adjudications).toHaveLength(2)
    expect(run.adjudications[0].validity).toBe('valid')
  })

  it('discarding a referenced run preserves the run and finding links', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    issueFixtureCard(id)
    const runId = st.createRunFromCard(id)!
    const findingId = st.addFinding()
    st.patchItem('findings', findingId, {
      supportingRunIds: [runId],
      contradictingRunIds: [runId],
    })
    st.discardRun(runId)
    const c = campaign()
    expect(c.runs).toHaveLength(1)
    const f = c.findings.find((x) => x.id === findingId)!
    expect(f.supportingRunIds).toContain(runId)
    expect(f.contradictingRunIds).toContain(runId)
  })

  it('links deviations both ways', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    issueFixtureCard(id)
    const runId = st.createRunFromCard(id)!
    const devId = st.addDeviation(runId)!
    const c = campaign()
    expect(c.deviations[0].id).toBe(devId)
    expect(c.runs[0].deviationIds).toContain(devId)
  })
})

function addIssuableCard() {
  const st = useTeStore.getState()
  const q = st.addQuestion()
  const m = st.addMeasure(q)
  st.patchItem('measures', m, { frozen: true, truth: { primarySource: 'GPS truth pod', backupSource: '', independenceFromSut: 'separate receiver', timeToleranceS: 0.1} })
  const thr = st.addThreat()
  const cond = st.addCondition()
  const cfg = st.addConfig()
  st.patchItem('configs', cfg, { frozen: true })
  prepareGates()
  return st.addCard({
    title: 'Detection characterization',
    purpose: 'Measure first detection range.',
    questionIds: [q],
    measureIds: [m],
    threatId: thr,
    conditionId: cond,
    configId: cfg,
    procedure: [
      {
        id: 'p1',
        action: 'Launch the threat on the planned route.',
        role: 'red-threat-lead',
        observableCompletion: 'Threat airborne and on route.',
        canSilentlyInvalidate: false,
        isRecorderStartStop: false,
      },
    ],
    coldReaderAt: '2026-08-19T00:00:00Z',
    coldReaderBy: 'A. Reader',
    dryRunAt: '2026-08-19T00:00:00Z',
    dryRunBy: 'B. Runner',
  })
}

describe('campaign phase lifecycle', () => {
  it('does not advance on a blocked issue', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    st.issueCard(id)
    expect(campaign().phase).toBe('candidate')
  })

  it('advances through ready, executing, and analyzing', () => {
    const st = useTeStore.getState()
    const id = addIssuableCard()
    expect(st.issueCard(id)).toEqual([])
    expect(campaign().phase).toBe('ready')
    const runId = st.createRunFromCard(id)!
    expect(campaign().phase).toBe('executing')
    st.adjudicateRun(runId, 'valid', 'Board', 'clean run')
    expect(campaign().phase).toBe('analyzing')
  })

  it('approveDesign after adjudicateRun leaves the phase at analyzing', () => {
    const st = useTeStore.getState()
    const id = addIssuableCard()
    st.issueCard(id)
    const runId = st.createRunFromCard(id)!
    st.adjudicateRun(runId, 'valid', 'Board', 'clean run')
    expect(campaign().phase).toBe('analyzing')
    st.approveDesign()
    expect(campaign().phase).toBe('analyzing')
    expect(campaign().designApprovedAt).not.toBeNull()
  })

  it('never moves backward', () => {
    const st = useTeStore.getState()
    const id = addIssuableCard()
    st.issueCard(id)
    const runId = st.createRunFromCard(id)!
    st.adjudicateRun(runId, 'valid', 'Board', 'clean run')
    expect(campaign().phase).toBe('analyzing')
    const second = addIssuableCard()
    st.issueCard(second)
    expect(campaign().phase).toBe('analyzing')
    st.markPackageDelivered()
    expect(campaign().phase).toBe('analyzing')
    expect(campaign().evidencePackage.deliveredAt).toBeNull()
    st.adjudicateRun(runId, 'conditionally-valid', 'Board', 'gap found')
    expect(campaign().phase).toBe('analyzing')
  })
})

describe('new-card defaults', () => {
  it('defaults owner from the test-conductor primary and copies storagePath and siteCalls from the last card', () => {
    const st = useTeStore.getState()
    st.addItem('roles', { id: 'r1', role: 'test-conductor', primary: 'C. Talbot', backup: '' })
    const first = st.addCard({ storagePath: '/data/j401', siteCalls: { start: 'GO', stop: 'CUT', pause: 'HOLD', abort: 'KNOCK IT OFF' } })
    expect(campaign().cards.find((c) => c.id === first)!.owner).toBe('C. Talbot')
    const second = st.addCard()
    const card = campaign().cards.find((c) => c.id === second)!
    expect(card.owner).toBe('C. Talbot')
    expect(card.storagePath).toBe('/data/j401')
    expect(card.siteCalls).toEqual({ start: 'GO', stop: 'CUT', pause: 'HOLD', abort: 'KNOCK IT OFF' })
  })

  it('patch values win over defaults', () => {
    const st = useTeStore.getState()
    st.addItem('roles', { id: 'r1', role: 'test-conductor', primary: 'C. Talbot', backup: '' })
    const id = st.addCard({ owner: 'B. Owner' })
    expect(campaign().cards.find((c) => c.id === id)!.owner).toBe('B. Owner')
  })
})

describe('createCardFromMatrixCell', () => {
  it('links the cell records and fills empty text from them', () => {
    const st = useTeStore.getState()
    const q = st.addQuestion()
    st.patchItem('questions', q, { wording: 'How far does detection reach?' })
    const m = st.addMeasure(q)
    st.patchItem('measures', m, {
      truth: { primarySource: 'GPS truth pod', backupSource: 'range radar', independenceFromSut: 'separate receiver', timeToleranceS: 0.5},
    })
    const thr = st.addThreat()
    st.patchItem('threats', thr, { redControlledVariables: 'ingress axis', blinding: 'operators blind to route' })
    const cond = st.addCondition()
    st.patchItem('conditions', cond, { name: 'Day clear', weatherAndIllumination: 'clear, day' })
    const cfg = st.addConfig()
    st.patchItem('configs', cfg, { name: 'Baseline A', settingsAndModes: 'tight ROE' })
    const cell = st.addMatrixCell()
    st.patchItem('matrix', cell, {
      questionId: q,
      configId: cfg,
      threatId: thr,
      conditionId: cond,
      measureIds: [m],
      orderOrBlock: 'randomized',
    })
    const cardId = st.createCardFromMatrixCell(cell)!
    const card = campaign().cards.find((c) => c.id === cardId)!
    expect(card.matrixCellId).toBe(cell)
    expect(card.questionIds).toEqual([q])
    expect(card.configId).toBe(cfg)
    expect(card.threatId).toBe(thr)
    expect(card.conditionId).toBe(cond)
    expect(card.measureIds).toEqual([m])
    expect(card.purpose).toBe('How far does detection reach?')
    expect(card.orderAndBlocking).toBe('randomized')
    expect(card.redControlled).toBe('ingress axis')
    expect(card.blinding).toBe('operators blind to route')
    expect(card.conditionNote).toContain('Day clear')
    expect(card.systemStateNote).toContain('Baseline A')
    expect(card.dataSources).toContain('GPS truth pod')
    expect(card.dataSources).toContain('range radar')
    expect(card.groundTruth).toContain('separate receiver')
    expect(card.commonTimeAndTolerance).toContain('0.5 s')
  })

  it('returns null for an unknown cell', () => {
    expect(useTeStore.getState().createCardFromMatrixCell('nope')).toBeNull()
  })
})

describe('createDiagnosticCard', () => {
  it('creates a draft card titled from the anomaly and writes the code back', () => {
    const st = useTeStore.getState()
    const anomId = st.addAnomaly(null)
    st.patchItem('anomalies', anomId, { observation: 'Track dropped at 2 km' })
    const cardId = st.createDiagnosticCard(anomId)!
    const c = campaign()
    const card = c.cards.find((x) => x.id === cardId)!
    expect(card.status).toBe('draft')
    expect(card.title).toBe('Diagnostic: Track dropped at 2 km')
    expect(c.anomalies.find((a) => a.id === anomId)!.verificationTest).toBe(card.cardCode)
  })

  it('returns null for an unknown anomaly', () => {
    expect(useTeStore.getState().createDiagnosticCard('nope')).toBeNull()
  })
})

describe('createActionFromFinding', () => {
  it('links the finding and copies the recommended action', () => {
    const st = useTeStore.getState()
    st.addItem('decisionRights', {
      id: 'dr1',
      decisionType: 'customer action',
      accountableAuthority: 'Decision Owner',
      performer: '',
      requiredReviewers: '',
      responseTimeLimit: '',
      escalationPath: '',
    })
    const findingId = st.addFinding()
    st.patchItem('findings', findingId, { recommendedAction: 'Retest under rain.' })
    const actionId = st.createActionFromFinding(findingId)!
    const action = campaign().actions.find((a) => a.id === actionId)!
    expect(action.findingId).toBe(findingId)
    expect(action.requiredWork).toBe('Retest under rain.')
    expect(action.decisionOwner).toBe('Decision Owner')
    expect(action.status).toBe('open')
  })

  it('returns null for an unknown finding', () => {
    expect(useTeStore.getState().createActionFromFinding('nope')).toBeNull()
  })
})

describe('linkedRecordFill', () => {
  it('never overwrites user text unless all is set', () => {
    const st = useTeStore.getState()
    const thr = st.addThreat()
    st.patchItem('threats', thr, { redControlledVariables: 'ingress axis', redFixedVariables: 'payload' })
    const cardId = st.addCard({ threatId: thr, redControlled: 'user text' })
    const c = campaign()
    const card = c.cards.find((x) => x.id === cardId)!
    const fill = linkedRecordFill(c, card)
    expect(fill.redControlled).toBeUndefined()
    expect(fill.redFixed).toBe('payload')
    const refill = linkedRecordFill(c, card, true)
    expect(refill.redControlled).toBe('ingress axis')
  })
})

describe('validation helpers', () => {
  it('detects unresolved placeholders', () => {
    expect(hasPlaceholder('fly the [planned route]')).toBe(true)
    expect(hasPlaceholder('fly the planned route')).toBe(false)
  })
})

describe('startFromCampaign', () => {
  function buildSource() {
    const st = useTeStore.getState()
    st.patchCampaign({
      charter: {
        ...campaign().charter,
        sponsor: 'JIATF',
        requestingOrganization: 'JIATF South',
        customerDecisionOwner: 'COL Decision',
        evidenceAcceptanceAuthority: 'Dr. Evidence',
        deploymentStrategist: 'C. Talbot',
        contractAndFundingOwner: 'K. Funds',
        dataSecurityReleaseClass: 'CUI',
        exactRequest: 'Tell us if the radar works.',
        dateReceived: '2026-08-01',
        deliverablesDate: '2026-12-01',
        acceptance: {
          relyingOrganization: 'JIATF South',
          methodApprovalAuthority: 'Dr. Method',
          requiredWitnesses: 'MAJ Witness',
          evidenceStandard: '20 valid reps',
          rejectionConditions: 'no truth source',
        },
      },
    })
    st.addItem('roles', { id: 'r1', role: 'test-conductor', primary: 'C. Talbot', backup: '' })
    st.addItem('authorities', {
      id: 'a1',
      authorityType: 'FAA Part 107 waiver',
      owner: 'K. Funds',
      dueDate: '2026-09-01',
      operatingLimits: 'Below 400 ft AGL',
      evidence: 'waiver PDF on file',
      status: 'active',
      leadTimeNote: '1 to 3 months',
    })
    st.addItem('schedule', {
      id: 's1',
      tMinusDays: 30,
      name: 'Design approved',
      owner: 'C. Talbot',
      done: true,
      notes: '',
    })
    st.addItem('registers', {
      id: 'reg1',
      kind: 'claim',
      statement: 'Vendor claims 5 km detection.',
      sourceAndDate: 'brochure 2026',
      relevance: '',
      rank: null,
      disposition: 'contradicted',
      dispositionNote: 'missed at 3 km',
      notes: '',
    })
    const q = st.addQuestion()
    st.patchItem('questions', q, {
      wording: 'How far does detection reach?',
      requiredAnswerDate: '2026-11-01',
      frozen: true,
      disposition: 'answered',
      evidenceLevel: 'mission-conditions',
      dispositionNote: 'done',
    })
    const m = st.addMeasure(q)
    st.patchItem('measures', m, {
      name: 'Probability of detection',
      frozen: true,
      thresholdApproved: true,
      threshold: 0.9,
      hypothesisIds: [st.addHypothesis(q)],
    })
    const cfg = st.addConfig()
    st.patchItem('configs', cfg, {
      name: 'Baseline A',
      frozen: true,
      freezeTime: '2026-08-10T00:00:00Z',
      functionalCheckResult: 'pass',
      releasedBy: 'C. Talbot',
      scenarioSnapshot: '{"x":1}',
      driftLog: [{ time: '2026-08-11T00:00:00Z', note: 'moved sensor' }],
    })
    st.addThreat()
    st.addCondition()
    st.addFactor()
    // Evidence that must never copy.
    const cardId = st.addCard({ title: 'Card A' })
    issueFixtureCard(cardId)
    st.createRunFromCard(cardId)
    st.addFinding()
    return campaign()
  }

  it('copies structure with reallocated ids and records ancestry', () => {
    const src = buildSource()
    const st = useTeStore.getState()
    const newId = st.startFromCampaign(src.id, 'Follow-on', 'F2')!
    const next = campaign()
    expect(next.id).toBe(newId)
    expect(next.sourceCampaignId).toBe(src.id)
    expect(next.code).toBe('F2')
    // People and organizations copy; the acceptance block copies whole.
    expect(next.charter.customerDecisionOwner).toBe('COL Decision')
    expect(next.charter.requestingOrganization).toBe('JIATF South')
    expect(next.charter.acceptance.evidenceStandard).toBe('20 valid reps')
    // Campaign-specific facts and dates never copy.
    expect(next.charter.exactRequest).toBe('')
    expect(next.charter.dateReceived).toBe('')
    expect(next.charter.deliverablesDate).toBe('')
    // Ids reallocate under the new code; question links remap.
    expect(next.questions[0].id).toBe('VLK-F2-Q-001')
    expect(next.questions[0].id).not.toBe(src.questions[0].id)
    expect(next.measures[0].id).toBe('VLK-F2-M-001')
    expect(next.measures[0].questionId).toBe(next.questions[0].id)
    expect(next.roles).toHaveLength(1)
    expect(next.factors).toHaveLength(1)
    expect(next.threats[0].version).toBe('v1.0')
  })

  it('never copies evidence, freezes, dispositions, or done flags', () => {
    const src = buildSource()
    useTeStore.getState().startFromCampaign(src.id, 'Follow-on', 'F2')
    const next = campaign()
    expect(next.cards).toHaveLength(0)
    expect(next.runs).toHaveLength(0)
    expect(next.findings).toHaveLength(0)
    expect(next.deviations).toHaveLength(0)
    expect(next.anomalies).toHaveLength(0)
    expect(next.checklists).toHaveLength(0)
    expect(next.gonogos).toHaveLength(0)
    expect(next.actions).toHaveLength(0)
    expect(next.debriefs).toHaveLength(0)
    expect(next.frames).toHaveLength(0)
    expect(next.evidencePackage.sections.every((s) => s.content === '')).toBe(true)
    // Questions: skeletons only.
    expect(next.questions[0].wording).toBe('How far does detection reach?')
    expect(next.questions[0].frozen).toBe(false)
    expect(next.questions[0].disposition).toBeNull()
    expect(next.questions[0].requiredAnswerDate).toBe('')
    // Measures: unfrozen, approval cleared, hypothesis links cleared.
    expect(next.measures[0].frozen).toBe(false)
    expect(next.measures[0].thresholdApproved).toBe(false)
    expect(next.measures[0].hypothesisIds).toEqual([])
    // Configs: unfrozen with the snapshot and drift log cleared.
    expect(next.configs[0].frozen).toBe(false)
    expect(next.configs[0].freezeTime).toBe('')
    expect(next.configs[0].functionalCheckResult).toBe('')
    expect(next.configs[0].scenarioSnapshot).toBeNull()
    expect(next.configs[0].driftLog).toEqual([])
    // Authorities reset; approval evidence never copies.
    expect(next.authorities[0].status).toBe('pending')
    expect(next.authorities[0].dueDate).toBe('')
    expect(next.authorities[0].evidence).toBe('')
    expect(next.authorities[0].operatingLimits).toBe('Below 400 ft AGL')
    // Schedule keeps offsets, clears done.
    expect(next.schedule[0].tMinusDays).toBe(30)
    expect(next.schedule[0].done).toBe(false)
    // Register dispositions clear: a new campaign has tested nothing.
    expect(next.registers[0].statement).toBe('Vendor claims 5 km detection.')
    expect(next.registers[0].disposition).toBeNull()
    expect(next.registers[0].dispositionNote).toBe('')
    // The source campaign is untouched.
    const srcAfter = useTeStore.getState().campaigns.find((c) => c.id === src.id)!
    expect(srcAfter.cards).toHaveLength(1)
    expect(srcAfter.measures[0].frozen).toBe(true)
  })

  it('returns null for an unknown source', () => {
    expect(useTeStore.getState().startFromCampaign('nope')).toBeNull()
  })
})

describe('applyPreset', () => {
  it('blank records the pick and seeds nothing', async () => {
    await useTeStore.getState().applyPreset('blank')
    const c = campaign()
    expect(c.presetKey).toBe('blank')
    expect(c.questions).toHaveLength(0)
    expect(c.measures).toHaveLength(0)
    expect(c.cards).toHaveLength(0)
  })

  it('sensor characterization seeds structure without fabricated facts', async () => {
    await useTeStore.getState().applyPreset('sensor-characterization')
    const c = campaign()
    expect(c.presetKey).toBe('sensor-characterization')
    expect(c.charter.engagementType).toBe('characterization')
    expect(c.charter.valkrynTasking).toBe('characterize')
    expect(c.questions).toHaveLength(1)
    // Placeholder wording, so nothing reads as a real campaign fact.
    expect(c.questions[0].wording).toContain('[')
    expect(c.measures).toHaveLength(6)
    for (const m of c.measures) {
      expect(m.dictKey).not.toBe('')
      expect(m.questionId).toBe(c.questions[0].id)
      // No fabricated performance facts: no thresholds, nothing approved or frozen.
      expect(m.threshold).toBeNull()
      expect(m.thresholdApproved).toBe(false)
      expect(m.frozen).toBe(false)
    }
    expect(c.cards).toHaveLength(1)
    const card = c.cards[0]
    expect(card.status).toBe('draft')
    expect(card.questionIds).toEqual([c.questions[0].id])
    // Template dict keys relink to the seeded campaign measures.
    expect(card.measureIds.sort()).toEqual(c.measures.map((m) => m.id).sort())
    // The card gate still blocks the draft: placeholders are intended.
    expect(useTeStore.getState().issueCard(card.id).length).toBeGreaterThan(0)
  })

  it('radar comparison seeds two configs and a baseline plus delta matrix', async () => {
    await useTeStore.getState().applyPreset('radar-comparison')
    const c = campaign()
    expect(c.charter.engagementType).toBe('comparison')
    expect(c.configs).toHaveLength(2)
    expect(c.configs.every((cfg) => cfg.name.includes('['))).toBe(true)
    expect(c.matrix).toHaveLength(2)
    expect(c.matrix[0].method).toBe('baseline comparison')
    expect(c.matrix[1].method).toBe('comparison')
    expect(c.matrix[0].configId).not.toBe(c.matrix[1].configId)
  })

  it('ew resilience seeds a contested condition and an adaptive threat skeleton', async () => {
    await useTeStore.getState().applyPreset('ew-resilience')
    const c = campaign()
    expect(c.conditions).toHaveLength(1)
    expect(c.conditions[0].emEnvironment).toBe('contested')
    expect(c.threats).toHaveLength(1)
    expect(c.threats[0].opforMode).toBe('bounded-adaptive')
    expect(c.cards).toHaveLength(1)
  })
})

describe('deleteImpacts', () => {
  it('returns nothing for an unreferenced record', () => {
    const st = useTeStore.getState()
    const q = st.addQuestion()
    const m = st.addMeasure(q)
    // The measure references the question, so the question is in use.
    expect(deleteImpacts(campaign(), 'measures', m)).toEqual([])
    expect(deleteImpacts(campaign(), 'questions', q)).toEqual(['1 measure'])
  })

  it('lists every referrer of a measure', () => {
    const st = useTeStore.getState()
    const q = st.addQuestion()
    const m = st.addMeasure(q)
    const cell = st.addMatrixCell()
    st.patchItem('matrix', cell, { measureIds: [m] })
    const cardId = st.addCard({ title: 'Card A', measureIds: [m] })
    issueFixtureCard(cardId)
    st.createRunFromCard(cardId)
    const f = st.addFinding()
    st.patchItem('findings', f, { measureIds: [m] })
    expect(deleteImpacts(campaign(), 'measures', m)).toEqual([
      '1 matrix cell',
      '1 card',
      '1 finding',
      '1 run',
    ])
  })

  it('protects a claim named by hypotheses, cards, findings, or the blocking uncertainty', () => {
    const st = useTeStore.getState()
    st.addItem('registers', {
      id: 'clm1',
      kind: 'claim',
      statement: 'Vendor claims 5 km detection.',
      sourceAndDate: '',
      relevance: '',
      rank: null,
      disposition: null,
      dispositionNote: '',
      notes: '',
    })
    const q = st.addQuestion()
    const h = st.addHypothesis(q)
    st.patchItem('hypotheses', h, { claimId: 'clm1' })
    expect(deleteImpacts(campaign(), 'registers', 'clm1')).toEqual(['1 hypothesis'])
    st.addItem('registers', {
      id: 'unk1',
      kind: 'unknown',
      statement: 'Night detection range unknown.',
      sourceAndDate: '',
      relevance: '',
      rank: 1,
      disposition: null,
      dispositionNote: '',
      notes: '',
    })
    st.patchCampaign({
      decision: { ...campaign().decision, blockingUncertainty: 'Night detection range unknown.' },
    })
    expect(deleteImpacts(campaign(), 'registers', 'unk1')).toEqual(['the blocking uncertainty'])
  })

  it('protects records a card or run still uses', () => {
    const st = useTeStore.getState()
    const thr = st.addThreat()
    const cond = st.addCondition()
    const cfg = st.addConfig()
    const cardId = st.addCard({ title: 'Card A', threatId: thr, conditionId: cond, configId: cfg })
    expect(deleteImpacts(campaign(), 'threats', thr)).toEqual(['1 card'])
    expect(deleteImpacts(campaign(), 'conditions', cond)).toEqual(['1 card'])
    expect(deleteImpacts(campaign(), 'configs', cfg)).toEqual(['1 card'])
    expect(deleteImpacts(campaign(), 'cards', cardId)).toEqual([])
    issueFixtureCard(cardId)
    st.createRunFromCard(cardId)
    expect(deleteImpacts(campaign(), 'cards', cardId)).toEqual(['1 run'])
    expect(deleteImpacts(campaign(), 'threats', thr)).toEqual(['1 card', '1 run'])
  })
})

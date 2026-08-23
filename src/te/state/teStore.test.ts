import { beforeEach, describe, expect, it } from 'vitest'
import { linkedRecordFill, useTeStore } from './teStore'
import { nextId, bumpMajor, bumpMinor, displayId } from '../model/ids'
import { hasPlaceholder } from '../validate'

function campaign() {
  const s = useTeStore.getState()
  return s.campaigns.find((c) => c.id === s.activeCampaignId)!
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
    expect(campaign().configs[0].version).toBe('v1.1')
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
    st.patchItem('measures', m, { frozen: true, truth: { primarySource: 'GPS truth pod', backupSource: '', independenceFromSut: 'separate receiver', timeToleranceS: 0.1, accuracyNote: '' } })
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
    const blockers = st.issueCard(id)
    expect(blockers).toEqual([])
    expect(campaign().cards.find((c) => c.id === id)!.status).toBe('issued')
  })

  it('revision supersedes the old version and keeps the card code', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
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
    // Force-issue for the run test; gate behavior is covered above.
    st.patchItem('cards', id, { status: 'issued' })
    const runId = st.createRunFromCard(id)!
    expect(runId).toBe('VLK-J401-RUN-0001')
    st.markRunEvent(runId, 'first-detection', 'radar')
    st.adjudicateRun(runId, 'valid', 'Board', 'clean run')
    st.adjudicateRun(runId, 'conditionally-valid', 'Board', 'late truth gap found')
    const run = campaign().runs[0]
    expect(run.events).toHaveLength(1)
    expect(run.validity).toBe('conditionally-valid')
    expect(run.adjudications).toHaveLength(2)
    expect(run.adjudications[0].validity).toBe('valid')
  })

  it('discarding a run strips it from finding run links', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    st.patchItem('cards', id, { status: 'issued' })
    const runId = st.createRunFromCard(id)!
    const findingId = st.addFinding()
    st.patchItem('findings', findingId, {
      supportingRunIds: [runId],
      contradictingRunIds: [runId],
    })
    st.discardRun(runId)
    const c = campaign()
    expect(c.runs).toHaveLength(0)
    const f = c.findings.find((x) => x.id === findingId)!
    expect(f.supportingRunIds).not.toContain(runId)
    expect(f.contradictingRunIds).not.toContain(runId)
  })

  it('links deviations both ways', () => {
    const st = useTeStore.getState()
    const id = st.addCard({ title: 'Card A' })
    st.patchItem('cards', id, { status: 'issued' })
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
  st.patchItem('measures', m, { frozen: true, truth: { primarySource: 'GPS truth pod', backupSource: '', independenceFromSut: 'separate receiver', timeToleranceS: 0.1, accuracyNote: '' } })
  const thr = st.addThreat()
  const cond = st.addCondition()
  const cfg = st.addConfig()
  st.patchItem('configs', cfg, { frozen: true })
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
    expect(campaign().phase).toBe('decision-ready')
    expect(campaign().evidencePackage.deliveredAt).not.toBeNull()
    st.adjudicateRun(runId, 'conditionally-valid', 'Board', 'gap found')
    expect(campaign().phase).toBe('decision-ready')
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
      truth: { primarySource: 'GPS truth pod', backupSource: 'range radar', independenceFromSut: 'separate receiver', timeToleranceS: 0.5, accuracyNote: '' },
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

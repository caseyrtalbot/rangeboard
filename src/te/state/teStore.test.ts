import { beforeEach, describe, expect, it } from 'vitest'
import { useTeStore } from './teStore'
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

describe('validation helpers', () => {
  it('detects unresolved placeholders', () => {
    expect(hasPlaceholder('fly the [planned route]')).toBe(true)
    expect(hasPlaceholder('fly the planned route')).toBe(false)
  })
})

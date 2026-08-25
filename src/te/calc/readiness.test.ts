/**
 * Campaign readiness tests (SPEC section 6.2). Stage gate completion, the
 * stepper status, the artifact list, and the weighted overall percent.
 */

import { describe, expect, it } from 'vitest'
import type { TeCampaign } from '../model/types'
import {
  emptyCampaign,
  emptyCard,
  emptyFinding,
  emptyHypothesis,
  emptyMatrixCell,
  emptyMeasure,
  emptyQuestion,
  emptyRun,
} from '../model/empty'
import {
  analyzePct,
  artifactList,
  campaignReadiness,
  cardsPct,
  deliverPct,
  designPct,
  executePct,
  qualifyPct,
  stageStatus,
} from './readiness'

function makeCampaign(): TeCampaign {
  return emptyCampaign('Readiness test', 'T1')
}

function fillQualify(c: TeCampaign): void {
  c.decision.authorizedDecisionOwner = 'COL Reyes'
  c.decision.boundedChoice = 'Field A or keep B'
  c.decision.decisionDate = '2026-10-01'
  c.decision.blockingUncertainty = 'Detection range in rain'
  c.decision.acceptanceConditions = '20 valid runs'
  c.charter.acceptance.relyingOrganization = 'JIATF'
}

describe('qualifyPct', () => {
  it('is 0 on an empty campaign (all six checks open)', () => {
    expect(qualifyPct(makeCampaign())).toBe(0)
  })

  it('scales with satisfied checks', () => {
    const c = makeCampaign()
    c.decision.authorizedDecisionOwner = 'COL Reyes'
    c.decision.boundedChoice = 'Field A or keep B'
    c.decision.decisionDate = '2026-10-01'
    expect(qualifyPct(c)).toBe(50)
  })

  it('is 100 when every check passes', () => {
    const c = makeCampaign()
    fillQualify(c)
    expect(qualifyPct(c)).toBe(100)
  })

  it('is 100 once the gate has been passed', () => {
    const c = makeCampaign()
    c.qualificationPassedAt = '2026-08-01T00:00:00Z'
    expect(qualifyPct(c)).toBe(100)
  })

  it('clamps at 0 when infeasible items add extra blockers', () => {
    const c = makeCampaign()
    c.feasibility.push({
      id: 'f1',
      item: 'Range access',
      score: 'infeasible',
      owner: '',
      fallback: '',
      effectOnConclusions: '',
    })
    expect(qualifyPct(c)).toBe(0)
  })
})

describe('designPct', () => {
  it('is 0 with no design records', () => {
    expect(designPct(makeCampaign())).toBe(0)
  })

  it('counts record presence and lint cleanliness', () => {
    const c = makeCampaign()
    c.questions.push(emptyQuestion('q1'))
    const m = emptyMeasure('m1', 'q1')
    m.truth.primarySource = 'Truth radar'
    c.measures.push(m)
    // questions, measures, lint-clean = 3 of 7 parts
    expect(designPct(c)).toBe(43)
  })

  it('is 100 once the design is approved', () => {
    const c = makeCampaign()
    c.designApprovedAt = '2026-08-01T00:00:00Z'
    expect(designPct(c)).toBe(100)
  })
})

describe('cardsPct and stage status', () => {
  it('is 0 with no cards, then the issued fraction of active cards', () => {
    const c = makeCampaign()
    expect(cardsPct(c)).toBe(0)
    c.cards.push(emptyCard('card1', 'TC-001'))
    c.cards.push(emptyCard('card2', 'TC-002'))
    c.cards[0].status = 'issued'
    expect(cardsPct(c)).toBe(50)
  })

  it('ignores superseded cards', () => {
    const c = makeCampaign()
    c.cards.push(emptyCard('card1', 'TC-001'))
    c.cards.push(emptyCard('card2', 'TC-001'))
    c.cards[0].status = 'superseded'
    c.cards[1].status = 'issued'
    expect(cardsPct(c)).toBe(100)
    expect(stageStatus(c, 'cards')).toBe('good')
  })

  it('marks drafted-but-unissued cards as warn', () => {
    const c = makeCampaign()
    c.cards.push(emptyCard('card1', 'TC-001'))
    expect(stageStatus(c, 'cards')).toBe('warn')
  })
})

describe('executePct', () => {
  it('is the adjudicated fraction of runs', () => {
    const c = makeCampaign()
    c.cards.push(emptyCard('card1', 'TC-001'))
    expect(executePct(c)).toBe(0)
    c.runs.push(emptyRun('r1', c.cards[0]))
    c.runs.push(emptyRun('r2', c.cards[0]))
    c.runs[0].validity = 'valid'
    expect(executePct(c)).toBe(50)
    expect(stageStatus(c, 'execute')).toBe('warn')
    c.runs[1].validity = 'invalid'
    expect(executePct(c)).toBe(100)
    expect(stageStatus(c, 'execute')).toBe('good')
  })
})

describe('analyzePct', () => {
  it('is 0 before any adjudicated run', () => {
    const c = makeCampaign()
    c.questions.push(emptyQuestion('q1'))
    c.hypotheses.push(emptyHypothesis('h1', 'q1'))
    expect(analyzePct(c)).toBe(0)
  })

  it('is the settled-outcome fraction of hypotheses', () => {
    const c = makeCampaign()
    c.cards.push(emptyCard('card1', 'TC-001'))
    c.runs.push(emptyRun('r1', c.cards[0]))
    c.runs[0].validity = 'valid'
    c.questions.push(emptyQuestion('q1'))
    c.hypotheses.push(emptyHypothesis('h1', 'q1'))
    c.hypotheses.push(emptyHypothesis('h2', 'q1'))
    c.hypotheses[0].outcome = 'supported'
    expect(analyzePct(c)).toBe(50)
  })

  it('is 100 with adjudicated runs and no hypotheses', () => {
    const c = makeCampaign()
    c.cards.push(emptyCard('card1', 'TC-001'))
    c.runs.push(emptyRun('r1', c.cards[0]))
    c.runs[0].validity = 'valid'
    expect(analyzePct(c)).toBe(100)
  })
})

describe('deliverPct', () => {
  it('scores package sections fractionally without findings', () => {
    const c = makeCampaign()
    for (let i = 0; i < 10; i++) c.evidencePackage.sections[i].content = 'text'
    // (0 + 0 + 0 + 10/20) / 4 = 12.5 -> 13
    expect(deliverPct(c)).toBe(13)
  })

  it('credits clean findings and a clean closeout', () => {
    const c = makeCampaign()
    const f = emptyFinding('fnd1')
    f.statement = 'System detects Group 1 targets in rain.'
    f.questionId = 'q1'
    f.supportingRunIds = ['r1']
    f.configId = 'cfg1'
    f.measureIds = ['m1']
    f.appliesTo = 'Group 1, day, rain'
    c.findings.push(f)
    // findings exist + clean findings + clean closeout (no questions, claims,
    // or open actions) + 0/20 sections = 3/4
    expect(deliverPct(c)).toBe(75)
  })

  it('is 100 once delivered', () => {
    const c = makeCampaign()
    c.evidencePackage.deliveredAt = '2026-08-01T00:00:00Z'
    expect(deliverPct(c)).toBe(100)
  })
})

describe('artifactList', () => {
  it('reports missing states with no data', () => {
    const arts = artifactList(makeCampaign())
    const byKey = Object.fromEntries(arts.map((a) => [a.key, a]))
    expect(byKey.charter.state).toBe('missing')
    expect(byKey.decision.detail).toBe('0/5')
    expect(byKey.package.detail).toBe('0/20')
    expect(byKey.package.state).toBe('missing')
  })

  it('tracks measures with truth sources as n/m', () => {
    const c = makeCampaign()
    c.questions.push(emptyQuestion('q1'))
    const m1 = emptyMeasure('m1', 'q1')
    m1.truth.primarySource = 'Truth radar'
    const m2 = emptyMeasure('m2', 'q1')
    c.measures.push(m1, m2)
    const measures = artifactList(c).find((a) => a.key === 'measures')
    expect(measures?.detail).toBe('1/2')
    expect(measures?.state).toBe('partial')
  })

  it('requires a baseline row for a done matrix', () => {
    const c = makeCampaign()
    c.matrix.push(emptyMatrixCell('cell1'))
    let matrix = artifactList(c).find((a) => a.key === 'matrix')
    expect(matrix?.state).toBe('partial')
    c.matrix[0].method = 'baseline'
    matrix = artifactList(c).find((a) => a.key === 'matrix')
    expect(matrix?.state).toBe('done')
  })

  it('counts risks from nonempty lines and assumptions from the register', () => {
    const c = makeCampaign()
    c.charter.majorRisks = 'Weather delay\n\nRange closure\n'
    c.registers.push({
      id: 'reg1',
      kind: 'assumption',
      statement: 'Truth radar stays independent',
      sourceAndDate: '',
      relevance: '',
      rank: null,
      disposition: null,
      dispositionNote: '',
      notes: '',
    })
    const arts = artifactList(c)
    expect(arts.find((a) => a.key === 'risks')?.detail).toBe('2')
    expect(arts.find((a) => a.key === 'assumptions')?.detail).toBe('1')
  })
})

describe('campaignReadiness', () => {
  it('weights stage completion into one percent', () => {
    const c = makeCampaign()
    c.qualificationPassedAt = '2026-08-01T00:00:00Z'
    // qualify 100 * weight 3 over total weight 14 = 21.4 -> 21
    expect(campaignReadiness(c).pct).toBe(21)
  })

  it('is 0 on an empty campaign and 100 when every stage completes', () => {
    const empty = makeCampaign()
    expect(campaignReadiness(empty).pct).toBe(0)

    const c = makeCampaign()
    fillQualify(c)
    c.qualificationPassedAt = '2026-08-01T00:00:00Z'
    c.designApprovedAt = '2026-08-02T00:00:00Z'
    c.cards.push(emptyCard('card1', 'TC-001'))
    c.cards[0].status = 'issued'
    c.runs.push(emptyRun('r1', c.cards[0]))
    c.runs[0].validity = 'valid'
    c.evidencePackage.deliveredAt = '2026-08-03T00:00:00Z'
    expect(campaignReadiness(c).pct).toBe(100)
  })

  it('returns one entry per stage with a status', () => {
    const r = campaignReadiness(makeCampaign())
    expect(r.stages.map((s) => s.id)).toEqual([
      'campaign',
      'design',
      'cards',
      'execute',
      'analyze',
      'deliver',
    ])
    for (const s of r.stages) expect(['good', 'warn', 'neutral']).toContain(s.status)
  })
})

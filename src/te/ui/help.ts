/**
 * Hover-help texts sourced from the doctrine masters, and one-line phase
 * intros for the guided stepper. Keys are stable; panels reference them
 * through HELP so wording lives in one place.
 */

import type { TePhaseTab } from '../state/teStore'
import type { TeCampaign } from '../model/types'

/** Every distinct person named in the campaign role table. */
export function rolePeople(campaign: TeCampaign): string[] {
  const out = new Set<string>()
  for (const r of campaign.roles) {
    for (const name of [r.primary, r.backup]) {
      if (name.trim() !== '') out.add(name.trim())
    }
  }
  return [...out]
}

/**
 * Every distinct name typed into a person-bearing string field anywhere in
 * the campaign. Trimmed, deduped, sorted. Feeds PersonField candidate pools.
 */
export function allPeople(campaign: TeCampaign): string[] {
  const out = new Set<string>()
  const add = (name: string) => {
    const n = name.trim()
    if (n !== '') out.add(n)
  }
  for (const r of campaign.roles) {
    add(r.primary)
    add(r.backup)
  }
  const ch = campaign.charter
  add(ch.customerDecisionOwner)
  add(ch.evidenceAcceptanceAuthority)
  add(ch.deploymentStrategist)
  add(ch.contractAndFundingOwner)
  add(ch.acceptance.methodApprovalAuthority)
  for (const cm of ch.commitments) add(cm.owner)
  add(campaign.decision.authorizedDecisionOwner)
  add(campaign.decision.actionAuthority)
  for (const s of campaign.schedule) add(s.owner)
  for (const f of campaign.feasibility) add(f.owner)
  for (const a of campaign.authorities) add(a.owner)
  for (const d of campaign.decisionRights) {
    add(d.accountableAuthority)
    add(d.performer)
    add(d.requiredReviewers)
    add(d.escalationPath)
  }
  for (const card of campaign.cards) {
    add(card.owner)
    add(card.approvers)
    add(card.operators)
  }
  for (const run of campaign.runs) {
    for (const rr of run.roles) add(rr.person)
    for (const adj of run.adjudications) add(adj.by)
  }
  for (const chk of campaign.checklists) {
    for (const it of chk.items) add(it.completer)
  }
  for (const dev of campaign.deviations) add(dev.approver)
  for (const an of campaign.anomalies) add(an.owner)
  for (const fnd of campaign.findings) add(fnd.approvers)
  for (const act of campaign.actions) {
    add(act.decisionOwner)
    add(act.executionOwner)
  }
  for (const g of campaign.gonogos) add(g.approvers)
  for (const cfg of campaign.configs) add(cfg.releasedBy)
  for (const db of campaign.debriefs) {
    for (const imp of db.improvements) add(imp.owner)
  }
  return [...out].sort((a, b) => a.localeCompare(b))
}

/** Accountable authority from the decision-rights row for one decision type, or ''. */
export function decisionRightHolder(campaign: TeCampaign, decisionType: string): string {
  const row = campaign.decisionRights.find((d) => d.decisionType === decisionType)
  return row ? row.accountableAuthority.trim() : ''
}

export const HELP: Record<string, string> = {
  'qualification-gate':
    'No decision owner, no campaign. The charter names who decides, what they decide, and by when.',
  'design-gate':
    'Design completes only when every question has a measure, every measure has a truth source, and the relying organization accepts the evidence standard.',
  'card-issue':
    'No issued card, no live run. A card that fails the cold reader or dry run test is not ready.',
  'cold-reader':
    'A person who did not write the card reads it cold. If they cannot run it as written, the card is not ready.',
  'dry-run':
    'Walk the full procedure without the live threat. Every step must complete as written.',
  prediction: 'Record the prediction before the test. Post hoc result hunting is prohibited.',
  thresholds:
    'A threshold is not part of the measure. Without a customer approved threshold the app suppresses pass and fail and characterizes instead.',
  'run-validity':
    'Assign one status after validation: valid, conditionally valid, or invalid. No status means the run is not available for analysis.',
  'conditionally-valid': 'List the allowed and the prohibited uses.',
  deviation: 'Never edit the card to match the run. Record the difference as a deviation.',
  'immediate-debrief': 'Ten minutes, observations only. Do not form campaign conclusions.',
  'next-action': 'The daily review ends in exactly one next action.',
  'question-priority':
    'P1: the decision cannot be supported without an answer. P2: the answer changes risk or configuration. P3: understanding only.',
  'evidence-ladder':
    'Observation, calculation, interpretation, recommendation, decision. Never merge levels.',
  findings: 'Valkryn recommends from evidence. The authorized organization decides.',
  anomaly:
    'A vendor statement may be evidence about mechanism. It is not proof of root cause.',
  'pre-run-release': 'If any answer is unknown, hold the run.',
  hypothesis:
    'Every hypothesis names a result that would refute it. A hypothesis that cannot fail is not testable.',
  'hypothesis-question':
    'New hypotheses attach to this question. Every hypothesis belongs to a question.',
  'security-class': 'CUI is the doctrine floor for release. Confirm the class with the customer security authority.',
  'authority-lead-time':
    'External approvals sit on the critical path. Start the longest lead time first.',
}

export const PHASE_INTRO: Record<TePhaseTab, { title: string; text: string }> = {
  campaign: {
    title: 'Qualify the request',
    text: 'Capture the request, the decision, and the people. Pass the qualification gate to unlock design.',
  },
  design: {
    title: 'Design the evidence',
    text: 'Write questions, measures, threats, and the run matrix. Approve the design to unlock cards.',
  },
  cards: {
    title: 'Issue test cards',
    text: 'Build one card per planned run. Pass the cold reader and dry run checks to issue it and unlock live runs.',
  },
  execute: {
    title: 'Run and adjudicate',
    text: 'Start runs from issued cards, record deviations, and assign a validity status to unlock analysis.',
  },
  analyze: {
    title: 'Compute and find',
    text: 'Compute results from adjudicated runs and write findings that trace to runs and measures.',
  },
  deliver: {
    title: 'Deliver the package',
    text: 'Assemble the evidence package, dispose every question and claim, and record the delivery.',
  },
  products: {
    title: 'Export products',
    text: 'Print and export the campaign deliverables for the customer.',
  },
}

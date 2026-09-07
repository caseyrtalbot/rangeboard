/**
 * Hover-help texts sourced from the doctrine masters, and one-line phase
 * intros for the guided stepper. Keys are stable; panels reference them
 * through HELP so wording lives in one place.
 */

import type { TePhaseTab } from '../state/teStore'
import type { TeCampaign } from '../model/types'

/**
 * Every distinct name typed into a person-bearing string field anywhere in
 * the campaign. Trimmed, deduped, sorted. Feeds person-picker candidate pools.
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

/**
 * ExampleHint content for the guided decision groups. Terse on purpose:
 * one-sentence definitions, wording-template examples. Examples marked
 * illustrative carry no real performance figures.
 */
interface HintEntry {
  definition?: string
  example?: string
  why?: string
  illustrative?: boolean
}

export const HINTS: Record<string, HintEntry> = {
  'exact-request': {
    definition: 'The customer request in their own words, unedited.',
    why: 'The verbatim ask anchors scope disputes later.',
  },
  'engagement-type': {
    definition: 'What kind of answer the customer needs: compare, characterize, verify, demonstrate, or explore.',
    why: 'The type sets which threshold and evidence questions appear first.',
  },
  'bounded-choice': {
    definition: 'The one decision the customer must make, stated as a choice between named options.',
    example: 'Choose between [buy system A] and [extend the current contract] for [base defense].',
    illustrative: true,
  },
  'blocking-uncertainty': {
    definition: 'The one unknown that stops the decision today.',
    example: 'We do not know the detection range against Group 1 threats at night.',
    illustrative: true,
  },
  'evidence-builder': {
    definition: 'The evidence that ends the campaign with a usable answer, in one sentence.',
    example: '[20] valid repetitions of [probability of detection] at [wilson] confidence in [live] fidelity.',
    illustrative: true,
  },
  'minimum-meaningful-difference': {
    definition: 'The smallest difference between options that would change the choice.',
    why: 'A smaller measured difference cannot support a comparison verdict.',
  },
  'acceptable-threshold': {
    definition: 'The value the customer accepts, with its source.',
    why: 'Without a customer-approved threshold the app characterizes instead of passing or failing.',
  },
  'relying-organization': {
    definition: 'The organization that will act on the evidence.',
    why: 'Design must not complete before the acceptance path is recorded.',
  },
  'action-map': {
    definition: 'The decision action for each outcome class: meet, miss, mixed, inconclusive.',
    why: 'An outcome with no named action is evidence nobody will use.',
  },
  'known-limits': {
    definition: 'Constraints already known to bound the campaign.',
    example: 'Spectrum: no open-air GPS denial at this site.',
  },
  registers: {
    definition: 'What we assume, claim, know, and do not know, one statement per row.',
    why: 'Claims get tested; unknowns get ranked; assumptions get verified or carried.',
  },
  'question-wording': {
    definition: 'One testable question with a subject, a condition, and a measurable outcome.',
    example: 'Where does the sensor first detect a Group 1 quad in clear day conditions?',
    illustrative: true,
  },
  'experimental-unit': {
    definition: 'What one trial is: one engagement, one run, one track, one sortie, or one day.',
    why: 'Sample size counts trials, so the unit must be fixed first.',
  },
  'truth-source': {
    definition: 'The independent record of what really happened, apart from the tested system.',
    why: 'No independent truth, no performance verdict.',
  },
  independence: {
    definition: 'How far the truth source stands from the tested system.',
    why: 'Truth that shares components with the system can hide its failures.',
  },
  'representation-class': {
    definition: 'How close the test threat is to the real threat.',
    why: 'Anything short of the actual threat needs a fidelity statement.',
  },
  'fidelity-grid': {
    definition: 'Feature by feature: what the surrogate represents faithfully, approximately, or not at all.',
  },
  'opfor-mode': {
    definition: 'How much freedom red has: scripted, bounded-adaptive, or free play.',
    why: 'More freedom means more realism and less repeatability.',
  },
  blinding: {
    definition: 'Who does not know the plan during the run.',
    why: 'Blinding blocks unconscious cueing.',
  },
  'factor-classification': {
    definition: 'For each thing that can move a result: vary it, hold it, record it, or forbid it.',
    why: 'An unclassified factor becomes an unexplained result.',
  },
  'matrix-method': {
    definition: 'What a matrix row is for: baseline, sweep, comparison, stress, or diagnostic.',
    why: 'A comparison without a baseline row proves nothing.',
  },
  'sample-size': {
    definition: 'Valid repetitions needed for the stated confidence, computed from the interval method.',
  },
  prediction: {
    definition: 'The expected result, recorded before the run.',
    why: 'Predictions recorded before the test protect against result hunting.',
  },
  'refuting-result': {
    definition: 'A result that would contradict the hypothesis.',
    why: 'A hypothesis that cannot fail is not testable.',
  },
  'cold-read': {
    definition: 'A person who did not write the card reads it cold and tries to run it as written.',
  },
  'dry-run': {
    definition: 'The full procedure walked without the live threat.',
  },
  'stop-rule': {
    definition: 'A condition that stops or holds the run, with its class: safety, data, or hold.',
  },
  'validity-rule': {
    definition: 'A condition a run must meet to count, with its effect: required, voids the run, or limits use.',
  },
  deviation: {
    definition: 'A difference between the card and the run, recorded as its own record.',
    why: 'Never edit the card to match the run.',
  },
  anomaly: {
    definition: 'Something unexpected. Record the raw observation before discussing causes.',
  },
  'initial-data-quality': {
    definition: 'First look at the run data: complete, gaps noted, or truth dropout.',
  },
  adjudication: {
    definition: 'One recorded judgment: does the run count, for which measures, with what limits.',
    why: 'No validity status means the run is not available for analysis.',
  },
  'preliminary-use': {
    definition: 'What the run data can do right now: usable, limited, repeat, or valid failure.',
    example: 'A valid failure is a clean run that shows the system missing. It counts.',
  },
  'comparability-effect': {
    definition: 'Whether a change breaks comparison with earlier runs.',
  },
  'finding-strength': {
    definition: 'How hard the evidence supports the statement: conclusive, directional, insufficient, or not tested.',
  },
  'ladder-level': {
    definition: 'One rung per statement: observation, calculation, interpretation, recommendation, decision.',
    why: 'Merged rungs hide where evidence ends and judgment starts.',
  },
  'generalization-bounds': {
    definition: 'Where the finding applies and where it does not.',
    why: 'Evidence stretched past its conditions stops being evidence.',
  },
  'evidence-life': {
    definition: 'When the finding goes stale and what refreshes it.',
  },
  dissent: {
    definition: 'A recorded disagreement with the finding, kept with the evidence.',
  },
  preset: {
    definition: 'A starting structure: questions, measures, and drafts to edit.',
    why: 'Presets seed structure only. They never invent test data.',
  },
}

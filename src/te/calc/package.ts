/**
 * Decision evidence package: section generation, text precedence and
 * delivery. Pure. One rule decides which text is the evidence for a
 * section: delivered -> stored; edited -> stored; generated text when
 * it exists; else stored. `deliverPackage` resolves that rule, freezes
 * the text into the sections and validates in one step, so the store
 * never depends on what a panel saved first.
 */

import type { PackageSection, TeCampaign, TeEvidencePackage } from '../model/types'
import { deliveryBlockers, runEvidenceLabel } from '../validate'
import { runAccounting } from './accounting'
import { DATA_STANDARDS } from '../seed/constants'

/** The five sections without generators; each gets guidance and a template. */
export const MANUAL_SECTIONS = [11, 14, 16, 17, 18]

export const SECTION_GUIDANCE: Record<number, string> = {
  11: 'State the architecture and mission-thread assessment.',
  14: 'State the alternatives and trade-offs, including delay and no action.',
  16: 'State the retest and evidence-refresh triggers.',
  17: 'State the raw-to-result reproduction instructions.',
  18: 'State data delivery, classification, distribution, retention, and deletion.',
}

/** Editable wording templates. Placeholders read as placeholders. */
export function sectionTemplate(campaign: TeCampaign, n: number): string {
  switch (n) {
    case 11:
      return 'Architecture under test: [systems and interfaces]. Mission thread: [thread assessed]. Assessment: [what the architecture supports and where it breaks].'
    case 14:
      return 'Alternatives considered: [option A], [option B], delay, no action. Trade-offs: [cost, risk, and schedule per option].'
    case 16:
      return 'Retest triggers: [software or hardware change], [threat change], [evidence expiry]. Refresh: [what to rerun].'
    case 17:
      return 'Raw files: [storage path]. Processing: [tool and version]. Steps: [ordered steps]. Expected outputs: [result files].'
    case 18:
      return [
        ...DATA_STANDARDS.map((d) => `${d.name}: ${d.value}`),
        `Classification: ${campaign.charter.dataSecurityReleaseClass || '[class]'}`,
        'Delivery: [medium and date]. Distribution: [list]. Retention: [period]. Deletion: [rule].',
      ].join('\n')
    default:
      return ''
  }
}

function findingRunLines(c: TeCampaign, runIds: string[]): string {
  return [...new Set(runIds)]
    .map((id) => {
      const run = c.runs.find((r) => r.id === id)
      return `${id}: ${run ? runEvidenceLabel(run) : 'missing run'}`
    })
    .join('\n')
}

/** Generated section text; '' for the five manual sections. */
export function generatedSection(c: TeCampaign, s: PackageSection): string {
  const d = c.decision
  switch (s.n) {
    case 1:
      return [
        `Decision owner: ${d.authorizedDecisionOwner}`,
        `Bounded choice: ${d.boundedChoice}`,
        `Alternatives: ${d.alternatives}`,
        `Decision date: ${d.decisionDate}`,
      ].join('\n')
    case 2:
      return d.blockingUncertainty
    case 3: {
      const first = c.findings[0]
      if (!first) return 'Executive answer: [complete after findings review]'
      return [first.statement, first.decisionImplication].filter((x) => x.trim()).join('\n')
    }
    case 4:
      return [
        `Mission: ${c.charter.missionAndProtectedOutcome}`,
        `Configurations: ${c.configs.map((x) => x.name || x.id).join(', ')}`,
      ].join('\n')
    case 5:
      return [
        `Threats: ${c.threats.map((t) => `${t.name || t.id} (${t.representationClass})`).join(', ')}`,
        `Conditions: ${c.conditions.map((x) => x.name || x.id).join(', ')}`,
      ].join('\n')
    case 6:
      return [
        ...c.questions.map((q) => `${q.id} (${q.priority}): ${q.wording}`),
        ...c.hypotheses.map((h) => `${h.id}: predicts ${h.predictedValue || 'no prediction'}`),
        ...c.measures.map(
          (m) =>
            `${m.id} ${m.name}${m.threshold !== null ? `, threshold ${m.threshold}${m.unit ? ` ${m.unit}` : ''}` : ''}${m.thresholdApproved ? '' : ' (threshold not customer approved)'}`,
        ),
      ].join('\n')
    case 7: {
      const a = c.charter.acceptance
      return [
        `Relying organization: ${a.relyingOrganization}`,
        `Method approval authority: ${a.methodApprovalAuthority}`,
        `Required witnesses: ${a.requiredWitnesses}`,
        `Evidence standard: ${a.evidenceStandard}`,
        `Rejection conditions: ${a.rejectionConditions}`,
      ].join('\n')
    }
    case 8: {
      const acc = runAccounting(c)
      return `Planned ${acc.planned}, attempted ${acc.attempted}, valid ${acc.valid}, conditional ${acc.conditional}, invalid ${acc.invalid}, excluded ${acc.excluded}, pending ${acc.pending}.`
    }
    case 9:
      return c.findings
        .filter((f) => f.strength === 'conclusive' || f.strength === 'directional')
        .map((f) => `${f.id} (${f.strength}): ${f.statement}\n${findingRunLines(c, [...f.supportingRunIds, ...f.contradictingRunIds])}`)
        .join('\n')
    case 10:
      return c.findings
        .filter((f) => f.strength === 'insufficient' || f.strength === 'not-tested')
        .map((f) => `${f.id} (${f.strength}): ${f.statement}\n${findingRunLines(c, [...f.supportingRunIds, ...f.contradictingRunIds])}`)
        .join('\n')
    case 12:
      return c.findings
        .map((f) =>
          [
            f.uncertaintyNote.trim() && `${f.id} uncertainty: ${f.uncertaintyNote}`,
            f.dissent.trim() && `${f.id} dissent: ${f.dissent}`,
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .filter((x) => x !== '')
        .join('\n')
    case 13:
      return c.registers
        .filter((r) => r.kind === 'claim')
        .map((r) => `${r.statement || r.id}: ${r.disposition ?? 'undisposed'}`)
        .join('\n')
    case 15:
      return c.findings
        .filter((f) => f.recommendedAction.trim())
        .map((f) => `${f.id}: ${f.recommendedAction}`)
        .join('\n')
    case 19:
      return c.actions
        .map(
          (a) =>
            `${a.requiredWork || a.id} (owner ${a.executionOwner || 'unassigned'}, due ${a.dueDate || 'not set'}, ${a.status})`,
        )
        .join('\n')
    case 20: {
      const p = c.evidencePackage
      return [
        `Method acceptance: ${p.methodAcceptance}`,
        `Evidence acceptance: ${p.evidenceAcceptance}`,
        `Final authority and date: ${p.finalAuthorityAndDate}`,
      ].join('\n')
    }
    default:
      return ''
  }
}

/** Where a section's evidence text comes from under the precedence rule. */
export type SectionSource = 'delivered' | 'edited' | 'generated' | 'stored'

export interface SectionPreview {
  n: number
  title: string
  /** The text that is, or would become, the delivered evidence. */
  text: string
  source: SectionSource
  manual: boolean
}

/** Resolve one section under the precedence rule. */
export function resolveSection(c: TeCampaign, s: PackageSection): SectionPreview {
  const manual = MANUAL_SECTIONS.includes(s.n)
  const base = { n: s.n, title: s.title, manual }
  if (c.evidencePackage.deliveredAt) return { ...base, text: s.content, source: 'delivered' }
  if (s.edited) return { ...base, text: s.content, source: 'edited' }
  const gen = generatedSection(c, s)
  if (gen !== '') return { ...base, text: gen, source: 'generated' }
  return { ...base, text: s.content, source: 'stored' }
}

/** Preview of every section as it would be delivered now. */
export function previewPackage(c: TeCampaign): SectionPreview[] {
  return c.evidencePackage.sections.map((s) => resolveSection(c, s))
}

/** Count of sections whose resolved text is non-empty. */
export function completeSectionCount(c: TeCampaign): number {
  return previewPackage(c).filter((p) => p.text.trim() !== '').length
}

/**
 * The package with resolved text written into every section. Edited and
 * manual text is unchanged; unedited generated sections take the live text.
 */
export function resolvedPackage(c: TeCampaign): TeEvidencePackage {
  const p = c.evidencePackage
  return {
    ...p,
    sections: p.sections.map((s) => {
      const text = resolveSection(c, s).text
      return text === s.content ? s : { ...s, content: text }
    }),
  }
}

export interface DeliveryProposal {
  blockers: string[]
  /** The frozen campaign update, or null when any blocker stands. */
  campaign: TeCampaign | null
}

/**
 * Resolve, freeze and validate in one step. Blockers are evaluated on the
 * resolved text, so the text that is checked is the text that is frozen.
 */
export function deliverPackage(c: TeCampaign, deliveredAt: string): DeliveryProposal {
  if (c.evidencePackage.deliveredAt) return { blockers: ['The package is already delivered.'], campaign: null }
  const resolved: TeCampaign = { ...c, evidencePackage: resolvedPackage(c) }
  const blockers = deliveryBlockers(resolved)
  if (blockers.length > 0) return { blockers, campaign: null }
  return {
    blockers: [],
    campaign: { ...resolved, evidencePackage: { ...resolved.evidencePackage, deliveredAt } },
  }
}

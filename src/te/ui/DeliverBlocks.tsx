import { runEvidenceLabel } from '../validate'
/**
 * Deliver-stage building blocks. Derived evidence
 * generation, package section generators, disposition suggestions, and the
 * small local controls the Deliver panel owns. Shared components live in
 * kit.tsx; this file never edits shared modules.
 */

import { useState } from 'react'
import type {
  ClaimDisposition,
  FindingStrength,
  PackageSection,
  QuestionDisposition,
  TeCampaign,
  TeFinding,
} from '../model/types'
import { computeMeasure } from '../calc/measures'
import type { MeasureComputation } from '../calc/measures'
import { runAccounting } from '../calc/accounting'
import { DATA_STANDARDS, REFUTED_CLAIMS } from '../seed/constants'
import { DateField, PersonPicker, Provenance, SentenceBuilder, TextField } from './kit'

function fmtNum(n: number): number {
  return Math.round(n * 1000) / 1000
}

function measureSummary(c: MeasureComputation): string {
  const estimate =
    c.estimate === null ? 'no estimate' : `${fmtNum(c.estimate)}${c.unit ? ` ${c.unit}` : ''}`
  const interval = c.interval
    ? ` [${fmtNum(c.interval.lo)}, ${fmtNum(c.interval.hi)}] (${c.interval.method})`
    : ''
  return `${c.measureId} ${c.name || 'unnamed'}: ${estimate}${interval}, n=${c.nIncluded}`
}

/** Computations for every measure the finding links. */
export function findingComputations(campaign: TeCampaign, f: TeFinding): MeasureComputation[] {
  const ids = new Set([...f.supportingRunIds, ...f.contradictingRunIds])
  const linked = { ...campaign, runs: campaign.runs.filter(r => ids.has(r.id)) }
  return f.measureIds
    .map((id) => computeMeasure(linked, id))
    .filter((c): c is MeasureComputation => c !== null)
}

// Refuted-claims lint

/** Distinctive lowercase phrase per REFUTED_CLAIMS entry. */
const REFUTED_PHRASES = [
  'destroyed russian tanks',
  'democratized air power',
  'depends less on technology',
  'ew-immune',
  '40-70 km of front',
  '10% of targets',
  '50-60% targeting efficiency',
  '70% of russian gerans',
]

export function refutedClaimMatches(text: string): string[] {
  const lower = text.toLowerCase()
  return REFUTED_CLAIMS.filter((claim) => {
    const phrase = REFUTED_PHRASES.find((p) => claim.toLowerCase().includes(p))
    return phrase !== undefined && lower.includes(phrase)
  })
}

// Derived evidence detail (auto on link change; fills only empty fields)

/** Evidence text derived from the finding's links; fills only empty fields. */
export function generatedEvidence(campaign: TeCampaign, f: TeFinding): Partial<TeFinding> {
  const patch: Partial<TeFinding> = {}
  const put = (key: keyof TeFinding & string, current: string, next: string) => {
    if (next.trim() === '' || current.trim() !== '') return
    ;(patch as Record<string, unknown>)[key] = next
  }
  const comps = findingComputations(campaign, f)
  put('quantifiedResult', f.quantifiedResult, comps.map(measureSummary).join('\n'))
  put(
    'thresholdComparison',
    f.thresholdComparison,
    comps
      .filter((c) => c.estimate !== null)
      .map((c) => {
        const m = campaign.measures.find((x) => x.id === c.measureId)
        if (!m) return ''
        if (!c.thresholdShown || m.threshold === null) {
          return `${c.measureId}: characterization only; no customer-approved threshold`
        }
        return `${c.measureId}: estimate ${fmtNum(c.estimate!)} vs threshold ${m.threshold}${m.unit ? ` ${m.unit}` : ''} (${c.label})`
      })
      .filter((t) => t !== '')
      .join('\n'),
  )
  put(
    'sampleAndIndependence',
    f.sampleAndIndependence,
    comps
      .map((c) => {
        const m = campaign.measures.find((x) => x.id === c.measureId)
        const unitText = m && m.experimentalUnit.trim() !== '' ? `; unit: ${m.experimentalUnit}` : ''
        return `${c.measureId}: ${c.nIncluded} included of ${c.nAttempted} attempted${unitText}`
      })
      .join('\n'),
  )
  put(
    'uncertaintyNote',
    f.uncertaintyNote,
    comps
      .filter((c) => c.interval !== null)
      .map(
        (c) =>
          `${c.measureId}: [${fmtNum(c.interval!.lo)}, ${fmtNum(c.interval!.hi)}] (${c.interval!.method})`,
      )
      .join('\n'),
  )
  const linkedRuns = [...new Set([...f.supportingRunIds, ...f.contradictingRunIds])]
    .map((id) => campaign.runs.find((r) => r.id === id))
    .filter((r) => r !== undefined)
  if (linkedRuns.length > 0) {
    let missing = 0
    let invalid = 0
    let censored = 0
    for (const r of linkedRuns) {
      for (const o of r.observations) {
        if (f.measureIds.length > 0 && !f.measureIds.includes(o.measureId)) continue
        if (o.status === 'missing') missing++
        if (o.status === 'invalid') invalid++
        if (o.status === 'censored') censored++
      }
    }
    const excluded = linkedRuns.filter((r) => r.excluded).length
    put(
      'missingAndExcludedData',
      f.missingAndExcludedData,
      `Across ${linkedRuns.length} linked run(s): ${missing} missing, ${invalid} invalid, ${censored} censored observation(s); ${excluded} excluded run(s).\n${linkedRuns.map(r => `${r.id}: ${runEvidenceLabel(r)}`).join('\n')}`,
    )
  }
  const config = campaign.configs.find((x) => x.id === f.configId)
  const threats = f.threatIds
    .map((id) => campaign.threats.find((t) => t.id === id))
    .filter((t) => t !== undefined)
  const conds = f.conditionIds
    .map((id) => campaign.conditions.find((x) => x.id === id))
    .filter((x) => x !== undefined)
  put(
    'appliesTo',
    f.appliesTo,
    [
      config ? `configuration ${config.name || config.id} ${config.version}` : '',
      ...threats.map((t) => t.name || t.id),
      ...conds.map((x) => x.name || x.id),
      ...threats.map((t) => t.permittedGeneralization),
      ...conds.map((x) => x.permittedGeneralization),
    ]
      .filter((t) => t.trim() !== '')
      .join('; '),
  )
  put(
    'doesNotApplyTo',
    f.doesNotApplyTo,
    [
      ...threats.map((t) => t.prohibitedGeneralization),
      ...conds.map((x) => x.prohibitedGeneralization),
    ]
      .filter((t) => t.trim() !== '')
      .join('; '),
  )
  const hyp = campaign.hypotheses.find((h) => h.id === f.hypothesisId)
  if (hyp) {
    const observed = comps
      .filter((c) => c.estimate !== null)
      .map((c) => `${c.measureId} ${fmtNum(c.estimate!)}${c.unit ? ` ${c.unit}` : ''}`)
      .join(', ')
    put(
      'comparisonWithPrediction',
      f.comparisonWithPrediction,
      `Predicted: ${hyp.predictedValue || 'no prediction recorded'}. Observed: ${observed || 'no estimate'}.`,
    )
  }
  return patch
}

/**
 * Current derivation for every evidence field, ignoring stored text.
 * Feeds the inherited-vs-edited provenance display; the stored string
 * stays the single persisted truth.
 */
export function evidenceDerivation(campaign: TeCampaign, f: TeFinding): Partial<TeFinding> {
  return generatedEvidence(campaign, {
    ...f,
    quantifiedResult: '',
    thresholdComparison: '',
    sampleAndIndependence: '',
    uncertaintyNote: '',
    missingAndExcludedData: '',
    appliesTo: '',
    doesNotApplyTo: '',
    comparisonWithPrediction: '',
  })
}

/** Threat and condition defaults from the linked runs' cards (actuals win). */
export function derivedRunLinks(
  campaign: TeCampaign,
  f: TeFinding,
): { threatIds: string[]; conditionIds: string[] } {
  const runs = [...new Set([...f.supportingRunIds, ...f.contradictingRunIds])]
    .map((id) => campaign.runs.find((r) => r.id === id))
    .filter((r) => r !== undefined)
  const threatIds = new Set<string>()
  const conditionIds = new Set<string>()
  for (const r of runs) {
    const card = campaign.cards.find((x) => x.id === r.cardId)
    const t = r.actualThreatId ?? card?.threatId ?? null
    const cond = r.actualConditionId ?? card?.conditionId ?? null
    if (t) threatIds.add(t)
    if (cond) conditionIds.add(cond)
  }
  return { threatIds: [...threatIds], conditionIds: [...conditionIds] }
}

// Suggestions (confirm before write; never authoritative until accepted)

type OutcomeClass = 'meet' | 'miss' | 'mixed' | 'inconclusive'

/** Result class across the linked measures' computed labels. */
function outcomeClass(comps: MeasureComputation[]): OutcomeClass | null {
  const labels = comps.map((c) => c.label)
  if (labels.length === 0 || labels.every((l) => l === 'unavailable')) return null
  const pass = labels.includes('pass')
  const miss = labels.includes('miss')
  if (pass && miss) return 'mixed'
  if (pass) return 'meet'
  if (miss) return 'miss'
  return 'inconclusive'
}

/** Decision-implication seed from the Qualify action map, keyed by result class. */
export function decisionSeed(
  campaign: TeCampaign,
  comps: MeasureComputation[],
): { cls: OutcomeClass; text: string } | null {
  const cls = outcomeClass(comps)
  if (cls === null) return null
  const d = campaign.decision
  const map: Record<OutcomeClass, string> = {
    meet: d.actionOnMeet,
    miss: d.actionOnMiss,
    mixed: d.actionOnMixed,
    inconclusive: d.actionOnInconclusive,
  }
  const text = map[cls].trim()
  return text === '' ? null : { cls, text }
}

/** Strength suggestion from the computed result labels. */
export function suggestedStrength(comps: MeasureComputation[]): FindingStrength | null {
  const labels = comps.map((c) => c.label)
  if (labels.length === 0) return null
  if (labels.every((l) => l === 'unavailable')) return 'insufficient'
  const pass = labels.includes('pass')
  const miss = labels.includes('miss')
  if ((pass || miss) && !(pass && miss) && !labels.includes('borderline')) return 'conclusive'
  return 'directional'
}

/** Question disposition suggestion from the strengths of its linked findings. */
export function suggestedQuestionDisposition(
  campaign: TeCampaign,
  questionId: string,
): QuestionDisposition | null {
  const linked = campaign.findings.filter((f) => f.questionId === questionId)
  if (linked.length === 0) return null
  if (linked.some((f) => f.strength === 'conclusive')) return 'answered'
  if (linked.some((f) => f.strength === 'directional')) return 'partially-answered'
  return 'not-answered'
}

/** Claim disposition suggestion from hypothesis outcomes and linked findings. */
export function suggestedClaimDisposition(
  campaign: TeCampaign,
  claimId: string,
): ClaimDisposition | null {
  const outcomes = campaign.hypotheses
    .filter((h) => h.claimId === claimId)
    .map((h) => h.outcome)
    .filter((o) => o !== null)
  if (outcomes.includes('contradicted')) return 'contradicted'
  if (outcomes.includes('supported')) return 'supported'
  if (outcomes.includes('directionally-supported')) return 'directionally-supported'
  const linked = campaign.findings.filter((f) => f.claimId === claimId)
  if (linked.some((f) => f.strength === 'conclusive')) return 'supported'
  if (linked.some((f) => f.strength === 'directional')) return 'directionally-supported'
  if (linked.length > 0 || outcomes.includes('inconclusive')) return 'inconclusive'
  return null
}

// Package sections

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
        .map((f) => `${f.id} (${f.strength}): ${f.statement}\n${[...new Set([...f.supportingRunIds, ...f.contradictingRunIds])].map(id => {
          const run = c.runs.find(r => r.id === id)
          return `${id}: ${run ? runEvidenceLabel(run) : 'missing run'}`
        }).join('\n')}`)
        .join('\n')
    case 10:
      return c.findings
        .filter((f) => f.strength === 'insufficient' || f.strength === 'not-tested')
        .map((f) => `${f.id} (${f.strength}): ${f.statement}\n${[...new Set([...f.supportingRunIds, ...f.contradictingRunIds])].map(id => {
          const run = c.runs.find(r => r.id === id)
          return `${id}: ${run ? runEvidenceLabel(run) : 'missing run'}`
        }).join('\n')}`)
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

// Small local controls

/** Pending suggestion with source; writes only on the accept click. */
export function SuggestLine({
  text,
  source,
  onAccept,
  acceptLabel,
}: {
  text: string
  source: string
  onAccept: () => void
  acceptLabel?: string
}) {
  return (
    <div className="provenance pending">
      <div className="muted small">{text}</div>
      <div className="provenance-line">
        <span className="provenance-chip">from {source}</span>
        <button type="button" className="mini" onClick={onAccept}>
          {acceptLabel ?? 'Accept'}
        </button>
      </div>
    </div>
  )
}

/**
 * Evidence field with live provenance. When a derivation exists:
 * empty field -> pending suggestion; stored equals derivation -> inherited;
 * differs -> edited with revert. No derivation -> plain field.
 */
export function EvidenceField({
  label,
  value,
  derived,
  onChange,
  rows,
  help,
}: {
  label: string
  value: string
  derived: string | undefined
  onChange: (v: string) => void
  rows?: number
  help?: string
}) {
  const body = <TextField label={label} rows={rows} value={value} onChange={onChange} help={help} />
  if (derived === undefined || derived.trim() === '') return body
  if (value.trim() === '') {
    return (
      <div>
        {body}
        <SuggestLine text={derived} source="linked records" onAccept={() => onChange(derived)} />
      </div>
    )
  }
  const state = value === derived ? 'inherited' : 'edited'
  return (
    <Provenance source="linked records" state={state} onRevert={() => onChange(derived)}>
      {body}
    </Provenance>
  )
}

/** Two-click remove; the second click confirms. Blur disarms. */
export function ConfirmButton({
  label,
  onConfirm,
  disabled,
  title,
}: {
  label: string
  onConfirm: () => void
  disabled?: boolean
  title?: string
}) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      className="mini danger"
      disabled={disabled}
      title={title}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
    >
      {armed ? 'Confirm?' : label}
    </button>
  )
}

/** Statement start: system + result + condition, applied to the stored string. */
export function FindingStatementBuilder({
  campaign,
  value,
  onChange,
}: {
  campaign: TeCampaign
  value: string
  onChange: (v: string) => void
}) {
  const [slots, setSlots] = useState({ system: '', result: '', condition: '' })
  const systems = [...new Set(campaign.configs.map((c) => c.name || c.id))]
  const conditions = [
    ...new Set([
      ...campaign.conditions.map((c) => c.name || c.id),
      ...campaign.threats.map((t) => t.name || t.id),
    ]),
  ]
  const render = () => {
    const head = [slots.system, slots.result].filter((s) => s.trim() !== '').join(' ')
    if (head === '') return ''
    const s = slots.condition.trim() !== '' ? `${head} under ${slots.condition}` : head
    return s.endsWith('.') ? s : `${s}.`
  }
  return (
    <SentenceBuilder
      slots={[
        { kind: 'select', key: 'system', options: systems, value: slots.system },
        { kind: 'text', key: 'result', placeholder: 'observed result', value: slots.result },
        { kind: 'literal', text: 'under' },
        { kind: 'select', key: 'condition', options: conditions, value: slots.condition },
      ]}
      onSlot={(k, v) => setSlots((s) => ({ ...s, [k]: String(v ?? '') }))}
      render={render}
      value={value}
      onChange={onChange}
    />
  )
}

/** Person pick plus date pick writing one stored string. Never parses it. */
export function FinalAuthorityField({
  value,
  onChange,
  people,
}: {
  value: string
  onChange: (v: string) => void
  people: string[]
}) {
  const [person, setPerson] = useState('')
  const [date, setDate] = useState<string | null>(null)
  const composed = [person.trim(), date ?? ''].filter((s) => s !== '').join(', ')
  return (
    <div className="subsection">
      <div className="field-row">
        <PersonPicker
          label="Final approving authority"
          value={person}
          onChange={setPerson}
          people={people}
        />
        <DateField label="Approval date" value={date} onChange={setDate} />
        <button
          type="button"
          className="mini"
          disabled={composed === '' || composed === value}
          onClick={() => onChange(composed)}
        >
          Apply
        </button>
      </div>
      <TextField label="Authority and date on record" value={value} onChange={onChange} />
    </div>
  )
}

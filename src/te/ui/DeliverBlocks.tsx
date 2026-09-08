/**
 * Deliver-stage building blocks. Disposition and strength suggestions
 * (accepted by the user, never written here) and the small local controls
 * the Deliver panel owns. Evidence derivation lives in calc/findingEvidence.ts
 * and package sections in calc/package.ts. Shared components live in kit.tsx.
 */

import { useState } from 'react'
import type {
  ClaimDisposition,
  FindingStrength,
  QuestionDisposition,
  TeCampaign,
} from '../model/types'
import type { MeasureComputation } from '../calc/measures'
import { REFUTED_CLAIMS } from '../seed/constants'
import { DateField, PersonPicker, Provenance, SentenceBuilder, TextField } from './kit'

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

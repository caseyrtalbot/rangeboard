/**
 * Panel-local blocks for AnalyzePanel (SPEC groups A1 to A3).
 * Owns the outcome suggestion, the trigger and gap picks fed by chain
 * health and coverage, the change builder, the factor grid, the
 * comparability segment, and the ephemeral priority calculator.
 */

import { useState } from 'react'
import type {
  DeviationEffect,
  HypothesisOutcome,
  NextAction,
  ResultLabel,
  TeCampaign,
  TeHypothesis,
} from '../model/types'
import type { MeasureComputation } from '../calc/measures'
import type { CellCoverage } from '../calc/matrix'
import { adaptivePriority } from '../calc/priority'
import { chainHealth } from '../validate'
import {
  EntityPicker,
  ExampleHint,
  Provenance,
  Seg,
  SegChips,
  SelectField,
  SentenceBuilder,
  TextField,
} from './kit'

/** Next-move vocabulary. Values mirror the NextAction enum. */
export const NEXT_ACTION_OPTIONS: Array<{ v: NextAction; label: string; def: string }> = [
  { v: 'execute-next-card', label: 'Run next card', def: 'Execute the next planned card.' },
  { v: 'repeat-for-validity', label: 'Repeat a run', def: 'Repeat a run to replace invalid data.' },
  { v: 'isolate-one-variable', label: 'Isolate one variable', def: 'Change one variable and hold the rest.' },
  { v: 'repair-evidence-chain', label: 'Repair the chain', def: 'Fix a broken link from question to run.' },
  { v: 'revise-threat-or-condition', label: 'Revise threat or condition', def: 'Revise a threat or condition record.' },
  { v: 'introduce-diagnostic-card', label: 'Add diagnostic card', def: 'Add a card that isolates a fault.' },
  { v: 'stop-low-value-line', label: 'Stop a line', def: 'Stop a test line that adds no evidence.' },
  { v: 'end-for-sufficiency', label: 'End: enough evidence', def: 'End the campaign. The evidence answers the question.' },
  { v: 'end-for-futility', label: 'End: no path', def: 'End the campaign. More runs cannot answer the question.' },
]

export const OUTCOME_OPTIONS: Array<{ v: HypothesisOutcome; label: string }> = [
  { v: 'supported', label: 'Supported' },
  { v: 'directionally-supported', label: 'Directionally supported' },
  { v: 'contradicted', label: 'Contradicted' },
  { v: 'inconclusive', label: 'Inconclusive' },
  { v: 'not-tested', label: 'Not tested' },
]

const outcomeLabel = (v: HypothesisOutcome): string =>
  OUTCOME_OPTIONS.find((o) => o.v === v)?.label ?? v

/**
 * Derived outcome suggestion from the computed result label vs the
 * prediction. Only a threshold verdict maps; descriptive results suggest
 * nothing. Confirm before write (SPEC 4.1).
 */
export function suggestOutcome(label: ResultLabel, estimate: number | null): HypothesisOutcome | null {
  if (estimate === null) return null
  if (label === 'pass') return 'supported'
  if (label === 'miss') return 'contradicted'
  if (label === 'borderline') return 'directionally-supported'
  return null
}

/**
 * One hypothesis row under a measure result: prediction readout, outcome
 * select with a pending suggestion, note after an outcome is set.
 */
export function OutcomeRow({
  hyp,
  result,
  onOutcome,
  onNote,
}: {
  hyp: TeHypothesis
  result: MeasureComputation
  onOutcome: (v: HypothesisOutcome | null) => void
  onNote: (v: string) => void
}) {
  const suggestion = hyp.outcome === null ? suggestOutcome(result.label, result.estimate) : null
  const select = (
    <SelectField
      label="Outcome"
      help="Compare the computed result with the recorded prediction, then set one outcome."
      value={hyp.outcome}
      allowEmpty="not set"
      options={OUTCOME_OPTIONS}
      onChange={onOutcome}
    />
  )
  return (
    <div className="field-row te-table-row">
      <div className="field">
        <span>{hyp.id} predicted</span>
        <div className="muted small">
          {hyp.predictedValue || 'no prediction'} ({hyp.predictionType})
        </div>
      </div>
      {suggestion ? (
        <Provenance
          source={`${result.measureId} ${result.label}: suggest ${outcomeLabel(suggestion)}`}
          state="pending"
          onConfirm={() => onOutcome(suggestion)}
        >
          {select}
        </Provenance>
      ) : (
        select
      )}
      {hyp.outcome !== null && (
        <TextField label="Outcome note" value={hyp.outcomeNote} onChange={onNote} />
      )}
    </div>
  )
}

export interface PickOption {
  id: string
  label: string
  sub?: string
}

/** Live gap list: chain-health items plus empty and thin coverage cells. */
export function buildGapOptions(campaign: TeCampaign, cov: CellCoverage[]): PickOption[] {
  const ch = chainHealth(campaign)
  const out: PickOption[] = []
  const add = (n: number, text: string) => {
    if (n > 0) out.push({ id: `gap:${text}`, label: text, sub: `${n} open` })
  }
  add(ch.questionsWithoutMeasures, 'questions without measures')
  add(ch.measuresWithoutTruth, 'measures without a truth source')
  add(ch.cardsWithoutRuns, 'issued cards without runs')
  add(ch.runsPendingAdjudication, 'runs pending adjudication')
  add(ch.findingsWithoutRuns, 'findings without runs')
  add(ch.claimsUndisposed, 'claims not disposed')
  for (const c of cov) {
    if (c.state !== 'empty' && c.state !== 'thin') continue
    const cell = campaign.matrix.find((m) => m.id === c.cellId)
    const q = campaign.questions.find((x) => x.id === cell?.questionId)
    out.push({
      id: `cell:${c.cellId}`,
      label: `${c.cellId} coverage ${c.state}`,
      sub: `valid ${c.valid} of min ${c.minValid}${q ? ` · ${q.wording.slice(0, 40)}` : ''}`,
    })
  }
  return out
}

/** Trigger pick pool: runs, computed measure results, anomalies, coverage cells. */
export function buildTriggerOptions(
  campaign: TeCampaign,
  results: MeasureComputation[],
  cov: CellCoverage[],
): PickOption[] {
  const out: PickOption[] = []
  for (const r of results) {
    if (r.estimate === null) continue
    out.push({
      id: `msr:${r.measureId}`,
      label: `${r.measureId} ${r.label}`,
      sub: r.name || undefined,
    })
  }
  for (const run of campaign.runs) {
    out.push({ id: `run:${run.id}`, label: run.id, sub: `card ${run.cardId} · ${run.validity}` })
  }
  for (const a of campaign.anomalies) {
    out.push({ id: `anom:${a.id}`, label: a.id, sub: a.observation.slice(0, 50) || 'anomaly' })
  }
  for (const c of cov) {
    if (c.state !== 'empty' && c.state !== 'thin') continue
    out.push({ id: `cell:${c.cellId}`, label: `${c.cellId} coverage ${c.state}` })
  }
  return out
}

/**
 * Text pick: an EntityPicker whose selection writes its label into a plain
 * string field. Free text stays allowed, so legacy prose and off-list
 * entries keep working.
 */
export function TextPick({
  label,
  help,
  options,
  value,
  onChange,
}: {
  label: string
  help?: string
  options: PickOption[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <EntityPicker
      label={label}
      help={help}
      options={options.map((o) => ({ id: o.id, label: o.label, sub: o.sub }))}
      value={null}
      onChange={() => undefined}
      allowFree
      freeValue={value}
      onFree={onChange}
    />
  )
}

/**
 * Change builder: kind select mirroring the next-move vocabulary plus a
 * reason. Applies to one stored string, editable after build.
 */
export function ChangeBuilder({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [kind, setKind] = useState('')
  const [reason, setReason] = useState('')
  return (
    <div className="field">
      <span>
        Selected change
        <span className="help-dot" tabIndex={0} data-help="One change and the reason for it. Old records stay preserved.">
          ?
        </span>
      </span>
      <SentenceBuilder
        slots={[
          { kind: 'select', key: 'kind', options: NEXT_ACTION_OPTIONS.map((o) => o.label), value: kind },
          { kind: 'literal', text: 'because' },
          { kind: 'text', key: 'reason', placeholder: 'reason', value: reason },
        ]}
        onSlot={(key, v) => {
          if (key === 'kind') setKind(String(v ?? ''))
          if (key === 'reason') setReason(String(v ?? ''))
        }}
        render={() => (kind === '' && reason === '' ? '' : `${kind}${kind && reason ? ' because ' : ''}${reason}`)}
        value={value}
        onChange={onChange}
      />
      <ExampleHint
        definition="Name the change, then the evidence-based reason."
        example="Repeat a run because RUN-4 lost the truth-source track mid-run."
        illustrative
      />
    </div>
  )
}

export type FactorMark = 'changed' | 'held'

/**
 * Factor grid: one changed-or-held toggle per campaign factor, free add
 * for off-list variables. Marks live in parent state; the record composes
 * the two stored strings on save.
 */
export function FactorGrid({
  factorNames,
  marks,
  onMark,
}: {
  factorNames: string[]
  marks: Record<string, FactorMark>
  onMark: (name: string, v: FactorMark | null) => void
}) {
  const [custom, setCustom] = useState('')
  const extras = Object.keys(marks).filter((n) => !factorNames.includes(n))
  const rows = [...factorNames, ...extras]
  const addCustom = () => {
    const v = custom.trim()
    if (v === '') return
    setCustom('')
    if (!(v in marks)) onMark(v, 'changed')
  }
  return (
    <div className="field">
      <span>
        Variables changed or held
        <span className="help-dot" tabIndex={0} data-help="Mark each factor: changed by this decision, or held constant.">
          ?
        </span>
      </span>
      {rows.length === 0 && <div className="muted small">No factors defined. Add one below.</div>}
      {rows.map((name) => (
        <div key={name} className="field-row te-table-row">
          <div className="field">
            <span>{name}</span>
          </div>
          <SegChips<FactorMark>
            options={[
              { v: 'changed', label: 'Changed' },
              { v: 'held', label: 'Held' },
            ]}
            value={marks[name] ?? null}
            onChange={(v) => onMark(name, (v as FactorMark | null) ?? null)}
          />
        </div>
      ))}
      <input
        className="te-chip-add"
        value={custom}
        placeholder="Add variable…"
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addCustom()
          }
        }}
        onBlur={addCustom}
      />
    </div>
  )
}

/** Composes the two stored factor strings from the grid marks. */
export function factorStrings(marks: Record<string, FactorMark>): {
  changed: string
  held: string
} {
  const names = Object.keys(marks)
  return {
    changed: names.filter((n) => marks[n] === 'changed').join(', '),
    held: names.filter((n) => marks[n] === 'held').join(', '),
  }
}

const COMPARABILITY_OPTIONS: Array<{ v: DeviationEffect; label: string; def: string }> = [
  { v: 'none', label: 'None', def: 'Old and new runs still compare.' },
  { v: 'bounded', label: 'Bounded', def: 'Compare only within stated limits.' },
  { v: 'material', label: 'Material', def: 'Do not compare across the change.' },
  { v: 'unknown', label: 'Unknown', def: 'Effect on comparison not yet known.' },
]

/**
 * Comparability decision: one segment over the shared effect vocabulary
 * plus a note when the effect is not none. Composes one stored string.
 */
export function ComparabilityPick({
  effect,
  onEffect,
  note,
  onNote,
}: {
  effect: DeviationEffect | null
  onEffect: (v: DeviationEffect | null) => void
  note: string
  onNote: (v: string) => void
}) {
  return (
    <div className="field">
      <span>
        Can old and new runs still compare?
        <span className="help-dot" tabIndex={0} data-help="Comparability effect: whether this change breaks comparison with earlier runs.">
          ?
        </span>
      </span>
      <SegChips<DeviationEffect>
        options={COMPARABILITY_OPTIONS}
        value={effect}
        onChange={(v) => onEffect(v as DeviationEffect | null)}
      />
      {effect !== null && effect !== 'none' && (
        <TextField label="Comparability note" value={note} onChange={onNote} />
      )}
    </div>
  )
}

/** Composes the stored comparability string from the segment and note. */
export function comparabilityString(effect: DeviationEffect | null, note: string): string {
  if (effect === null) return note.trim()
  return note.trim() === '' ? effect : `${effect}: ${note.trim()}`
}

/**
 * Ephemeral next-run priority calculator (advisory only, never stored).
 */
export function PriorityCalculator() {
  const [importance, setImportance] = useState(2)
  const [uncertainty, setUncertainty] = useState(2)
  const [likelihood, setLikelihood] = useState(2)
  const [burden, setBurden] = useState(2)
  const score = adaptivePriority(importance, uncertainty, likelihood, burden)
  const seg = (label: string, value: number, onChange: (v: number) => void) => (
    <div className="field">
      <span>{label}</span>
      <Seg
        value={String(value) as '1' | '2' | '3'}
        options={(['1', '2', '3'] as const).map((v) => ({ v, label: v }))}
        onChange={(v) => onChange(Number(v))}
      />
    </div>
  )
  return (
    <div>
      <p className="muted small">Score the next candidate runs. Higher runs first. Not stored.</p>
      <div className="field-row">
        {seg('Importance', importance, setImportance)}
        {seg('Uncertainty reduction', uncertainty, setUncertainty)}
        {seg('Likelihood', likelihood, setLikelihood)}
        {seg('Burden', burden, setBurden)}
      </div>
      <div className="spec-summary">priority score: {Math.round(score * 100) / 100}</div>
    </div>
  )
}

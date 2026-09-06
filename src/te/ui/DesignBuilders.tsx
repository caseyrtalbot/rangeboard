/**
 * Design-stage builders, panel-local components. Every builder writes the schema field that
 * exists today; nothing here stores derived state.
 */

import { useMemo, useState } from 'react'
import type {
  FactorClass,
  PredictionType,
  QuestionPattern,
  RepresentationClass,
  TeCampaign,
  TeHypothesis,
  TeMeasure,
} from '../model/types'
import { MEASURE_DICTIONARY, type MeasureDictEntry } from '../seed/measureDictionary'
import { useTeStore } from '../state/teStore'
import { useStore } from '../../state/store'
import { formatSpeed } from '../../geometry/geo'
import { attemptInflation, sampleSizeProportion } from '../calc/stats'
import { MATRIX_METHODS } from '../seed/constants'
import {
  EntityPicker,
  Field,
  MultiPicker,
  NumberField,
  Provenance,
  SegChips,
  SentenceBuilder,
  TextField,
  type SentenceSlot,
} from './kit'

// MeasureDictEntry lives in the seed module, not model/types; re-alias here so
// the panel imports one shape from one place.
export type { MeasureDictEntry }

export function short(id: string): string {
  return id.split('-').slice(2).join('-') || id
}

export type GroupState = 'done' | 'partial' | 'empty'

/** Completion dot from a list of per-decision done flags. */
export function progress(flags: boolean[]): GroupState {
  if (flags.length === 0) return 'empty'
  const done = flags.filter(Boolean).length
  if (done === 0) return 'empty'
  if (done === flags.length) return 'done'
  return 'partial'
}

// Definition decks, one line each

export const PATTERN_DEFS: Record<QuestionPattern, string> = {
  capability: 'Can it do the task at all?',
  performance: 'How well, in numbers?',
  comparison: 'Which option is better?',
  sensitivity: 'What changes the result?',
  boundary: 'Where does it stop working?',
  reliability: 'How consistently?',
  diagnosis: 'Why does it fail?',
  regression: 'Did it change since last time?',
  'mission-effect': 'Does the mission survive?',
}

export const QUESTION_TEMPLATES: Record<QuestionPattern, string> = {
  capability: 'Can [system] [do what] against [threat] under [conditions]?',
  performance: 'What [measure] does [system] achieve against [threat] under [conditions]?',
  comparison: 'Does [option A] beat [option B] on [measure] under [conditions]?',
  sensitivity: 'How does [measure] change as [factor] varies from [low] to [high]?',
  boundary: 'At what [factor value] does [system] stop [doing what]?',
  reliability: 'How often does [system] [do what] across repetitions under [conditions]?',
  diagnosis: 'Why does [system] [fail how] under [conditions]?',
  regression: 'Does [change] move [measure] from the prior baseline under [conditions]?',
  'mission-effect': 'Does [system] protect [asset] from [threat] well enough to keep [mission effect]?',
}

export const PREDICTION_DEFS: Record<PredictionType, string> = {
  'single-value': 'One number.',
  range: 'A min to max band.',
  'min-max-bound': 'At least, or at most, one bound.',
  distribution: 'A shape, not one number.',
  'rank-order': 'An ordering of options.',
  directional: 'Higher, lower, or no change.',
  'pass-miss': 'Meets or misses the threshold.',
  'no-difference': 'No change from baseline.',
  'failure-boundary': 'Where failure starts.',
}

export const NULL_DEFAULTS: Record<PredictionType, string> = {
  'single-value': 'No difference from baseline.',
  range: 'No difference from baseline.',
  'min-max-bound': 'The bound is not met.',
  distribution: 'The distribution matches baseline.',
  'rank-order': 'No option outranks another.',
  directional: 'The measure does not move in the predicted direction.',
  'pass-miss': 'The threshold is not met.',
  'no-difference': 'No difference from baseline.',
  'failure-boundary': 'No failure boundary inside the tested range.',
}

export const REPRESENTATION_DEFS: Record<RepresentationClass, string> = {
  'actual-threat': 'The real threat system.',
  'validated-surrogate': 'A stand-in with a validated match.',
  'generic-representation': 'A generic stand-in, not validated.',
  'model-simulation': 'A software or hardware model only.',
  hybrid: 'A mix of live and simulated parts.',
}

export const FACTOR_DEFS: Record<FactorClass, string> = {
  'independent-variable': 'We change it on purpose between runs.',
  'held-control': 'We hold it fixed and verify it.',
  'recorded-covariate': 'We let it vary and record it.',
  'unobserved-nuisance': 'It varies and we cannot record it.',
  'bounded-red-choice': 'Red picks it inside set bounds.',
  'prohibited-variable': 'It must not change. A change voids the run.',
  response: 'It is a result we measure, not an input.',
}

/** Vertical radio list with a one-line definition per option. */
export function RadioDefs<T extends string>({
  label,
  value,
  options,
  onChange,
  help,
  disabled,
}: {
  label: string
  value: T
  options: Array<{ v: T; label?: string; def: string }>
  onChange: (v: T) => void
  help?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} help={help}>
      <div role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label key={o.v} className="check-row">
            <input
              type="radio"
              name={label}
              checked={value === o.v}
              disabled={disabled}
              onChange={() => onChange(o.v)}
            />
            {o.label ?? o.v}
            <span className="muted small"> {o.def}</span>
          </label>
        ))}
      </div>
    </Field>
  )
}

/**
 * SegChips over a plain string field. Single mode stores the chip text as the
 * whole string; multi mode joins with the separator. Legacy text renders as
 * an extra chip, so stored values never disappear.
 */
export function ChipsString({
  label,
  help,
  options,
  defs,
  value,
  onChange,
  multi,
  allowCustom,
  sep,
  disabled,
}: {
  label?: string
  help?: string
  options: string[]
  defs?: Record<string, string>
  value: string
  onChange: (v: string) => void
  multi?: boolean
  allowCustom?: boolean
  sep?: string
  disabled?: boolean
}) {
  const s = sep ?? ', '
  const selected = multi
    ? value
        .split(s.trim() === '' ? s : s.trim())
        .map((x) => x.trim())
        .filter((x) => x !== '')
    : value.trim() === ''
      ? null
      : value.trim()
  return (
    <SegChips
      label={label}
      help={help}
      options={options.map((o) => ({ v: o, label: o, def: defs?.[o] }))}
      value={selected}
      multi={multi}
      allowCustom={allowCustom ?? true}
      disabled={disabled}
      onChange={(v) => {
        if (multi) onChange(((v as string[] | null) ?? []).join(s))
        else onChange((v as string | null) ?? '')
      }}
    />
  )
}

/**
 * Text field with a live derivation and provenance. Empty field:
 * the derivation renders as a pending suggestion and writes on confirm.
 * Stored value equals the derivation: inherited. Differs: edited, revert
 * restores the derivation. No derivation: plain field.
 */
export function ProvText({
  label,
  value,
  onChange,
  derived,
  source,
  rows,
  help,
  disabled,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  derived: string | null
  source: string
  rows?: number
  help?: string
  disabled?: boolean
  placeholder?: string
}) {
  const d = (derived ?? '').trim()
  const field = (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      rows={rows}
      help={help}
      disabled={disabled}
      placeholder={placeholder}
    />
  )
  if (d === '' || disabled) return field
  const state = value.trim() === '' ? 'pending' : value === d ? 'inherited' : 'edited'
  return (
    <Provenance
      source={source}
      state={state}
      onConfirm={() => onChange(d)}
      onRevert={() => onChange(d)}
    >
      {field}
    </Provenance>
  )
}

// Template sentence builder (D1 wording, D3/D4 generalization bounds)

type TplPart = { literal: true; text: string } | { literal: false; key: string }

function parseTemplate(template: string): TplPart[] {
  return template
    .split(/(\[[^\]]+\])/)
    .filter((t) => t !== '')
    .map((t) =>
      t.startsWith('[') && t.endsWith(']')
        ? { literal: false as const, key: t.slice(1, -1) }
        : { literal: true as const, text: t },
    )
}

/**
 * SentenceBuilder over a [slot] template. Slot values live locally; Apply
 * writes the composed sentence to the stored string. Key the component by
 * record id plus template so slots reset on switch.
 */
export function TemplateSentence({
  template,
  value,
  onChange,
  disabled,
}: {
  template: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const parts = useMemo(() => parseTemplate(template), [template])
  const [vals, setVals] = useState<Record<string, string>>({})
  const slots: SentenceSlot[] = parts.map((p, i) =>
    p.literal
      ? { kind: 'literal', text: p.text.trim() }
      : { kind: 'text', key: `${p.key}-${i}`, placeholder: p.key, value: vals[`${p.key}-${i}`] ?? '' },
  )
  const render = () =>
    parts
      .map((p, i) => (p.literal ? p.text : (vals[`${p.key}-${i}`] ?? '').trim() || `[${p.key}]`))
      .join('')
  return (
    <SentenceBuilder
      slots={slots}
      onSlot={(key, v) => setVals((old) => ({ ...old, [key]: String(v ?? '') }))}
      render={render}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  )
}

/** Permitted and prohibited generalization pair, one sentence pattern each. */
export function GeneralizationFields({
  permitted,
  prohibited,
  onPermitted,
  onProhibited,
  recordId,
  disabled,
}: {
  permitted: string
  prohibited: string
  onPermitted: (v: string) => void
  onProhibited: (v: string) => void
  recordId: string
  disabled?: boolean
}) {
  return (
    <>
      <Field
        label="What may this evidence support beyond the exact setup?"
        help="Permitted generalization. Evidence stretched past its conditions stops being evidence."
      >
        <TemplateSentence
          key={`${recordId}-perm`}
          template="Evidence extends to [class] under [conditions]."
          value={permitted}
          onChange={onPermitted}
          disabled={disabled}
        />
      </Field>
      <Field label="What must nobody claim from this test?" help="Prohibited generalization.">
        <TemplateSentence
          key={`${recordId}-proh`}
          template="Do not claim [capability] beyond [bounds]."
          value={prohibited}
          onChange={onProhibited}
          disabled={disabled}
        />
      </Field>
    </>
  )
}

// Board-derived signals. Ranking only; nothing is hidden.

interface BoardSignals {
  kinetic: boolean
  softkill: boolean
  sensors: boolean
  c2: boolean
}

export function boardSignals(): BoardSignals {
  const sc = useStore.getState().scenario
  const out: BoardSignals = { kinetic: false, softkill: false, sensors: false, c2: false }
  for (const e of sc.entities) {
    if (e.enabled === false) continue
    if (e.kind === 'sensor') out.sensors = true
    if (e.kind === 'c2') out.c2 = true
    if (e.kind === 'effector') {
      const model = sc.library.find((m) => m.id === e.specId)
      const t = model?.effector?.effectorType
      if (t === 'jammer' || t === 'de' || t === 'hpm') out.softkill = true
      else out.kinetic = true
    }
  }
  return out
}

function dictCategory(key: string): 'sense' | 'c2' | 'defeat' | 'ew' | 'mission' {
  if (/-SEN-|-TRK-|-CLS-|-SUR-/.test(key)) return 'sense'
  if (/-C2-/.test(key)) return 'c2'
  if (/-DEF-/.test(key)) return 'defeat'
  if (/-EW-/.test(key)) return 'ew'
  return 'mission'
}

/**
 * Dictionary entries ranked by what the board holds and by engagement type.
 * Ranking only. Suppressing measures would delete rigor.
 */
export function rankedDictionary(campaign: TeCampaign): MeasureDictEntry[] {
  const sig = boardSignals()
  const comparison = campaign.charter.engagementType === 'comparison'
  const score = (e: MeasureDictEntry): number => {
    const cat = dictCategory(e.dictKey)
    let s = 0
    if (comparison && (e.dictKey === 'M-02' || e.family === 'margin')) s += 6
    if (sig.kinetic && cat === 'defeat') s += 4
    if (sig.softkill && cat === 'ew') s += 4
    if (sig.c2 && cat === 'c2') s += 3
    if (sig.sensors && cat === 'sense') s += 2
    if (sig.sensors && !sig.kinetic && !sig.softkill && cat === 'defeat') s -= 1
    return s
  }
  return [...MEASURE_DICTIONARY].sort((a, b) => score(b) - score(a))
}

// Board derivations (D2 config, D3 threat, D4 condition)

/** Sensor, C2, and effector text derived from the live board scenario. */
export function boardDescribe(): { sensor: string; c2: string; effector: string } {
  const sc = useStore.getState().scenario
  const describe = (kind: 'sensor' | 'c2' | 'effector') => {
    const counts = new Map<string, number>()
    for (const e of sc.entities) {
      if (e.kind !== kind || e.enabled === false) continue
      const model = sc.library.find((m) => m.id === e.specId)
      const name = model?.name ?? e.name
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()].map(([n, k]) => `${k}x ${n}`).join(', ')
  }
  const c2 = describe('c2')
  return {
    sensor: describe('sensor'),
    c2: c2 === '' ? '' : `${c2}; ${sc.connections.length} connection(s)`,
    effector: describe('effector'),
  }
}

/** Weather and EM text derived from the board environment. */
export function boardEnvironment(): { weather: string; em: string } {
  const env = useStore.getState().scenario.environment
  return {
    weather: `Wind ${formatSpeed(env.windSpeedMps, 'aviation')} from ${env.windFromDeg} deg true; ${env.temperatureC} C; ${env.precipitation ?? 'clear'}; ${env.light ?? 'day'} light`,
    em: `EM background: ${env.emBackground ?? 'rural'}`,
  }
}

/** Threat physical identity derived from a linked board UAS model. */
export function threatFromModel(specModelId: string | null): {
  airframe: string
  speedBandMps: [number, number]
  altBandFt: [number, number]
  uasGroup: 1 | 2 | 3 | 4 | 5
  navMode: string
} | null {
  if (!specModelId) return null
  const model = useStore.getState().scenario.library.find((m) => m.id === specModelId)
  const u = model?.uas
  if (!u) return null
  return {
    airframe: u.airframe,
    speedBandMps: [u.cruiseSpeedMps, Math.max(u.cruiseSpeedMps, u.maxSpeedMps)],
    altBandFt: [u.altBandFt[0], u.altBandFt[1]],
    uasGroup: u.group,
    navMode: u.navMode,
  }
}

/** True when any condition names a contested-or-worse spectrum. */
export function spectrumSevere(campaign: TeCampaign): boolean {
  return campaign.conditions.some((c) =>
    ['congested', 'contested', 'denied'].some((s) => c.emEnvironment.toLowerCase().includes(s)),
  )
}

// Line rows: a newline-joined string edited as add/remove rows (D2 lists).
// One line is one row; paste multi-line text into any row to keep bulk entry.

export function LineRows({
  label,
  value,
  onChange,
  placeholder,
  addLabel,
  help,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  addLabel: string
  help?: string
  disabled?: boolean
}) {
  const lines = value === '' ? [] : value.split('\n')
  const write = (next: string[]) => onChange(next.join('\n'))
  return (
    <Field label={label} help={help}>
      {lines.map((line, i) => (
        <div key={i} className="field-row">
          <input
            value={line}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={`${label} row ${i + 1}`}
            onChange={(e) => write(lines.map((l, j) => (j === i ? e.target.value : l)))}
          />
          <button
            type="button"
            className="mini"
            disabled={disabled}
            title="Remove row"
            onClick={() => write(lines.filter((_, j) => j !== i))}
          >
            {'×'}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="card-chip add"
        disabled={disabled}
        onClick={() => write([...lines, ''])}
      >
        {addLabel}
      </button>
    </Field>
  )
}

// D6: prediction value shaped by prediction type; result trio derivation

/** Measure record a hypothesis names in `measuredBy`, matched by name or id. */
export function measureFor(campaign: TeCampaign, h: TeHypothesis): TeMeasure | undefined {
  const key = h.measuredBy.trim().toLowerCase()
  if (key === '') return undefined
  return campaign.measures.find(
    (m) => m.id.toLowerCase() === key || m.name.trim().toLowerCase() === key,
  )
}

/** Structured input writing the predictedValue string; raw text stays editable. */
export function PredictionValueField({
  type,
  unit,
  value,
  onChange,
  disabled,
}: {
  type: PredictionType
  unit: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)
  const u = unit.trim()
  const withUnit = (n: number) => (u === '' ? String(n) : `${n} ${u}`)
  const numeric = type === 'single-value' || type === 'failure-boundary'
  const twoNum = type === 'range'
  const bounded = type === 'min-max-bound'
  const pick =
    type === 'directional'
      ? ['higher', 'lower', 'no change']
      : type === 'pass-miss'
        ? ['meets threshold', 'misses threshold']
        : type === 'no-difference'
          ? ['no difference from baseline']
          : null
  return (
    <Field label="Predicted value" help="Record the prediction before the test.">
      {numeric && (
        <div className="nu-row">
          <input
            type="number"
            value={a ?? ''}
            disabled={disabled}
            aria-label="Predicted value number"
            onChange={(e) => {
              const n = e.target.value === '' ? null : Number(e.target.value)
              setA(n)
              if (n != null) onChange(withUnit(n))
            }}
          />
          {u !== '' && <span className="nu-unit">{u}</span>}
        </div>
      )}
      {twoNum && (
        <div className="nu-row">
          <input
            type="number"
            value={a ?? ''}
            disabled={disabled}
            aria-label="Predicted minimum"
            onChange={(e) => {
              const n = e.target.value === '' ? null : Number(e.target.value)
              setA(n)
              if (n != null && b != null) onChange(`${n} to ${b}${u === '' ? '' : ` ${u}`}`)
            }}
          />
          <span className="nu-sep">to</span>
          <input
            type="number"
            value={b ?? ''}
            disabled={disabled}
            aria-label="Predicted maximum"
            onChange={(e) => {
              const n = e.target.value === '' ? null : Number(e.target.value)
              setB(n)
              if (n != null && a != null) onChange(`${a} to ${n}${u === '' ? '' : ` ${u}`}`)
            }}
          />
        </div>
      )}
      {bounded && (
        <div className="nu-row">
          <select
            value=""
            disabled={disabled}
            aria-label="Bound direction"
            onChange={(e) => {
              if (e.target.value !== '' && a != null) onChange(`${e.target.value} ${withUnit(a)}`)
            }}
          >
            <option value="">bound…</option>
            <option value="at least">at least</option>
            <option value="at most">at most</option>
          </select>
          <input
            type="number"
            value={a ?? ''}
            disabled={disabled}
            aria-label="Bound value"
            onChange={(e) => setA(e.target.value === '' ? null : Number(e.target.value))}
          />
          {u !== '' && <span className="nu-unit">{u}</span>}
        </div>
      )}
      {pick && (
        <div className="te-chips">
          {pick.map((p) => (
            <button
              key={p}
              type="button"
              className={`card-chip ${value === p ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <input
        value={value}
        placeholder={type === 'distribution' || type === 'rank-order' ? 'Describe the shape or order' : undefined}
        disabled={disabled}
        aria-label="Predicted value text"
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

/** Derived supporting, refuting, and inconclusive drafts from one measure. */
export function resultTrio(
  m: TeMeasure,
): { supporting: string; refuting: string; inconclusive: string } | null {
  if (m.threshold == null) return null
  const t = `${m.threshold}${m.unit.trim() === '' ? '' : ` ${m.unit}`}`
  const good = m.higherIsBetter ? 'at or above' : 'at or below'
  const bad = m.higherIsBetter ? 'below' : 'above'
  return {
    supporting: `${m.name} ${good} ${t}, with the confidence interval clear of the threshold.`,
    refuting: `${m.name} ${bad} ${t}, with the confidence interval clear of the threshold.`,
    inconclusive: `The confidence interval straddles ${t}.`,
  }
}

// D8: sample-size decision and guided add-cells flow

/**
 * Sample-size decision. One computation applies to the measure's
 * required repetitions and to the selected cell's minimums. Overrides stay
 * on the numeric fields.
 */
export function SampleSizeApply({ campaign }: { campaign: TeCampaign }) {
  const { patchItem } = useTeStore.getState()
  const selectedCell = useTeStore((s) => s.ui.selected.matrix ?? null)
  const [p, setP] = useState<number | null>(0.8)
  const [h, setH] = useState<number | null>(0.1)
  const [vf, setVf] = useState<number | null>(0.8)
  const [mid, setMid] = useState<string | null>(null)
  const n = p != null && p > 0 && p < 1 && h != null && h > 0 ? sampleSizeProportion(p, h) : null
  const attempts = n != null && vf != null && vf > 0 && vf <= 1 ? attemptInflation(n, vf) : null
  const cell = campaign.matrix.find((x) => x.id === selectedCell)
  return (
    <div className="subsection">
      <div className="field-row">
        <NumberField label="Expected proportion p" value={p} onChange={setP} step={0.05} />
        <NumberField label="Half-width h" value={h} onChange={setH} step={0.01} />
        <NumberField label="Valid fraction" value={vf} onChange={setVf} step={0.05} />
      </div>
      <p className="muted small">
        {n != null
          ? `Valid runs needed: ${n} (95%, one proportion).`
          : 'Enter p between 0 and 1 and h above 0.'}
        {attempts != null ? ` Attempts at that valid fraction: ${attempts}.` : ''}
      </p>
      <div className="field-row">
        <EntityPicker
          label="Apply to measure"
          options={campaign.measures.map((m) => ({ id: m.id, label: m.name || m.id, sub: short(m.id) }))}
          value={mid}
          onChange={setMid}
        />
        <div className="inspector-actions">
          <button
            type="button"
            className="mini"
            disabled={n == null || mid == null}
            title={mid == null ? 'Pick a measure first.' : undefined}
            onClick={() => {
              if (n != null && mid != null) patchItem('measures', mid, { requiredRepetitions: n })
            }}
          >
            Set required repetitions to {n ?? '…'}
          </button>
          <button
            type="button"
            className="mini"
            disabled={n == null || cell == null}
            title={cell == null ? 'Select a matrix cell first.' : undefined}
            onClick={() => {
              if (n == null || cell == null) return
              patchItem('matrix', cell.id, {
                minValidEvidence: n,
                plannedReps: attempts ?? Math.max(cell.plannedReps, n),
              })
            }}
          >
            Set selected cell minimums
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Guided add-cells flow. The method drives the build; links inherit
 * from context; one cell lands per picked condition. Per-cell edit remains.
 */
export function AddCellsFlow({ campaign }: { campaign: TeCampaign }) {
  const { addMatrixCell, patchItem, selectRecord } = useTeStore.getState()
  const selectedQ = useTeStore((s) => s.ui.selected.questions ?? null)
  const [method, setMethod] = useState<string>(MATRIX_METHODS[1])
  const [qid, setQid] = useState<string | null>(null)
  const [hid, setHid] = useState<string | null>(null)
  const [cfgId, setCfgId] = useState<string | null>(null)
  const [thrId, setThrId] = useState<string | null>(null)
  const [condIds, setCondIds] = useState<string[]>([])
  const [reps, setReps] = useState<number | null>(null)
  const [addBaseline, setAddBaseline] = useState(true)

  const question =
    campaign.questions.find((q) => q.id === qid) ??
    campaign.questions.find((q) => q.id === selectedQ) ??
    campaign.questions[0]
  const effQid = question?.id ?? null
  const hyps = campaign.hypotheses.filter((x) => x.questionId === effQid)
  const config = campaign.configs.find((x) => x.id === cfgId) ?? campaign.configs[0]
  const threat = campaign.threats.find((x) => x.id === thrId) ?? campaign.threats[0]
  const qMeasures = campaign.measures.filter((m) => m.questionId === effQid)
  const defaultReps = Math.max(1, ...qMeasures.map((m) => m.requiredRepetitions ?? 1))
  const effReps = reps ?? defaultReps
  const comparison =
    method.toLowerCase().includes('comparison') || campaign.charter.engagementType === 'comparison'
  const hasBaseline = campaign.matrix.some((x) => x.method.toLowerCase().includes('baseline'))
  const canBuild = effQid != null && config != null && threat != null && condIds.length > 0

  const build = () => {
    if (!canBuild || !config || !threat) return
    let lastId: string | null = null
    const base = {
      questionId: effQid ?? '',
      hypothesisId: hid,
      configId: config.id,
      threatId: threat.id,
      measureIds: qMeasures.map((m) => m.id),
      plannedReps: effReps,
      minValidEvidence: Math.min(effReps, defaultReps),
    }
    const conds = [...condIds]
    if (comparison && addBaseline && !hasBaseline && conds.length > 0) {
      const id = addMatrixCell()
      patchItem('matrix', id, { ...base, conditionId: conds[0], method: 'baseline comparison' })
      lastId = id
    }
    for (const conditionId of conds) {
      const id = addMatrixCell()
      patchItem('matrix', id, { ...base, conditionId, method })
      lastId = id
    }
    if (lastId) selectRecord('matrix', lastId)
    setCondIds([])
  }

  return (
    <div className="subsection">
      <div className="field-row">
        <Field label="Method" help="What a matrix row is for. A comparison without a baseline row proves nothing.">
          <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">
            {MATRIX_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <EntityPicker
          label="Question"
          options={campaign.questions.map((q) => ({ id: q.id, label: q.wording.slice(0, 60) || q.id, sub: short(q.id) }))}
          value={effQid}
          onChange={setQid}
        />
      </div>
      <div className="field-row">
        {hyps.length > 0 && (
          <EntityPicker
            label="Hypothesis"
            options={hyps.map((x) => ({ id: x.id, label: x.producesBehavior.slice(0, 40) || x.id, sub: short(x.id) }))}
            value={hid}
            onChange={setHid}
          />
        )}
        <EntityPicker
          label="Configuration"
          options={campaign.configs.map((x) => ({ id: x.id, label: `${x.name || x.id} ${x.version}`, pill: x.frozen ? 'good' : undefined }))}
          value={config?.id ?? null}
          onChange={setCfgId}
        />
        <EntityPicker
          label="Threat"
          options={campaign.threats.map((x) => ({ id: x.id, label: x.name || x.id }))}
          value={threat?.id ?? null}
          onChange={setThrId}
        />
      </div>
      <MultiPicker
        label="Conditions (one cell each)"
        options={campaign.conditions.map((c) => ({ id: c.id, label: c.name || c.id }))}
        value={condIds}
        onChange={setCondIds}
      />
      <div className="field-row">
        <NumberField
          label="Planned reps per cell"
          value={effReps}
          onChange={(v) => setReps(v)}
          help="Defaults to the largest required repetitions among the question's measures."
        />
        {comparison && !hasBaseline && (
          <label className="check-row">
            <input type="checkbox" checked={addBaseline} onChange={(e) => setAddBaseline(e.target.checked)} />
            Add a baseline row first
          </label>
        )}
      </div>
      <button type="button" disabled={!canBuild} onClick={build}>
        Add {condIds.length || ''} cell{condIds.length === 1 ? '' : 's'}
      </button>
      {!canBuild && (
        <p className="muted small">Pick a question, a configuration, a threat, and at least one condition.</p>
      )}
    </div>
  )
}

/**
 * T&E form kit. Field, segmented control, state and provenance come from the
 * shared primitives in src/ui/kit; this module adds the composite controls the
 * phase panels need and re-exports the two primitives its panels import here.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { TePhaseTab } from '../state/teStore'
import { PHASE_INTRO } from './help'
import { Field, ProvMark, Seg, State } from '../../ui/kit'
import type { StateTone } from '../../ui/kit'

export { Field, Seg }

type PillKind = 'good' | 'warn' | 'bad' | 'neutral'

/** The T&E gate words to the shared state tones. */
const PILL_TONE: Record<PillKind, StateTone> = {
  good: 'nominal',
  warn: 'warning',
  bad: 'critical',
  neutral: 'inactive',
}

export function TextField({
  label,
  value,
  onChange,
  rows,
  placeholder,
  help,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  help?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} help={help}>
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  step,
  help,
  disabled,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  step?: number
  help?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} help={help}>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </Field>
  )
}

export function CheckField({
  label,
  value,
  onChange,
  help,
  disabled,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  help?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} help={help}>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </Field>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  allowEmpty,
  help,
  disabled,
}: {
  label: string
  value: T | null
  options: Array<{ v: T; label: string }>
  onChange: (v: T | null) => void
  allowEmpty?: string
  help?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} help={help}>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange((e.target.value || null) as T | null)}
      >
        {allowEmpty != null && <option value="">{allowEmpty}</option>}
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** ISO date input; emits 'YYYY-MM-DD' or null. Non-date legacy values stay editable as text. */
export function DateField({
  label,
  value,
  onChange,
  help,
  disabled,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  help?: string
  disabled?: boolean
}) {
  const freeText = value != null && value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(value)
  return (
    <Field label={label} help={help}>
      {freeText ? (
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
        />
      ) : (
        <input
          type="date"
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )}
    </Field>
  )
}

/**
 * Text input (or textarea when rows is set) with typed suggestions.
 * Inputs get a datalist; textareas show click-to-insert chips (max 6).
 * Free text always stays allowed.
 */
export function SuggestField({
  label,
  value,
  onChange,
  suggestions,
  help,
  placeholder,
  rows,
  disabled,
  onBlur,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  help?: string
  placeholder?: string
  rows?: number
  disabled?: boolean
  onBlur?: () => void
}) {
  const listId = useId()
  const items = [...new Set(suggestions.map((s) => s.trim()).filter((s) => s !== ''))]
  if (rows) {
    return (
      <Field label={label} help={help}>
        <textarea
          rows={rows}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {items.length > 0 && !disabled && (
          <div className="cards-list">
            {items.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                className="card-chip"
                onClick={() => onChange(value.trim() === '' ? s : `${value}\n${s}`)}
              >
                {s.length > 48 ? `${s.slice(0, 48)}…` : s}
              </button>
            ))}
          </div>
        )}
      </Field>
    )
  }
  return (
    <Field label={label} help={help}>
      <input
        value={value}
        list={items.length > 0 ? listId : undefined}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {items.length > 0 && (
        <datalist id={listId}>
          {items.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </Field>
  )
}

/** Read-only version display with an optional minor-bump button. */
export function VersionField({
  label,
  value,
  onBump,
  disabled,
}: {
  label: string
  value: string
  onBump?: () => void
  disabled?: boolean
}) {
  return (
    <Field label={label}>
      <div className="field-row">
        <input value={value} disabled />
        {onBump && (
          <button type="button" className="mini" disabled={disabled} onClick={onBump}>
            Bump minor
          </button>
        )}
      </div>
    </Field>
  )
}

/** Multi-select over record links, rendered as check rows. */
export function MultiPicker({
  label,
  options,
  value,
  onChange,
  help,
  disabled,
}: {
  label: string
  options: Array<{ id: string; label: string }>
  value: string[]
  onChange: (v: string[]) => void
  help?: string
  disabled?: boolean
}) {
  return (
    <div className="subsection">
      <div className="panel-subtitle">
        {label}
        {help && (
          <span className="help-dot" tabIndex={0} data-help={help}>
            ?
          </span>
        )}
      </div>
      {options.length === 0 && <div className="muted small">None defined yet.</div>}
      {options.map((o) => (
        <label key={o.id} className="check-row">
          <input
            type="checkbox"
            checked={value.includes(o.id)}
            disabled={disabled}
            onChange={() =>
              onChange(
                value.includes(o.id) ? value.filter((x) => x !== o.id) : [...value, o.id],
              )
            }
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

/** Master list of records as chips with an add button. */
export function ChipList({
  items,
  selectedId,
  onSelect,
  onAdd,
  addLabel,
}: {
  items: Array<{ id: string; label: string; dim?: boolean }>
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd?: () => void
  addLabel?: string
}) {
  return (
    <div className="cards-list">
      {items.map((i) => (
        <button
          key={i.id}
          className={`card-chip ${selectedId === i.id ? 'active' : ''} ${i.dim ? 'dim' : ''}`}
          onClick={() => onSelect(i.id)}
        >
          {i.label}
        </button>
      ))}
      {onAdd && (
        <button className="card-chip add" onClick={onAdd}>
          {addLabel ?? '+ New'}
        </button>
      )}
    </div>
  )
}

export function SubTitle({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="panel-subtitle">
      {children}
      {action}
    </div>
  )
}

/** A gate word in its state ink, through the shared State square. */
export function Pill({ kind, text }: { kind: PillKind; text: string }) {
  return <State tone={PILL_TONE[kind]}>{text}</State>
}

/** Blocker or warning list for gate dashboards: one state row per item. */
export function GateList({ items, kind }: { items: string[]; kind: 'bad' | 'warn' }) {
  if (items.length === 0) return null
  return (
    <div className="subsection gate-list">
      {items.map((t, i) => (
        <State key={i} tone={PILL_TONE[kind]}>
          {t}
        </State>
      ))}
    </div>
  )
}

/** Compact phase banner with an optional gate status pill. */
export function PhaseIntro({
  phase,
  gate,
}: {
  phase: TePhaseTab
  gate?: { kind: 'good' | 'warn' | 'bad' | 'neutral'; text: string }
}) {
  const intro = PHASE_INTRO[phase]
  return (
    <div className="phase-intro">
      <strong>{intro.title}</strong>
      <span className="intro-text">{intro.text}</span>
      {gate && <Pill kind={gate.kind} text={gate.text} />}
    </div>
  )
}

export function fmtDate(iso: string | null): string {
  if (!iso) return 'not set'
  return iso.slice(0, 16).replace('T', ' ')
}

// Composite decision-group components. They reuse the shared tokens and the
// field / field-row / subsection / seg / card-chip idiom.
// Keyboard: every control is tab-reachable; comboboxes filter on type,
// Enter selects, Esc closes.

/** Small tier badge. One per group or field; never a wall of red. */
function RequiredBadge({ tier }: { tier: 'required' | 'recommended' | 'advanced' }) {
  const label = tier === 'required' ? 'Required' : tier === 'recommended' ? 'Recommended' : 'Advanced'
  return <span className={`req-badge ${tier}`}>{label}</span>
}

/**
 * Decision group: one plain question as the header, a completion dot, an
 * optional tier badge, free open and close. The formal term goes in `hint`.
 */
export function DecisionGroup({
  id,
  question,
  hint,
  tier,
  state,
  defaultOpen,
  children,
}: {
  id: string
  question: string
  /** Formal T&E term and definition; renders as a ? hint, never in the question. */
  hint?: string
  tier?: 'required' | 'recommended' | 'advanced'
  state?: 'done' | 'partial' | 'empty'
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const bodyId = useId()
  return (
    <section className="decision-group" id={id}>
      <div className="dg-header">
        <button
          type="button"
          className="dg-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`dg-dot ${state ?? 'empty'}`} aria-hidden="true" />
          <span className="dg-question">{question}</span>
          <span className="dg-chevron" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
        </button>
        {tier && <RequiredBadge tier={tier} />}
        {hint && (
          <span className="help-dot" tabIndex={0} data-help={hint}>
            ?
          </span>
        )}
      </div>
      {open && (
        <div className="dg-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  )
}

/**
 * Chip select. Single (value: T | null) or multi (value: T[]).
 * Free add optional. Replaces comma text; stored values outside the option
 * list still render as chips so legacy text stays selectable.
 */
export function SegChips<T extends string>({
  label,
  help,
  options,
  value,
  multi,
  allowCustom,
  onChange,
  disabled,
}: {
  label?: string
  help?: string
  options: Array<{ v: T; label: string; def?: string }>
  value: T | T[] | null
  multi?: boolean
  allowCustom?: boolean
  onChange: (v: T | T[] | null) => void
  disabled?: boolean
}) {
  const [custom, setCustom] = useState('')
  const selected: T[] = multi ? ((value as T[] | null) ?? []) : value == null ? [] : [value as T]
  const extras = selected.filter((s) => !options.some((o) => o.v === s))
  const toggle = (v: T) => {
    if (disabled) return
    if (multi) {
      onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
    } else {
      onChange(selected.includes(v) ? null : v)
    }
  }
  const addCustom = () => {
    const v = custom.trim() as T
    if (v === '') return
    setCustom('')
    if (!selected.includes(v)) toggle(v)
  }
  const body = (
    <div className="te-chips" role="group" aria-label={label}>
      {[...options, ...extras.map((v) => ({ v, label: v, def: undefined }))].map((o) => (
        <span key={o.v} className="te-chip-wrap">
          <button
            type="button"
            className={`card-chip ${selected.includes(o.v) ? 'active' : ''}`}
            aria-pressed={selected.includes(o.v)}
            disabled={disabled}
            onClick={() => toggle(o.v)}
          >
            {o.label}
          </button>
          {o.def && (
            <span className="help-dot" tabIndex={0} data-help={o.def}>
              ?
            </span>
          )}
        </span>
      ))}
      {allowCustom && !disabled && (
        <input
          className="te-chip-add"
          value={custom}
          placeholder="Add…"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustom()
            }
          }}
          onBlur={addCustom}
        />
      )}
    </div>
  )
  if (!label) return body
  return (
    <Field label={label} help={help}>
      {body}
    </Field>
  )
}

/**
 * Searchable combobox over records. Keyboard-first: type to filter,
 * arrows move, Enter selects, Esc closes. Free entry optional; an empty
 * pool with allowFree behaves as plain text. `prefill` renders an inherited
 * default with provenance that writes only on an explicit use.
 */
export function EntityPicker({
  label,
  help,
  options,
  value,
  onChange,
  onCreate,
  prefill,
  allowFree,
  freeValue,
  onFree,
  multi,
  values,
  onChangeMulti,
  disabled,
}: {
  label: string
  help?: string
  options: Array<{ id: string; label: string; sub?: string; pill?: PillKind }>
  value?: string | null
  onChange?: (id: string | null) => void
  onCreate?: (text: string) => void
  prefill?: { id: string | null; source: string }
  allowFree?: boolean
  freeValue?: string
  onFree?: (v: string) => void
  multi?: boolean
  values?: string[]
  onChangeMulti?: (ids: string[]) => void
  disabled?: boolean
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedIds = multi ? (values ?? []) : value != null ? [value] : []
  const selectedLabel = (id: string) => options.find((o) => o.id === id)?.label ?? id
  const displayValue =
    query ?? (allowFree ? (freeValue ?? '') : !multi && value != null ? selectedLabel(value) : '')
  const q = (query ?? '').trim().toLowerCase()
  const filtered = options.filter(
    (o) =>
      q === '' ||
      o.label.toLowerCase().includes(q) ||
      (o.sub ?? '').toLowerCase().includes(q),
  )
  const canCreate = onCreate != null && q !== '' && !options.some((o) => o.label.toLowerCase() === q)
  const rowCount = filtered.length + (canCreate ? 1 : 0)
  const close = () => {
    setOpen(false)
    setQuery(null)
    setActive(0)
  }
  const pick = (id: string) => {
    if (multi) {
      if (!selectedIds.includes(id)) onChangeMulti?.([...selectedIds, id])
    } else {
      onChange?.(id)
      if (allowFree) onFree?.(selectedLabel(id))
    }
    close()
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((a) => Math.min(a + 1, rowCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      if (!open || rowCount === 0) return
      e.preventDefault()
      if (canCreate && active === filtered.length) {
        onCreate?.((query ?? '').trim())
        close()
      } else if (filtered[active]) {
        pick(filtered[active].id)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        close()
      }
    }
  }
  return (
    <Field label={label} help={help}>
      {multi && selectedIds.length > 0 && (
        <div className="te-chips">
          {selectedIds.map((id) => (
            <button
              key={id}
              type="button"
              className="card-chip active"
              disabled={disabled}
              title="Remove"
              onClick={() => onChangeMulti?.(selectedIds.filter((x) => x !== id))}
            >
              {selectedLabel(id)} {'×'}
            </button>
          ))}
        </div>
      )}
      <div className="te-combobox">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={displayValue}
          disabled={disabled}
          placeholder={options.length === 0 && allowFree ? 'Type…' : 'Type to search…'}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
            if (allowFree) onFree?.(e.target.value)
            if (!multi && e.target.value.trim() === '' && !allowFree) onChange?.(null)
          }}
          onFocus={() => {
            if (options.length > 0) setOpen(true)
          }}
          onBlur={() => close()}
          onKeyDown={onKeyDown}
        />
        {open && rowCount > 0 && (
          <ul className="te-combobox-list" role="listbox" id={listId}>
            {filtered.map((o, i) => (
              <li
                key={o.id}
                role="option"
                aria-selected={selectedIds.includes(o.id)}
                className={`te-combobox-option ${i === active ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.id)}
              >
                <span className="te-opt-label">{o.label}</span>
                {o.sub && <span className="te-opt-sub">{o.sub}</span>}
                {o.pill && <Pill kind={o.pill} text={o.pill} />}
              </li>
            ))}
            {canCreate && (
              <li
                role="option"
                aria-selected={false}
                className={`te-combobox-option create ${active === filtered.length ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCreate?.((query ?? '').trim())
                  close()
                }}
              >
                Add "{(query ?? '').trim()}"
              </li>
            )}
          </ul>
        )}
      </div>
      {prefill && prefill.id != null && (multi ? selectedIds.length === 0 : value == null) && (
        <div className="provenance-line">
          <span className="provenance-chip">from {prefill.source}</span>
          <button
            type="button"
            className="mini"
            disabled={disabled}
            onClick={() => {
              const id = prefill.id
              if (id != null) pick(id)
            }}
          >
            Use {selectedLabel(prefill.id)}
          </button>
        </div>
      )}
    </Field>
  )
}

/**
 * Person picker: EntityPicker over a name pool; writes the same string
 * fields. Multi joins names with '; '. Free names stay allowed.
 */
export function PersonPicker({
  label,
  value,
  onChange,
  people,
  prefillSource,
  multi,
  help,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  people: string[]
  prefillSource?: string
  multi?: boolean
  help?: string
  disabled?: boolean
}) {
  const names = [...new Set(people.map((p) => p.trim()).filter((p) => p !== ''))]
  const options = names.map((n) => ({ id: n, label: n }))
  if (multi) {
    const picked = value
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s !== '')
    return (
      <EntityPicker
        label={label}
        help={help}
        options={options.filter((o) => !picked.includes(o.id))}
        multi
        values={picked}
        onChangeMulti={(ids) => onChange(ids.join('; '))}
        onCreate={(text) => onChange([...picked, text].join('; '))}
        disabled={disabled}
      />
    )
  }
  return (
    <div className={prefillSource && value.trim() !== '' ? 'te-prefilled' : undefined}>
      <EntityPicker
        label={label}
        help={help}
        options={options}
        value={value.trim() === '' ? null : value}
        onChange={(id) => onChange(id ?? '')}
        allowFree
        freeValue={value}
        onFree={onChange}
        disabled={disabled}
      />
      {prefillSource && value.trim() !== '' && (
        <div className="provenance-line">
          <span className="provenance-chip">from {prefillSource}</span>
        </div>
      )}
    </div>
  )
}

/** The provenance state of an inherited field to the shared mark kind. */
const PROVENANCE_MARK = {
  inherited: 'inferred',
  edited: 'sourced',
  pending: 'probable',
} as const

/**
 * Inherited-value wrapper. `inherited` shows the source; `edited` offers
 * revert; `pending` renders a suggestion that writes only on confirm. The
 * shared mark carries the kind: inferred from a source, entered, or probable.
 */
export function Provenance({
  source,
  state,
  onConfirm,
  onRevert,
  children,
}: {
  source: string
  state: 'inherited' | 'edited' | 'pending'
  onConfirm?: () => void
  onRevert?: () => void
  children: React.ReactNode
}) {
  const word = state === 'edited' ? 'edited' : `from ${source}`
  return (
    <div className={`provenance ${state}`}>
      {children}
      <div className="provenance-line">
        <ProvMark kind={PROVENANCE_MARK[state]} title={word} />
        <span className="provenance-chip">{word}</span>
        {state === 'pending' && onConfirm && (
          <button type="button" className="mini" onClick={onConfirm}>
            Confirm
          </button>
        )}
        {state === 'edited' && onRevert && (
          <button type="button" className="mini" onClick={onRevert}>
            Revert
          </button>
        )}
      </div>
    </div>
  )
}

export type SentenceSlot =
  | { kind: 'literal'; text: string }
  | { kind: 'select'; key: string; options: string[]; value: string }
  | { kind: 'entity'; key: string; options: Array<{ id: string; label: string }>; value: string }
  | { kind: 'number'; key: string; unit?: string; value: number | null }
  | { kind: 'text'; key: string; placeholder?: string; value: string }

/**
 * Structured sentence builder. Slots write through onSlot immediately;
 * Apply writes the composed sentence to the stored string, which stays
 * editable after build. Legacy prose displays untouched; the builder
 * never parses the stored string.
 */
export function SentenceBuilder({
  slots,
  onSlot,
  render,
  value,
  onChange,
  disabled,
}: {
  slots: SentenceSlot[]
  onSlot: (key: string, v: string | number | null) => void
  render: () => string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const composed = render()
  return (
    <div className="sentence-builder">
      <div className="sb-slots">
        {slots.map((s, i) => {
          if (s.kind === 'literal')
            return (
              <span key={i} className="sb-literal">
                {s.text}
              </span>
            )
          if (s.kind === 'select')
            return (
              <select
                key={s.key}
                value={s.value}
                disabled={disabled}
                onChange={(e) => onSlot(s.key, e.target.value)}
              >
                <option value="">…</option>
                {(s.value !== '' && !s.options.includes(s.value)
                  ? [s.value, ...s.options]
                  : s.options
                ).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )
          if (s.kind === 'entity')
            return (
              <select
                key={s.key}
                value={s.value}
                disabled={disabled}
                onChange={(e) => onSlot(s.key, e.target.value)}
              >
                <option value="">…</option>
                {(s.value !== '' && !s.options.some((o) => o.id === s.value)
                  ? [{ id: s.value, label: s.value }, ...s.options]
                  : s.options
                ).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )
          if (s.kind === 'number')
            return (
              <span key={s.key} className="sb-number">
                <input
                  type="number"
                  value={s.value ?? ''}
                  disabled={disabled}
                  onChange={(e) =>
                    onSlot(s.key, e.target.value === '' ? null : Number(e.target.value))
                  }
                />
                {s.unit && <span className="sb-unit">{s.unit}</span>}
              </span>
            )
          return (
            <input
              key={s.key}
              className="sb-text"
              value={s.value}
              placeholder={s.placeholder}
              disabled={disabled}
              onChange={(e) => onSlot(s.key, e.target.value)}
            />
          )
        })}
        <button
          type="button"
          className="mini"
          disabled={disabled || composed.trim() === '' || composed === value}
          onClick={() => onChange(composed)}
        >
          Apply sentence
        </button>
      </div>
      <textarea
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/**
 * On-demand help behind one toggle: definition, example, why it matters.
 * Examples are wording templates; `illustrative` labels example data.
 */
export function ExampleHint({
  definition,
  example,
  why,
  onUse,
  illustrative,
}: {
  definition?: string
  example?: string
  why?: string
  onUse?: (text: string) => void
  illustrative?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="example-hint">
      <button
        type="button"
        className="mini eh-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide example' : 'Example'}
      </button>
      {open && (
        <div className="eh-body">
          {definition && <p className="eh-def">{definition}</p>}
          {example && (
            <p className="eh-example">
              {example}
              {illustrative && <span className="eh-illustrative">illustrative</span>}
            </p>
          )}
          {why && <p className="eh-why">{why}</p>}
          {onUse && example && (
            <button type="button" className="mini" onClick={() => onUse(example)}>
              Use this structure
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Numeric input with a unit. The unit can be fixed or a select. */
export function NumberUnitField({
  label,
  value,
  unit,
  unitOptions,
  onUnit,
  onChange,
  step,
  help,
  disabled,
}: {
  label: string
  value: number | null
  unit: string
  unitOptions?: string[]
  onUnit?: (u: string) => void
  onChange: (v: number | null) => void
  step?: number
  help?: string
  disabled?: boolean
}) {
  const input = (
    <input
      type="number"
      step={step}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  )
  if (!(unitOptions && onUnit)) {
    return (
      <Field label={label} help={help} unit={unit}>
        {input}
      </Field>
    )
  }
  return (
    <Field label={label} help={help}>
      <div className="nu-row">
        {input}
        <select
          className="nu-unit"
          value={unit}
          disabled={disabled}
          aria-label={`${label} unit`}
          onChange={(e) => onUnit(e.target.value)}
        >
          {(unit !== '' && !unitOptions.includes(unit) ? [unit, ...unitOptions] : unitOptions).map(
            (u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ),
          )}
        </select>
      </div>
    </Field>
  )
}

/** Min-max pair with a unit (speed band, alt band). */
export function RangeField({
  label,
  min,
  max,
  unit,
  onChange,
  help,
  disabled,
}: {
  label: string
  min: number | null
  max: number | null
  unit: string
  onChange: (min: number | null, max: number | null) => void
  help?: string
  disabled?: boolean
}) {
  const num = (v: string) => (v === '' ? null : Number(v))
  return (
    <Field label={label} help={help}>
      <div className="nu-row">
        <input
          type="number"
          value={min ?? ''}
          aria-label={`${label} minimum`}
          disabled={disabled}
          onChange={(e) => onChange(num(e.target.value), max)}
        />
        <span className="nu-sep">to</span>
        <input
          type="number"
          value={max ?? ''}
          aria-label={`${label} maximum`}
          disabled={disabled}
          onChange={(e) => onChange(min, num(e.target.value))}
        />
        <span className="nu-unit">{unit}</span>
      </div>
    </Field>
  )
}

interface RegisterColumn<Row> {
  key: keyof Row & string
  label: string
  kind: 'text' | 'select' | 'person' | 'date' | 'number' | 'pill'
  options?: string[]
  width?: string
}

/**
 * Structured add-row register. Typed columns, add, remove, reorder.
 * `removeImpacts` gates removal: a nonempty result disables remove and
 * lists the referrers. An all-empty row removes silently; otherwise one
 * inline confirm. Add moves focus to the new row; remove returns it to Add.
 */
export function RegisterTable<Row extends { id: string }>({
  columns,
  rows,
  onAdd,
  onPatch,
  onRemove,
  onReorder,
  removeImpacts,
  addLabel,
  empty,
}: {
  columns: Array<RegisterColumn<Row>>
  rows: Row[]
  onAdd: () => void
  onPatch: (id: string, patch: Partial<Row>) => void
  onRemove: (id: string) => void
  onReorder?: (ids: string[]) => void
  removeImpacts?: (id: string) => string[]
  addLabel: string
  empty?: string
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const pendingFocus = useRef(false)
  useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    const lastRow = bodyRef.current?.querySelector('tr:last-child')
    const cell = lastRow?.querySelector<HTMLElement>('input, select')
    cell?.focus()
  }, [rows.length])
  const rowEmpty = (row: Row) =>
    columns.every((c) => {
      const v = row[c.key]
      return v == null || String(v).trim() === ''
    })
  const move = (id: string, dir: -1 | 1) => {
    const ids = rows.map((r) => r.id)
    const i = ids.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    onReorder?.(ids)
  }
  const remove = (row: Row) => {
    if (rowEmpty(row) || confirmId === row.id) {
      setConfirmId(null)
      onRemove(row.id)
      addRef.current?.focus()
    } else {
      setConfirmId(row.id)
    }
  }
  return (
    <div className="register-table-wrap">
      {rows.length === 0 && empty && <div className="muted small">{empty}</div>}
      {rows.length > 0 && (
        <div className="te-scroll-x">
          <table className="register-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                    {c.label}
                  </th>
                ))}
                <th className="rt-actions-col" />
              </tr>
            </thead>
            <tbody ref={bodyRef}>
              {rows.map((row, rowIndex) => {
                const impacts = removeImpacts?.(row.id) ?? []
                const blocked = impacts.length > 0
                return (
                  <tr key={row.id}>
                    {columns.map((c) => {
                      const raw = row[c.key]
                      const text = raw == null ? '' : String(raw)
                      const patch = (v: unknown) => onPatch(row.id, { [c.key]: v } as Partial<Row>)
                      if (c.kind === 'pill')
                        return (
                          <td key={c.key}>
                            {text !== '' && <State tone="inactive">{text}</State>}
                          </td>
                        )
                      if (c.kind === 'select')
                        return (
                          <td key={c.key}>
                            <select value={text} onChange={(e) => patch(e.target.value)} aria-label={c.label}>
                              <option value="">…</option>
                              {(text !== '' && !(c.options ?? []).includes(text)
                                ? [text, ...(c.options ?? [])]
                                : (c.options ?? [])
                              ).map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      if (c.kind === 'number')
                        return (
                          <td key={c.key}>
                            <input
                              type="number"
                              value={raw == null ? '' : (raw as number)}
                              aria-label={c.label}
                              onChange={(e) =>
                                patch(e.target.value === '' ? null : Number(e.target.value))
                              }
                            />
                          </td>
                        )
                      if (c.kind === 'date')
                        return (
                          <td key={c.key}>
                            <input
                              type={text !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(text) ? 'text' : 'date'}
                              value={text}
                              aria-label={c.label}
                              onChange={(e) => patch(e.target.value)}
                            />
                          </td>
                        )
                      if (c.kind === 'person')
                        return (
                          <td key={c.key}>
                            <input
                              value={text}
                              list={`${listId}-${c.key}`}
                              aria-label={c.label}
                              onChange={(e) => patch(e.target.value)}
                            />
                            <datalist id={`${listId}-${c.key}`}>
                              {(c.options ?? []).map((o) => (
                                <option key={o} value={o} />
                              ))}
                            </datalist>
                          </td>
                        )
                      return (
                        <td key={c.key}>
                          <input value={text} aria-label={c.label} onChange={(e) => patch(e.target.value)} />
                        </td>
                      )
                    })}
                    <td className="rt-actions">
                      {onReorder && (
                        <>
                          <button
                            type="button"
                            className="mini"
                            title="Move up"
                            disabled={rowIndex === 0}
                            onClick={() => move(row.id, -1)}
                          >
                            {'↑'}
                          </button>
                          <button
                            type="button"
                            className="mini"
                            title="Move down"
                            disabled={rowIndex === rows.length - 1}
                            onClick={() => move(row.id, 1)}
                          >
                            {'↓'}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="mini"
                        disabled={blocked}
                        title={blocked ? `In use: ${impacts.join(', ')}` : undefined}
                        onClick={() => remove(row)}
                        onBlur={() => setConfirmId((c) => (c === row.id ? null : c))}
                      >
                        {blocked ? 'In use' : confirmId === row.id ? 'Confirm?' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <button
        ref={addRef}
        type="button"
        className="card-chip add"
        onClick={() => {
          pendingFocus.current = true
          onAdd()
        }}
      >
        {addLabel}
      </button>
    </div>
  )
}

/** One action stamps person and timestamp together (cold read, dry run). */
export function RecordCheck({
  label,
  help,
  by,
  at,
  people,
  onRecord,
  disabled,
}: {
  label: string
  help?: string
  by: string
  at: string | null
  people: string[]
  onRecord: (by: string) => void
  disabled?: boolean
}) {
  const listId = useId()
  const [name, setName] = useState(by)
  const names = [...new Set(people.map((p) => p.trim()).filter((p) => p !== ''))]
  if (at) {
    return (
      <Field label={label} help={help}>
        <div className="record-check done">
          <Pill kind="good" text="recorded" />
          <span className="rc-stamp">
            {by || 'unnamed'} {'·'} {fmtDate(at)}
          </span>
        </div>
      </Field>
    )
  }
  return (
    <Field label={label} help={help}>
      <div className="record-check">
        <input
          value={name}
          list={listId}
          placeholder="Name"
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim() !== '') onRecord(name.trim())
          }}
        />
        <datalist id={listId}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button
          type="button"
          className="mini"
          disabled={disabled || name.trim() === ''}
          onClick={() => onRecord(name.trim())}
        >
          Record
        </button>
      </div>
    </Field>
  )
}

/** Persistent readiness readout. Rendered by OpsWorkspace at the right edge. */
export function ReadinessRail({
  pct,
  items,
}: {
  pct: number
  items: Array<{
    label: string
    state: 'done' | 'partial' | 'missing'
    detail?: string
    onPreview?: () => void
  }>
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <aside className="readiness-rail" aria-label="Campaign readiness">
      <div className="rr-head">
        <span>Readiness</span>
        <span className="num">{clamped}%</span>
      </div>
      <div
        className="rr-bar"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="rr-bar-fill" style={{ width: `${clamped}%` }} />
      </div>
      <ul className="rr-items">
        {items.map((it) => (
          <li key={it.label} className="rr-item">
            <span className={`dg-dot ${it.state === 'done' ? 'done' : it.state === 'partial' ? 'partial' : 'empty'}`} aria-hidden="true" />
            <span className="rr-label">{it.label}</span>
            {it.detail && <span className="rr-detail num">{it.detail}</span>}
            {it.onPreview && (
              <button type="button" className="mini" onClick={it.onPreview}>
                View
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}

/**
 * Generated stage-gate summary. Rows come from campaign data, issues from
 * validate.ts. Reading replaces retyping; nothing here is stored.
 */
export function StageReview({
  title,
  rows,
  issues,
  passLabel,
  onPass,
  onBack,
  disabled,
}: {
  title: string
  rows: Array<{ label: string; value: string; source?: string }>
  issues: Array<{ level: 'block' | 'warn'; text: string }>
  passLabel: string
  onPass: () => void
  onBack?: () => void
  disabled?: boolean
}) {
  const blocked = issues.some((i) => i.level === 'block')
  return (
    <div className="stage-review">
      <div className="panel-subtitle">{title}</div>
      <div className="sr-rows">
        {rows.map((r) => (
          <div key={r.label} className="sr-row">
            <span className="sr-label">{r.label}</span>
            <span className="sr-value">{r.value.trim() === '' ? '—' : r.value}</span>
            {r.source && <span className="provenance-chip">from {r.source}</span>}
          </div>
        ))}
      </div>
      {issues.length > 0 && (
        <div className="sr-issues">
          {issues.map((i, n) => (
            <div key={n} className={`gate-item ${i.level === 'block' ? 'bad' : ''}`}>
              {i.text}
            </div>
          ))}
        </div>
      )}
      <div className="sr-actions">
        {onBack && (
          <button type="button" className="mini" onClick={onBack}>
            Back to edit
          </button>
        )}
        <button
          type="button"
          disabled={disabled || blocked}
          title={blocked ? 'Clear the blockers first.' : undefined}
          onClick={onPass}
        >
          {passLabel}
        </button>
      </div>
    </div>
  )
}

/** Collapsed advanced fields inside a group. Closed by default. */
export function AdvancedDisclosure({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  return (
    <div className="advanced-disclosure">
      <button
        type="button"
        className="ad-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {label ?? 'Advanced'}
      </button>
      {open && (
        <div className="ad-body" id={bodyId}>
          {children}
        </div>
      )}
    </div>
  )
}

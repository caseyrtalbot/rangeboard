/**
 * Shared form kit for T&E panels. Reuses the app CSS conventions
 * (field, field-row, subsection, seg, card-chip) so panels look native.
 */

import { useId } from 'react'
import type { TePhaseTab } from '../state/teStore'
import { PHASE_INTRO } from './help'

export function Field({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <label className="field">
      <span>
        {label}
        {help && (
          <span className="help-dot" tabIndex={0} data-help={help}>
            ?
          </span>
        )}
      </span>
      {children}
    </label>
  )
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

/** Segmented control: one active option, no typing. */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.v}
          className={value === o.v ? 'active' : ''}
          disabled={disabled}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
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

/** Text input with a datalist of known people; free text stays allowed. */
export function PersonField({
  label,
  value,
  onChange,
  people,
  help,
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  people: string[]
  help?: string
  placeholder?: string
  disabled?: boolean
}) {
  const listId = useId()
  const names = [...new Set(people.map((p) => p.trim()).filter((p) => p !== ''))]
  return (
    <Field label={label} help={help}>
      <input
        value={value}
        list={listId}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
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

/** One item per line; edits round-trip through a textarea. */
export function LinesField({
  label,
  value,
  onChange,
  rows,
  help,
  disabled,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  rows?: number
  help?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} help={help}>
      <textarea
        rows={rows ?? 4}
        value={value.join('\n')}
        placeholder="One item per line"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        onBlur={(e) => onChange(e.target.value.split('\n').filter((l) => l.trim() !== ''))}
      />
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

/** Status pill using the existing status color classes. */
export function Pill({ kind, text }: { kind: 'good' | 'warn' | 'bad' | 'neutral'; text: string }) {
  return <span className={`status ${kind}`}>{text}</span>
}

/** Blocker or warning list for gate dashboards. */
export function GateList({ items, kind }: { items: string[]; kind: 'bad' | 'warn' }) {
  if (items.length === 0) return null
  return (
    <div className="subsection">
      {items.map((t, i) => (
        <div key={i} className={`gate-item ${kind}`}>
          {t}
        </div>
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

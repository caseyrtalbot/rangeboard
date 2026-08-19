/**
 * Shared form kit for T&E panels. Reuses the app CSS conventions
 * (field, field-row, subsection, seg, card-chip) so panels look native.
 */

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
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
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <Field label={label}>
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
  disabled,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  step?: number
  disabled?: boolean
}) {
  return (
    <Field label={label}>
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
  disabled,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <Field label={label}>
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
  disabled,
}: {
  label: string
  value: T | null
  options: Array<{ v: T; label: string }>
  onChange: (v: T | null) => void
  allowEmpty?: string
  disabled?: boolean
}) {
  return (
    <Field label={label}>
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

/** One item per line; edits round-trip through a textarea. */
export function LinesField({
  label,
  value,
  onChange,
  rows,
  disabled,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  rows?: number
  disabled?: boolean
}) {
  return (
    <Field label={label}>
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
  disabled,
}: {
  label: string
  options: Array<{ id: string; label: string }>
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
}) {
  return (
    <div className="subsection">
      <div className="panel-subtitle">{label}</div>
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

export function fmtDate(iso: string | null): string {
  if (!iso) return 'not set'
  return iso.slice(0, 16).replace('T', ' ')
}

/**
 * Card-panel building blocks.
 * Local to CardsPanel: derived read-through fields with provenance, chip
 * strings, classed stop and validity tables, and the sentence builders.
 * Every block writes existing TeCard string fields. Nothing new is stored.
 */

import { useEffect, useRef, useState } from 'react'
import { Field, Provenance, RegisterTable, SegChips, SentenceBuilder, TextField } from './kit'
import type { SentenceSlot } from './kit'

/**
 * Provenance wrapper driven by value-vs-derivation comparison.
 * Empty value with a live derivation renders pending; equal renders
 * inherited; different renders edited with revert.
 */
function WithProvenance({
  value,
  derived,
  source,
  onWrite,
  disabled,
  children,
}: {
  value: string
  derived: string
  source: string
  onWrite: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const d = derived.trim()
  if (d === '') return <>{children}</>
  const v = value.trim()
  if (v === '') {
    return (
      <Provenance source={source} state="pending" onConfirm={disabled ? undefined : () => onWrite(derived)}>
        {children}
      </Provenance>
    )
  }
  if (v === d) {
    return (
      <Provenance source={source} state="inherited">
        {children}
      </Provenance>
    )
  }
  return (
    <Provenance source={source} state="edited" onRevert={disabled ? undefined : () => onWrite(derived)}>
      {children}
    </Provenance>
  )
}

/** Text field that reads through an inherited derivation with provenance. */
export function DerivedText({
  label,
  value,
  derived,
  source,
  onChange,
  rows,
  help,
  disabled,
}: {
  label: string
  value: string
  derived: string
  source: string
  onChange: (v: string) => void
  rows?: number
  help?: string
  disabled?: boolean
}) {
  const pending = value.trim() === '' && derived.trim() !== ''
  return (
    <WithProvenance value={value} derived={derived} source={source} onWrite={onChange} disabled={disabled}>
      <TextField
        label={label}
        value={value}
        onChange={onChange}
        rows={rows}
        help={help}
        disabled={disabled}
        placeholder={pending ? derived : undefined}
      />
    </WithProvenance>
  )
}

/**
 * Chips over one stored string field. Splits on newline or semicolon,
 * joins with `sep`. Legacy prose renders as one removable chip; the
 * stored string only changes when the user acts.
 */
export function ChipString({
  label,
  value,
  onChange,
  options,
  sep = '; ',
  help,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  sep?: string
  help?: string
  disabled?: boolean
}) {
  const parts = value
    .split(/[\n;]/)
    .map((t) => t.trim())
    .filter((t) => t !== '')
  return (
    <SegChips
      label={label}
      help={help}
      multi
      allowCustom
      options={[...new Set(options.map((o) => o.trim()).filter((o) => o !== ''))].map((o) => ({
        v: o,
        label: o,
      }))}
      value={parts}
      onChange={(v) => onChange(((v as string[] | null) ?? []).join(sep))}
      disabled={disabled}
    />
  )
}

/**
 * Check rows over a known string vocabulary plus one free-add row.
 * Checked rows are the stored lines; storage stays string[].
 */
export function LineChecklist({
  label,
  options,
  value,
  onChange,
  help,
  disabled,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  help?: string
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')
  const known = [...new Set(options.map((o) => o.trim()).filter((o) => o !== ''))]
  const trimmed = value.map((v) => v.trim())
  const countOf = (line: string) => trimmed.filter((t) => t === line).length
  const extras: string[] = []
  for (const t of trimmed) {
    if (!known.includes(t) && !extras.includes(t)) extras.push(t)
  }
  const removeOne = (line: string) => {
    const i = trimmed.indexOf(line)
    onChange(value.filter((_, j) => j !== i))
  }
  const toggle = (line: string) => (countOf(line) > 0 ? removeOne(line) : onChange([...value, line]))
  const add = () => {
    const line = draft.trim()
    if (line === '' || trimmed.includes(line)) return
    onChange([...value, line])
    setDraft('')
  }
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
      {known.map((o) => (
        <label key={o} className="check-row">
          <input type="checkbox" checked={countOf(o) > 0} disabled={disabled} onChange={() => toggle(o)} />
          {countOf(o) > 1 ? `${o} x${countOf(o)}` : o}
        </label>
      ))}
      {extras.map((x) => (
        <label key={x} className="check-row" title="Uncheck removes this line.">
          <input type="checkbox" checked disabled={disabled} onChange={() => removeOne(x)} />
          {countOf(x) > 1 ? `${x} x${countOf(x)}` : x}
        </label>
      ))}
      {!disabled && (
        <div className="field-row">
          <input
            value={draft}
            placeholder="Add your own"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
          />
          <button type="button" className="mini" disabled={draft.trim() === ''} onClick={add}>
            Add
          </button>
        </div>
      )}
    </div>
  )
}

interface ClassedField {
  /** Schema field key the class writes back to. */
  key: string
  /** Class label shown in the table's select column. */
  label: string
}

interface ClassedRow {
  id: string
  text: string
  cls: string
}

/**
 * One table over several one-line-per-rule string fields, a class per row.
 * Rows render back to the same schema strings, one line each; empty rows
 * live only in local state until they carry text.
 */
export function ClassedLinesTable({
  fields,
  textLabel,
  classLabel,
  addLabel,
  empty,
  values,
  onChange,
  suggestions,
  disabled,
}: {
  fields: ClassedField[]
  textLabel: string
  classLabel: string
  addLabel: string
  empty: string
  values: Record<string, string>
  onChange: (patch: Record<string, string>) => void
  suggestions?: Array<{ text: string; cls: string }>
  disabled?: boolean
}) {
  const counter = useRef(0)
  const nid = () => `row${counter.current++}`
  const parseRows = (): ClassedRow[] =>
    fields.flatMap((f) =>
      (values[f.key] ?? '')
        .split('\n')
        .map((t) => t.trim())
        .filter((t) => t !== '')
        .map((text) => ({ id: nid(), text, cls: f.label })),
    )
  const snapshot = JSON.stringify(fields.map((f) => values[f.key] ?? ''))
  const [rows, setRows] = useState<ClassedRow[]>(parseRows)
  const lastEmitted = useRef(snapshot)
  useEffect(() => {
    if (snapshot !== lastEmitted.current) {
      lastEmitted.current = snapshot
      setRows(parseRows())
    }
    // parseRows reads the same values snapshot captures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot])
  const commit = (next: ClassedRow[]) => {
    setRows(next)
    const patch: Record<string, string> = {}
    for (const f of fields) {
      patch[f.key] = next
        .filter((r) => r.cls === f.label && r.text.trim() !== '')
        .map((r) => r.text.trim())
        .join('\n')
    }
    lastEmitted.current = JSON.stringify(fields.map((f) => patch[f.key]))
    onChange(patch)
  }
  if (disabled) {
    return (
      <div className="subsection">
        {rows.length === 0 && <div className="muted small">{empty}</div>}
        {rows.map((r) => (
          <div key={r.id} className="muted small">
            {r.cls}: {r.text}
          </div>
        ))}
      </div>
    )
  }
  const openSuggestions = (suggestions ?? []).filter((s) => !rows.some((r) => r.text === s.text))
  return (
    <div className="subsection">
      <RegisterTable<ClassedRow>
        columns={[
          { key: 'text', label: textLabel, kind: 'text' },
          { key: 'cls', label: classLabel, kind: 'select', options: fields.map((f) => f.label), width: '9em' },
        ]}
        rows={rows}
        onAdd={() => commit([...rows, { id: nid(), text: '', cls: fields[0].label }])}
        onPatch={(id, patch) => commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
        onRemove={(id) => commit(rows.filter((r) => r.id !== id))}
        addLabel={addLabel}
        empty={empty}
      />
      {openSuggestions.length > 0 && (
        <div className="te-chips">
          {openSuggestions.map((s) => (
            <button
              key={s.text}
              type="button"
              className="card-chip"
              title={`Adds a ${s.cls} row`}
              onClick={() => commit([...rows, { id: nid(), text: s.text, cls: s.cls }])}
            >
              + {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Run order and grouping builder. Writes the one orderAndBlocking string;
 * the stored text stays editable and legacy prose displays untouched.
 */
export function OrderBlockingBuilder({
  value,
  derived,
  source,
  onChange,
  disabled,
}: {
  value: string
  derived: string
  source: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [order, setOrder] = useState('')
  const [block, setBlock] = useState('')
  const render = () => {
    if (order === '') return ''
    if (block === '' || block === 'none') return `${order} order; no blocking`
    return `${order} order; blocked by ${block}`
  }
  return (
    <WithProvenance value={value} derived={derived} source={source} onWrite={onChange} disabled={disabled}>
      <Field label="Run order and grouping" help="Order and blocking: how attempts are sequenced and grouped.">
        <SentenceBuilder
          slots={[
            { kind: 'select', key: 'order', options: ['randomized', 'restricted', 'fixed'], value: order },
            { kind: 'literal', text: 'order; blocked by' },
            {
              kind: 'select',
              key: 'block',
              options: ['day', 'operator', 'threat article', 'weather', 'none'],
              value: block,
            },
          ]}
          onSlot={(key, v) => {
            if (key === 'order') setOrder(String(v ?? ''))
            else setBlock(String(v ?? ''))
          }}
          render={render}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </Field>
    </WithProvenance>
  )
}

/** Red start state builder: inherited threat profile plus geometry. */
export function RedStateBuilder({
  value,
  onChange,
  threatDesc,
  kinetic,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  threatDesc: string
  /** Board holds a kinetic effector: offer an optional intercept-range slot. */
  kinetic?: boolean
  disabled?: boolean
}) {
  const [route, setRoute] = useState('')
  const [altFt, setAltFt] = useState<number | null>(null)
  const [speedMps, setSpeedMps] = useState<number | null>(null)
  const [aspectDeg, setAspectDeg] = useState<number | null>(null)
  const [interceptM, setInterceptM] = useState<number | null>(null)
  const render = () => {
    const parts = [
      route.trim() !== '' ? `inbound on ${route.trim()}` : '',
      altFt != null ? `${altFt} ft AGL` : '',
      speedMps != null ? `${speedMps} m/s` : '',
      aspectDeg != null ? `aspect ${aspectDeg} deg` : '',
      kinetic && interceptM != null ? `planned intercept at ${interceptM} m` : '',
    ].filter((p) => p !== '')
    if (parts.length === 0) return ''
    return `${threatDesc}: ${parts.join(', ')}`
  }
  const slots: SentenceSlot[] = [
    { kind: 'literal', text: `${threatDesc}:` },
    { kind: 'text', key: 'route', placeholder: 'route or start point', value: route },
    { kind: 'number', key: 'altFt', unit: 'ft AGL', value: altFt },
    { kind: 'number', key: 'speedMps', unit: 'm/s', value: speedMps },
    { kind: 'literal', text: 'aspect' },
    { kind: 'number', key: 'aspectDeg', unit: 'deg', value: aspectDeg },
  ]
  if (kinetic) {
    slots.push(
      { kind: 'literal', text: 'planned intercept at' },
      { kind: 'number', key: 'interceptM', unit: 'm', value: interceptM },
    )
  }
  return (
    <Field label="Red start state" help="Where red starts, on what route, at what height and speed.">
      <SentenceBuilder
        slots={slots}
        onSlot={(key, v) => {
          if (key === 'route') setRoute(String(v ?? ''))
          else if (key === 'altFt') setAltFt(v == null ? null : Number(v))
          else if (key === 'speedMps') setSpeedMps(v == null ? null : Number(v))
          else if (key === 'aspectDeg') setAspectDeg(v == null ? null : Number(v))
          else setInterceptM(v == null ? null : Number(v))
        }}
        render={render}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </Field>
  )
}

/** Live-monitor role plus fallback action, written to one string. */
export function MonitoringBuilder({
  value,
  onChange,
  roles,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  roles: string[]
  disabled?: boolean
}) {
  const [role, setRole] = useState('')
  const [fallback, setFallback] = useState('')
  const render = () => {
    if (role === '') return ''
    const base = `${role} watches the data live`
    return fallback.trim() === '' ? base : `${base}; if it fails: ${fallback.trim()}`
  }
  return (
    <Field label="Live data monitor and fallback" help="Who watches the data live, and what happens if it fails.">
      <SentenceBuilder
        slots={[
          { kind: 'select', key: 'role', options: roles, value: role },
          { kind: 'literal', text: 'watches the data live; if it fails:' },
          { kind: 'text', key: 'fallback', placeholder: 'fallback action', value: fallback },
        ]}
        onSlot={(key, v) => {
          if (key === 'role') setRole(String(v ?? ''))
          else setFallback(String(v ?? ''))
        }}
        render={render}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </Field>
  )
}

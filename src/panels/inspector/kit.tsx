/**
 * Inspector component kit. Sections are separated by a hairline and an eyebrow; a
 * property is a label on the left with its value right-aligned on the same
 * baseline. Every visual value comes from a design token in index.css. Monospace
 * is reserved for machine data: ids, coordinates, timestamps, units and keys.
 */

import type { ReactNode } from 'react'
import type { SpecModel } from '../../model/types'
import { basisFor } from '../../model/types'
import { spreadFor } from '../../analysis/uncertainty'
import { spreadText } from './spreadText'
import { ProvMark, State } from '../../ui/kit'
import type { StateTone } from '../../ui/kit'

/** One titled block: an eyebrow, an optional right-aligned note, then the rows. */
export function Section({
  label,
  note,
  children,
}: {
  label: string
  note?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="insp-section">
      <div className="insp-eyebrow">
        <span>{label}</span>
        {note != null && <span className="insp-eyebrow-note">{note}</span>}
      </div>
      {children}
    </section>
  )
}

/**
 * A read-only property in the key and value grid: key, value in mono, then the
 * provenance mark column. `unit` renders after the number a text step down;
 * `muted` drops the value a step. `tag` is the provenance mark, and a row without
 * one keeps the empty column. A `stacked` row is prose under its key, in sans and
 * with no mark column.
 */
export function Row({
  label,
  value,
  unit,
  tag,
  stacked,
  muted,
  title,
}: {
  label: string
  value: ReactNode
  unit?: string
  tag?: ReactNode
  stacked?: boolean
  muted?: boolean
  title?: string
}) {
  const empty = value == null || value === '' || value === '—'
  // A narrow panel truncates both halves, so both carry the full text on hover.
  const text =
    typeof value === 'string' || typeof value === 'number'
      ? `${value}${unit ? ` ${unit}` : ''}`
      : undefined
  const hover = title ?? text
  return (
    <div className={stacked ? 'insp-row stacked' : 'insp-row'}>
      <span className="insp-row-label" title={label}>
        {label}
      </span>
      <span
        className={['insp-row-value', muted ? 'muted' : '', empty ? 'empty' : '']
          .filter(Boolean)
          .join(' ')}
        title={hover}
      >
        {empty ? '—' : value}
        {!empty && unit && <span className="unit">{unit}</span>}
      </span>
      {!stacked && (tag ?? <ProvMark kind="absent" />)}
    </div>
  )
}

/** The spread part of a tag title: the resolved spread, or a pinned row. */
function spreadTitle(model: SpecModel | undefined, field: string): string {
  if (!model) return ''
  const spread = spreadFor(model, field)
  if (spread) return ` · spread ${spreadText(spread)}`
  const row = model.provenance?.find((p) => p.field === field)
  return row?.spread === null ? ' · pinned' : ''
}

/**
 * The provenance mark of one spec field. A planning factor is the hollow mark; a
 * datasheet or reference row is the filled sourced mark, with its basis, source
 * and date in the title. An absent value, or no model, is a planning factor. The
 * title names the field's spread, or says the row is pinned.
 */
export function PfTag({
  model,
  field,
  absent = false,
}: {
  model: SpecModel | undefined
  field: string
  absent?: boolean
}) {
  const row = model?.provenance?.find((p) => p.field === field)
  const spread = spreadTitle(model, field)
  if (absent || !model || basisFor(model, field) === 'pf' || !row) {
    return <ProvMark kind="pf" title={`planning factor${spread}`} />
  }
  return <ProvMark kind="sourced" title={`${row.basis} · ${row.source} · ${row.date}${spread}`} />
}

/** False-alarm probability as a compact exponent, e.g. 1e-6. */
export function pfaText(pfa: number): string {
  return pfa.toExponential(0).replace('+', '')
}

/** Compact object identity line: what it is, what type, and its state. */
export function ObjectHeader({
  name,
  type,
  status,
  statusLabel,
}: {
  name: string
  type: string
  status?: StateTone
  statusLabel?: string
}) {
  return (
    <header className="insp-header">
      <div className="insp-header-top">
        <span className="insp-header-name" title={name}>
          {name}
        </span>
        {status && statusLabel && <State tone={status}>{statusLabel}</State>}
      </div>
      <span className="insp-header-sub" title={type}>
        {type}
      </span>
    </header>
  )
}

/** Nothing-to-inspect state, at the top of the panel where the data appears. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      <p>{body}</p>
    </div>
  )
}

/** Footer button group. Buttons share the width evenly. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="inspector-actions">{children}</div>
}

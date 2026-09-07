/**
 * Inspector component kit.
 *
 * The right panel is one continuous instrument surface: sections are
 * separated by a hairline and an eyebrow, never enclosed in a card, and a
 * property is always a label on the left with its value right-aligned on the
 * same baseline. Every visual value here comes from a design token in
 * index.css, so a surface, a text step or a status colour is retuned in one
 * place rather than per component.
 *
 * Monospace is reserved for machine data: ids, coordinates, timestamps, units
 * and keys. Everything else is set in the UI sans.
 */

import type { ReactNode } from 'react'
import type { SpecModel } from '../../model/types'
import { basisFor } from '../../model/types'
import { spreadFor } from '../../analysis/uncertainty'
import { spreadText } from './spreadText'
import { ProvMark, State } from '../../ui/kit'
import type { StateTone } from '../../ui/kit'

/**
 * One titled block of the Inspector. Renders an uppercase eyebrow, an
 * optional right-aligned note on the same line, then its rows.
 */
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
 * A read-only property in the key and value grid: key in text 2, value in
 * mono right-aligned, then the provenance mark column. `unit` renders after
 * the number in the secondary text step so it never competes with it, and
 * `muted` drops the value a step for information that is negative or
 * incidental. A string value carries a title attribute so a truncated value
 * stays readable. `tag` is the mark of the value's provenance; a row without
 * one keeps the empty column so the absence reads. A `stacked` row is prose
 * under its key, so it stays sans and carries no mark column.
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
  // A narrow panel truncates both halves of the row, so both carry the full
  // text on hover. The unit belongs to the value, so the title carries it too.
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
 * The provenance mark of one spec field. A planning factor is the hollow mark;
 * a datasheet or reference row is the filled sourced mark with its basis,
 * source and date in the title. An absent value, or no model at all, is
 * always a planning factor. Either title names the field's spread, or says
 * the row is pinned, so a total-uncertainty run is readable from the mark.
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

/**
 * Nothing-to-inspect state. Sits at the top of the panel where inspection
 * data will appear, and reads as a state rather than as an error.
 */
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

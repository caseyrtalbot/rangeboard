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

/** Semantic state of an object or a measurement. Drives colour, nothing else. */
export type StatusTone = 'nominal' | 'warning' | 'critical' | 'inactive'

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
 * A read-only property. `mono` is for machine data, `unit` renders after the
 * number in the secondary text step so it never competes with it, and `muted`
 * drops the value a step for information that is negative or incidental. A
 * string value carries a title attribute so a truncated value stays readable.
 * `tag` follows the unit and carries the basis of the value.
 */
export function Row({
  label,
  value,
  unit,
  tag,
  mono,
  stacked,
  muted,
  title,
}: {
  label: string
  value: ReactNode
  unit?: string
  tag?: ReactNode
  mono?: boolean
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
        className={['insp-row-value', mono ? 'mono' : '', muted ? 'muted' : '', empty ? 'empty' : '']
          .filter(Boolean)
          .join(' ')}
        title={hover}
      >
        {empty ? '—' : value}
        {!empty && unit && <span className="unit">{unit}</span>}
        {tag}
      </span>
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
 * The provenance tag of one spec field. A planning factor reads PF; a
 * datasheet or reference row reads SRC with its basis, source and date. An
 * absent value, or no model at all, is always PF. Either title names the
 * field's spread, or says the row is pinned, so a total-uncertainty run is
 * readable from the tag.
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
    return (
      <span className="pf" title={`planning factor${spread}`}>
        PF
      </span>
    )
  }
  return (
    <span className="pf src" title={`${row.basis} · ${row.source} · ${row.date}${spread}`}>
      SRC
    </span>
  )
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
  status?: StatusTone
  statusLabel?: string
}) {
  return (
    <header className="insp-header">
      <div className="insp-header-top">
        <span className="insp-header-name" title={name}>
          {name}
        </span>
        {status && statusLabel && <Status tone={status}>{statusLabel}</Status>}
      </div>
      <span className="insp-header-sub" title={type}>
        {type}
      </span>
    </header>
  )
}

/** Dot plus label. The only place colour enters the panel unprompted. */
export function Status({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`insp-status ${tone}`}>{children}</span>
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

/** A single keyboard key or gesture token. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

/**
 * Two-column keyboard reference: action left, keys right, aligned across
 * every row. Each entry is an action and the keys pressed for it.
 */
export function ShortcutList({ items }: { items: Array<[string, string[]]> }) {
  return (
    <div className="insp-shortcuts">
      {items.map(([action, keys]) => (
        <div key={action} className="insp-shortcut">
          <span>{action}</span>
          <span className="insp-shortcut-keys">
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Footer button group. Buttons share the width evenly. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="inspector-actions">{children}</div>
}

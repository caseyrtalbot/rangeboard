/**
 * Shared primitives for the Board panels: field, segmented control, state and
 * provenance mark. Reads only the classes and tokens in index.css; imports no store.
 */

import type { CSSProperties, ReactNode } from 'react'

/** State ink of a word or a square: the three state colours and the grey. */
export type StateTone = 'nominal' | 'warning' | 'critical' | 'inactive'

/** Provenance of a displayed value. `absent` keeps the column and drops the mark. */
export type ProvKind = 'sourced' | 'pf' | 'estimated' | 'probable' | 'inferred' | 'absent'

/**
 * A labelled control. The label sits above the control slot; `help` adds the
 * hover dot after the label; `unit` sets a mono text 3 unit inside the frame,
 * after the control. Only a field that accepts input carries an input frame.
 */
export function Field({
  label,
  help,
  unit,
  children,
}: {
  label: string
  help?: string
  unit?: string
  children: ReactNode
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
      {unit == null ? (
        children
      ) : (
        <div className="nu-row">
          {children}
          <span className="nu-unit">{unit}</span>
        </div>
      )}
    </label>
  )
}

/**
 * Segmented control: one bordered group, one pressed segment that inverts to
 * text 1 on ink. `label` names the group for assistive technology.
 */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
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

/**
 * A state: an 8 px square and a word in one state ink. `hollow` marks an
 * undecided or qualifying count; `live` draws the one round mark. `style`
 * carries a channel colour (a track phase) when the ink is not a state tone.
 */
export function State({
  tone,
  hollow,
  live,
  style,
  title,
  role,
  children,
}: {
  tone: StateTone
  hollow?: boolean
  live?: boolean
  style?: CSSProperties
  title?: string
  role?: string
  children: ReactNode
}) {
  const mark = ['state-square', hollow ? 'hollow' : '', live ? 'live' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <span className={`state ${tone}`} style={style} title={title} role={role}>
      <i className={mark} aria-hidden="true" />
      {children}
    </span>
  )
}

/**
 * Provenance mark: one 8 px shape in a fixed 36 px column after a value.
 * Filled for sourced, hollow for a planning factor, half for estimated, dashed
 * for probable, a circle for inferred. `absent` keeps the column empty so the
 * missing mark reads as a fact. `title` is the word and source line on hover.
 */
export function ProvMark({ kind, title }: { kind: ProvKind; title?: string }) {
  const cls = kind === 'sourced' ? 'prov-mark' : `prov-mark ${kind}`
  return <span className={cls} title={title} aria-label={title} />
}

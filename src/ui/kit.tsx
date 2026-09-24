/**
 * Shared primitives for the Board panels: field, segmented control, state and
 * provenance mark. Reads only the classes and tokens in index.css; imports no store.
 */

import { cloneElement, createContext, isValidElement, useContext, useId } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { IconInfo } from './icons'

/** State ink of a word or a square: the three state colours and the grey. */
export type StateTone = 'nominal' | 'warning' | 'critical' | 'inactive'

/** Provenance of a displayed value. `absent` keeps the column and drops the mark. */
export type ProvKind = 'sourced' | 'pf' | 'estimated' | 'probable' | 'inferred' | 'absent'

/** Whether a `Field` with `help` also renders the note as a `.field-help` line. */
const FieldHelpContext = createContext(false)

/**
 * Sets the field help switch for every `Field` under it. The inspector mounts it
 * from `ui.showFieldHelp`, so kit stays free of the store.
 */
export function FieldHelpProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <FieldHelpContext.Provider value={value}>{children}</FieldHelpContext.Provider>
}

/**
 * A labelled control. The label sits above the control slot; `unit` sets a mono
 * text 2 unit inside the frame, after the control. `help` ends the label row in
 * a 24 px (i) button whose title holds the method note, and under a
 * `FieldHelpProvider` set to true also renders the note as a `.field-help` line under the
 * control. `error` renders a `.field-error` line and sets `aria-invalid` on the
 * control; pass an empty string while the value is valid so the frame keeps one
 * root shape and the control is not remounted on every validity change. With
 * `help` or `error` the child must be one React element: it takes
 * the label's `id`, since the frame is then a div and not a wrapping label.
 */
export function Field({
  label,
  help,
  error,
  unit,
  children,
}: {
  label: string
  help?: string
  error?: string
  unit?: string
  children: ReactNode
}) {
  const id = useId()
  const showHelp = useContext(FieldHelpContext)
  const slot = (control: ReactNode) =>
    unit == null ? (
      control
    ) : (
      <div className="nu-row">
        {control}
        <span className="nu-unit">{unit}</span>
      </div>
    )
  if (help == null && error == null) {
    return (
      <label className="field">
        <span>{label}</span>
        {slot(children)}
      </label>
    )
  }
  if (import.meta.env.DEV && !isValidElement(children)) {
    throw new Error(`Field "${label}" with help or error needs one React element as its child`)
  }
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        ...(error ? { 'aria-invalid': true } : {}),
      })
    : children
  return (
    <div className="field">
      <span className="field-label">
        <label htmlFor={id}>{label}</label>
        {help && (
          <button type="button" className="field-info" aria-label={`About ${label}`} title={help}>
            <IconInfo />
          </button>
        )}
      </span>
      {slot(control)}
      {help && showHelp && <span className="field-help">{help}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Segmented control: one bordered group, one pressed segment that inverts to
 * text 1 on ink. `label` names the group for assistive technology.
 */
export function Seg<T extends string>({
  id,
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  id?: string
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <div id={id} className="seg" role="group" aria-label={label}>
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

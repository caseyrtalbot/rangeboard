import type { ReactNode } from 'react'
import { useStore } from '../state/store'
import { IconChevronDown, IconChevronRight } from './icons'

interface PanelSectionBase {
  title: ReactNode
  /** A mono readout after the title. */
  readout?: ReactNode
  /** Actions and the (i), pushed to the end of the head. */
  end?: ReactNode
  className?: string
  children?: ReactNode
}

interface FixedSection extends PanelSectionBase {
  id?: string
  collapsible?: false
}

interface CollapsibleSection extends PanelSectionBase {
  /** The DOM id, and the key of the open state in `ui.openSections` (D9). */
  id: string
  collapsible: true
  /** Read while no open state is stored for `id`. */
  defaultOpen?: boolean
  /** The closed head's one-line summary. */
  summary?: ReactNode
}

export type PanelSectionProps = FixedSection | CollapsibleSection

/** Every collapsible section head carries this, so the panel menu can list them. */
export const PANEL_SECTION_TOGGLE = 'psec-toggle'

/**
 * The one section head of the right panel: an `h3` title, an optional mono readout
 * and an end slot. A collapsible section's title is a toggle button; its chevron
 * hangs in the left padding, so every title starts on the content edge (D8).
 */
export function PanelSection(props: PanelSectionProps) {
  const stored = useStore((s) => (props.collapsible ? s.ui.openSections[props.id] : undefined))
  const open = props.collapsible ? (stored ?? props.defaultOpen ?? true) : true
  const { title, readout, end, className, children } = props
  const readoutNode = readout != null && <span className="psec-readout">{readout}</span>
  const endNode = end != null && <span className="psec-end">{end}</span>
  const classes = `psec${open ? '' : ' closed'}${className ? ` ${className}` : ''}`

  if (!props.collapsible)
    return (
      <section className={classes} id={props.id}>
        <div className="psec-head">
          <h3 className="psec-title">{title}</h3>
          {readoutNode}
          {endNode}
        </div>
        <div className="psec-body">{children}</div>
      </section>
    )

  const { id, summary } = props
  const bodyId = `${id}-body`
  return (
    <section className={classes} id={id}>
      <div className="psec-head">
        <h3 className="psec-title psec-title-toggle">
          <button
            type="button"
            className={PANEL_SECTION_TOGGLE}
            aria-expanded={open}
            aria-controls={bodyId}
            data-section-id={id}
            onClick={() => useStore.getState().setSectionOpen(id, !open)}
          >
            <span className="psec-chev" aria-hidden="true">
              {open ? <IconChevronDown /> : <IconChevronRight />}
            </span>
            <span className="psec-name">{title}</span>
            {!open && summary != null && (
              <span className="psec-sum" title={typeof summary === 'string' ? summary : undefined}>
                {summary}
              </span>
            )}
          </button>
        </h3>
        {readoutNode}
        {endNode}
      </div>
      <div className="psec-body" id={bodyId} hidden={!open}>
        {open && children}
      </div>
    </section>
  )
}

import { useStore } from '../../state/store'
import { State } from '../../ui/kit'
import { IconInfo } from '../../ui/icons'

// A module of its own so SystemStatus and the detail panes can use these without
// importing DebriefRecord, which imports SystemStatus. DebriefRecord re-exports both.

/** An empty-state row: the missing input or result named in a hollow warning state. */
export function EmptyRow({ children }: { children: string }) {
  return (
    <p className="empty-row">
      <State tone="warning" hollow>
        {children}
      </State>
    </p>
  )
}

/** A method note behind a 24 px (i); with field help on it also renders as a line. */
export function NoteInfo({ label, note }: { label: string; note: string }) {
  const showHelp = useStore((state) => state.ui.showFieldHelp)
  return (
    <>
      <div className="frag-head">
        <button type="button" className="field-info" aria-label={`About ${label}`} title={note}>
          <IconInfo />
        </button>
      </div>
      {showHelp && <p className="field-help">{note}</p>}
    </>
  )
}

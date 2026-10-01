import type { TrialSelection } from '../../state/trialSelectors'
import { trialResultOf } from '../../analysis/trialResult'
import { formatTime } from '../../geometry/geo'
import type { useTrialResult } from '../../state/useTrialResult'
import { useStore } from '../../state/store'
import { State } from '../../ui/kit'
import { IconInfo } from '../../ui/icons'

/**
 * Segmented control that carries a `data-role` for browser checks. The shared
 * `Seg` in `src/ui/kit.tsx` has the group role and pressed state instead.
 */
export function RoleSeg<T extends string>({
  value,
  options,
  onChange,
  dataRole,
}: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
  /** `data-role` on the control, so a browser check can find it. */
  dataRole: string
}) {
  return (
    <div className="seg" data-role={dataRole}>
      {options.map((option) => (
        <button
          key={option.v}
          className={value === option.v ? 'active' : ''}
          onClick={() => onChange(option.v)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Only a started, available trial can supply outcomes to a consumer. */
export function trialViewOf(trial: ReturnType<typeof useTrialResult>) {
  const { selection, snapshot } = trial
  return selection.status === 'ready' && snapshot
    ? trialResultOf(selection.scenario, selection.result.manifest, selection.result)
    : undefined
}

export function trialStateText(selection: TrialSelection, horizonS?: number): string {
  if (selection.status === 'preparing') return 'Preparing trial'
  if (selection.status === 'error') return selection.message
  return horizonS == null
    ? 'Simulated trial · ready'
    : `Simulated trial · T+${formatTime(horizonS)} observed`
}

// EmptyRow and NoteInfo live here so SystemStatus and the detail panes can use them
// without importing DebriefRecord, which imports SystemStatus. DebriefRecord re-exports both.

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

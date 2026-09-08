import { useStore } from '../../../state/store'
import { selectTrialSelection, selectTrialHorizon } from '../../../state/trialSelectors'
import { trialStateText } from '../widgets/controls'

export function OutcomeScreen() {
  const selection = useStore(selectTrialSelection)
  const started = useStore(state => state.playback.startedAtMs != null)
  const horizon = useStore(state => selectTrialHorizon(state, state.playback.observedThroughS))
  if (selection.status === 'idle' || selection.status === 'cancelled' || (selection.status === 'ready' && !started)) {
    return <p className="muted small">No trial yet. Press Play in Execute to run one.</p>
  }

  return (
    <section className="analysis-primary" aria-label="Outcome">
      <h3>Outcome</h3>
      <p className="analysis-scope">{trialStateText(selection, horizon)}</p>
      <p className="muted small">Trial outcome details will appear here.</p>
    </section>
  )
}

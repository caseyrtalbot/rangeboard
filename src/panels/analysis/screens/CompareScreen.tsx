import { useStore } from '../../../state/store'
import { selectTrialSelection } from '../../../state/trialSelectors'
import { useEnsembleBasis } from './ensembleBasis'

export function CompareScreen() {
  const selection = useStore(selectTrialSelection)
  const started = useStore(state => state.playback.startedAtMs != null)
  const basis = useEnsembleBasis()
  if (selection.status === 'idle' || selection.status === 'cancelled' || (selection.status === 'ready' && !started)) {
    return <p className="muted small">No trial yet. Press Play in Execute to run one.</p>
  }

  return (
    <section className="analysis-primary" aria-label="Compare">
      <h3>Compare</h3>
      <p className="analysis-scope">{basis}</p>
      <p className="muted small">Ensemble and baseline comparisons will appear here.</p>
    </section>
  )
}

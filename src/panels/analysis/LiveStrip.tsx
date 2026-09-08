import { useStore } from '../../state/store'
import { formatRunLabel } from '../../state/labels'
import { selectObservedThroughWholeS } from '../../state/selectors'
import { selectTrialHorizon, selectTrialSelection } from '../../state/trialSelectors'
import { formatTime } from '../../geometry/geo'
import { resetAnalysisRun } from '../../playback/runSession'

/** Execution identity and bounded visibility, without forecast preparation work. */
export function LiveStrip({ onOpenSettings }: { onOpenSettings?: () => void } = {}) {
  const selection = useStore(selectTrialSelection)
  const phase = useStore((s) => s.playback.phase)
  const runSeq = useStore((s) => s.playback.runSeq)
  const started = useStore((s) => s.playback.startedAtMs != null)
  const completed = useStore((s) => s.playback.completedAtMs != null)
  const observed = useStore(selectObservedThroughWholeS)
  const horizon = useStore((s) => Math.floor(selectTrialHorizon(s, s.playback.simTimeS)))
  const { pauseRun, cancelTrialPreparation, startTrialRun } = useStore.getState()
  const preparing = selection.status === 'preparing'
  const error = selection.status === 'error'
  const tag = preparing ? 'Preparing trial' : error ? 'Trial error' :
    selection.status !== 'ready' ? 'Simulated trial · ready' : !started ? 'Trial ready' :
      phase === 'complete' ? 'Complete' : completed ? 'Replay' :
        phase === 'running' ? 'Running' : phase === 'paused' ? 'Paused' : 'Replay'

  return (
    <div className={`live-strip run-${completed && phase !== 'complete' ? 'replay' : phase}`}>
      <div className="live-head" role="status" aria-live="polite">
        <span className="live-tag">{started && selection.status === 'ready' ? `Simulated trial · ${tag}` : tag}</span>
        <span className="live-time" title={selection.runId}>
          {formatRunLabel(runSeq)} · T+{formatTime(horizon)}
        </span>
        <span className="muted small">
          {error ? selection.message : started && selection.status === 'ready'
            ? `Visible prefix through ${formatTime(horizon)} · achieved observation through ${formatTime(observed)}${completed ? ' · full trial observed' : ''}`
            : selection.status === 'cancelled' ? 'Preparation cancelled' : 'No outcomes observed yet'}
        </span>
      </div>
      <div className="live-head">
        {preparing && <>
          <button className="mini" onClick={pauseRun} aria-label="Pause trial preparation start">Pause</button>
          <button className="mini" onClick={cancelTrialPreparation}>Cancel</button>
        </>}
        {(error || selection.status === 'cancelled') && <button className="mini" onClick={startTrialRun}>Retry</button>}
        {phase === 'complete' && <button className="mini" onClick={startTrialRun}>Replay</button>}
        <button className="mini run-reset" onClick={() => resetAnalysisRun('manual')}
          title="New run" aria-label="New run">New run</button>
        {onOpenSettings && <button className="mini" onClick={onOpenSettings}>Forecast and analysis</button>}
      </div>
    </div>
  )
}

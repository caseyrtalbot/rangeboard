import type { RunResetReason } from '../state/runState'
import { useStore } from '../state/store'

/**
 * Start a new run with a new identity and an empty observation horizon. The
 * engagement picture is a pure function of the scenario object and is cached
 * by that object's identity, so an unchanged configuration reuses the same
 * derived result: the run identity, not the derivation, is what changes.
 */
export function resetAnalysisRun(reason: RunResetReason = 'manual'): void {
  useStore.getState().resetRun(reason)
}

/** R4 keeps forecast Play unchanged; internal trial opt-in reuses its retained run. */
export function toggleAnalysisRun(): void {
  let st = useStore.getState()
  if (st.playback.playing) {
    st.pauseRun()
    return
  }
  if (st.trial.manifest != null) {
    st.startTrialRun()
    return
  }
  if (
    st.playback.completedAtMs != null ||
    (st.playback.startedAtMs == null && st.playback.simTimeS > 0)
  ) {
    resetAnalysisRun('manual')
    st = useStore.getState()
  }
  st.startRun()
}

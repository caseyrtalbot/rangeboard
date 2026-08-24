import { clearEngagementPictureCache } from '../analysis/impact'
import type { RunResetReason } from '../state/store'
import { useStore } from '../state/store'

/**
 * Start a new run with a new identity and an empty observation horizon. The
 * derived engagement cache is also discarded so an unchanged configuration
 * is recalculated rather than reusing any object from the previous run.
 */
export function resetAnalysisRun(reason: RunResetReason = 'manual'): void {
  clearEngagementPictureCache()
  useStore.getState().resetRun(reason)
}

/** Play/pause with strict new-run behavior after completion or future preview. */
export function toggleAnalysisRun(): void {
  let st = useStore.getState()
  if (st.playback.playing) {
    st.pauseRun()
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

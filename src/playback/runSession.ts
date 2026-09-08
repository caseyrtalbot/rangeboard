import type { RunResetReason } from '../state/runState'
import { useStore } from '../state/store'

/** New identity and empty observation; preparation waits for the next Play. */
export function resetAnalysisRun(reason: RunResetReason = 'manual'): void {
  useStore.getState().resetRun(reason)
}

/** Repeated Play reuses preparation; completed transport replays the retained draw. */
export function toggleAnalysisRun(): void {
  const st = useStore.getState()
  if (st.playback.playing) st.pauseRun()
  else st.startTrialRun()
}

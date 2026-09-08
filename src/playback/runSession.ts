import type { RunResetReason } from '../state/runState'
import { useStore } from '../state/store'

/** New identity and empty observation; preparation waits for the next Play. */
export function resetAnalysisRun(reason: RunResetReason = 'manual'): void {
  useStore.getState().resetRun(reason)
}

/** Play or pause; the store's playback commands resolve prepare, resume, replay or reset. */
export function toggleAnalysisRun(): void {
  useStore.getState().playbackCommand({ type: 'toggle' })
}

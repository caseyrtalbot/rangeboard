import { useMemo } from 'react'
import { saveRun } from '../../io/runStore'
import { analysisBasisSignature } from '../../state/analysisBasis'
import { useStore } from '../../state/store'
import type { RunHistorySave } from './RunHistory'
import { runRecordOf } from './mc'

/**
 * A save needs a finished ensemble for the current analysis basis; the sensitivity
 * companion joins it only when it finished on the same basis. The record is built
 * here, never in the store.
 */
export function useRunHistorySave(): RunHistorySave {
  const scenario = useStore((state) => state.scenario)
  const mc = useStore((state) => state.mc)
  const playbackRunId = useStore((state) => state.playback.runId)
  const signature = useMemo(() => analysisBasisSignature(scenario), [scenario])
  const summary = mc.status === 'done' ? mc.summary : null
  const enabled = summary != null && mc.basisSignature === signature
  const reason = enabled
    ? 'Save this ensemble to the run history'
    : mc.status === 'running'
      ? 'The ensemble is still running'
      : summary == null
        ? 'No finished ensemble to save'
        : 'The scenario changed after the ensemble ran'
  return {
    enabled,
    reason,
    run: () => {
      if (!summary) return Promise.reject(new Error('No finished ensemble to save.'))
      const sensitivity =
        mc.sensitivity.status === 'done' && mc.sensitivity.basisSignature === signature
          ? mc.sensitivity.summary
          : null
      // The record names the overrides the run applied at launch.
      return saveRun(runRecordOf(scenario, mc, playbackRunId, signature, sensitivity))
    },
  }
}

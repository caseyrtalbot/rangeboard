import type { ExecutionHorizon } from '../../../analysis/horizon'
import type { TrialSelection } from '../../../state/trialSelectors'
import { trialResultOf } from '../../../analysis/trialResult'
import { formatTime } from '../../../geometry/geo'
import { useTrialResult } from '../../../state/useTrialResult'
import { useMemo } from 'react'
import type { Scenario } from '../../../model/types'
import type { EngagementPicture } from '../../../analysis/impact'
import { engagementPicture } from '../../../analysis/impact'
import type { RunPhase } from '../../../state/runState'
import { useStore } from '../../../state/store'
import { durationOf, selectExecutionHorizon, selectSimTimeStep } from '../../../state/selectors'

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

/** The forecast cursor quantized to the DT grid. */
export function useSimTimeStep(): number {
  return useStore(selectSimTimeStep)
}

/**
 * Refresh the view memo when scenario or run identity changes. The deterministic
 * engine cache is keyed by engine inputs and remains reusable across clean runs.
 */
export function useForecastEngagement(scenario: Scenario, runId: string): EngagementPicture {
  return useMemo(() => {
    void runId
    return engagementPicture(scenario)
  }, [scenario, runId])
}

// oxlint-disable-next-line react/only-export-components -- Keep widget hooks in the shared controls module.
export function useExecutionHorizon(): ExecutionHorizon {
  return useStore(selectExecutionHorizon)
}

/** The clamped cursor and phase for forecast and transitional consumers. */
export function useRunCursor(scenario: Scenario): {
  t: number
  horizon: ExecutionHorizon
  durationS: number
  phase: RunPhase
  /** Phase 'ready': nothing observed yet. Counters read 0 and times read a dash. */
  untouched: boolean
} {
  const horizon = useExecutionHorizon()
  const tS = useSimTimeStep()
  const phase = useStore((s) => s.playback.phase)
  const durationS = durationOf(scenario)
  return { horizon, t: Math.min(tS, durationS), durationS, phase, untouched: phase === 'ready' }
}

export { useTrialResult }

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
  return horizonS == null ? 'Simulated trial · ready' : `Simulated trial · T+${formatTime(horizonS)} observed`
}

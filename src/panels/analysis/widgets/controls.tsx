import { useMemo } from 'react'
import type { Scenario } from '../../../model/types'
import type { EngagementPicture } from '../../../analysis/impact'
import { engagementPicture } from '../../../analysis/impact'
import type { RunPhase } from '../../../state/runState'
import { useStore } from '../../../state/store'
import { durationOf, selectSimTimeStep } from '../../../state/selectors'

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

/** The sim time quantized to the DT grid. The one time hook every widget reads. */
export function useSimTimeStep(): number {
  return useStore(selectSimTimeStep)
}

/**
 * The engagement picture memoized on the scenario and the run id. A reset
 * changes runId and clears the engine cache, so an unchanged scenario is
 * rebuilt for each clean run.
 */
export function useEngagement(scenario: Scenario, runId: string): EngagementPicture {
  return useMemo(() => {
    void runId
    return engagementPicture(scenario)
  }, [scenario, runId])
}

/** The clamped cursor and the run phase every live widget reads. */
export function useRunCursor(scenario: Scenario): {
  t: number
  durationS: number
  phase: RunPhase
  /** Phase 'ready': nothing observed yet. Counters read 0 and times read a dash. */
  untouched: boolean
} {
  const tS = useSimTimeStep()
  const phase = useStore((s) => s.playback.phase)
  const durationS = durationOf(scenario)
  return { t: Math.min(tS, durationS), durationS, phase, untouched: phase === 'ready' }
}

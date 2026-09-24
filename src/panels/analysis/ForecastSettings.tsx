/**
 * The forecast header on Prepare: the mode chip, what kind of number the run
 * produces, and the Run control. Every run setting lives in the Run tab.
 */

import type { McState } from '../../state/runState'
import { useStore } from '../../state/store'
import { runSettings } from '../../model/types'
import type { StopRule } from '../../playback/mcRun'

/** What kind of number the run produces: an envelope point, or a replicate estimate. */
function chipMeta(run: ReturnType<typeof runSettings>, mc: McState): string {
  if (run.runMode === 'deterministic') return 'envelope · Pd threshold'
  const done = mc.status === 'done' ? mc.summary : null
  const base = `estimate · ${done?.replicates ?? run.replicates} replicates`
  return run.uncertainty === 'total' ? `${base} · total` : base
}

/** The mode chip: class, text, title and the basis meta beside it. */
function chipOf(
  run: ReturnType<typeof runSettings>,
  mc: McState,
): { cls: string; text: string; title: string; meta: string } {
  return { ...modeChip(run, mc), meta: chipMeta(run, mc) }
}

/** Chip title phrase per early stop rule. */
const STOP_BY: Record<StopRule, string> = {
  replicates: 'the replicate count',
  halfWidth: 'the half-width rule on the end-of-run leaker mean',
  budget: 'the execution budget',
  cancelled: 'a cancel',
}

/** Class, text and title per run mode and replicate state. */
function modeChip(
  run: ReturnType<typeof runSettings>,
  mc: McState,
): { cls: string; text: string; title: string } {
  if (run.runMode === 'deterministic') {
    return { cls: 'chip det', text: 'DET', title: 'Deterministic expected-value run' }
  }
  const total = run.uncertainty === 'total'
  const head = total ? `MC ${run.replicates} · total` : `MC ${run.replicates}`
  const seeded = `${head} · seed ${run.seed}`
  const basis = `Monte Carlo, ${run.replicates} replicates, seed ${run.seed}${
    total ? ', total uncertainty' : ''
  }`
  switch (mc.status) {
    case 'running':
      return {
        cls: 'chip mc',
        text: `${head} · ${mc.progress}/${mc.total}`,
        title: 'Running replicates',
      }
    case 'done': {
      const summary = mc.summary
      const early = summary != null && summary.stopped.rule !== 'replicates'
      return {
        cls: 'chip mc',
        text: early
          ? `MC ${summary.replicates} of ${run.targetHalfWidth == null ? run.replicates : run.stopCap} · seed ${run.seed}`
          : seeded,
        title: early
          ? `${basis}, stopped at ${summary.replicates} by ${STOP_BY[summary.stopped.rule]}, ${Math.round(
              summary.elapsedMs,
            )} ms`
          : `${basis}, ${Math.round(summary?.elapsedMs ?? 0)} ms`,
      }
    }
    case 'stale':
      return {
        cls: 'chip mc warn',
        text: `${head} · stale`,
        title: 'Configuration changed since the replicates ran',
      }
    case 'error':
      return { cls: 'chip mc', text: seeded, title: mc.error ?? `${basis}. Not run yet.` }
    default:
      return { cls: 'chip mc', text: seeded, title: `${basis}. Not run yet.` }
  }
}

/** Forecast controls retain their saved meanings independently of sampled Play. */
export function ForecastSettings() {
  const scenario = useStore((s) => s.scenario)
  const run = runSettings(scenario)
  const mc = useStore((s) => s.mc)
  const chip = chipOf(run, mc)
  return (
    <div aria-label="Forecast and analysis">
      <span className={chip.cls} title={chip.title}>
        {chip.text}
      </span>
      <span className="chip-meta">{chip.meta}</span>
    </div>
  )
}

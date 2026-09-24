/**
 * The forecast header on Prepare: one mono forecast line and the Deterministic
 * checkbox. The top bar holds the Run control.
 */

import type { McState } from '../../state/runState'
import { useStore } from '../../state/store'
import { runSettings } from '../../model/types'
import type { StopRule } from '../../playback/mcRun'

/** Chip title phrase per early stop rule. */
const STOP_BY: Record<StopRule, string> = {
  replicates: 'the replicate count',
  halfWidth: 'the half-width rule on the end-of-run leaker mean',
  budget: 'the execution budget',
  cancelled: 'a cancel',
}

/**
 * The one forecast line: class, mono text and a title that carries the basis and
 * the stopping rule. Monte Carlo reads `MC done / loop end · seed n`.
 */
function forecastLine(
  run: ReturnType<typeof runSettings>,
  mc: McState,
): { cls: string; text: string; title: string } {
  if (run.runMode === 'deterministic') {
    return {
      cls: 'chip det',
      text: 'DET · Pd threshold',
      title: 'Deterministic expected-value run',
    }
  }
  const total = run.uncertainty === 'total'
  const halfWidth = run.targetHalfWidth != null
  const end = halfWidth ? run.stopCap : run.replicates
  const summary = mc.status === 'done' ? mc.summary : null
  const done = mc.status === 'running' ? mc.progress : (summary?.replicates ?? 0)
  const of = mc.status === 'running' ? mc.total : end
  const stale = mc.status === 'stale'
  const text = `MC ${done} / ${of}${total ? ' · total' : ''} · seed ${run.seed}${stale ? ' · stale' : ''}`
  const basis = `Monte Carlo, ${run.replicates} replicates, seed ${run.seed}${
    total ? ', total uncertainty' : ''
  }`
  const rule = `Stops on ${STOP_BY[halfWidth ? 'halfWidth' : 'replicates']}.`
  const cls = stale ? 'chip mc warn' : 'chip mc'
  switch (mc.status) {
    case 'running':
      return { cls, text, title: `Running replicates. ${rule}` }
    case 'done':
      return {
        cls,
        text,
        title: `${basis}, stopped at ${summary?.replicates ?? 0} by ${
          STOP_BY[summary?.stopped.rule ?? 'replicates']
        }, ${Math.round(summary?.elapsedMs ?? 0)} ms`,
      }
    case 'stale':
      return { cls, text, title: `Configuration changed since the replicates ran. ${rule}` }
    case 'error':
      return { cls, text, title: mc.error ?? `${basis}. Not run yet. ${rule}` }
    default:
      return { cls, text, title: `${basis}. Not run yet. ${rule}` }
  }
}

/**
 * The forecast line and the Deterministic checkbox under it. Every other run
 * setting lives in the Run tab.
 */
export function ForecastSettings() {
  const scenario = useStore((s) => s.scenario)
  const patchScenario = useStore((s) => s.patchScenario)
  const run = runSettings(scenario)
  const mc = useStore((s) => s.mc)
  const line = forecastLine(run, mc)
  return (
    <div aria-label="Forecast and analysis">
      <span className={line.cls} title={line.title}>
        {line.text}
      </span>
      <label className="run-det">
        <input
          type="checkbox"
          checked={run.runMode === 'deterministic'}
          onChange={(event) =>
            patchScenario({ runMode: event.target.checked ? 'deterministic' : 'monte-carlo' })
          }
        />
        Deterministic (fixed seed)
      </label>
    </div>
  )
}

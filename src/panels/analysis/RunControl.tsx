/**
 * The top bar's one primary action (D7) with the progress line after it. Prepare
 * runs the ensemble, Execute pauses and resumes playback, and Analyze runs the
 * ensemble again. The Deterministic checkbox sits under the forecast line in
 * Prepare > Inputs; every other run setting lives in the Run tab of Settings.
 */

import { runSettings } from '../../model/types'
import type { McSettings } from '../../model/types'
import type { McSummary, StopRule } from '../../playback/mcRun'
import type { PoolProgress } from '../../playback/mcTypes'
import { toggleAnalysisRun } from '../../playback/runSession'
import type { BoardPhase, McState } from '../../state/runState'
import { selectPlayLabel } from '../../state/selectors'
import { useStore } from '../../state/store'

/**
 * Why the loop ends, in words. The floor and the cap come from the settings, not the run.
 * A cancelled run reads as stopping while it runs and as stopped once finished.
 */
function stopRuleText(rule: StopRule, run: McSettings, finished: boolean): string {
  if (rule === 'halfWidth') return `stop on half-width, floor ${run.stopFloor}, cap ${run.stopCap}`
  if (rule === 'budget') return 'stop on the execution budget'
  if (rule === 'cancelled') return finished ? 'stopped by the user' : 'stopping'
  return 'stop on the replicate count'
}

/** The rule the settings put in force before a run reports one of its own. */
function settingsStopRule(run: McSettings): StopRule {
  return run.targetHalfWidth == null ? 'replicates' : 'halfWidth'
}

/** Where the loop ends: the cap under a half-width target, else the replicate count. */
export function loopEndOf(run: McSettings): number {
  return run.targetHalfWidth == null ? run.replicates : run.stopCap
}

/**
 * The operator floor stamp of a finished run: decisions the floor at 0 discarded,
 * against the decisions the C2 queue took. Counted over the whole run as each
 * Stat mean times its sample count, so both figures are whole. Null when nothing
 * floored and on a summary written before the stamp existed.
 */
/** Completed rows finish dropped because a hole kept them out of the prefix. */
function droppedText(count: number): string | null {
  if (!(count > 0)) return null
  return `${count} completed ${count === 1 ? 'row' : 'rows'} dropped`
}

function flooredText(summary: McSummary): string | null {
  const floored = summary.operatorFlooredDecisions
  const decisions = summary.operatorDecisions
  if (!floored || !decisions) return null
  const n = Math.round(floored.mean * floored.n)
  if (!(n > 0)) return null
  return `operator wait floored in ${n} of ${Math.round(decisions.mean * decisions.n)} decisions`
}

/**
 * The progress line: replicates done, the stop rule and the pool size. A pooled
 * run reports its own rule and worker count through `mc.pool`; without a pool the
 * count comes from `mc.progress` and the rule from the settings.
 */
/** The pool's replicate line, with a drop count once finish has committed one. */
function poolLine(run: McSettings, pool: PoolProgress): string {
  const workers = `${pool.workers} ${pool.workers === 1 ? 'worker' : 'workers'}`
  const head =
    pool.stopRule === 'replicates' && pool.total != null
      ? `${pool.done} of ${pool.total} replicates · ${workers}`
      : `${pool.done} replicates · ${stopRuleText(pool.stopRule, run, false)} · ${workers}`
  const dropped = droppedText(pool.discarded)
  return dropped ? `${head} · ${dropped}` : head
}

function progressText(run: McSettings, mc: McState): string | null {
  const pool = mc.pool
  if (mc.status === 'running') {
    if (pool) return poolLine(run, pool)
    return `${mc.progress} of ${mc.total} replicates · ${stopRuleText(settingsStopRule(run), run, false)}`
  }
  // A finished run keeps the line, so the rule that ended it stays readable.
  const summary = mc.status === 'done' ? mc.summary : null
  if (!summary) return null
  const line = `${summary.replicates} of ${loopEndOf(run)} replicates · ${stopRuleText(summary.stopped.rule, run, true)}`
  const dropped = droppedText(pool?.discarded ?? 0)
  const floored = flooredText(summary)
  return [line, dropped, floored].filter((part) => part != null).join(' · ')
}

/** Deterministic mode runs no replicates, so the button says why it is closed. */
const DETERMINISTIC_TITLE =
  'Deterministic mode computes one expected-value envelope, not replicates. Turn Deterministic off to run.'

/** Shown while the pool will refuse another stop, including the summary wait. */
export const STOPPING_TITLE = 'This run is already stopping.'

export function RunControl({ phase = 'prepare' }: { phase?: BoardPhase }) {
  const scenario = useStore((s) => s.scenario)
  const mc = useStore((s) => s.mc)
  const playLabel = useStore(selectPlayLabel)
  const run = runSettings(scenario)
  const deterministic = run.runMode === 'deterministic'
  const running = mc.status === 'running'
  const stopping = running && mc.pool?.stopping === true
  const progress = progressText(run, mc)
  // Execute drives playback, so the ensemble's mode and stop state do not apply.
  const playback = phase === 'execute'
  const label = playback
    ? playLabel
    : stopping
      ? 'Stopping'
      : running
        ? 'Stop'
        : phase === 'analyze'
          ? 'Run again'
          : 'Run'
  return (
    <div className="run-control" aria-label="Run">
      <button
        type="button"
        className="mc-run primary"
        disabled={!playback && (deterministic || stopping)}
        title={
          playback
            ? undefined
            : deterministic
              ? DETERMINISTIC_TITLE
              : stopping
                ? STOPPING_TITLE
                : undefined
        }
        onClick={() => {
          if (playback) toggleAnalysisRun()
          else if (stopping) return
          else if (running) useStore.getState().cancelMonteCarlo()
          else useStore.getState().runMonteCarlo()
        }}
      >
        {label}
      </button>
      {progress && (
        <span className="run-progress" role="status">
          {progress}
        </span>
      )}
    </div>
  )
}

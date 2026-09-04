import { useMemo, useState } from 'react'
import type { McState } from '../../state/store'
import { scenarioDurationS, formatRunLabel, useStore } from '../../state/store'
import { engagementPicture } from '../../analysis/impact'
import { buildLiveTimeline } from '../../analysis/liveStats'
import { formatTime } from '../../geometry/geo'
import type { RunMode } from '../../model/types'
import { runSettings } from '../../model/types'
import { resetAnalysisRun } from '../../playback/runSession'
import { Field, Seg, useSimTimeStep } from './widgets/controls'

const MODE_OPTIONS: Array<{ v: RunMode; label: string }> = [
  { v: 'deterministic', label: 'Deterministic' },
  { v: 'monte-carlo', label: 'Monte Carlo' },
]

/** Replicate count bounds of the popover input. */
const MIN_REPLICATES = 1
const MAX_REPLICATES = 10000

/** The mode chip: class, text and title per run mode and replicate state. */
function chipOf(
  run: ReturnType<typeof runSettings>,
  mc: McState,
): { cls: string; text: string; title: string } {
  if (run.runMode === 'deterministic') {
    return { cls: 'chip det', text: 'DET', title: 'Deterministic expected-value run' }
  }
  const head = `MC ${run.replicates}`
  const seeded = `${head} · seed ${run.seed}`
  const basis = `Monte Carlo, ${run.replicates} replicates, seed ${run.seed}`
  switch (mc.status) {
    case 'running':
      return {
        cls: 'chip mc',
        text: `${head} · ${mc.progress}/${mc.total}`,
        title: 'Running replicates',
      }
    case 'done':
      return {
        cls: 'chip mc',
        text: seeded,
        title: `${basis}, ${Math.round(mc.summary?.elapsedMs ?? 0)} ms`,
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

/**
 * An integer input that commits on blur or Enter, so typing a seed digit by
 * digit is one scenario edit, not one undo entry and one run reset per key.
 * The `key` remounts the uncontrolled input when the committed value changes.
 */
function IntInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number
  min?: number
  max?: number
  onCommit: (v: number) => void
}) {
  const commit = (raw: string) => {
    const n = Math.round(Number(raw))
    if (raw === '' || !Number.isFinite(n)) return
    const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n))
    if (clamped !== value) onCommit(clamped)
  }
  return (
    <input
      key={value}
      type="number"
      step={1}
      min={min}
      max={max}
      defaultValue={value}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit((event.target as HTMLInputElement).value)
      }}
    />
  )
}

/** The run mode popover: mode, seed and replicate count, and the run button. */
function McPopover({ run, mc }: { run: ReturnType<typeof runSettings>; mc: McState }) {
  const patchScenario = useStore((s) => s.patchScenario)
  const deterministic = run.runMode === 'deterministic'
  const running = mc.status === 'running'
  return (
    <div className="mc-pop">
      <Seg
        value={run.runMode}
        options={MODE_OPTIONS}
        onChange={(v) => patchScenario({ runMode: v })}
        dataRole="run-mode"
      />
      <Field label="Seed">
        <IntInput value={run.seed} onCommit={(seed) => patchScenario({ seed })} />
      </Field>
      <Field label="Replicates">
        <IntInput
          value={run.replicates}
          min={MIN_REPLICATES}
          max={MAX_REPLICATES}
          onCommit={(replicates) => patchScenario({ replicates })}
        />
      </Field>
      <button
        className="mc-run"
        disabled={deterministic}
        onClick={() => useStore.getState().runMonteCarlo()}
      >
        {running ? 'Running…' : 'Run replicates'}
      </button>
    </div>
  )
}

/**
 * Run header: run id, cursor time, phase, mode chip and the clean reset.
 * Only rAF playback advances the observed horizon; dragging either timeline
 * creates a clearly labeled preview/replay and can never complete a run or
 * promote future events into live telemetry.
 */
export function LiveStrip() {
  const scenario = useStore((s) => s.scenario)
  const phase = useStore((s) => s.playback.phase)
  const runId = useStore((s) => s.playback.runId)
  const runSeq = useStore((s) => s.playback.runSeq)
  const observedThroughS = useStore((s) => s.playback.observedThroughS)
  const completedAtMs = useStore((s) => s.playback.completedAtMs)
  const resetReason = useStore((s) => s.playback.resetReason)
  const mc = useStore((s) => s.mc)
  const qt = useSimTimeStep()
  const [open, setOpen] = useState(false)

  // A reset changes runId and explicitly clears engagementPicture's cache,
  // so an unchanged scenario is rebuilt for each clean run.
  const tl = useMemo(() => {
    void runId
    const { assessments, report } = engagementPicture(scenario)
    return buildLiveTimeline(assessments, report)
  }, [scenario, runId])
  const durationS = useMemo(() => scenarioDurationS(scenario), [scenario])

  if (tl.trackCount === 0) return null

  const t = Math.min(qt, durationS)
  const untouched = phase === 'ready'
  const preview =
    phase === 'review' && completedAtMs == null && t > observedThroughS + 0.25
  const tag = untouched
    ? 'Ready'
    : phase === 'running'
      ? 'Live'
      : phase === 'paused'
        ? 'Paused'
        : phase === 'complete'
          ? 'Complete'
          : preview
            ? 'Preview'
            : 'Replay'
  const state = untouched
    ? resetReason === 'configuration-changed'
      ? 'buffer clean · configuration changed'
      : 'buffer clean · no prior-run telemetry'
    : phase === 'running'
      ? `observed through ${formatTime(observedThroughS)}`
      : preview
        ? `cursor only · observed through ${formatTime(observedThroughS)}`
        : completedAtMs != null
          ? 'full run observed'
          : `observed through ${formatTime(observedThroughS)}`

  const run = runSettings(scenario)
  const chip = chipOf(run, mc)

  function cleanReset() {
    if (
      completedAtMs == null &&
      observedThroughS > 0 &&
      !window.confirm('Discard this in-progress run and start with a clean telemetry buffer?')
    ) {
      return
    }
    resetAnalysisRun('manual')
  }

  return (
    <div
      className={`live-strip run-${tag.toLowerCase()}`}
      aria-live="polite"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) setOpen(false)
      }}
    >
      <div className="live-head">
        <span className="live-tag">{tag}</span>
        <span className="live-time">
          {formatRunLabel(runSeq)} · {untouched ? 'T+0:00' : `T+${formatTime(t)}`}
        </span>
        <button
          className={chip.cls}
          title={chip.title}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {chip.text}
        </button>
        <span className="live-state">{state}</span>
        <button
          className="mini run-reset"
          onClick={cleanReset}
          title="New run id; empty observed horizon; recompute analysis"
        >
          Clean reset
        </button>
      </div>
      {open ? <McPopover run={run} mc={mc} /> : null}
    </div>
  )
}

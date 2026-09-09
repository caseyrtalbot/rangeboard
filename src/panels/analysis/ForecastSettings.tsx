import type { McState } from '../../state/runState'
import { useStore } from '../../state/store'
import type { RunMode, UncertaintyMode } from '../../model/types'
import { runSettings } from '../../model/types'
import type { StopRule } from '../../playback/mcRun'
import { Field } from '../../ui/kit'
import { RoleSeg } from './controls'

const MODE_OPTIONS: Array<{ v: RunMode; label: string }> = [
  { v: 'deterministic', label: 'Deterministic' },
  { v: 'monte-carlo', label: 'Monte Carlo' },
]

/** Aleatory: the draw noise only. Total: one parameter sample per replicate too. */
const UNCERTAINTY_OPTIONS: Array<{ v: UncertaintyMode; label: string }> = [
  { v: 'aleatory', label: 'Aleatory' },
  { v: 'total', label: 'Total' },
]

/** Replicate count bounds of the popover input. */
const MIN_REPLICATES = 1
const MAX_REPLICATES = 10000

/** Seed bounds: the draw key reads the seed as a 32-bit unsigned integer (hashU01). */
const MIN_SEED = 0
const MAX_SEED = 4294967295

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
        text: early ? `MC ${summary.replicates} of ${run.replicates} · seed ${run.seed}` : seeded,
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

/**
 * A decimal input that commits on blur or Enter, as `IntInput`. An empty
 * field commits null; a value at or under zero is ignored.
 */
function DecimalInput({
  value,
  onCommit,
}: {
  value: number | null
  onCommit: (v: number | null) => void
}) {
  const commit = (raw: string) => {
    if (raw.trim() === '') {
      if (value != null) onCommit(null)
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return
    if (n !== value) onCommit(n)
  }
  return (
    <input
      key={value ?? 'none'}
      type="number"
      step="any"
      min={0}
      defaultValue={value ?? ''}
      placeholder="none"
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit((event.target as HTMLInputElement).value)
      }}
    />
  )
}

/**
 * The run mode popover: mode, uncertainty mode, seed, replicate count, target
 * half-width and the run button. Every control writes a scenario fact.
 */
export function McPopover({ run, mc }: { run: ReturnType<typeof runSettings>; mc: McState }) {
  const patchScenario = useStore((s) => s.patchScenario)
  const deterministic = run.runMode === 'deterministic'
  const running = mc.status === 'running'
  return (
    <div className="mc-pop">
      <RoleSeg
        value={run.runMode}
        options={MODE_OPTIONS}
        onChange={(v) => patchScenario({ runMode: v })}
        dataRole="run-mode"
      />
      <Field label="Uncertainty">
        <RoleSeg
          value={run.uncertainty}
          options={UNCERTAINTY_OPTIONS}
          onChange={(v) => patchScenario({ uncertainty: v })}
          dataRole="uncertainty"
        />
      </Field>
      <Field label="Seed">
        <IntInput
          value={run.seed}
          min={MIN_SEED}
          max={MAX_SEED}
          onCommit={(seed) => patchScenario({ seed })}
        />
      </Field>
      <Field label="Replicates">
        <IntInput
          value={run.replicates}
          min={MIN_REPLICATES}
          max={MAX_REPLICATES}
          onCommit={(replicates) => patchScenario({ replicates })}
        />
      </Field>
      <Field label="Target half-width">
        <DecimalInput
          value={run.targetHalfWidth}
          onCommit={(targetHalfWidth) => patchScenario({ targetHalfWidth })}
        />
      </Field>
      <button
        className="mc-run"
        disabled={deterministic}
        onClick={() =>
          running ? useStore.getState().cancelMonteCarlo() : useStore.getState().runMonteCarlo()
        }
      >
        {running ? 'Stop' : 'Run replicates'}
      </button>
    </div>
  )
}


/** Forecast controls retain their saved meanings independently of sampled Play. */
export function ForecastSettings() {
  const scenario = useStore((s) => s.scenario)
  const run = runSettings(scenario)
  const mc = useStore((s) => s.mc)
  const chip = chipOf(run, mc)
  return (
    <div aria-label="Forecast and analysis">
      <span className={chip.cls} title={chip.title}>{chip.text}</span>
      <span className="chip-meta">{chip.meta}</span>
      <McPopover run={run} mc={mc} />
    </div>
  )
}

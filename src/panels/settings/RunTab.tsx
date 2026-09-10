/**
 * Run: every field of `McSettings`, each with its default beside it and a
 * reset to that default. Every control writes through `patchScenario` and
 * reads through `runSettings`, so the scenario stays the one record of a run.
 *
 * Each label is the plain-language name, then the technical name of the value
 * in force after a middle dot: "Parameter draws · Latin hypercube".
 */

import type { ReactNode } from 'react'
import {
  DEFAULT_CONFIDENCE,
  DEFAULT_REPLICATES,
  DEFAULT_SAMPLING,
  DEFAULT_SEED,
  DEFAULT_SENSITIVITY_DEPTH,
  DEFAULT_SOBOL_BASE,
  DEFAULT_STOP_CAP,
  DEFAULT_STOP_FLOOR,
  DEFAULT_TARGET_HALF_WIDTH,
  runSettings,
} from '../../model/types'
import type {
  McSettings,
  RunMode,
  SamplingMode,
  SensitivityDepth,
  UncertaintyMode,
} from '../../model/types'
import { useStore } from '../../state/store'
import { Field, Seg } from '../../ui/kit'
import { DecimalInput, IntInput, SENSITIVITY_DEPTH_NAME } from './inputs'

/**
 * Run mode and uncertainty of a fresh scenario. `src/model/seed.ts` sets both;
 * `runSettings` keeps the older, quieter reading for a save that names neither,
 * so the tab names the fresh-scenario value as the default here.
 */
const DEFAULT_RUN_MODE: RunMode = 'monte-carlo'
const DEFAULT_UNCERTAINTY: UncertaintyMode = 'total'

/** Replicate count bounds; the seed is read as a 32-bit unsigned integer (hashU01). */
const MIN_REPLICATES = 1
const MAX_REPLICATES = 10000
const MIN_SEED = 0
const MAX_SEED = 4294967295

/** Sobol base bounds: Saltelli runs base × (fields + 2) engine runs, so a large base is costly. */
const MIN_SOBOL_BASE = 8
const MAX_SOBOL_BASE = 4096

const MODE_OPTIONS: Array<{ v: RunMode; label: string }> = [
  { v: 'deterministic', label: 'Deterministic' },
  { v: 'monte-carlo', label: 'Monte Carlo' },
]

/** Aleatory: the draw noise only. Total: one parameter sample per replicate too. */
const UNCERTAINTY_OPTIONS: Array<{ v: UncertaintyMode; label: string }> = [
  { v: 'aleatory', label: 'Aleatory' },
  { v: 'total', label: 'Total' },
]

const SAMPLING_OPTIONS: Array<{ v: SamplingMode; label: string }> = [
  { v: 'lhs', label: 'Latin hypercube' },
  { v: 'independent', label: 'Independent' },
]

const DEPTH_OPTIONS: Array<{ v: SensitivityDepth; label: string }> = [
  { v: 'full', label: 'Morris then Sobol' },
  { v: 'quick', label: 'Quick: one-at-a-time' },
]

/** The technical name of each value, for the second half of a row label. */
const RUN_MODE_NAME: Record<RunMode, string> = {
  deterministic: 'deterministic',
  'monte-carlo': 'Monte Carlo',
}
const UNCERTAINTY_NAME: Record<UncertaintyMode, string> = {
  aleatory: 'aleatory',
  total: 'total',
}
const SAMPLING_NAME: Record<SamplingMode, string> = {
  lhs: 'Latin hypercube',
  independent: 'independent',
}

/** A cleared half-width rule runs every replicate, so the row says so. */
function halfWidthName(value: number | null): string {
  return value == null ? 'every replicate' : 'half-width'
}

/**
 * One setting: the label, the control, the default and a reset to it. The
 * reset is disabled while the value is the default, so the row also says
 * whether the setting was touched.
 */
function RunRow({
  label,
  name,
  defaultText,
  atDefault,
  onReset,
  children,
}: {
  /** Plain-language name of the setting. */
  label: string
  /** Technical name of the value in force. */
  name: string
  defaultText: string
  atDefault: boolean
  onReset: () => void
  children: ReactNode
}) {
  return (
    <div className="run-row">
      <Field label={`${label} · ${name}`}>{children}</Field>
      <span className="run-default">Default {defaultText}</span>
      <button
        type="button"
        className="mini"
        disabled={atDefault}
        aria-label={`Reset ${label} to the default`}
        onClick={onReset}
      >
        Reset
      </button>
    </div>
  )
}

/** A named group of rows, as the Systems tab groups a system. */
function RunGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="run-group" aria-label={label}>
      <div className="run-head">
        <h4>{label}</h4>
      </div>
      {children}
    </section>
  )
}

/** How the replicates run: mode, what varies, the repeat key and the count. */
function ReplicateGroup({ run }: { run: McSettings }) {
  const patchScenario = useStore((s) => s.patchScenario)
  return (
    <RunGroup label="Replicates">
      <RunRow
        label="Run kind"
        name={RUN_MODE_NAME[run.runMode]}
        defaultText={RUN_MODE_NAME[DEFAULT_RUN_MODE]}
        atDefault={run.runMode === DEFAULT_RUN_MODE}
        onReset={() => patchScenario({ runMode: DEFAULT_RUN_MODE })}
      >
        <Seg
          value={run.runMode}
          options={MODE_OPTIONS}
          onChange={(runMode) => patchScenario({ runMode })}
          label="Run kind"
        />
      </RunRow>
      <RunRow
        label="What varies"
        name={UNCERTAINTY_NAME[run.uncertainty]}
        defaultText={UNCERTAINTY_NAME[DEFAULT_UNCERTAINTY]}
        atDefault={run.uncertainty === DEFAULT_UNCERTAINTY}
        onReset={() => patchScenario({ uncertainty: DEFAULT_UNCERTAINTY })}
      >
        <Seg
          value={run.uncertainty}
          options={UNCERTAINTY_OPTIONS}
          onChange={(uncertainty) => patchScenario({ uncertainty })}
          label="What varies"
        />
      </RunRow>
      <RunRow
        label="Repeat key"
        name="seed"
        defaultText={String(DEFAULT_SEED)}
        atDefault={run.seed === DEFAULT_SEED}
        onReset={() => patchScenario({ seed: DEFAULT_SEED })}
      >
        <IntInput
          value={run.seed}
          min={MIN_SEED}
          max={MAX_SEED}
          onCommit={(seed) => patchScenario({ seed })}
        />
      </RunRow>
      <RunRow
        label="How many runs"
        name="replicates"
        defaultText={String(DEFAULT_REPLICATES)}
        atDefault={run.replicates === DEFAULT_REPLICATES}
        onReset={() => patchScenario({ replicates: DEFAULT_REPLICATES })}
      >
        <IntInput
          value={run.replicates}
          min={MIN_REPLICATES}
          max={MAX_REPLICATES}
          onCommit={(replicates) => patchScenario({ replicates })}
        />
      </RunRow>
    </RunGroup>
  )
}

/** When the loop may stop: the half-width rule, its bounds and the interval it reads. */
function StopGroup({ run }: { run: McSettings }) {
  const patchScenario = useStore((s) => s.patchScenario)
  return (
    <RunGroup label="Stop rule">
      <RunRow
        label="Stop rule"
        name={halfWidthName(run.targetHalfWidth)}
        defaultText={String(DEFAULT_TARGET_HALF_WIDTH)}
        atDefault={run.targetHalfWidth === DEFAULT_TARGET_HALF_WIDTH}
        onReset={() => patchScenario({ targetHalfWidth: DEFAULT_TARGET_HALF_WIDTH })}
      >
        <DecimalInput
          value={run.targetHalfWidth}
          onCommit={(targetHalfWidth) => patchScenario({ targetHalfWidth })}
        />
      </RunRow>
      <RunRow
        label="Fewest runs before it may stop"
        name="stop floor"
        defaultText={String(DEFAULT_STOP_FLOOR)}
        atDefault={run.stopFloor === DEFAULT_STOP_FLOOR}
        onReset={() => patchScenario({ stopFloor: DEFAULT_STOP_FLOOR })}
      >
        <IntInput
          value={run.stopFloor}
          min={MIN_REPLICATES}
          max={MAX_REPLICATES}
          onCommit={(stopFloor) => patchScenario({ stopFloor })}
        />
      </RunRow>
      <RunRow
        label="Most runs it may make"
        name="stop cap"
        defaultText={String(DEFAULT_STOP_CAP)}
        atDefault={run.stopCap === DEFAULT_STOP_CAP}
        onReset={() => patchScenario({ stopCap: DEFAULT_STOP_CAP })}
      >
        <IntInput
          value={run.stopCap}
          min={MIN_REPLICATES}
          max={MAX_REPLICATES}
          onCommit={(stopCap) => patchScenario({ stopCap })}
        />
      </RunRow>
      <RunRow
        label="Interval width"
        name="confidence"
        defaultText={String(DEFAULT_CONFIDENCE)}
        atDefault={run.confidence === DEFAULT_CONFIDENCE}
        onReset={() => patchScenario({ confidence: DEFAULT_CONFIDENCE })}
      >
        <DecimalInput
          value={run.confidence}
          min={0}
          max={1}
          nullable={false}
          onCommit={(confidence) => patchScenario({ confidence: confidence ?? DEFAULT_CONFIDENCE })}
        />
      </RunRow>
    </RunGroup>
  )
}

/** How the parameter samples are laid out, and how deep the sensitivity study goes. */
function SamplingGroup({ run }: { run: McSettings }) {
  const patchScenario = useStore((s) => s.patchScenario)
  return (
    <RunGroup label="Sampling and sensitivity">
      <RunRow
        label="Parameter draws"
        name={SAMPLING_NAME[run.sampling]}
        defaultText={SAMPLING_NAME[DEFAULT_SAMPLING]}
        atDefault={run.sampling === DEFAULT_SAMPLING}
        onReset={() => patchScenario({ sampling: DEFAULT_SAMPLING })}
      >
        <Seg
          value={run.sampling}
          options={SAMPLING_OPTIONS}
          onChange={(sampling) => patchScenario({ sampling })}
          label="Parameter draws"
        />
      </RunRow>
      <RunRow
        label="What drives the result"
        name={SENSITIVITY_DEPTH_NAME[run.sensitivityDepth]}
        defaultText={SENSITIVITY_DEPTH_NAME[DEFAULT_SENSITIVITY_DEPTH]}
        atDefault={run.sensitivityDepth === DEFAULT_SENSITIVITY_DEPTH}
        onReset={() => patchScenario({ sensitivityDepth: DEFAULT_SENSITIVITY_DEPTH })}
      >
        <Seg
          value={run.sensitivityDepth}
          options={DEPTH_OPTIONS}
          onChange={(sensitivityDepth) => patchScenario({ sensitivityDepth })}
          label="What drives the result"
        />
      </RunRow>
      <RunRow
        label="Sobol sample size"
        name="base N"
        defaultText={String(DEFAULT_SOBOL_BASE)}
        atDefault={run.sobolBase === DEFAULT_SOBOL_BASE}
        onReset={() => patchScenario({ sobolBase: DEFAULT_SOBOL_BASE })}
      >
        <IntInput
          value={run.sobolBase}
          min={MIN_SOBOL_BASE}
          max={MAX_SOBOL_BASE}
          onCommit={(sobolBase) => patchScenario({ sobolBase })}
        />
      </RunRow>
    </RunGroup>
  )
}

/** The Run tab of Settings. The Run button itself lives beside the board, not here. */
export function RunTab() {
  const scenario = useStore((s) => s.scenario)
  const run = runSettings(scenario)
  return (
    <>
      <ReplicateGroup run={run} />
      <StopGroup run={run} />
      <SamplingGroup run={run} />
    </>
  )
}

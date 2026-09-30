import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { uncertainFields } from '../../../analysis/uncertainty'
import {
  SweepMap,
  SWEEP_FACTOR_LABELS,
  SWEEP_RESPONSE_LABELS,
  sweepGridValid,
} from '../../../charts/SweepMap'
import { formatTime } from '../../../geometry/geo'
import { scenarioDurationS } from '../../../model/scenario'
import { entityActive, runSettings } from '../../../model/types'
import { DEFAULT_BUDGET, SENSITIVITY_RESPONSES } from '../../../playback/mcRun'
import type { McSummary, SensitivityResponse, Stat, SweepSummary } from '../../../playback/mcRun'
import {
  SWEEP_ENVIRONMENT_PRESETS,
  SWEEP_VALUES_MAX,
  SWEEP_VALUES_MIN,
} from '../../../playback/sweepFactors'
import type { SweepFactor, SweepFactorId } from '../../../playback/sweepFactors'
import { SWEEP_DEFAULTS, sobolBudgetWarning } from '../../../state/analysisRequests'
import { useStore } from '../../../state/store'
import { IconClose, IconInfo } from '../../../ui/icons'
import { Field } from '../../../ui/kit'
import { PanelSection } from '../../../ui/PanelSection'
import { PfTag } from '../../inspector/kit'
import { SENSITIVITY_DEPTH_NAME, SENSITIVITY_DEPTH_SENTENCE } from '../../settings/inputs'
import { SensitivityWidget } from '../SensitivityWidget'
import { EmptyRow } from '../controls'
import {
  bandMean,
  countSub,
  currentSensitivity,
  currentSummary,
  currentSweep,
  formatCount,
  statMean,
  timeStatSub,
} from '../mc'

const fractionText = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—')
const numberText = (n: number | null) => (n != null && Number.isFinite(n) ? formatCount(n) : '—')
const SWEEP_VALUE_RULE =
  'Enter 2–6 distinct values per factor; up to two different factors and 36 cells.'
const SWEEP_RULE = `${SWEEP_VALUE_RULE} Speed must be positive, altitude nonnegative, raid size a positive integer.`
/** The count responses a missing defended asset leaves undefined. */
const NEEDS_ASSET: ReadonlySet<SensitivityResponse> = new Set(['leakers', 'minWarningS'])
/** Minimum defined replicates before a conditional time mean claims its CI (`timeStatSub`). */
const TIME_CI_MIN_N = 30
const SENSITIVITY_TOP = 5

/** The defined fraction at each end of a time response's swing, each with its Wilson interval. */
function definedText(d: {
  lo: { p: number; lo: number; hi: number }
  hi: { p: number; lo: number; hi: number }
}): string {
  const end = (x: { p: number; lo: number; hi: number }) =>
    `${fractionText(x.p)} [${fractionText(x.lo)}, ${fractionText(x.hi)}]`
  return `conditional on defined times · defined fraction (95% Wilson): p10 ${end(d.lo)}; p90 ${end(d.hi)}`
}

/**
 * Suggested sweep values: planning values that span each factor's usual test range,
 * and the first chips a new factor starts with. They are not requirements.
 */
const SWEEP_SUGGESTED: Record<SweepFactorId, { suggest: string[]; start: string[] }> = {
  threatAltitudeFt: {
    suggest: ['50', '100', '200', '400', '800', '1200'],
    start: ['100', '200', '400', '800'],
  },
  threatSpeedMps: { suggest: ['15', '20', '25', '35', '50', '65'], start: ['20', '35', '50'] },
  approachAzimuthDeg: {
    suggest: ['0', '45', '90', '135', '180', '225', '270', '315'],
    start: ['0', '90', '180', '270'],
  },
  raidSize: { suggest: ['1', '2', '4', '6', '8', '10'], start: ['2', '4', '8'] },
  environmentPreset: {
    suggest: SWEEP_ENVIRONMENT_PRESETS.map((p) => p.id),
    start: ['clear-day', 'fog-day', 'clear-night'],
  },
}

/** A 24 px (i) whose title holds the method note. */
function InfoButton({ label, note }: { label: string; note: string }) {
  return (
    <button
      type="button"
      className="field-info"
      aria-label={`About ${label.toLowerCase()}`}
      title={note}
    >
      <IconInfo />
    </button>
  )
}

function measuredRate(mc: McSummary | null, sweep: SweepSummary | null): number | null {
  const elapsed = sweep?.elapsedMs ?? mc?.elapsedMs ?? 0
  const replicates = sweep
    ? sweep.cells.reduce((n, c) => n + c.summary.replicates, 0)
    : (mc?.replicates ?? 0)
  return elapsed > 0 && replicates > 0 ? replicates / (elapsed / 1000) : null
}

/** Observe completion order locally; retained summaries have no completion timestamp. */
function useReplicateRate(mc: McSummary | null, sweep: SweepSummary | null) {
  const previous = useRef({ mc, sweep })
  const [rate, setRate] = useState(() => measuredRate(null, sweep) ?? measuredRate(mc, null))
  useEffect(() => {
    const next =
      sweep && sweep !== previous.current.sweep
        ? measuredRate(null, sweep)
        : mc && mc !== previous.current.mc
          ? measuredRate(mc, null)
          : null
    if (next != null) setRate(next)
    previous.current = { mc, sweep }
  }, [mc, sweep])
  return rate
}

/** One ensemble quantity: its mean, its own interval text and the full note for the row title. */
interface EnsembleRow {
  response: SensitivityResponse
  mean: string
  unit: string
  interval: string
  note: string
}

function countRow(summary: McSummary, key: 'kills' | 'leakers', population: number) {
  const band = summary[key]
  const i = band.mean.length - 1
  const n = summary.replicates
  const lo = band.lo[i]
  const hi = band.hi[i]
  const defined = bandMean(band, i, n) != null && n >= 2 && Number.isFinite(lo + hi)
  return {
    mean: numberText(bandMean(band, i, n)),
    unit: `/${population}`,
    interval: defined ? `${formatCount(lo)}–${formatCount(hi)}` : '—',
    note: countSub(band, i, n),
  }
}

function timeRow(stat: Stat, quantity: 'detected' | 'warning') {
  const end = (v: number) =>
    (stat.hi - stat.lo) / 2 < 10 ? formatCount(Number(v.toFixed(1))) : `${Math.round(v)}`
  const defined =
    statMean(stat) != null && stat.n >= TIME_CI_MIN_N && Number.isFinite(stat.lo + stat.hi)
  return {
    mean: numberText(statMean(stat)),
    unit: 's',
    // One decimal under a 10 s half-width, whole seconds above it, as `timeStatSub` prints.
    interval: defined ? `${end(stat.lo)}–${end(stat.hi)}` : '—',
    note: timeStatSub(stat, quantity),
  }
}

/** The five quantities of the full-run ensemble, in the Measure order. */
function ensembleRows(summary: McSummary, hasAsset: boolean): EnsembleRow[] {
  const population = Object.values(summary.perThreat).reduce((n, t) => n + t.shipCount, 0)
  const salvoMeans = Object.values(summary.perEffector).map((e) => statMean(e.salvos))
  const salvos =
    summary.replicates > 0 && salvoMeans.every((v) => v != null)
      ? salvoMeans.reduce<number>((sum, v) => sum + v!, 0)
      : null
  const rows: Record<SensitivityResponse, Omit<EnsembleRow, 'response'>> = {
    leakers: countRow(summary, 'leakers', population),
    kills: countRow(summary, 'kills', population),
    firstDetectS: timeRow(summary.firstDetectS, 'detected'),
    minWarningS: timeRow(summary.minWarningS, 'warning'),
    // The per-effector means sum; their intervals do not, so the total carries none.
    salvos: {
      mean: numberText(salvos),
      unit: 'salvos',
      interval: '—',
      note: 'MC mean total over the effectors · per-effector intervals only; the total carries no interval',
    },
  }
  return SENSITIVITY_RESPONSES.map((response) =>
    !hasAsset && NEEDS_ASSET.has(response)
      ? {
          response,
          mean: '—',
          unit: '',
          interval: 'needs asset',
          note: 'Unavailable without a defended asset',
        }
      : { response, ...rows[response] },
  )
}

type FactorDraft = { id: SweepFactorId; text: string; presets: string[] }
function parseFactor(draft: FactorDraft): SweepFactor | null {
  if (draft.id === 'environmentPreset') return { id: draft.id, values: draft.presets }
  const parts = draft.text.split(',').map((v) => v.trim())
  const values = parts.map(Number)
  if (
    parts.some((v) => !v) ||
    values.some((v) => !Number.isFinite(v)) ||
    new Set(values).size !== values.length
  )
    return null
  if (draft.id === 'raidSize' && values.some((v) => !Number.isInteger(v) || v < 1)) return null
  if (draft.id === 'threatSpeedMps' && values.some((v) => v <= 0)) return null
  if (draft.id === 'threatAltitudeFt' && values.some((v) => v < 0)) return null
  return { id: draft.id, values }
}

/** A new factor starts on its suggested chips. */
function startDraft(id: SweepFactorId): FactorDraft {
  const start = SWEEP_SUGGESTED[id].start
  return id === 'environmentPreset'
    ? { id, text: '', presets: [...start] }
    : { id, text: start.join(','), presets: [] }
}

const chipsOf = (draft: FactorDraft) =>
  draft.id === 'environmentPreset'
    ? draft.presets
    : draft.text
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
const presetLabel = (id: string) => SWEEP_ENVIRONMENT_PRESETS.find((p) => p.id === id)?.label ?? id

/** The draft with `value` added, or null when the current parse rules refuse it. */
function withValue(draft: FactorDraft, value: string): FactorDraft | null {
  const token = value.trim()
  if (!token || chipsOf(draft).length >= SWEEP_VALUES_MAX) return null
  if (draft.id === 'environmentPreset')
    return draft.presets.includes(token) ? null : { ...draft, presets: [...draft.presets, token] }
  const next = { ...draft, text: [...chipsOf(draft), token].join(',') }
  return parseFactor(next) ? next : null
}

function withoutValue(draft: FactorDraft, value: string): FactorDraft {
  return draft.id === 'environmentPreset'
    ? { ...draft, presets: draft.presets.filter((p) => p !== value) }
    : {
        ...draft,
        text: chipsOf(draft)
          .filter((v) => v !== value)
          .join(','),
      }
}

/** One sweep factor: its select, its values as chips, an add box and the suggested values. */
function FactorBlock({
  axis,
  draft,
  onChange,
  onRemove,
  disabled,
}: {
  axis: 'A' | 'B'
  draft: FactorDraft
  onChange: (draft: FactorDraft) => void
  onRemove?: () => void
  disabled: boolean
}) {
  const id = useId()
  const [adding, setAdding] = useState('')
  const [refused, setRefused] = useState(false)
  const chips = chipsOf(draft)
  const full = chips.length >= SWEEP_VALUES_MAX
  const pool = SWEEP_SUGGESTED[draft.id].suggest.filter((v) => !chips.includes(v))
  const label = SWEEP_FACTOR_LABELS[draft.id]
  const text = (v: string) => (draft.id === 'environmentPreset' ? presetLabel(v) : v)
  const add = (value: string) => {
    const next = withValue(draft, value)
    setRefused(next == null)
    if (next) {
      onChange(next)
      setAdding('')
    }
  }
  return (
    <div className="r2b-factor">
      <div className="field">
        <span className="r2b-factor-head">
          <label htmlFor={id}>Factor {axis}</label>
          {onRemove && (
            <button type="button" className="r2b-link" disabled={disabled} onClick={onRemove}>
              Remove
            </button>
          )}
        </span>
        <select
          id={id}
          name={`factor-${axis}`}
          value={draft.id}
          disabled={disabled}
          onChange={(e) => {
            setRefused(false)
            onChange(startDraft(e.target.value as SweepFactorId))
          }}
        >
          {Object.entries(SWEEP_FACTOR_LABELS).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="r2b-chips" role="group" aria-label={`${label} values`}>
        {chips.map((v) => (
          <span className="r2b-chip" key={v} title={text(v)}>
            <span className="r2b-chip-t">{text(v)}</span>
            <button
              type="button"
              aria-label={`Remove ${text(v)}`}
              disabled={disabled}
              onClick={() => onChange(withoutValue(draft, v))}
            >
              <IconClose />
            </button>
          </span>
        ))}
        {draft.id !== 'environmentPreset' && !full && (
          <span className="r2b-chip r2b-chip-add">
            <input
              name={`add-${axis}`}
              value={adding}
              inputMode="decimal"
              placeholder="Value"
              aria-label={`Add a ${label.toLowerCase()} value`}
              aria-invalid={refused || undefined}
              disabled={disabled}
              onChange={(e) => {
                setRefused(false)
                setAdding(e.target.value)
              }}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                add(adding)
              }}
            />
          </span>
        )}
      </div>
      {refused && <p className="line-error">{SWEEP_RULE}</p>}
      {pool.length > 0 && !full && (
        <div className="r2b-suggest">
          <span>Add</span>
          {pool.map((v) => (
            <button
              type="button"
              key={v}
              aria-label={`Add ${text(v)}`}
              disabled={disabled}
              onClick={() => add(v)}
            >
              {text(v)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Why the chip grid cannot run, or null when it can. */
function sweepProblem(drafts: FactorDraft[], parsed: (SweepFactor | null)[]): string | null {
  if (parsed.some((f) => f == null)) return SWEEP_RULE
  if (drafts.some((d) => chipsOf(d).length < SWEEP_VALUES_MIN))
    return `Give each factor ${SWEEP_VALUES_MIN} to ${SWEEP_VALUES_MAX} values.`
  if (drafts.length === 2 && drafts[0].id === drafts[1].id) return 'Choose two different factors.'
  if (!sweepGridValid(parsed as SweepFactor[])) return SWEEP_VALUE_RULE
  return null
}

const unitOf = (r: SensitivityResponse) =>
  r === 'firstDetectS' || r === 'minWarningS' ? 's' : r === 'salvos' ? 'salvos' : 'members'
const measureWord = (r: SensitivityResponse) =>
  SWEEP_RESPONSE_LABELS[r].replace(/ \(.*\)$/, '').toLowerCase()

export function FragilityScreen() {
  const scenario = useStore((s) => s.scenario)
  const mc = useStore((s) => s.mc)
  const runId = useStore((s) => s.playback.runId)
  const showHelp = useStore((s) => s.ui.showFieldHelp)
  const startSweep = useStore((s) => s.runSweep)
  const cancelSweep = useStore((s) => s.cancelSweep)
  const startSensitivity = useStore((s) => s.runSensitivity)
  const summary = currentSummary(mc, runId)
  const baseline = useStore((s) => s.baseline)
  const sweep = currentSweep(mc, runId)
  const sensitivity = currentSensitivity(mc, runId)
  const rate = useReplicateRate(summary, sweep)
  const fields = useMemo(() => uncertainFields(scenario), [scenario])
  const [x, setX] = useState<FactorDraft>(() => startDraft('threatAltitudeFt'))
  const [y, setY] = useState<FactorDraft>(() => startDraft('threatSpeedMps'))
  const [twoFactors, setTwoFactors] = useState(true)
  const [chosen, setChosen] = useState<SensitivityResponse>('leakers')
  const [showAll, setShowAll] = useState(false)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [requested, setRequested] = useState<SweepFactor[] | null>(null)
  const [requestedRunId, setRequestedRunId] = useState<string | null>(null)
  const hasAsset = scenario.entities.some((e) => e.kind === 'asset' && entityActive(e))
  // One Measure drives the ensemble focus, the map and the ranking. Without an asset a
  // measure that needs one falls back to Kills; the choice returns once an asset exists.
  const measure: SensitivityResponse = !hasAsset && NEEDS_ASSET.has(chosen) ? 'kills' : chosen
  const drafts = twoFactors ? [x, y] : [x]
  const parsed = drafts.map(parseFactor)
  const problem = sweepProblem(drafts, parsed)
  const factors = problem == null ? (parsed as SweepFactor[]) : null
  const count = factors?.reduce((n, f) => n * f.values.length, 1) ?? 0
  const durationS = scenarioDurationS(scenario)
  const run = runSettings(scenario)
  const enabled = run.runMode !== 'deterministic'
  // The Run tab sets the depth; the section (i) names the method and what it will do.
  const depth = run.sensitivityDepth
  const sweeping = mc.sweep.status === 'running' && mc.sweep.runId === runId
  // The Morris and Sobol results ride the sensitivity run's identity: a basis
  // change marks that slice stale and a reset clears it, so they read through it.
  const stageResults =
    mc.sensitivity.status === 'stale' || mc.sensitivity.runId !== runId ? null : mc
  const stageResponse = stageResults?.sobol?.response ?? stageResults?.morris?.response ?? null
  const sensitivityRunning = mc.sensitivity.status === 'running'
  const onSobol = sensitivityRunning && depth === 'full' && mc.morris != null
  // Entity count is the scenario list, matching the 29-entity measurement.
  const budgetNote =
    onSobol &&
    sobolBudgetWarning(scenario.entities.length, mc.sensitivity.total, DEFAULT_BUDGET.timeMs)
      ? ` · this count can use most of the ${DEFAULT_BUDGET.timeMs / 60_000} min worker budget`
      : ''
  const stageLine =
    sensitivityRunning && depth === 'full'
      ? `${mc.sensitivity.progress} of ${mc.sensitivity.total} evaluations · ${mc.morris ? `Sobol on ${mc.morris.kept.length} fields` : 'Morris screening'}${budgetNote}`
      : `${mc.sensitivity.progress} of ${mc.sensitivity.total} fields`
  const mapFactors = sweep?.factors ?? (requestedRunId === runId && sweeping ? requested : factors)
  const swingOf = (row: { responses?: Record<SensitivityResponse, { swing: number }> }) => {
    const swing = row.responses?.[measure].swing
    return swing != null && Number.isFinite(swing) ? swing : -1
  }
  const ranked = [...(sensitivity?.rows ?? [])].sort((a, b) => swingOf(b) - swingOf(a))
  const shown = showAll ? ranked : ranked.slice(0, SENSITIVITY_TOP)
  const maxSwing = Math.max(0, ...ranked.map(swingOf))
  // A disabled action names why in its title.
  const modeReason = enabled ? undefined : 'Choose Monte Carlo mode in the Inputs tab'
  const busyReason = sweeping
    ? 'A sweep is running'
    : sensitivityRunning
      ? 'Sensitivity is running'
      : undefined
  const pinReason = !summary
    ? 'Run Monte Carlo first'
    : mc.status !== 'done'
      ? 'Wait for Monte Carlo to finish'
      : undefined
  const sweepReason = modeReason ?? busyReason ?? problem ?? undefined
  const sensitivityReason =
    modeReason ?? busyReason ?? (fields.length === 0 ? 'Add a spread to a field first' : undefined)
  const reps = SWEEP_DEFAULTS.replicatesPerCell
  const estimateS = rate == null ? null : Math.ceil((count * reps) / rate)
  const sweepNote = `Planning-factor values. Each cell is a ${reps}-replicate run of the full scenario. ${SWEEP_VALUE_RULE} Estimated time: ${
    estimateS == null ? 'no rate yet' : `${estimateS} s at ${formatCount(rate!)} replicates/s`
  }.`
  const sensitivityNote = `Method: ${SENSITIVITY_DEPTH_NAME[depth]}. ${SENSITIVITY_DEPTH_SENTENCE[depth]}.${
    sensitivity
      ? ' Each perturbation’s full run · MC mean swing at parameter p10/p90, not an uncertainty interval · paired SE.'
      : ''
  }`
  const sensitivityReadout = [
    sensitivity ? `${sensitivity.replicates} paired runs · seed ${sensitivity.seed}` : null,
    stageResponse && stageResponse !== measure ? `ran on ${measureWord(stageResponse)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const hasSensitivityResult = sensitivity != null || stageResults?.morris != null

  return (
    <section className="analysis-primary r2b-screen" aria-label="Fragility">
      <div className="pgrid">
        <div className="pg-4">
          <Field
            label="Measure"
            help="One measure drives the ensemble focus, the sweep map and the sensitivity ranking."
          >
            <select
              value={measure}
              onChange={(e) => setChosen(e.target.value as SensitivityResponse)}
            >
              {SENSITIVITY_RESPONSES.map((r) => {
                const na = !hasAsset && NEEDS_ASSET.has(r)
                return (
                  <option key={r} value={r} disabled={na}>
                    {`${SWEEP_RESPONSE_LABELS[r]}${na ? ' · needs asset' : ''}`}
                  </option>
                )
              })}
            </select>
          </Field>
        </div>
      </div>
      {modeReason && <EmptyRow>{`${modeReason} to run analyses.`}</EmptyRow>}

      <PanelSection
        title="Ensemble"
        readout={
          summary && (
            <span
              title={`Full run · ${summary.replicates} replicates · seed ${summary.seed} · horizon T+${formatTime(summary.durationS)}`}
            >
              {`${summary.replicates} runs · seed ${summary.seed} · T+${formatTime(summary.durationS)}`}
            </span>
          )
        }
        end={
          <button
            type="button"
            className="mini"
            disabled={!summary || mc.status !== 'done'}
            title={
              pinReason
                ? `${pinReason} to pin a baseline.`
                : baseline
                  ? `Replaces the pinned baseline · ${baseline.label}`
                  : 'Pin this laydown and ensemble for Compare'
            }
            onClick={() => useStore.getState().pinBaseline()}
          >
            Pin
          </button>
        }
      >
        {summary ? (
          <table className="tb r2b-ens" aria-label="Ensemble means">
            <colgroup>
              <col />
              <col className="r2b-ens-mean" />
              <col className="r2b-ens-ci" />
            </colgroup>
            <thead>
              <tr>
                <th>Quantity</th>
                <th>Mean</th>
                <th title="95 % interval on the mean">95 % CI of mean</th>
              </tr>
            </thead>
            <tbody>
              {ensembleRows(summary, hasAsset).map((row) => (
                <tr
                  key={row.response}
                  className={row.response === measure ? 'on' : undefined}
                  data-ensemble-row={row.response}
                  title={row.note}
                >
                  <td>{measureWord(row.response).replace(/^./, (c) => c.toUpperCase())}</td>
                  <td>
                    {row.mean} {row.unit && <span className="r2b-dim">{row.unit}</span>}
                  </td>
                  <td className="r2b-dim">{row.interval}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyRow>
            {mc.status === 'running'
              ? 'Ensemble running. The top bar shows its progress.'
              : 'No ensemble for this setup. Press Run (⌘↵) in the top bar to run it.'}
          </EmptyRow>
        )}
        {showHelp && pinReason && <p className="field-help">{pinReason} to pin a baseline.</p>}
        {mc.error && <p role="alert">{mc.error}</p>}
      </PanelSection>

      <PanelSection
        title="Sweep"
        readout={
          factors && (
            <span title={sweepNote}>
              {`${count} cells · ${reps} runs each${estimateS == null ? '' : ` · ~${estimateS} s`}`}
            </span>
          )
        }
        end={
          <>
            <button
              type="button"
              className="mini"
              disabled={sweepReason != null}
              title={sweepReason}
              onClick={() => {
                if (!factors) return
                setRequested(factors)
                setRequestedRunId(runId)
                startSweep({
                  factors: factors as [SweepFactor] | [SweepFactor, SweepFactor],
                  ...SWEEP_DEFAULTS,
                  responses: [...SENSITIVITY_RESPONSES],
                })
              }}
            >
              Run sweep
            </button>
            {sweeping && (
              <button type="button" className="mini" onClick={() => cancelSweep()}>
                Cancel
              </button>
            )}
            <InfoButton label="Sweep" note={sweepNote} />
          </>
        }
      >
        <FactorBlock axis="A" draft={x} onChange={setX} disabled={sweeping} />
        {twoFactors ? (
          <FactorBlock
            axis="B"
            draft={y}
            onChange={setY}
            onRemove={() => setTwoFactors(false)}
            disabled={sweeping}
          />
        ) : (
          <button
            type="button"
            className="r2b-link"
            disabled={sweeping}
            onClick={() => setTwoFactors(true)}
          >
            Add second factor
          </button>
        )}
        {problem && !sweeping && <p className="line-error">{problem}</p>}
        {mapFactors && (
          <SweepMap
            factors={mapFactors}
            cells={sweep?.cells ?? []}
            response={measure}
            replicatesPerCell={sweep?.replicatesPerCell ?? reps}
            durationS={durationS}
            hasAsset={hasAsset}
            progress={sweeping ? mc.sweep.progress : 0}
            running={sweeping}
          />
        )}
        {sweeping && (
          <p role="status" className="r2b-note">
            {mc.sweep.progress} of {mc.sweep.total} cells complete · values arrive at completion.
          </p>
        )}
        {sweep && (
          <p className="r2b-note">
            {`Displayed sweep · seed ${sweep.seed} · ${sweep.cells.length} cells retained${sweep.stopped ? ` · ${sweep.stopped.rule}` : ''}.`}
          </p>
        )}
        {showHelp && <p className="field-help">{sweepNote}</p>}
        {mc.sweep.error && <p role="alert">{mc.sweep.error}</p>}
      </PanelSection>

      <PanelSection
        title="Sensitivity"
        readout={sensitivityReadout && <span title={sensitivityReadout}>{sensitivityReadout}</span>}
        end={
          <>
            <button
              type="button"
              className="mini"
              disabled={sensitivityReason != null}
              title={sensitivityReason}
              onClick={() => startSensitivity(measure)}
            >
              {hasSensitivityResult ? 'Run again' : 'Run sensitivity'}
            </button>
            <InfoButton label="Sensitivity" note={sensitivityNote} />
          </>
        }
      >
        {showHelp && <p className="field-help">{sensitivityNote}</p>}
        <SensitivityWidget
          scenario={scenario}
          morris={stageResults?.morris ?? null}
          sobol={stageResults?.sobol ?? null}
        />
        {shown.length > 0 && (
          <div className="r2b-sens">
            {shown.map((row) => {
              const key = `${row.modelId}:${row.field}`
              const value = row.responses?.[measure]
              const swing = value?.swing
              const finite = swing != null && Number.isFinite(swing)
              const open = openRow === key
              const unit = unitOf(measure)
              const time = measure === 'firstDetectS' || measure === 'minWarningS'
              return (
                <div className="r2b-srow" key={key} data-sensitivity-row={row.field}>
                  <button
                    type="button"
                    aria-expanded={open}
                    title={`${row.label} · ${row.field}`}
                    onClick={() => setOpenRow(open ? null : key)}
                  >
                    <span className="r2b-srow-nm">
                      {row.label} <span className="r2b-srow-f">{row.field}</span>{' '}
                      <PfTag
                        model={scenario.library.find((m) => m.id === row.modelId)}
                        field={row.field}
                      />
                    </span>
                    <span className="r2b-srow-bar" aria-hidden="true">
                      <i
                        style={{
                          width: `${finite && maxSwing > 0 ? (swing / maxSwing) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <span className="r2b-srow-v">
                      {numberText(swing ?? null)} {unit}
                    </span>
                  </button>
                  {open && (
                    <p className="r2b-srow-more">
                      {value ? (
                        <>
                          p10 {numberText(value.lo)} → p90 {numberText(value.hi)} · SE{' '}
                          {Number.isFinite(value.se) ? value.se.toFixed(2) : '—'} · paired runs
                          {time && ` · ${definedText(value.defined)}`}
                        </>
                      ) : (
                        'Response unavailable; run sensitivity again.'
                      )}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {ranked.length > SENSITIVITY_TOP && (
          <button type="button" className="r2b-link" onClick={() => setShowAll(!showAll)}>
            {showAll ? `Show top ${SENSITIVITY_TOP}` : `Show all ${ranked.length}`}
          </button>
        )}
        {fields.length === 0 && !sensitivity && <EmptyRow>No field carries a spread.</EmptyRow>}
        {fields.length > 0 && !hasSensitivityResult && !sensitivityRunning && (
          <EmptyRow>
            {`Rank the inputs that move ${measureWord(measure)} most. ${fields.length} ${fields.length === 1 ? 'field carries' : 'fields carry'} a spread.`}
          </EmptyRow>
        )}
        {sensitivity?.stopped && (
          <p className="r2b-note">
            Sensitivity {sensitivity.stopped.rule} · {sensitivity.rows.length} fields retained.
          </p>
        )}
        {sensitivityRunning && (
          <p role="status" className="r2b-note">
            {stageLine}
          </p>
        )}
        {mc.sensitivity.error && <p role="alert">{mc.sensitivity.error}</p>}
      </PanelSection>
    </section>
  )
}

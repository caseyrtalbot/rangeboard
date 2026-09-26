import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { assessRunValidity } from '../../../analysis/runValidity'
import type { RunValidityFinding } from '../../../analysis/runValidity'
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
import type { Entity } from '../../../model/types'
import { DEFAULT_BUDGET, SENSITIVITY_RESPONSES } from '../../../playback/mcRun'
import type { McSummary, SensitivityResponse, SweepSummary } from '../../../playback/mcRun'
import {
  SWEEP_ENVIRONMENT_PRESETS,
  SWEEP_VALUES_MAX,
  SWEEP_VALUES_MIN,
} from '../../../playback/sweepFactors'
import type { SweepFactor, SweepFactorId } from '../../../playback/sweepFactors'
import { SWEEP_DEFAULTS, sobolBudgetWarning } from '../../../state/analysisRequests'
import { useStore } from '../../../state/store'
import { IconChevronDown, IconChevronRight, IconInfo } from '../../../ui/icons'
import { Field, State } from '../../../ui/kit'
import { PfTag } from '../../inspector/kit'
import { SENSITIVITY_DEPTH_NAME, SENSITIVITY_DEPTH_SENTENCE } from '../../settings/inputs'
import { SensitivityWidget } from '../SensitivityWidget'
import { useForecastEngagement } from '../controls'
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
import { FindingThreatActions, SEVERITY_PILL, VALIDITY_TEXT } from '../runValidityText'
import { STOPPING_TITLE } from '../RunControl'
import { useEnsembleBasis } from './ensembleBasis'

const wrap = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'end',
  gap: 'var(--space-2)',
} as const
const smallBlock = { display: 'block' } as const
const stack = { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' } as const
const fractionText = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—')
const numberText = (n: number | null) => (n != null && Number.isFinite(n) ? formatCount(n) : '—')
const SWEEP_VALUE_RULE =
  'Enter 2–6 distinct values per factor; up to two different factors and 36 cells.'
const SWEEP_RULE = `${SWEEP_VALUE_RULE} Speed must be positive, altitude nonnegative, raid size a positive integer.`
const SWEEP_UNIT: Partial<Record<SweepFactorId, string>> = {
  threatAltitudeFt: 'ft AGL',
  threatSpeedMps: 'm/s',
  approachAzimuthDeg: '° true',
}

/**
 * A section title, an optional mono readout and the method note behind a 24 px (i).
 * With field help on, `help` renders under the head, one line each; it defaults to the note.
 */
function SectionHead({
  title,
  readout,
  note,
  help = [note],
  showHelp,
}: {
  title: string
  readout?: string
  note: string
  help?: string[]
  showHelp: boolean
}) {
  return (
    <>
      <div className="frag-head">
        <h3>{title}</h3>
        {readout && <span className="mono frag-readout">{readout}</span>}
        <button
          type="button"
          className="frag-info"
          aria-label={`About ${title.toLowerCase()}`}
          title={note}
        >
          <IconInfo />
        </button>
      </div>
      {showHelp &&
        help.map((line) => (
          <p className="frag-help" key={line}>
            {line}
          </p>
        ))}
    </>
  )
}

/** Open the library drawer at its Assets group. */
function openLibrary() {
  useStore.getState().openLibrary('asset')
}

/** The first clause of a finding with its mark, and the rest; joined by a space they are the message. */
function splitFinding(message: string): [string, string] {
  const m = /[.;:](\s|$)/.exec(message)
  if (!m) return [message, '']
  return [message.slice(0, m.index + 1), message.slice(m.index + 1).trim()]
}

/** One finding as a 28 px headline row; the rest of the finding and its scope open on click. */
function FindingRow({
  finding,
  entities,
  showHelp,
}: {
  finding: RunValidityFinding
  entities: Entity[]
  showHelp: boolean
}) {
  const [toggled, setToggled] = useState<boolean | null>(null)
  const open = toggled ?? showHelp
  const bodyId = useId()
  const [headline, rest] = splitFinding(finding.message)
  const tracks = finding.uasIds
    .map((id) => entities.find((e) => e.id === id)?.name ?? id)
    .join(', ')
  return (
    <div className="validity-finding frag-finding">
      <button
        type="button"
        className="frag-finding-head"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        data-finding={finding.id}
        onClick={() => setToggled(!open)}
      >
        <State
          tone={SEVERITY_PILL[finding.severity].tone}
          role="img"
          title={SEVERITY_PILL[finding.severity].text}
        >
          {null}
        </State>
        <span className="frag-finding-headline">{headline}</span>
        {open ? <IconChevronDown /> : <IconChevronRight />}
      </button>
      {open && (
        <div id={bodyId} className="frag-finding-body">
          {rest && <p>{rest}</p>}
          {finding.id === 'spawn-in-ring' && finding.uasIds.length > 0 ? (
            <>
              <p>
                Gates: {finding.gates.join(', ')}. Tracks: {tracks}.
              </p>
              <FindingThreatActions
                finding={{ ...finding, uasIds: finding.uasIds.slice(0, 1) }}
                entities={entities}
              />
            </>
          ) : (
            <details className="analysis-disclosure">
              <summary>Review finding scope</summary>
              <p>Gates: {finding.gates.join(', ')}.</p>
              <p>
                {finding.uasIds.length ? `Tracks: ${tracks}.` : 'Scenario-wide finding.'} Review
                settings in the Inputs tab.
              </p>
            </details>
          )}
        </div>
      )}
    </div>
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

function EnsembleTiles({ summary, hasAsset }: { summary: McSummary; hasAsset: boolean }) {
  const population = Object.values(summary.perThreat).reduce((n, t) => n + t.shipCount, 0)
  return (
    <div className="tiles c3" aria-label="Full-run Monte Carlo outcomes">
      {(['kills', 'leakers'] as const).map((key) => {
        const band = summary[key]
        const i = band.mean.length - 1
        const available = key === 'kills' || hasAsset
        return (
          <div className="tile" key={key}>
            <span className="tl">{key === 'kills' ? 'Kills' : 'Leakers'}</span>
            <div className="tv" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
              {numberText(available ? bandMean(band, i, summary.replicates) : null)}
              <small>/{population} members</small>
              <small style={smallBlock}>by T+{formatTime(summary.durationS)}</small>
            </div>
            <small>
              {available
                ? countSub(band, i, summary.replicates)
                : 'Unavailable without a defended asset'}
            </small>
          </div>
        )
      })}
      <div className="tile">
        <span className="tl">Min warning</span>
        <div className="tv" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
          {numberText(hasAsset ? statMean(summary.minWarningS) : null)}
          <small> s</small>
          <small style={smallBlock}>by T+{formatTime(summary.durationS)}</small>
        </div>
        <small>
          {hasAsset
            ? timeStatSub(summary.minWarningS, 'warning')
            : 'Unavailable without a defended asset'}
        </small>
      </div>
    </div>
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

/** A text factor whose own values break the rule; an empty field is not an error yet. */
function factorInvalid(draft: FactorDraft): boolean {
  if (draft.id === 'environmentPreset' || !draft.text.trim()) return false
  const f = parseFactor(draft)
  return !f || f.values.length < SWEEP_VALUES_MIN || f.values.length > SWEEP_VALUES_MAX
}

function FactorPicker({
  draft,
  onChange,
  axis,
  disabled,
  error,
}: {
  draft: FactorDraft
  onChange: (draft: FactorDraft) => void
  axis: string
  disabled: boolean
  error?: string
}) {
  return (
    <div style={{ minWidth: 0, flex: '1 1 140px' }}>
      <Field label={`${axis} factor`}>
        <select
          value={draft.id}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, id: e.target.value as SweepFactorId, text: '' })}
        >
          {Object.entries(SWEEP_FACTOR_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {draft.id === 'environmentPreset' ? (
        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend>
            {axis} values · {SWEEP_VALUES_MIN}–{SWEEP_VALUES_MAX}
          </legend>
          {SWEEP_ENVIRONMENT_PRESETS.map((preset) => (
            <label key={preset.id} style={smallBlock}>
              <input
                type="checkbox"
                checked={draft.presets.includes(preset.id)}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    presets: e.target.checked
                      ? [...draft.presets, preset.id]
                      : draft.presets.filter((id) => id !== preset.id),
                  })
                }
              />
              {preset.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <Field label={`${axis} values`} unit={SWEEP_UNIT[draft.id]} error={error}>
          <input
            value={draft.text}
            placeholder={`${SWEEP_VALUES_MIN}–${SWEEP_VALUES_MAX} values, comma-separated`}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, text: e.target.value })}
          />
        </Field>
      )}
    </div>
  )
}

export function FragilityScreen() {
  const scenario = useStore((s) => s.scenario)
  const mc = useStore((s) => s.mc)
  const runId = useStore((s) => s.playback.runId)
  const showHelp = useStore((s) => s.ui.showFieldHelp)
  const startMc = useStore((s) => s.runMonteCarlo)
  const startSweep = useStore((s) => s.runSweep)
  const cancelSweep = useStore((s) => s.cancelSweep)
  const startSensitivity = useStore((s) => s.runSensitivity)
  const basis = useEnsembleBasis()
  const summary = currentSummary(mc, runId)
  const baseline = useStore((s) => s.baseline)
  const sweep = currentSweep(mc, runId)
  const sensitivity = currentSensitivity(mc, runId)
  const rate = useReplicateRate(summary, sweep)
  const { assessments } = useForecastEngagement(scenario, runId)
  const validity = useMemo(() => assessRunValidity(scenario, assessments), [scenario, assessments])
  const fields = useMemo(() => uncertainFields(scenario), [scenario])
  const [x, setX] = useState<FactorDraft>({ id: 'threatAltitudeFt', text: '', presets: [] })
  const [y, setY] = useState<FactorDraft>({ id: 'threatSpeedMps', text: '', presets: [] })
  const [twoFactors, setTwoFactors] = useState(true)
  const [response, setResponse] = useState<SensitivityResponse>('leakers')
  const [sweepResponse, setSweepResponse] = useState<SensitivityResponse>(
    SWEEP_DEFAULTS.responses[0],
  )
  const [requested, setRequested] = useState<SweepFactor[] | null>(null)
  const [requestedRunId, setRequestedRunId] = useState<string | null>(null)
  const parsed = (twoFactors ? [x, y] : [x]).map(parseFactor)
  const factors =
    parsed.every((f): f is SweepFactor => f != null) && sweepGridValid(parsed) ? parsed : null
  const count = factors?.reduce((n, f) => n * f.values.length, 1) ?? 0
  // Each factor reads alone, yet the grid breaks the rule: the error sits on the last text field.
  const drafts = twoFactors ? [x, y] : [x]
  const gridTarget =
    !factors &&
    parsed.every(
      (f) =>
        f != null && f.values.length >= SWEEP_VALUES_MIN && f.values.length <= SWEEP_VALUES_MAX,
    )
      ? drafts.map((d) => d.id !== 'environmentPreset').lastIndexOf(true)
      : -1
  const factorError = (i: number) =>
    factorInvalid(drafts[i]) || gridTarget === i ? SWEEP_RULE : ''
  const durationS = scenarioDurationS(scenario)
  const hasAsset = scenario.entities.some((e) => e.kind === 'asset' && entityActive(e))
  const run = runSettings(scenario)
  const enabled = run.runMode !== 'deterministic'
  // The Run tab sets the depth; the section (i) names the method and what it will do.
  const depth = run.sensitivityDepth
  const sweeping = mc.sweep.status === 'running' && mc.sweep.runId === runId
  // The Morris and Sobol results ride the sensitivity run's identity: a basis
  // change marks that slice stale and a reset clears it, so they read through it.
  const stageResults =
    mc.sensitivity.status === 'stale' || mc.sensitivity.runId !== runId ? null : mc
  const sensitivityRunning = mc.sensitivity.status === 'running'
  // The pool refuses another cancel once it is stopping, so the button closes too.
  const mcStopping = mc.status === 'running' && mc.pool?.stopping === true
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
  const responseAvailable = hasAsset || (response !== 'leakers' && response !== 'minWarningS')
  const ranked = [...(responseAvailable ? (sensitivity?.rows ?? []) : [])].sort(
    (a, b) =>
      (Number.isFinite(b.responses?.[response].swing) ? b.responses![response].swing : -1) -
      (Number.isFinite(a.responses?.[response].swing) ? a.responses![response].swing : -1),
  )
  const maxSwing = Math.max(
    0,
    ...ranked.map((row) => row.responses?.[response].swing ?? 0).filter(Number.isFinite),
  )
  // A disabled action names why in its title.
  const modeReason = enabled ? undefined : 'Choose Monte Carlo mode in the Inputs tab'
  const busyReason = sweeping
    ? 'A sweep is running'
    : sensitivityRunning
      ? 'Sensitivity is running'
      : undefined
  const mcReason = modeReason ?? (mc.status === 'running' ? 'Monte Carlo is running' : undefined)
  const pinReason = !summary
    ? 'Run Monte Carlo first'
    : mc.status !== 'done'
      ? 'Wait for Monte Carlo to finish'
      : undefined
  const sweepReason =
    modeReason ?? busyReason ?? (factors ? undefined : 'Enter valid factor values')
  const sensitivityReason =
    modeReason ?? busyReason ?? (fields.length === 0 ? 'Add a spread to a field first' : undefined)
  // The replicates per cell are the ones Run sweep passes with its request.
  const sweepHelp = [
    `Planning-factor values. ${SWEEP_DEFAULTS.replicatesPerCell} replicates per cell.`,
    SWEEP_VALUE_RULE,
  ]
  const sweepNeedsAsset =
    !hasAsset && (sweepResponse === 'leakers' || sweepResponse === 'minWarningS')
  const worstTone = validity.findings.some((f) => f.severity === 'invalidating')
    ? SEVERITY_PILL.invalidating.tone
    : SEVERITY_PILL.limiting.tone
  const runButton = (
    <button type="button" disabled={mcReason != null} title={mcReason} onClick={() => startMc()}>
      Run Monte Carlo
    </button>
  )
  return (
    <section className="analysis-primary" aria-label="Fragility">
      <h3>Fragility</h3>
      {summary && (
        <>
          <p className="analysis-scope">{basis}</p>
          <EnsembleTiles summary={summary} hasAsset={hasAsset} />
        </>
      )}
      <div style={wrap}>
        {!summary && (
          <State tone="warning" hollow>
            No ensemble
          </State>
        )}
        {runButton}
        {mc.status === 'running' && (
          <>
            <span role="status">
              {mc.progress} of {mc.total} replicates
            </span>
            <button
              type="button"
              disabled={mcStopping}
              title={mcStopping ? STOPPING_TITLE : undefined}
              onClick={() => {
                if (!mcStopping) useStore.getState().cancelMonteCarlo()
              }}
            >
              {mcStopping ? 'Stopping' : 'Cancel Monte Carlo'}
            </button>
          </>
        )}
        <button
          type="button"
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
          Pin as baseline
        </button>
      </div>
      {showHelp &&
        (modeReason ? (
          <p className="frag-help">{modeReason} to run analyses.</p>
        ) : (
          <p className="frag-help">
            {pinReason ? `${pinReason} to pin a baseline. ` : ''}Run settings are in the Inputs tab.
          </p>
        ))}
      {mc.error && <p role="alert">{mc.error}</p>}
      <section aria-label="Factor sweep">
        <header>
          <SectionHead
            title="Sweep map"
            readout={`${count} cells · ${SWEEP_DEFAULTS.replicatesPerCell} reps/cell`}
            note={`${sweepHelp[0]} ${sweepHelp[1]} Estimated time: ${
              rate == null
                ? 'no rate yet'
                : `${Math.ceil((count * SWEEP_DEFAULTS.replicatesPerCell) / rate)} s at ${formatCount(rate)} replicates/s`
            }.`}
            help={sweepHelp}
            showHelp={showHelp}
          />
          <div style={stack}>
            <div style={wrap}>
              <FactorPicker
                draft={x}
                onChange={setX}
                axis="Column"
                disabled={sweeping}
                error={factorError(0)}
              />
              {twoFactors && (
                <FactorPicker
                  draft={y}
                  onChange={setY}
                  axis="Row"
                  disabled={sweeping}
                  error={factorError(1)}
                />
              )}
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={twoFactors}
                disabled={sweeping}
                onChange={(e) => setTwoFactors(e.target.checked)}
              />
              Two factors
            </label>
            <Field label="Sweep response">
              <select
                value={sweepResponse}
                onChange={(e) => setSweepResponse(e.target.value as SensitivityResponse)}
              >
                {SENSITIVITY_RESPONSES.map((r) => (
                  <option key={r} value={r}>
                    {SWEEP_RESPONSE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </header>
        <div style={wrap}>
          <button
            type="button"
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
            <button type="button" onClick={() => cancelSweep()}>
              Cancel sweep
            </button>
          )}
        </div>
        {sweeping && (
          <p role="status">
            {mc.sweep.progress} of {mc.sweep.total} cells complete · response values arrive at
            completion.
          </p>
        )}
        {sweep && (
          <p className="muted small">
            Displayed sweep · seed {sweep.seed} · {sweep.cells.length} retained cells.
          </p>
        )}
        {sweep?.stopped && (
          <p className="muted small">
            Sweep {sweep.stopped.rule} · {sweep.cells.length} cells retained.
          </p>
        )}
        {mc.sweep.error && <p role="alert">{mc.sweep.error}</p>}
        {mapFactors && sweepNeedsAsset && (
          <div className="frag-state-row">
            <State tone="warning" hollow>
              No defended asset
            </State>
          </div>
        )}
        {mapFactors && (
          <SweepMap
            factors={mapFactors}
            cells={sweep?.cells ?? []}
            response={sweepResponse}
            replicatesPerCell={sweep?.replicatesPerCell ?? SWEEP_DEFAULTS.replicatesPerCell}
            durationS={durationS}
            hasAsset={hasAsset}
            progress={sweeping ? mc.sweep.progress : 0}
          />
        )}
      </section>
      <section aria-label="Sensitivity">
        <header>
          <SectionHead
            title="Sensitivity"
            readout={
              sensitivity
                ? `${sensitivity.replicates} paired replicates · seed ${sensitivity.seed}`
                : undefined
            }
            note={`Method: ${SENSITIVITY_DEPTH_NAME[depth]}. ${SENSITIVITY_DEPTH_SENTENCE[depth]}.${
              sensitivity
                ? ' Each perturbation’s full run · MC mean swing at parameter p10/p90, not an uncertainty interval · paired SE.'
                : ''
            }`}
            showHelp={showHelp}
          />
          <Field label="Sensitivity response">
            <select
              value={response}
              onChange={(e) => setResponse(e.target.value as SensitivityResponse)}
            >
              {SENSITIVITY_RESPONSES.map((r) => (
                <option key={r} value={r}>
                  {SWEEP_RESPONSE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
        </header>
        <SensitivityWidget
          scenario={scenario}
          morris={stageResults?.morris ?? null}
          sobol={stageResults?.sobol ?? null}
        />
        {!responseAvailable && (
          <div className="frag-state-row">
            <State tone="warning" hollow>
              No defended asset
            </State>
            <button type="button" className="mini" onClick={openLibrary}>
              Place asset
            </button>
          </div>
        )}
        {ranked.map((row) => {
          const value = row.responses?.[response]
          const swing = value?.swing
          const finite = swing != null && Number.isFinite(swing)
          return (
            <div
              key={`${row.modelId}:${row.field}`}
              className="insp-row"
              style={{ display: 'block' }}
              data-sensitivity-row={row.field}
            >
              <span>
                {row.label} · {row.field}{' '}
                <PfTag
                  model={scenario.library.find((m) => m.id === row.modelId)}
                  field={row.field}
                />
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    height: 'var(--space-2)',
                    width: `${finite && maxSwing > 0 ? (swing / maxSwing) * 100 : 0}%`,
                    background: 'var(--text-secondary)',
                  }}
                />
                <span className="mono">
                  {numberText(swing ?? null)}{' '}
                  {response === 'firstDetectS' || response === 'minWarningS'
                    ? 's'
                    : response === 'salvos'
                      ? 'salvos'
                      : 'members'}
                </span>
              </div>
              {value ? (
                <small>
                  p10 {numberText(value.lo)} → p90 {numberText(value.hi)} · SE{' '}
                  {Number.isFinite(value.se) ? value.se.toFixed(2) : '—'}
                  {(response === 'firstDetectS' || response === 'minWarningS') && (
                    <>
                      {' '}
                      · conditional on defined times · defined fraction (95% Wilson): p10{' '}
                      {fractionText(value.defined.lo.p)} [{fractionText(value.defined.lo.lo)},{' '}
                      {fractionText(value.defined.lo.hi)}]; p90 {fractionText(value.defined.hi.p)} [
                      {fractionText(value.defined.hi.lo)}, {fractionText(value.defined.hi.hi)}]
                    </>
                  )}
                </small>
              ) : (
                <small>Response unavailable; run sensitivity again.</small>
              )}
            </div>
          )
        })}
        {fields.length === 0 && !sensitivity && (
          <p className="muted small">No field carries a spread.</p>
        )}
        {sensitivity?.stopped && (
          <p className="muted small">
            Sensitivity {sensitivity.stopped.rule} · {sensitivity.rows.length} fields retained.
          </p>
        )}
        {sensitivityRunning && <p role="status">{stageLine}</p>}
        <div style={wrap}>
          <button
            type="button"
            disabled={sensitivityReason != null}
            title={sensitivityReason}
            onClick={() => startSensitivity(response)}
          >
            Run sensitivity
          </button>
        </div>
        {mc.sensitivity.error && <p role="alert">{mc.sensitivity.error}</p>}
      </section>
      <section aria-label="Validity">
        <header>
          <div className="frag-head">
            <h3>Validity</h3>
            {validity.findings.length > 0 && (
              <State tone={worstTone}>
                {`${validity.findings.length} ${validity.findings.length === 1 ? 'finding' : 'findings'}`}
              </State>
            )}
          </div>
        </header>
        {validity.findings.map((finding) => (
          <FindingRow
            key={finding.id}
            finding={finding}
            entities={scenario.entities}
            showHelp={showHelp}
          />
        ))}
        {validity.findings.length === 0 && (
          <p className="muted small">{VALIDITY_TEXT[validity.validity].line}</p>
        )}
      </section>
    </section>
  )
}

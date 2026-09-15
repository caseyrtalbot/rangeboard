import { useState } from 'react'
import type { CalibrationRecord, NormalGammaParams, SpecModel, TimeObservation } from '../../model/types'
import { JEFFREYS_PRIOR } from '../../model/types'
import type { CalibrationFamily } from '../../analysis/calibrate'
import {
  acceptCalibration,
  acceptedInterval,
  acceptedValue,
  betaInterval,
  betaMean,
  calibrateProportion,
  calibrateTime,
  defaultTimePrior,
  meanCredibleInterval,
  observationText,
  timeSummary,
  validProportion,
  validTime,
} from '../../analysis/calibrate'
import { Field, Seg } from '../../ui/kit'

/** The typed inputs of the dialog, as text so a half-typed number is never rejected. */
export interface CalibrateDraft {
  successes: string
  trials: string
  form: TimeObservation['form']
  /** Pasted times, separated by whitespace, commas or newlines. */
  times: string
  n: string
  mean: string
  variance: string
}

const EMPTY_DRAFT: CalibrateDraft = { successes: '', trials: '', form: 'sample', times: '', n: '', mean: '', variance: '' }

const fmt = (v: number, digits = 4): string => (Number.isFinite(v) ? Number(v.toPrecision(digits)).toString() : '—')

/** The time observation a draft describes; `validTime` decides whether it is usable. */
function timeObservation(draft: CalibrateDraft): TimeObservation {
  if (draft.form === 'sample') {
    const timesS = draft.times.split(/[\s,;]+/).filter((t) => t !== '').map(Number)
    return { form: 'sample', timesS }
  }
  return { form: 'summary', n: Number(draft.n), meanS: Number(draft.mean), varianceS2: Number(draft.variance) }
}

/**
 * The record a draft implies, or null while the observation is incomplete.
 * The time prior is the field's current value with the spread-matched width.
 */
function recordFor(
  model: SpecModel,
  field: string,
  family: CalibrationFamily,
  value: number,
  draft: CalibrateDraft,
): CalibrationRecord | null {
  const target = { modelId: model.id, field }
  if (family === 'proportion') {
    if (draft.successes.trim() === '' || draft.trials.trim() === '') return null
    const observed = { successes: Number(draft.successes), trials: Number(draft.trials) }
    return validProportion(observed) ? calibrateProportion(target, observed) : null
  }
  const observed = timeObservation(draft)
  return validTime(observed) ? calibrateTime(target, observed, defaultTimePrior(model, field, value)) : null
}

/** Prior, observation and posterior as three columns of the same rows. */
function Comparison({ record, unit }: { record: CalibrationRecord; unit: string }) {
  const interval = acceptedInterval(record)
  const point = acceptedValue(record)
  const rows: Array<[string, string, string, string]> = record.kind === 'proportion'
    ? [
        ['Beta a', fmt(record.prior.a), '—', fmt(record.posterior.a)],
        ['Beta b', fmt(record.prior.b), '—', fmt(record.posterior.b)],
        ['Count', '—', observationText(record), '—'],
        ['Mean', fmt(betaMean(record.prior)), fmt(record.observed.successes / record.observed.trials), fmt(point)],
        ['95 % interval', intervalText(betaInterval(record.prior)), '—', intervalText(interval)],
      ]
    : timeRows(record.prior, record.posterior, timeSummary(record.observed), point, interval, unit)
  return (
    <table className="tb tb-dense" aria-label="Prior, observation and posterior">
      <thead>
        <tr><th></th><th>Prior</th><th>Observed</th><th>Posterior</th></tr>
      </thead>
      <tbody>
        {rows.map(([label, prior, observed, posterior]) => (
          <tr key={label}><td className="prose">{label}</td><td>{prior}</td><td>{observed}</td><td>{posterior}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

function intervalText(i: { lo: number; hi: number }): string {
  return `${fmt(i.lo)} to ${fmt(i.hi)}`
}

function timeRows(
  prior: NormalGammaParams,
  posterior: NormalGammaParams,
  observed: { n: number; meanS: number; varianceS2: number },
  point: number,
  interval: { lo: number; hi: number },
  unit: string,
): Array<[string, string, string, string]> {
  return [
    [`mu (${unit})`, fmt(prior.mu), '—', fmt(posterior.mu)],
    ['kappa', fmt(prior.kappa), '—', fmt(posterior.kappa)],
    ['alpha', fmt(prior.alpha), '—', fmt(posterior.alpha)],
    ['beta', fmt(prior.beta), '—', fmt(posterior.beta)],
    ['n', '—', String(observed.n), '—'],
    [`Mean (${unit})`, fmt(prior.mu), fmt(observed.meanS), fmt(point)],
    [`Variance (${unit}2)`, '—', fmt(observed.varianceS2), '—'],
    ['95 % interval on mean', intervalText(meanCredibleInterval(prior)), '—', intervalText(interval)],
  ]
}

/**
 * The dialog body with its draft controlled by the caller, so the parent (and
 * a test) can hold the draft. Accept writes the override through
 * `acceptCalibration` and closes; Cancel closes with nothing written.
 */
export function CalibrateForm({
  model,
  field,
  family,
  value,
  unit,
  draft,
  onDraft,
  onClose,
}: {
  model: SpecModel
  field: string
  family: CalibrationFamily
  value: number
  unit: string
  draft: CalibrateDraft
  onDraft: (next: CalibrateDraft) => void
  onClose: () => void
}) {
  const record = recordFor(model, field, family, value, draft)
  const set = (patch: Partial<CalibrateDraft>) => onDraft({ ...draft, ...patch })
  const title = `Calibrate ${field} on ${model.name}`

  function accept(event: React.FormEvent) {
    event.preventDefault()
    if (!record) return
    acceptCalibration(record)
    onClose()
  }

  return (
    <form className="dialog" role="dialog" aria-label={title} onSubmit={accept}>
      <div className="dialog-title">{title}</div>
      <p className="muted small">
        {family === 'proportion'
          ? `Beta posterior from a typed count under the Jeffreys prior (${JEFFREYS_PRIOR.a}, ${JEFFREYS_PRIOR.b}). Accept writes the posterior mean as an override.`
          : `Normal-gamma posterior from observed times. The prior mean is the current value ${fmt(value)} ${unit}; its width follows the field's spread. Accept writes the posterior mean as an override.`}
      </p>
      {family === 'proportion' ? (
        <div className="field-row">
          <Field label="Successes">
            <input type="number" step={1} min={0} value={draft.successes} aria-label="Successes"
              onChange={(e) => set({ successes: e.target.value })} />
          </Field>
          <Field label="Trials">
            <input type="number" step={1} min={1} value={draft.trials} aria-label="Trials"
              onChange={(e) => set({ trials: e.target.value })} />
          </Field>
        </div>
      ) : (
        <>
          <Seg label="Observation form" value={draft.form}
            options={[{ v: 'sample', label: 'Times' }, { v: 'summary', label: 'Summary' }]}
            onChange={(form) => set({ form })} />
          {draft.form === 'sample' ? (
            <Field label={`Observed times (${unit}), one per line or comma separated`}>
              <textarea rows={3} value={draft.times} aria-label="Observed times"
                onChange={(e) => set({ times: e.target.value })} />
            </Field>
          ) : (
            <div className="field-row">
              <Field label="n">
                <input type="number" step={1} min={1} value={draft.n} aria-label="Count"
                  onChange={(e) => set({ n: e.target.value })} />
              </Field>
              <Field label="Mean" unit={unit}>
                <input type="number" step="any" value={draft.mean} aria-label="Mean"
                  onChange={(e) => set({ mean: e.target.value })} />
              </Field>
              <Field label="Variance" unit={`${unit}2`}>
                <input type="number" step="any" min={0} value={draft.variance} aria-label="Variance"
                  onChange={(e) => set({ variance: e.target.value })} />
              </Field>
            </div>
          )}
        </>
      )}
      {record ? (
        <Comparison record={record} unit={unit} />
      ) : (
        <p className="muted small">Type the observation to see the posterior.</p>
      )}
      <div className="inspector-actions">
        <button type="button" onClick={onClose} aria-label={`Cancel calibration of ${field} on ${model.name}`}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={!record}
          aria-label={`Accept calibration of ${field} on ${model.name}`}>
          Accept
        </button>
      </div>
    </form>
  )
}

/** The dialog with its own draft; mounted per field, so a draft never survives a different field. */
export function CalibrateDialog(props: {
  model: SpecModel
  field: string
  family: CalibrationFamily
  value: number
  unit: string
  onClose: () => void
}) {
  const [draft, setDraft] = useState<CalibrateDraft>(EMPTY_DRAFT)
  return <CalibrateForm {...props} draft={draft} onDraft={setDraft} />
}

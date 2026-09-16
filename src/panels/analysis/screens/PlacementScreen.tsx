/**
 * Where to put it: one placement optimization over the positions of the
 * movable systems. The screen decides the request (objective, movable ids,
 * bounds, budget) and reads the result; the search itself runs on its own
 * worker behind `runOptimize`.
 *
 * The objective direction follows the response: a leaker count and a first
 * detection are minimized, a kill count, a warning time and a salvo count
 * maximized. Bounds are a range boundary of the scenario, so a proposal never
 * leaves the range. The budget defaults are the contract's 60 evaluations of
 * 40 replicates, at the scenario's own run seed, so every evaluation of one
 * request differs from the others by placement alone.
 *
 * Applying a candidate never edits the current scenario: it installs a copy
 * through `replaceScenario`, so history and the run reset exactly as they do
 * for a loaded scenario.
 */
import { useMemo, useState } from 'react'
import { SWEEP_RESPONSE_LABELS } from '../../../charts/SweepMap'
import { entityActive, runSettings } from '../../../model/types'
import type { Entity, Scenario } from '../../../model/types'
import { SENSITIVITY_RESPONSES } from '../../../playback/mcRun'
import type { SensitivityResponse, Stat } from '../../../playback/mcRun'
import type { Laydown, OptimizeObjective, OptimizeResult } from '../../../playback/optimizeTypes'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import { OPTIMIZE_DEFAULTS } from '../../../state/analysisRequests'
import { KIND_NAMES } from '../../../state/labels'
import { useStore } from '../../../state/store'
import { Field, State } from '../../../ui/kit'
import { formatCount } from '../mc'

const wrap = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'end',
  gap: 'var(--space-2)',
} as const
const block = { display: 'block' } as const

/** The kinds the optimizer may move: the defence's own systems, never a threat or an asset. */
const MOVABLE_KINDS: readonly Entity['kind'][] = ['sensor', 'effector', 'c2']

/** Which way each response is moved: fewer leakers and an earlier first detect; more kills, warning and salvos. */
const RESPONSE_DIRECTION: Record<SensitivityResponse, OptimizeObjective['direction']> = {
  leakers: 'minimize',
  firstDetectS: 'minimize',
  kills: 'maximize',
  minWarningS: 'maximize',
  salvos: 'maximize',
}
const DIRECTION_WORD: Record<OptimizeObjective['direction'], string> = {
  minimize: 'Minimize',
  maximize: 'Maximize',
}

/** A position in the meters world frame, one decimal. */
function positionText(pos: { x: number; y: number } | undefined): string {
  return pos ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}` : '—'
}

/** One objective estimate as its mean and its own interval; never a replicate quantile. */
function statText(stat: Stat): string {
  if (!(stat.n > 0) || !Number.isFinite(stat.mean)) return 'unavailable'
  if (!Number.isFinite(stat.lo) || !Number.isFinite(stat.hi)) {
    return `${formatCount(stat.mean)} · CI unavailable · n=${stat.n}`
  }
  return `${formatCount(stat.mean)} · ${formatCount(stat.lo)} to ${formatCount(stat.hi)} (${Math.round(stat.conf * 100)}% mean CI) · n=${stat.n}`
}

/** One row of the candidate table. `rank` is null for a starting laydown the ranking dropped. */
interface CandidateRow {
  rank: number | null
  positions: Laydown
  objective: Stat
  start: boolean
}

/** The candidates best first, then the starting laydown when the ranking left it out. */
function candidateRows(result: OptimizeResult): CandidateRow[] {
  const rows: CandidateRow[] = result.candidates.map((c, i) => ({
    rank: i + 1,
    positions: c.positions,
    objective: c.objective,
    start: c.evaluationIndex === 0,
  }))
  const first = result.trace[0]
  if (first && !rows.some((row) => row.start)) {
    rows.push({ rank: null, positions: first.positions, objective: first.objective, start: true })
  }
  return rows
}

/** The current scenario with `positions` applied and the placement named in the copy's name. */
function withPlacement(scenario: Scenario, positions: Laydown, rank: number): Scenario {
  return {
    ...scenario,
    name: `${scenario.name} (placement ${rank})`,
    entities: scenario.entities.map((e) => {
      const pos = positions[e.id]
      return pos ? { ...e, pos: { x: pos.x, y: pos.y } } : e
    }),
  }
}

export function PlacementScreen() {
  const scenario = useStore((s) => s.scenario)
  const optimize = useStore((s) => s.mc.optimize)
  const incumbent = useStore((s) => s.mc.optimizeBest)
  const runId = useStore((s) => s.playback.runId)
  const startOptimize = useStore((s) => s.runOptimize)
  const cancelOptimize = useStore((s) => s.cancelOptimize)
  const replaceScenario = useStore((s) => s.replaceScenario)

  const [response, setResponse] = useState<SensitivityResponse>('leakers')
  const [checked, setChecked] = useState<string[]>([])
  const [boundaryId, setBoundaryId] = useState<string | null>(null)
  const [evaluationsText, setEvaluationsText] = useState(String(OPTIMIZE_DEFAULTS.evaluations))
  const [replicatesText, setReplicatesText] = useState(String(OPTIMIZE_DEFAULTS.replicates))

  const settings = runSettings(scenario)
  const basis = useMemo(() => analysisBasisSignature(scenario), [scenario])
  const movable = scenario.entities.filter((e) => MOVABLE_KINDS.includes(e.kind) && entityActive(e))
  const ranges = scenario.boundaries.filter((b) => b.type === 'range')
  const bounds = ranges.find((b) => b.id === boundaryId) ?? ranges[0] ?? null
  const movableIds = checked.filter((id) => movable.some((e) => e.id === id))
  const evaluations = Number(evaluationsText)
  const replicates = Number(replicatesText)
  const budgetValid =
    Number.isInteger(evaluations) &&
    evaluations >= 2 &&
    Number.isInteger(replicates) &&
    replicates >= 1
  const enabled = settings.runMode !== 'deterministic'
  const running = optimize.status === 'running' && optimize.runId === runId
  const direction = RESPONSE_DIRECTION[response]
  // A result answers for the board it ran on: the same run and the same analysis basis.
  const result =
    optimize.status === 'done' && optimize.runId === runId && optimize.basisSignature === basis
      ? optimize.summary
      : null
  const rows = result ? candidateRows(result) : []
  const nameOf = (id: string) => scenario.entities.find((e) => e.id === id)?.name ?? id
  const cut = result != null && result.trace.length < result.budget.evaluations

  return (
    <section className="analysis-primary" aria-label="Where to put it">
      <h3>Where to put it</h3>
      <p className="analysis-scope">
        Gaussian process with expected improvement over the movable positions · each evaluation is a{' '}
        {result?.budget.replicates ?? replicates}-replicate run under common random numbers at seed{' '}
        {result?.budget.seed ?? settings.seed} · modeled, not observed.
      </p>
      {!enabled && (
        <p className="muted small">
          Choose Monte Carlo mode in the Inputs tab to run a placement study.
        </p>
      )}

      <section aria-label="Objective">
        <header>
          <h3>Objective</h3>
        </header>
        <div style={wrap}>
          <Field label="Placement response">
            <select
              value={response}
              disabled={running}
              onChange={(e) => setResponse(e.target.value as SensitivityResponse)}
            >
              {SENSITIVITY_RESPONSES.map((r) => (
                <option key={r} value={r}>
                  {SWEEP_RESPONSE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <span className="muted small">
            {DIRECTION_WORD[direction]} {SWEEP_RESPONSE_LABELS[response]}.
          </span>
        </div>
      </section>

      <section aria-label="Movable systems">
        <header>
          <h3>Movable systems</h3>
          <p className="muted small">Every other entity, every threat and every asset stays put.</p>
        </header>
        <fieldset disabled={running} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend>Systems the optimizer may move</legend>
          {movable.map((e) => (
            <label key={e.id} style={block}>
              <input
                type="checkbox"
                aria-label={`Move ${e.name}`}
                checked={movableIds.includes(e.id)}
                onChange={(event) =>
                  setChecked(
                    event.target.checked
                      ? [...movableIds, e.id]
                      : movableIds.filter((id) => id !== e.id),
                  )
                }
              />
              {e.name} · {KIND_NAMES[e.kind]}
            </label>
          ))}
        </fieldset>
        {movable.length === 0 && (
          <p className="muted small">No active sensor, effector or C2 to move.</p>
        )}
      </section>

      <section aria-label="Bounds">
        <header>
          <h3>Bounds</h3>
          <p className="muted small">
            A proposal stays inside the range polygon, in the meters world frame.
          </p>
        </header>
        {bounds ? (
          <Field label="Range boundary">
            <select
              value={bounds.id}
              disabled={running}
              onChange={(e) => setBoundaryId(e.target.value)}
            >
              {ranges.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.points.length} points
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="muted small">
            No range boundary. Draw one on the board before a placement run.
          </p>
        )}
      </section>

      <section aria-label="Budget">
        <header>
          <h3>Budget</h3>
          <p className="muted small">Engine replicates: evaluations × replicates per evaluation.</p>
        </header>
        <div style={wrap}>
          <Field label="Evaluations">
            <input
              type="number"
              min={2}
              step={1}
              value={evaluationsText}
              disabled={running}
              onChange={(e) => setEvaluationsText(e.target.value)}
            />
          </Field>
          <Field label="Replicates per evaluation">
            <input
              type="number"
              min={1}
              step={1}
              value={replicatesText}
              disabled={running}
              onChange={(e) => setReplicatesText(e.target.value)}
            />
          </Field>
          <Field label="Seed">
            <span className="mono">{settings.seed}</span>
          </Field>
        </div>
        {!budgetValid && (
          <p className="muted small">
            Enter whole numbers: at least 2 evaluations and 1 replicate.
          </p>
        )}
        <div style={wrap}>
          <button
            type="button"
            disabled={
              !enabled || running || movableIds.length === 0 || bounds == null || !budgetValid
            }
            onClick={() =>
              startOptimize({
                objective: { response, direction },
                movableIds,
                bounds: {
                  boundaryId: bounds!.id,
                  points: bounds!.points.map((p) => ({ x: p.x, y: p.y })),
                },
                evaluations,
                replicates,
              })
            }
          >
            Run placement
          </button>
          {running && (
            <button type="button" onClick={() => cancelOptimize()}>
              Cancel placement
            </button>
          )}
        </div>
        {running && (
          <p role="status">
            {optimize.progress} of {optimize.total} evaluations
            {incumbent && <> · incumbent {statText(incumbent.objective)}</>}
          </p>
        )}
        {optimize.error && <p role="alert">{optimize.error}</p>}
      </section>

      <section aria-label="Candidate laydowns">
        <header>
          <h3>Candidate laydowns</h3>
          <p className="muted small">
            {result
              ? `Best first by the objective · ${result.trace.length} evaluations · ${result.replicatesRun} engine replicates.`
              : 'No current placement result.'}
            {cut &&
              ` Run cut at ${result!.trace.length} of ${result!.budget.evaluations} evaluations.`}
          </p>
        </header>
        {result && (
          <table className="tb tb-dense" aria-label="Candidate laydowns">
            <thead>
              <tr>
                <th style={{ width: '14%' }}>Laydown</th>
                {result.movableIds.map((id) => (
                  <th
                    key={id}
                    style={{ width: `${Math.floor(46 / result.movableIds.length)}%` }}
                    title={`${nameOf(id)} · proposed x, y in meters`}
                  >
                    {nameOf(id)} (m)
                  </th>
                ))}
                <th style={{ width: '28%' }}>{SWEEP_RESPONSE_LABELS[result.objective.response]}</th>
                <th style={{ width: '12%' }}>Apply</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} data-placement-row={row.rank ?? 'start'}>
                  <td
                    title={
                      row.start
                        ? 'The starting laydown: the movable entities where they stand now'
                        : undefined
                    }
                  >
                    {row.rank != null ? `Candidate ${row.rank}` : 'Start'}
                    {row.start && (
                      <>
                        {' '}
                        <State tone="inactive" hollow>
                          start
                        </State>
                      </>
                    )}
                  </td>
                  {/* A dense cell clips in the right panel, so every cell carries its full text as a title. */}
                  {result.movableIds.map((id) => (
                    <td
                      key={id}
                      className="mono"
                      title={`${nameOf(id)} · ${positionText(row.positions[id])} m`}
                    >
                      {positionText(row.positions[id])}
                    </td>
                  ))}
                  <td title={statText(row.objective)}>{statText(row.objective)}</td>
                  <td>
                    {row.rank != null && (
                      <button
                        type="button"
                        onClick={() =>
                          replaceScenario(withPlacement(scenario, row.positions, row.rank!))
                        }
                      >
                        {`Apply placement ${row.rank}`}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {result && (
          <p className="muted small">
            Apply installs a copy of this scenario with the candidate positions and clears the run;
            the current scenario is never edited in place.
          </p>
        )}
      </section>
    </section>
  )
}

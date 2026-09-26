/**
 * One placement optimization over the positions of the movable systems. The
 * screen builds the request and reads the result; the search runs on its own
 * worker behind `runOptimize`. Bounds are a range boundary of the scenario, so a
 * proposal never leaves the range. Every evaluation of one request shares the
 * scenario's run seed and differs by placement alone. Applying a candidate
 * installs a copy through `replaceScenario` rather than editing the scenario.
 */
import { useMemo, useState } from 'react'
import { SWEEP_RESPONSE_LABELS } from '../../../charts/SweepMap'
import { entityActive, runSettings } from '../../../model/types'
import type { Entity, Scenario } from '../../../model/types'
import { SENSITIVITY_RESPONSES } from '../../../playback/mcRun'
import { boundsRefusal } from '../../../playback/optimize/polygon'
import type { SensitivityResponse, Stat } from '../../../playback/mcRun'
import type { Laydown, OptimizeObjective, OptimizeResult } from '../../../playback/optimizeTypes'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import { OPTIMIZE_DEFAULTS } from '../../../state/analysisRequests'
import { KIND_NAMES } from '../../../state/labels'
import { useStore } from '../../../state/store'
import { Field, State } from '../../../ui/kit'
import { IconInfo } from '../../../ui/icons'
import { EmptyRow } from '../DebriefRecord'
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

/** A section title and its method note behind a 24 px (i); help on also shows the note. */
function SectionHead({
  title,
  note,
  showHelp,
}: {
  title: string
  note: string | null
  showHelp: boolean
}) {
  return (
    <header>
      <div className="frag-head">
        <h3>{title}</h3>
        {note && (
          <button
            type="button"
            className="field-info"
            aria-label={`About ${title.toLowerCase()}`}
            title={note}
          >
            <IconInfo />
          </button>
        )}
      </div>
      {note && showHelp && <p className="field-help">{note}</p>}
    </header>
  )
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
  const showHelp = useStore((s) => s.ui.showFieldHelp)

  const [response, setResponse] = useState<SensitivityResponse>('leakers')
  const [checked, setChecked] = useState<string[]>([])
  const [boundaryId, setBoundaryId] = useState<string | null>(null)
  const [evaluationsText, setEvaluationsText] = useState(String(OPTIMIZE_DEFAULTS.evaluations))
  const [replicatesText, setReplicatesText] = useState(String(OPTIMIZE_DEFAULTS.replicates))

  const settings = runSettings(scenario)
  const basis = useMemo(() => analysisBasisSignature(scenario), [scenario])
  const movable = scenario.entities.filter((e) => MOVABLE_KINDS.includes(e.kind) && entityActive(e))
  // Optimize bounds need a polygon; a drawn range boundary may have only two vertices.
  const allRanges = scenario.boundaries.filter((b) => b.type === 'range')
  const ranges = allRanges.filter((b) => b.points.length >= 3)
  const skippedRanges = allRanges.length - ranges.length
  // A range the run would refuse stays listed with its reason; the default is the first usable one.
  const refusals = new Map(ranges.map((b) => [b.id, boundsRefusal(b.points)]))
  const bounds =
    ranges.find((b) => b.id === boundaryId) ??
    ranges.find((b) => refusals.get(b.id) == null) ??
    ranges[0] ??
    null
  const refusal = bounds ? refusals.get(bounds.id) : null
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
  const resultNote = result
    ? `Best first by the objective · ${result.trace.length} evaluations · ${result.replicatesRun} engine replicates. Apply installs a copy of this scenario with the candidate positions and clears the run; the current scenario is never edited in place.`
    : null

  return (
    <section className="analysis-primary" aria-label="Placement">
      <h3>Placement</h3>
      <p className="analysis-scope">
        Gaussian process with expected improvement over the movable positions · each evaluation is a{' '}
        {result?.budget.replicates ?? replicates}-replicate run under common random numbers at seed{' '}
        {result?.budget.seed ?? settings.seed} · modeled, not observed.
      </p>
      {!enabled && (
        <EmptyRow>Choose Monte Carlo mode in the Inputs tab to run a placement study.</EmptyRow>
      )}

      <section aria-label="Objective">
        <header>
          <h3>Objective</h3>
        </header>
        <div style={wrap}>
          <Field
            label="Placement response"
            help={`${DIRECTION_WORD[direction]} ${SWEEP_RESPONSE_LABELS[response]}.`}
          >
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
        </div>
      </section>

      <section aria-label="Movable systems">
        <SectionHead
          title="Movable systems"
          note="Every other entity, every threat and every asset stays put."
          showHelp={showHelp}
        />
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
        {movable.length === 0 && <EmptyRow>No active sensor, effector or C2 to move.</EmptyRow>}
      </section>

      <section aria-label="Bounds">
        <SectionHead
          title="Bounds"
          note="A proposal stays inside the range polygon, in the meters world frame."
          showHelp={showHelp}
        />
        {bounds ? (
          <Field label="Range boundary" error={refusal ?? ''}>
            <select
              value={bounds.id}
              disabled={running}
              onChange={(e) => setBoundaryId(e.target.value)}
            >
              {ranges.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.points.length} points
                  {refusals.get(b.id) != null && ' · unavailable'}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          allRanges.length === 0 && (
            <EmptyRow>No range boundary. Draw one on the board before a placement run.</EmptyRow>
          )
        )}
        {skippedRanges > 0 && (
          <EmptyRow>
            {skippedRanges === 1
              ? '1 range boundary has fewer than three vertices and cannot bound a placement run.'
              : `${skippedRanges} range boundaries have fewer than three vertices and cannot bound a placement run.`}
          </EmptyRow>
        )}
      </section>

      <section aria-label="Budget">
        <SectionHead
          title="Budget"
          note="Engine replicates: evaluations × replicates per evaluation."
          showHelp={showHelp}
        />
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
          <p className="line-error">Enter whole numbers: at least 2 evaluations and 1 replicate.</p>
        )}
        <div style={wrap}>
          <button
            type="button"
            disabled={
              !enabled ||
              running ||
              movableIds.length === 0 ||
              bounds == null ||
              refusal != null ||
              !budgetValid
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
        <SectionHead title="Candidate laydowns" note={resultNote} showHelp={showHelp} />
        {!result && <EmptyRow>No current placement result.</EmptyRow>}
        {cut && (
          <p className="empty-row">
            <State tone="warning">
              {`Run cut at ${result!.trace.length} of ${result!.budget.evaluations} evaluations.`}
            </State>
          </p>
        )}
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
      </section>
    </section>
  )
}

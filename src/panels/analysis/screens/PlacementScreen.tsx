/**
 * One placement optimization over the positions of the movable systems. The
 * screen builds the request and reads the result; the search runs on its own
 * worker behind `runOptimize`. Bounds are a range boundary of the scenario, so a
 * proposal never leaves the range. Every evaluation of one request shares the
 * scenario's run seed and differs by placement alone. Applying a candidate
 * installs a copy through `replaceScenario` rather than editing the scenario.
 */
import { Fragment, useMemo, useState } from 'react'
import { SWEEP_RESPONSE_LABELS } from '../../../charts/SweepMap'
import { entityActive, runSettings } from '../../../model/types'
import type { Entity, Scenario } from '../../../model/types'
import { SENSITIVITY_RESPONSES } from '../../../playback/mcRun'
import { boundsRefusal } from '../../../playback/optimize/polygon'
import type { SensitivityResponse, Stat } from '../../../playback/mcRun'
import type { Laydown, OptimizeObjective, OptimizeResult } from '../../../playback/optimizeTypes'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import { OPTIMIZE_DEFAULTS } from '../../../state/analysisRequests'
import { currentOptimize } from '../../../state/runState'
import { useStore } from '../../../state/store'
import { IconInfo } from '../../../ui/icons'
import { Field, State } from '../../../ui/kit'
import { PanelSection } from '../../../ui/PanelSection'
import { EmptyRow } from '../controls'
import { currentSummary, formatCount } from '../mc'

/** The kinds the optimizer may move: the defence's own systems, never a threat or an asset. */
const MOVABLE_KINDS: readonly Entity['kind'][] = ['sensor', 'c2', 'effector']
const KIND_GROUP: Partial<Record<Entity['kind'], { tag: string; group: string }>> = {
  sensor: { tag: 'S', group: 'Sensors' },
  c2: { tag: 'C2', group: 'C2' },
  effector: { tag: 'E', group: 'Effectors' },
}

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
/** The responses a missing defended asset leaves undefined. */
const NEEDS_ASSET: ReadonlySet<SensitivityResponse> = new Set(['leakers', 'minWarningS'])

const goalText = (r: SensitivityResponse) =>
  `${DIRECTION_WORD[RESPONSE_DIRECTION[r]]} ${SWEEP_RESPONSE_LABELS[r].replace(/^./, (c) => c.toLowerCase())}`

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

/** One row of the candidate list. `rank` is null for a starting laydown the ranking dropped. */
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

/**
 * One axis for every interval of a result: the lowest end to the highest end over the
 * rows, so the bars compare. A single value opens to one unit either side.
 */
function candidateScale(rows: { objective: Stat }[]): { lo: number; hi: number } {
  const ends = rows.flatMap(({ objective: s }) =>
    [s.lo, s.hi, s.mean].filter((v) => Number.isFinite(v)),
  )
  if (ends.length === 0) return { lo: 0, hi: 1 }
  const lo = Math.min(...ends)
  const hi = Math.max(...ends)
  return lo === hi ? { lo: lo - 1, hi: hi + 1 } : { lo, hi }
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
  const mc = useStore((s) => s.mc)
  const optimize = mc.optimize
  const incumbent = mc.optimizeBest
  const runId = useStore((s) => s.playback.runId)
  const startOptimize = useStore((s) => s.runOptimize)
  const cancelOptimize = useStore((s) => s.cancelOptimize)
  const replaceScenario = useStore((s) => s.replaceScenario)
  const showHelp = useStore((s) => s.ui.showFieldHelp)
  const preview = useStore((s) => s.ui.placementPreview)
  const setPreview = useStore((s) => s.setPlacementPreview)

  const [chosen, setChosen] = useState<SensitivityResponse>('leakers')
  const [checked, setChecked] = useState<string[]>([])
  const [boundaryId, setBoundaryId] = useState<string | null>(null)
  const [evaluationsText, setEvaluationsText] = useState(String(OPTIMIZE_DEFAULTS.evaluations))
  const [replicatesText, setReplicatesText] = useState(String(OPTIMIZE_DEFAULTS.replicates))
  const [openRow, setOpenRow] = useState<number | null>(null)

  const settings = runSettings(scenario)
  const basis = useMemo(() => analysisBasisSignature(scenario), [scenario])
  const hasAsset = scenario.entities.some((e) => e.kind === 'asset' && entityActive(e))
  // A goal that needs a defended asset falls back to Maximize kills while none exists.
  const response: SensitivityResponse = !hasAsset && NEEDS_ASSET.has(chosen) ? 'kills' : chosen
  const movable = MOVABLE_KINDS.flatMap((kind) =>
    scenario.entities.filter((e) => e.kind === kind && entityActive(e)),
  )
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
  const result = currentOptimize(optimize, runId, basis)
  const rows = result ? candidateRows(result) : []
  const nameOf = (id: string) => scenario.entities.find((e) => e.id === id)?.name ?? id
  const cut = result != null && result.trace.length < result.budget.evaluations
  // The time estimate reads the current ensemble's own rate; no ensemble, no estimate.
  const ensemble = currentSummary(mc, runId)
  const rate =
    ensemble && ensemble.elapsedMs > 0 ? ensemble.replicates / (ensemble.elapsedMs / 1000) : null
  const total = budgetValid ? evaluations * replicates : 0
  const needs = [
    !enabled && 'Monte Carlo mode',
    movableIds.length === 0 && 'a system to move',
    bounds == null ? 'a range boundary' : refusal != null && 'a usable range boundary',
    !budgetValid && 'a whole-number budget',
  ].filter((n): n is string => typeof n === 'string')
  const method = `Gaussian process with expected improvement over the movable positions. Each evaluation is a ${result?.budget.replicates ?? replicates}-replicate run under common random numbers at seed ${result?.budget.seed ?? settings.seed}. Engine replicates: evaluations × runs each. Modeled, not observed.`
  const resultNote =
    'Best first by the objective mean. The bar is the 95 % interval on each mean on one scale for the result; the dashed line is the start laydown. Apply installs a copy of this scenario with the candidate positions and clears the run; the current scenario is never edited in place.'
  const start = rows.find((row) => row.start) ?? null
  const scale = candidateScale(rows)
  const pct = (v: number) => ((v - scale.lo) / (scale.hi - scale.lo)) * 100
  const groups = MOVABLE_KINDS.map((kind) => ({
    kind,
    entities: movable.filter((e) => e.kind === kind),
  })).filter((g) => g.entities.length > 0)

  return (
    <section className="analysis-primary r2b-screen" aria-label="Placement">
      <div className="pgrid">
        <div className="pg-4">
          <Field label="Goal">
            <select
              value={response}
              disabled={running}
              onChange={(e) => setChosen(e.target.value as SensitivityResponse)}
            >
              {SENSITIVITY_RESPONSES.map((r) => {
                const na = !hasAsset && NEEDS_ASSET.has(r)
                return (
                  <option key={r} value={r} disabled={na}>
                    {`${goalText(r)}${na ? ' · needs asset' : ''}`}
                  </option>
                )
              })}
            </select>
          </Field>
        </div>
      </div>

      <PanelSection
        title="Systems to move"
        readout={`${movableIds.length} of ${movable.length}`}
        end={
          <>
            <button
              type="button"
              className="r2b-link"
              disabled={running || movable.length === 0}
              onClick={() => setChecked(movable.map((e) => e.id))}
            >
              All
            </button>
            <button
              type="button"
              className="r2b-link"
              disabled={running || movableIds.length === 0}
              onClick={() => setChecked([])}
            >
              None
            </button>
            <InfoButton
              label="Systems to move"
              note="Every other entity, every threat and every asset stays put."
            />
          </>
        }
      >
        {showHelp && (
          <p className="field-help">Every other entity, every threat and every asset stays put.</p>
        )}
        {groups.length > 0 && (
          <fieldset className="r2b-move" disabled={running}>
            <legend className="r2b-sr">Systems the optimizer may move</legend>
            {groups.map((g) => (
              <Fragment key={g.kind}>
                <div className="r2b-move-group">{KIND_GROUP[g.kind]!.group}</div>
                {g.entities.map((e) => {
                  const full = scenario.library.find((m) => m.id === e.specId)?.name
                  const title = full && full !== e.name ? `${e.name} · ${full}` : e.name
                  return (
                    <label key={e.id} className="r2b-mv" title={title}>
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
                      <span className="r2b-kind">{KIND_GROUP[e.kind]!.tag}</span>
                      <span className="r2b-mv-nm">
                        {e.name}
                        {full && full !== e.name && <span className="r2b-dim"> {full}</span>}
                      </span>
                    </label>
                  )
                })}
              </Fragment>
            ))}
          </fieldset>
        )}
        {movable.length === 0 && <EmptyRow>No active sensor, effector or C2 to move.</EmptyRow>}
      </PanelSection>

      <PanelSection
        title="Bounds"
        end={
          <InfoButton
            label="Bounds"
            note="A proposal stays inside the range polygon, in the meters world frame."
          />
        }
      >
        {showHelp && (
          <p className="field-help">
            A proposal stays inside the range polygon, in the meters world frame.
          </p>
        )}
        {bounds ? (
          <Field label="Range boundary" error={refusal ?? ''}>
            <select
              value={bounds.id}
              disabled={running}
              onChange={(e) => setBoundaryId(e.target.value)}
            >
              {ranges.map((b) => (
                <option key={b.id} value={b.id}>
                  {`${b.name} · ${b.points.length} points${refusals.get(b.id) != null ? ' · unavailable' : ''}`}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="r2b-empty">
            <EmptyRow>
              {skippedRanges > 0
                ? 'No usable range boundary on the board.'
                : 'No range boundary on the board.'}
            </EmptyRow>
            <button
              type="button"
              className="mini"
              onClick={() => useStore.getState().setTool('boundary')}
            >
              Draw boundary
            </button>
          </div>
        )}
        {skippedRanges > 0 && (
          <p className="r2b-note">
            {skippedRanges === 1
              ? '1 range boundary has fewer than three vertices and cannot bound a placement run.'
              : `${skippedRanges} range boundaries have fewer than three vertices and cannot bound a placement run.`}
          </p>
        )}
      </PanelSection>

      <PanelSection title="Budget" end={<InfoButton label="Budget" note={method} />}>
        {showHelp && <p className="field-help">{method}</p>}
        <div className="pgrid">
          <div className="pg-1">
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
          </div>
          <div className="pg-1">
            <Field label="Runs each">
              <input
                type="number"
                min={1}
                step={1}
                value={replicatesText}
                disabled={running}
                onChange={(e) => setReplicatesText(e.target.value)}
              />
            </Field>
          </div>
          <div className="pg-2 r2b-total">
            <span className="r2b-total-l">Total</span>
            <span className="r2b-total-v" data-placement-total="">
              {budgetValid ? (
                <>
                  {`${total.toLocaleString('en-US')} runs`}
                  {rate != null && (
                    <span className="r2b-dim">{` · ~${Math.ceil(total / rate)} s`}</span>
                  )}
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
        </div>
        <div className="r2b-run">
          <button
            type="button"
            disabled={running || needs.length > 0}
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
          {needs.length > 0 && (
            <span className="r2b-needs" data-placement-needs="">
              <span className="r2b-dim">Needs</span>
              {needs.map((n) => (
                <span key={n}>
                  <State tone="warning" hollow>
                    {n}
                  </State>
                </span>
              ))}
            </span>
          )}
        </div>
        {running && (
          <p role="status" className="r2b-note">
            {optimize.progress} of {optimize.total} evaluations
            {incumbent && <> · incumbent {statText(incumbent.objective)}</>}
          </p>
        )}
        {optimize.error && <p role="alert">{optimize.error}</p>}
      </PanelSection>

      <PanelSection
        title="Candidates"
        readout={
          result && (
            <span
              title={`${SWEEP_RESPONSE_LABELS[result.objective.response]} · ${result.trace.length} evaluations · ${result.replicatesRun} engine replicates`}
            >
              {`${SWEEP_RESPONSE_LABELS[result.objective.response]} · ${result.trace.length} evaluations`}
            </span>
          )
        }
        end={result && <InfoButton label="Candidates" note={resultNote} />}
      >
        {!result && <EmptyRow>No placement result yet.</EmptyRow>}
        {result && showHelp && <p className="field-help">{resultNote}</p>}
        {result && result.objective.response !== response && (
          <p className="r2b-note">
            {`This result is for ${goalText(result.objective.response)}. Run placement again for the new goal.`}
          </p>
        )}
        {cut && (
          <p className="empty-row">
            <State tone="warning">
              {`Run cut at ${result!.trace.length} of ${result!.budget.evaluations} evaluations.`}
            </State>
          </p>
        )}
        {result && (
          <div className="r2b-cands" aria-label="Candidate laydowns">
            <div className="r2b-cand-axis" aria-hidden="true">
              <span className="r2b-cand-main">
                <span />
                <span className="r2b-cand-ax">
                  <span>{formatCount(Number(scale.lo.toFixed(1)))}</span>
                  <span>{formatCount(Number(((scale.lo + scale.hi) / 2).toFixed(1)))}</span>
                  <span>{formatCount(Number(scale.hi.toFixed(1)))}</span>
                </span>
                <span title="Change against the start laydown">Change</span>
              </span>
              <span className="r2b-cand-acts" />
            </div>
            {rows.map((row, i) => {
              const s = row.objective
              const defined = s.n > 0 && Number.isFinite(s.mean)
              const bounded = defined && Number.isFinite(s.lo) && Number.isFinite(s.hi)
              const delta =
                start && defined && Number.isFinite(start.objective.mean)
                  ? s.mean - start.objective.mean
                  : null
              // A change that rounds to zero at one decimal is no change and takes no tone.
              const better =
                delta != null &&
                Number(Math.abs(delta).toFixed(1)) !== 0 &&
                (RESPONSE_DIRECTION[result.objective.response] === 'minimize'
                  ? delta < 0
                  : delta > 0)
              const open = openRow === i
              // Only a preview of this result shows on the board, so only it reads as pressed.
              const shown = preview?.source === result && preview.rank === row.rank
              const label = row.rank != null ? `#${row.rank}` : 'Start'
              return (
                <div
                  key={i}
                  className={`r2b-cand${row.start ? ' start' : ''}`}
                  data-placement-row={row.rank ?? 'start'}
                >
                  <div className="r2b-cand-row">
                    <button
                      type="button"
                      className="r2b-cand-main"
                      aria-expanded={open}
                      title={`${row.start ? 'The start laydown · ' : ''}${statText(s)}`}
                      onClick={() => setOpenRow(open ? null : i)}
                    >
                      <span className="r2b-cand-rk">{label}</span>
                      <span className="r2b-iv">
                        <span className="r2b-iv-track" />
                        {start && Number.isFinite(start.objective.mean) && (
                          <span
                            className="r2b-iv-ref"
                            style={{ left: `${pct(start.objective.mean)}%` }}
                          />
                        )}
                        {bounded && (
                          <span
                            className="r2b-iv-band"
                            data-band={`${pct(s.lo).toFixed(1)}-${pct(s.hi).toFixed(1)}`}
                            style={{ left: `${pct(s.lo)}%`, width: `${pct(s.hi) - pct(s.lo)}%` }}
                          />
                        )}
                        {defined && (
                          <span className="r2b-iv-mean" style={{ left: `${pct(s.mean)}%` }} />
                        )}
                      </span>
                      <span className={`r2b-cand-d${better ? ' good' : ''}`}>
                        {row.start || delta == null
                          ? defined
                            ? formatCount(Number(s.mean.toFixed(1)))
                            : '—'
                          : // A change that rounds to zero prints unsigned.
                            `${Number(Math.abs(delta).toFixed(1)) === 0 ? '' : delta > 0 ? '+' : '−'}${formatCount(Number(Math.abs(delta).toFixed(1)))}`}
                      </span>
                    </button>
                    <span className="r2b-cand-acts">
                      {row.rank != null && (
                        <button
                          type="button"
                          className="mini"
                          aria-label={`Preview placement ${row.rank}`}
                          aria-pressed={shown}
                          title={
                            shown
                              ? 'Hide these positions on the board'
                              : 'Show these positions on the board'
                          }
                          onClick={() =>
                            setPreview(
                              shown
                                ? null
                                : { rank: row.rank!, positions: row.positions, source: result },
                            )
                          }
                        >
                          Preview
                        </button>
                      )}
                      {row.rank != null && (
                        <button
                          type="button"
                          className="mini"
                          aria-label={`Apply placement ${row.rank}`}
                          title="Install a copy of this scenario with these positions"
                          onClick={() =>
                            replaceScenario(withPlacement(scenario, row.positions, row.rank!))
                          }
                        >
                          Apply
                        </button>
                      )}
                    </span>
                  </div>
                  {open && (
                    <div className="r2b-cand-pos">
                      {result.movableIds.map((id) => (
                        <Fragment key={id}>
                          <span title={nameOf(id)}>{nameOf(id)}</span>
                          <span>{`${positionText(row.positions[id])} m`}</span>
                        </Fragment>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </PanelSection>
    </section>
  )
}

import { useMemo } from 'react'
import type { RequirementGateReport, RequirementGateStatus } from '../../../analysis/requirements'
import { buildRequirementGateReport } from '../../../analysis/requirements'
import { assessRunValidity } from '../../../analysis/runValidity'
import type { RequirementThresholds, Scenario } from '../../../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS } from '../../../model/types'
import { useStore } from '../../../state/store'
import { AnalysisSection } from '../AnalysisSection'
import { RequirementGates } from '../RequirementGates'
import { Field, useEngagement } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

/** Requirement thresholds in force: the save, over the defaults. */
function thresholdsOf(scenario: Pick<Scenario, 'requirements'>): RequirementThresholds {
  return { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return Math.min(high, Math.max(low, value))
}

/**
 * Requirement thresholds body: the pass lines the test defines. The engine
 * never sets one, so every field here is an input, not a readout.
 */
function ThresholdsBody() {
  const scenario = useStore((state) => state.scenario)
  const patchScenario = useStore((state) => state.patchScenario)
  const thresholds = thresholdsOf(scenario)
  const patch = (next: Partial<RequirementThresholds>) =>
    patchScenario({ requirements: { ...thresholds, ...next } })
  // A cleared field commits nothing, so undo does not record the blank.
  const onNumber = (apply: (n: number) => void) => (event: { target: { value: string } }) => {
    if (event.target.value !== '') apply(Number(event.target.value))
  }
  return (
    <>
      <div className="field-row">
        <Field label="Detect: single-scan Pd">
          <input
            type="number"
            min={0.05}
            max={0.99}
            step={0.05}
            value={thresholds.pdDetect}
            onChange={onNumber((n) => patch({ pdDetect: clamp(n, 0.05, 0.99) }))}
          />
        </Field>
        <Field label="Track: cumulative Pd">
          <input
            type="number"
            min={0.05}
            max={0.99}
            step={0.05}
            value={thresholds.pdTrackCumulative}
            onChange={onNumber((n) => patch({ pdTrackCumulative: clamp(n, 0.05, 0.99) }))}
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Effect: max residual per track">
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={thresholds.maxResidualPerTrack}
            onChange={onNumber((n) => patch({ maxResidualPerTrack: clamp(n, 0, 1) }))}
          />
        </Field>
        <Field label="Detect: min warning (s, empty = none)">
          <input
            type="number"
            min={0}
            step={5}
            value={thresholds.minWarningS ?? ''}
            onChange={(event) =>
              patch({
                minWarningS:
                  event.target.value === ''
                    ? null
                    : clamp(Number(event.target.value), 0, Number.MAX_SAFE_INTEGER),
              })
            }
          />
        </Field>
      </div>
      <p className="muted analysis-empty">
        The test defines these pass lines. The engine never sets them. A radar contact counts
        as DETECT when its single-scan Pd reaches the detect value.
      </p>
    </>
  )
}

function thresholdsHeadline(scenario: Pick<Scenario, 'requirements'>): string {
  const t = thresholdsOf(scenario)
  return `detect Pd ${t.pdDetect} · track ${t.pdTrackCumulative}`
}

function gateIdsOf(params: Record<string, unknown>): string[] {
  const raw = params.gates
  return Array.isArray(raw) ? raw.filter((g): g is string => typeof g === 'string') : []
}

/**
 * The report over a subset of gates. `met`, `required` and `overall` follow
 * the rule in `buildRequirementGateReport`: met counts passes, required is the
 * gate count, and overall fails on any fail, else is not-evaluated when any
 * gate was not run.
 */
function filterReport(report: RequirementGateReport, ids: string[]): RequirementGateReport {
  if (ids.length === 0) return report
  const gates = report.gates.filter((gate) => ids.includes(gate.id))
  const evaluated = gates.filter((g) => g.status !== 'not-evaluated')
  const failed = evaluated.some((g) => g.status === 'fail')
  const incomplete = evaluated.length !== gates.length
  const overall: RequirementGateStatus = failed ? 'fail' : incomplete ? 'not-evaluated' : 'pass'
  return {
    overall,
    met: gates.filter((g) => g.status === 'pass').length,
    required: gates.length,
    gates,
  }
}

/** The six kill-chain gates, or the subset the params name, over the whole run. */
export function RequirementGatesWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const { assessments, report } = useEngagement(scenario, runId)
  const ids = gateIdsOf(params)
  const idsKey = ids.join(',')
  const validity = useMemo(() => assessRunValidity(scenario, assessments), [scenario, assessments])
  const requirements = useMemo(
    () => buildRequirementGateReport(scenario, assessments, report, validity),
    [scenario, assessments, report, validity],
  )
  const shown = useMemo(
    () => filterReport(requirements, idsKey.split(',').filter(Boolean)),
    [requirements, idsKey],
  )
  const threats = assessments.filter((a) => a.status !== 'no-path').length

  return (
    <WidgetFrame
      id={id}
      type="requirement-gates"
      title="Requirement gates"
      meta={`${shown.met}/${shown.required} met · test-defined`}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {threats === 0 ? (
        <p className="muted small">No threats with flight paths.</p>
      ) : (
        <RequirementGates report={shown} />
      )}
      <AnalysisSection title="Thresholds" headline={thresholdsHeadline(scenario)}>
        <ThresholdsBody />
      </AnalysisSection>
    </WidgetFrame>
  )
}

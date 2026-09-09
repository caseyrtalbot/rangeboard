import type { RequirementThresholds, Scenario } from '../../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS } from '../../model/types'
import { useStore } from '../../state/store'
import { Field } from '../../ui/kit'

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


/** Requirement threshold inputs for a scenario preparation surface. */
export function RequirementSettings() {
  return <ThresholdsBody />
}

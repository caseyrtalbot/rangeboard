import type { RequirementThresholds } from '../../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS } from '../../model/types'
import { useStore } from '../../state/store'
import { Field } from '../../ui/kit'

type ThresholdField = keyof RequirementThresholds

/**
 * One pass-line box with the clamp and blank rules of the requirement inputs. A
 * cleared probability commits nothing, so undo does not record the blank; a
 * cleared minimum warning commits null (no minimum).
 */
export function ThresholdInput({ field, id }: { field: ThresholdField; id?: string }) {
  const requirements = useStore((state) => state.scenario.requirements)
  const patchScenario = useStore((state) => state.patchScenario)
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...requirements }
  const rule = RULES[field]
  const value = thresholds[field]
  return (
    <input
      id={id}
      type="number"
      min={rule.min}
      max={rule.max}
      step={rule.step}
      placeholder={rule.nullable ? 'None' : undefined}
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value
        if (raw === '' && !rule.nullable) return
        const next = raw === '' ? null : clamp(Number(raw), rule.min, rule.max)
        patchScenario({ requirements: { ...thresholds, [field]: next } })
      }}
    />
  )
}

const RULES: Record<ThresholdField, { min: number; max: number; step: number; nullable?: true }> = {
  pdDetect: { min: 0.05, max: 0.99, step: 0.05 },
  pdTrackCumulative: { min: 0.05, max: 0.99, step: 0.05 },
  maxResidualPerTrack: { min: 0, max: 1, step: 0.05 },
  minWarningS: { min: 0, max: Number.MAX_SAFE_INTEGER, step: 5, nullable: true },
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return Math.min(high, Math.max(low, value))
}

/**
 * Requirement thresholds body: the pass lines the test defines. The engine
 * never sets one, so every field here is an input, not a readout. The Inputs gate
 * table (`RequirementTable`) uses the same boxes.
 */
function ThresholdsBody() {
  return (
    <>
      <div className="field-row">
        <Field
          label="Detect: single-scan Pd"
          help="A radar contact counts as DETECT when its single-scan Pd reaches this value"
        >
          <ThresholdInput field="pdDetect" />
        </Field>
        <Field label="Track: cumulative Pd">
          <ThresholdInput field="pdTrackCumulative" />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Effect: max residual per track">
          <ThresholdInput field="maxResidualPerTrack" />
        </Field>
        <Field label="Detect: min warning" unit="s" help="Blank = no minimum">
          <ThresholdInput field="minWarningS" />
        </Field>
      </div>
    </>
  )
}

/** Requirement threshold inputs for the Settings panel, Scenario section. */
export function RequirementSettings() {
  return <ThresholdsBody />
}

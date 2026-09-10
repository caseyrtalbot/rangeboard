import type { UncertainField } from '../../analysis/parameterBasis'
import { SobolChart } from '../../charts/SobolChart'
import type { Scenario } from '../../model/types'
import type { MorrisResult, SobolResult } from '../../playback/mcTypes'

interface SensitivityWidgetProps {
  scenario: Scenario
  morris: MorrisResult | null
  sobol: SobolResult | null
}

/** What Morris ran and what it handed to Sobol. One line, in the chart's voice. */
function morrisNote(morris: MorrisResult): string {
  return `Morris screening: ${morris.trajectories} trajectories over ${morris.fields.length} fields, ${morris.evaluations} runs; kept ${morris.kept.length} for Sobol`
}

/**
 * Row label for one uncertain field: the model name and the field key, the pairing the
 * Fragility sensitivity rows already use. A connection id or 'doctrine' is off-library, so
 * the id stands in for a name.
 */
function labelFrom(scenario: Scenario) {
  return (field: UncertainField): string => {
    const model = scenario.library.find((m) => m.id === field.modelId)
    return `${model?.name ?? field.modelId} · ${field.field}`
  }
}

/**
 * The sensitivity read-out: the Sobol chart when the indices exist, else the Morris
 * screening on its own, else nothing. It takes both results as props and reads no store,
 * so a later slice mounts it in `FragilityScreen` without moving state.
 */
export function SensitivityWidget({ scenario, morris, sobol }: SensitivityWidgetProps) {
  const labelOf = labelFrom(scenario)

  if (sobol) {
    return (
      <div data-sensitivity-widget="sobol">
        <SobolChart result={sobol} labelOf={labelOf} />
        {morris ? <p className="muted small">{morrisNote(morris)}</p> : null}
      </div>
    )
  }

  if (morris) {
    // Kept fields in mu star order: the ranking is the order, `kept` is the membership.
    const kept = morris.ranking.filter((i) => morris.kept.includes(i)).map((i) => morris.fields[i])
    return (
      <div data-sensitivity-widget="morris">
        <p className="muted small">{morrisNote(morris)}</p>
        <div className="insp-row">
          <span className="insp-row-label">Field</span>
          <span className="insp-row-label">mu star · sigma</span>
        </div>
        {kept.map((f) => (
          <div className="insp-row" key={`${f.field.modelId}:${f.field.field}`} data-morris-row={f.field.field}>
            <span className="insp-row-label">{labelOf(f.field)}</span>
            <span className="insp-row-value mono">
              {f.muStar.toFixed(2)} <small>sigma {f.sigma.toFixed(2)}</small>
            </span>
          </div>
        ))}
      </div>
    )
  }

  return null
}

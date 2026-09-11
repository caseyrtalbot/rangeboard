import { MODEL_TAGS, type ModelId } from '../../analysis/fidelity'
import type { PhysicsSwitch } from '../../model/libraryField'
import { physicsSwitches } from '../../model/types'
import { useStore } from '../../state/store'
import { Field } from '../../ui/kit'

const SWITCHES: Record<PhysicsSwitch, { label: string; help: string; models?: ModelId[] }> = {
  truthTracks: { label: 'Truth-position tracks (no Kalman estimate)', help: 'Drops measurement noise and the Kalman position estimate.', models: ['tracker'] },
  noFalseTracks: { label: 'No false tracks', help: 'Drops simulated false tracks from radar scans.', models: ['false-tracks'] },
  noOperatorQueue: { label: 'No operator queue', help: 'Drops sampled operator delay and overload waits.', models: ['operator'] },
  singlePulseRadar: { label: 'Single-pulse radar (no dwell integration)', help: 'Fallback omits pulse integration over a dwell.', models: ['radar-dwell'] },
  noFlightLimits: { label: 'Unlimited target UAS ground track (no turn, acceleration or wind)', help: 'Fallback keeps straight constant-speed waypoint motion and omits wind drift. Climb rate remains unused because paths have scalar altitude.', models: ['threat-flight'] },
  rfBandGate: { label: 'RF band gate only (no link budget)', help: 'Fallback omits the RF link budget.', models: ['rf-link'] },
  eoirSpanRatio: { label: 'EO/IR span ratio (no Johnson optics)', help: 'Fallback omits Johnson optics.', models: ['eoir-dri'] },
  legacyKineticPk: { label: 'Legacy kinetic P(effect) (interceptor and projectile effector)', help: 'Fallback retains the existing shared P(effect) formula.', models: ['interceptor-miss', 'gun-burst'] },
  legacyBeamPk: { label: 'Legacy beam P(effect) (optical effector and RF field effector)', help: 'Fallback retains the existing shared P(effect) formula.', models: ['de-dwell', 'hpm-field'] },
}

/** Scenario owns the switches; its reader supplies the canonical manifest order. */
export function PhysicsTab() {
  const scenario = useStore((s) => s.scenario)
  const patchScenario = useStore((s) => s.patchScenario)
  const enabled = physicsSwitches(scenario)
  const order = physicsSwitches({ ...scenario, physics: Object.keys(SWITCHES) as PhysicsSwitch[] })

  return (
    <div className="physics-settings">
      <p className="muted small">Checked controls force the documented fallback. Clearing a control uses the available physical model.</p>
      <button type="button" className="mini" disabled={enabled.length === 0}
        onClick={() => patchScenario({ physics: [] })}>Reset physics</button>
      {order.map((id) => {
        const row = SWITCHES[id]
        const descriptionId = `physics-${id}-help`
        return (
          <div className="physics-row" key={id}>
            <Field label={row.label}>
              <input type="checkbox" checked={enabled.includes(id)} aria-describedby={descriptionId}
                onChange={(event) => {
                  const current = useStore.getState().scenario
                  const next = physicsSwitches(current).filter((value) => value !== id)
                  if (event.currentTarget.checked) next.push(id)
                  patchScenario({ physics: physicsSwitches({ ...current, physics: next }) })
                }} />
            </Field>
            <p id={descriptionId} className="muted small">{row.help}</p>
            <p className="muted small" title={row.models?.map((model) => MODEL_TAGS[model].note).join(' ')}>
              {row.models?.map((model) => MODEL_TAGS[model].label).join(' + ')}: lowers the run record to fallback
            </p>
          </div>
        )
      })}
    </div>
  )
}

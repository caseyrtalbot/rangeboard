import type { EmBackground, LightLevel, Precipitation } from '../../../model/types'
import { formatSpeed } from '../../../geometry/geo'
import { visibilityMFor } from '../../../analysis/sensorEnv'
import { useStore } from '../../../state/store'
import { environmentHeadline } from '../../headlines'
import { Info } from '../Info'
import { Field, Seg } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function ApplyEffectsCheck() {
  const apply = useStore((state) => state.scenario.environment.apply)
  const updateEnvironment = useStore((state) => state.updateEnvironment)
  return (
    <label className="apply-check" title="Apply environment effects to sensors and threats">
      <input
        type="checkbox"
        checked={apply}
        onChange={(event) => updateEnvironment({ apply: event.target.checked })}
      />
      apply
    </label>
  )
}

function EnvironmentBody() {
  const environment = useStore((state) => state.scenario.environment)
  const units = useStore((state) => state.ui.units)
  const updateEnvironment = useStore((state) => state.updateEnvironment)
  const cardinal = CARDINALS[Math.round(environment.windFromDeg / 45) % 8]
  return (
    <>
      <div className="field-row">
        <Field label="Sky">
          <Seg
            value={environment.precipitation ?? 'clear'}
            options={[
              { v: 'clear' as Precipitation, label: 'Clear' },
              { v: 'rain' as Precipitation, label: 'Rain' },
              { v: 'fog' as Precipitation, label: 'Fog' },
            ]}
            onChange={(precipitation) => updateEnvironment({ precipitation })}
          />
        </Field>
        <Field label="Light">
          <Seg
            value={environment.light ?? 'day'}
            options={[
              { v: 'day' as LightLevel, label: 'Day' },
              { v: 'night' as LightLevel, label: 'Night' },
            ]}
            onChange={(light) => updateEnvironment({ light })}
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label="EM clutter">
          <Seg
            value={environment.emBackground ?? 'rural'}
            options={[
              { v: 'rural' as EmBackground, label: 'Rural (quiet)' },
              { v: 'urban' as EmBackground, label: 'Urban (dense)' },
            ]}
            onChange={(emBackground) => updateEnvironment({ emBackground })}
          />
        </Field>
        <Field label={`Visibility (m, blank = ${visibilityMFor({ ...environment, visibilityM: null })} from sky)`}>
          <input
            type="number"
            min={0}
            step={500}
            placeholder={String(visibilityMFor({ ...environment, visibilityM: null }))}
            value={environment.visibilityM ?? ''}
            onChange={(event) =>
              updateEnvironment({
                visibilityM:
                  event.target.value === '' ? null : Math.max(0, Number(event.target.value)),
              })
            }
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label={`Wind ${formatSpeed(environment.windSpeedMps, units)}`}>
          <input
            type="range"
            min={0}
            max={25}
            value={environment.windSpeedMps}
            onChange={(event) => updateEnvironment({ windSpeedMps: Number(event.target.value) })}
          />
        </Field>
        <Field label={`From ${environment.windFromDeg} deg (${cardinal})`}>
          <input
            type="range"
            min={0}
            max={355}
            step={5}
            value={environment.windFromDeg}
            onChange={(event) => updateEnvironment({ windFromDeg: Number(event.target.value) })}
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label={`Temperature ${environment.temperatureC} C`}>
          <input
            type="range"
            min={-30}
            max={50}
            value={environment.temperatureC}
            onChange={(event) => updateEnvironment({ temperatureC: Number(event.target.value) })}
          />
        </Field>
        <Field label="Field elevation (ft)">
          <input
            type="number"
            step={500}
            value={environment.fieldElevationFt}
            onChange={(event) =>
              updateEnvironment({ fieldElevationFt: Number(event.target.value) })
            }
          />
        </Field>
      </div>
    </>
  )
}

function EnvironmentInfo() {
  return (
    <Info label="About environment effects">
      <p>Rain, fog, night, and EM clutter modify sensor performance by technology.</p>
      <p>Cold, altitude, and wind modify UAS reach.</p>
      <p>Factors follow the COURAGEOUS C-UAS study.</p>
    </Info>
  )
}

/** The environment covariates: sky, light, EM clutter, wind, temperature, elevation. */
export function EnvironmentWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  void params
  const environment = useStore((state) => state.scenario.environment)
  const units = useStore((state) => state.ui.units)
  return (
    <WidgetFrame
      id={id}
      type="environment"
      title="Environment"
      meta={environmentHeadline(environment, units)}
      headerExtra={
        <>
          <ApplyEffectsCheck />
          <EnvironmentInfo />
        </>
      }
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      <EnvironmentBody />
    </WidgetFrame>
  )
}

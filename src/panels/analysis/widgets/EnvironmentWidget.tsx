import type { EmBackground, LightLevel, Precipitation } from '../../../model/types'
import { formatSpeed } from '../../../geometry/geo'
import { MODEL_TAGS } from '../../../analysis/fidelity'
import { visibilityMFor } from '../../../analysis/sensorEnv'
import { useStore } from '../../../state/store'
import { environmentHeadline } from '../../headlines'
import { Rows } from '../detail/detailRows'
import { Info } from '../Info'
import { Field, Seg } from '../../../ui/kit'
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

/** Environment header controls and editor fields for a scenario preparation surface. */
export function EnvironmentSettings() {
  return (
    <>
      <div className="prepare-setting-controls">
        <ApplyEffectsCheck />
        <EnvironmentInfo />
      </div>
      <EnvironmentBody />
    </>
  )
}

function resolvedWord(value: string, defaulted: boolean): string {
  return `${value}${defaulted ? ' · default' : ''}`
}

function EnvironmentReadout({ onEdit }: { onEdit: () => void }) {
  const environment = useStore((state) => state.scenario.environment)
  const units = useStore((state) => state.ui.units)
  const precipitation = environment.precipitation ?? 'clear'
  const light = environment.light ?? 'day'
  const emBackground = environment.emBackground ?? 'rural'
  const cardinal = CARDINALS[Math.round(environment.windFromDeg / 45) % 8]
  const visibility =
    environment.visibilityM == null
      ? `Unspecified · ${visibilityMFor({ ...environment, visibilityM: null })} m from sky`
      : `${environment.visibilityM} m`
  const model = MODEL_TAGS.environment
  return (
    <div className="analysis-settings-readout" data-settings-scope="environment">
      <div className="analysis-settings-context">
        <span>Scenario inputs · edit in Prepare</span>
        <span
          className="fid-tag"
          data-tier={model.tier}
          data-validation={model.validation}
          title={model.note}
        >
          {model.label} · {model.tier} · {model.validation}
        </span>
      </div>
      <Rows
        rows={[
          { label: 'Effects', value: environment.apply ? 'Applied' : 'Off' },
          {
            label: 'Sky',
            value: resolvedWord(
              precipitation[0].toUpperCase() + precipitation.slice(1),
              environment.precipitation == null,
            ),
          },
          {
            label: 'Light',
            value: resolvedWord(light[0].toUpperCase() + light.slice(1), environment.light == null),
          },
          {
            label: 'EM clutter',
            value: resolvedWord(
              emBackground === 'rural' ? 'Rural (quiet)' : 'Urban (dense)',
              environment.emBackground == null,
            ),
          },
          { label: 'Visibility', value: visibility },
          { label: 'Wind speed', value: formatSpeed(environment.windSpeedMps, units) },
          { label: 'Wind from', value: `${environment.windFromDeg}° (${cardinal})` },
          { label: 'Temperature', value: String(environment.temperatureC), unit: ' °C' },
          { label: 'Field elevation', value: String(environment.fieldElevationFt), unit: ' ft' },
        ]}
      />
      <button
        className="mini analysis-settings-edit"
        type="button"
        data-preparation-section="environment"
        onClick={onEdit}
      >
        Edit environment in Prepare
      </button>
    </div>
  )
}

/** The environment covariates: sky, light, EM clutter, wind, temperature, elevation. */
export function EnvironmentWidget({
  id,
  params,
  collapsed,
  customize,
  index,
  count,
  onOpenPreparation,
}: WidgetProps) {
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
        onOpenPreparation ? (
          <EnvironmentInfo />
        ) : (
          <>
            <ApplyEffectsCheck />
            <EnvironmentInfo />
          </>
        )
      }
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {onOpenPreparation ? (
        <EnvironmentReadout onEdit={() => onOpenPreparation('environment')} />
      ) : (
        <EnvironmentBody />
      )}
    </WidgetFrame>
  )
}

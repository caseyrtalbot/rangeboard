import type { EmBackground, LightLevel, Precipitation } from '../../model/types'
import { formatSpeed } from '../../geometry/geo'
import { visibilityMFor } from '../../analysis/sensorEnv'
import { useStore } from '../../state/store'
import { Info } from './Info'
import { Field, Seg } from '../../ui/kit'

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/**
 * An on/off switch: a 24 px track and a word. Inputs uses it for the Environment
 * Effects head control and for Doctrine beside ROE.
 */
export function PrepSwitch({
  checked,
  label,
  title,
  ariaLabel,
  onChange,
}: {
  checked: boolean
  label: string
  title?: string
  /** The switch's name when its visible text is only the state word. */
  ariaLabel?: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      className="prep-switch"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span className="prep-switch-track" aria-hidden="true" />
      {label}
    </button>
  )
}

/**
 * A segmented control whose segments carry a title, so a short label keeps its
 * full wording on hover. `cls` adds a layout class such as `pg-seg4`.
 */
export function TitledSeg<T extends string>({
  label,
  value,
  options,
  onChange,
  cls,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ v: T; label: string; title: string }>
  onChange: (v: T) => void
  cls?: string
}) {
  return (
    <div className={cls ? `seg ${cls}` : 'seg'} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          className={value === o.v ? 'active' : ''}
          title={o.title}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const EM_OPTIONS: ReadonlyArray<{ v: EmBackground; label: string; title: string }> = [
  { v: 'rural', label: 'Rural', title: 'Rural: quiet RF background' },
  { v: 'urban', label: 'Urban', title: 'Urban: dense RF background' },
]

/** The Effects switch in the Environment section head. */
export function EnvironmentEffectsSwitch() {
  const apply = useStore((state) => state.scenario.environment.apply)
  const updateEnvironment = useStore((state) => state.updateEnvironment)
  return (
    <>
      <PrepSwitch
        checked={apply}
        label="Effects"
        title="Apply environment effects to sensors and threats"
        onChange={(next) => updateEnvironment({ apply: next })}
      />
      <Info label="About environment effects">
        <p>Rain, fog, night, and EM clutter modify sensor performance by technology.</p>
        <p>Cold, altitude, and wind modify UAS reach.</p>
        <p>Factors follow the COURAGEOUS C-UAS study.</p>
      </Info>
    </>
  )
}

/** The Environment section body: every field spans two of the four columns. */
export function EnvironmentSettings() {
  const environment = useStore((state) => state.scenario.environment)
  const units = useStore((state) => state.ui.units)
  const updateEnvironment = useStore((state) => state.updateEnvironment)
  const cardinal = CARDINALS[Math.round(environment.windFromDeg / 45) % 8]
  return (
    <>
      {!environment.apply && (
        <p className="prep-note">Effects are off. Sensors and threats ignore these values.</p>
      )}
      <div className="pgrid">
        <div className="pg-2">
          <div className="field">
            <span>Sky</span>
            <Seg
              label="Sky"
              value={environment.precipitation ?? 'clear'}
              options={[
                { v: 'clear' as Precipitation, label: 'Clear' },
                { v: 'rain' as Precipitation, label: 'Rain' },
                { v: 'fog' as Precipitation, label: 'Fog' },
              ]}
              onChange={(precipitation) => updateEnvironment({ precipitation })}
            />
          </div>
        </div>
        <div className="pg-2">
          <div className="field">
            <span>Light</span>
            <Seg
              label="Light"
              value={environment.light ?? 'day'}
              options={[
                { v: 'day' as LightLevel, label: 'Day' },
                { v: 'night' as LightLevel, label: 'Night' },
              ]}
              onChange={(light) => updateEnvironment({ light })}
            />
          </div>
        </div>
        <div className="pg-2">
          <div className="field">
            <span>EM clutter</span>
            <TitledSeg
              label="EM clutter"
              value={environment.emBackground ?? 'rural'}
              options={EM_OPTIONS}
              onChange={(emBackground) => updateEnvironment({ emBackground })}
            />
          </div>
        </div>
        <div className="pg-2">
          <Field
            label="Visibility"
            unit="m"
            help={`Blank = ${visibilityMFor({ ...environment, visibilityM: null })} m from sky`}
          >
            <input
              type="number"
              min={0}
              step={500}
              placeholder="Auto"
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
        <div className="pg-2">
          <Field label="Wind" unit={formatSpeed(environment.windSpeedMps, units)}>
            <input
              type="range"
              min={0}
              max={25}
              value={environment.windSpeedMps}
              onChange={(event) => updateEnvironment({ windSpeedMps: Number(event.target.value) })}
            />
          </Field>
        </div>
        <div className="pg-2">
          <Field label="Wind from" unit={`${environment.windFromDeg}° ${cardinal}`}>
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
        <div className="pg-2">
          <Field label="Temperature" unit={`${environment.temperatureC} °C`}>
            <input
              type="range"
              min={-30}
              max={50}
              value={environment.temperatureC}
              onChange={(event) => updateEnvironment({ temperatureC: Number(event.target.value) })}
            />
          </Field>
        </div>
        <div className="pg-2">
          <Field label="Field elevation" unit="ft">
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
      </div>
    </>
  )
}

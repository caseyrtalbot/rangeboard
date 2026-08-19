import type { SensorRole, SpecModel } from '../model/types'
import { SENSOR_ROLE_DEFAULT_RANGE_M } from '../model/types'
import { useStore } from '../state/store'

const SENSOR_ROLES: SensorRole[] = [
  'early-warning',
  'surveillance',
  'target-acquisition',
  'tracking',
  'fire-control',
  'classification',
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Num({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
}) {
  return (
    <Field label={label}>
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  )
}

/** Right-panel editor for the selected library model. All capability fields are editable. */
export function LibraryEditor() {
  const scenario = useStore((s) => s.scenario)
  const libraryId = useStore((s) => s.selection.libraryId)
  const { updateModel, duplicateModel, deleteModel, select } = useStore.getState()

  const model = scenario.library.find((m) => m.id === libraryId)
  if (!model) {
    return (
      <div className="inspector-body muted">
        <p>Select a model in the library panel, or create one with the + buttons.</p>
      </div>
    )
  }

  const patch = (p: Partial<SpecModel>) => updateModel(model.id, p)
  const sensor = model.sensor
  const uas = model.uas
  const effector = model.effector
  const tp = model.threatProfile

  return (
    <div className="inspector-body">
      <div className="panel-subtitle">
        {model.kind.toUpperCase()} MODEL {model.builtin ? '· seed' : '· custom'}
      </div>
      <Field label="Name">
        <input value={model.name} onChange={(e) => patch({ name: e.target.value })} />
      </Field>
      <Field label="Description">
        <textarea
          rows={2}
          value={model.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>
      <Field label="Color">
        <input type="color" value={model.color} onChange={(e) => patch({ color: e.target.value })} />
      </Field>

      {sensor && (
        <div className="subsection">
          <div className="panel-subtitle">Sensor capability</div>
          <Field label="Type">
            <select
              value={sensor.sensorType}
              onChange={(e) =>
                patch({ sensor: { ...sensor, sensorType: e.target.value as typeof sensor.sensorType } })
              }
            >
              <option value="radar">radar</option>
              <option value="eo-ir">eo/ir</option>
              <option value="acoustic">acoustic</option>
              <option value="rf">rf</option>
            </select>
          </Field>
          <Field label="Role (sets default range when unknown)">
            <select
              value={sensor.role ?? ''}
              onChange={(e) => {
                const role = (e.target.value || undefined) as SensorRole | undefined
                patch({ sensor: { ...sensor, role } })
              }}
            >
              <option value="">unset</option>
              {SENSOR_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r} (default {SENSOR_ROLE_DEFAULT_RANGE_M[r] / 1000} km)
                </option>
              ))}
            </select>
          </Field>
          <Num
            label="Detect range (m)"
            value={sensor.detectRangeM}
            step={100}
            onChange={(n) => patch({ sensor: { ...sensor, detectRangeM: n } })}
          />
          {sensor.role && (
            <button
              className="mini"
              onClick={() =>
                patch({ sensor: { ...sensor, detectRangeM: SENSOR_ROLE_DEFAULT_RANGE_M[sensor.role!] } })
              }
            >
              Use role default range
            </button>
          )}
          <Num
            label="Classify range (m, 0 = none)"
            value={sensor.classifyRangeM ?? 0}
            step={100}
            onChange={(n) => patch({ sensor: { ...sensor, classifyRangeM: n > 0 ? n : null } })}
          />
          <Num
            label="Sector (deg, 360 = omni)"
            value={sensor.sectorDeg}
            step={5}
            onChange={(n) => patch({ sensor: { ...sensor, sectorDeg: Math.min(360, Math.max(5, n)) } })}
          />
          <div className="field-row">
            <Num
              label="Elev min (deg)"
              value={sensor.elevationDeg?.[0] ?? 0}
              onChange={(n) =>
                patch({ sensor: { ...sensor, elevationDeg: [n, sensor.elevationDeg?.[1] ?? 90] } })
              }
            />
            <Num
              label="Elev max (deg)"
              value={sensor.elevationDeg?.[1] ?? 90}
              onChange={(n) =>
                patch({ sensor: { ...sensor, elevationDeg: [sensor.elevationDeg?.[0] ?? 0, n] } })
              }
            />
          </div>
          <Num
            label="Alt ceiling (ft, 0 = unknown)"
            value={sensor.maxAltitudeFt ?? 0}
            step={500}
            onChange={(n) => patch({ sensor: { ...sensor, maxAltitudeFt: n > 0 ? n : null } })}
          />
        </div>
      )}

      {effector && (
        <div className="subsection">
          <div className="panel-subtitle">Effector capability</div>
          <Field label="Type">
            <select
              value={effector.effectorType}
              onChange={(e) =>
                patch({
                  effector: { ...effector, effectorType: e.target.value as typeof effector.effectorType },
                })
              }
            >
              <option value="interceptor">interceptor</option>
              <option value="jammer">jammer</option>
              <option value="gun">gun</option>
              <option value="de">directed energy (laser)</option>
              <option value="hpm">high-power microwave</option>
              <option value="net">net capture</option>
            </select>
          </Field>
          <Num
            label="Min range (m)"
            value={effector.minRangeM}
            step={100}
            onChange={(n) => patch({ effector: { ...effector, minRangeM: n } })}
          />
          <Num
            label="Max range (m)"
            value={effector.maxRangeM}
            step={100}
            onChange={(n) => patch({ effector: { ...effector, maxRangeM: n } })}
          />
          <Num
            label="Engage time (s)"
            value={effector.engageTimeS}
            onChange={(n) => patch({ effector: { ...effector, engageTimeS: n } })}
          />
          <Num
            label="Sector (deg, 360 = omni)"
            value={effector.sectorDeg ?? 360}
            step={5}
            onChange={(n) =>
              patch({ effector: { ...effector, sectorDeg: Math.min(360, Math.max(5, n)) } })
            }
          />
          <Num
            label="Alt ceiling (ft, 0 = unknown)"
            value={effector.maxAltitudeFt ?? 0}
            step={500}
            onChange={(n) => patch({ effector: { ...effector, maxAltitudeFt: n > 0 ? n : null } })}
          />
        </div>
      )}

      {uas && (
        <div className="subsection">
          <div className="panel-subtitle">UAS performance</div>
          <div className="field-row">
            <Field label="Group">
              <select
                value={uas.group}
                onChange={(e) => patch({ uas: { ...uas, group: Number(e.target.value) as typeof uas.group } })}
              >
                {[1, 2, 3, 4, 5].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Airframe">
              <select
                value={uas.airframe}
                onChange={(e) =>
                  patch({ uas: { ...uas, airframe: e.target.value as typeof uas.airframe } })
                }
              >
                <option value="quad">quad</option>
                <option value="fixed-wing">fixed-wing</option>
                <option value="vtol">vtol</option>
                <option value="one-way-attack">one-way attack</option>
                <option value="fpv">fpv</option>
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Num
              label="Cruise (m/s)"
              value={uas.cruiseSpeedMps}
              onChange={(n) => patch({ uas: { ...uas, cruiseSpeedMps: n } })}
            />
            <Num
              label="Max (m/s)"
              value={uas.maxSpeedMps}
              onChange={(n) => patch({ uas: { ...uas, maxSpeedMps: n } })}
            />
          </div>
          <div className="field-row">
            <Num
              label="Endurance (min)"
              value={uas.enduranceMin}
              onChange={(n) => patch({ uas: { ...uas, enduranceMin: n } })}
            />
            <Field label="Nav mode">
              <select
                value={uas.navMode}
                onChange={(e) => patch({ uas: { ...uas, navMode: e.target.value as typeof uas.navMode } })}
              >
                <option value="gps">gps</option>
                <option value="inertial">inertial</option>
                <option value="rf-manual">rf manual</option>
                <option value="optical">optical</option>
                <option value="mixed">mixed</option>
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Num
              label="Alt floor (ft)"
              value={uas.altBandFt[0]}
              step={100}
              onChange={(n) => patch({ uas: { ...uas, altBandFt: [n, uas.altBandFt[1]] } })}
            />
            <Num
              label="Alt ceiling (ft)"
              value={uas.altBandFt[1]}
              step={100}
              onChange={(n) => patch({ uas: { ...uas, altBandFt: [uas.altBandFt[0], n] } })}
            />
          </div>
          <div className="field-row">
            <Num
              label="Control link (m, 0 = autonomous)"
              value={uas.controlLinkRangeM ?? 0}
              step={500}
              onChange={(n) => patch({ uas: { ...uas, controlLinkRangeM: n > 0 ? n : null } })}
            />
            <Num
              label="Mission radius (m)"
              value={uas.operatingRadiusM ?? 0}
              step={1000}
              onChange={(n) => patch({ uas: { ...uas, operatingRadiusM: n > 0 ? n : null } })}
            />
          </div>
          <div className="field-row">
            <Num
              label="Combat radius (m, 0 = unknown)"
              value={uas.combatRadiusM ?? 0}
              step={1000}
              onChange={(n) => patch({ uas: { ...uas, combatRadiusM: n > 0 ? n : null } })}
            />
            <Field label="Employment">
              <select
                value={uas.oneWay == null ? '' : uas.oneWay ? 'one-way' : 'rth'}
                onChange={(e) =>
                  patch({
                    uas: {
                      ...uas,
                      oneWay: e.target.value === '' ? undefined : e.target.value === 'one-way',
                    },
                  })
                }
              >
                <option value="">by airframe</option>
                <option value="one-way">one-way</option>
                <option value="rth">return-to-home</option>
              </select>
            </Field>
          </div>
          <Field label="Range note (observed mods)">
            <input
              value={uas.rangeNote ?? ''}
              onChange={(e) => patch({ uas: { ...uas, rangeNote: e.target.value } })}
            />
          </Field>
          <Field label="Emissions">
            <input
              value={uas.emissionsNote}
              onChange={(e) => patch({ uas: { ...uas, emissionsNote: e.target.value } })}
            />
          </Field>
        </div>
      )}

      {tp && (
        <div className="subsection">
          <div className="panel-subtitle">Threat profile</div>
          <Field label="Designator">
            <input
              value={tp.designator}
              onChange={(e) => patch({ threatProfile: { ...tp, designator: e.target.value } })}
            />
          </Field>
          <Field label="Route intent">
            <input
              value={tp.routeIntent}
              onChange={(e) => patch({ threatProfile: { ...tp, routeIntent: e.target.value } })}
            />
          </Field>
          <div className="field-row">
            <Num
              label="Altitude (ft)"
              value={tp.altitudeFt}
              step={100}
              onChange={(n) => patch({ threatProfile: { ...tp, altitudeFt: n } })}
            />
            <Num
              label="Speed (m/s)"
              value={tp.speedMps}
              onChange={(n) => patch({ threatProfile: { ...tp, speedMps: n } })}
            />
          </div>
          <Num
            label="Count"
            value={tp.count}
            onChange={(n) => patch({ threatProfile: { ...tp, count: Math.max(1, n) } })}
          />
        </div>
      )}

      <div className="inspector-actions">
        <button onClick={() => select({ libraryId: duplicateModel(model.id) })}>Duplicate</button>
        <button
          className="danger"
          onClick={() => {
            deleteModel(model.id)
            select({ libraryId: null })
          }}
        >
          Delete model
        </button>
      </div>
    </div>
  )
}

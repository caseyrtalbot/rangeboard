import { useState } from 'react'
import type { SensorRole, SpecModel, UasSpec } from '../model/types'
import { JAM_BAND_LABEL, JAM_BANDS, SENSOR_ROLE_DEFAULT_RANGE_M } from '../model/types'
import { jammerBands } from '../analysis/ewPhysics'
import { useStore } from '../state/store'
import { formatDistance } from '../geometry/geo'
import { EmptyState, ObjectHeader, Section } from './inspector/kit'

const SENSOR_ROLES: SensorRole[] = [
  'early-warning',
  'surveillance',
  'target-acquisition',
  'tracking',
  'fire-control',
  'classification',
]

/** Standard sector widths used across the seed library, degrees. */
const STANDARD_SECTORS = [60, 90, 120, 180, 270, 360]

/** Designator airframe codes following the seed THR-G<group>-<code>-<seq> pattern. */
const AIRFRAME_CODE: Record<UasSpec['airframe'], string> = {
  quad: 'Q',
  'fixed-wing': 'FW',
  vtol: 'V',
  'one-way-attack': 'OWA',
  fpv: 'FPV',
}

/**
 * Next free designator in the seed pattern for this model's group and
 * airframe. The sequence climbs past designators taken by other models, so
 * THREAT_TACTICS designator pairing stays intact.
 */
function autoDesignator(model: SpecModel, library: SpecModel[]): string {
  const group = model.uas?.group ?? 1
  const code = AIRFRAME_CODE[model.uas?.airframe ?? 'quad']
  const taken = new Set(
    library
      .filter((m) => m.id !== model.id)
      .map((m) => m.threatProfile?.designator)
      .filter(Boolean),
  )
  let seq = 1
  let candidate = `THR-G${group}-${code}-${String(seq).padStart(2, '0')}`
  while (taken.has(candidate)) {
    seq += 1
    candidate = `THR-G${group}-${code}-${String(seq).padStart(2, '0')}`
  }
  return candidate
}

/** Datalist options for a plain input. Suggestions only; typing stays free. */
function Options({ id, values }: { id: string; values: Array<string | number> }) {
  return (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  )
}

/** Sector select over the standard widths, with the stored value kept and a custom escape. */
function SectorField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [custom, setCustom] = useState(false)
  const options = STANDARD_SECTORS.includes(value)
    ? STANDARD_SECTORS
    : [value, ...STANDARD_SECTORS]
  return (
    <Field label="Sector (deg, 360 = omni)">
      <select
        value={custom ? 'custom' : String(value)}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            setCustom(true)
          } else {
            setCustom(false)
            onChange(Number(e.target.value))
          }
        }}
      >
        {options.map((s) => (
          <option key={s} value={String(s)}>
            {s}
          </option>
        ))}
        <option value="custom">custom…</option>
      </select>
      {custom && (
        <input
          type="number"
          min={5}
          max={360}
          step={5}
          value={value}
          onChange={(e) => onChange(Math.min(360, Math.max(5, Number(e.target.value))))}
        />
      )}
    </Field>
  )
}

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
  min,
  max,
  list,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  max?: number
  list?: string
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        list={list}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  )
}

/** Right-panel editor for the selected library model. All capability fields are editable. */
export function LibraryEditor() {
  const scenario = useStore((s) => s.scenario)
  const units = useStore((s) => s.ui.units)
  const libraryId = useStore((s) => s.selection.libraryId)
  const { updateModel, duplicateModel, deleteModel, select } = useStore.getState()

  const model = scenario.library.find((m) => m.id === libraryId)
  if (!model) {
    return (
      <div className="inspector-body insp">
        <Section label="Model">
          <EmptyState
            title="No model selected"
            body="Select a model in the library panel, or create one with the + buttons to edit its recorded specification."
          />
        </Section>
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
      <ObjectHeader
        name={model.name || 'Unnamed model'}
        type={`${model.kind} model · ${model.builtin ? 'seed' : 'custom'}`}
      />
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
                  {r} (default {formatDistance(SENSOR_ROLE_DEFAULT_RANGE_M[r], units)})
                </option>
              ))}
            </select>
          </Field>
          <Num
            label="Detect range (m)"
            value={sensor.detectRangeM}
            step={100}
            list="detect-range-options"
            onChange={(n) => patch({ sensor: { ...sensor, detectRangeM: n } })}
          />
          <Options
            id="detect-range-options"
            values={[...new Set(Object.values(SENSOR_ROLE_DEFAULT_RANGE_M))]}
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
          <SectorField
            value={sensor.sectorDeg}
            onChange={(n) => patch({ sensor: { ...sensor, sectorDeg: Math.min(360, Math.max(5, n)) } })}
          />
          <div className="field-row">
            <Num
              label="Elev min (deg)"
              value={sensor.elevationDeg?.[0] ?? 0}
              min={-10}
              max={90}
              onChange={(n) =>
                patch({ sensor: { ...sensor, elevationDeg: [n, sensor.elevationDeg?.[1] ?? 90] } })
              }
            />
            <Num
              label="Elev max (deg)"
              value={sensor.elevationDeg?.[1] ?? 90}
              min={0}
              max={90}
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
          <p className="muted small">
            Recorded, not modeled: the elevation limits and the altitude ceiling. The board is
            plan view, so they do not gate detection. Keep them as spec data.
          </p>
          <Num
            label="Track split distance (m, 0 = always splits)"
            value={sensor.resolutionM ?? 0}
            step={10}
            onChange={(n) => patch({ sensor: { ...sensor, resolutionM: n > 0 ? n : null } })}
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
          <SectorField
            value={effector.sectorDeg ?? 360}
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
          <p className="muted small">
            Recorded, not modeled: the altitude ceiling. The board is plan view, so it does not
            gate an engagement. Keep it as spec data.
          </p>
          {effector.effectorType === 'jammer' && (
            <>
              <div className="panel-subtitle">Jam physics</div>
              <Field label="Transmit bands">
                <div className="field-row" style={{ flexWrap: 'wrap' }}>
                  {JAM_BANDS.map((b) => {
                    const bands = jammerBands(effector)
                    const on = bands.includes(b)
                    return (
                      <label key={b} className="small" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...bands, b]
                              : bands.filter((x) => x !== b)
                            // An empty band set would read back as "every band"
                            // (the legacy default), so the last band stays on.
                            if (next.length === 0) return
                            patch({ effector: { ...effector, jamBands: next } })
                          }}
                        />
                        {JAM_BAND_LABEL[b]}
                      </label>
                    )
                  })}
                </div>
              </Field>
              <div className="field-row">
                <Num
                  label="EIRP (W, 0 = rated)"
                  value={effector.eirpW ?? 0}
                  step={10}
                  min={0}
                  onChange={(n) => patch({ effector: { ...effector, eirpW: n > 0 ? n : undefined } })}
                />
                <Num
                  label="Rated EIRP (W)"
                  value={effector.ratedEirpW ?? 0}
                  step={10}
                  min={0}
                  onChange={(n) =>
                    patch({ effector: { ...effector, ratedEirpW: n > 0 ? n : undefined } })
                  }
                />
              </div>
              <p className="muted small">
                A jam only holds when the physics close: the target must fly a covered band, sit
                inside the cone, and be within the power-scaled effective range. Max range is the
                placard range at rated EIRP; a lower EIRP shrinks the reach by the square root of
                the power ratio.
              </p>
            </>
          )}
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
                <option value="fiber">fiber (jam-immune)</option>
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
          <p className="muted small">
            Recorded, not modeled: the altitude band. The board is plan view, so the band does
            not change detection, engagement, or any analysis. Keep it as spec data.
          </p>
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
              list="emissions-options"
              value={uas.emissionsNote}
              onChange={(e) => patch({ uas: { ...uas, emissionsNote: e.target.value } })}
            />
          </Field>
          <Options
            id="emissions-options"
            values={[
              ...new Set(
                scenario.library.map((m) => m.uas?.emissionsNote ?? '').filter(Boolean),
              ),
            ]}
          />
        </div>
      )}

      {tp && (
        <div className="subsection">
          <div className="panel-subtitle">Threat profile</div>
          <Field label="Designator">
            <input
              list="designator-options"
              value={tp.designator}
              onChange={(e) => patch({ threatProfile: { ...tp, designator: e.target.value } })}
            />
          </Field>
          <Options
            id="designator-options"
            values={[
              ...new Set(
                scenario.library.map((m) => m.threatProfile?.designator ?? '').filter(Boolean),
              ),
            ]}
          />
          <button
            className="mini"
            title="Generate the next free THR-G<group>-<code>-<seq> designator"
            onClick={() =>
              patch({ threatProfile: { ...tp, designator: autoDesignator(model, scenario.library) } })
            }
          >
            Auto
          </button>
          <Field label="Route intent">
            <input
              list="route-intent-options"
              value={tp.routeIntent}
              onChange={(e) => patch({ threatProfile: { ...tp, routeIntent: e.target.value } })}
            />
          </Field>
          <Options
            id="route-intent-options"
            values={[
              ...new Set(
                scenario.library.map((m) => m.threatProfile?.routeIntent ?? '').filter(Boolean),
              ),
            ]}
          />
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
          {uas && tp.speedMps !== uas.cruiseSpeedMps && (
            <button
              className="mini"
              onClick={() => patch({ threatProfile: { ...tp, speedMps: uas.cruiseSpeedMps } })}
            >
              Use cruise speed ({uas.cruiseSpeedMps} m/s)
            </button>
          )}
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

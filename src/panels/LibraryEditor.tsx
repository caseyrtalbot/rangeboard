import { useState } from 'react'
import type {
  EoBand,
  IrSignature,
  RangeBasis,
  SensorRole,
  SpecModel,
  SwerlingCase,
  UasSpec,
} from '../model/types'
import {
  basisFor,
  JAM_BAND_LABEL,
  JAM_BANDS,
  MOUNT_HEIGHT_M,
  PLACARD_PD,
  PLACARD_PFA,
  SENSOR_ROLE_DEFAULT_RANGE_M,
} from '../model/types'
import { jammerBands } from '../analysis/ewPhysics'
import { rfSensorBands } from '../analysis/sensorEnv'
import { RADAR_REF_RCS_M2, RCS_PLANNING_M2 } from '../model/rcsFactors'
import {
  ACOUSTIC_PLANNING_DB,
  ACOUSTIC_REF_DB,
  EO_REF_SPAN_M,
  IR_SIGNATURE_FACTOR,
  SPAN_PLANNING_M,
} from '../model/signatureFactors'
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

/** False-alarm probabilities a radar datasheet quotes a placard range at. */
const PFA_CHOICES = ['1e-4', '1e-5', '1e-6', '1e-7', '1e-8']

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

/**
 * Height above ground of a sensor phase centre or an effector launcher, with
 * the basis of the value in use: a provenance row, else the planning factor.
 * An empty field keeps the planning factor.
 */
function MountHeight({
  model,
  heightM,
  onChange,
  note,
}: {
  model: SpecModel
  heightM: number | null | undefined
  onChange: (m: number | null) => void
  note: string
}) {
  const basis = heightM == null ? 'pf' : basisFor(model, 'mountHeightM')
  return (
    <>
      <Field label="Mount height (m, empty = planning factor)">
        <input
          type="number"
          min={0}
          step={0.5}
          placeholder={String(MOUNT_HEIGHT_M)}
          value={heightM ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
        />
      </Field>
      <p className="muted small">
        {note} In use: {heightM ?? MOUNT_HEIGHT_M} m ({basis === 'pf' ? 'PF' : basis}).
      </p>
    </>
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
            min={0}
            list="detect-range-options"
            onChange={(n) => patch({ sensor: { ...sensor, detectRangeM: Math.max(0, n) } })}
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
            min={0}
            onChange={(n) => patch({ sensor: { ...sensor, classifyRangeM: n > 0 ? n : null } })}
          />
          <Field label="Range basis">
            <select
              value={sensor.rangeBasis ?? 'sourced'}
              onChange={(e) =>
                patch({ sensor: { ...sensor, rangeBasis: e.target.value as RangeBasis } })
              }
            >
              <option value="sourced">sourced figure, target-scaled</option>
              <option value="planning">planning figure, not target-scaled</option>
            </select>
          </Field>
          <p className="muted small">
            A sourced range is quoted against a reference target and scales to the threat on the
            board. A planning figure names no target, so no physics runs on it: every threat gets
            the same ring.
          </p>
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
            The geometry gate reads the elevation limits and the altitude ceiling. A threat
            outside either one is not detected. A ceiling of 0 records none.
          </p>
          <MountHeight
            model={model}
            heightM={sensor.mountHeightM}
            onChange={(m) => patch({ sensor: { ...sensor, mountHeightM: m } })}
            note="Height of the antenna phase centre above ground. The engine measures the slant range and the radio horizon from it."
          />
          <Num
            label="Track split distance (m, 0 = always splits)"
            value={sensor.resolutionM ?? 0}
            step={10}
            onChange={(n) => patch({ sensor: { ...sensor, resolutionM: n > 0 ? n : null } })}
          />
          <Num
            label="Maximum reported range (m, 0 = no cap)"
            value={sensor.instrumentedRangeM ?? 0}
            step={1000}
            min={0}
            onChange={(n) =>
              patch({ sensor: { ...sensor, instrumentedRangeM: n > 0 ? n : null } })
            }
          />
          <p className="muted small">
            A radar's instrumented range, or the top of a vendor's stated detection band. The
            target-scaled range never exceeds it.
          </p>
          {sensor.sensorType === 'radar' && (
            <>
              <Num
                label={`Reference RCS (m², 0 = ${RADAR_REF_RCS_M2})`}
                value={sensor.refRcsM2 ?? 0}
                step={0.01}
                min={0}
                onChange={(n) => patch({ sensor: { ...sensor, refRcsM2: n > 0 ? n : null } })}
              />
              <p className="muted small">
                The detect range is quoted against the reference RCS. Against another threat the
                range scales with the fourth root of the RCS ratio, then stops at the maximum
                reported range. The board ring shows the reference-RCS range; select a threat to
                see each radar's ring against that threat.
              </p>
              <div className="field-row">
                <Num
                  label={`Placard Pd (0 = planning factor ${PLACARD_PD})`}
                  value={sensor.placardPd ?? 0}
                  step={0.05}
                  min={0}
                  max={0.99}
                  onChange={(n) =>
                    patch({ sensor: { ...sensor, placardPd: n > 0 ? Math.min(0.99, n) : null } })
                  }
                />
                <Field label="Placard Pfa">
                  <select
                    value={sensor.pfa == null ? '' : sensor.pfa.toExponential(0).replace('+', '')}
                    onChange={(e) =>
                      patch({
                        sensor: {
                          ...sensor,
                          pfa: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  >
                    <option value="">{`planning factor ${PLACARD_PFA.toExponential(0)}`}</option>
                    {PFA_CHOICES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="muted small">
                The placard range is quoted at this Pd and Pfa against the reference RCS.
                Detection at another range follows the radar range equation and the threat's
                Swerling case. Empty fields keep the planning factors.
              </p>
            </>
          )}
          {sensor.sensorType === 'eo-ir' && (
            <>
              <div className="field-row">
                <Field label="Band">
                  <select
                    value={sensor.eoBand ?? 'dual'}
                    onChange={(e) =>
                      patch({ sensor: { ...sensor, eoBand: e.target.value as EoBand } })
                    }
                  >
                    <option value="dual">dual (visible by day, thermal at night)</option>
                    <option value="visible">visible only</option>
                    <option value="thermal">thermal only</option>
                  </select>
                </Field>
                <Num
                  label={`Reference span (m, 0 = ${EO_REF_SPAN_M})`}
                  value={sensor.refSpanM ?? 0}
                  step={0.1}
                  min={0}
                  onChange={(n) => patch({ sensor: { ...sensor, refSpanM: n > 0 ? n : null } })}
                />
              </div>
              <p className="muted small">
                The detect range is quoted against a target of the reference span. Against another
                threat the range scales linearly with the span ratio (Johnson criteria), times the
                thermal contrast class when the thermal channel carries, and stops at the
                meteorological visibility. A visible-only sensor keeps 20 percent of its range at
                night.
              </p>
            </>
          )}
          {sensor.sensorType === 'acoustic' && (
            <>
              <Num
                label={`Reference source level (dB at 1 m, 0 = ${ACOUSTIC_REF_DB})`}
                value={sensor.refAcousticDb ?? 0}
                step={1}
                min={0}
                onChange={(n) =>
                  patch({ sensor: { ...sensor, refAcousticDb: n > 0 ? n : null } })
                }
              />
              <p className="muted small">
                The detect range is quoted against a source of the reference level. A louder threat
                is heard farther by spherical spreading plus atmospheric absorption; wind and urban
                noise then multiply on top.
              </p>
            </>
          )}
          {sensor.sensorType === 'rf' && (
            <>
              <Field label="Receive bands">
                <div className="field-row" style={{ flexWrap: 'wrap' }}>
                  {JAM_BANDS.map((b) => {
                    const bands = rfSensorBands(sensor)
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
                            patch({ sensor: { ...sensor, rfBands: next } })
                          }}
                        />
                        {JAM_BAND_LABEL[b]}
                      </label>
                    )
                  })}
                </div>
              </Field>
              <Num
                label="Urban range (m, 0 = generic urban factor)"
                value={sensor.urbanRangeM ?? 0}
                step={100}
                min={0}
                onChange={(n) => patch({ sensor: { ...sensor, urbanRangeM: n > 0 ? n : null } })}
              />
              <p className="muted small">
                A passive receiver hears a threat only when one of its emitting link bands is inside
                the receive bands (GNSS is received by the threat, never transmitted). A published
                urban range replaces the generic urban multiplier in an urban EM background.
              </p>
            </>
          )}
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
            The geometry gate reads the altitude ceiling. A threat above it has no engagement
            window. A ceiling of 0 records none.
          </p>
          <MountHeight
            model={model}
            heightM={effector.mountHeightM}
            onChange={(m) => patch({ effector: { ...effector, mountHeightM: m } })}
            note="Height of the launcher or the emitter above ground. The engine measures the slant range from it."
          />
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
          <Field label="Fluctuation model">
            <select
              value={uas.swerling == null ? '' : String(uas.swerling)}
              onChange={(e) =>
                patch({
                  uas: {
                    ...uas,
                    swerling:
                      e.target.value === '' ? null : (Number(e.target.value) as SwerlingCase),
                  },
                })
              }
            >
              <option value="">by airframe, planning factor (multirotor Swerling 1, fixed wing Swerling 3)</option>
              <option value="0">Swerling 0 (steady)</option>
              <option value="1">Swerling 1</option>
              <option value="3">Swerling 3</option>
            </select>
          </Field>
          <Num
            label="Radar cross section (m², 0 = group planning factor)"
            value={uas.rcsM2 ?? 0}
            step={0.01}
            min={0}
            onChange={(n) => patch({ uas: { ...uas, rcsM2: n > 0 ? n : null } })}
          />
          <p className="muted small">
            Planning factor, not signature data. Group tier when 0:{' '}
            {([1, 2, 3, 4, 5] as const).map((g) => `G${g} ${RCS_PLANNING_M2[g]}`).join(', ')} m².
            Each radar sees this threat at its quoted range times the fourth root of (this RCS /
            the radar's reference RCS).
          </p>
          <div className="field-row">
            <Num
              label="Span (m, 0 = group planning factor)"
              value={uas.spanM ?? 0}
              step={0.1}
              min={0}
              onChange={(n) => patch({ uas: { ...uas, spanM: n > 0 ? n : null } })}
            />
            <Num
              label="Acoustic level (dB at 1 m, 0 = group PF)"
              value={uas.acousticDb ?? 0}
              step={1}
              min={0}
              onChange={(n) => patch({ uas: { ...uas, acousticDb: n > 0 ? n : null } })}
            />
          </div>
          <Field label="IR signature">
            <select
              value={uas.irSignature ?? ''}
              onChange={(e) =>
                patch({
                  uas: {
                    ...uas,
                    irSignature: (e.target.value || undefined) as IrSignature | undefined,
                  },
                })
              }
            >
              <option value="">by airframe (electric low, engine high)</option>
              {(['low', 'medium', 'high'] as const).map((k) => (
                <option key={k} value={k}>
                  {k} (x{IR_SIGNATURE_FACTOR[k]})
                </option>
              ))}
            </select>
          </Field>
          <p className="muted small">
            Planning factors. Span tier when 0:{' '}
            {([1, 2, 3, 4, 5] as const).map((g) => `G${g} ${SPAN_PLANNING_M[g]}`).join(', ')} m
            (wingspan, or motor-to-motor diagonal); EO/IR range scales linearly with the span
            ratio. Acoustic tier when 0:{' '}
            {([1, 2, 3, 4, 5] as const).map((g) => `G${g} ${ACOUSTIC_PLANNING_DB[g]}`).join(', ')}{' '}
            dB; acoustic range follows spreading plus absorption against the sensor's reference
            level. The IR class multiplies thermal-channel range.
          </p>
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
            The middle of this band is the flight altitude of a placed threat when neither the
            entity nor the threat profile states one. Altitude sets the slant range and the
            geometry gates.
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

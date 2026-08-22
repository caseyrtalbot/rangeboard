import type { Boundary, BoundaryType, Entity, FormationShape } from '../model/types'
import { entityActive } from '../model/types'
import { SEED_FORMATIONS } from '../model/seed'
import { useStore, modelFor } from '../state/store'
import { formatDistance, pathLength } from '../geometry/geo'
import { effectiveRadiusM, rangeBasis } from '../analysis/range'
import { effectiveDetectRangeM, sensorEnvFactor } from '../analysis/sensorEnv'
import { effectivePathDelayS, waveIndexFor } from '../playback/raid'

const FORMATION_SHAPES: FormationShape[] = ['line', 'wedge', 'column', 'echelon', 'cluster']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function EntityInspector({ entity }: { entity: Entity }) {
  const scenario = useStore((s) => s.scenario)
  const {
    updateEntity,
    deleteSelection,
    setTool,
    beginPath,
    updatePath,
    deletePathForEntity,
    selectSystem,
    assignToWave,
  } = useStore.getState()
  const model = modelFor(scenario, entity)
  const sameKindModels = scenario.library.filter((m) => m.kind === entity.kind)
  const path = scenario.paths.find((p) => p.entityId === entity.id)
  const blue = entity.kind === 'sensor' || entity.kind === 'effector' || entity.kind === 'c2'
  const formation = entity.formation

  return (
    <div className="inspector-body">
      <div className="panel-subtitle">
        {entity.kind.toUpperCase()} · {model?.name ?? 'no model'}
      </div>
      <Field label="Name">
        <input value={entity.name} onChange={(e) => updateEntity(entity.id, { name: e.target.value })} />
      </Field>
      <Field label="Model">
        <select
          value={entity.specId ?? ''}
          onChange={(e) => updateEntity(entity.id, { specId: e.target.value || null })}
        >
          <option value="">none</option>
          {sameKindModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="field-row">
        <Field label="East (km)">
          <input
            type="number"
            step={0.1}
            value={(entity.pos.x / 1000).toFixed(2)}
            onChange={(e) =>
              updateEntity(entity.id, { pos: { ...entity.pos, x: Number(e.target.value) * 1000 } })
            }
          />
        </Field>
        <Field label="North (km)">
          <input
            type="number"
            step={0.1}
            value={(-entity.pos.y / 1000).toFixed(2)}
            onChange={(e) =>
              updateEntity(entity.id, { pos: { ...entity.pos, y: -Number(e.target.value) * 1000 } })
            }
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label={`Heading ${Math.round(entity.headingDeg)} deg`}>
          <input
            type="range"
            min={0}
            max={359}
            value={entity.headingDeg}
            onChange={(e) => updateEntity(entity.id, { headingDeg: Number(e.target.value) })}
          />
        </Field>
        <Field label="deg">
          <input
            type="number"
            min={0}
            max={359}
            value={Math.round(entity.headingDeg)}
            onChange={(e) =>
              updateEntity(entity.id, { headingDeg: ((Number(e.target.value) % 360) + 360) % 360 })
            }
          />
        </Field>
      </div>
      {blue && (
        <Field label="Enabled in analysis">
          <input
            type="checkbox"
            checked={entityActive(entity)}
            onChange={(e) => updateEntity(entity.id, { enabled: e.target.checked })}
          />
        </Field>
      )}
      {entity.systemId && (
        <div className="spec-summary">
          System component{entity.notes ? `: ${entity.notes}` : ''}
          <button className="mini" onClick={() => selectSystem(entity.systemId!)}>
            Select system
          </button>
        </div>
      )}
      <Field label="Notes">
        <textarea
          rows={3}
          value={entity.notes}
          onChange={(e) => updateEntity(entity.id, { notes: e.target.value })}
        />
      </Field>

      {model?.sensor && (
        <div className="spec-summary">
          {model.sensor.role ? `${model.sensor.role} · ` : ''}
          Detect {formatDistance(model.sensor.detectRangeM)} · sector {model.sensor.sectorDeg} deg
          {model.sensor.classifyRangeM ? ` · classify ${formatDistance(model.sensor.classifyRangeM)}` : ''}
          {model.sensor.elevationDeg
            ? ` · elev ${model.sensor.elevationDeg[0]} to ${model.sensor.elevationDeg[1]} deg`
            : ''}
          {model.sensor.maxAltitudeFt ? ` · to ${model.sensor.maxAltitudeFt} ft` : ''}
          {sensorEnvFactor(model.sensor.sensorType, scenario.environment) < 1 && (
            <>
              <br />
              In this environment: detect{' '}
              {formatDistance(effectiveDetectRangeM(model.sensor, scenario.environment))}
            </>
          )}
        </div>
      )}
      {model?.effector && (
        <div className="spec-summary">
          WEZ {formatDistance(model.effector.minRangeM)} – {formatDistance(model.effector.maxRangeM)} ·
          engage {model.effector.engageTimeS} s
          {(model.effector.sectorDeg ?? 360) < 360 ? ` · sector ${model.effector.sectorDeg} deg` : ''}
          {model.effector.maxAltitudeFt ? ` · to ${model.effector.maxAltitudeFt} ft` : ''}
        </div>
      )}
      {model?.uas && (
        <div className="spec-summary">
          Group {model.uas.group} · cruise {model.uas.cruiseSpeedMps} m/s · {model.uas.navMode}
        </div>
      )}

      {entity.kind === 'uas' && model?.uas && (
        <div className="subsection">
          <div className="panel-subtitle">Range</div>
          <Field label="Show range ring">
            <input
              type="checkbox"
              checked={!!entity.showRange}
              onChange={(e) => updateEntity(entity.id, { showRange: e.target.checked })}
            />
          </Field>
          {(() => {
            const uas = model.uas!
            const env = scenario.environment
            const basis = rangeBasis(uas)
            const windTo = (env.windFromDeg + 180) % 360
            const down = effectiveRadiusM(uas, env, windTo)
            const up = effectiveRadiusM(uas, env, env.windFromDeg)
            return (
              <>
                <div className="spec-summary">
                  Basis: {basis.source} · {formatDistance(basis.radiusM)} calm ·{' '}
                  {basis.oneWay ? 'one-way' : 'return-to-home'}
                  <br />
                  With environment: {formatDistance(down)} downwind · {formatDistance(up)} upwind
                </div>
                {basis.source === 'estimated' && (
                  <p className="muted small">
                    No reported employment radius. This is an estimate from endurance and cruise
                    speed. Enter a known radius in the model editor to replace it.
                  </p>
                )}
                {uas.rangeNote && <p className="muted small">{uas.rangeNote}</p>}
              </>
            )
          })()}
        </div>
      )}

      {entity.kind === 'uas' && (
        <div className="subsection">
          <div className="panel-subtitle">Formation / swarm</div>
          <Field label="Known construct">
            <select
              value=""
              onChange={(e) => {
                const c = SEED_FORMATIONS.find((f) => f.name === e.target.value)
                if (c) updateEntity(entity.id, { formation: { ...c.formation } })
              }}
            >
              <option value="">apply a reported construct…</option>
              {SEED_FORMATIONS.map((f) => (
                <option key={f.name} value={f.name} title={f.description}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fly as formation">
            <input
              type="checkbox"
              checked={!!formation}
              onChange={(e) =>
                updateEntity(entity.id, {
                  formation: e.target.checked ? { count: 3, shape: 'wedge', spacingM: 50 } : null,
                })
              }
            />
          </Field>
          {formation && (
            <>
              <div className="field-row">
                <Field label="Ships">
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={formation.count}
                    onChange={(e) =>
                      updateEntity(entity.id, {
                        formation: { ...formation, count: Math.max(2, Number(e.target.value)) },
                      })
                    }
                  />
                </Field>
                <Field label="Spacing (m)">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={formation.spacingM}
                    onChange={(e) =>
                      updateEntity(entity.id, {
                        formation: { ...formation, spacingM: Math.max(5, Number(e.target.value)) },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Shape">
                <select
                  value={formation.shape}
                  onChange={(e) =>
                    updateEntity(entity.id, {
                      formation: { ...formation, shape: e.target.value as FormationShape },
                    })
                  }
                >
                  {FORMATION_SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>
      )}

      {entity.kind === 'uas' && (
        <div className="subsection">
          <div className="panel-subtitle">Flight path</div>
          {path ? (
            <>
              <div className="spec-summary">
                {path.points.length} waypoints · {formatDistance(pathLength(path.points))}
              </div>
              <div className="field-row">
                <Field label="Speed (m/s)">
                  <input
                    type="number"
                    placeholder={String(model?.uas?.cruiseSpeedMps ?? 15)}
                    value={path.speedMps ?? ''}
                    onChange={(e) =>
                      updatePath(path.id, {
                        speedMps: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Start delay (s)">
                  <input
                    type="number"
                    min={0}
                    value={path.startDelayS}
                    onChange={(e) => updatePath(path.id, { startDelayS: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <button onClick={() => deletePathForEntity(entity.id)}>Delete path</button>
            </>
          ) : (
            <button onClick={() => beginPath(entity.id)}>Draw flight path</button>
          )}
        </div>
      )}

      {entity.kind === 'uas' && (
        <div className="subsection">
          <div className="panel-subtitle">Raid wave</div>
          {(() => {
            const waves = scenario.raid?.waves ?? []
            const waveIndex = waveIndexFor(scenario.raid, entity.id)
            return (
              <>
                <Field label="Wave">
                  <select
                    value={waveIndex ?? ''}
                    onChange={(e) =>
                      assignToWave(entity.id, e.target.value === '' ? null : Number(e.target.value))
                    }
                  >
                    <option value="">none</option>
                    {waves.map((w, i) => (
                      <option key={i} value={i}>
                        Wave {i + 1} (T+{w.startDelayS} s)
                      </option>
                    ))}
                    <option value={waves.length}>new wave</option>
                  </select>
                </Field>
                {path && waveIndex != null && (
                  <div className="spec-summary">
                    Effective start delay: {effectivePathDelayS(scenario, path)} s (path{' '}
                    {path.startDelayS} s + wave {waves[waveIndex].startDelayS} s)
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      <div className="inspector-actions">
        <button onClick={() => setTool('connect')}>Connect from here</button>
        <button className="danger" onClick={deleteSelection}>
          Delete
        </button>
      </div>
    </div>
  )
}

function BoundaryInspector({ boundary }: { boundary: Boundary }) {
  const { updateBoundary, deleteSelection } = useStore.getState()
  return (
    <div className="inspector-body">
      <div className="panel-subtitle">BOUNDARY</div>
      <Field label="Name">
        <input
          value={boundary.name}
          onChange={(e) => updateBoundary(boundary.id, { name: e.target.value })}
        />
      </Field>
      <Field label="Type">
        <select
          value={boundary.type}
          onChange={(e) => updateBoundary(boundary.id, { type: e.target.value as BoundaryType })}
        >
          <option value="range">range</option>
          <option value="restricted">restricted</option>
          <option value="asset">asset</option>
          <option value="corridor">corridor</option>
        </select>
      </Field>
      <div className="field-row">
        <Field label="Floor (ft)">
          <input
            type="number"
            value={boundary.altBandFt?.[0] ?? ''}
            onChange={(e) =>
              updateBoundary(boundary.id, {
                altBandFt: [Number(e.target.value), boundary.altBandFt?.[1] ?? 0],
              })
            }
          />
        </Field>
        <Field label="Ceiling (ft)">
          <input
            type="number"
            value={boundary.altBandFt?.[1] ?? ''}
            onChange={(e) =>
              updateBoundary(boundary.id, {
                altBandFt: [boundary.altBandFt?.[0] ?? 0, Number(e.target.value)],
              })
            }
          />
        </Field>
      </div>
      <div className="spec-summary">{boundary.points.length} vertices</div>
      <button className="danger" onClick={deleteSelection}>
        Delete
      </button>
    </div>
  )
}

export function Inspector() {
  const scenario = useStore((s) => s.scenario)
  const selection = useStore((s) => s.selection)

  const entity =
    selection.entityIds.length === 1
      ? scenario.entities.find((e) => e.id === selection.entityIds[0])
      : undefined
  const boundary = selection.boundaryId
    ? scenario.boundaries.find((b) => b.id === selection.boundaryId)
    : undefined
  const connection = selection.connectionId
    ? scenario.connections.find((c) => c.id === selection.connectionId)
    : undefined

  if (entity) return <EntityInspector entity={entity} />
  if (boundary) return <BoundaryInspector boundary={boundary} />
  if (connection) {
    const { updateConnection, deleteSelection } = useStore.getState()
    const from = scenario.entities.find((e) => e.id === connection.fromId)
    const to = scenario.entities.find((e) => e.id === connection.toId)
    return (
      <div className="inspector-body">
        <div className="panel-subtitle">CONNECTION</div>
        <div className="spec-summary">
          {from?.name ?? '?'} → {to?.name ?? '?'}
        </div>
        <Field label="Label">
          <input
            value={connection.label}
            onChange={(e) => updateConnection(connection.id, { label: e.target.value })}
          />
        </Field>
        <button className="danger" onClick={deleteSelection}>
          Delete
        </button>
      </div>
    )
  }
  if (selection.entityIds.length > 1) {
    const selected = scenario.entities.filter((e) => selection.entityIds.includes(e.id))
    const systemId = selected[0]?.systemId
    const wholeSystem = !!systemId && selected.every((e) => e.systemId === systemId)
    const rotateSystem = useStore.getState().rotateSystem
    return (
      <div className="inspector-body">
        <div className="panel-subtitle">{selection.entityIds.length} entities selected</div>
        {wholeSystem && (
          <div className="subsection">
            <div className="panel-subtitle">System orientation</div>
            <div className="spec-summary">
              Drag the amber handle on the canvas to face any direction, or slew in steps.
            </div>
            <div className="field-row">
              {[-90, -45, 45, 90].map((d) => (
                <button key={d} onClick={() => rotateSystem(systemId!, d)}>
                  {d > 0 ? `${d}°→` : `←${-d}°`}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="danger" onClick={useStore.getState().deleteSelection}>
          Delete all
        </button>
      </div>
    )
  }
  return (
    <div className="inspector-body muted">
      <p>Nothing selected.</p>
      <p>Drag a model from the library onto the canvas. Click an entity to edit it here.</p>
      <p>
        Scroll to zoom. Drag empty space to pan. Shift-click adds to the selection. Delete removes
        the selection.
      </p>
      <p>
        Cmd-drag (or Ctrl-drag) on empty space box-selects. Shift-drag adds a box to the current
        selection.
      </p>
    </div>
  )
}

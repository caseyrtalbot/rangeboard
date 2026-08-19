import type { Boundary, BoundaryType, Entity } from '../model/types'
import { useStore, modelFor } from '../state/store'
import { formatDistance, pathLength } from '../geometry/geo'

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
  const { updateEntity, deleteSelection, setTool, beginPath, updatePath, deletePathForEntity } =
    useStore.getState()
  const model = modelFor(scenario, entity)
  const sameKindModels = scenario.library.filter((m) => m.kind === entity.kind)
  const path = scenario.paths.find((p) => p.entityId === entity.id)

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
      <Field label={`Heading ${Math.round(entity.headingDeg)} deg`}>
        <input
          type="range"
          min={0}
          max={359}
          value={entity.headingDeg}
          onChange={(e) => updateEntity(entity.id, { headingDeg: Number(e.target.value) })}
        />
      </Field>
      <Field label="Notes">
        <textarea
          rows={3}
          value={entity.notes}
          onChange={(e) => updateEntity(entity.id, { notes: e.target.value })}
        />
      </Field>

      {model?.sensor && (
        <div className="spec-summary">
          Detect {formatDistance(model.sensor.detectRangeM)} · sector {model.sensor.sectorDeg} deg
          {model.sensor.classifyRangeM ? ` · classify ${formatDistance(model.sensor.classifyRangeM)}` : ''}
        </div>
      )}
      {model?.effector && (
        <div className="spec-summary">
          Envelope {formatDistance(model.effector.minRangeM)} – {formatDistance(model.effector.maxRangeM)} ·
          engage {model.effector.engageTimeS} s
        </div>
      )}
      {model?.uas && (
        <div className="spec-summary">
          Group {model.uas.group} · cruise {model.uas.cruiseSpeedMps} m/s · {model.uas.navMode}
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
    return (
      <div className="inspector-body">
        <div className="panel-subtitle">{selection.entityIds.length} entities selected</div>
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
    </div>
  )
}

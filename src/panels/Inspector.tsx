import { useState } from 'react'
import type { Boundary, BoundaryType, Entity, FlightPath, FormationShape } from '../model/types'
import { entityActive } from '../model/types'
import { SEED_FORMATIONS } from '../model/seed'
import { useStore, modelFor } from '../state/store'
import type { RaidDraft } from '../state/store'
import { formatDistance, formatSpeed, pathLength } from '../geometry/geo'
import { evaluateIntegration, integrationSummary } from '../model/integration'
import type { IntegrationConfidence } from '../model/integration'
import { effectiveRadiusM, rangeBasis } from '../analysis/range'
import { effectiveDetectRangeM, sensorEnvFactor } from '../analysis/sensorEnv'
import { effectivePathDelayS, waveIndexFor } from '../playback/raid'
import { DEFAULT_DEFENDED_RADIUS_M } from '../playback/sim'
import { THREAT_TACTICS } from '../playback/tactics'

const FORMATION_SHAPES: FormationShape[] = ['line', 'wedge', 'column', 'echelon', 'cluster']

/** Common C-UAS airspace names offered on the boundary Name field. Typing stays free. */
const BOUNDARY_NAME_SUGGESTIONS: Record<BoundaryType, string[]> = {
  range: ['Range boundary', 'Test range', 'Danger area', 'Land range fan'],
  restricted: ['ROZ', 'Restricted area', 'NFA', 'TFR'],
  asset: ['Defended asset area', 'Base boundary', 'Critical asset zone'],
  corridor: ['Ingress corridor', 'Air corridor', 'Transit corridor'],
}

/** Standard airspace band values from the seed library boundaries, feet. */
const BOUNDARY_ALT_SUGGESTIONS_FT = [0, 100, 400, 1200, 3000, 5000]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
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

/**
 * Spec values the library records but the engine never reads. The board is
 * plan view: no altitude, no slant range, so an elevation limit or an altitude
 * ceiling gates nothing. Printing them beside the modeled ranges reads as a
 * working constraint, so they get their own marked line instead.
 */
function NotModeled({ values }: { values: string[] }) {
  if (values.length === 0) return null
  return (
    <p className="muted small">
      Recorded, not modeled: {values.join(' · ')}. The board is plan view, so altitude gates no
      detection and no engagement.
    </p>
  )
}

/** Segmented control: one active option, no typing. */
function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? 'active' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Path speed picker for a model with known cruise and max speeds. */
function PathSpeedField({ path, cruise, max }: { path: FlightPath; cruise: number; max: number }) {
  const { updatePath } = useStore.getState()
  const [customDraft, setCustomDraft] = useState(false)
  const stored =
    path.speedMps == null
      ? 'cruise'
      : path.speedMps === max && max !== cruise
        ? 'max'
        : 'custom'
  const mode = customDraft ? 'custom' : stored
  return (
    <div className="field">
      <span>Speed (m/s)</span>
      <Seg
        value={mode}
        options={[
          { v: 'cruise', label: `Cruise ${cruise}` },
          { v: 'max', label: `Max ${max}` },
          { v: 'custom', label: 'Custom' },
        ]}
        onChange={(v) => {
          if (v === 'cruise') {
            setCustomDraft(false)
            updatePath(path.id, { speedMps: null })
          } else if (v === 'max') {
            setCustomDraft(false)
            updatePath(path.id, { speedMps: max })
          } else {
            setCustomDraft(true)
            updatePath(path.id, { speedMps: path.speedMps ?? cruise })
          }
        }}
      />
      {mode === 'custom' && (
        <input
          type="number"
          min={1}
          value={path.speedMps ?? ''}
          onChange={(e) => {
            setCustomDraft(true)
            updatePath(path.id, {
              speedMps: e.target.value === '' ? null : Number(e.target.value),
            })
          }}
        />
      )}
    </div>
  )
}

/**
 * Tactic raid builder, shown in place of the normal Inspector body while a
 * raid draft is armed. Commit happens on the next canvas click (sets the
 * ingress axis) or through "Use default axis".
 */
function RaidBuilderCard({ draft }: { draft: RaidDraft }) {
  const scenario = useStore((s) => s.scenario)
  const units = useStore((s) => s.ui.units)
  const { patchRaidDraft, commitRaid, cancelRaidDraft } = useStore.getState()
  const tactic = THREAT_TACTICS.find((t) => t.id === draft.tacticId)
  if (!tactic) return null

  const uasModels = scenario.library.filter((m) => m.kind === 'uas' && m.uas)
  const assets = scenario.entities.filter((e) => e.kind === 'asset')
  const platform = draft.platformSpecId
    ? scenario.library.find((m) => m.id === draft.platformSpecId)
    : undefined
  const target = draft.targetEntityId
    ? scenario.entities.find((e) => e.id === draft.targetEntityId)
    : undefined
  const shipCount = Math.max(1, Math.floor(draft.shipCount))
  const perWave = Math.max(1, Math.floor(tactic.shipsPerWave))
  const waveCount = Math.ceil(shipCount / perWave)
  const existingWaves = scenario.raid?.waves.length ?? 0
  const ready = !!platform?.uas && !!target

  return (
    <div className="inspector-body">
      <div className="panel-subtitle">THREAT TACTIC · {tactic.id}</div>
      <div className="spec-summary">
        {tactic.name}
        <br />
        Study {tactic.sourceRef}
      </div>
      <p className="muted small">{tactic.description}</p>
      <div className="spec-summary">
        {shipCount} {shipCount === 1 ? 'ship' : 'ships'} · {waveCount}{' '}
        {waveCount === 1 ? 'wave' : 'waves'} of up to {perWave}
        {waveCount > 1 ? ` · ${tactic.waveSpacingS} s between waves` : ''}
        <br />
        {tactic.axes} {tactic.axes === 1 ? 'ingress axis' : 'ingress axes'}
        {tactic.axes > 1 ? ` across ${tactic.axisSpreadDeg} deg` : ''} · standoff{' '}
        {formatDistance(tactic.standoffM, units)} or beyond every sensor detection ring
        {tactic.decoy && (
          <>
            <br />
            1 of every {tactic.decoy.everyNth} ships is a decoy.
          </>
        )}
        {existingWaves > 0 && (
          <>
            <br />
            New waves add alongside the {existingWaves} existing{' '}
            {existingWaves === 1 ? 'wave' : 'waves'}; delays restart at 0. Adjust wave delays in
            the timeline strip to sequence them.
          </>
        )}
      </div>

      <Field label="Platform">
        <select
          value={draft.platformSpecId ?? ''}
          onChange={(e) => patchRaidDraft({ platformSpecId: e.target.value || null })}
        >
          <option value="">choose a platform…</option>
          {uasModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      {!platform?.uas && (
        <p className="muted small">No platform matched in the library. Choose one to continue.</p>
      )}

      <Field label="Target asset">
        <select
          value={draft.targetEntityId ?? ''}
          onChange={(e) => patchRaidDraft({ targetEntityId: e.target.value || null })}
        >
          <option value="">choose a target…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      {assets.length === 0 && (
        <p className="muted small">No asset on the canvas. Place an asset entity as the target.</p>
      )}

      <Field label="Ships">
        <input
          type="number"
          min={1}
          max={60}
          value={draft.shipCount}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) patchRaidDraft({ shipCount: Math.min(60, Math.max(1, n)) })
          }}
        />
      </Field>

      <div className="spec-summary">
        {ready
          ? 'Click the canvas to place the ingress axis. The raid flies from the click point toward the target.'
          : 'Choose a platform and a target asset to enable commit.'}
      </div>
      <div className="inspector-actions">
        <button className="primary" disabled={!ready} onClick={() => commitRaid(null)}>
          Use default axis
        </button>
        <button onClick={cancelRaidDraft}>Cancel</button>
      </div>
    </div>
  )
}

const INTEGRATION_BADGE: Record<IntegrationConfidence, string> = {
  documented: 'DOC',
  probable: 'PROB',
  inferred: 'INF',
}

/**
 * What this system is known to integrate with (research-sourced), independent
 * of what is currently on the canvas. Answers "what connects to this?" even
 * when nothing compatible is placed yet.
 */
function IntegrationSection({ entity }: { entity: Entity }) {
  const scenario = useStore((s) => s.scenario)
  const camera = useStore((s) => s.camera)
  const openConnectSuggestion = useStore((s) => s.openConnectSuggestion)
  const [showAll, setShowAll] = useState(false)
  const summary = integrationSummary(entity.specId, scenario.library)
  if (!summary) return null
  const shown = showAll ? summary.partners : summary.partners.slice(0, 6)

  function suggest() {
    // Popup coordinates are canvas-host px; clamp so it stays in view even
    // when the entity sits off-screen.
    const host = document.querySelector('[data-testid="canvas-host"]')
    const w = host instanceof HTMLElement ? host.clientWidth : 800
    const h = host instanceof HTMLElement ? host.clientHeight : 600
    const x = Math.min(Math.max(entity.pos.x * camera.scale + camera.x + 16, 8), w - 280)
    const y = Math.min(Math.max(entity.pos.y * camera.scale + camera.y + 16, 8), Math.max(h - 260, 8))
    openConnectSuggestion(entity.id, { x, y }, { always: true })
  }

  return (
    <div>
      <div className="panel-subtitle">INTEGRATIONS</div>
      {summary.program && <div className="spec-summary">{summary.program}</div>}
      {summary.guidance && <div className="spec-summary">{summary.guidance}</div>}
      {summary.partners.length === 0 && (
        <div className="spec-summary">No known network integrations.</div>
      )}
      {shown.map((p) => (
        <div key={p.specId} className="suggest-row" title={p.source ? `${p.note} [${p.source}]` : p.note}>
          <div className="suggest-info">
            <div>{p.name}</div>
            <div className="suggest-meta">
              <span className="suggest-badge">{INTEGRATION_BADGE[p.confidence]}</span>
              {p.role.replace('-', ' ')}
            </div>
          </div>
        </div>
      ))}
      {!showAll && summary.partners.length > 6 && (
        <button className="mini" onClick={() => setShowAll(true)}>
          Show all {summary.partners.length}
        </button>
      )}
      {summary.denied.length > 0 && (
        <div className="spec-summary">
          No link:{' '}
          {summary.denied.map((d, i) => (
            <span key={d.specId} title={d.reason}>
              {i > 0 ? ', ' : ''}
              {d.name}
            </span>
          ))}
        </div>
      )}
      <button className="mini" onClick={suggest}>
        Suggest connections
      </button>
    </div>
  )
}

function EntityInspector({ entity }: { entity: Entity }) {
  const scenario = useStore((s) => s.scenario)
  const units = useStore((s) => s.ui.units)
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
        <input
          list="entity-name-options"
          value={entity.name}
          onChange={(e) => updateEntity(entity.id, { name: e.target.value })}
        />
      </Field>
      <Options id="entity-name-options" values={sameKindModels.map((m) => m.name)} />
      {(() => {
        if (!model) return null
        const base = model.name.split(':').pop()?.trim() ?? model.name
        const peers = scenario.entities.filter((e) => e.specId === entity.specId)
        const suggested = `${base} ${peers.findIndex((e) => e.id === entity.id) + 1}`
        if (entity.name === suggested) return null
        return (
          <button className="mini" onClick={() => updateEntity(entity.id, { name: suggested })}>
            Rename to {suggested}
          </button>
        )
      })()}
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
        <>
          <div className="spec-summary">
            {model.sensor.role ? `${model.sensor.role} · ` : ''}
            Detect {formatDistance(model.sensor.detectRangeM, units)} · sector {model.sensor.sectorDeg} deg
            {model.sensor.classifyRangeM ? ` · classify ${formatDistance(model.sensor.classifyRangeM, units)}` : ''}
            {sensorEnvFactor(model.sensor.sensorType, scenario.environment) < 1 && (
              <>
                <br />
                In this environment: detect{' '}
                {formatDistance(effectiveDetectRangeM(model.sensor, scenario.environment), units)}
              </>
            )}
          </div>
          <NotModeled
            values={[
              model.sensor.elevationDeg
                ? `elevation ${model.sensor.elevationDeg[0]} to ${model.sensor.elevationDeg[1]} deg`
                : null,
              model.sensor.maxAltitudeFt
                ? `altitude ceiling ${model.sensor.maxAltitudeFt.toLocaleString()} ft`
                : null,
            ].filter((v): v is string => v != null)}
          />
        </>
      )}
      {model?.effector && (
        <>
          <div className="spec-summary">
            WEZ {formatDistance(model.effector.minRangeM, units)} – {formatDistance(model.effector.maxRangeM, units)} ·
            engage {model.effector.engageTimeS} s
            {(model.effector.sectorDeg ?? 360) < 360 ? ` · sector ${model.effector.sectorDeg} deg` : ''}
          </div>
          <NotModeled
            values={
              model.effector.maxAltitudeFt
                ? [`altitude ceiling ${model.effector.maxAltitudeFt.toLocaleString()} ft`]
                : []
            }
          />
        </>
      )}
      {model?.uas && (
        <div className="spec-summary">
          Group {model.uas.group} · cruise {formatSpeed(model.uas.cruiseSpeedMps, units)} · {model.uas.navMode}
        </div>
      )}

      {entity.kind === 'asset' && (
        <div className="subsection">
          <div className="panel-subtitle">Defended area</div>
          <Field label="Defended radius (m)">
            <input
              type="number"
              min={0}
              step={50}
              placeholder={String(DEFAULT_DEFENDED_RADIUS_M)}
              value={entity.defendedRadiusM ?? ''}
              onChange={(e) =>
                updateEntity(entity.id, {
                  defendedRadiusM:
                    e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                })
              }
            />
          </Field>
          <div className="spec-summary">
            In use: {formatDistance(entity.defendedRadiusM ?? DEFAULT_DEFENDED_RADIUS_M, units)}
            {entity.defendedRadiusM == null || entity.defendedRadiusM <= 0
              ? ' · default planning factor'
              : ''}
          </div>
          <p className="muted small">
            A threat that crosses this radius has ARRIVED at the asset. Arrival sets warning
            time, and it separates a defeat that protected the asset from one that landed too
            late. Leave the field empty to use the{' '}
            {formatDistance(DEFAULT_DEFENDED_RADIUS_M, units)} planning factor.
          </p>
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
                  Basis: {basis.source} · {formatDistance(basis.radiusM, units)} calm ·{' '}
                  {basis.oneWay ? 'one-way' : 'return-to-home'}
                  <br />
                  With environment: {formatDistance(down, units)} downwind · {formatDistance(up, units)} upwind
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
                {path.points.length} waypoints · {formatDistance(pathLength(path.points), units)}
              </div>
              <div className="field-row">
                {(() => {
                  const cruise = model?.uas?.cruiseSpeedMps
                  const max = model?.uas?.maxSpeedMps
                  if (cruise == null || max == null) {
                    return (
                      <Field label="Speed (m/s)">
                        <input
                          type="number"
                          placeholder="15"
                          value={path.speedMps ?? ''}
                          onChange={(e) =>
                            updatePath(path.id, {
                              speedMps: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                    )
                  }
                  return <PathSpeedField key={path.id} path={path} cruise={cruise} max={max} />
                })()}
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

      {blue && <IntegrationSection entity={entity} />}

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
          list="boundary-name-options"
          value={boundary.name}
          onChange={(e) => updateBoundary(boundary.id, { name: e.target.value })}
        />
      </Field>
      <Options id="boundary-name-options" values={BOUNDARY_NAME_SUGGESTIONS[boundary.type]} />
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
            list="boundary-alt-options"
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
            list="boundary-alt-options"
            value={boundary.altBandFt?.[1] ?? ''}
            onChange={(e) =>
              updateBoundary(boundary.id, {
                altBandFt: [boundary.altBandFt?.[0] ?? 0, Number(e.target.value)],
              })
            }
          />
        </Field>
      </div>
      <Options id="boundary-alt-options" values={BOUNDARY_ALT_SUGGESTIONS_FT} />
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
  const raidDraft = useStore((s) => s.ui.raidDraft)

  // The armed raid builder replaces the whole Inspector body.
  if (raidDraft) return <RaidBuilderCard draft={raidDraft} />

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
    // The source citation is not stored on the connection; re-judge the pair.
    const fromSpec = from?.specId ? scenario.library.find((m) => m.id === from.specId) : undefined
    const toSpec = to?.specId ? scenario.library.find((m) => m.id === to.specId) : undefined
    const verdict = fromSpec && toSpec ? evaluateIntegration(fromSpec, toSpec) : null
    const source = connection.confidence != null && verdict?.ok ? verdict.source : undefined
    return (
      <div className="inspector-body">
        <div className="panel-subtitle">CONNECTION</div>
        <div className="spec-summary">
          {from?.name ?? '?'} → {to?.name ?? '?'}
        </div>
        <Field label="Label">
          <input
            list="connection-label-options"
            value={connection.label}
            onChange={(e) => updateConnection(connection.id, { label: e.target.value })}
          />
        </Field>
        <Options
          id="connection-label-options"
          values={[...new Set(scenario.connections.map((c) => c.label).filter(Boolean))]}
        />
        {connection.confidence != null && (
          <div className="spec-summary">
            {connection.medium ?? 'unspecified medium'} · {connection.confidence} · latency{' '}
            {connection.latencyS ?? 0} s
          </div>
        )}
        {connection.note && <div className="spec-summary">{connection.note}</div>}
        {source && <div className="spec-summary">Source: {source}</div>}
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
    <div className="inspector-body">
      <div className="empty-state">
        <div className="empty-title">Nothing selected</div>
        <p>Drag a model from the library onto the canvas, or click an entity to edit it.</p>
        <div className="empty-shortcuts">
          {EMPTY_SHORTCUTS.map(([key, action]) => (
            <div key={key + action} className="empty-row">
              <span className="kbd">{key}</span>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Matches the keyboard map in App.tsx and the CanvasStage gestures. */
const EMPTY_SHORTCUTS: Array<[string, string]> = [
  ['⌘Z', 'undo'],
  ['Space', 'play/pause'],
  ['Esc', 'cancel draft'],
  ['Enter', 'finish path'],
  ['⌘drag', 'box-select'],
  ['⇧click', 'add to selection'],
  ['scroll', 'zoom'],
  ['drag', 'pan'],
]

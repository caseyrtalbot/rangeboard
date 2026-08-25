import { useEffect, useRef, useState } from 'react'
import type { EntityKind } from '../model/types'
import { entityActive } from '../model/types'
import type { LayerKey, LayerPreset } from '../state/store'
import { useStore, modelFor } from '../state/store'

const MODEL_GROUPS: { kind: EntityKind; title: string }[] = [
  { kind: 'sensor', title: 'Sensor' },
  { kind: 'effector', title: 'Effector' },
  { kind: 'c2', title: 'C2' },
  { kind: 'uas', title: 'Threat UAS' },
  { kind: 'asset', title: 'Asset' },
  { kind: 'marker', title: 'Marker' },
]

const PRESET_ITEMS: { key: LayerPreset; label: string }[] = [
  { key: 'full', label: 'Full' },
  { key: 'planning', label: 'Planning' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'clean', label: 'Clean' },
]

const LAYER_ITEMS: { key: LayerKey; label: string }[] = [
  { key: 'grid', label: 'Grid' },
  { key: 'boundaries', label: 'Boundaries' },
  { key: 'sensorFootprints', label: 'Sensor footprints' },
  { key: 'classifyRings', label: 'Classify rings' },
  { key: 'effectorEnvelopes', label: 'Effector envelopes' },
  { key: 'threatWez', label: 'Threat WEZ' },
  { key: 'flightPaths', label: 'Flight paths' },
  { key: 'connections', label: 'Connections' },
  { key: 'rangeRings', label: 'Range rings' },
  { key: 'engagements', label: 'Engagements' },
  { key: 'labels', label: 'Labels' },
  { key: 'trackTelemetry', label: 'Track telemetry' },
]

function Item({ label, onPick, danger }: { label: string; onPick: () => void; danger?: boolean }) {
  const closeContextMenu = useStore((s) => s.closeContextMenu)
  return (
    <button
      className={`ctx-item ${danger ? 'danger' : ''}`}
      onClick={() => {
        onPick()
        closeContextMenu()
      }}
    >
      {label}
    </button>
  )
}

// Layer variant of Item: it keeps the menu open so several layers can be
// switched in one visit. Every other entry closes on pick through Item.
function ToggleItem({ label, checked, onPick }: { label: string; checked: boolean; onPick: () => void }) {
  return (
    <button className="ctx-item" onClick={onPick}>
      <span className="ctx-check">{checked ? '✓' : ''}</span>
      {label}
    </button>
  )
}

/** Right-click menu for the canvas. Rendered as DOM over the Konva stage. */
export function ContextMenu() {
  const menu = useStore((s) => s.ui.contextMenu)
  const scenario = useStore((s) => s.scenario)
  const selection = useStore((s) => s.selection)
  const layers = useStore((s) => s.ui.layers)
  const closeContextMenu = useStore((s) => s.closeContextMenu)
  // Tied to the menu object identity so each freshly opened menu starts closed.
  const [submenuState, setSubmenuState] = useState<{ menu: unknown; value: string | null } | null>(
    null,
  )
  const submenu = submenuState && submenuState.menu === menu ? submenuState.value : null
  const setSubmenu = (value: string | null) => setSubmenuState({ menu, value })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeContextMenu()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menu, closeContextMenu])

  if (!menu) return null
  const st = useStore.getState()
  const entity = menu.entityId ? scenario.entities.find((e) => e.id === menu.entityId) : undefined

  // Layer visibility is view state, so these actions use set, not mutate.
  // Nothing here is undoable and nothing here enters the scenario.
  function displayFlyout() {
    return (
      <div className="ctx-sub" onMouseEnter={() => setSubmenu('display')}>
        <button className="ctx-item">Display ▸</button>
        {submenu === 'display' && (
          <div className="ctx-menu ctx-flyout">
            <div className="ctx-head">Presets</div>
            {PRESET_ITEMS.map((p) => (
              <Item key={p.key} label={p.label} onPick={() => st.applyLayerPreset(p.key)} />
            ))}
            <div className="ctx-head">Layers</div>
            {LAYER_ITEMS.map((l) => (
              <ToggleItem
                key={l.key}
                label={l.label}
                checked={layers[l.key]}
                onPick={() => st.toggleLayer(l.key)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  function entityItems() {
    if (!entity) return null
    const model = modelFor(scenario, entity)
    const blue = entity.kind === 'sensor' || entity.kind === 'effector' || entity.kind === 'c2'
    const active = entityActive(entity)
    const multi = selection.entityIds.length > 1
    return (
      <>
        <div className="ctx-head">{entity.name}</div>
        <Item
          label="Inspect"
          onPick={() => {
            st.select({ entityIds: [entity.id] })
            st.setRightTab('inspect')
          }}
        />
        {model && (
          <Item
            label="Edit model specs"
            onPick={() => {
              st.select({ libraryId: model.id })
              st.setRightTab('library')
            }}
          />
        )}
        {blue && (
          <Item
            label={active ? 'Disable (exclude from analysis)' : 'Enable'}
            onPick={() => st.updateEntity(entity.id, { enabled: !active })}
          />
        )}
        {entity.kind === 'uas' && (
          <Item
            label={scenario.paths.some((p) => p.entityId === entity.id) ? 'Redraw flight path' : 'Draw flight path'}
            onPick={() => st.beginPath(entity.id)}
          />
        )}
        {entity.kind === 'uas' && (
          <Item
            label={entity.showRange ? 'Hide range ring' : 'Show range ring'}
            onPick={() => st.updateEntity(entity.id, { showRange: !entity.showRange })}
          />
        )}
        {entity.kind === 'uas' && (
          <Item
            label={entity.formation ? 'Remove formation' : 'Make formation (3-ship wedge)'}
            onPick={() =>
              st.updateEntity(entity.id, {
                formation: entity.formation ? null : { count: 3, shape: 'wedge', spacingM: 50 },
              })
            }
          />
        )}
        <Item label="Connect from here" onPick={() => {
          st.setTool('connect')
          st.beginConnect(entity.id)
        }} />
        {blue && (
          <Item
            label="Suggest connections"
            onPick={() => st.openConnectSuggestion(entity.id, menu!.screen, { always: true })}
          />
        )}
        <Item label="Duplicate" onPick={() => st.duplicateEntity(entity.id)} />
        {entity.systemId && (
          <>
            <Item label="Select whole system" onPick={() => st.selectSystem(entity.systemId!)} />
            <Item
              label="Rotate system 45° right"
              onPick={() => st.rotateSystem(entity.systemId!, 45)}
            />
            <Item
              label="Rotate system 45° left"
              onPick={() => st.rotateSystem(entity.systemId!, -45)}
            />
          </>
        )}
        {multi && (
          <Item label="Save selection as system" onPick={() => st.saveSelectionAsSystem('')} />
        )}
        {displayFlyout()}
        <Item danger label="Delete" onPick={() => {
          st.select({ entityIds: [entity.id] })
          st.deleteSelection()
        }} />
      </>
    )
  }

  function canvasItems() {
    return (
      <>
        <div className="ctx-head">Add at this point</div>
        {scenario.systemPresets.length > 0 && (
          <div className="ctx-sub" onMouseEnter={() => setSubmenu('systems')}>
            <button className="ctx-item">Place system ▸</button>
            {submenu === 'systems' && (
              <div className="ctx-menu ctx-flyout">
                {scenario.systemPresets.map((p) => (
                  <Item key={p.id} label={p.name} onPick={() => st.addSystemFromPreset(p.id, menu!.world)} />
                ))}
              </div>
            )}
          </div>
        )}
        {MODEL_GROUPS.map((g) => {
          const models = scenario.library.filter((m) => m.kind === g.kind)
          if (models.length === 0) return null
          return (
            <div key={g.kind} className="ctx-sub" onMouseEnter={() => setSubmenu(g.kind)}>
              <button className="ctx-item">Place {g.title.toLowerCase()} ▸</button>
              {submenu === g.kind && (
                <div className="ctx-menu ctx-flyout">
                  {models.map((m) => (
                    <Item key={m.id} label={m.name} onPick={() => st.addEntityFromModel(m.id, menu!.world)} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {selection.entityIds.length > 1 && (
          <Item label="Save selection as system" onPick={() => st.saveSelectionAsSystem('')} />
        )}
        {displayFlyout()}
      </>
    )
  }

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: menu.screen.x, top: menu.screen.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entity ? entityItems() : canvasItems()}
    </div>
  )
}

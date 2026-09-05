import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { EFFECTOR_RING_KEYS, SENSOR_RING_KEYS } from '../state/rings'
import type { RingKey } from '../state/rings'
import type { LayerKey, LayerPreset } from '../state/layers'
import type { BasemapMode } from '../model/types'
import type { DisplayUnits } from '../geometry/geo'
import { importUnderlayImage } from '../io/persist'
import { RING_HINTS, RING_LABELS } from './ringLabels'

const PRESETS: { id: LayerPreset; label: string; hint: string }[] = [
  { id: 'full', label: 'Full', hint: 'Show every layer' },
  { id: 'planning', label: 'Planning', hint: 'Coverage and paths. No engagement lines' },
  { id: 'engagement', label: 'Engagement', hint: 'Tracks and shots. No coverage rings' },
  { id: 'clean', label: 'Clean', hint: 'Grid, labels and telemetry only' },
]

/** Ring toggles for one kind, in key order, named from the shared table. */
function ringLayers(keys: readonly RingKey[]): { id: LayerKey; label: string; hint?: string }[] {
  return keys.map((k) => ({ id: k, label: RING_LABELS[k], hint: RING_HINTS[k] }))
}

const LAYER_GROUPS: { title: string; layers: { id: LayerKey; label: string; hint?: string }[] }[] = [
  { title: 'Sensor', layers: ringLayers(SENSOR_RING_KEYS) },
  { title: 'Effector', layers: ringLayers(EFFECTOR_RING_KEYS) },
  {
    title: 'Areas',
    layers: [
      { id: 'defendedAreas', label: 'Defended areas', hint: 'Show the protected boundary around each asset' },
      { id: 'threatWez', label: 'Threat WEZ', hint: 'Show threat weapon engagement zones' },
    ],
  },
  {
    title: 'Tracks',
    layers: [
      { id: 'flightPaths', label: 'Flight paths' },
      { id: 'engagements', label: 'Engagements' },
      { id: 'labels', label: 'Labels' },
      { id: 'trackTelemetry', label: 'Track telemetry' },
    ],
  },
  {
    title: 'Reference',
    layers: [
      { id: 'grid', label: 'Grid' },
      { id: 'boundaries', label: 'Boundaries' },
      { id: 'connections', label: 'Connections' },
      { id: 'rangeRings', label: 'Range rings' },
    ],
  },
]

const BASEMAPS: { id: BasemapMode; label: string }[] = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'sat', label: 'Sat' },
  { id: 'airspace', label: 'Airspace' },
]

const UNITS: { id: DisplayUnits; label: string; hint: string }[] = [
  { id: 'aviation', label: 'kt nm', hint: 'Aviation units: knots and nautical miles. Altitude is always feet.' },
  { id: 'metric', label: 'm km', hint: 'Metric units: m/s and km. Altitude is always feet.' },
]

/**
 * Toolbar View dropdown. Holds the four layer presets, the seventeen layer
 * toggles, the basemap, the units, and the satellite underlay controls.
 * Layer visibility is view state, so nothing here is undoable.
 */
export function ViewMenu() {
  const layers = useStore((s) => s.ui.layers)
  const basemap = useStore((s) => s.ui.basemap)
  const units = useStore((s) => s.ui.units)
  const moveUnderlay = useStore((s) => s.ui.moveUnderlay)
  const opacity = useStore((s) => s.scenario.underlay.opacity)
  const {
    setBasemap,
    toggleLayer,
    applyLayerPreset,
    setLocationDialogOpen,
    setMoveUnderlay,
    setUnits,
    updateUnderlay,
  } = useStore.getState()

  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    // Capture phase: Escape must close only the menu, never also reach the
    // global canvas shortcut in App.tsx that clears the tool and the selection.
    // The command palette can open over the menu, and then it owns Escape.
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (document.querySelector('.cmdk-panel')) return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        className={`tb-menu ${open ? 'active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        title="Layers, presets, basemap and units"
        onClick={() => setOpen((v) => !v)}
      >
        View <span className="tb-caret">▾</span>
      </button>
      {open && (
        <div className="tb-menu-panel" role="menu" aria-label="View">
          <div className="tb-menu-head">Preset</div>
          <div className="seg tb-menu-seg" aria-label="Layer preset">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                title={p.hint}
                onClick={() => {
                  applyLayerPreset(p.id)
                  setOpen(false)
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {LAYER_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="tb-menu-head">{g.title}</div>
              {g.layers.map((l) => (
                <button
                  key={l.id}
                  className="tb-menu-item"
                  role="menuitemcheckbox"
                  aria-checked={layers[l.id]}
                  title={l.hint}
                  onClick={() => toggleLayer(l.id)}
                >
                  <span className="tb-menu-tick">{layers[l.id] ? '✓' : ''}</span>
                  {l.label}
                </button>
              ))}
            </div>
          ))}
          <div className="tb-menu-head">Basemap</div>
          <div className="seg tb-menu-seg" aria-label="Basemap">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                className={basemap === b.id ? 'active' : ''}
                onClick={() => setBasemap(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="tb-menu-head">Units</div>
          <div className="seg tb-menu-seg" aria-label="Units">
            {UNITS.map((u) => (
              <button
                key={u.id}
                className={units === u.id ? 'active' : ''}
                title={u.hint}
                onClick={() => setUnits(u.id)}
              >
                {u.label}
              </button>
            ))}
          </div>
          {basemap === 'sat' && (
            <>
              <div className="tb-menu-head">Satellite</div>
              <button
                className="tb-menu-item"
                onClick={() => {
                  setOpen(false)
                  setLocationDialogOpen(true)
                }}
              >
                Location…
              </button>
              <button
                className="tb-menu-item"
                onClick={() => {
                  setOpen(false)
                  importUnderlayImage()
                }}
              >
                Image…
              </button>
              <label className="tb-menu-item tb-menu-row">
                <input
                  type="checkbox"
                  checked={moveUnderlay}
                  onChange={(e) => setMoveUnderlay(e.target.checked)}
                />
                Move image
              </label>
              <label className="tb-menu-item tb-menu-row">
                Opacity
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => updateUnderlay({ opacity: Number(e.target.value) })}
                />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  )
}

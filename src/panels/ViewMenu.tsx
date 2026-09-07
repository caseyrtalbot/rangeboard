import { useRef, useState } from 'react'
import { Seg } from '../ui/kit'
import { useStore } from '../state/store'
import type { Theme } from '../state/store'
import { EFFECTOR_RING_KEYS, SENSOR_RING_KEYS } from '../state/rings'
import type { RingKey } from '../state/rings'
import type { LayerKey, LayerPreset } from '../state/layers'
import type { BasemapMode } from '../model/types'
import type { DisplayUnits } from '../geometry/geo'
import { RING_HINTS, RING_LABELS } from './ringLabels'
import { useToolbarMenuDismiss } from './useToolbarMenuDismiss'

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

const THEMES: Array<{ v: Theme; label: string }> = [
  { v: 'system', label: 'System' },
  { v: 'dark', label: 'Dark' },
  { v: 'light', label: 'Light' },
]

/**
 * Board View dropdown. Every control here is saved view state and stays out
 * of scenario history: theme, layer visibility, basemap and display units.
 */
export function ViewMenu() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useToolbarMenuDismiss({ open, wrapRef, buttonRef, setOpen })

  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`tb-menu ${open ? 'active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="view-menu-panel"
        title="Theme, layers, basemap and units"
        onClick={() => setOpen((v) => !v)}
      >
        View <span className="tb-caret">▾</span>
      </button>
      {open && <ViewMenuPanel onRequestClose={() => setOpen(false)} />}
    </div>
  )
}

export function ViewMenuPanel({ onRequestClose }: { onRequestClose: () => void }) {
  const layers = useStore((s) => s.ui.layers)
  const basemap = useStore((s) => s.ui.basemap)
  const units = useStore((s) => s.ui.units)
  const theme = useStore((s) => s.ui.theme)
  const {
    setBasemap,
    toggleLayer,
    applyLayerPreset,
    setUnits,
    setTheme,
  } = useStore.getState()

  return (
    <div
      id="view-menu-panel"
      className="tb-menu-panel view-menu-panel"
      role="dialog"
      aria-label="View controls"
    >
      <div className="tb-menu-head">Theme</div>
      <Seg value={theme} options={THEMES} label="Theme" onChange={setTheme} />
      <div className="tb-menu-head">Layer preset</div>
      <div className="seg tb-menu-seg" role="group" aria-label="Layer preset">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.hint}
            onClick={() => {
              applyLayerPreset(p.id)
              onRequestClose()
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {LAYER_GROUPS.map((g) => (
        <div key={g.title} role="group" aria-label={`${g.title} layers`}>
          <div className="tb-menu-head">{g.title}</div>
          {g.layers.map((l) => (
            <button
              key={l.id}
              type="button"
              className="tb-menu-item"
              aria-pressed={layers[l.id]}
              title={l.hint}
              onClick={() => toggleLayer(l.id)}
            >
              <span className="tb-menu-tick" aria-hidden="true">{layers[l.id] ? '✓' : ''}</span>
              {l.label}
            </button>
          ))}
        </div>
      ))}
      <div className="tb-menu-head">Basemap</div>
      <div className="seg tb-menu-seg" role="group" aria-label="Basemap">
        {BASEMAPS.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={basemap === b.id}
            className={basemap === b.id ? 'active' : ''}
            onClick={() => setBasemap(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="tb-menu-head">Units</div>
      <div className="seg tb-menu-seg" role="group" aria-label="Units">
        {UNITS.map((u) => (
          <button
            key={u.id}
            type="button"
            aria-pressed={units === u.id}
            className={units === u.id ? 'active' : ''}
            title={u.hint}
            onClick={() => setUnits(u.id)}
          >
            {u.label}
          </button>
        ))}
      </div>
    </div>
  )
}

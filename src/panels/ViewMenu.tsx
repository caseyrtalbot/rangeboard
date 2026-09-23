import { selectEffectiveLayers } from '../state/selectors'
import { useRef } from 'react'
import { Seg } from '../ui/kit'
import { usePopover } from '../ui/usePopover'
import { useStore } from '../state/store'
import { THEMES } from '../state/themes'
import { EFFECTOR_RING_KEYS, SENSOR_RING_KEYS } from '../state/rings'
import type { RingKey } from '../state/rings'
import { activeLayerPreset } from '../state/layers'
import type { LayerKey, LayerPreset } from '../state/layers'
import type { BasemapMode } from '../model/types'
import type { DisplayUnits } from '../geometry/geo'
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

const LAYER_GROUPS: { title: string; layers: { id: LayerKey; label: string; hint?: string }[] }[] =
  [
    { title: 'Sensor', layers: ringLayers(SENSOR_RING_KEYS) },
    { title: 'Effector', layers: ringLayers(EFFECTOR_RING_KEYS) },
    {
      title: 'Areas',
      layers: [
        {
          id: 'defendedAreas',
          label: 'Defended areas',
          hint: 'Show the protected boundary around each asset',
        },
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
  {
    id: 'aviation',
    label: 'kt nm',
    hint: 'Aviation units: knots and nautical miles. Altitude is always feet.',
  },
  { id: 'metric', label: 'm km', hint: 'Metric units: m/s and km. Altitude is always feet.' },
]

/**
 * Board View dropdown. Every control here is saved view state and stays out
 * of scenario history: theme, layer visibility, basemap and display units.
 */
export function ViewMenu() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, toggle } = usePopover(wrapRef, buttonRef)

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
        onClick={toggle}
      >
        View <span className="tb-caret">▾</span>
      </button>
      {open && <ViewMenuPanel />}
    </div>
  )
}

export function DeclutterControl() {
  const layers = useStore(selectEffectiveLayers)
  const active = activeLayerPreset(layers)
  return (
    <div className="board-declutter">
      <span className="muted">Declutter</span>
      <div className="seg" role="group" aria-label="Declutter">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.hint}
            aria-pressed={active === preset.id}
            className={active === preset.id ? 'active' : ''}
            onClick={() => useStore.getState().applyLayerPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ThemeSettings() {
  const theme = useStore((s) => s.ui.theme)
  return (
    <>
      <div className="tb-menu-head">Theme</div>
      <Seg value={theme} options={THEMES} label="Theme" onChange={useStore.getState().setTheme} />
    </>
  )
}

export function UnitsSettings() {
  const units = useStore((s) => s.ui.units)
  return (
    <>
      <div className="tb-menu-head">Units</div>
      <div className="seg tb-menu-seg" role="group" aria-label="Units">
        {UNITS.map((unit) => (
          <button
            key={unit.id}
            type="button"
            title={unit.hint}
            aria-pressed={units === unit.id}
            className={units === unit.id ? 'active' : ''}
            onClick={() => useStore.getState().setUnits(unit.id)}
          >
            {unit.label}
          </button>
        ))}
      </div>
    </>
  )
}

export function BasemapSettings() {
  const basemap = useStore((s) => s.ui.basemap)
  return (
    <>
      <div className="tb-menu-head">Basemap</div>
      <div className="seg tb-menu-seg" role="group" aria-label="Basemap">
        {BASEMAPS.map((map) => (
          <button
            key={map.id}
            type="button"
            aria-pressed={basemap === map.id}
            className={basemap === map.id ? 'active' : ''}
            onClick={() => useStore.getState().setBasemap(map.id)}
          >
            {map.label}
          </button>
        ))}
      </div>
    </>
  )
}

export function LayerSettings() {
  const layers = useStore(selectEffectiveLayers)
  return (
    <>
      {LAYER_GROUPS.map((group) => (
        <div key={group.title} role="group" aria-label={`${group.title} layers`}>
          <div className="tb-menu-head">{group.title}</div>
          {group.layers.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className="tb-menu-item"
              aria-pressed={layers[layer.id]}
              title={layer.hint}
              onClick={() => useStore.getState().toggleLayer(layer.id)}
            >
              <span className="tb-menu-tick" aria-hidden="true">
                {layers[layer.id] ? '✓' : ''}
              </span>
              {layer.label}
            </button>
          ))}
        </div>
      ))}
    </>
  )
}

export function ViewMenuPanel() {
  return (
    <div
      id="view-menu-panel"
      className="tb-menu-panel view-menu-panel surface-float"
      role="dialog"
      aria-label="View controls"
    >
      <ThemeSettings />
      <UnitsSettings />
      <BasemapSettings />
      <LayerSettings />
    </div>
  )
}

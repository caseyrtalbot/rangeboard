import { useMemo } from 'react'
import { defaultFrameName, useStore } from '../state/store'
import { spawnInRingViolations } from '../playback/sim'
import { Tip } from './Tooltip'
import { useTeStore } from '../te/state/teStore'
import type { Workspace } from '../te/state/teStore'
import { captureFrameToCampaign } from '../te/io/frameCapture'
import type { BasemapMode, BoundaryType, EnvironmentSpec, Roe } from '../model/types'
import type { DisplayUnits } from '../geometry/geo'
import { emptyScenario } from '../model/seed'
import {
  exportScenario,
  importScenarioFile,
  importUnderlayImage,
} from '../io/persist'

const TOOLS = [
  { id: 'select', label: 'Select', hint: 'Move, pan, edit' },
  { id: 'boundary', label: 'Boundary', hint: 'Draw airspace and range polygons' },
  { id: 'connect', label: 'Connect', hint: 'Link sensor to C2 to effector' },
  { id: 'path', label: 'Path', hint: 'Draw a UAS flight path' },
  { id: 'calibrate', label: 'Calibrate', hint: 'Set image scale from two points' },
] as const

const BASEMAPS: { id: BasemapMode; label: string }[] = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'sat', label: 'Sat' },
  { id: 'airspace', label: 'Airspace' },
]

const BOUNDARY_TYPES: BoundaryType[] = ['range', 'restricted', 'asset', 'corridor']

const UNITS: { id: DisplayUnits; label: string; hint: string }[] = [
  { id: 'aviation', label: 'kt nm', hint: 'Aviation units: knots and nautical miles. Altitude is always feet.' },
  { id: 'metric', label: 'm km', hint: 'Metric units: m/s and km. Altitude is always feet.' },
]

const ROE_PILLS: Record<Roe, { label: string; cls: string; hint: string }> = {
  free: { label: 'ROE Free', cls: 'pill-good', hint: 'ROE free: engage on first detection' },
  tight: { label: 'ROE Tight', cls: 'pill-dim', hint: 'ROE tight: engage tracks classified hostile' },
  hold: { label: 'ROE Hold', cls: 'pill-warn', hint: 'ROE hold: no engagements' },
}

/** Local wall-clock HH:MM, 24-hour. */
function clockHHMM(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Active derating conditions, matching sensorEnvFactor exactly. Empty = no derate. */
function activeDerates(env: EnvironmentSpec): string[] {
  if (!env.apply) return []
  const out: string[] = []
  const precip = env.precipitation ?? 'clear'
  if (precip !== 'clear') out.push(precip)
  if ((env.light ?? 'day') === 'night') out.push('night')
  if ((env.emBackground ?? 'rural') === 'urban') out.push('urban EM')
  if (env.windSpeedMps > 0) out.push(`wind ${env.windSpeedMps} m/s`)
  return out
}

export function Toolbar() {
  const scenario = useStore((s) => s.scenario)
  const ui = useStore((s) => s.ui)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const {
    setTool,
    setBasemap,
    setBoundaryType,
    setScenarioName,
    undo,
    redo,
    replaceScenario,
    updateUnderlay,
    setMoveUnderlay,
    setShowThreatWez,
    setUnits,
    setLocationDialogOpen,
  } = useStore.getState()

  const workspace = useTeStore((s) => s.ui.workspace)
  const setWorkspace = useTeStore((s) => s.setWorkspace)
  const hasCampaign = useTeStore((s) => s.activeCampaignId != null)
  const workspaces: Array<{ id: Workspace; label: string }> = [
    { id: 'board', label: 'Board' },
    { id: 'ops', label: 'T&E Ops' },
  ]

  const roe = scenario.roe ?? 'tight'
  const derates = activeDerates(scenario.environment)

  // Derived live from the scenario (never stored): threats whose paths start
  // inside a sensor's effective detect ring are detected at T0.
  const spawnWarning = useMemo(() => {
    const violations = spawnInRingViolations(scenario)
    if (violations.length === 0) return null
    const nameOf = (id: string) => scenario.entities.find((e) => e.id === id)?.name ?? id
    const sensorsByUas = new Map<string, string[]>()
    for (const v of violations) {
      const names = sensorsByUas.get(v.uasId) ?? []
      names.push(nameOf(v.sensorId))
      sensorsByUas.set(v.uasId, names)
    }
    const lines = [...sensorsByUas.entries()].map(
      ([uasId, sensors]) => `${nameOf(uasId)} held by ${sensors.join(', ')}`,
    )
    return {
      count: sensorsByUas.size,
      hint: `Flight paths start inside a detect ring (detected at T0): ${lines.join('; ')}`,
    }
  }, [scenario])

  if (workspace === 'ops') {
    return (
      <header className="toolbar">
        <div className="brand">RANGEBOARD</div>
        <div className="seg" aria-label="Workspace">
          {workspaces.map((w) => (
            <button
              key={w.id}
              className={workspace === w.id ? 'active' : ''}
              onClick={() => setWorkspace(w.id)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </header>
    )
  }

  return (
    <header className="toolbar">
      <div className="brand">RANGEBOARD</div>
      <div className="seg" aria-label="Workspace">
        {workspaces.map((w) => (
          <button
            key={w.id}
            className={workspace === w.id ? 'active' : ''}
            onClick={() => setWorkspace(w.id)}
          >
            {w.label}
          </button>
        ))}
      </div>
      <input
        className="scenario-name"
        value={scenario.name}
        onChange={(e) => setScenarioName(e.target.value)}
        title="Scenario name"
      />

      <div className="seg" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <Tip key={t.id} label={t.hint}>
            <button className={ui.tool === t.id ? 'active' : ''} onClick={() => setTool(t.id)}>
              {t.label}
            </button>
          </Tip>
        ))}
        {ui.tool === 'boundary' && (
          <select
            value={ui.boundaryType}
            onChange={(e) => setBoundaryType(e.target.value as BoundaryType)}
            title="Boundary type"
          >
            {BOUNDARY_TYPES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="seg" aria-label="Basemap">
        {BASEMAPS.map((b) => (
          <button
            key={b.id}
            className={ui.basemap === b.id ? 'active' : ''}
            onClick={() => setBasemap(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="seg" aria-label="Units">
        {UNITS.map((u) => (
          <Tip key={u.id} label={u.hint}>
            <button className={ui.units === u.id ? 'active' : ''} onClick={() => setUnits(u.id)}>
              {u.label}
            </button>
          </Tip>
        ))}
      </div>

      <div className="seg" aria-label="Overlays">
        <Tip label="Show threat weapon engagement zones">
          <button
            className={ui.showThreatWez ? 'active' : ''}
            onClick={() => setShowThreatWez(!ui.showThreatWez)}
          >
            WEZ
          </button>
        </Tip>
      </div>

      {ui.basemap === 'sat' && (
        <div className="seg sat-controls">
          <button onClick={() => setLocationDialogOpen(true)}>Location…</button>
          <button onClick={importUnderlayImage}>Image…</button>
          <label className="inline">
            <input
              type="checkbox"
              checked={ui.moveUnderlay}
              onChange={(e) => setMoveUnderlay(e.target.checked)}
            />
            Move image
          </label>
          <label className="inline">
            Opacity
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={scenario.underlay.opacity}
              onChange={(e) => updateUnderlay({ opacity: Number(e.target.value) })}
            />
          </label>
        </div>
      )}

      <div className="spacer" />

      <div className="status-pills" aria-label="Status">
        <span className={`pill ${ROE_PILLS[roe].cls}`} title={ROE_PILLS[roe].hint}>
          {ROE_PILLS[roe].label}
        </span>
        {ui.showThreatWez && (
          <span className="pill pill-danger" title="Threat weapon engagement zones are drawn on the canvas">
            WEZ On
          </span>
        )}
        {derates.length > 0 && (
          <span className="pill pill-warn" title={`Sensor ranges derated: ${derates.join(', ')}`}>
            Env Derate
          </span>
        )}
        {spawnWarning && (
          <span className="pill pill-warn" title={spawnWarning.hint}>
            Spawn In Ring {spawnWarning.count}
          </span>
        )}
        {ui.lastAutosaveAt != null && (
          <span className="pill pill-dim" title="Last autosave to browser storage">
            Saved {clockHHMM(ui.lastAutosaveAt)}
          </span>
        )}
      </div>

      <div className="seg">
        <Tip label="Undo" shortcut="⌘Z">
          <button onClick={undo} disabled={!canUndo}>
            Undo
          </button>
        </Tip>
        <Tip label="Redo" shortcut="⇧⌘Z">
          <button onClick={redo} disabled={!canRedo}>
            Redo
          </button>
        </Tip>
      </div>
      <div className="seg">
        <button
          onClick={() => {
            if (window.confirm('Start a new empty scenario? Unsaved work is replaced.')) {
              replaceScenario(emptyScenario())
            }
          }}
        >
          New
        </button>
        <button onClick={importScenarioFile}>Import</button>
        <button onClick={() => exportScenario(scenario)}>Export</button>
        {hasCampaign && (
          <Tip label="Save the current board view as a PNG frame on the active T&E campaign">
            <button
              onClick={() => {
                const st = useStore.getState()
                const frameName = defaultFrameName(
                  st.scenario.name,
                  st.playback.simTimeS,
                  st.ui.basemap,
                )
                if (!captureFrameToCampaign(frameName)) {
                  window.alert('Could not capture: no active campaign or canvas.')
                }
              }}
            >
              Capture frame
            </button>
          </Tip>
        )}
      </div>
    </header>
  )
}

import { useStore } from '../state/store'
import type { BasemapMode, BoundaryType } from '../model/types'
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
  } = useStore.getState()

  return (
    <header className="toolbar">
      <div className="brand">RANGEBOARD</div>
      <input
        className="scenario-name"
        value={scenario.name}
        onChange={(e) => setScenarioName(e.target.value)}
        title="Scenario name"
      />

      <div className="tool-group" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={ui.tool === t.id ? 'active' : ''}
            title={t.hint}
            onClick={() => setTool(t.id)}
          >
            {t.label}
          </button>
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

      <div className="tool-group" aria-label="Basemap">
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

      {ui.basemap === 'sat' && (
        <div className="tool-group sat-controls">
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

      <div className="tool-group">
        <button onClick={undo} disabled={!canUndo} title="Undo (Cmd+Z)">
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Shift+Cmd+Z)">
          Redo
        </button>
      </div>
      <div className="tool-group">
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
      </div>
    </header>
  )
}

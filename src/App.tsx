import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import type { RightTab } from './state/store'
import type { GeoRef } from './model/types'
import { useTeStore } from './te/state/teStore'
import { OpsWorkspace } from './te/ui/OpsWorkspace'
import { CanvasStage } from './canvas/CanvasStage'
import { Toolbar } from './panels/Toolbar'
import { Palette } from './panels/Palette'
import { Inspector } from './panels/Inspector'
import { LibraryEditor } from './panels/LibraryEditor'
import { TestCardsPanel } from './panels/TestCardsPanel'
import { AnalysisPanel } from './panels/AnalysisPanel'
import { EngagementStrip } from './panels/analysis/EngagementStrip'
import { TimelineBar } from './panels/TimelineBar'
import { CommandPalette } from './panels/CommandPalette'
import { toggleAnalysisRun } from './playback/runSession'
import { RIGHT_PANEL_WIDTH_KEY } from './io/storageKeys'

const RIGHT_W_KEY = RIGHT_PANEL_WIDTH_KEY

const RIGHT_MIN_W = 280
const RIGHT_MAX_W = 560

function savedRightWidth(): number {
  const n = Number(localStorage.getItem(RIGHT_W_KEY))
  return n >= RIGHT_MIN_W && n <= RIGHT_MAX_W ? n : 320
}

const TABS: { id: RightTab; label: string }[] = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'cards', label: 'Test cards' },
  { id: 'library', label: 'Model' },
  { id: 'analysis', label: 'Analysis' },
]

/** Arrow-key navigation across the Inspector tab bar (roving tabindex). */
function moveTab(
  e: React.KeyboardEvent<HTMLButtonElement>,
  current: RightTab,
  setRightTab: (t: RightTab) => void,
) {
  const i = TABS.findIndex((t) => t.id === current)
  const to =
    e.key === 'ArrowRight'
      ? (i + 1) % TABS.length
      : e.key === 'ArrowLeft'
        ? (i - 1 + TABS.length) % TABS.length
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? TABS.length - 1
            : -1
  if (to < 0) return
  e.preventDefault()
  setRightTab(TABS[to].id)
  document.getElementById(`insp-tab-${TABS[to].id}`)?.focus()
}

function isTypingTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  )
}

/** Modal shown when both calibration points are placed. */
function CalibrateDialog() {
  const a = useStore((s) => s.ui.calibrateA)
  const b = useStore((s) => s.ui.calibrateB)
  const { applyCalibration, cancelDraft, setTool } = useStore.getState()
  const [value, setValue] = useState('')

  useEffect(() => {
    if (a && b) setValue('')
  }, [a, b])

  if (!a || !b) return null
  return (
    <div className="dialog">
      <div className="dialog-title">Calibrate image scale</div>
      <label className="field">
        <span>True distance between A and B (meters)</span>
        <input
          autoFocus
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && Number(value) > 0) applyCalibration(Number(value))
          }}
        />
      </label>
      <div className="inspector-actions">
        <button
          onClick={() => {
            cancelDraft()
            setTool('select')
          }}
        >
          Cancel
        </button>
        <button
          className="primary"
          disabled={!(Number(value) > 0)}
          onClick={() => applyCalibration(Number(value))}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

const LOCATION_PRESETS: { label: string; lat: number; lon: number; elevationFt: number }[] = [
  { label: 'Yuma Proving Ground AZ', lat: 32.9866, lon: -114.3355, elevationFt: 350 },
  { label: 'White Sands Missile Range NM', lat: 32.3826, lon: -106.4926, elevationFt: 4000 },
  { label: 'Dugway Proving Ground UT', lat: 40.1919, lon: -112.9358, elevationFt: 4350 },
  { label: 'China Lake NAWS CA', lat: 35.6853, lon: -117.69, elevationFt: 2250 },
  { label: 'Eglin AFB FL', lat: 30.4633, lon: -86.5498, elevationFt: 85 },
  { label: 'Fort Sill OK', lat: 34.651, lon: -98.402, elevationFt: 1200 },
  { label: 'Camp Grayling MI', lat: 44.6803, lon: -84.7292, elevationFt: 1170 },
  { label: 'Creech AFB NV', lat: 36.5872, lon: -115.6733, elevationFt: 3130 },
  { label: 'Aberdeen Proving Ground MD', lat: 39.4667, lon: -76.13, elevationFt: 20 },
  { label: 'Fort Huachuca AZ', lat: 31.555, lon: -110.3503, elevationFt: 4620 },
  { label: 'Camp Roberts CA', lat: 35.7897, lon: -120.746, elevationFt: 620 },
  { label: 'Twentynine Palms MCAGCC CA', lat: 34.236, lon: -116.057, elevationFt: 2000 },
]

/** Modal for the satellite basemap geo reference. */
function LocationDialog() {
  const open = useStore((s) => s.ui.locationDialogOpen)
  const geoRef = useStore((s) => s.scenario.geoRef)
  if (!open) return null
  return <LocationDialogForm geoRef={geoRef} />
}

function LocationDialogForm({ geoRef }: { geoRef: GeoRef | null }) {
  const { setGeoRef, setLocationDialogOpen, applyLocation } = useStore.getState()
  const [preset, setPreset] = useState('')
  const [lat, setLat] = useState(geoRef ? String(geoRef.lat) : '')
  const [lon, setLon] = useState(geoRef ? String(geoRef.lon) : '')

  const latN = Number(lat)
  const lonN = Number(lon)
  const valid = lat !== '' && lon !== '' && latN >= -85 && latN <= 85 && lonN >= -180 && lonN <= 180

  function apply() {
    if (!valid) return
    // A chosen preset site also sets the field elevation; the number input in
    // the Analysis environment section stays the override.
    const p = LOCATION_PRESETS.find((l) => l.label === preset)
    const fromPreset = p && p.lat === latN && p.lon === lonN
    applyLocation({ lat: latN, lon: lonN }, fromPreset ? p.elevationFt : null)
    setLocationDialogOpen(false)
  }

  return (
    <div className="dialog">
      <div className="dialog-title">Map location</div>
      <label className="field">
        <span>Preset test location</span>
        <select
          value={preset}
          onChange={(e) => {
            const p = LOCATION_PRESETS.find((l) => l.label === e.target.value)
            setPreset(e.target.value)
            if (p) {
              setLat(String(p.lat))
              setLon(String(p.lon))
            }
          }}
        >
          <option value="">Choose a location</option>
          {LOCATION_PRESETS.map((l) => (
            <option key={l.label} value={l.label}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Latitude (-85 to 85)</span>
        <input
          type="number"
          step="any"
          min={-85}
          max={85}
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Longitude (-180 to 180)</span>
        <input
          type="number"
          step="any"
          min={-180}
          max={180}
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply()
          }}
        />
      </label>
      <div className="inspector-actions">
        <button onClick={() => setLocationDialogOpen(false)}>Cancel</button>
        <button
          onClick={() => {
            setGeoRef(null)
            setLocationDialogOpen(false)
          }}
        >
          Clear location
        </button>
        <button className="primary" disabled={!valid} onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const rightTab = useStore((s) => s.ui.rightTab)
  const setRightTab = useStore((s) => s.setRightTab)
  const theme = useStore((s) => s.ui.theme)
  const workspace = useTeStore((s) => s.ui.workspace)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [rightW, setRightW] = useState(savedRightWidth)

  function setRightWidth(w: number) {
    const next = Math.min(RIGHT_MAX_W, Math.max(RIGHT_MIN_W, w))
    setRightW(next)
    localStorage.setItem(RIGHT_W_KEY, String(next))
  }

  function nudgeRightWidth(e: React.KeyboardEvent) {
    // The panel grows leftward, so ArrowLeft widens it.
    const step = e.shiftKey ? 40 : 8
    const to =
      e.key === 'ArrowLeft'
        ? rightW + step
        : e.key === 'ArrowRight'
          ? rightW - step
          : e.key === 'Home'
            ? RIGHT_MIN_W
            : e.key === 'End'
              ? RIGHT_MAX_W
              : null
    if (to == null) return
    e.preventDefault()
    setRightWidth(to)
  }

  function startRightResize(e: React.MouseEvent) {
    e.preventDefault()
    const from = { x: e.clientX, w: rightW }
    function onMove(ev: MouseEvent) {
      setRightWidth(from.w - (ev.clientX - from.x))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // The one place the theme reaches the document. `system` removes the
  // attribute so the prefers-color-scheme query in index.css decides.
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      // Cmd+K toggles the command palette. Deliberately ahead of the typing
      // suppression so it opens from inside an input; Board workspace only
      // because every palette command is scenario-scoped.
      if (mod && e.key.toLowerCase() === 'k') {
        if (useTeStore.getState().ui.workspace === 'ops') return
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      const st = useStore.getState()
      if (isTypingTarget(e.target)) return
      // Canvas shortcuts stay off inside the T&E workspace.
      if (useTeStore.getState().ui.workspace === 'ops') return
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        st.deleteSelection()
        return
      }
      if (e.key === 'Escape') {
        if (st.ui.locationDialogOpen) {
          st.setLocationDialogOpen(false)
          return
        }
        st.closeContextMenu()
        st.cancelDraft()
        st.setTool('select')
        st.clearSelection()
        return
      }
      if (e.key === 'Enter') {
        if (st.ui.tool === 'boundary') st.finishBoundary(true)
        if (st.ui.tool === 'path') st.finishPath()
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        toggleAnalysisRun()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (workspace === 'ops') {
    return (
      <div className="app">
        <Toolbar />
        <OpsWorkspace />
      </div>
    )
  }

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <Palette />
        <div className="center">
          <CanvasStage />
          <EngagementStrip />
          <TimelineBar />
        </div>
        <aside className="right-panel" style={{ width: rightW }} aria-label="Inspector">
          <div
            className="right-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector"
            aria-valuenow={rightW}
            aria-valuemin={RIGHT_MIN_W}
            aria-valuemax={RIGHT_MAX_W}
            tabIndex={0}
            title="Drag or use the arrow keys to resize"
            onMouseDown={startRightResize}
            onKeyDown={nudgeRightWidth}
          />
          <div className="tabs" role="tablist" aria-label="Inspector views">
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`insp-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={rightTab === t.id}
                aria-controls="insp-tabpanel"
                tabIndex={rightTab === t.id ? 0 : -1}
                className={rightTab === t.id ? 'active' : ''}
                title={t.label}
                onClick={() => setRightTab(t.id)}
                onKeyDown={(e) => moveTab(e, t.id, setRightTab)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            className="right-panel-body"
            id="insp-tabpanel"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`insp-tab-${rightTab}`}
          >
            {rightTab === 'inspect' && <Inspector />}
            {rightTab === 'cards' && <TestCardsPanel />}
            {rightTab === 'library' && <LibraryEditor />}
            {rightTab === 'analysis' && <AnalysisPanel />}
          </div>
        </aside>
      </div>
      <CalibrateDialog />
      <LocationDialog />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}

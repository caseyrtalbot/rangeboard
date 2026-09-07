import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from './state/store'
import type { RightTab, Store } from './state/store'
import type { GeoRef, Vec2 } from './model/types'
import { useTeStore } from './te/state/teStore'
import { OpsWorkspace } from './te/ui/OpsWorkspace'
import { CanvasStage } from './canvas/CanvasStage'
import { BoardTools, Toolbar } from './panels/Toolbar'
import { Palette } from './panels/Palette'
import type { LibraryPlacement } from './panels/Palette'
import { Inspector } from './panels/Inspector'
import { LibraryEditor } from './panels/LibraryEditor'
import { TestCardsPanel } from './panels/TestCardsPanel'
import { AnalysisPanel } from './panels/AnalysisPanel'
import { AnalysisNavigation } from './panels/analysis/AnalysisNavigation'
import { EntityWorkspace } from './panels/EntityWorkspace'
import type { EntityWorkspaceSection } from './panels/EntityWorkspace'
import { BoardPreparation } from './panels/BoardPreparation'
import type { WidgetProps } from './panels/analysis/widgets/registry'
import { formatRunLabel } from './state/labels'
import { EngagementStrip } from './panels/analysis/EngagementStrip'
import { TimelineBar } from './panels/TimelineBar'
import { CommandPalette } from './panels/CommandPalette'
import { toggleAnalysisRun } from './playback/runSession'
import { RIGHT_PANEL_WIDTH_KEY } from './io/storageKeys'
import { readSetting, savedView, writeSetting } from './io/viewState'

const RIGHT_MIN_W = 280
const RIGHT_MAX_W = 560

function savedRightWidth(): number {
  const n = Number(readSetting(RIGHT_PANEL_WIDTH_KEY))
  return n >= RIGHT_MIN_W && n <= RIGHT_MAX_W ? n : 408
}

type BoardPhase = 'prepare' | 'execute' | 'analyze'

const PHASES: { id: BoardPhase; label: string }[] = [
  { id: 'prepare', label: 'Prepare' },
  { id: 'execute', label: 'Execute' },
  { id: 'analyze', label: 'Analyze' },
]

const TABS: { id: RightTab; label: string }[] = [
  { id: 'analysis', label: 'Overview' },
  { id: 'inspect', label: 'Selected object' },
  { id: 'cards', label: 'Test cards' },
  { id: 'library', label: 'Model library' },
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

/** The one selected entity id, when exactly one is selected and it still exists. */
function selectSelectedEntityId(s: Store): string | null {
  if (s.selection.entityIds.length !== 1) return null
  const id = s.selection.entityIds[0]
  return s.scenario.entities.some((entity) => entity.id === id) ? id : null
}

/** True when any canvas object is selected: entity, boundary or connection. */
function selectHasObjectSelection(s: Store): boolean {
  return (
    s.selection.entityIds.length > 0 ||
    s.selection.boundaryId != null ||
    s.selection.connectionId != null
  )
}

/** Selection identity as a primitive, so the section memory needs no object. */
function selectSelectionKey(s: Store): string {
  return s.selection.entityIds.join('|')
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
    <div className="dialog" role="dialog" aria-label="Calibrate image scale">
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
    <div className="dialog" role="dialog" aria-label="Map location">
      <div className="dialog-title">Map location</div>
      <label className="field">
        <span>Preset test location</span>
        <select
          autoFocus
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
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [placement, setPlacement] = useState<LibraryPlacement | null>(null)
  const libraryTrigger = useRef<HTMLButtonElement>(null)
  const [boardPhase, setBoardPhase] = useState<BoardPhase>('prepare')

  useEffect(() => {
    if (savedView().rightTab == null) setRightTab('analysis')
  }, [setRightTab])
  const runSeq = useStore((s) => s.playback.runSeq)
  const runPhase = useStore((s) => s.playback.phase)
  // Primitives only: App renders the whole Board tree, so a whole `selection`
  // or `scenario` subscription re-renders it on every click and every edit.
  const selectedEntityId = useStore(selectSelectedEntityId)
  const hasObjectSelection = useStore(selectHasObjectSelection)
  const selectionKey = useStore(selectSelectionKey)
  const raidDraft = useStore((s) => s.ui.raidDraft)
  const [entityView, setEntityView] = useState<{ key: string; section: EntityWorkspaceSection } | null>(null)
  const entitySection = entityView?.key === selectionKey
    ? entityView.section : boardPhase === 'prepare' ? 'configure' : 'telemetry'
  const setEntitySection = (section: EntityWorkspaceSection) => setEntityView({ key: selectionKey, section })
  const activeTab = rightTab

  const openTelemetry = useCallback(() => {
    // Read the selection at call time so the canvas keeps one stable handler.
    setEntityView({ key: selectSelectionKey(useStore.getState()), section: 'telemetry' })
    setRightTab('inspect')
    requestAnimationFrame(() => document.getElementById('entity-section-telemetry')?.focus())
  }, [setRightTab])

  const closeLibrary = useCallback(() => {
    setLibraryOpen(false)
    libraryTrigger.current?.focus()
  }, [])

  const armPlacement = useCallback((next: LibraryPlacement) => {
    useStore.getState().cancelDraft()
    useStore.getState().closeContextMenu()
    useStore.getState().dismissConnectSuggestion()
    useStore.getState().setTool('select')
    setPlacement(next)
    setLibraryOpen(false)
    requestAnimationFrame(() => document.getElementById('place-at-center')?.focus())
  }, [])

  const placeAt = useCallback((world: Vec2, screen?: Vec2) => {
    if (!placement) return
    const store = useStore.getState()
    if (placement.kind === 'model') store.addEntityFromModel(placement.id, world, screen)
    else store.addSystemFromPreset(placement.id, world)
    setPlacement(null)
    document.querySelector<HTMLElement>('.canvas-host')?.focus()
  }, [placement])

  function placeAtCenter() {
    const rect = document.querySelector('.canvas-host')?.getBoundingClientRect()
    if (!rect) return
    const camera = useStore.getState().camera
    const screen = { x: rect.width / 2, y: rect.height / 2 }
    placeAt({ x: (screen.x - camera.x) / camera.scale, y: (screen.y - camera.y) / camera.scale }, screen)
  }

  useEffect(() => {
    if (!libraryOpen && !placement) return
    function onEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || document.querySelector('.cmdk-panel, .analysis-layout-popover')) return
      event.stopPropagation()
      setLibraryOpen(false)
      setPlacement(null)
      libraryTrigger.current?.focus()
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [libraryOpen, placement])

  useEffect(() => {
    const stopBoard = useStore.subscribe((state, previous) => {
      if (state.ui.tool !== previous.ui.tool || state.ui.raidDraft !== previous.ui.raidDraft ||
        state.scenario !== previous.scenario) setPlacement(null)
    })
    const stopWorkspace = useTeStore.subscribe((state, previous) => {
      if (state.ui.workspace !== previous.ui.workspace) {
        setPlacement(null)
        setLibraryOpen(false)
      }
    })
    return () => {
      stopBoard()
      stopWorkspace()
    }
  }, [])

  function openPhase(phase: BoardPhase) {
    setPlacement(null)
    setLibraryOpen(false)
    setBoardPhase(phase)
    setRightTab('analysis')
  }

  useEffect(() => {
    if (hasObjectSelection && useStore.getState().ui.rightTab !== 'inspect') setRightTab('inspect')
  }, [hasObjectSelection, setRightTab])
  const openPreparation = useCallback<NonNullable<WidgetProps['onOpenPreparation']>>((section) => {
    setBoardPhase('prepare')
    setPlacement(null)
    setLibraryOpen(false)
    setRightTab('analysis')
    requestAnimationFrame(() => {
      const target = document.getElementById(`prepare-${section}`)
      if (!target) return
      if (target instanceof HTMLDetailsElement) target.open = true
      const focusTarget = target.querySelector('summary') ?? target
      focusTarget.focus()
      target.scrollIntoView({ block: 'start' })
    })
  }, [setRightTab])

  const [rightW, setRightW] = useState(savedRightWidth)

  function setRightWidth(w: number) {
    const next = Math.min(RIGHT_MAX_W, Math.max(RIGHT_MIN_W, w))
    setRightW(next)
    writeSetting(RIGHT_PANEL_WIDTH_KEY, String(next))
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
      if (useTeStore.getState().ui.workspace === 'ops') return
      if (e.key === 'Escape' && st.ui.locationDialogOpen) {
        st.setLocationDialogOpen(false)
        document.querySelector<HTMLButtonElement>('[aria-controls="range-setup-menu-panel"]')?.focus()
        return
      }
      if (e.key === 'Escape' && st.ui.calibrateA && st.ui.calibrateB) {
        st.cancelDraft()
        st.setTool('select')
        document.querySelector<HTMLButtonElement>('[aria-controls="range-setup-menu-panel"]')?.focus()
        return
      }
      if (isTypingTarget(e.target)) return
      if (!mod && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setLibraryOpen((open) => {
          if (open) libraryTrigger.current?.focus()
          return !open
        })
        return
      }
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
        st.closeContextMenu()
        st.cancelDraft()
        st.setTool('select')
        st.clearSelection()
        return
      }
      // Native controls keep their keyboard activation; Space elsewhere controls playback.
      if (e.target instanceof HTMLElement && e.target.closest('button, summary, [role=tab]')) return
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
    <div className="app board-app" data-board-phase={boardPhase}>
      <Toolbar />
      <nav className="board-lifecycle" aria-label="Board lifecycle">
        <div className="board-phases" role="tablist" aria-label="Lifecycle views">
          {PHASES.map((phase, index) => (
            <button
              key={phase.id}
              id={`board-phase-${phase.id}`}
              role="tab"
              aria-selected={boardPhase === phase.id}
              aria-controls="board-workspace"
              tabIndex={boardPhase === phase.id ? 0 : -1}
              onClick={() => openPhase(phase.id)}
              onKeyDown={(event) => {
                const to = event.key === 'ArrowRight' ? (index + 1) % PHASES.length
                  : event.key === 'ArrowLeft' ? (index + PHASES.length - 1) % PHASES.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? PHASES.length - 1 : -1
                if (to < 0) return
                event.preventDefault()
                openPhase(PHASES[to].id)
                document.getElementById(`board-phase-${PHASES[to].id}`)?.focus()
              }}
            >
              <span className="num">0{index + 1}</span> {phase.label}
            </button>
          ))}
        </div>
        <span className="board-run-context"><span className="num">{formatRunLabel(runSeq)}</span> · {runPhase}</span>
      </nav>
      <div className="main" id="board-workspace" role="tabpanel" aria-labelledby={`board-phase-${boardPhase}`}>

        <nav className="board-resource-rail" aria-label="Board resources">
          <button ref={libraryTrigger} aria-expanded={libraryOpen} aria-controls="board-library-drawer" onClick={() => setLibraryOpen((open) => !open)} title="Library (L)">
            <span aria-hidden="true">⊞</span>Library
          </button>
          <button onClick={() => { openPhase('prepare'); requestAnimationFrame(() => document.querySelector('.prepare-entity-register')?.scrollIntoView()) }} title="Board entity register">
            <span aria-hidden="true">⌖</span>Objects
          </button>
          <button onClick={() => setRightTab('cards')}><span aria-hidden="true">▤</span>Cards</button>
          <button className="board-keys" onClick={() => setPaletteOpen(true)} title="Command palette (⌘K)"><span aria-hidden="true">⌘</span>Keys</button>
        </nav>
        <div id="board-library-drawer" className="board-library-drawer" hidden={!libraryOpen}>
          <Palette open={libraryOpen} onClose={closeLibrary} onArmPlacement={armPlacement} onPlacementStart={closeLibrary} />
        </div>
        <div className="center">
          <BoardTools onSelectTool={() => setPlacement(null)} />
          {placement && <div className="board-placement" role="region" aria-label="Place library item">
            <span>Place <strong>{placement.name}</strong></span>
            <span className="muted">Click the canvas · Escape cancels</span>
            <button id="place-at-center" className="mini" onClick={placeAtCenter}>Place at center</button>
            <button onClick={() => { setPlacement(null); libraryTrigger.current?.focus() }}>Cancel</button>
          </div>}
          <CanvasStage onOpenDetail={openTelemetry} onPlace={placement ? placeAt : undefined} />
          <EngagementStrip />
          <TimelineBar />
        </div>
        <aside className="right-panel" style={{ width: rightW }} aria-label="Board workspace panel">
          <div className="board-panel-heading">
            <h2>{boardPhase === 'prepare' ? 'Prepare scenario' : boardPhase === 'execute' ? 'Run monitor' : 'Analyze run'}</h2>
          </div>
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
          <div className="tabs" role="tablist" aria-label="Board panel views">
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`insp-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                aria-controls="insp-tabpanel"
                tabIndex={activeTab === t.id ? 0 : -1}
                className={activeTab === t.id ? 'active' : ''}
                title={t.label}
                onClick={() => setRightTab(t.id)}
                onKeyDown={(e) => moveTab(e, t.id, setRightTab)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <AnalysisNavigation onNavigate={() => {
            if (boardPhase === 'prepare') setBoardPhase('analyze')
            setRightTab('analysis')
          }} />
          <div
            className="right-panel-body"
            id="insp-tabpanel"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`insp-tab-${activeTab}`}
          >
            {activeTab === 'inspect' && (selectedEntityId && !raidDraft
              ? <EntityWorkspace
                  entityId={selectedEntityId}
                  section={entitySection}
                  onSectionChange={setEntitySection}
                  onOpenSettings={() => openPreparation('run')}
                  onOverview={() => {
                    setRightTab('analysis')
                    requestAnimationFrame(() => document.getElementById('insp-tab-analysis')?.focus())
                  }}
                />
              : <Inspector />)}
            {activeTab === 'cards' && <TestCardsPanel />}
            {activeTab === 'library' && <LibraryEditor />}
            {activeTab === 'analysis' && (boardPhase === 'prepare'
              ? <BoardPreparation />
              : <AnalysisPanel showNavigation={false} showDetail={false} phase={boardPhase} onOpenPreparation={openPreparation} />)}
          </div>
        </aside>
      </div>
      <CalibrateDialog />
      <LocationDialog />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}

import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useStore } from './state/store'
import type { BoardPhase } from './state/runState'
import { selectBoardPhase } from './state/selectors'
import type { RightTab, Store } from './state/store'
import type { GeoRef, Vec2 } from './model/types'
import { CanvasStage } from './canvas/CanvasStage'
import { IDLE_INTERACTION, routeInteraction } from './canvas/interactionRouter'
import type { Action, InteractionState } from './canvas/interactionRouter'
import { BoardTools, Toolbar } from './panels/Toolbar'
import { Palette } from './panels/Palette'
import type { LibraryPlacement } from './panels/Palette'
import { Inspector } from './panels/Inspector'
import { AnalysisNavigation } from './panels/analysis/AnalysisNavigation'
import { EntityWorkspace } from './panels/EntityWorkspace'
import type { EntityWorkspaceSection } from './panels/EntityWorkspace'
import { LibraryEditor } from './panels/LibraryEditor'
import { BoardPreparation } from './panels/BoardPreparation'
import type { AnalysisScreen } from './panels/analysis/screens/navigation'
import { EngagementStrip } from './panels/analysis/EngagementStrip'
import { TimelineBar, usePlaybackLoop } from './panels/TimelineBar'
import { StatusBar } from './panels/StatusBar'
import { toggleAnalysisRun } from './playback/runSession'
import { ENGSTRIP_OPEN_KEY, RIGHT_PANEL_OPEN_KEY, RIGHT_PANEL_WIDTH_KEY } from './io/storageKeys'
import { readSetting, savedView, writeSetting } from './io/viewState'
import { exportScenario } from './io/persist'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { OpenInputsContext } from './panels/settings/openInputs'
import {
  IconCommands,
  IconEntities,
  IconFrames,
  IconLayers,
  IconLibrary,
  IconMore,
} from './ui/icons'
import { FieldHelpProvider, State } from './ui/kit'
import { usePopover } from './ui/usePopover'
import { nextTabIndex } from './ui/rovingTabs'

// Right-panel tabs and the palette: each opens on demand, so each loads on demand.
// LibraryEditor stays static because EntityWorkspace renders it inline.
const AnalysisPanel = lazy(() =>
  import('./panels/AnalysisPanel').then((m) => ({ default: m.AnalysisPanel })),
)
const CommandPalette = lazy(() =>
  import('./panels/CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
// The cue chunk starts loading as this module runs, before the first render, so an
// edit made early shows its cue soon after.
const undoCue = import('./panels/UndoCue')
const UndoCue = lazy(() => undoCue.then((m) => ({ default: m.UndoCue })))

/** One fallback for every panel boundary: the panel body is empty for one frame. */
function PanelLoading({ label }: { label: string }) {
  return <State tone="inactive">{label}</State>
}

const RIGHT_MIN_W = 280
const RIGHT_MAX_W = 560

function savedRightWidth(): number {
  const n = Number(readSetting(RIGHT_PANEL_WIDTH_KEY))
  return n >= RIGHT_MIN_W && n <= RIGHT_MAX_W ? n : 408
}

/** A resize drag this far past the minimum width closes the drawer. */
const RIGHT_CLOSE_DRAG = 60

function savedRightOpen(): boolean {
  return readSetting(RIGHT_PANEL_OPEN_KEY) !== '0'
}

/** The phase word the panel header shows. */
const PHASE_WORD: Record<BoardPhase, string> = {
  prepare: 'Prepare',
  execute: 'Execute',
  analyze: 'Analyze',
}

/** Arrow-key navigation across the panel tab row (roving tabindex). The row is
 * dynamic: the contextual tabs come and go, so it reads the tabs from the DOM. */
function moveTab(e: React.KeyboardEvent<HTMLElement>) {
  const tabs = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const to = nextTabIndex(e.key, tabs.indexOf(e.target as HTMLButtonElement), tabs.length)
  if (to < 0) return
  e.preventDefault()
  tabs[to].click()
  tabs[to].focus()
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

/** The contextual tab label: what the Selected object view shows, or null for nothing. */
function selectObjectLabel(s: Store): string | null {
  if (s.ui.raidDraft) return 'Raid builder'
  const { entityIds, boundaryId, connectionId } = s.selection
  if (entityIds.length === 1)
    return s.scenario.entities.find((entity) => entity.id === entityIds[0])?.name ?? null
  if (entityIds.length > 1) return `${entityIds.length} entities`
  if (boundaryId) return s.scenario.boundaries.find((b) => b.id === boundaryId)?.name ?? null
  if (connectionId)
    return s.scenario.connections.find((c) => c.id === connectionId)?.label || 'Connection'
  return null
}

/** Selection identity as a primitive, so the section memory needs no object. */
function selectSelectionKey(s: Store): string {
  return s.selection.entityIds.join('|')
}

/** The board resource rail. Memoized: every handler it takes is stable. Layers and
 * Frames route to the surfaces that already hold them (D4): the View menu and the
 * transport, which Prepare does not render. */
const ResourceRail = memo(function ResourceRail({
  libraryOpen,
  libraryTrigger,
  boardPhase,
  onToggleLibrary,
  onOpenEntities,
  onOpenLayers,
  onOpenFrames,
  onOpenCommands,
}: {
  libraryOpen: boolean
  libraryTrigger: React.RefObject<HTMLButtonElement | null>
  boardPhase: BoardPhase
  onToggleLibrary: () => void
  onOpenEntities: () => void
  onOpenLayers: () => void
  onOpenFrames: () => void
  onOpenCommands: () => void
}) {
  const framesOff = boardPhase === 'prepare'
  return (
    <nav className="board-resource-rail" aria-label="Board resources">
      <button
        ref={libraryTrigger}
        aria-label="Library"
        aria-expanded={libraryOpen}
        aria-controls="board-library-drawer"
        onClick={onToggleLibrary}
        title="Library (L)"
      >
        <IconLibrary />
      </button>
      <button aria-label="Entities" onClick={onOpenEntities} title="Entities">
        <IconEntities />
      </button>
      <button aria-label="Layers" onClick={onOpenLayers} title="Layers">
        <IconLayers />
      </button>
      <button
        aria-label="Frames"
        disabled={framesOff}
        onClick={onOpenFrames}
        title={framesOff ? 'Frames (Execute or Analyze)' : 'Frames'}
      >
        <IconFrames />
      </button>
      <button
        className="board-commands"
        aria-label="Commands"
        onClick={onOpenCommands}
        title="Commands (⌘K)"
      >
        <IconCommands />
      </button>
    </nav>
  )
})

/** The right-panel tab row (ARIA tabs): the phase's screens, then the contextual
 * tabs. Memoized: `App` re-renders on every selection change and this row reads
 * only the label it shows. */
const PanelTabs = memo(function PanelTabs({
  activeTab,
  phase,
  screen,
  objectLabel,
  onNavigate,
  setRightTab,
}: {
  activeTab: RightTab
  phase: BoardPhase
  screen: AnalysisScreen
  objectLabel: string | null
  onNavigate: (screen: AnalysisScreen) => void
  setRightTab: (t: RightTab) => void
}) {
  const contextual: { id: RightTab; label: string; dot: boolean }[] = []
  if (activeTab === 'library')
    contextual.push({ id: 'library', label: 'Model library', dot: false })
  if (objectLabel != null) contextual.push({ id: 'inspect', label: objectLabel, dot: true })
  return (
    <div className="insp-tabs" role="tablist" aria-label="Board panel views" onKeyDown={moveTab}>
      <AnalysisNavigation
        phase={phase}
        screen={screen}
        selected={activeTab === 'analysis'}
        onNavigate={onNavigate}
      />
      {contextual.map((t) => (
        <button
          key={t.id}
          id={`insp-tab-${t.id}`}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          aria-controls="insp-tabpanel"
          tabIndex={activeTab === t.id ? 0 : -1}
          className={`insp-tab-context${activeTab === t.id ? ' active' : ''}`}
          title={t.label}
          onClick={() => setRightTab(t.id)}
        >
          {t.dot && <span className="insp-tab-dot" aria-hidden="true" />}
          <span className="insp-tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  )
})

/** Collapsible sections in the panel body: every `details` element there. */
function panelSections(): HTMLDetailsElement[] {
  return [...document.querySelectorAll<HTMLDetailsElement>('#insp-tabpanel details')]
}

/** The panel ⋯ menu: the field help switch (D6), then Collapse all and Expand all. */
function PanelMenu() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = usePopover(wrapRef, buttonRef)
  const showFieldHelp = useStore((s) => s.ui.showFieldHelp)
  const setShowFieldHelp = useStore((s) => s.setShowFieldHelp)
  // Counted when the menu opens: the body may hold no collapsible section.
  const [sections, setSections] = useState(0)
  const setAll = (openAll: boolean) => {
    for (const section of panelSections()) section.open = openAll
    setOpen(false)
    buttonRef.current?.focus()
  }
  const none = sections === 0 ? 'This view has no collapsible sections' : undefined
  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="tb-icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="panel-options-panel"
        aria-label="Panel options"
        title="Panel options"
        onClick={() => {
          setSections(panelSections().length)
          toggle()
        }}
      >
        <IconMore />
      </button>
      {open && (
        <div
          id="panel-options-panel"
          className="tb-menu-panel surface-float tb-menu-right"
          role="dialog"
          aria-label="Panel options"
        >
          <button
            type="button"
            className="tb-menu-item"
            role="switch"
            aria-checked={showFieldHelp}
            onClick={() => setShowFieldHelp(!showFieldHelp)}
          >
            <span className="tb-menu-tick" aria-hidden="true">
              {showFieldHelp ? '✓' : ''}
            </span>
            Show field help
          </button>
          <hr className="tb-menu-sep" />
          <button
            type="button"
            className="tb-menu-item"
            disabled={sections === 0}
            title={none}
            onClick={() => setAll(false)}
          >
            <span className="tb-menu-tick" aria-hidden="true" />
            Collapse all
          </button>
          <button
            type="button"
            className="tb-menu-item"
            disabled={sections === 0}
            title={none}
            onClick={() => setAll(true)}
          >
            <span className="tb-menu-tick" aria-hidden="true" />
            Expand all
          </button>
        </div>
      )}
    </div>
  )
}

function focusRangeSetup() {
  document.querySelector<HTMLButtonElement>('[aria-controls="range-setup-menu-panel"]')?.focus()
}

/** The Escape snapshot: shell state from App, surfaces from the DOM, drafts from the store. */
function escapeState(
  libraryOpen: boolean,
  placementArmed: boolean,
  target: EventTarget | null,
): InteractionState {
  const ui = useStore.getState().ui
  return {
    ...IDLE_INTERACTION,
    paletteOpen: !!document.querySelector('.cmdk-panel'),
    settingsOpen: !!document.querySelector('#settings-panel[open]'),
    roeMenuOpen: !!document.querySelector('#roe-menu-panel'),
    locationDialogOpen: ui.locationDialogOpen,
    libraryOpen,
    placementArmed,
    tool: ui.tool,
    calibratePlaced: !!(ui.calibrateA && ui.calibrateB),
    raidDraft: ui.raidDraft != null,
    connectFrom: ui.connectFromId != null,
    pathStarted: ui.pathEntityId != null,
    typing: isTypingTarget(target),
  }
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
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [placement, setPlacement] = useState<LibraryPlacement | null>(null)
  const libraryTrigger = useRef<HTMLButtonElement>(null)
  const boardPhase = useStore(selectBoardPhase)
  usePlaybackLoop()
  const [prepareScreen, setPrepareScreen] = useState<AnalysisScreen>('fragility')
  const [analyzeScreen, setAnalyzeScreen] = useState<AnalysisScreen>('outcome')
  const analysisScreen =
    boardPhase === 'prepare' ? prepareScreen : boardPhase === 'execute' ? 'now' : analyzeScreen
  const setBoardPhase = useStore((s) => s.setBoardPhase)

  useEffect(() => {
    // A saved view from before the Model library tab left the row opens on analysis.
    const saved = savedView().rightTab
    if (saved == null || saved === 'library') setRightTab('analysis')
  }, [setRightTab])
  // Primitives only: a whole `selection` or `scenario` subscription would re-render
  // the Board tree on every click and every edit.
  const selectedEntityId = useStore(selectSelectedEntityId)
  const hasObjectSelection = useStore(selectHasObjectSelection)
  const objectLabel = useStore(selectObjectLabel)
  const showFieldHelp = useStore((s) => s.ui.showFieldHelp)
  const selectionKey = useStore(selectSelectionKey)
  const raidDraft = useStore((s) => s.ui.raidDraft)
  const calibrating = useStore((s) => s.ui.tool === 'calibrate')
  const boardEmpty = useStore((s) => s.scenario.entities.length === 0)
  const [entityView, setEntityView] = useState<{
    key: string
    section: EntityWorkspaceSection
  } | null>(null)
  const entitySection =
    entityView?.key === selectionKey
      ? entityView.section
      : boardPhase === 'prepare'
        ? 'configure'
        : 'telemetry'
  const setEntitySection = (section: EntityWorkspaceSection) =>
    setEntityView({ key: selectionKey, section })
  // The Selected object tab renders only while it has something to show.
  const activeTab: RightTab = rightTab === 'inspect' && objectLabel == null ? 'analysis' : rightTab

  // The right drawer. A selection switches its tab but never reopens it.
  const [rightOpen, setRightOpenState] = useState(savedRightOpen)
  // setRightOpen is the one writer, so the ref and the state stay in step.
  const rightOpenNow = useRef(rightOpen)
  // Canvas width before a drawer change, so the layout effect below holds the board center.
  const centerFrom = useRef<number | null>(null)

  const setRightOpen = useCallback((open: boolean) => {
    if (open === rightOpenNow.current) return
    if (!open && document.activeElement?.closest('.right-panel'))
      document.getElementById('drawer-toggle')?.focus()
    centerFrom.current = document.querySelector('.canvas-host')?.clientWidth ?? null
    rightOpenNow.current = open
    setRightOpenState(open)
    writeSetting(RIGHT_PANEL_OPEN_KEY, open ? '1' : '0')
  }, [])
  const toggleRight = useCallback(() => setRightOpen(!rightOpenNow.current), [setRightOpen])

  // The engagement strip open flag. Only this column reads it. The ref keeps one
  // stable toggle, so the memoized playback bar holds its memo.
  const [engagementOpen, setEngagementOpen] = useState(() => readSetting(ENGSTRIP_OPEN_KEY) === '1')
  const engagementOpenNow = useRef(engagementOpen)
  const toggleEngagement = useCallback(() => {
    const next = !engagementOpenNow.current
    engagementOpenNow.current = next
    writeSetting(ENGSTRIP_OPEN_KEY, next ? '1' : '0')
    setEngagementOpen(next)
  }, [])

  useLayoutEffect(() => {
    const from = centerFrom.current
    centerFrom.current = null
    const to = document.querySelector('.canvas-host')?.clientWidth
    if (from == null || to == null || to === from) return
    const { camera, setCamera } = useStore.getState()
    setCamera({ ...camera, x: camera.x + (to - from) / 2 })
  }, [rightOpen])

  const openTelemetry = useCallback(() => {
    // Read the selection at call time so the canvas keeps one stable handler.
    setEntityView({ key: selectSelectionKey(useStore.getState()), section: 'telemetry' })
    setRightTab('inspect')
    setRightOpen(true)
    requestAnimationFrame(() => document.getElementById('entity-section-telemetry')?.focus())
  }, [setRightTab, setRightOpen])

  const closeLibrary = useCallback(() => {
    setLibraryOpen(false)
    libraryTrigger.current?.focus()
  }, [])

  const armPlacement = useCallback((next: LibraryPlacement) => {
    if (routeInteraction({ kind: 'arm-placement' }, IDLE_INTERACTION).type !== 'arm-placement')
      return
    const store = useStore.getState()
    store.cancelDraft()
    store.closeContextMenu()
    store.dismissConnectSuggestion()
    store.setTool('select')
    setPlacement(next)
    setLibraryOpen(false)
    requestAnimationFrame(() => document.getElementById('place-at-center')?.focus())
  }, [])

  const placeAt = useCallback(
    (world: Vec2, screen?: Vec2) => {
      if (!placement) return
      const store = useStore.getState()
      if (placement.kind === 'model') store.addEntityFromModel(placement.id, world, screen)
      else store.addSystemFromPreset(placement.id, world)
      setPlacement(null)
      document.querySelector<HTMLElement>('.canvas-host')?.focus()
    },
    [placement],
  )

  function placeAtCenter() {
    const rect = document.querySelector('.canvas-host')?.getBoundingClientRect()
    if (!rect) return
    const camera = useStore.getState().camera
    const screen = { x: rect.width / 2, y: rect.height / 2 }
    placeAt(
      { x: (screen.x - camera.x) / camera.scale, y: (screen.y - camera.y) / camera.scale },
      screen,
    )
  }

  // The bubble-phase keyboard map has no deps, so it reads shell state through this ref.
  const shell = useRef({ libraryOpen: false, placementArmed: false })
  shell.current = { libraryOpen, placementArmed: placement != null }

  // One dispatcher for every Escape action the router returns.
  const dispatchEscape = useCallback((action: Action) => {
    const st = useStore.getState()
    switch (action.type) {
      case 'close-location-dialog':
        st.setLocationDialogOpen(false)
        focusRangeSetup()
        return
      case 'cancel-placement':
        setLibraryOpen(false)
        setPlacement(null)
        libraryTrigger.current?.focus()
        return
      case 'cancel-calibration':
        st.cancelDraft()
        st.setTool('select')
        focusRangeSetup()
        return
      case 'clear-board':
        st.closeContextMenu()
        st.cancelDraft()
        st.setTool('select')
        st.clearSelection()
        return
      default:
        return
    }
  }, [])

  useEffect(() => {
    if (!libraryOpen && !placement) return
    // Capture phase, so the placement cancels ahead of the canvas shortcut.
    function onEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      const action = routeInteraction(
        { kind: 'escape' },
        escapeState(libraryOpen, placement != null, event.target),
      )
      if (action.type !== 'cancel-placement') return
      event.stopPropagation()
      dispatchEscape(action)
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [libraryOpen, placement, dispatchEscape])

  useEffect(() => {
    const stopBoard = useStore.subscribe((state, previous) => {
      if (
        state.ui.tool !== previous.ui.tool ||
        state.ui.raidDraft !== previous.ui.raidDraft ||
        state.scenario.entities.length !== previous.scenario.entities.length ||
        state.scenario.systemPresets.length !== previous.scenario.systemPresets.length
      )
        setPlacement(null)
    })
    return () => {
      stopBoard()
    }
  }, [])

  const openPhase = useCallback(
    (phase: BoardPhase) => {
      setPlacement(null)
      setLibraryOpen(false)
      setBoardPhase(phase)
      setRightTab('analysis')
    },
    [setBoardPhase, setRightTab],
  )

  // Stable handlers for the memoized chrome, so a selection change stops at `App`.
  const clearPlacement = useCallback(() => {
    if (routeInteraction({ kind: 'tool-change' }, IDLE_INTERACTION).type === 'clear-placement')
      setPlacement(null)
  }, [])
  const toggleLibrary = useCallback(() => setLibraryOpen((open) => !open), [])
  const openEntities = useCallback(() => {
    openPhase('prepare')
    setPrepareScreen('inputs')
    setRightOpen(true)
    requestAnimationFrame(() =>
      document.querySelector('.prepare-entity-register')?.scrollIntoView(),
    )
  }, [openPhase, setRightOpen])
  const openCommands = useCallback(() => setPaletteOpen(true), [])
  // D4: Layers opens the View menu at its Layers section. DOM-driven, so the rail
  // needs no store state: the tool row owns the menu and its open state.
  const openLayers = useCallback(() => {
    if (!document.getElementById('view-menu-panel'))
      document
        .querySelector<HTMLButtonElement>('.board-tools [aria-controls="view-menu-panel"]')
        ?.click()
    requestAnimationFrame(() => {
      document.getElementById('view-menu-layers')?.scrollIntoView()
      // The first control inside the Layers section.
      document.querySelector<HTMLElement>('#view-menu-layers :is(button,input,select)')?.focus()
    })
  }, [])
  // D4: Frames focuses + Frame in the transport, which Execute and Analyze render.
  const openFrames = useCallback(() => document.getElementById('frame-add')?.focus(), [])
  const navigateAnalysis = useCallback(
    (screen: AnalysisScreen) => {
      if (screen === 'fragility' || screen === 'inputs' || screen === 'placement')
        setPrepareScreen(screen)
      if (screen === 'outcome' || screen === 'compare') setAnalyzeScreen(screen)
      setRightTab('analysis')
    },
    [setRightTab],
  )

  useEffect(() => {
    if (hasObjectSelection && useStore.getState().ui.rightTab !== 'inspect') setRightTab('inspect')
  }, [hasObjectSelection, setRightTab])
  const openPreparation = useCallback(
    (section: 'run' | 'environment' | 'doctrine' | 'requirements') => {
      setPrepareScreen('inputs')
      setBoardPhase('prepare')
      setPlacement(null)
      setLibraryOpen(false)
      setRightTab('analysis')
      setRightOpen(true)
      requestAnimationFrame(() => {
        const target = document.getElementById(`prepare-${section}`)
        if (!target) return
        if (target instanceof HTMLDetailsElement) target.open = true
        const focusTarget = target.querySelector('summary') ?? target
        focusTarget.focus()
        target.scrollIntoView({ block: 'start' })
      })
    },
    [setBoardPhase, setRightTab, setRightOpen],
  )
  const openDoctrine = useCallback(() => openPreparation('doctrine'), [openPreparation])

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
      const next = from.w - (ev.clientX - from.x)
      if (next < RIGHT_MIN_W - RIGHT_CLOSE_DRAG) {
        onUp()
        setRightOpen(false)
        return
      }
      setRightWidth(next)
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // The one place the theme reaches the document. `system` removes the attribute,
  // so the prefers-color-scheme query in index.css decides.
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (document.querySelector('#settings-panel[open]')) return
      const mod = e.metaKey || e.ctrlKey
      // Ahead of the typing suppression, so the palette opens from inside an input.
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      const st = useStore.getState()
      if (e.key === 'Escape') {
        const { libraryOpen, placementArmed } = shell.current
        dispatchEscape(
          routeInteraction({ kind: 'escape' }, escapeState(libraryOpen, placementArmed, e.target)),
        )
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
      if (!mod && e.key === ']') {
        e.preventDefault()
        toggleRight()
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
  }, [dispatchEscape, toggleRight])

  const board = (
    <div className="app board-app" data-board-phase={boardPhase}>
      <Toolbar
        drawerOpen={rightOpen}
        onToggleDrawer={toggleRight}
        boardPhase={boardPhase}
        onOpenPhase={openPhase}
      />
      <div
        className="main"
        id="board-workspace"
        role="tabpanel"
        aria-labelledby={`board-phase-${boardPhase}`}
      >
        <ResourceRail
          libraryOpen={libraryOpen}
          libraryTrigger={libraryTrigger}
          boardPhase={boardPhase}
          onToggleLibrary={toggleLibrary}
          onOpenEntities={openEntities}
          onOpenLayers={openLayers}
          onOpenFrames={openFrames}
          onOpenCommands={openCommands}
        />
        <div className="center">
          <BoardTools onSelectTool={clearPlacement} />
          {placement && (
            <div className="board-placement" role="region" aria-label="Place library item">
              <span>
                Place <strong>{placement.name}</strong>
              </span>
              <span className="muted">Click the canvas · Escape cancels</span>
              <button id="place-at-center" className="mini" onClick={placeAtCenter}>
                Place at center
              </button>
              <button
                onClick={() => {
                  setPlacement(null)
                  libraryTrigger.current?.focus()
                }}
              >
                Cancel
              </button>
            </div>
          )}
          {calibrating && (
            <div className="board-placement" role="status" aria-label="Calibrating image scale">
              <span>
                <strong>Calibrating</strong> image scale
              </span>
              <span className="muted">Click two points on the image · Escape cancels</span>
              <button
                onClick={() => {
                  const st = useStore.getState()
                  st.cancelDraft()
                  st.setTool('select')
                }}
              >
                Cancel
              </button>
            </div>
          )}
          {/* The drawer overlays the canvas only: the tools row and the timeline stay in reach. */}
          <div className="board-stage">
            <div id="board-library-drawer" className="board-library-drawer" hidden={!libraryOpen}>
              <Palette
                open={libraryOpen}
                onClose={closeLibrary}
                onArmPlacement={armPlacement}
                onPlacementStart={closeLibrary}
              />
            </div>
            {boardEmpty && !libraryOpen && !placement && (
              <div className="board-empty-hint surface-float" role="note">
                <span>Add a system: press L or right-click the board</span>
                <button className="mini" onClick={toggleLibrary}>
                  Open library (L)
                </button>
              </div>
            )}
            <CanvasStage onOpenDetail={openTelemetry} onPlace={placement ? placeAt : undefined} />
            <Suspense fallback={null}>
              <UndoCue />
            </Suspense>
          </div>
          {boardPhase !== 'prepare' && engagementOpen && <EngagementStrip />}
          {boardPhase !== 'prepare' && (
            <TimelineBar engagementOpen={engagementOpen} onToggleEngagement={toggleEngagement} />
          )}
          <StatusBar />
        </div>
        <aside
          id="board-workspace-panel"
          className="right-panel"
          style={{ width: rightW }}
          hidden={!rightOpen}
          aria-label="Board workspace panel"
        >
          <div className="board-panel-heading insp-head">
            <h2>{PHASE_WORD[boardPhase]}</h2>
            <PanelMenu />
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
          <PanelTabs
            activeTab={activeTab}
            phase={boardPhase}
            screen={analysisScreen}
            objectLabel={objectLabel}
            onNavigate={navigateAnalysis}
            setRightTab={setRightTab}
          />
          <FieldHelpProvider value={showFieldHelp}>
            <div
              className="right-panel-body"
              id="insp-tabpanel"
              role="tabpanel"
              tabIndex={0}
              aria-labelledby={`insp-tab-${activeTab}`}
            >
              {activeTab === 'inspect' &&
                (selectedEntityId && !raidDraft ? (
                  <EntityWorkspace
                    entityId={selectedEntityId}
                    section={entitySection}
                    onSectionChange={setEntitySection}
                    onOpenSettings={() => openPreparation('run')}
                    onOverview={() => {
                      setRightTab('analysis')
                      requestAnimationFrame(() =>
                        document.getElementById('insp-tab-analysis')?.focus(),
                      )
                    }}
                  />
                ) : (
                  <Inspector />
                ))}
              {activeTab === 'library' && <LibraryEditor />}
              {activeTab === 'analysis' &&
                (analysisScreen === 'inputs' ? (
                  <BoardPreparation />
                ) : (
                  <Suspense fallback={<PanelLoading label="Loading analysis" />}>
                    <AnalysisPanel phase={boardPhase} screen={analysisScreen} />
                  </Suspense>
                ))}
            </div>
          </FieldHelpProvider>
        </aside>
      </div>
      <CalibrateDialog />
      <LocationDialog />
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette onClose={() => setPaletteOpen(false)} />
        </Suspense>
      )}
    </div>
  )
  return (
    <ErrorBoundary
      key="board"
      label="Board"
      onExport={() => exportScenario(useStore.getState().scenario)}
    >
      <OpenInputsContext.Provider value={openDoctrine}>{board}</OpenInputsContext.Provider>
    </ErrorBoundary>
  )
}

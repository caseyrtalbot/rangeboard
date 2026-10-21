import { create } from 'zustand'
import type {
  BasemapMode,
  Boundary,
  BoundaryType,
  CapOrbit,
  Connection,
  Entity,
  EntityKind,
  FlightPath,
  FrameSnap,
  GeoRef,
  RunLogEntry,
  Scenario,
  SpecModel,
  SystemPreset,
  TestCard,
  Vec2,
} from '../model/types'
import { dropEditedProvenance, newId } from '../model/types'
import type { SpecEditField, SpecEditValue } from '../model/specEdit'
import { editSpecField } from '../model/specEdit'
import type { RingKey, RingOverrides } from './rings'
import type { LayerKey, LayerPreset, LayerVisibility } from './layers'
import { LAYER_PRESETS } from './layers'
import { selectEffectiveLayers } from './selectors'
import type { BoardPhase, McState, PlaybackState, RunResetReason, TrialState } from './runState'
import type { AnalysisScreen } from '../panels/analysis/screens/navigation'
import { freshPlayback, IDLE_MC, IDLE_OPTIMIZE, IDLE_TRIAL } from './runState'
import type { ScenarioInstall, Selection } from './scenarioInstall'
import { EMPTY_SELECTION, installScenario, runsForOverridesChange } from './scenarioInstall'
import { useOverrides } from './overrides'
import { reportOverrideFault } from './overrideFault'
import type { PlaybackCommand } from './playbackCommands'
import type { PinnedBaseline } from './baseline'
import { buildBaseline } from './baseline'
import { analysisBasisSignature } from './analysisBasis'
import { resolvePlayback } from './playbackCommands'
import type { TrialWorkerMessage } from '../playback/trialMessages'
import { releaseRetainedTrial } from '../playback/retainTrial'
import { buildRaid, raidDraftFor } from './raidBuilder'
import {
  bumpCardVersion,
  defaultConnectionLabel,
  defaultFrameName,
  KIND_NAMES,
  typedConnections,
} from './labels'
import { fitCameraTo } from './camera'
import { emptyScenario } from '../model/seed'
import { importModels, resetBuiltin } from '../model/libraryLifecycle'
import { describeConfiguration, describeThreats, standardCovariates } from '../model/seedCards'
import { rotatePoint } from '../geometry/geo'
import { CAP_DEFAULT_LAPS, CAP_MIN_RADIUS_M, capPathPoints, capRadiusFrom } from '../model/cap'
import type { DisplayUnits } from '../geometry/geo'
import { evaluateIntegration, profileFor, suggestLinksFor } from '../model/integration'
import type { SuggestedLink } from '../model/integration'
import {
  savedLayers,
  savedRingOverrides,
  savedRunSeq,
  savedUnits,
  readSetting,
  savedView,
  writeLayers,
  writeRingOverrides,
  writeRunSeq,
  writeSetting,
  writeUnits,
  writeView,
  writeViewCamera,
} from '../io/viewState'
import { ENGSTRIP_OPEN_KEY, RUN_TIMELINE_HEIGHT_KEY } from '../io/storageKeys'
import type { McSweepMessage, McWorkerMessage, SensitivityResponse } from '../playback/mcRun'
import type { AnalysisSinks, OptimizeSpec, SensitivityMessage, SweepSpec } from './analysisRequests'
import type { Laydown, OptimizeResult, OptimizeWorkerMessage } from '../playback/optimizeTypes'
import type { RunTimelineKind } from '../analysis/runTimeline'
import type { TimeViewport } from '../charts/timeViewport'
import {
  acceptMcMessage,
  acceptOptimizeMessage,
  acceptPoolProgress,
  acceptSensitivityMessage,
  acceptSweepMessage,
  acceptTrialMessage,
  cancelAnalysis,
  requestAnalysis,
  requestCancel,
  requestOptimize,
  requestSobol,
} from './analysisRequests'

/** Lens id stamped on every run; `Scenario.observedPresetId` keeps saved scenarios loadable. */
const OBSERVED_PRESET_ID = 'run-summary'

export type Tool = 'select' | 'boundary' | 'connect' | 'path' | 'cap' | 'calibrate'
export type RightTab = 'inspect' | 'analysis'
/** Theme choice. `system` follows the OS colour-scheme query; the other two pin it. */
export type Theme = 'system' | 'dark' | 'light'

export interface Camera {
  x: number
  y: number
  /** Pixels per meter. */
  scale: number
}

/** Armed tactic-builder state. UI only; commitRaid turns it into scenario changes. */
export interface RaidDraft {
  tacticId: string
  platformSpecId: string | null
  targetEntityId: string | null
  shipCount: number
}

export interface UiState {
  /** Session-only navigation; never persisted or undoable. */
  boardPhase: BoardPhase
  /** Execute layer override, retained only for this session. */
  executeLayers: LayerVisibility | null
  basemap: BasemapMode
  tool: Tool
  boundaryType: BoundaryType
  /** In-progress boundary or path points, world meters; under 'cap', the orbit center. */
  draftPoints: Vec2[]
  /** Entity that a new path or ISR CAP is being drawn for. */
  pathEntityId: string | null
  connectFromId: string | null
  calibrateA: Vec2 | null
  calibrateB: Vec2 | null
  rightTab: RightTab
  /** Theme choice. Not undoable; kept in the saved view record. */
  theme: Theme
  /** Field help lines shown as text. Not undoable; kept in the saved view record. */
  showFieldHelp: boolean
  /** When true the sat underlay is draggable for placement. */
  moveUnderlay: boolean
  /** Canvas layer visibility, 17 keys. Not undoable; kept in its own localStorage key. */
  layers: LayerVisibility
  /** Per-entity ring overrides. Not undoable; kept in its own localStorage key. */
  ringOverrides: RingOverrides
  /** Display units for distances and speeds. Not undoable; kept in its own localStorage key. */
  units: DisplayUnits
  /** Open right-click menu; screen px within the canvas host, world meters. */
  contextMenu: { screen: Vec2; world: Vec2; entityId: string | null } | null
  /**
   * Connect offers after placing or dragging a linkable entity; screen px within
   * the canvas host. `autoConnected` links already exist; `candidates` await a click.
   */
  connectSuggestion: {
    entityId: string
    screen: Vec2
    candidates: SuggestedLink[]
    autoConnected: SuggestedLink[]
  } | null
  /** Armed tactic builder; the next canvas click commits the raid. */
  raidDraft: RaidDraft | null
  /** Sat basemap location dialog visibility. */
  locationDialogOpen: boolean
  /**
   * The last `openLibrary` call. App opens the left drawer when `seq` moves; the
   * drawer focuses the `kind` group, or shows the editor for `modelId`.
   */
  libraryRequest: LibraryRequest
  /**
   * The last `requestPlacement` call. App arms board placement of `modelId` when `seq`
   * moves, the same arming the Library drawer performs. Session only.
   */
  placementRequest: PlacementRequest
  /**
   * Where the last selection came from. A board selection switches the right panel to
   * the Selected object tab; a panel row keeps the current tab (D7). Session only.
   */
  selectionOrigin: SelectionOrigin
  /**
   * The placement candidate drawn on the board, and the result it came from. The board
   * draws it only while that result is still the current one. Session only; never
   * written to the scenario or the undo history.
   */
  placementPreview: PlacementPreview | null
  /** Collapsible panel sections by DOM id. A missing id reads its default. Session only. */
  openSections: Record<string, boolean>
  /** The Validity line under the tab row is open. Session only. */
  validityOpen: boolean
  /**
   * The last `requestPanel` call. App opens the drawer at the phase, the screen and
   * the section when `seq` moves.
   */
  panelRequest: PanelRequest
  /** Run timeline strip under the board. */
  runTimeline: RunTimelineUi
}

/** Strip height limits, px. The upper limit is this fraction of the window height. */
export const RUN_TIMELINE_MIN_H = 120
export const RUN_TIMELINE_DEFAULT_H = 264
export const RUN_TIMELINE_MAX_FRACTION = 0.6

/** Run timeline state. Only `open` and `heightPx` persist; the rest is session only. */
export interface RunTimelineUi {
  open: boolean
  heightPx: number
  /** Groups expanded from their summary row; every group starts collapsed. */
  openGroups: readonly RunTimelineKind[]
  /** Sensor row keys expanded to one sub-lane per held track. */
  openSensors: readonly string[]
  /**
   * Expand all is in force: every sensor row with a held track is open,
   * including a row that gains its first track later. Collapse all or a
   * single sensor toggle clears it.
   */
  openSensorsAll: boolean
  /** Same-name threat folds (past GROUP_AT rows) expanded to their members, by fold key. */
  openFolds: readonly string[]
  /** Row keys hidden with the row's × control. */
  hiddenRows: readonly string[]
  /** The viewport keeps the playhead at FOLLOW_AT of the width. */
  follow: boolean
  /** null reads as `{ t0S: 0, winS: DEFAULT_WINDOW_S }`, clamped to the run. */
  viewport: TimeViewport | null
}

export interface PlacementRequest {
  seq: number
  modelId: string | null
}

/** One request to open the library drawer. `seq` counts the calls; 0 is none. */
export interface LibraryRequest {
  seq: number
  kind: EntityKind | null
  modelId: string | null
}

export type SelectionOrigin = 'board' | 'panel'

/** One placement candidate on the board: its rank, its positions and the result it belongs to. */
export interface PlacementPreview {
  rank: number
  positions: Laydown
  source: OptimizeResult
}

/** A request to show one place in the right panel. A null field keeps the current value. */
export interface PanelRequest {
  seq: number
  phase: BoardPhase | null
  screen: AnalysisScreen | null
  /** The DOM id of a section to open and scroll into view. */
  section: string | null
}

/** Autosave status. Its own slice so a write does not re-render every ui subscriber. */
interface SaveState {
  /** Epoch ms of the last successful autosave write; null before the first. */
  lastAutosaveAt: number | null
  /** Why the last write failed; null when the last write succeeded. */
  error: string | null
}

export interface Store {
  scenario: Scenario
  past: Scenario[]
  future: Scenario[]
  selection: Selection
  camera: Camera
  ui: UiState
  playback: PlaybackState
  /** Monte Carlo run state. View state: never persisted, never in history. */
  mc: McState
  /** Captured simulated trial shared by playback and execution views; never persisted. */
  trial: TrialState
  /** Pinned laydown and ensemble for Compare. Its own persisted key; never in history. */
  baseline: PinnedBaseline | null
  save: SaveState

  // History
  undo: () => void
  redo: () => void

  // Scenario lifecycle
  /**
   * Install a scenario as the whole board: history, selection, every draft and
   * interaction state, and the playback run are reset. The run sequence is kept.
   */
  replaceScenario: (s: Scenario) => void
  /**
   * Replace the scenario, then fit the camera to its entities and paths. `fit`
   * defaults to `if-unsaved`, which keeps the camera the user left.
   */
  loadScenario: (s: Scenario, opts?: { fit?: 'always' | 'if-unsaved' }) => void
  setScenarioName: (name: string) => void

  // Entities
  addEntityFromModel: (modelId: string, pos: Vec2, screen?: Vec2) => void
  updateEntity: (id: string, patch: Partial<Entity>) => void
  moveEntity: (id: string, pos: Vec2) => void
  duplicateEntity: (id: string) => void
  deleteSelection: () => void

  // Systems
  addSystemFromPreset: (presetId: string, center: Vec2, headingDeg?: number) => void
  saveSelectionAsSystem: (name: string) => void
  deleteSystemPreset: (id: string) => void
  selectSystem: (systemId: string) => void
  rotateSystem: (systemId: string, deltaDeg: number) => void

  // Context menu
  openContextMenu: (screen: Vec2, world: Vec2, entityId: string | null) => void
  closeContextMenu: () => void

  // Connections
  beginConnect: (fromId: string) => void
  completeConnect: (toId: string) => void
  updateConnection: (id: string, patch: Partial<Connection>) => void
  /** `always` opens the popup even with zero candidates (informational mode). */
  openConnectSuggestion: (entityId: string, screen: Vec2, opts?: { always?: boolean }) => void
  dismissConnectSuggestion: () => void
  /** ONE mutate creating the chosen candidate connections; duplicates skipped. */
  applyConnectSuggestion: (indexes: number[]) => void

  // Boundaries and paths
  addDraftPoint: (p: Vec2) => void
  finishBoundary: (closed: boolean) => void
  beginPath: (entityId: string) => void
  finishPath: () => void
  /** Arms the ISR CAP tool: the next click sets the orbit center, the one after the radius. */
  beginCap: (entityId: string) => void
  /** ONE mutate replacing the entity's path with a CAP centered on the draft point. */
  finishCap: (edge: Vec2) => void
  /** Merges a CAP patch and regenerates the points from the entity's current position. */
  updateCap: (pathId: string, patch: Partial<CapOrbit>) => void
  cancelDraft: () => void
  updateBoundary: (id: string, patch: Partial<Boundary>) => void
  updatePath: (id: string, patch: Partial<FlightPath>) => void
  deletePathForEntity: (entityId: string) => void

  // Raid waves
  assignToWave: (entityId: string, waveIndex: number | null) => void
  setWaveDelay: (waveIndex: number, s: number) => void

  // Tactic raid builder (draft is ui state; only commitRaid touches the scenario)
  armRaidDraft: (tacticId: string) => void
  patchRaidDraft: (p: Partial<RaidDraft>) => void
  /** One mutate() builds the whole raid; null anchor = tactic default bearing. */
  commitRaid: (axisAnchor: Vec2 | null) => void
  cancelRaidDraft: () => void

  // Environment
  updateEnvironment: (patch: Partial<Scenario['environment']>) => void

  // Scenario-level settings (engage policy, MCDA weights, pinned scorecards)
  patchScenario: (patch: Partial<Scenario>) => void

  // Underlay
  setUnderlayImage: (dataUrl: string, naturalW: number, naturalH: number) => void
  updateUnderlay: (patch: Partial<Scenario['underlay']>) => void
  setCalibratePoint: (p: Vec2) => void
  applyCalibration: (trueDistM: number) => void
  setGeoRef: (g: GeoRef | null) => void
  applyLocation: (g: GeoRef, fieldElevationFt: number | null) => void

  // Library
  addModel: (kind: EntityKind) => string
  duplicateModel: (id: string) => string
  updateModel: (id: string, patch: Partial<SpecModel>) => void
  /**
   * Edit one named spec field of a model. `editSpecField` owns the field rules;
   * the store adds provenance invalidation and one undo step per edit. A
   * rejected or absent field writes nothing.
   */
  editModel: (id: string, field: SpecEditField, value: SpecEditValue) => void
  deleteModel: (id: string) => void
  /** Restore a builtin model to its seed definition. A custom model is left as it is. */
  resetModelToSeed: (id: string) => void
  mergeLibrary: (models: SpecModel[]) => void

  // Test cards
  addCard: (patch?: Partial<TestCard>) => string
  /** New card linked to the selected entities, with configuration and threat text generated from the canvas. */
  addCardFromSelection: () => string
  /** Duplicate a card as the next version: same cardId, minor bump, empty run log. */
  newCardVersion: (id: string) => string
  updateCard: (id: string, patch: Partial<TestCard>) => void
  deleteCard: (id: string) => void
  toggleCardEntity: (cardId: string, entityId: string) => void
  addRun: (cardId: string) => void
  updateRun: (cardId: string, runId: string, patch: Partial<RunLogEntry>) => void

  // Frames
  saveFrame: (name: string) => void
  applyFrame: (id: string) => void
  deleteFrame: (id: string) => void

  // Selection / camera / ui
  /** `origin` is `'board'` unless a panel row makes the selection (D7). */
  select: (patch: Partial<Selection>, additive?: boolean, origin?: SelectionOrigin) => void
  clearSelection: () => void
  setCamera: (c: Camera) => void
  setTool: (t: Tool) => void
  setBasemap: (b: BasemapMode) => void
  setBoundaryType: (t: BoundaryType) => void
  setRightTab: (t: RightTab) => void
  /**
   * Open the library drawer at the `kind` group. With `modelId`, select that model
   * and show its editor in the drawer.
   */
  openLibrary: (kind?: EntityKind, modelId?: string) => void
  setSectionOpen: (id: string, open: boolean) => void
  /** Sets every listed section id; Collapse all and Expand all pass the ids on screen. */
  setAllSections: (open: boolean, ids: string[]) => void
  setValidityOpen: (open: boolean) => void
  setPlacementPreview: (preview: PlacementPreview | null) => void
  requestPanel: (request: Omit<PanelRequest, 'seq'>) => void
  /** Arm board placement of one library model, as the Library drawer's Place does. */
  requestPlacement: (modelId: string) => void
  setShowFieldHelp: (v: boolean) => void
  setTheme: (t: Theme) => void
  setMoveUnderlay: (v: boolean) => void
  setRunTimelineOpen: (open: boolean) => void
  /**
   * Clamps to at least RUN_TIMELINE_MIN_H; the resizer applies the window limit.
   * `persist` false skips the storage write: a drag updates the store per frame
   * and saves once when it ends.
   */
  setRunTimelineHeight: (px: number, persist?: boolean) => void
  toggleRunTimelineGroup: (key: RunTimelineKind) => void
  /**
   * One sensor row open or closed; clears `openSensorsAll`. `shownOpen` lists
   * the sensor rows open on screen and is required while the flag is on. The
   * toggle then starts from `openSensors` plus `shownOpen`, so clearing the flag
   * closes no other row, including a hidden row or one in a collapsed group or
   * a closed fold.
   */
  toggleRunTimelineSensor: (rowKey: string, shownOpen?: readonly string[]) => void
  toggleRunTimelineFold: (foldKey: string) => void
  hideRunTimelineRow: (rowKey: string) => void
  showAllRunTimelineRows: () => void
  /** Follow on. To turn it off, pass the shown viewport to `setRunTimelineViewport`. */
  setRunTimelineFollow: (follow: boolean) => void
  /**
   * With `follow`, sets Follow in the same write. A pan passes the panned viewport
   * and false; Follow off passes the shown viewport and false, so nothing jumps.
   */
  setRunTimelineViewport: (viewport: TimeViewport, follow?: boolean) => void
  /**
   * Collapse all: every group back to its summary row and `openSensorsAll`
   * off. Sensor rows opened one by one keep their state.
   */
  collapseAllRunTimeline: () => void
  /**
   * Expand all: `groups` open, `sensorRows` open to their sub-lanes and
   * `openSensorsAll` on, in one write.
   */
  expandAllRunTimeline: (groups: readonly RunTimelineKind[], sensorRows: readonly string[]) => void
  /**
   * A mark seek (SPEC 1.5): Follow off with the viewport held at `shown`, then
   * the `scrub` command to `tS`. Observation never advances.
   */
  seekRunTimeline: (tS: number, shown: TimeViewport) => void
  setBoardPhase: (phase: BoardPhase) => void
  setLayer: (key: LayerKey, v: boolean) => void
  toggleLayer: (key: LayerKey) => void
  applyLayerPreset: (p: LayerPreset) => void
  /** Force one ring on or off for one entity; null drops back to the layer flag. */
  setRingOverride: (entityId: string, key: RingKey, on: boolean | null) => void
  setLocationDialogOpen: (v: boolean) => void
  setUnits: (v: DisplayUnits) => void
  setSaveState: (lastAutosaveAt: number | null, error: string | null) => void

  // Playback
  setPlaying: (p: boolean) => void
  setSimTime: (t: number) => void
  setSpeedMult: (m: number) => void
  startRun: () => void
  pauseRun: () => void
  advanceRun: (t: number) => void
  completeRun: (durationS: number) => void
  scrubTo: (t: number) => void
  resetRun: (reason?: RunResetReason) => void
  /** Resolve and apply one playback intent (`src/state/playbackCommands.ts`). */
  playbackCommand: (command: PlaybackCommand) => void

  // Internal trial lifecycle.
  prepareTrial: () => void
  startTrialRun: () => void
  cancelTrialPreparation: () => void
  trialMessage: (message: TrialWorkerMessage) => void

  // Monte Carlo
  /** Launch the replicate run for the current scenario and run id (cancels an older one). */
  runMonteCarlo: () => void
  /** Worker message sink; a message whose runId is not mc.runId is ignored. */
  mcMessage: (m: McWorkerMessage) => void
  /**
   * Ask a running replicate run to stop at its next checkpoint. The status stays
   * 'running' until the worker posts `done` with `stopped.rule` 'cancelled'.
   */
  cancelMonteCarlo: () => void
  /**
   * Launch the sensitivity run for the current scenario and run id (cancels an
   * older one). Full depth is Morris on `response`, then Sobol on the fields
   * Morris kept.
   */
  runSensitivity: (response?: SensitivityResponse) => void
  /** Sensitivity slot message sink; a message from another run is ignored. */
  sensitivityMessage: (m: SensitivityMessage) => void
  /** Ask a running sensitivity run to stop at its next checkpoint, as `cancelMonteCarlo`. */
  cancelSensitivityRun: () => void

  /**
   * Answer an override edit, which installs no scenario: a run whose applied
   * overrides no longer match the values in force goes stale and a trial is
   * dropped, as a configuration change does.
   */
  overridesChanged: () => void

  // Baseline
  /**
   * Keep the current scenario and its finished ensemble as the baseline, with the
   * overrides the ensemble applied. A no-op without a done summary for the current
   * run and analysis basis. The label defaults to the scenario name and pin time.
   */
  pinBaseline: (label?: string) => void
  clearBaseline: () => void
  /** Install a restored baseline; persistence only, never a user action. */
  restoreBaseline: (baseline: PinnedBaseline | null) => void
  /** Launch a factor sweep on the sensitivity slot, replacing whatever is there. */
  runSweep: (spec: SweepSpec) => void
  /** Sweep worker message sink; a message from another run is ignored. */
  sweepMessage: (m: McSweepMessage) => void
  /** Ask a running sweep to stop at its next cell, as `cancelMonteCarlo`. */
  cancelSweep: () => void

  // Placement optimization
  /**
   * Launch a placement optimization on its own worker slot, replacing whatever is
   * there. A no-op under deterministic mode, with no movable entity, or with no
   * bounds polygon.
   */
  runOptimize: (spec: OptimizeSpec) => void
  /** Optimize worker message sink; a message from another run is ignored. */
  optimizeMessage: (m: OptimizeWorkerMessage) => void
  /**
   * Ask a running optimization to stop at its next checkpoint. Its `optimize-done`
   * then carries the trace so far, so the result reads as a cut run.
   */
  cancelOptimize: () => void
  /** Drop the placement result, its incumbent and its error. */
  clearOptimize: () => void
}

/** Record a deleted builtin (seed) id so the load-time seed merge does not restore it. */
function withDeletedSeed(s: Scenario, id: string, builtin: boolean | undefined): string[] {
  const have = s.deletedSeedIds ?? []
  if (!builtin || have.includes(id)) return have
  return [...have, id]
}

/** The saved strip height: a finite number of at least RUN_TIMELINE_MIN_H, else the default. */
function savedRunTimelineHeight(): number {
  const n = Number(readSetting(RUN_TIMELINE_HEIGHT_KEY))
  return Number.isFinite(n) && n >= RUN_TIMELINE_MIN_H ? n : RUN_TIMELINE_DEFAULT_H
}

/** `list` with `item` removed when present, else appended. */
function toggled<T>(list: readonly T[], item: T): readonly T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

/** Field-by-field selection equality, entity id order included. */
function sameSelection(a: Selection, b: Selection): boolean {
  return (
    a.boundaryId === b.boundaryId &&
    a.connectionId === b.connectionId &&
    a.libraryId === b.libraryId &&
    a.cardId === b.cardId &&
    a.entityIds.length === b.entityIds.length &&
    a.entityIds.every((id, i) => id === b.entityIds[i])
  )
}

/**
 * Every in-progress interaction field, as `cancelDraft` clears them, plus the placement
 * preview: a replace drops it, and `cancelDraft` keeps it because library placement and
 * calibration also call `cancelDraft`.
 */
const CLEARED_DRAFT: Pick<
  UiState,
  | 'draftPoints'
  | 'pathEntityId'
  | 'connectFromId'
  | 'calibrateA'
  | 'calibrateB'
  | 'moveUnderlay'
  | 'contextMenu'
  | 'locationDialogOpen'
  | 'raidDraft'
  | 'connectSuggestion'
  | 'placementPreview'
> = {
  draftPoints: [],
  pathEntityId: null,
  connectFromId: null,
  calibrateA: null,
  calibrateB: null,
  moveUnderlay: false,
  contextMenu: null,
  locationDialogOpen: false,
  raidDraft: null,
  connectSuggestion: null,
  placementPreview: null,
}

export const useStore = create<Store>()((set, get) => {
  /** Worker messages reach the store through its sinks, never a slot directly. */
  const sinks: AnalysisSinks = {
    mc: (m) => get().mcMessage(m),
    // Pool progress lands only on a live run; a late message cannot revive one.
    pool: (p) => set((st) => acceptPoolProgress(st, p) ?? st),
    sensitivity: (m) => get().sensitivityMessage(m),
    sweep: (m) => get().sweepMessage(m),
    trial: (m) => get().trialMessage(m),
    optimize: (m) => get().optimizeMessage(m),
  }

  /**
   * Make a Scenario current through `installScenario` and add the `ui` response:
   * pruned ring overrides are written eagerly, a restored snapshot invalidates any
   * open connect offer, and a replacement cancels every in-progress interaction.
   */
  function install(op: ScenarioInstall) {
    const st = get()
    const { scenario, past, future, selection, playback, mc, trial, ui } = st
    const slices = {
      scenario,
      past,
      future,
      selection,
      playback,
      mc,
      trial,
      ringOverrides: ui.ringOverrides,
    }
    const next = installScenario(slices, op, useOverrides.getState().overrides)
    if (next === slices) return
    const { ringOverrides, ...rest } = next
    if (ringOverrides !== ui.ringOverrides) writeRingOverrides(ringOverrides)
    const nextUi =
      op.op === 'replace'
        ? { ...ui, ...CLEARED_DRAFT, tool: 'select' as const, ringOverrides }
        : op.op === 'edit'
          ? ringOverrides === ui.ringOverrides
            ? ui
            : { ...ui, ringOverrides }
          : ui.connectSuggestion || ringOverrides !== ui.ringOverrides
            ? { ...ui, connectSuggestion: null, ringOverrides }
            : ui
    set({ ...rest, ui: nextUi })
  }

  /** Apply an undoable scenario change. */
  function mutate(fn: (s: Scenario) => Scenario) {
    install({ op: 'edit', next: fn(get().scenario) })
  }

  function patchRunTimeline(patch: Partial<RunTimelineUi>) {
    set((st) => ({ ui: { ...st.ui, runTimeline: { ...st.ui.runTimeline, ...patch } } }))
  }

  const view = savedView()

  return {
    scenario: emptyScenario(),
    past: [],
    future: [],
    selection: EMPTY_SELECTION,
    camera: view.camera ?? { x: 0, y: 0, scale: 0.05 },
    ui: {
      boardPhase: 'prepare',
      executeLayers: null,
      basemap: view.basemap ?? 'canvas',
      tool: 'select',
      boundaryType: 'range',
      draftPoints: [],
      pathEntityId: null,
      connectFromId: null,
      calibrateA: null,
      calibrateB: null,
      rightTab: view.rightTab ?? 'inspect',
      theme: view.theme ?? 'system',
      showFieldHelp: view.showFieldHelp ?? false,
      moveUnderlay: false,
      layers: savedLayers(),
      ringOverrides: savedRingOverrides(),
      units: savedUnits(),
      contextMenu: null,
      connectSuggestion: null,
      raidDraft: null,
      locationDialogOpen: false,
      libraryRequest: { seq: 0, kind: null, modelId: null },
      placementRequest: { seq: 0, modelId: null },
      selectionOrigin: 'board',
      placementPreview: null,
      openSections: {},
      validityOpen: false,
      panelRequest: { seq: 0, phase: null, screen: null, section: null },
      runTimeline: {
        open: readSetting(ENGSTRIP_OPEN_KEY) === '1',
        heightPx: savedRunTimelineHeight(),
        openGroups: [],
        openSensors: [],
        openSensorsAll: false,
        openFolds: [],
        hiddenRows: [],
        follow: true,
        viewport: null,
      },
    },
    playback: freshPlayback(savedRunSeq()),
    mc: IDLE_MC,
    trial: IDLE_TRIAL,
    baseline: null,
    save: { lastAutosaveAt: null, error: null },

    undo: () => install({ op: 'undo' }),

    redo: () => install({ op: 'redo' }),

    replaceScenario: (s) => install({ op: 'replace', next: s }),

    loadScenario: (s, opts) => {
      get().replaceScenario(s)
      if ((opts?.fit ?? 'if-unsaved') === 'if-unsaved' && savedView().camera) return
      const cam = fitCameraTo([
        ...s.entities.map((e) => e.pos),
        ...s.paths.flatMap((p) => p.points),
      ])
      if (cam) get().setCamera(cam)
    },

    setScenarioName: (name) => mutate((s) => ({ ...s, name })),

    addEntityFromModel: (modelId, pos, screen) => {
      const id = newId('ent')
      mutate((s) => {
        const model = s.library.find((m) => m.id === modelId)
        if (!model) return s
        const count = s.entities.filter((e) => e.specId === modelId).length
        const entity: Entity = {
          id,
          name: `${model.name.split(':').pop()?.trim() ?? KIND_NAMES[model.kind]} ${count + 1}`,
          kind: model.kind,
          specId: modelId,
          pos,
          headingDeg: 0,
          color: null,
          notes: '',
          // Seeded from the model profile so a fresh drop is not at ground level.
          // Null keeps the threatAltitudeFt fallback.
          ...(model.kind === 'uas' ? { altitudeFt: model.threatProfile?.altitudeFt ?? null } : {}),
        }
        return { ...s, entities: [...s.entities, entity] }
      })
      if (!screen) return
      const kind = get().scenario.entities.find((e) => e.id === id)?.kind
      if (kind === 'sensor' || kind === 'effector' || kind === 'c2') {
        // A fresh drop shows what this system can integrate with, even out of range.
        get().openConnectSuggestion(id, screen, { always: true })
      }
    },

    updateEntity: (id, patch) =>
      mutate((s) => ({
        ...s,
        entities: s.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),

    moveEntity: (id, pos) => get().updateEntity(id, { pos }),

    duplicateEntity: (id) =>
      mutate((s) => {
        const src = s.entities.find((e) => e.id === id)
        if (!src) return s
        const copy: Entity = {
          ...JSON.parse(JSON.stringify(src)),
          id: newId('ent'),
          name: `${src.name} (copy)`,
          pos: { x: src.pos.x + 500, y: src.pos.y + 500 },
          systemId: null,
        }
        return { ...s, entities: [...s.entities, copy] }
      }),

    deleteSelection: () => {
      mutate((s) => {
        const { entityIds, boundaryId, connectionId } = get().selection
        const ids = new Set(entityIds)
        let next = s
        if (ids.size > 0) {
          next = {
            ...next,
            entities: next.entities.filter((e) => !ids.has(e.id)),
            connections: next.connections.filter((c) => !ids.has(c.fromId) && !ids.has(c.toId)),
            paths: next.paths.filter((p) => !ids.has(p.entityId)),
            testCards: next.testCards.map((tc) => ({
              ...tc,
              linkedEntityIds: tc.linkedEntityIds.filter((eid) => !ids.has(eid)),
            })),
            raid: next.raid && {
              waves: next.raid.waves.map((w) => ({
                ...w,
                entityIds: w.entityIds.filter((eid) => !ids.has(eid)),
              })),
            },
          }
        }
        if (boundaryId) {
          next = { ...next, boundaries: next.boundaries.filter((b) => b.id !== boundaryId) }
        }
        if (connectionId) {
          next = { ...next, connections: next.connections.filter((c) => c.id !== connectionId) }
        }
        if (next !== s)
          set((st) => ({
            selection: EMPTY_SELECTION,
            // Deleted endpoints invalidate any open connect offer.
            ui: st.ui.connectSuggestion ? { ...st.ui, connectSuggestion: null } : st.ui,
          }))
        return next
      })
    },

    beginConnect: (fromId) => set((st) => ({ ui: { ...st.ui, connectFromId: fromId } })),

    completeConnect: (toId) => {
      const { ui } = get()
      const fromId = ui.connectFromId
      set((st) => ({ ui: { ...st.ui, connectFromId: null } }))
      if (!fromId || fromId === toId) return
      mutate((s) => {
        if (s.connections.some((c) => c.fromId === fromId && c.toId === toId)) return s
        const from = s.entities.find((e) => e.id === fromId)
        const to = s.entities.find((e) => e.id === toId)
        const fromSpec = from?.specId ? s.library.find((m) => m.id === from.specId) : undefined
        const toSpec = to?.specId ? s.library.find((m) => m.id === to.specId) : undefined
        // A researched pairing types the link; anything else keeps the kind default.
        const verdict = fromSpec && toSpec ? evaluateIntegration(fromSpec, toSpec) : null
        const conn: Connection = verdict?.ok
          ? {
              id: newId('con'),
              fromId,
              toId,
              label: verdict.label,
              medium: verdict.medium,
              confidence: verdict.confidence,
              note: verdict.note,
              latencyS: verdict.latencyS,
            }
          : {
              id: newId('con'),
              fromId,
              toId,
              label: from && to ? defaultConnectionLabel(from.kind, to.kind) : '',
            }
        return { ...s, connections: [...s.connections, conn] }
      })
    },

    openConnectSuggestion: (entityId, screen, opts) => {
      const all = suggestLinksFor(get().scenario, entityId)
      // Documented pairings in range wire themselves in one undoable step; the rest
      // still need a click.
      const autoConnected = all.filter((c) => c.verdict.confidence === 'documented')
      const candidates = all.filter((c) => c.verdict.confidence !== 'documented')
      if (autoConnected.length > 0) {
        mutate((s) => {
          const added = typedConnections(s, autoConnected)
          return added.length > 0 ? { ...s, connections: [...s.connections, ...added] } : s
        })
      }
      // Skip unprofiled (custom) models so the popup is never empty.
      const specId = get().scenario.entities.find((e) => e.id === entityId)?.specId ?? null
      const show =
        candidates.length > 0 ||
        autoConnected.length > 0 ||
        (opts?.always === true && profileFor(specId) != null)
      set((st) => ({
        ui: {
          ...st.ui,
          connectSuggestion: show ? { entityId, screen, candidates, autoConnected } : null,
        },
      }))
    },

    dismissConnectSuggestion: () =>
      set((st) => (st.ui.connectSuggestion ? { ui: { ...st.ui, connectSuggestion: null } } : st)),

    applyConnectSuggestion: (indexes) => {
      const suggestion = get().ui.connectSuggestion
      get().dismissConnectSuggestion()
      if (!suggestion) return
      const chosen = indexes
        .map((i) => suggestion.candidates[i])
        .filter((c): c is SuggestedLink => c != null)
      if (chosen.length === 0) return
      mutate((s) => {
        const added = typedConnections(s, chosen)
        if (added.length === 0) return s
        return { ...s, connections: [...s.connections, ...added] }
      })
    },

    updateConnection: (id, patch) =>
      mutate((s) => ({
        ...s,
        connections: s.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),

    addSystemFromPreset: (presetId, center, headingDeg = 0) =>
      mutate((s) => {
        const preset = s.systemPresets.find((p) => p.id === presetId)
        if (!preset) return s
        const systemId = newId('sys')
        // Aligned with preset.components so link indexes stay valid; null when the
        // referenced model is gone.
        const placed: Array<Entity | null> = preset.components.map((comp, i) => {
          const model = s.library.find((m) => m.id === comp.specId)
          if (!model) return null
          const baseName = model.name.split(':').pop()?.trim() ?? model.name
          const dupes = preset.components.filter((c) => c.specId === comp.specId).length
          const nth = preset.components.slice(0, i).filter((c) => c.specId === comp.specId).length
          // Rotate offsets about the drop point and slew each facing by the same amount.
          const off = rotatePoint(comp.offsetM, { x: 0, y: 0 }, headingDeg)
          return {
            id: newId('ent'),
            name: dupes > 1 ? `${baseName} ${nth + 1}` : baseName,
            kind: model.kind,
            specId: model.id,
            pos: { x: center.x + off.x, y: center.y + off.y },
            headingDeg: (comp.headingDeg + headingDeg + 360) % 360,
            color: null,
            notes: comp.purpose,
            systemId,
            ...(model.kind === 'uas'
              ? { altitudeFt: model.threatProfile?.altitudeFt ?? null }
              : {}),
          }
        })
        const connections: Connection[] = []
        for (const [a, b] of preset.links) {
          const from = placed[a]
          const to = placed[b]
          if (from && to) {
            connections.push({ id: newId('con'), fromId: from.id, toId: to.id, label: '' })
          }
        }
        return {
          ...s,
          entities: [...s.entities, ...placed.filter((e): e is Entity => e !== null)],
          connections: [...s.connections, ...connections],
        }
      }),

    saveSelectionAsSystem: (name) => {
      const { entityIds } = get().selection
      mutate((s) => {
        const selected = s.entities.filter((e) => entityIds.includes(e.id) && e.specId)
        if (selected.length < 2) return s
        const cx = selected.reduce((sum, e) => sum + e.pos.x, 0) / selected.length
        const cy = selected.reduce((sum, e) => sum + e.pos.y, 0) / selected.length
        const index = new Map(selected.map((e, i) => [e.id, i]))
        const links: Array<[number, number]> = []
        for (const c of s.connections) {
          const a = index.get(c.fromId)
          const b = index.get(c.toId)
          if (a != null && b != null) links.push([a, b])
        }
        const preset: SystemPreset = {
          id: newId('sysp'),
          name: name || `System ${s.systemPresets.length + 1}`,
          description: 'Saved from canvas selection.',
          builtin: false,
          components: selected.map((e) => ({
            specId: e.specId!,
            offsetM: { x: e.pos.x - cx, y: e.pos.y - cy },
            headingDeg: e.headingDeg,
            purpose: e.notes,
          })),
          links,
        }
        return { ...s, systemPresets: [...s.systemPresets, preset] }
      })
    },

    deleteSystemPreset: (id) =>
      mutate((s) => ({
        ...s,
        systemPresets: s.systemPresets.filter((p) => p.id !== id),
        deletedSeedIds: withDeletedSeed(s, id, s.systemPresets.find((p) => p.id === id)?.builtin),
      })),

    rotateSystem: (systemId, deltaDeg) =>
      mutate((s) => {
        const members = s.entities.filter((e) => e.systemId === systemId)
        if (members.length === 0) return s
        const cx = members.reduce((sum, e) => sum + e.pos.x, 0) / members.length
        const cy = members.reduce((sum, e) => sum + e.pos.y, 0) / members.length
        const center = { x: cx, y: cy }
        return {
          ...s,
          entities: s.entities.map((e) =>
            e.systemId === systemId
              ? {
                  ...e,
                  pos: rotatePoint(e.pos, center, deltaDeg),
                  headingDeg: (e.headingDeg + deltaDeg + 360) % 360,
                }
              : e,
          ),
        }
      }),

    selectSystem: (systemId) => {
      const ids = get()
        .scenario.entities.filter((e) => e.systemId === systemId)
        .map((e) => e.id)
      get().select({ entityIds: ids })
    },

    openContextMenu: (screen, world, entityId) =>
      set((st) => ({ ui: { ...st.ui, contextMenu: { screen, world, entityId } } })),

    closeContextMenu: () =>
      set((st) => (st.ui.contextMenu ? { ui: { ...st.ui, contextMenu: null } } : st)),

    addDraftPoint: (p) =>
      set((st) => ({ ui: { ...st.ui, draftPoints: [...st.ui.draftPoints, p] } })),

    finishBoundary: (closed) => {
      const { ui } = get()
      const points = ui.draftPoints
      set((st) => ({ ui: { ...st.ui, draftPoints: [] } }))
      if (points.length < 2) return
      mutate((s) => {
        const typeName = ui.boundaryType.charAt(0).toUpperCase() + ui.boundaryType.slice(1)
        const boundary: Boundary = {
          id: newId('bnd'),
          name: `${typeName} ${s.boundaries.length + 1}`,
          type: ui.boundaryType,
          points,
          closed: closed && points.length >= 3,
          altBandFt: null,
        }
        return { ...s, boundaries: [...s.boundaries, boundary] }
      })
    },

    beginPath: (entityId) =>
      set((st) => ({
        ui: { ...st.ui, tool: 'path', pathEntityId: entityId, draftPoints: [] },
      })),

    finishPath: () => {
      const { ui, scenario } = get()
      const entityId = ui.pathEntityId
      const entity = scenario.entities.find((e) => e.id === entityId)
      const points = entity ? [entity.pos, ...ui.draftPoints] : ui.draftPoints
      set((st) => ({ ui: { ...st.ui, draftPoints: [], pathEntityId: null, tool: 'select' } }))
      if (!entityId || points.length < 2) return
      mutate((s) => {
        const path: FlightPath = {
          id: newId('pth'),
          entityId,
          points,
          speedMps: null,
          startDelayS: 0,
        }
        return { ...s, paths: [...s.paths.filter((p) => p.entityId !== entityId), path] }
      })
    },

    beginCap: (entityId) =>
      set((st) => ({
        ui: { ...st.ui, tool: 'cap', pathEntityId: entityId, draftPoints: [] },
      })),

    finishCap: (edge) => {
      const { ui, scenario } = get()
      const entityId = ui.pathEntityId
      const center = ui.draftPoints[0]
      const entity = scenario.entities.find((e) => e.id === entityId)
      set((st) => ({ ui: { ...st.ui, draftPoints: [], pathEntityId: null, tool: 'select' } }))
      if (!entityId || !center || !entity) return
      const cap: CapOrbit = {
        center,
        radiusM: capRadiusFrom(center, edge),
        laps: CAP_DEFAULT_LAPS,
      }
      mutate((s) => {
        const path: FlightPath = {
          id: newId('pth'),
          entityId,
          points: capPathPoints(entity.pos, cap),
          speedMps: null,
          startDelayS: 0,
          cap,
        }
        return { ...s, paths: [...s.paths.filter((p) => p.entityId !== entityId), path] }
      })
    },

    updateCap: (pathId, patch) => {
      const { scenario } = get()
      const path = scenario.paths.find((p) => p.id === pathId)
      const entity = path && scenario.entities.find((e) => e.id === path.entityId)
      if (!path?.cap || !entity) return
      const merged = { ...path.cap, ...patch }
      // A cleared or partial input keeps the current value instead of a NaN orbit.
      const radiusM = Number.isFinite(merged.radiusM) ? merged.radiusM : path.cap.radiusM
      const laps = Number.isFinite(merged.laps) ? merged.laps : path.cap.laps
      const cap: CapOrbit = {
        ...merged,
        radiusM: Math.max(CAP_MIN_RADIUS_M, radiusM),
        laps: Math.max(1, Math.round(laps)),
      }
      const points = capPathPoints(entity.pos, cap)
      mutate((s) => ({
        ...s,
        paths: s.paths.map((p) => (p.id === pathId ? { ...p, cap, points } : p)),
      }))
    },

    cancelDraft: () =>
      set((st) => ({
        ui: {
          ...st.ui,
          draftPoints: [],
          pathEntityId: null,
          connectFromId: null,
          calibrateA: null,
          calibrateB: null,
          raidDraft: null,
          connectSuggestion: null,
        },
      })),

    updateBoundary: (id, patch) =>
      mutate((s) => ({
        ...s,
        boundaries: s.boundaries.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      })),

    updatePath: (id, patch) =>
      mutate((s) => ({
        ...s,
        paths: s.paths.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),

    deletePathForEntity: (entityId) =>
      mutate((s) => ({ ...s, paths: s.paths.filter((p) => p.entityId !== entityId) })),

    assignToWave: (entityId, waveIndex) =>
      mutate((s) => {
        const waves = (s.raid?.waves ?? []).map((w) => ({
          ...w,
          entityIds: w.entityIds.filter((id) => id !== entityId),
        }))
        if (waveIndex != null && waveIndex >= 0) {
          // A brand-new wave staggers 60 s behind the previous one.
          while (waves.length <= waveIndex) {
            const prev = waves[waves.length - 1]
            waves.push({ startDelayS: prev ? prev.startDelayS + 60 : 0, entityIds: [] })
          }
          const w = waves[waveIndex]
          waves[waveIndex] = { ...w, entityIds: [...w.entityIds, entityId] }
        }
        return { ...s, raid: { waves } }
      }),

    setWaveDelay: (waveIndex, delayS) =>
      mutate((s) => {
        const waves = s.raid?.waves ?? []
        if (waveIndex < 0 || waveIndex >= waves.length) return s
        return {
          ...s,
          raid: {
            waves: waves.map((w, i) =>
              i === waveIndex ? { ...w, startDelayS: Math.max(0, delayS) } : w,
            ),
          },
        }
      }),

    armRaidDraft: (tacticId) => {
      const raidDraft = raidDraftFor(get().scenario, tacticId)
      if (!raidDraft) return
      // Arming clears any draw draft so the next canvas click places the raid axis.
      set((st) => ({
        ui: {
          ...st.ui,
          tool: 'select',
          draftPoints: [],
          pathEntityId: null,
          connectFromId: null,
          calibrateA: null,
          calibrateB: null,
          raidDraft,
        },
      }))
    },

    patchRaidDraft: (p) =>
      set((st) =>
        st.ui.raidDraft ? { ui: { ...st.ui, raidDraft: { ...st.ui.raidDraft, ...p } } } : st,
      ),

    cancelRaidDraft: () =>
      set((st) => (st.ui.raidDraft ? { ui: { ...st.ui, raidDraft: null } } : st)),

    commitRaid: (axisAnchor) => {
      const { ui, scenario } = get()
      if (!ui.raidDraft) return
      // Null until a UAS platform and a target asset are chosen; the draft stays armed.
      const raid = buildRaid(scenario, ui.raidDraft, axisAnchor)
      if (!raid) return
      // ONE mutate: a single Cmd+Z removes the entire raid.
      mutate((s) => ({
        ...s,
        entities: [...s.entities, ...raid.entities],
        paths: [...s.paths, ...raid.paths],
        raid: { waves: [...(s.raid?.waves ?? []), ...raid.waves] },
      }))
      set((st) => ({ ui: { ...st.ui, raidDraft: null } }))
      // Camera moves are not undoable.
      const cam = fitCameraTo([raid.target.pos, ...raid.starts])
      if (cam) set({ camera: cam })
    },

    updateEnvironment: (patch) =>
      mutate((s) => ({ ...s, environment: { ...s.environment, ...patch } })),

    patchScenario: (patch) => mutate((s) => ({ ...s, ...patch })),

    setUnderlayImage: (dataUrl, naturalW, naturalH) =>
      mutate((s) => ({
        ...s,
        underlay: { ...s.underlay, dataUrl, naturalW, naturalH },
      })),

    updateUnderlay: (patch) => mutate((s) => ({ ...s, underlay: { ...s.underlay, ...patch } })),

    setCalibratePoint: (p) =>
      set((st) => {
        if (!st.ui.calibrateA) return { ui: { ...st.ui, calibrateA: p } }
        return { ui: { ...st.ui, calibrateB: p } }
      }),

    applyCalibration: (trueDistM) => {
      const { ui, scenario } = get()
      const { calibrateA: a, calibrateB: b } = ui
      set((st) => ({
        ui: { ...st.ui, calibrateA: null, calibrateB: null, tool: 'select' },
      }))
      if (!a || !b || trueDistM <= 0) return
      const measured = Math.hypot(b.x - a.x, b.y - a.y)
      if (measured <= 0) return
      const factor = trueDistM / measured
      const u = scenario.underlay
      // Scale the underlay about point a so both clicked points keep alignment.
      mutate((s) => ({
        ...s,
        underlay: {
          ...u,
          widthM: u.widthM * factor,
          pos: { x: a.x + (u.pos.x - a.x) * factor, y: a.y + (u.pos.y - a.y) * factor },
        },
      }))
    },

    setGeoRef: (g) => mutate((s) => ({ ...s, geoRef: g })),

    applyLocation: (g, fieldElevationFt) =>
      mutate((s) => ({
        ...s,
        geoRef: g,
        environment:
          fieldElevationFt == null ? s.environment : { ...s.environment, fieldElevationFt },
      })),

    addModel: (kind) => {
      const id = newId('lib')
      mutate((s) => {
        const model: SpecModel = {
          id,
          name: `New ${KIND_NAMES[kind]} model`,
          kind,
          description: '',
          color: '#7da7c4',
          builtin: false,
        }
        if (kind === 'sensor') {
          model.sensor = {
            sensorType: 'radar',
            detectRangeM: 10000,
            classifyRangeM: 5000,
            sectorDeg: 360,
          }
        }
        if (kind === 'effector') {
          model.effector = {
            effectorType: 'interceptor',
            minRangeM: 500,
            maxRangeM: 10000,
            engageTimeS: 60,
          }
        }
        if (kind === 'uas') {
          model.uas = {
            group: 1,
            airframe: 'quad',
            cruiseSpeedMps: 15,
            maxSpeedMps: 25,
            enduranceMin: 30,
            altBandFt: [0, 2000],
            navMode: 'gps',
            emissionsNote: '',
          }
          model.threatProfile = {
            designator: 'THR-NEW',
            routeIntent: '',
            altitudeFt: 500,
            speedMps: 15,
            count: 1,
          }
        }
        return { ...s, library: [...s.library, model] }
      })
      return id
    },

    duplicateModel: (id) => {
      const nid = newId('lib')
      mutate((s) => {
        const src = s.library.find((m) => m.id === id)
        if (!src) return s
        const copy: SpecModel = JSON.parse(JSON.stringify(src))
        copy.id = nid
        copy.name = `${src.name} (copy)`
        copy.builtin = false
        return { ...s, library: [...s.library, copy] }
      })
      return nid
    },

    updateModel: (id, patch) =>
      mutate((s) => ({
        ...s,
        library: s.library.map((m) =>
          m.id === id ? dropEditedProvenance(m, { ...m, ...patch }) : m,
        ),
      })),

    editModel: (id, field, value) =>
      mutate((s) => {
        const before = s.library.find((m) => m.id === id)
        if (!before) return s
        const after = dropEditedProvenance(before, editSpecField(before, field, value))
        if (after === before) return s
        return { ...s, library: s.library.map((m) => (m === before ? after : m)) }
      }),

    deleteModel: (id) =>
      mutate((s) => ({
        ...s,
        library: s.library.filter((m) => m.id !== id),
        deletedSeedIds: withDeletedSeed(s, id, s.library.find((m) => m.id === id)?.builtin),
        entities: s.entities.map((e) => (e.specId === id ? { ...e, specId: null } : e)),
      })),

    // Both actions read one policy: src/model/libraryLifecycle.ts. A reset that
    // changes nothing returns the same library array, so mutate records no edit.
    resetModelToSeed: (id) =>
      mutate((s) => {
        const library = resetBuiltin(s.library, id)
        return library === s.library ? s : { ...s, library }
      }),

    mergeLibrary: (models) => mutate((s) => ({ ...s, library: importModels(s.library, models) })),

    addCard: (patch) => {
      const id = newId('tc')
      mutate((s) => {
        const card: TestCard = {
          id,
          cardId: `TC-CUAS-${String(s.testCards.length + 1).padStart(3, '0')}`,
          version: '1.0',
          campaign: '',
          questionIds: '',
          customerQuestion: '',
          purpose: '',
          hypothesis: '',
          configuration: '',
          threatProfile: '',
          independentVars: '',
          controlledVars: '',
          covariates: standardCovariates(s.environment),
          measures: [],
          procedure: [],
          thresholds: '',
          abortCriteria: '',
          expectedResults: '',
          linkedEntityIds: [],
          runs: [],
          ...patch,
        }
        return { ...s, testCards: [...s.testCards, card] }
      })
      return id
    },

    addCardFromSelection: () => {
      const { scenario, selection } = get()
      return get().addCard({
        linkedEntityIds: [...selection.entityIds],
        configuration: describeConfiguration(scenario),
        threatProfile: describeThreats(scenario),
      })
    },

    newCardVersion: (id) => {
      const nid = newId('tc')
      mutate((s) => {
        const src = s.testCards.find((c) => c.id === id)
        if (!src) return s
        const copy: TestCard = {
          ...src,
          id: nid,
          version: bumpCardVersion(src.version),
          measures: [...src.measures],
          procedure: [...src.procedure],
          linkedEntityIds: [...src.linkedEntityIds],
          runs: [],
        }
        return { ...s, testCards: [...s.testCards, copy] }
      })
      return nid
    },

    updateCard: (id, patch) =>
      mutate((s) => ({
        ...s,
        testCards: s.testCards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),

    deleteCard: (id) =>
      mutate((s) => ({ ...s, testCards: s.testCards.filter((c) => c.id !== id) })),

    toggleCardEntity: (cardId, entityId) =>
      mutate((s) => ({
        ...s,
        testCards: s.testCards.map((c) => {
          if (c.id !== cardId) return c
          const linked = c.linkedEntityIds.includes(entityId)
          return {
            ...c,
            linkedEntityIds: linked
              ? c.linkedEntityIds.filter((e) => e !== entityId)
              : [...c.linkedEntityIds, entityId],
          }
        }),
      })),

    addRun: (cardId) =>
      mutate((s) => ({
        ...s,
        testCards: s.testCards.map((c) => {
          if (c.id !== cardId) return c
          const run: RunLogEntry = {
            id: newId('run'),
            runId: `RUN-${String(c.runs.length + 1).padStart(4, '0')}`,
            validity: 'pending',
            result: '',
            deviations: '',
          }
          return { ...c, runs: [...c.runs, run] }
        }),
      })),

    updateRun: (cardId, runId, patch) =>
      mutate((s) => ({
        ...s,
        testCards: s.testCards.map((c) =>
          c.id === cardId
            ? { ...c, runs: c.runs.map((r) => (r.id === runId ? { ...r, ...patch } : r)) }
            : c,
        ),
      })),

    saveFrame: (name) => {
      const { camera, playback, ui } = get()
      mutate((s) => {
        const frame: FrameSnap = {
          id: newId('frm'),
          name: name || defaultFrameName(s.name, playback.simTimeS, ui.basemap),
          camera: { ...camera },
          simTimeS: playback.simTimeS,
          basemap: ui.basemap,
        }
        return { ...s, frames: [...s.frames, frame] }
      })
    },

    applyFrame: (id) => {
      const frame = get().scenario.frames.find((f) => f.id === id)
      if (frame) get().playbackCommand({ type: 'frame', frame })
    },

    deleteFrame: (id) => mutate((s) => ({ ...s, frames: s.frames.filter((f) => f.id !== id) })),

    select: (patch, additive = false, origin = 'board') =>
      set((st) => {
        const next =
          additive && patch.entityIds
            ? {
                ...st.selection,
                entityIds: [...new Set([...st.selection.entityIds, ...patch.entityIds])],
              }
            : { ...EMPTY_SELECTION, ...patch }
        // Re-selecting the same objects keeps the identity, so no subscriber re-renders.
        // The origin still moves, so a board click on a panel-selected object switches tab.
        const same = sameSelection(next, st.selection)
        if (st.ui.selectionOrigin === origin) return same ? st : { selection: next }
        const ui = { ...st.ui, selectionOrigin: origin }
        return same ? { ui } : { selection: next, ui }
      }),

    clearSelection: () => set({ selection: EMPTY_SELECTION }),

    setCamera: (c) => {
      writeViewCamera(c)
      set({ camera: c })
    },

    setTool: (t) =>
      set((st) => ({
        ui: {
          ...st.ui,
          tool: t,
          draftPoints: [],
          pathEntityId: null,
          connectFromId: null,
          calibrateA: null,
          calibrateB: null,
          raidDraft: null,
        },
      })),
    setBasemap: (b) => {
      writeView({ basemap: b })
      set((st) => ({ ui: { ...st.ui, basemap: b } }))
    },
    setBoundaryType: (t) => set((st) => ({ ui: { ...st.ui, boundaryType: t } })),
    setRightTab: (t) => {
      // An unchanged tab must not write storage or allocate a new `ui`.
      if (get().ui.rightTab === t) return
      writeView({ rightTab: t })
      set((st) => ({ ui: { ...st.ui, rightTab: t } }))
    },
    openLibrary: (kind, modelId) =>
      set((st) => ({
        ...(modelId == null ? {} : { selection: { ...EMPTY_SELECTION, libraryId: modelId } }),
        ui: {
          ...st.ui,
          libraryRequest: {
            seq: st.ui.libraryRequest.seq + 1,
            kind: kind ?? null,
            modelId: modelId ?? null,
          },
        },
      })),
    setSectionOpen: (id, open) => {
      if (get().ui.openSections[id] === open) return
      set((st) => ({ ui: { ...st.ui, openSections: { ...st.ui.openSections, [id]: open } } }))
    },
    setAllSections: (open, ids) => {
      if (ids.every((id) => get().ui.openSections[id] === open)) return
      set((st) => ({
        ui: {
          ...st.ui,
          openSections: {
            ...st.ui.openSections,
            ...Object.fromEntries(ids.map((id) => [id, open])),
          },
        },
      }))
    },
    setValidityOpen: (open) => {
      if (get().ui.validityOpen === open) return
      set((st) => ({ ui: { ...st.ui, validityOpen: open } }))
    },
    setPlacementPreview: (placementPreview) => {
      if (get().ui.placementPreview === placementPreview) return
      set((st) => ({ ui: { ...st.ui, placementPreview } }))
    },
    requestPanel: (request) =>
      set((st) => ({
        ui: { ...st.ui, panelRequest: { ...request, seq: st.ui.panelRequest.seq + 1 } },
      })),
    requestPlacement: (modelId) =>
      set((st) => ({
        ui: {
          ...st.ui,
          placementRequest: { seq: st.ui.placementRequest.seq + 1, modelId },
        },
      })),
    setShowFieldHelp: (v) => {
      if (get().ui.showFieldHelp === v) return
      writeView({ showFieldHelp: v })
      set((st) => ({ ui: { ...st.ui, showFieldHelp: v } }))
    },
    setTheme: (t) => {
      writeView({ theme: t })
      set((st) => ({ ui: { ...st.ui, theme: t } }))
    },
    setMoveUnderlay: (v) => set((st) => ({ ui: { ...st.ui, moveUnderlay: v } })),
    setRunTimelineOpen: (open) => {
      writeSetting(ENGSTRIP_OPEN_KEY, open ? '1' : '0')
      patchRunTimeline({ open })
    },
    setRunTimelineHeight: (px, persist = true) => {
      const heightPx = Math.max(RUN_TIMELINE_MIN_H, Math.round(px))
      if (persist) writeSetting(RUN_TIMELINE_HEIGHT_KEY, String(heightPx))
      patchRunTimeline({ heightPx })
    },
    toggleRunTimelineGroup: (key) =>
      patchRunTimeline({ openGroups: toggled(get().ui.runTimeline.openGroups, key) }),
    toggleRunTimelineSensor: (rowKey, shownOpen) => {
      const { openSensors, openSensorsAll } = get().ui.runTimeline
      const from = openSensorsAll
        ? [...new Set([...openSensors, ...(shownOpen ?? [])])]
        : openSensors
      patchRunTimeline({ openSensors: toggled(from, rowKey), openSensorsAll: false })
    },
    toggleRunTimelineFold: (foldKey) =>
      patchRunTimeline({ openFolds: toggled(get().ui.runTimeline.openFolds, foldKey) }),
    hideRunTimelineRow: (rowKey) => {
      const { hiddenRows } = get().ui.runTimeline
      if (!hiddenRows.includes(rowKey)) patchRunTimeline({ hiddenRows: [...hiddenRows, rowKey] })
    },
    showAllRunTimelineRows: () => patchRunTimeline({ hiddenRows: [] }),
    setRunTimelineFollow: (follow) => patchRunTimeline({ follow }),
    setRunTimelineViewport: (viewport, follow) =>
      patchRunTimeline(follow == null ? { viewport } : { viewport, follow }),
    collapseAllRunTimeline: () => patchRunTimeline({ openGroups: [], openSensorsAll: false }),
    expandAllRunTimeline: (groups, sensorRows) =>
      patchRunTimeline({
        openGroups: [...groups],
        openSensors: [...sensorRows],
        openSensorsAll: true,
      }),
    seekRunTimeline: (tS, shown) => {
      patchRunTimeline({ viewport: shown, follow: false })
      get().scrubTo(tS)
    },
    // Editing tools belong to Prepare: leaving it drops any drawing tool back to Select.
    // A phase change closes the Validity line, so Execute shows it only from the status bar (D1).
    // A placement preview belongs to Prepare, so a phase change drops it too.
    setBoardPhase: (boardPhase) =>
      set((st) =>
        st.ui.boardPhase === boardPhase
          ? st
          : {
              ui: {
                ...st.ui,
                boardPhase,
                tool: boardPhase === 'prepare' ? st.ui.tool : 'select',
                validityOpen: false,
                placementPreview: null,
              },
            },
      ),
    setLayer: (key, v) => {
      const st = get()
      const layers = { ...selectEffectiveLayers(st), [key]: v }
      if (st.ui.boardPhase === 'execute') {
        set({ ui: { ...st.ui, executeLayers: layers } })
        return
      }
      writeLayers(layers)
      set({ ui: { ...st.ui, layers } })
    },
    toggleLayer: (key) => get().setLayer(key, !selectEffectiveLayers(get())[key]),
    applyLayerPreset: (p) => {
      const st = get()
      const layers = { ...LAYER_PRESETS[p] }
      if (st.ui.boardPhase === 'execute') {
        set({ ui: { ...st.ui, executeLayers: layers } })
        return
      }
      writeLayers(layers)
      set({ ui: { ...st.ui, layers } })
    },
    setRingOverride: (entityId, key, on) => {
      const current = get().ui.ringOverrides
      const entry = { ...current[entityId] }
      if (on == null) delete entry[key]
      else entry[key] = on
      const ringOverrides = { ...current }
      // An entity with no forced ring left keeps no record at all.
      if (Object.keys(entry).length === 0) delete ringOverrides[entityId]
      else ringOverrides[entityId] = entry
      writeRingOverrides(ringOverrides)
      set((st) => ({ ui: { ...st.ui, ringOverrides } }))
    },
    setLocationDialogOpen: (v) => set((st) => ({ ui: { ...st.ui, locationDialogOpen: v } })),

    setSaveState: (lastAutosaveAt, error) => set({ save: { lastAutosaveAt, error } }),
    setUnits: (v) => {
      writeUnits(v)
      set((st) => ({ ui: { ...st.ui, units: v } }))
    },

    // Dev-console wrappers. UI code calls the named lifecycle actions below.
    setPlaying: (p) => {
      if (p) get().startRun()
      else get().pauseRun()
    },
    setSimTime: (t) => get().scrubTo(t),
    setSpeedMult: (m) => set((st) => ({ playback: { ...st.playback, speedMult: m } })),

    startRun: () => get().startTrialRun(),

    /**
     * `resolvePlayback` turns an intent into a transition; this applies it through
     * `set`, so no playback change enters undo history.
     */
    playbackCommand: (command) => {
      const st = get()
      const next = resolvePlayback(command, {
        scenario: st.scenario,
        playback: st.playback,
        trial: st.trial,
        presetId: OBSERVED_PRESET_ID,
        nowMs: Date.now(),
      })
      if (next.kind === 'none') return
      if (next.kind === 'reset') {
        // An observation record without a retained trial: repair, then retry.
        get().resetRun()
        get().playbackCommand(command)
        return
      }
      if (next.writeRunSeq != null) writeRunSeq(next.writeRunSeq)
      const { camera, basemap, ...slices } = next.patch
      if (camera && basemap) writeView({ camera: { ...camera }, basemap })
      set((cur) => {
        // Play turns the run timeline's Follow on (SPEC 1.3).
        const follows =
          slices.playback?.playing === true && !cur.playback.playing && !cur.ui.runTimeline.follow
        const ui =
          basemap || follows
            ? {
                ...cur.ui,
                ...(basemap ? { basemap } : {}),
                ...(follows ? { runTimeline: { ...cur.ui.runTimeline, follow: true } } : {}),
              }
            : null
        return { ...slices, ...(camera ? { camera } : {}), ...(ui ? { ui } : {}) }
      })
      if (next.prepare) get().prepareTrial()
    },

    pauseRun: () => get().playbackCommand({ type: 'pause' }),
    advanceRun: (t) => get().playbackCommand({ type: 'advance', t }),
    completeRun: (durationS) => get().playbackCommand({ type: 'complete', durationS }),
    scrubTo: (t) => get().playbackCommand({ type: 'scrub', t }),

    resetRun: (reason = 'manual') => {
      cancelAnalysis('mc')
      cancelAnalysis('sensitivity')
      cancelAnalysis('sweep')
      cancelAnalysis('trial')
      cancelAnalysis('optimize')
      get().playbackCommand({ type: 'newRun', reason })
    },

    prepareTrial: () => {
      let st = get()
      // Repair an observation record without a retained trial before preparation.
      if (st.trial.manifest == null && st.playback.startedAtMs != null) {
        st.resetRun()
        st = get()
      }
      if (st.trial.status === 'ready') return
      requestAnalysis('trial', st, set, sinks)
    },

    startTrialRun: () => get().playbackCommand({ type: 'play' }),

    cancelTrialPreparation: () => {
      const st = get()
      if (st.trial.status !== 'preparing') return
      cancelAnalysis('trial')
      set({ trial: { ...st.trial, status: 'cancelled', startWhenReady: false } })
    },

    // Worker messages land here through `sinks`; acceptance lives in analysisRequests.ts.
    trialMessage: (message) => {
      const armed = get().trial.startWhenReady
      set((st) => acceptTrialMessage(st, message) ?? st)
      if (armed && get().trial.status === 'ready') get().startTrialRun()
    },

    runMonteCarlo: () => requestAnalysis('mc', get(), set, sinks),

    mcMessage: (m) => set((st) => acceptMcMessage(st, m) ?? st),

    cancelMonteCarlo: () => {
      const { mc } = get()
      if (mc.status === 'running' && mc.runId != null) requestCancel('mc', mc.runId)
    },

    runSensitivity: (response) =>
      requestAnalysis('sensitivity', get(), set, sinks, undefined, response),

    sensitivityMessage: (m) => {
      const patch = acceptSensitivityMessage(get(), m)
      if (patch == null) return
      set(patch)
      // A completed screening hands its kept fields to the Sobol stage; a
      // cancelled one ended the run in `acceptMorrisMessage`.
      if (m.type === 'morris-done' && m.stopped == null) requestSobol(get(), set, sinks, m.result)
    },

    cancelSensitivityRun: () => {
      const { sensitivity } = get().mc
      if (sensitivity.status === 'running' && sensitivity.runId != null) {
        requestCancel('sensitivity', sensitivity.runId)
      }
    },

    runSweep: (spec) => requestAnalysis('sweep', get(), set, sinks, spec),

    sweepMessage: (m) => set((st) => acceptSweepMessage(st, m) ?? st),

    cancelSweep: () => {
      const { sweep } = get().mc
      if (sweep.status === 'running' && sweep.runId != null) requestCancel('sweep', sweep.runId)
    },

    runOptimize: (spec) => requestOptimize(get(), set, sinks, spec),

    optimizeMessage: (m) => set((st) => acceptOptimizeMessage(st, m) ?? st),

    cancelOptimize: () => {
      const { optimize } = get().mc
      if (optimize.status === 'running' && optimize.runId != null)
        requestCancel('optimize', optimize.runId)
    },

    clearOptimize: () =>
      set((st) => ({ mc: { ...st.mc, optimize: IDLE_OPTIMIZE, optimizeBest: null } })),

    overridesChanged: () => {
      const { scenario, playback, mc, trial } = get()
      const slices = { scenario, playback, mc, trial }
      const next = runsForOverridesChange(slices, useOverrides.getState().overrides)
      if (next !== slices) set(next)
    },

    pinBaseline: (label) => {
      const { scenario, mc, playback } = get()
      if (mc.status !== 'done' || mc.runId !== playback.runId || !mc.summary) return
      const scenarioHash = analysisBasisSignature(scenario)
      if (mc.basisSignature != null && mc.basisSignature !== scenarioHash) return
      set({
        baseline: buildBaseline(scenario, mc.summary, scenarioHash, label, undefined, mc.overrides),
      })
    },

    clearBaseline: () => set({ baseline: null }),

    restoreBaseline: (baseline) => set({ baseline }),
  }
})

// An override edit installs no scenario; the runs answer through the store.
// A throw is reported to the mounted override boundary instead of leaving setState.
useOverrides.subscribe((state, prev) => {
  if (state.overrides === prev.overrides) return
  try {
    useStore.getState().overridesChanged()
  } catch (error) {
    reportOverrideFault(error)
  }
})

// New run replaces the trial object, and the previous React fiber still holds it.
// Empty that copy here so its buffers can be collected without another render.
useStore.subscribe((state, prev) => {
  if (prev.trial.result && prev.trial.result !== state.trial.result)
    releaseRetainedTrial(prev.trial.result)
})

import { create } from 'zustand'
import type {
  BasemapMode,
  Boundary,
  BoundaryType,
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
import { entityActive, newId } from '../model/types'
import { emptyScenario } from '../model/seed'
import { describeConfiguration, describeThreats, standardCovariates } from '../model/seedCards'
import { bearingDeg, destination, dist, formationOffsets, formatTime, pathLength, rotatePoint } from '../geometry/geo'
import type { DisplayUnits } from '../geometry/geo'
import { buildRaidPlan, effectivePathDelayS } from '../playback/raid'
import { fanAxes, resolvePlatform, THREAT_TACTICS } from '../playback/tactics'
import { sensorHoldsPoint } from '../playback/sim'
import { evaluateIntegration, profileFor, suggestLinksFor } from '../model/integration'
import type { SuggestedLink } from '../model/integration'
import { savedView, writeView, writeViewCamera } from '../io/viewState'
import { LAYERS_KEY, RUNSEQ_KEY, UNITS_KEY } from '../io/storageKeys'

export type Tool = 'select' | 'boundary' | 'connect' | 'path' | 'calibrate'
export type RightTab = 'inspect' | 'cards' | 'library' | 'analysis'

export interface Camera {
  x: number
  y: number
  /** Pixels per meter. */
  scale: number
}

export interface Selection {
  entityIds: string[]
  boundaryId: string | null
  connectionId: string | null
  libraryId: string | null
  cardId: string | null
}

const EMPTY_SELECTION: Selection = {
  entityIds: [],
  boundaryId: null,
  connectionId: null,
  libraryId: null,
  cardId: null,
}

const HISTORY_LIMIT = 100

/**
 * Spawn clamp for the tactic builder: raid origins sit beyond every enabled
 * sensor's detection ring (measured from each sensor position) by this
 * factor, so first detection happens inside the play, never at T0.
 */
const STANDOFF_CLEAR_FACTOR = 1.1
/** Standoff search: multiply by this per step until no ship is held, up to the step cap. */
const STANDOFF_STEP = 1.05
const STANDOFF_MAX_STEPS = 200
/** In-trail spacing for raid ships when the tactic carries no formation, meters. */
const RAID_TRAIL_SPACING_M = 300
/** Camera scale bounds, pixels per meter (mirrors CanvasStage zoom limits). */
const FIT_MIN_SCALE = 0.0005
const FIT_MAX_SCALE = 20

/**
 * Armed tactic-builder state. UI only, never part of the scenario and never
 * undoable; commitRaid turns it into scenario changes in one mutate().
 */
export interface RaidDraft {
  tacticId: string
  platformSpecId: string | null
  targetEntityId: string | null
  shipCount: number
}

/** Canvas layer visibility. View state only: not undoable, not in the scenario. */
export interface LayerVisibility {
  grid: boolean
  boundaries: boolean
  sensorFootprints: boolean
  classifyRings: boolean
  effectorEnvelopes: boolean
  /** Defended-area ring around every asset (Entity.defendedRadiusM, else the 500 m default). */
  defendedAreas: boolean
  threatWez: boolean
  flightPaths: boolean
  connections: boolean
  rangeRings: boolean
  engagements: boolean
  labels: boolean
  trackTelemetry: boolean
}

/** Name of a single canvas layer toggle. */
export type LayerKey = keyof LayerVisibility

/** Named declutter set applied to every layer at once. */
export type LayerPreset = 'full' | 'planning' | 'engagement' | 'clean'

interface UiState {
  basemap: BasemapMode
  tool: Tool
  boundaryType: BoundaryType
  /** In-progress boundary or path points, world meters. */
  draftPoints: Vec2[]
  /** Entity that a new path is being drawn for. */
  pathEntityId: string | null
  connectFromId: string | null
  calibrateA: Vec2 | null
  calibrateB: Vec2 | null
  rightTab: RightTab
  /** When true the sat underlay is draggable for placement. */
  moveUnderlay: boolean
  /** Canvas layer visibility. Render toggle only: ui state, not undoable, kept in its own localStorage key. */
  layers: LayerVisibility
  /** Display units for distances and speeds. Render toggle only: ui state, not undoable, kept in its own localStorage key. */
  units: DisplayUnits
  /** Open right-click menu; screen px within the canvas host, world meters. */
  contextMenu: { screen: Vec2; world: Vec2; entityId: string | null } | null
  /**
   * Connect offers after placing or dragging a linkable entity; screen px
   * within the canvas host. `autoConnected` links were already created
   * (documented pairs in range wire themselves); `candidates` await a click.
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
}

/**
 * Autosave status. Its own slice, not part of `ui`, so a write does not
 * re-render every ui subscriber. Set by persist, never undoable.
 */
export interface SaveState {
  /** Epoch ms of the last successful autosave write; null before the first. */
  lastAutosaveAt: number | null
  /** Why the last write failed; null when the last write succeeded. */
  error: string | null
}

export type RunPhase = 'ready' | 'running' | 'paused' | 'complete' | 'review'
export type RunResetReason = 'manual' | 'configuration-changed' | 'scenario-loaded' | 'initial'

export interface PlaybackState {
  playing: boolean
  simTimeS: number
  speedMult: number
  /** Unique, non-persisted identity for this clean playback run. */
  runId: string
  /** Human-scale sequence shown as RUN-0001, RUN-0002, ... */
  runSeq: number
  phase: RunPhase
  /** Highest time actually traversed by playback; scrubbing never advances it. */
  observedThroughS: number
  startedAtMs: number | null
  completedAtMs: number | null
  /** Analysis-only configuration snapshot used to detect mid-run changes. */
  basisSignature: string | null
  resetReason: RunResetReason
}

export interface Store {
  scenario: Scenario
  past: Scenario[]
  future: Scenario[]
  selection: Selection
  camera: Camera
  ui: UiState
  playback: PlaybackState
  save: SaveState

  // History
  undo: () => void
  redo: () => void

  // Scenario lifecycle
  /**
   * Install a scenario as the whole board: history, selection, every draft
   * and interaction state, and the playback run are reset. The run sequence
   * is kept (only a manual reset advances it).
   */
  replaceScenario: (s: Scenario) => void
  /**
   * The one load path for the startup autosave and a file import: replace
   * the scenario, then fit the camera to its entities and paths. `fit`
   * defaults to `if-unsaved` (startup: keep the camera the user left); an
   * import passes `always`.
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
  deleteModel: (id: string) => void
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
  select: (patch: Partial<Selection>, additive?: boolean) => void
  clearSelection: () => void
  setCamera: (c: Camera) => void
  setTool: (t: Tool) => void
  setBasemap: (b: BasemapMode) => void
  setBoundaryType: (t: BoundaryType) => void
  setRightTab: (t: RightTab) => void
  setMoveUnderlay: (v: boolean) => void
  setLayer: (key: LayerKey, v: boolean) => void
  toggleLayer: (key: LayerKey) => void
  applyLayerPreset: (p: LayerPreset) => void
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
}


/** Declutter sets. `full` is also the default layer state. */
const LAYER_PRESETS: Record<LayerPreset, LayerVisibility> = {
  full: {
    grid: true,
    boundaries: true,
    sensorFootprints: true,
    classifyRings: true,
    effectorEnvelopes: true,
    defendedAreas: true,
    threatWez: false,
    flightPaths: true,
    connections: true,
    rangeRings: true,
    engagements: true,
    labels: true,
    trackTelemetry: true,
  },
  planning: {
    grid: true,
    boundaries: true,
    sensorFootprints: true,
    classifyRings: true,
    effectorEnvelopes: true,
    defendedAreas: true,
    threatWez: false,
    flightPaths: true,
    connections: true,
    rangeRings: true,
    engagements: false,
    labels: true,
    trackTelemetry: true,
  },
  engagement: {
    grid: true,
    boundaries: true,
    sensorFootprints: false,
    classifyRings: false,
    effectorEnvelopes: true,
    defendedAreas: true,
    threatWez: false,
    flightPaths: true,
    connections: false,
    rangeRings: false,
    engagements: true,
    labels: true,
    trackTelemetry: true,
  },
  clean: {
    grid: true,
    boundaries: false,
    sensorFootprints: false,
    classifyRings: false,
    effectorEnvelopes: false,
    defendedAreas: false,
    threatWez: false,
    flightPaths: false,
    connections: false,
    rangeRings: false,
    engagements: false,
    labels: true,
    trackTelemetry: true,
  },
}

export function formatRunLabel(seq: number): string {
  return `RUN-${String(seq).padStart(4, '0')}`
}

function freshPlayback(
  runSeq: number,
  speedMult = 1,
  resetReason: RunResetReason = 'initial',
): PlaybackState {
  return {
    playing: false,
    simTimeS: 0,
    speedMult,
    runId: newId('simrun'),
    runSeq,
    phase: 'ready',
    observedThroughS: 0,
    startedAtMs: null,
    completedAtMs: null,
    basisSignature: null,
    resetReason,
  }
}

/**
 * Stable signature of inputs that can change detection, classification,
 * routing, engagement, or impact. Presentation and recordkeeping fields
 * (name, frames, cards, pins, underlay, MCDA weights) are intentionally out:
 * saving evidence after a run must not invalidate the run it records.
 */
export function analysisBasisSignature(s: Scenario): string {
  return JSON.stringify({
    environment: s.environment,
    roe: s.roe,
    raid: s.raid,
    library: s.library.map((m) => ({
      id: m.id,
      kind: m.kind,
      sensor: m.sensor,
      effector: m.effector,
      uas: m.uas,
      threatProfile: m.threatProfile,
    })),
    entities: s.entities.map((e) => ({
      id: e.id,
      kind: e.kind,
      specId: e.specId,
      pos: e.pos,
      headingDeg: e.headingDeg,
      enabled: e.enabled,
      formation: e.formation,
    })),
    connections: s.connections.map((c) => ({
      fromId: c.fromId,
      toId: c.toId,
      medium: c.medium,
      confidence: c.confidence,
      latencyS: c.latencyS,
    })),
    paths: s.paths,
  })
}

/**
 * A configuration change invalidates the run in progress: the telemetry it
 * produced no longer describes the board. The run keeps its sequence number;
 * only a manual reset issues a new one.
 */
function playbackForScenarioChange(playback: PlaybackState, next: Scenario): PlaybackState {
  if (
    playback.basisSignature == null ||
    playback.basisSignature === analysisBasisSignature(next)
  ) {
    return playback
  }
  return freshPlayback(playback.runSeq, playback.speedMult, 'configuration-changed')
}

/**
 * Run sequence the next startup issues. Written on a manual reset (the fresh
 * run's own number, so a reload shows the same run) and on the first start of
 * a run (that number plus one, so a run that produced telemetry is never
 * reissued after a reload). Exported for tests.
 */
export function savedRunSeq(): number {
  if (typeof localStorage === 'undefined') return 1
  const n = Number(localStorage.getItem(RUNSEQ_KEY))
  return Number.isInteger(n) && n >= 1 ? n : 1
}

function writeRunSeq(seq: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(RUNSEQ_KEY, String(seq))
  } catch {
    // A lost sequence write costs a reused label, never data.
  }
}

/** Record a deleted builtin (seed) id so the load-time seed merge does not restore it. */
function withDeletedSeed(s: Scenario, id: string, builtin: boolean | undefined): string[] {
  const have = s.deletedSeedIds ?? []
  if (!builtin || have.includes(id)) return have
  return [...have, id]
}

/** Drop selection ids that the scenario no longer holds. */

function pruneSelection(sel: Selection, s: Scenario): Selection {
  const entityIds = sel.entityIds.filter((id) => s.entities.some((e) => e.id === id))
  const keep = <T extends { id: string }>(id: string | null, list: T[]) =>
    id != null && list.some((x) => x.id === id) ? id : null
  return {
    entityIds,
    boundaryId: keep(sel.boundaryId, s.boundaries),
    connectionId: keep(sel.connectionId, s.connections),
    libraryId: keep(sel.libraryId, s.library),
    cardId: keep(sel.cardId, s.testCards),
  }
}

/** Every in-progress interaction field, as `cancelDraft` clears them. */
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
}

function savedUnits(): DisplayUnits {
  if (typeof localStorage === 'undefined') return 'aviation'
  return localStorage.getItem(UNITS_KEY) === 'metric' ? 'metric' : 'aviation'
}

/**
 * Layer visibility from localStorage, spread over the `full` preset so a layer
 * key added after the save still gets a value.
 */
export function savedLayers(): LayerVisibility {
  const defaults = { ...LAYER_PRESETS.full }
  if (typeof localStorage === 'undefined') return defaults
  const raw = localStorage.getItem(LAYERS_KEY)
  if (raw == null) return defaults
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<LayerVisibility>) }
  } catch {
    return defaults
  }
}

function writeLayers(layers: LayerVisibility): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAYERS_KEY, JSON.stringify(layers))
}

const KIND_NAMES: Record<EntityKind, string> = {
  sensor: 'Sensor',
  effector: 'Effector',
  c2: 'C2',
  uas: 'UAS',
  asset: 'Asset',
  marker: 'Marker',
}

/** Default kill-chain label from the endpoint kinds; empty when the pair implies none. */
export function defaultConnectionLabel(fromKind: EntityKind, toKind: EntityKind): string {
  if (fromKind === 'sensor' && toKind === 'c2') return 'track data'
  if (fromKind === 'c2' && toKind === 'effector') return 'engage order'
  if (fromKind === 'sensor' && toKind === 'effector') return 'direct cue'
  return ''
}

/** Typed connections for accepted or auto-applied suggestions; skips existing pairs. */
function typedConnections(s: Scenario, links: SuggestedLink[]): Connection[] {
  const added: Connection[] = []
  for (const { fromId, toId, verdict } of links) {
    const dupe = (c: Connection) => c.fromId === fromId && c.toId === toId
    if (s.connections.some(dupe) || added.some(dupe)) continue
    added.push({
      id: newId('con'),
      fromId,
      toId,
      label: verdict.label,
      medium: verdict.medium,
      confidence: verdict.confidence,
      note: verdict.note,
      latencyS: verdict.latencyS,
    })
  }
  return added
}

/** Default frame name: scenario, sim time, and basemap. */
export function defaultFrameName(
  scenarioName: string,
  simTimeS: number,
  basemap: BasemapMode,
): string {
  return `${scenarioName} T+${formatTime(simTimeS)} ${basemap}`
}

/**
 * Camera that fits the given world points in the canvas viewport. Reads the
 * mounted canvas host for its pixel size and falls back to a representative
 * viewport when none is mounted (tests, T&E workspace).
 */
function fitCameraTo(points: Vec2[]): Camera | null {
  if (points.length === 0) return null
  let vw = 1000
  let vh = 700
  if (typeof document !== 'undefined') {
    const host = document.querySelector('[data-testid="canvas-host"]')
    if (host instanceof HTMLElement && host.clientWidth > 50 && host.clientHeight > 50) {
      vw = host.clientWidth
      vh = host.clientHeight
    }
  }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  // 15% margin around the raid extent.
  const w = Math.max(1, (maxX - minX) * 1.15)
  const h = Math.max(1, (maxY - minY) * 1.15)
  const scale = Math.min(FIT_MAX_SCALE, Math.max(FIT_MIN_SCALE, Math.min(vw / w, vh / h)))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return { scale, x: vw / 2 - cx * scale, y: vh / 2 - cy * scale }
}

/** Minor version bump: '1.0' -> '1.1'. Non-standard strings get a '.1' suffix. */
export function bumpCardVersion(v: string): string {
  const m = /^(\d+)\.(\d+)$/.exec(v.trim())
  if (m) return `${m[1]}.${Number(m[2]) + 1}`
  return `${v.trim() || '1'}.1`
}

export const useStore = create<Store>()((set, get) => {
  /** Apply an undoable scenario change. */
  function mutate(fn: (s: Scenario) => Scenario) {
    const { scenario, past, playback } = get()
    const next = fn(scenario)
    if (next === scenario) return
    set({
      scenario: next,
      past: [...past.slice(-HISTORY_LIMIT + 1), scenario],
      future: [],
      playback: playbackForScenarioChange(playback, next),
    })
  }

  const view = savedView()

  return {
    scenario: emptyScenario(),
    past: [],
    future: [],
    selection: EMPTY_SELECTION,
    camera: view.camera ?? { x: 0, y: 0, scale: 0.05 },
    ui: {
      basemap: view.basemap ?? 'canvas',
      tool: 'select',
      boundaryType: 'range',
      draftPoints: [],
      pathEntityId: null,
      connectFromId: null,
      calibrateA: null,
      calibrateB: null,
      rightTab: view.rightTab ?? 'inspect',
      moveUnderlay: false,
      layers: savedLayers(),
      units: savedUnits(),
      contextMenu: null,
      connectSuggestion: null,
      raidDraft: null,
      locationDialogOpen: false,
    },
    playback: freshPlayback(savedRunSeq()),
    save: { lastAutosaveAt: null, error: null },

    undo: () => {
      const { past, future, scenario, ui, playback, selection } = get()
      if (past.length === 0) return
      const restored = past[past.length - 1]
      set({
        scenario: restored,
        past: past.slice(0, -1),
        future: [scenario, ...future],
        selection: pruneSelection(selection, restored),
        playback: playbackForScenarioChange(playback, restored),
        // A restored scenario invalidates any open connect offer.
        ui: ui.connectSuggestion ? { ...ui, connectSuggestion: null } : ui,
      })
    },

    redo: () => {
      const { past, future, scenario, ui, playback, selection } = get()
      if (future.length === 0) return
      const restored = future[0]
      set({
        scenario: restored,
        past: [...past, scenario],
        future: future.slice(1),
        selection: pruneSelection(selection, restored),
        playback: playbackForScenarioChange(playback, restored),
        ui: ui.connectSuggestion ? { ...ui, connectSuggestion: null } : ui,
      })
    },

    replaceScenario: (s) =>
      set((st) => ({
        scenario: s,
        past: [],
        future: [],
        selection: EMPTY_SELECTION,
        playback: freshPlayback(st.playback.runSeq, st.playback.speedMult, 'scenario-loaded'),
        ui: { ...st.ui, ...CLEARED_DRAFT, tool: 'select' },
      })),

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
          // A threat flies at one altitude, seeded from the model profile so a
          // fresh drop is not silently at ground level. Null keeps the
          // threatAltitudeFt fallback (profile, else the band midpoint).
          ...(model.kind === 'uas'
            ? { altitudeFt: model.threatProfile?.altitudeFt ?? null }
            : {}),
        }
        return { ...s, entities: [...s.entities, entity] }
      })
      if (!screen) return
      const kind = get().scenario.entities.find((e) => e.id === id)?.kind
      if (kind === 'sensor' || kind === 'effector' || kind === 'c2') {
        // Always: a fresh drop should tell the user what this system CAN
        // integrate with even when nothing compatible is in range yet.
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

    deleteSelection: () =>
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
      }),

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
        // A researched pairing types the hand-drawn link; anything else keeps
        // the plain kind-default label.
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
      // Documented pairings inside their medium range wire themselves in one
      // undoable step; the popup confirms them and only the probable/inferred
      // remainder still needs a click.
      const autoConnected = all.filter((c) => c.verdict.confidence === 'documented')
      const candidates = all.filter((c) => c.verdict.confidence !== 'documented')
      if (autoConnected.length > 0) {
        mutate((s) => {
          const added = typedConnections(s, autoConnected)
          return added.length > 0 ? { ...s, connections: [...s.connections, ...added] } : s
        })
      }
      // Informational mode needs integration facts to show; skip unprofiled
      // (custom) models so the popup is never an empty box.
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
        // Aligned with preset.components so link indexes stay valid; null when
        // the referenced model is gone.
        const placed: Array<Entity | null> = preset.components.map((comp, i) => {
          const model = s.library.find((m) => m.id === comp.specId)
          if (!model) return null
          const baseName = model.name.split(':').pop()?.trim() ?? model.name
          const dupes = preset.components.filter((c) => c.specId === comp.specId).length
          const nth = preset.components.slice(0, i).filter((c) => c.specId === comp.specId).length
          // Orient the whole laydown: rotate offsets about the drop point and
          // slew each component's own facing by the same amount.
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

    addDraftPoint: (p) => set((st) => ({ ui: { ...st.ui, draftPoints: [...st.ui.draftPoints, p] } })),

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
      const { scenario } = get()
      const tactic = THREAT_TACTICS.find((t) => t.id === tacticId)
      if (!tactic) return
      // Seed-id-first designator match; generic tactics fall back to the most
      // recently placed UAS model and stay editable in the builder card.
      let platformSpecId = resolvePlatform(tactic, scenario.library)?.id ?? null
      if (!platformSpecId) {
        for (let i = scenario.entities.length - 1; i >= 0; i--) {
          const e = scenario.entities[i]
          if (e.kind !== 'uas' || !e.specId) continue
          const m = scenario.library.find((x) => x.id === e.specId)
          if (m?.uas) {
            platformSpecId = m.id
            break
          }
        }
      }
      const assets = scenario.entities.filter((e) => e.kind === 'asset')
      // Arming replaces any in-progress draw draft so the next canvas click
      // can only mean "place the raid axis".
      set((st) => ({
        ui: {
          ...st.ui,
          tool: 'select',
          draftPoints: [],
          pathEntityId: null,
          connectFromId: null,
          calibrateA: null,
          calibrateB: null,
          raidDraft: {
            tacticId,
            platformSpecId,
            targetEntityId: assets.length === 1 ? assets[0].id : null,
            shipCount: tactic.defaultShipCount,
          },
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
      const draft = ui.raidDraft
      if (!draft) return
      const tactic = THREAT_TACTICS.find((t) => t.id === draft.tacticId)
      const platform = draft.platformSpecId
        ? scenario.library.find((m) => m.id === draft.platformSpecId)
        : undefined
      const target = draft.targetEntityId
        ? scenario.entities.find((e) => e.id === draft.targetEntityId)
        : undefined
      // Blocked until a UAS platform and a target asset are chosen; the draft
      // stays armed so the builder card can complete it.
      if (!tactic || !platform?.uas || !target) return

      const shipCount = Number.isFinite(draft.shipCount)
        ? Math.min(60, Math.max(1, Math.floor(draft.shipCount)))
        : 1
      // Ingress bearing: click point toward the target; no anchor (or a click
      // on the target itself) uses the tactic default.
      const ingressDeg =
        axisAnchor && dist(axisAnchor, target.pos) > 1
          ? bearingDeg(axisAnchor, target.pos)
          : tactic.defaultBearingDeg
      const axes = fanAxes(ingressDeg, tactic.axes, tactic.axisSpreadDeg)

      // Decoy platform, resolved like a one-designator tactic. Unresolvable
      // decoys degrade to an all-strike raid rather than blocking.
      const decoySpec = tactic.decoy
        ? resolvePlatform(
            { ...tactic, platforms: [{ designator: tactic.decoy.designator }] },
            scenario.library,
          )
        : null
      const specFor = (shipIdx: number): SpecModel =>
        tactic.decoy != null && decoySpec != null && (shipIdx + 1) % tactic.decoy.everyNth === 0
          ? decoySpec
          : platform

      // Spawn standoff clamp: no ship's own start point (after formation
      // offsets, against its OWN spec: a decoy has its own signature) may be
      // held by an enabled sensor at T0, under the real per-sensor rule
      // (sector wedge, environment, target scaling, RF silence and bands,
      // the EO/IR cue rule). The standoff steps outward until the group is
      // clear, then takes the clearance margin.
      const sensors = scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e))
      const layoutFor = (heading: number, members: number[], standoffM: number): Vec2[] => {
        const origin = destination(target.pos, heading + 180, standoffM)
        const f = tactic.formation
        const offsets = f
          ? formationOffsets(f.shape, members.length, f.spacingM, heading)
          : formationOffsets('column', members.length, RAID_TRAIL_SPACING_M, heading)
        return members.map((_, j) => ({ x: origin.x + offsets[j].x, y: origin.y + offsets[j].y }))
      }
      const held = (members: number[], pts: Vec2[]): boolean =>
        pts.some((p, j) => sensorHoldsPoint(scenario, sensors, specFor(members[j]), p))
      const clearLayout = (heading: number, members: number[]): Vec2[] => {
        let d = tactic.standoffM
        let pts = layoutFor(heading, members, d)
        if (!held(members, pts)) return pts
        for (let i = 0; i < STANDOFF_MAX_STEPS && held(members, pts); i++) {
          d *= STANDOFF_STEP
          pts = layoutFor(heading, members, d)
        }
        return layoutFor(heading, members, d * STANDOFF_CLEAR_FACTOR)
      }

      // Ship i flies wave floor(i / shipsPerWave) on axis i % axes, so every
      // wave draws from every ingress axis. Each wave-axis group is laid out
      // with the tactic formation (in-trail column when the tactic has none).
      const perWave = Math.max(1, Math.floor(tactic.shipsPerWave))
      const groups = new Map<string, number[]>()
      for (let i = 0; i < shipCount; i++) {
        const key = `${Math.floor(i / perWave)}:${i % axes.length}`
        const members = groups.get(key)
        if (members) members.push(i)
        else groups.set(key, [i])
      }
      const starts: Vec2[] = new Array(shipCount)
      const headings: number[] = new Array(shipCount)
      for (const [key, members] of groups) {
        const heading = axes[Number(key.split(':')[1])]
        // Origin: target displaced along the reciprocal of the ingress axis.
        const pts = clearLayout(heading, members)
        members.forEach((shipIdx, j) => {
          starts[shipIdx] = pts[j]
          headings[shipIdx] = heading
        })
      }

      const entities: Entity[] = []
      const paths: FlightPath[] = []
      for (let i = 0; i < shipCount; i++) {
        const spec = specFor(i)
        const designator =
          spec.threatProfile?.designator ?? spec.name.split(':').pop()?.trim() ?? spec.name
        const id = newId('ent')
        entities.push({
          id,
          name: `${designator} ${i + 1}`,
          kind: 'uas',
          specId: spec.id,
          pos: starts[i],
          headingDeg: headings[i],
          color: null,
          notes: `${tactic.id} ship ${i + 1} of ${shipCount}`,
          altitudeFt: spec.threatProfile?.altitudeFt ?? null,
        })
        paths.push({
          id: newId('pth'),
          entityId: id,
          points: [starts[i], { ...target.pos }],
          speedMps: null,
          startDelayS: 0,
        })
      }
      const plan = buildRaidPlan(
        { shipsPerWave: perWave, waveSpacingS: tactic.waveSpacingS },
        entities.map((e) => e.id),
      )

      // ONE mutate: a single Cmd+Z removes the entire raid.
      mutate((s) => ({
        ...s,
        entities: [...s.entities, ...entities],
        paths: [...s.paths, ...paths],
        raid: { waves: [...(s.raid?.waves ?? []), ...plan.waves] },
      }))
      set((st) => ({ ui: { ...st.ui, raidDraft: null } }))
      // Bring the raid origins and the target into view (camera is not undoable).
      const cam = fitCameraTo([target.pos, ...starts])
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
          fieldElevationFt == null
            ? s.environment
            : { ...s.environment, fieldElevationFt },
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
          model.sensor = { sensorType: 'radar', detectRangeM: 10000, classifyRangeM: 5000, sectorDeg: 360 }
        }
        if (kind === 'effector') {
          model.effector = { effectorType: 'interceptor', minRangeM: 500, maxRangeM: 10000, engageTimeS: 60 }
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
        library: s.library.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      })),

    deleteModel: (id) =>
      mutate((s) => ({
        ...s,
        library: s.library.filter((m) => m.id !== id),
        deletedSeedIds: withDeletedSeed(s, id, s.library.find((m) => m.id === id)?.builtin),
        entities: s.entities.map((e) => (e.specId === id ? { ...e, specId: null } : e)),
      })),

    mergeLibrary: (models) =>
      mutate((s) => {
        const existing = new Set(s.library.map((m) => m.id))
        const added = models.filter((m) => !existing.has(m.id))
        return { ...s, library: [...s.library, ...added] }
      }),

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

    deleteCard: (id) => mutate((s) => ({ ...s, testCards: s.testCards.filter((c) => c.id !== id) })),

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
      if (!frame) return
      writeView({ camera: { ...frame.camera }, basemap: frame.basemap })
      set((st) => {
        // A frame is a recorded instant of this run: play resumes from it, so
        // the observation horizon covers it, as startRun requires.
        const ready = frame.simTimeS === 0 && st.playback.startedAtMs == null
        return {
          camera: { ...frame.camera },
          playback: {
            ...st.playback,
            playing: false,
            simTimeS: frame.simTimeS,
            observedThroughS: Math.max(st.playback.observedThroughS, frame.simTimeS),
            phase: ready ? 'ready' : 'review',
            startedAtMs: ready ? st.playback.startedAtMs : (st.playback.startedAtMs ?? Date.now()),
            basisSignature: ready
              ? st.playback.basisSignature
              : (st.playback.basisSignature ?? analysisBasisSignature(st.scenario)),
          },
          ui: { ...st.ui, basemap: frame.basemap },
        }
      })
    },

    deleteFrame: (id) => mutate((s) => ({ ...s, frames: s.frames.filter((f) => f.id !== id) })),

    select: (patch, additive = false) =>
      set((st) => {
        if (additive && patch.entityIds) {
          const merged = new Set([...st.selection.entityIds, ...patch.entityIds])
          return { selection: { ...st.selection, entityIds: [...merged] } }
        }
        return { selection: { ...EMPTY_SELECTION, ...patch } }
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
      writeView({ rightTab: t })
      set((st) => ({ ui: { ...st.ui, rightTab: t } }))
    },
    setMoveUnderlay: (v) => set((st) => ({ ui: { ...st.ui, moveUnderlay: v } })),
    setLayer: (key, v) => {
      const layers = { ...get().ui.layers, [key]: v }
      writeLayers(layers)
      set((st) => ({ ui: { ...st.ui, layers } }))
    },
    toggleLayer: (key) => {
      const current = get().ui.layers
      const layers = { ...current, [key]: !current[key] }
      writeLayers(layers)
      set((st) => ({ ui: { ...st.ui, layers } }))
    },
    applyLayerPreset: (p) => {
      const layers = { ...LAYER_PRESETS[p] }
      writeLayers(layers)
      set((st) => ({ ui: { ...st.ui, layers } }))
    },
    setLocationDialogOpen: (v) => set((st) => ({ ui: { ...st.ui, locationDialogOpen: v } })),
    setSaveState: (lastAutosaveAt, error) => set({ save: { lastAutosaveAt, error } }),
    setUnits: (v) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(UNITS_KEY, v)
      set((st) => ({ ui: { ...st.ui, units: v } }))
    },

    // Compatibility wrappers for dev-console callers. UI code uses the
    // explicit lifecycle actions below so scrub and observation never mix.
    setPlaying: (p) => {
      if (p) get().startRun()
      else get().pauseRun()
    },
    setSimTime: (t) => get().scrubTo(t),
    setSpeedMult: (m) => set((st) => ({ playback: { ...st.playback, speedMult: m } })),

    startRun: () =>
      set((st) => {
        if (st.playback.completedAtMs != null) return st
        // A preview beyond the observed horizon is never silently promoted
        // to live data. Resume from the last actually observed instant.
        const simTimeS = Math.min(st.playback.simTimeS, st.playback.observedThroughS)
        if (st.playback.startedAtMs == null) writeRunSeq(st.playback.runSeq + 1)
        return {
          playback: {
            ...st.playback,
            playing: true,
            simTimeS,
            phase: 'running',
            startedAtMs: st.playback.startedAtMs ?? Date.now(),
            basisSignature:
              st.playback.basisSignature ?? analysisBasisSignature(st.scenario),
          },
        }
      }),

    pauseRun: () =>
      set((st) => ({
        playback: {
          ...st.playback,
          playing: false,
          phase: st.playback.startedAtMs == null ? 'ready' : 'paused',
        },
      })),

    advanceRun: (t) =>
      set((st) => {
        const simTimeS = Math.max(0, t)
        if (st.playback.startedAtMs == null) writeRunSeq(st.playback.runSeq + 1)
        return {
          playback: {
            ...st.playback,
            playing: true,
            phase: 'running',
            simTimeS,
            observedThroughS: Math.max(st.playback.observedThroughS, simTimeS),
            startedAtMs: st.playback.startedAtMs ?? Date.now(),
            basisSignature:
              st.playback.basisSignature ?? analysisBasisSignature(st.scenario),
          },
        }
      }),

    completeRun: (durationS) =>
      set((st) => ({
        playback: {
          ...st.playback,
          playing: false,
          simTimeS: durationS,
          observedThroughS: Math.max(st.playback.observedThroughS, durationS),
          phase: 'complete',
          startedAtMs: st.playback.startedAtMs ?? Date.now(),
          completedAtMs: Date.now(),
          basisSignature:
            st.playback.basisSignature ?? analysisBasisSignature(st.scenario),
        },
      })),

    scrubTo: (t) =>
      set((st) => {
        const simTimeS = Math.max(0, t)
        const ready = simTimeS === 0 && st.playback.startedAtMs == null
        return {
          playback: {
            ...st.playback,
            playing: false,
            simTimeS,
            phase: ready ? 'ready' : 'review',
          },
        }
      }),

    resetRun: (reason = 'manual') =>
      set((st) => {
        const runSeq = reason === 'manual' ? st.playback.runSeq + 1 : st.playback.runSeq
        if (reason === 'manual') writeRunSeq(runSeq)
        return { playback: freshPlayback(runSeq, st.playback.speedMult, reason) }
      }),

  }
})

/** Model referenced by an entity, if any. */
export function modelFor(scenario: Scenario, entity: Entity): SpecModel | undefined {
  return scenario.library.find((m) => m.id === entity.specId) ?? undefined
}

/** Effective speed for a flight path: override, spec cruise, or 15 m/s fallback. */
export function pathSpeed(scenario: Scenario, path: FlightPath): number {
  if (path.speedMps && path.speedMps > 0) return path.speedMps
  const entity = scenario.entities.find((e) => e.id === path.entityId)
  const model = entity ? modelFor(scenario, entity) : undefined
  return model?.uas?.cruiseSpeedMps ?? 15
}

/** Scenario duration: longest path flight time plus path and wave delays, minimum 60 s. */
export function scenarioDurationS(scenario: Scenario): number {
  let max = 60
  for (const p of scenario.paths) {
    const t = effectivePathDelayS(scenario, p) + pathLength(p.points) / pathSpeed(scenario, p)
    if (t > max) max = t
  }
  return Math.ceil(max)
}

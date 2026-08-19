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
  RunLogEntry,
  Scenario,
  SpecModel,
  TestCard,
  Vec2,
} from '../model/types'
import { newId } from '../model/types'
import { emptyScenario } from '../model/seed'
import { pathLength } from '../geometry/geo'

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
}

interface PlaybackState {
  playing: boolean
  simTimeS: number
  speedMult: number
}

export interface Store {
  scenario: Scenario
  past: Scenario[]
  future: Scenario[]
  selection: Selection
  camera: Camera
  ui: UiState
  playback: PlaybackState

  // History
  undo: () => void
  redo: () => void

  // Scenario lifecycle
  replaceScenario: (s: Scenario) => void
  setScenarioName: (name: string) => void

  // Entities
  addEntityFromModel: (modelId: string, pos: Vec2) => void
  updateEntity: (id: string, patch: Partial<Entity>) => void
  moveEntity: (id: string, pos: Vec2) => void
  deleteSelection: () => void

  // Connections
  beginConnect: (fromId: string) => void
  completeConnect: (toId: string) => void
  updateConnection: (id: string, patch: Partial<Connection>) => void

  // Boundaries and paths
  addDraftPoint: (p: Vec2) => void
  finishBoundary: (closed: boolean) => void
  beginPath: (entityId: string) => void
  finishPath: () => void
  cancelDraft: () => void
  updateBoundary: (id: string, patch: Partial<Boundary>) => void
  updatePath: (id: string, patch: Partial<FlightPath>) => void
  deletePathForEntity: (entityId: string) => void

  // Underlay
  setUnderlayImage: (dataUrl: string, naturalW: number, naturalH: number) => void
  updateUnderlay: (patch: Partial<Scenario['underlay']>) => void
  setCalibratePoint: (p: Vec2) => void
  applyCalibration: (trueDistM: number) => void

  // Library
  addModel: (kind: EntityKind) => string
  duplicateModel: (id: string) => string
  updateModel: (id: string, patch: Partial<SpecModel>) => void
  deleteModel: (id: string) => void
  mergeLibrary: (models: SpecModel[]) => void

  // Test cards
  addCard: () => string
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

  // Playback
  setPlaying: (p: boolean) => void
  setSimTime: (t: number) => void
  setSpeedMult: (m: number) => void
}

const KIND_NAMES: Record<EntityKind, string> = {
  sensor: 'Sensor',
  effector: 'Effector',
  c2: 'C2',
  uas: 'UAS',
  asset: 'Asset',
  marker: 'Marker',
}

export const useStore = create<Store>()((set, get) => {
  /** Apply an undoable scenario change. */
  function mutate(fn: (s: Scenario) => Scenario) {
    const { scenario, past } = get()
    const next = fn(scenario)
    if (next === scenario) return
    set({
      scenario: next,
      past: [...past.slice(-HISTORY_LIMIT + 1), scenario],
      future: [],
    })
  }

  return {
    scenario: emptyScenario(),
    past: [],
    future: [],
    selection: EMPTY_SELECTION,
    camera: { x: 0, y: 0, scale: 0.05 },
    ui: {
      basemap: 'canvas',
      tool: 'select',
      boundaryType: 'range',
      draftPoints: [],
      pathEntityId: null,
      connectFromId: null,
      calibrateA: null,
      calibrateB: null,
      rightTab: 'inspect',
      moveUnderlay: false,
    },
    playback: { playing: false, simTimeS: 0, speedMult: 1 },

    undo: () => {
      const { past, future, scenario } = get()
      if (past.length === 0) return
      set({
        scenario: past[past.length - 1],
        past: past.slice(0, -1),
        future: [scenario, ...future],
        selection: EMPTY_SELECTION,
      })
    },

    redo: () => {
      const { past, future, scenario } = get()
      if (future.length === 0) return
      set({
        scenario: future[0],
        past: [...past, scenario],
        future: future.slice(1),
        selection: EMPTY_SELECTION,
      })
    },

    replaceScenario: (s) =>
      set({
        scenario: s,
        past: [],
        future: [],
        selection: EMPTY_SELECTION,
        playback: { playing: false, simTimeS: 0, speedMult: 1 },
      }),

    setScenarioName: (name) => mutate((s) => ({ ...s, name })),

    addEntityFromModel: (modelId, pos) =>
      mutate((s) => {
        const model = s.library.find((m) => m.id === modelId)
        if (!model) return s
        const count = s.entities.filter((e) => e.specId === modelId).length
        const entity: Entity = {
          id: newId('ent'),
          name: `${model.name.split(':').pop()?.trim() ?? KIND_NAMES[model.kind]} ${count + 1}`,
          kind: model.kind,
          specId: modelId,
          pos,
          headingDeg: 0,
          color: null,
          notes: '',
        }
        return { ...s, entities: [...s.entities, entity] }
      }),

    updateEntity: (id, patch) =>
      mutate((s) => ({
        ...s,
        entities: s.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),

    moveEntity: (id, pos) => get().updateEntity(id, { pos }),

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
          }
        }
        if (boundaryId) {
          next = { ...next, boundaries: next.boundaries.filter((b) => b.id !== boundaryId) }
        }
        if (connectionId) {
          next = { ...next, connections: next.connections.filter((c) => c.id !== connectionId) }
        }
        if (next !== s) set({ selection: EMPTY_SELECTION })
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
        const conn: Connection = { id: newId('con'), fromId, toId, label: '' }
        return { ...s, connections: [...s.connections, conn] }
      })
    },

    updateConnection: (id, patch) =>
      mutate((s) => ({
        ...s,
        connections: s.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),

    addDraftPoint: (p) => set((st) => ({ ui: { ...st.ui, draftPoints: [...st.ui.draftPoints, p] } })),

    finishBoundary: (closed) => {
      const { ui } = get()
      const points = ui.draftPoints
      set((st) => ({ ui: { ...st.ui, draftPoints: [] } }))
      if (points.length < 2) return
      mutate((s) => {
        const boundary: Boundary = {
          id: newId('bnd'),
          name: `${ui.boundaryType} ${s.boundaries.length + 1}`,
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

    addModel: (kind) => {
      const id = newId('lib')
      mutate((s) => {
        const model: SpecModel = {
          id,
          name: `New ${KIND_NAMES[kind]} model`,
          kind,
          description: '',
          color: '#8ab4ff',
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
        entities: s.entities.map((e) => (e.specId === id ? { ...e, specId: null } : e)),
      })),

    mergeLibrary: (models) =>
      mutate((s) => {
        const existing = new Set(s.library.map((m) => m.id))
        const added = models.filter((m) => !existing.has(m.id))
        return { ...s, library: [...s.library, ...added] }
      }),

    addCard: () => {
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
          covariates: '',
          measures: [],
          procedure: [],
          thresholds: '',
          abortCriteria: '',
          expectedResults: '',
          linkedEntityIds: [],
          runs: [],
        }
        return { ...s, testCards: [...s.testCards, card] }
      })
      return id
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
          name: name || `Frame ${s.frames.length + 1}`,
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
      set((st) => ({
        camera: { ...frame.camera },
        playback: { ...st.playback, playing: false, simTimeS: frame.simTimeS },
        ui: { ...st.ui, basemap: frame.basemap },
      }))
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

    setCamera: (c) => set({ camera: c }),
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
        },
      })),
    setBasemap: (b) => set((st) => ({ ui: { ...st.ui, basemap: b } })),
    setBoundaryType: (t) => set((st) => ({ ui: { ...st.ui, boundaryType: t } })),
    setRightTab: (t) => set((st) => ({ ui: { ...st.ui, rightTab: t } })),
    setMoveUnderlay: (v) => set((st) => ({ ui: { ...st.ui, moveUnderlay: v } })),

    setPlaying: (p) => set((st) => ({ playback: { ...st.playback, playing: p } })),
    setSimTime: (t) => set((st) => ({ playback: { ...st.playback, simTimeS: Math.max(0, t) } })),
    setSpeedMult: (m) => set((st) => ({ playback: { ...st.playback, speedMult: m } })),
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

/** Scenario duration: longest path flight time plus delays, minimum 60 s. */
export function scenarioDurationS(scenario: Scenario): number {
  let max = 60
  for (const p of scenario.paths) {
    const t = p.startDelayS + pathLength(p.points) / pathSpeed(scenario, p)
    if (t > max) max = t
  }
  return Math.ceil(max)
}

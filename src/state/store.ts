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
  SystemPreset,
  TestCard,
  Vec2,
} from '../model/types'
import { entityActive, newId } from '../model/types'
import { emptyScenario } from '../model/seed'
import { standardCovariates } from '../model/seedCards'
import { bearingDeg, destination, dist, formationOffsets, pathLength, rotatePoint } from '../geometry/geo'
import { buildRaidPlan, effectivePathDelayS } from '../playback/raid'
import { fanAxes, resolvePlatform, THREAT_TACTICS } from '../playback/tactics'
import { effectiveDetectRangeM } from '../analysis/sensorEnv'

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
 * Spawn clamp for the tactic builder: raid origins sit beyond the longest
 * enabled sensor detection ring by this factor, so first detection happens
 * inside the play, never at T0.
 */
const STANDOFF_CLEAR_FACTOR = 1.1
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
  /** Open right-click menu; screen px within the canvas host, world meters. */
  contextMenu: { screen: Vec2; world: Vec2; entityId: string | null } | null
  /** Armed tactic builder; the next canvas click commits the raid. */
  raidDraft: RaidDraft | null
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

  // Library
  addModel: (kind: EntityKind) => string
  duplicateModel: (id: string) => string
  updateModel: (id: string, patch: Partial<SpecModel>) => void
  deleteModel: (id: string) => void
  mergeLibrary: (models: SpecModel[]) => void

  // Test cards
  addCard: (patch?: Partial<TestCard>) => string
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
      contextMenu: null,
      raidDraft: null,
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
      mutate((s) => ({ ...s, systemPresets: s.systemPresets.filter((p) => p.id !== id) })),

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
          raidDraft: null,
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

      const shipCount = Math.max(1, Math.floor(draft.shipCount))
      // Ingress bearing: click point toward the target; no anchor (or a click
      // on the target itself) uses the tactic default.
      const ingressDeg =
        axisAnchor && dist(axisAnchor, target.pos) > 1
          ? bearingDeg(axisAnchor, target.pos)
          : tactic.defaultBearingDeg
      const axes = fanAxes(ingressDeg, tactic.axes, tactic.axisSpreadDeg)

      // Clamp the spawn standoff beyond the longest enabled sensor detection
      // ring against this platform's group.
      let maxDetectM = 0
      for (const e of scenario.entities) {
        if (e.kind !== 'sensor' || !entityActive(e)) continue
        const spec = e.specId
          ? scenario.library.find((m) => m.id === e.specId)?.sensor
          : undefined
        if (!spec) continue
        const r = effectiveDetectRangeM(spec, scenario.environment, platform.uas.group)
        if (r > maxDetectM) maxDetectM = r
      }
      const standoffM = Math.max(tactic.standoffM, maxDetectM * STANDOFF_CLEAR_FACTOR)

      // Decoy platform, resolved like a one-designator tactic. Unresolvable
      // decoys degrade to an all-strike raid rather than blocking.
      const decoySpec = tactic.decoy
        ? resolvePlatform(
            { ...tactic, platforms: [{ designator: tactic.decoy.designator }] },
            scenario.library,
          )
        : null

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
        const origin = destination(target.pos, heading + 180, standoffM)
        const f = tactic.formation
        const offsets = f
          ? formationOffsets(f.shape, members.length, f.spacingM, heading)
          : formationOffsets('column', members.length, RAID_TRAIL_SPACING_M, heading)
        members.forEach((shipIdx, j) => {
          starts[shipIdx] = { x: origin.x + offsets[j].x, y: origin.y + offsets[j].y }
          headings[shipIdx] = heading
        })
      }

      const entities: Entity[] = []
      const paths: FlightPath[] = []
      for (let i = 0; i < shipCount; i++) {
        const isDecoy =
          tactic.decoy != null && decoySpec != null && (i + 1) % tactic.decoy.everyNth === 0
        const spec = isDecoy ? decoySpec : platform
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
          raidDraft: null,
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

/** Scenario duration: longest path flight time plus path and wave delays, minimum 60 s. */
export function scenarioDurationS(scenario: Scenario): number {
  let max = 60
  for (const p of scenario.paths) {
    const t = effectivePathDelayS(scenario, p) + pathLength(p.points) / pathSpeed(scenario, p)
    if (t > max) max = t
  }
  return Math.ceil(max)
}

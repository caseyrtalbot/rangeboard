import type { Entity, Scenario } from '../model/types'
import { defaultSensorRole, entityActive } from '../model/types'
import { profileFor } from '../model/integration'
import type { AttritionReport } from '../playback/attrition'
import type { DetectionHit, ThreatAssessment } from '../playback/sim'
import { killChainRoutes } from '../playback/killChain'
import { expectedDeadTimes } from './threatAggregation'

export type ComponentTelemetryState =
  | 'disabled'
  | 'searching'
  | 'tracking'
  | 'ready'
  | 'routing'
  | 'target'
  | 'cooldown'
  | 'depleted'

export interface ComponentTelemetry {
  entityId: string
  name: string
  kind: 'sensor' | 'c2' | 'effector'
  purpose: string
  active: boolean
  state: ComponentTelemetryState
  tracksNow: number
  tracksSeen: number
  classifications: number
  /**
   * INTEGRATED TRACK-SECONDS: sensor-seconds summed over tracks, so a sensor
   * holding three tracks for 100 s reports 300. It is a legitimate sensor
   * loading measure and it is NOT a clock reading; it can exceed the run
   * length by the number of simultaneous tracks. Use holdSeconds for elapsed
   * time and never render this one with a clock formatter.
   */
  trackSeconds: number
  /**
   * UNION HOLD TIME: the clock seconds during which this sensor held at least
   * one track, up to t. Concurrent tracks count once, so it is bounded by the
   * elapsed run time (plus the one 0.5 s sample width every held sample
   * carries). This is the figure a clock formatter can read.
   */
  holdSeconds: number
  /**
   * Threats this effector can service right now: gate open, in an engagement
   * window, route available, and NOT expected dead. A ghost track is not a
   * target, so it never holds a target slot open (see expectedDeadTimes).
   */
  targetsNow: number
  salvosAssigned: number
  effectsLanded: number
  expectedKills: number
  capacityRemaining: number | null
  capacityTotal: number | null
  downstreamEffectors: number
}

export interface SystemTelemetryGroup {
  id: string
  name: string
  activeComponents: number
  componentCount: number
  tracksNow: number
  tracksSeen: number
  salvosAssigned: number
  effectsLanded: number
  expectedKills: number
  components: ComponentTelemetry[]
}

function modelFor(scenario: Scenario, entity: Entity) {
  return scenario.library.find((model) => model.id === entity.specId)
}

function intervalContains(intervals: Array<[number, number]>, tS: number): boolean {
  return intervals.some(([start, end]) => tS >= start - 0.25 && tS <= end + 0.25)
}

/** Integrated dwell on ONE track up to t; each held sample carries its 0.5 s width. */
function observedSeconds(intervals: Array<[number, number]>, tS: number): number {
  let seconds = 0
  for (const [start, end] of intervals) {
    if (start > tS) continue
    seconds += Math.max(0, Math.min(end, tS) - start) + 0.5
  }
  return seconds
}

/**
 * Union hold time up to t: the clock seconds a sensor held at least one
 * track. Intervals from different tracks overlap freely, so they are merged
 * before they are summed; samples one 0.5 s step apart belong to the same
 * continuous hold. Each merged span carries one sample width, exactly as
 * observedSeconds does per track, so the total is bounded by elapsed time
 * plus one sample and can never double count concurrent tracks.
 */
function unionSeconds(intervals: Array<[number, number]>, tS: number): number {
  const clipped = intervals
    .filter(([start]) => start <= tS)
    .map(([start, end]) => [start, Math.min(end, tS)] as [number, number])
    .sort((a, b) => a[0] - b[0])
  let seconds = 0
  let span: [number, number] | null = null
  for (const [start, end] of clipped) {
    if (span && start <= span[1] + 0.5 + 1e-9) span[1] = Math.max(span[1], end)
    else {
      if (span) seconds += span[1] - span[0] + 0.5
      span = [start, end]
    }
  }
  if (span) seconds += span[1] - span[0] + 0.5
  return seconds
}

function observationsByTime(a: ThreatAssessment, tS: number): string[] {
  return (a.sensorObservations ?? [])
    .filter((observation) => observation.firstDetectS <= tS)
    .map((observation) => observation.sensorId)
}

/**
 * C2 nodes that receive a track from the selected sensors, plus every active
 * effector reachable downstream. This deliberately retains configured C2
 * traffic even when an effector also has a faster standalone route.
 */
function c2TrackRoutes(scenario: Scenario, sensorIds: Set<string>): Map<string, Set<string>> {
  const active = new Map(
    scenario.entities.filter(entityActive).map((entity) => [entity.id, entity]),
  )
  const out = new Map<string, string[]>()
  for (const connection of scenario.connections) {
    if (!active.has(connection.fromId) || !active.has(connection.toId)) continue
    const targets = out.get(connection.fromId) ?? []
    targets.push(connection.toId)
    out.set(connection.fromId, targets)
  }
  const routed = new Map<string, Set<string>>()
  const walkC2 = (c2Id: string, visited: Set<string>): Set<string> => {
    if (visited.has(c2Id)) return new Set()
    const nextVisited = new Set(visited).add(c2Id)
    const effectors = new Set<string>()
    for (const toId of out.get(c2Id) ?? []) {
      const target = active.get(toId)
      if (target?.kind === 'effector') effectors.add(toId)
      if (target?.kind === 'c2') {
        for (const effectorId of walkC2(toId, nextVisited)) effectors.add(effectorId)
      }
    }
    const existing = routed.get(c2Id) ?? new Set<string>()
    for (const effectorId of effectors) existing.add(effectorId)
    routed.set(c2Id, existing)
    return effectors
  }
  for (const sensorId of sensorIds) {
    if (active.get(sensorId)?.kind !== 'sensor') continue
    for (const toId of out.get(sensorId) ?? []) {
      if (active.get(toId)?.kind === 'c2') walkC2(toId, new Set())
    }
  }
  return routed
}

function routeAvailable(
  scenario: Scenario,
  a: ThreatAssessment,
  effector: Entity,
  tS: number,
): boolean {
  const route = killChainRoutes(scenario, new Set(observationsByTime(a, tS))).get(effector.id)
  if (!route) return false
  return !(
    route.typed &&
    route.fcSourceIds.length === 0 &&
    profileFor(effector.specId)?.guidance === 'fc-uplink'
  )
}

function purposeFor(entity: Entity, scenario: Scenario): string {
  if (entity.notes.trim()) return entity.notes.trim()
  const model = modelFor(scenario, entity)
  if (model?.sensor) return defaultSensorRole(model.sensor).replaceAll('-', ' ')
  if (model?.effector) return model.effector.effectorType.replaceAll('-', ' ')
  return entity.kind === 'c2' ? 'command and control' : entity.kind
}

function matchedPreset(scenario: Scenario, entities: Entity[]) {
  const specs = entities.map((entity) => entity.specId ?? '').sort()
  return scenario.systemPresets.find((preset) => {
    const presetSpecs = preset.components.map((component) => component.specId).sort()
    return presetSpecs.length === specs.length && presetSpecs.every((spec, index) => spec === specs[index])
  })
}

/** Component- and system-level state at one run time. */
export function systemTelemetryAt(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
  tS: number,
  currentHits: Map<string, DetectionHit[]>,
): SystemTelemetryGroup[] {
  const relevant = scenario.entities.filter(
    (entity): entity is Entity & { kind: 'sensor' | 'c2' | 'effector' } =>
      entity.kind === 'sensor' || entity.kind === 'c2' || entity.kind === 'effector',
  )
  // One ledger pass: the time each threat's expected residual drops below the
  // engine's expected-dead cutoff, so no surface reports a ghost as a target.
  const deadAtS = expectedDeadTimes(report)
  const sensorNow = new Map<string, Set<string>>()
  for (const [uasId, hits] of currentHits) {
    for (const hit of hits) {
      const tracks = sensorNow.get(hit.sensorId) ?? new Set<string>()
      tracks.add(uasId)
      sensorNow.set(hit.sensorId, tracks)
    }
  }

  const sensorSeen = new Map<string, Set<string>>()
  const sensorClassified = new Map<string, Set<string>>()
  const sensorSeconds = new Map<string, number>()
  const sensorIntervals = new Map<string, Array<[number, number]>>()
  for (const assessment of assessments) {
    for (const observation of assessment.sensorObservations ?? []) {
      if (observation.firstDetectS <= tS) {
        const seen = sensorSeen.get(observation.sensorId) ?? new Set<string>()
        seen.add(assessment.uasId)
        sensorSeen.set(observation.sensorId, seen)
        sensorSeconds.set(
          observation.sensorId,
          (sensorSeconds.get(observation.sensorId) ?? 0) + observedSeconds(observation.intervals, tS),
        )
        // Kept per sensor across every track so union hold can merge them.
        const spans = sensorIntervals.get(observation.sensorId) ?? []
        spans.push(...observation.intervals)
        sensorIntervals.set(observation.sensorId, spans)
      }
      if (observation.firstClassifyS != null && observation.firstClassifyS <= tS) {
        const classified = sensorClassified.get(observation.sensorId) ?? new Set<string>()
        classified.add(assessment.uasId)
        sensorClassified.set(observation.sensorId, classified)
      }
    }
  }

  const c2Now = new Map<string, Set<string>>()
  const c2Seen = new Map<string, Set<string>>()
  const c2Effectors = new Map<string, Set<string>>()
  const structuralRoutes = c2TrackRoutes(
    scenario,
    new Set(relevant.filter((entity) => entity.kind === 'sensor').map((entity) => entity.id)),
  )
  for (const [c2Id, downstream] of structuralRoutes) {
    c2Effectors.set(c2Id, new Set(downstream))
  }
  for (const [uasId, hits] of currentHits) {
    const routes = c2TrackRoutes(scenario, new Set(hits.map((hit) => hit.sensorId)))
    for (const [c2Id, downstream] of routes) {
      const now = c2Now.get(c2Id) ?? new Set<string>()
      now.add(uasId)
      c2Now.set(c2Id, now)
      const effectors = c2Effectors.get(c2Id) ?? new Set<string>()
      for (const effectorId of downstream) effectors.add(effectorId)
      c2Effectors.set(c2Id, effectors)
    }
  }
  for (const assessment of assessments) {
    if (assessment.firstDetectS == null || assessment.firstDetectS > tS) continue
    const routes = c2TrackRoutes(
      scenario,
      new Set(observationsByTime(assessment, tS)),
    )
    for (const [c2Id, downstream] of routes) {
      const seen = c2Seen.get(c2Id) ?? new Set<string>()
      seen.add(assessment.uasId)
      c2Seen.set(c2Id, seen)
      const effectors = c2Effectors.get(c2Id) ?? new Set<string>()
      for (const effectorId of downstream) effectors.add(effectorId)
      c2Effectors.set(c2Id, effectors)
    }
  }

  const components = new Map<string, ComponentTelemetry>()
  for (const entity of relevant) {
    const active = entityActive(entity)
    const model = modelFor(scenario, entity)
    const base = {
      entityId: entity.id,
      name: entity.name,
      kind: entity.kind,
      purpose: purposeFor(entity, scenario),
      active,
      tracksNow: 0,
      tracksSeen: 0,
      classifications: 0,
      trackSeconds: 0,
      holdSeconds: 0,
      targetsNow: 0,
      salvosAssigned: 0,
      effectsLanded: 0,
      expectedKills: 0,
      capacityRemaining: null,
      capacityTotal: null,
      downstreamEffectors: 0,
    }
    if (!active) {
      components.set(entity.id, { ...base, state: 'disabled' })
      continue
    }
    if (entity.kind === 'sensor') {
      const tracksNow = sensorNow.get(entity.id)?.size ?? 0
      components.set(entity.id, {
        ...base,
        state: tracksNow > 0 ? 'tracking' : 'searching',
        tracksNow,
        tracksSeen: sensorSeen.get(entity.id)?.size ?? 0,
        classifications: sensorClassified.get(entity.id)?.size ?? 0,
        trackSeconds: sensorSeconds.get(entity.id) ?? 0,
        holdSeconds: unionSeconds(sensorIntervals.get(entity.id) ?? [], tS),
      })
      continue
    }
    if (entity.kind === 'c2') {
      const tracksNow = c2Now.get(entity.id)?.size ?? 0
      components.set(entity.id, {
        ...base,
        state: tracksNow > 0 ? 'routing' : 'ready',
        tracksNow,
        tracksSeen: c2Seen.get(entity.id)?.size ?? 0,
        downstreamEffectors: c2Effectors.get(entity.id)?.size ?? 0,
      })
      continue
    }

    const events = report.events.filter((event) => event.effectorId === entity.id && event.tS <= tS)
    const landed = events.filter((event) => event.tEffectS <= tS)
    const used = events.length
    const capacityTotal = model?.effector?.magazineSize ?? null
    const capacityRemaining = capacityTotal == null ? null : Math.max(0, capacityTotal - used)
    let targetsNow = 0
    for (const assessment of assessments) {
      if (assessment.engageGateS == null || assessment.engageGateS > tS) continue
      // An expected-dead track is not a target. The engine stops assigning to
      // a ship below SHIP_DEAD_BELOW (attrition.ts), the track picture latches
      // it to GHOST, and this count has to agree: a completed run must never
      // read "1 targets" against a threat that has been a ghost for minutes.
      const deadS = deadAtS.get(assessment.uasId)
      if (deadS != null && tS >= deadS) continue
      const windows = assessment.effectorWindows.find((window) => window.effectorId === entity.id)
      if (!windows || !intervalContains(windows.intervals, tS)) continue
      if (routeAvailable(scenario, assessment, entity, tS)) targetsNow += 1
    }
    const cooldownS = model?.effector?.salvoCooldownS ?? 0
    const lastAssignment = events[events.length - 1]?.tS ?? null
    const cooling = lastAssignment != null && tS < lastAssignment + cooldownS
    const state: ComponentTelemetryState =
      capacityRemaining === 0
        ? 'depleted'
        : cooling
          ? 'cooldown'
          : targetsNow > 0
            ? 'target'
            : 'ready'
    components.set(entity.id, {
      ...base,
      state,
      targetsNow,
      salvosAssigned: used,
      effectsLanded: landed.length,
      expectedKills: landed.reduce((sum, event) => sum + event.killDelta, 0),
      capacityRemaining,
      capacityTotal,
    })
  }

  const grouped = new Map<string, Entity[]>()
  for (const entity of relevant) {
    const key = entity.systemId ? `system:${entity.systemId}` : 'independent'
    const entries = grouped.get(key) ?? []
    entries.push(entity)
    grouped.set(key, entries)
  }
  let integratedIndex = 0
  const result: SystemTelemetryGroup[] = []
  for (const [id, entities] of grouped) {
    const preset = id === 'independent' ? null : matchedPreset(scenario, entities)
    if (id !== 'independent') integratedIndex += 1
    const rows = entities.map((entity) => components.get(entity.id)!).filter(Boolean)
    const trackIdsNow = new Set<string>()
    const trackIdsSeen = new Set<string>()
    for (const entity of entities) {
      for (const id of sensorNow.get(entity.id) ?? []) trackIdsNow.add(id)
      for (const id of c2Now.get(entity.id) ?? []) trackIdsNow.add(id)
      for (const id of sensorSeen.get(entity.id) ?? []) trackIdsSeen.add(id)
      for (const id of c2Seen.get(entity.id) ?? []) trackIdsSeen.add(id)
    }
    result.push({
      id,
      name:
        id === 'independent'
          ? 'Independent components'
          : preset?.name ?? `Integrated system ${integratedIndex}`,
      activeComponents: rows.filter((row) => row.active).length,
      componentCount: rows.length,
      tracksNow: trackIdsNow.size,
      tracksSeen: trackIdsSeen.size,
      salvosAssigned: rows.reduce((sum, row) => sum + row.salvosAssigned, 0),
      effectsLanded: rows.reduce((sum, row) => sum + row.effectsLanded, 0),
      expectedKills: rows.reduce((sum, row) => sum + row.expectedKills, 0),
      components: rows,
    })
  }
  return result
}

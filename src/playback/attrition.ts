import type {
  EffectorSpec,
  Entity,
  FlightPath,
  Scenario,
  SpecModel,
  UasGroup,
  UasSpec,
} from '../model/types'
import { entityActive } from '../model/types'
import { dist, posAtTime } from '../geometry/geo'
import type { ThreatAssessment } from './sim'
import { assessAllThreats, connectedEffectorIds, memberPositions } from './sim'

/**
 * Deterministic expected-value attrition over the raid. No random rolls: each
 * salvo multiplies the target ship's survival probability by (1 - Pk) and the
 * magazine ledger counts the salvo. Pure function of the scenario; no store
 * imports, so it is trivially testable.
 *
 * Pk model and baselines follow the PicoGrid drone-swarm engagement
 * calculator (dormant core/ path): per-shot
 * Pk = basePk * distanceFalloff * sizePenalty * evasionPenalty.
 */

const DT = 0.5

/** Type-baseline single-shot Pk for specs saved before the pk field existed. */
export const DEFAULT_PK: Record<EffectorSpec['effectorType'], number> = {
  interceptor: 0.8,
  gun: 0.75,
  net: 0.7,
  de: 0.8,
  hpm: 0.7,
  jammer: 0.6,
}

/** Type-baseline seconds between salvos when the spec does not set one. */
export const DEFAULT_SALVO_COOLDOWN_S: Record<EffectorSpec['effectorType'], number> = {
  interceptor: 30,
  gun: 10,
  net: 60,
  de: 15,
  hpm: 5,
  jammer: 5,
}

/** Smaller airframes are harder to hit (source: Group 1 = 0.7 ... Group 4+ = 1.0). */
export const SIZE_PENALTY: Record<UasGroup, number> = { 1: 0.7, 2: 0.8, 3: 0.9, 4: 1, 5: 1 }

/** Pk multiplier for an evading target (source: x0.7). FPV airframes are
 *  hand-flown and jink; every other airframe flies waypoints. */
export const EVASION_PENALTY = 0.7

/** Distance falloff: 30% Pk reduction at max range (source formula). */
export function distanceFalloff(distM: number, maxRangeM: number): number {
  if (maxRangeM <= 0) return 0
  return Math.max(0, 1 - 0.3 * (distM / maxRangeM))
}

export interface ThreatAttrition {
  uasId: string
  /** Ships in the formation; 1 when the entity flies alone. */
  shipCount: number
  /** Sum over ships of (1 - survival probability). */
  expectedKills: number
  /** Mean per-ship survival probability; 1 = certain leaker. */
  leakProbability: number
  firstShotS: number | null
  shotsFired: number
  /** Effector with the largest expected-kill contribution; null when no shots. */
  killedByEffectorId: string | null
}

export interface EffectorAttrition {
  effectorId: string
  shotsFired: number
  /** Null when the magazine is unlimited (jammers, DE, HPM). */
  expectedRoundsRemaining: number | null
}

export interface AttritionTotals {
  /** Total ships across all threats with flight paths. */
  raidSize: number
  expectedKills: number
  expectedLeakers: number
  shotsFired: number
}

export interface AttritionReport {
  threats: ThreatAttrition[]
  effectors: EffectorAttrition[]
  totals: AttritionTotals
}

function specFor(scenario: Scenario, entity: Entity): SpecModel | undefined {
  return scenario.library.find((m) => m.id === entity.specId) ?? undefined
}

/** Effective path speed: override, spec cruise, or 15 m/s (matches store.pathSpeed). */
function speedFor(scenario: Scenario, path: FlightPath): number {
  if (path.speedMps && path.speedMps > 0) return path.speedMps
  const entity = scenario.entities.find((e) => e.id === path.entityId)
  const model = entity ? specFor(scenario, entity) : undefined
  return model?.uas?.cruiseSpeedMps ?? 15
}

interface ThreatState {
  a: ThreatAssessment
  entity: Entity
  uasSpec: UasSpec | undefined
  path: FlightPath | undefined
  speedMps: number
  /** Survival probability per ship, all starting at 1. */
  ships: number[]
  /** In-range intervals per connected effector; empty unless engageable. */
  windows: Map<string, Array<[number, number]>>
  /** Time the required track quality was met; shots start no earlier. */
  gateS: number | null
  shotsFired: number
  firstShotS: number | null
  /** Expected kills contributed per effector, for killedByEffectorId. */
  killContrib: Map<string, number>
}

interface EffectorState {
  entity: Entity
  spec: EffectorSpec
  pk: number
  cooldownS: number
  /** Null = unlimited. */
  rounds: number | null
  nextReadyS: number
  shotsFired: number
}

const EPS = 1e-9

/**
 * Resolve every engagement window into expected kills, leakers, and magazine
 * use. Sweeps the timeline at DT = 0.5 s; each ready effector fires one salvo
 * per salvoCooldownS at the first engageable threat whose window contains t,
 * targeting the ship with the highest survival probability, until the window
 * closes or the magazine is empty.
 */
export function resolveEngagements(scenario: Scenario): AttritionReport {
  const policy = scenario.engageOn ?? 'detected'
  const assessments = assessAllThreats(scenario).filter((a) => a.status !== 'no-path')

  const threats: ThreatState[] = assessments.map((a) => {
    const entity = scenario.entities.find((e) => e.id === a.uasId)!
    const uasSpec = specFor(scenario, entity)?.uas
    const path = scenario.paths.find((p) => p.entityId === a.uasId)
    const count = entity.formation && entity.formation.count > 1 ? entity.formation.count : 1
    const windows = new Map<string, Array<[number, number]>>()
    if (a.status === 'engageable') {
      const connected = connectedEffectorIds(scenario, new Set(a.detectingSensorIds))
      for (const w of a.effectorWindows) {
        if (connected.has(w.effectorId)) windows.set(w.effectorId, w.intervals)
      }
    }
    return {
      a,
      entity,
      uasSpec,
      path,
      speedMps: path ? speedFor(scenario, path) : 15,
      ships: Array.from({ length: count }, () => 1),
      windows,
      gateS: policy === 'confirmed' ? a.firstConfirmS : a.firstDetectS,
      shotsFired: 0,
      firstShotS: null,
      killContrib: new Map(),
    }
  })

  const effectors = new Map<string, EffectorState>()
  for (const e of scenario.entities) {
    if (e.kind !== 'effector' || !entityActive(e)) continue
    const spec = specFor(scenario, e)?.effector
    if (!spec) continue
    effectors.set(e.id, {
      entity: e,
      spec,
      pk: spec.pk ?? DEFAULT_PK[spec.effectorType],
      cooldownS: Math.max(spec.salvoCooldownS ?? DEFAULT_SALVO_COOLDOWN_S[spec.effectorType], DT),
      rounds: spec.magazineSize ?? null,
      nextReadyS: 0,
      shotsFired: 0,
    })
  }

  // The sweep only needs to cover the engagement windows.
  let tEnd = 0
  for (const ts of threats) {
    for (const intervals of ts.windows.values()) {
      for (const [, s1] of intervals) if (s1 > tEnd) tEnd = s1
    }
  }

  for (let t = 0; t <= tEnd + EPS; t += DT) {
    for (const es of effectors.values()) {
      if (t + EPS < es.nextReadyS) continue
      if (es.rounds != null && es.rounds <= 0) continue

      // First threat (scenario order) with gate met and this effector in window.
      let target: ThreatState | null = null
      for (const ts of threats) {
        if (ts.gateS == null || t + EPS < ts.gateS || !ts.path) continue
        const intervals = ts.windows.get(es.entity.id)
        if (!intervals) continue
        if (intervals.some(([s0, s1]) => t >= s0 - EPS && t <= s1 + EPS)) {
          target = ts
          break
        }
      }
      if (!target) continue

      // Aim at the ship most likely to still be alive (formations split shots).
      let shipIdx = 0
      for (let i = 1; i < target.ships.length; i++) {
        if (target.ships[i] > target.ships[shipIdx] + EPS) shipIdx = i
      }
      const sample = posAtTime(target.path!.points, target.speedMps, target.path!.startDelayS, t)
      const members = memberPositions(target.entity, sample.pos, sample.headingDeg)
      const shipPos = members[Math.min(shipIdx, members.length - 1)]

      const falloff = distanceFalloff(dist(es.entity.pos, shipPos), es.spec.maxRangeM)
      const size = target.uasSpec ? SIZE_PENALTY[target.uasSpec.group] : 1
      const evasion = target.uasSpec?.airframe === 'fpv' ? EVASION_PENALTY : 1
      const pk = Math.min(1, Math.max(0, es.pk * falloff * size * evasion))

      const before = target.ships[shipIdx]
      target.ships[shipIdx] = before * (1 - pk)
      target.shotsFired += 1
      if (target.firstShotS == null) target.firstShotS = t
      target.killContrib.set(es.entity.id, (target.killContrib.get(es.entity.id) ?? 0) + before * pk)

      es.shotsFired += 1
      if (es.rounds != null) es.rounds -= 1
      es.nextReadyS = t + es.cooldownS
    }
  }

  const threatRows: ThreatAttrition[] = threats.map((ts) => {
    const survival = ts.ships.reduce((s, v) => s + v, 0)
    let killedBy: string | null = null
    let best = 0
    for (const [id, v] of ts.killContrib) {
      if (v > best + EPS) {
        best = v
        killedBy = id
      }
    }
    return {
      uasId: ts.a.uasId,
      shipCount: ts.ships.length,
      expectedKills: ts.ships.length - survival,
      leakProbability: ts.ships.length > 0 ? survival / ts.ships.length : 1,
      firstShotS: ts.firstShotS,
      shotsFired: ts.shotsFired,
      killedByEffectorId: killedBy,
    }
  })

  const effectorRows: EffectorAttrition[] = [...effectors.values()].map((es) => ({
    effectorId: es.entity.id,
    shotsFired: es.shotsFired,
    expectedRoundsRemaining: es.rounds,
  }))

  const raidSize = threatRows.reduce((s, t) => s + t.shipCount, 0)
  const expectedKills = threatRows.reduce((s, t) => s + t.expectedKills, 0)
  return {
    threats: threatRows,
    effectors: effectorRows,
    totals: {
      raidSize,
      expectedKills,
      expectedLeakers: raidSize - expectedKills,
      shotsFired: threatRows.reduce((s, t) => s + t.shotsFired, 0),
    },
  }
}

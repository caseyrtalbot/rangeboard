import type {
  EffectorSpec,
  Entity,
  FlightPath,
  JamBehavior,
  Scenario,
  SpecModel,
  UasGroup,
  UasSpec,
} from '../model/types'
import { defaultJamBehavior, entityActive } from '../model/types'
import { dist, posAtTime } from '../geometry/geo'
import type { ThreatAssessment } from './sim'
import { assessAllThreats, connectedEffectorIds, memberPositions } from './sim'
import { effectivePathDelayS } from './raid'

/**
 * Deterministic expected-value attrition over the raid. No random rolls: each
 * salvo multiplies the target ship's survival probability by (1 - Pk) and the
 * magazine ledger counts the salvo. Pure function of the scenario; no store
 * imports, so it is trivially testable.
 *
 * Pk model and baselines follow the PicoGrid drone-swarm engagement
 * calculator (dormant core/ path): per-shot
 * Pk = basePk * distanceFalloff * sizePenalty * evasionPenalty.
 *
 * Outcomes split into two channels. Hard kills (interceptor, gun, net, DE,
 * HPM) destroy the airframe. Soft kills (jammer) apply the threat's
 * JamBehavior: 'drift' and 'return-home' end the approach — a mission kill
 * flagged soft — while 'continue' leaves the threat inbound with a degraded
 * track, so it still leaks.
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

/**
 * Kill-shot Pk penalty against a ship inbound under a 'continue' jam: the
 * denied GNSS/RF link silences emissions and degrades the track, so the
 * firing solution suffers. Planning factor on the source's 30% falloff scale.
 */
export const CONTINUE_TRACK_DEGRADE = 0.3

/** Effector types whose success destroys the airframe (vs a jammer soft kill). */
export function isHardKill(effectorType: EffectorSpec['effectorType']): boolean {
  return effectorType !== 'jammer'
}

export interface ThreatAttrition {
  uasId: string
  /** Ships in the formation; 1 when the entity flies alone. */
  shipCount: number
  /** Sum over ships of (1 - survival probability): hard plus soft kills. */
  expectedKills: number
  /** Expected ships destroyed by hard-kill effectors. */
  expectedHardKills: number
  /** Expected mission kills through the soft channel (jam ends the approach). */
  expectedSoftKills: number
  /** Mean per-ship survival probability; 1 = certain leaker. */
  leakProbability: number
  /** Mean probability a ship's track is jam-degraded on arrival ('continue'). */
  continueJamProb: number
  firstShotS: number | null
  shotsFired: number
  /** Effector with the largest expected-kill contribution; null when no shots. */
  killedByEffectorId: string | null
  /** True when killedByEffectorId is a jammer: the dominant kill is soft. */
  killedBySoft: boolean
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
  /** Hard plus soft kills. */
  expectedKills: number
  expectedHardKills: number
  expectedSoftKills: number
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

interface ShipState {
  /** Probability the ship is still inbound (not hard- or mission-killed). */
  alive: number
  /** Accumulated expected hard kills of this ship. */
  hard: number
  /** Accumulated expected soft (mission) kills of this ship. */
  soft: number
  /** Probability a 'continue' jam degrades this ship's track. */
  jammed: number
}

interface ThreatState {
  a: ThreatAssessment
  entity: Entity
  uasSpec: UasSpec | undefined
  path: FlightPath | undefined
  speedMps: number
  /** One expected-value state per ship in the formation. */
  ships: ShipState[]
  /** Response to a successful jam; spec value or nav-mode default. */
  jamBehavior: JamBehavior
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
      ships: Array.from({ length: count }, () => ({ alive: 1, hard: 0, soft: 0, jammed: 0 })),
      jamBehavior: uasSpec ? defaultJamBehavior(uasSpec) : 'drift',
      windows,
      gateS: a.engageGateS,
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

      const softShot = !isHardKill(es.spec.effectorType)
      const continueJam = softShot && target.jamBehavior === 'continue'

      // Aim where the shot still matters (formations split shots): killing
      // shots at the ship most likely alive; 'continue' jams at the ship most
      // likely alive and not yet jammed.
      const weight = (s: ShipState) => (continueJam ? s.alive * (1 - s.jammed) : s.alive)
      let shipIdx = 0
      for (let i = 1; i < target.ships.length; i++) {
        if (weight(target.ships[i]) > weight(target.ships[shipIdx]) + EPS) shipIdx = i
      }
      const sample = posAtTime(target.path!.points, target.speedMps, effectivePathDelayS(scenario, target.path!), t)
      const members = memberPositions(target.entity, sample.pos, sample.headingDeg)
      const shipPos = members[Math.min(shipIdx, members.length - 1)]

      const falloff = distanceFalloff(dist(es.entity.pos, shipPos), es.spec.maxRangeM)
      const size = target.uasSpec ? SIZE_PENALTY[target.uasSpec.group] : 1
      const evasion = target.uasSpec?.airframe === 'fpv' ? EVASION_PENALTY : 1
      const pk = Math.min(1, Math.max(0, es.pk * falloff * size * evasion))

      const ship = target.ships[shipIdx]
      if (continueJam) {
        // Jam holds but the threat presses on: no kill, the track degrades.
        ship.jammed += (1 - ship.jammed) * pk
      } else {
        // Kill shot; a jam-degraded track worsens the firing solution.
        const kill = ship.alive * pk * (1 - CONTINUE_TRACK_DEGRADE * ship.jammed)
        ship.alive -= kill
        if (softShot) ship.soft += kill
        else ship.hard += kill
        target.killContrib.set(es.entity.id, (target.killContrib.get(es.entity.id) ?? 0) + kill)
      }
      target.shotsFired += 1
      if (target.firstShotS == null) target.firstShotS = t

      es.shotsFired += 1
      if (es.rounds != null) es.rounds -= 1
      es.nextReadyS = t + es.cooldownS
    }
  }

  const threatRows: ThreatAttrition[] = threats.map((ts) => {
    const survival = ts.ships.reduce((s, v) => s + v.alive, 0)
    const hardKills = ts.ships.reduce((s, v) => s + v.hard, 0)
    const softKills = ts.ships.reduce((s, v) => s + v.soft, 0)
    const jammed = ts.ships.reduce((s, v) => s + v.jammed, 0)
    let killedBy: string | null = null
    let best = 0
    for (const [id, v] of ts.killContrib) {
      if (v > best + EPS) {
        best = v
        killedBy = id
      }
    }
    const killedBySpec = killedBy ? effectors.get(killedBy)?.spec : undefined
    return {
      uasId: ts.a.uasId,
      shipCount: ts.ships.length,
      expectedKills: hardKills + softKills,
      expectedHardKills: hardKills,
      expectedSoftKills: softKills,
      leakProbability: ts.ships.length > 0 ? survival / ts.ships.length : 1,
      continueJamProb: ts.ships.length > 0 ? jammed / ts.ships.length : 0,
      firstShotS: ts.firstShotS,
      shotsFired: ts.shotsFired,
      killedByEffectorId: killedBy,
      killedBySoft: killedBySpec != null && !isHardKill(killedBySpec.effectorType),
    }
  })

  const effectorRows: EffectorAttrition[] = [...effectors.values()].map((es) => ({
    effectorId: es.entity.id,
    shotsFired: es.shotsFired,
    expectedRoundsRemaining: es.rounds,
  }))

  const raidSize = threatRows.reduce((s, t) => s + t.shipCount, 0)
  const expectedHardKills = threatRows.reduce((s, t) => s + t.expectedHardKills, 0)
  const expectedSoftKills = threatRows.reduce((s, t) => s + t.expectedSoftKills, 0)
  const expectedKills = expectedHardKills + expectedSoftKills
  return {
    threats: threatRows,
    effectors: effectorRows,
    totals: {
      raidSize,
      expectedKills,
      expectedHardKills,
      expectedSoftKills,
      expectedLeakers: raidSize - expectedKills,
      shotsFired: threatRows.reduce((s, t) => s + t.shotsFired, 0),
    },
  }
}

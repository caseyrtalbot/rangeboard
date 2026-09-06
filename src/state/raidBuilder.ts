import type { Entity, FlightPath, RaidWave, Scenario, SpecModel, Vec2 } from '../model/types'
import { entityActive, newId } from '../model/types'
import { bearingDeg, destination, dist, formationOffsets } from '../geometry/geo'
import { buildRaidPlan } from '../playback/raid'
import { fanAxes, resolvePlatform, THREAT_TACTICS } from '../playback/tactics'
import { sensorHoldsPoint } from '../playback/detection'
import type { RaidDraft } from './store'

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

/** Everything `commitRaid` adds to the scenario, plus the points the camera fits. */
interface RaidBuild {
  entities: Entity[]
  paths: FlightPath[]
  /** Waves to append after the scenario's existing waves. */
  waves: RaidWave[]
  /** Ship start points in ship order. */
  starts: Vec2[]
  target: Entity
}

/**
 * The armed draft for a tactic: seed-id-first designator match; generic
 * tactics fall back to the most recently placed UAS model and stay editable
 * in the builder card. The sole asset becomes the target. Null for an
 * unknown tactic id.
 */
export function raidDraftFor(scenario: Scenario, tacticId: string): RaidDraft | null {
  const tactic = THREAT_TACTICS.find((t) => t.id === tacticId)
  if (!tactic) return null
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
  return {
    tacticId,
    platformSpecId,
    targetEntityId: assets.length === 1 ? assets[0].id : null,
    shipCount: tactic.defaultShipCount,
  }
}

/**
 * Lay out a raid from a draft: ships, two-point paths to the target and the
 * wave plan. Pure apart from the fresh ids. Null while the draft is blocked
 * (no tactic, no UAS platform or no target), so the caller leaves it armed.
 */
export function buildRaid(
  scenario: Scenario,
  draft: RaidDraft,
  axisAnchor: Vec2 | null,
): RaidBuild | null {
  const tactic = THREAT_TACTICS.find((t) => t.id === draft.tacticId)
  const platform = draft.platformSpecId
    ? scenario.library.find((m) => m.id === draft.platformSpecId)
    : undefined
  const target = draft.targetEntityId
    ? scenario.entities.find((e) => e.id === draft.targetEntityId)
    : undefined
  if (!tactic || !platform?.uas || !target) return null

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
  return { entities, paths, waves: plan.waves, starts, target }
}

import type { Entity, Scenario, SensorSpec, Vec2 } from '../model/types'
import type { MrirBasis } from '../model/types'
import {
  DEFAULT_REQUIREMENT_THRESHOLDS,
  entityActive,
  mountHeightOf,
  mrirBasisOf,
  mrirBasisText,
  mrirFractionOf,
  physicsSwitches,
} from '../model/types'
import { modelFor } from '../model/scenario'
import type { LayerVisibility } from '../state/layers'
import { ringVisible } from '../state/layers'
import type { RingKey, RingOverrides } from '../state/rings'
import type { DisplayUnits } from '../geometry/geo'
import { angleDiffDeg, bearingDeg, dist, formatDistance, formatNm } from '../geometry/geo'
import { groundRangeM } from '../geometry/slant'
import {
  effectiveClassifyRangeM,
  effectiveDetectRangeM,
  FT_TO_M,
  pdContoursM,
  radarPdModeled,
  sensorHoldGate,
} from '../analysis/sensorEnv'
import { effectiveJamRangeM } from '../analysis/ewPhysics'
import { defendedRadiusOf } from '../playback/sim'
import { threatAltitudeFt } from '../playback/tracks'
import type { ExtraRingKey } from '../panels/ringLabels'
import { EXTRA_RING_LABELS, RING_LABELS } from '../panels/ringLabels'
import type { EnvelopeBand, RingInk } from './layers/footprintStyle'
import {
  effectorRingStyle,
  envelopeBandM,
  PD_CONTOUR_HIGH,
  ringInkFor,
  sensorRingStyle,
} from './layers/footprintStyle'

/**
 * Every ring the board draws, prepared once from the scenario, the ring view and
 * the selected threat. The footprint layer draws the records; the HUD asks `hitAt`
 * which ring edge lies under the pointer. Ranges are meters. Dash, width and ink
 * come from footprintStyle.ts; this module resolves the ranges they apply to. The
 * ink is a theme-neutral token, because the records are cached across themes.
 */

/** The ring visibility and unit state the model reads. A narrow slice of `ui`. */
export interface RingView {
  units: DisplayUnits
  layers: LayerVisibility
  ringOverrides: RingOverrides
}

/** The readout height line: the selected threat altitude, feet AGL. */
function heightText(altitudeFt: number | null): string {
  return altitudeFt == null
    ? 'No threat'
    : `${Math.round(altitudeFt).toLocaleString('en-US')} ft AGL`
}

export interface SensorRings {
  kind: 'sensor'
  entity: Entity
  sectorDeg: number
  ink: RingInk
  /** The sensor holds this threat: only a held sensor takes the active highlight. */
  held: boolean
  grey: boolean
  /** Detect band over the placed threats, or null when the key is off. */
  band: EnvelopeBand | null
  placardM: number | null
  placardDash: number[] | null
  placardFill: boolean
  /** A Pd contour draws over the placard ring, so the placard steps back. */
  behind: boolean
  contourLowM: number | null
  contourHighM: number | null
  contourFill: boolean
  lowLabel: string | null
  highLabel: string | null
  classifyM: number | null
  /** Selected threat altitude, feet AGL, or null with no threat selected. */
  altitudeFt: number | null
}

export interface EffectorRings {
  kind: 'effector'
  entity: Entity
  sectorDeg: number
  ink: RingInk
  off: boolean
  /** MIR ring radius, ground projected for the selected threat, or null when the key is off. */
  maxM: number | null
  /** MRIR ring radius, ground projected likewise, or null when off or coincident with MIR. */
  mrirM: number | null
  minM: number | null
  mrirBasis: MrirBasis
  /** MRIR over MIR on the slant. */
  mrirFraction: number
  /** Selected threat altitude, feet AGL, or null with no threat selected. */
  altitudeFt: number | null
}

export interface JammerRings {
  kind: 'jammer'
  entity: Entity
  sectorDeg: number
  ink: RingInk
  off: boolean
  /** MIR: the effective jam range against the selected threat, ground projected, or null when the key is off. */
  rangeM: number | null
  /** MRIR: mrirFraction of the effective jam range, ground projected, or null when the key is off. */
  mrirM: number | null
  minM: number | null
  mrirBasis: MrirBasis
  mrirFraction: number
  altitudeFt: number | null
}

export interface AssetRings {
  kind: 'asset'
  entity: Entity
  ink: RingInk
  radiusM: number
}

export type EntityRings = SensorRings | EffectorRings | JammerRings | AssetRings

/** One record per entity. Visibility is `ringVisible`: the per-entity override, else ui.layers. */
function buildRings(scenario: Scenario, ui: RingView, selectedUasId: string | null): EntityRings[] {
  const env = scenario.environment
  const physics = physicsSwitches(scenario)
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
  const pdLow = thresholds.pdDetect
  const units = ui.units
  const selectedUas = selectedUasId
    ? scenario.entities.find((e) => e.id === selectedUasId)
    : undefined
  const target = selectedUas ? modelFor(scenario, selectedUas)?.uas : undefined
  // The engine range is a slant range to the threat altitude, so a ring on a
  // plan-view board is its ground projection.
  const altitudeFt = selectedUas ? threatAltitudeFt(scenario, selectedUas) : null
  const targetAltM = altitudeFt == null ? null : altitudeFt * FT_TO_M

  // Every threat on the board feeds the envelope band, each at its own altitude.
  const threats = scenario.entities.flatMap((u) => {
    if (u.kind !== 'uas') return []
    const spec = modelFor(scenario, u)?.uas
    if (!spec) return []
    return [{ spec, altM: threatAltitudeFt(scenario, u) * FT_TO_M }]
  })

  function envelopeFor(spec: SensorSpec): EnvelopeBand | null {
    const rs: number[] = []
    for (const t of threats) {
      const gate = sensorHoldGate(spec, t.spec)
      if (gate !== 'ok' && gate !== 'needs-cue') continue
      const r = effectiveDetectRangeM(spec, env, t.spec, pdLow, physics)
      rs.push(groundRangeM(r, t.altM - mountHeightOf(spec)))
    }
    return envelopeBandM(rs)
  }

  const out: EntityRings[] = []
  for (const e of scenario.entities) {
    const model = modelFor(scenario, e)

    if (e.kind === 'sensor') {
      const spec = model?.sensor
      if (!spec) continue
      const placardOn = ringVisible(ui, e.id, 'sensorPlacard')
      const envelopeOn = ringVisible(ui, e.id, 'sensorEnvelope')
      const contoursOn = ringVisible(ui, e.id, 'sensorPdContours')
      const classifyOn = ringVisible(ui, e.id, 'classifyRings')
      if (!placardOn && !envelopeOn && !contoursOn && !classifyOn) continue
      const dAltM = targetAltM == null ? null : targetAltM - mountHeightOf(spec)
      const project = (m: number) => (dAltM == null ? m : groundRangeM(m, dAltM))
      let pdLowM: number | null = null
      let pdHighM: number | null = null
      if (target) {
        const [low, high] = pdContoursM(spec, env, target, [pdLow, PD_CONTOUR_HIGH], physics)
        pdLowM = project(low)
        // Only a radar under the Pd model has a second contour.
        pdHighM = radarPdModeled(spec, target) ? project(high) : null
      }
      const classifySlantM = effectiveClassifyRangeM(spec, env, target, physics)
      const style = sensorRingStyle({
        gate: sensorHoldGate(spec, target),
        on: entityActive(e),
        // The placard is a reference condition: never target scaled, never projected.
        placardM: effectiveDetectRangeM(spec, env, undefined, undefined, physics),
        pdLowM,
        pdHighM,
        classifyM: classifySlantM == null ? null : project(classifySlantM),
        contoursOn: contoursOn && target != null,
        envelopeOn,
      })
      const ink: RingInk = style.grey ? 'grey' : ringInkFor(e)
      out.push({
        kind: 'sensor',
        entity: e,
        sectorDeg: spec.sectorDeg,
        ink,
        held: style.kind === 'held',
        grey: style.grey,
        band: envelopeOn && !style.grey ? envelopeFor(spec) : null,
        placardM: placardOn ? style.placardM : null,
        placardDash: style.placardDash,
        placardFill: placardOn && style.placardFill,
        behind: style.contourLowM != null || style.contourHighM != null,
        contourLowM: style.contourLowM,
        contourHighM: style.contourHighM,
        contourFill: style.contourFill,
        lowLabel:
          style.contourLowM == null
            ? null
            : `Pd ${pdLow} · ${formatDistance(style.contourLowM, units)}`,
        highLabel:
          style.contourHighM == null
            ? null
            : `Pd ${PD_CONTOUR_HIGH} · ${formatDistance(style.contourHighM, units)}`,
        classifyM: classifyOn ? style.classifyM : null,
        altitudeFt,
      })
      continue
    }

    if (e.kind === 'effector') {
      const spec = model?.effector
      if (!model || !spec) continue
      const maxOn = ringVisible(ui, e.id, 'effectorMaxRange')
      const mrirOn = ringVisible(ui, e.id, 'effectorDoctrinal')
      const minOn = ringVisible(ui, e.id, 'effectorMinRange')
      if (!maxOn && !mrirOn && !minOn) continue
      const off = !entityActive(e)
      const sectorDeg = spec.sectorDeg ?? 360
      // Every effector ring is the ground range at the selected threat altitude.
      const dAltM = targetAltM == null ? null : targetAltM - mountHeightOf(spec)
      const project = (m: number) => (dAltM == null ? m : groundRangeM(m, dAltM))
      const mrirFraction = mrirFractionOf(spec)
      const mrirBasis = mrirBasisOf(model, spec.mrirM)

      // A jammer draws its footprint wedge in the EW ink (FootprintLayer). Its MIR is
      // the effective jam range against the selected threat.
      if (spec.effectorType === 'jammer') {
        const jamM = effectiveJamRangeM(spec, target)
        out.push({
          kind: 'jammer',
          entity: e,
          sectorDeg,
          ink: off ? 'grey' : ringInkFor(e),
          off,
          rangeM: maxOn ? project(jamM) : null,
          // An MRIR equal to MIR draws once, as MIR; with MIR hidden it draws as MRIR.
          mrirM: mrirOn && !(maxOn && mrirFraction >= 1) ? project(jamM * mrirFraction) : null,
          minM: minOn && spec.minRangeM > 0 ? project(spec.minRangeM) : null,
          mrirBasis,
          mrirFraction,
          altitudeFt,
        })
        continue
      }

      const mrirGroundM = project(spec.maxRangeM * mrirFraction)
      const style = effectorRingStyle({
        on: !off,
        maxM: project(spec.maxRangeM),
        mrirM: mrirGroundM,
        minM: project(spec.minRangeM),
      })
      // The style drops an MRIR that coincides with MIR; with MIR hidden it is the ring left.
      const mrirM = maxOn ? style.mrirM : mrirGroundM > 0 ? mrirGroundM : null
      out.push({
        kind: 'effector',
        entity: e,
        sectorDeg,
        ink: style.grey ? 'grey' : 'white',
        off,
        maxM: maxOn ? style.maxM : null,
        mrirM: mrirOn ? mrirM : null,
        minM: minOn ? style.minM : null,
        mrirBasis,
        mrirFraction,
        altitudeFt,
      })
      continue
    }

    // The defended area is the boundary the engine scores arrival against, so the
    // ring is the same distance the leaker count uses.
    if (e.kind === 'asset' && ui.layers.defendedAreas) {
      out.push({
        kind: 'asset',
        entity: e,
        ink: ringInkFor(e),
        radiusM: defendedRadiusOf(e),
      })
    }
  }
  return out
}

/** Two ring records with equal fields; the band and the dash compare by value. */
function sameRings(a: EntityRings, b: EntityRings): boolean {
  if (a.kind !== b.kind || a.entity !== b.entity) return false
  const x = a as unknown as Record<string, unknown>
  const y = b as unknown as Record<string, unknown>
  for (const key of Object.keys(x)) {
    const u = x[key]
    const v = y[key]
    if (u === v) continue
    if (key === 'band' && u != null && v != null) {
      const bu = u as EnvelopeBand
      const bv = v as EnvelopeBand
      if (bu.innerM === bv.innerM && bu.outerM === bv.outerM) continue
    }
    if (key === 'placardDash' && Array.isArray(u) && Array.isArray(v)) {
      if (u.length === v.length && u.every((n, i) => n === v[i])) continue
    }
    return false
  }
  return true
}

/** Fresh records keep the previous object where nothing changed, so a node memo holds across a swap. */
function stableRings(next: EntityRings[], prev: EntityRings[]): EntityRings[] {
  if (prev.length === 0) return next
  const byId = new Map(prev.map((r) => [r.entity.id, r]))
  let reused = 0
  const out = next.map((r) => {
    const old = byId.get(r.entity.id)
    if (!old || !sameRings(r, old)) return r
    reused++
    return old
  })
  return reused === next.length && prev.length === next.length ? prev : out
}

// Both consumers share the expensive geometry; old scenarios can be collected.
const ringCache = new WeakMap<
  Scenario,
  { view: RingView; selected: string | null; rings: EntityRings[] }
>()

function sharedRings(scenario: Scenario, view: RingView, selected: string | null): EntityRings[] {
  const cached = ringCache.get(scenario)
  if (
    cached &&
    cached.selected === selected &&
    cached.view.units === view.units &&
    cached.view.layers === view.layers &&
    cached.view.ringOverrides === view.ringOverrides
  ) {
    return cached.rings
  }
  const rings = buildRings(scenario, view, selected)
  ringCache.set(scenario, { view, selected, rings })
  return rings
}

/** A ring control key, or an edge whose name is more specific than its control. */
export type RingEdgeKey = RingKey | ExtraRingKey

/** One ring edge a pointer can rest on. Derived once per prepared model. */
interface RingEdge {
  radiusM: number
  key: RingEdgeKey
  /** Arc the edge spans; 360 for a full ring. */
  sectorDeg: number
  /** The readout height line, or null when the edge is not computed at the threat altitude. */
  height: string | null
  /** The readout basis line (MRIR only), or null. */
  basis: string | null
}

export interface RingHit {
  entity: Entity
  key: RingEdgeKey
  /** Short ring name: MIR, MRIR, Min range or a sensor ring name. */
  name: string
  radiusM: number
  distanceM: number
  /** Distance in nm at two decimals. */
  distance: string
  /** Selected threat altitude ('400 ft AGL'), 'No threat', or null when the ring has no threat altitude. */
  height: string | null
  /** MRIR basis ('2/3 MIR · PF', '0.75 MIR · Edited', 'Sourced'), else null. */
  basis: string | null
}

/** The edges one record draws, in draw order. A minimum range stays circular under a sector. */
function ringEdges(r: EntityRings): RingEdge[] {
  const out: RingEdge[] = []
  const sector = r.kind === 'asset' ? 360 : r.sectorDeg
  const edge = (
    radiusM: number | null | undefined,
    key: RingEdgeKey,
    height: string | null,
    sectorDeg = sector,
    basis: string | null = null,
  ) => {
    if (radiusM != null && radiusM > 0) out.push({ radiusM, key, sectorDeg, height, basis })
  }
  if (r.kind === 'sensor') {
    const h = heightText(r.altitudeFt)
    // The placard is a reference condition and each band edge has its own threat altitude.
    edge(r.placardM, 'sensorPlacard', null)
    edge(r.contourLowM, 'pdLow', h)
    edge(r.contourHighM, 'pdHigh', h)
    edge(r.classifyM, 'classifyRings', h)
    edge(r.band?.innerM, 'envelopeInner', null)
    edge(r.band?.outerM, 'envelopeOuter', null)
  } else if (r.kind === 'effector' || r.kind === 'jammer') {
    const h = heightText(r.altitudeFt)
    edge(r.kind === 'effector' ? r.maxM : r.rangeM, 'effectorMaxRange', h)
    edge(r.mrirM, 'effectorDoctrinal', h, sector, mrirBasisText(r.mrirBasis, r.mrirFraction))
    edge(r.minM, 'effectorMinRange', h, 360)
  } else {
    edge(r.radiusM, 'defendedArea', null)
  }
  return out
}

function ringName(key: RingEdgeKey): string {
  return key in EXTRA_RING_LABELS
    ? EXTRA_RING_LABELS[key as ExtraRingKey]
    : RING_LABELS[key as RingKey]
}

type EntityEdges = Array<[Entity, RingEdge[]]>

/** Radial edge distance only; sector spokes are not ring edges. Ties keep draw order. */
export function hitRing(rings: EntityRings[], worldPt: Vec2, toleranceM: number): RingHit | null {
  return hitEdges(
    rings.map((r) => [r.entity, ringEdges(r)]),
    worldPt,
    toleranceM,
  )
}

function hitEdges(edges: EntityEdges, worldPt: Vec2, toleranceM: number): RingHit | null {
  let closest: RingHit | null = null
  for (const [entity, list] of edges) {
    if (list.length === 0) continue
    const distance = dist(entity.pos, worldPt)
    const bearing = bearingDeg(entity.pos, worldPt)
    for (const e of list) {
      if (e.sectorDeg < 360 && angleDiffDeg(bearing, entity.headingDeg) > e.sectorDeg / 2) continue
      const distanceM = Math.abs(distance - e.radiusM)
      if (!(distanceM <= toleranceM) || (closest && distanceM >= closest.distanceM)) continue
      closest = toHit(entity, e, distanceM)
    }
  }
  return closest
}

function toHit(entity: Entity, e: RingEdge, distanceM: number): RingHit {
  return {
    entity,
    key: e.key,
    name: ringName(e.key),
    radiusM: e.radiusM,
    distanceM,
    distance: formatNm(e.radiusM),
    height: e.height,
    basis: e.basis,
  }
}

/**
 * One entity's ring edge by key, read at a world point, or null when that ring is no
 * longer drawn. A pinned readout re-reads its ring here as the threat or rings change.
 */
export function ringHitFor(
  rings: EntityRings[],
  entityId: string,
  key: RingEdgeKey,
  worldPt: Vec2,
): RingHit | null {
  const r = rings.find((x) => x.entity.id === entityId)
  const e = r ? ringEdges(r).find((x) => x.key === key) : undefined
  if (!r || !e) return null
  return toHit(r.entity, e, Math.abs(dist(r.entity.pos, worldPt) - e.radiusM))
}

/** Screen pixels between the pointer and a ring edge that still count as on the edge. */
export const RING_HIT_TOLERANCE_PX = 6

/** The prepared rings and the hit test over the same records. */
export interface RingModel {
  /** Draw records in draw order, one per entity. */
  rings: EntityRings[]
  /** The nearest ring edge within `toleranceM` of a world point, or null. */
  hitAt(worldPt: Vec2, toleranceM: number): RingHit | null
}

/** No rings, no hits: the model of an empty board. */
const EMPTY_MODEL: RingModel = { rings: [], hitAt: () => null }

/**
 * Prepare the ring model. The records for one scenario, view and selection are
 * cached on the scenario; `prev` lends its record identities to the records whose
 * fields did not change, so a memoized node holds across a scenario swap. The edge
 * list is derived on the first `hitAt` and then shared by every later hover.
 */
export function prepareRingModel(
  scenario: Scenario,
  view: RingView,
  selectedUasId: string | null,
  prev: EntityRings[] = [],
): RingModel {
  const rings = stableRings(sharedRings(scenario, view, selectedUasId), prev)
  if (rings.length === 0) return EMPTY_MODEL
  let edges: EntityEdges | null = null
  return {
    rings,
    hitAt(worldPt, toleranceM) {
      edges ??= rings.map((r) => [r.entity, ringEdges(r)])
      return hitEdges(edges, worldPt, toleranceM)
    },
  }
}

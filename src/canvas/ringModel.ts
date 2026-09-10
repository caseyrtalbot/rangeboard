import type { Entity, Scenario, SensorSpec, Vec2 } from '../model/types'
import {
  DEFAULT_REQUIREMENT_THRESHOLDS,
  effectiveDoctrine,
  entityActive,
  mountHeightOf,
} from '../model/types'
import { modelFor } from '../model/scenario'
import type { LayerVisibility } from '../state/layers'
import { ringVisible } from '../state/layers'
import type { RingKey, RingOverrides } from '../state/rings'
import type { DisplayUnits } from '../geometry/geo'
import { angleDiffDeg, bearingDeg, dist, formatDistance } from '../geometry/geo'
import { entityInk } from '../ui/ink'
import { groundRangeM } from '../geometry/slant'
import {
  effectiveClassifyRangeM,
  effectiveDetectRangeM,
  FT_TO_M,
  pdContoursM,
  radarPdModeled,
  sensorHoldGate,
} from '../analysis/sensorEnv'
import { commitPkFor } from '../analysis/doctrineFactors'
import { effectiveJamRangeM } from '../analysis/ewPhysics'
import { DEFAULT_PK } from '../playback/pk'
import { defendedRadiusOf } from '../playback/sim'
import { threatAltitudeFt } from '../playback/tracks'
import { EXTRA_RING_HINTS, EXTRA_RING_LABELS, RING_HINTS, RING_LABELS } from '../panels/ringLabels'
import type { EnvelopeBand } from './layers/footprintStyle'
import {
  commitRangeM,
  DISABLED_RING_COLOR,
  EFFECTOR_RING_COLOR,
  effectorRingStyle,
  envelopeBandM,
  PD_CONTOUR_HIGH,
  releaseRangeM,
  sensorRingStyle,
} from './layers/footprintStyle'

/**
 * The ring model: every ring the board draws, prepared once from the
 * scenario, the ring view and the selected threat, and read two ways. The
 * footprint layer draws the records; the HUD asks `hitAt` which ring edge
 * lies under the pointer. Store-free and Konva-free, so a test drives it
 * from a Scenario alone. Every dash, width and ink decision comes from
 * footprintStyle.ts; this module resolves the ranges those decisions apply to.
 */

/** The ring visibility and unit state the model reads. A narrow slice of `ui`. */
export interface RingView {
  units: DisplayUnits
  layers: LayerVisibility
  ringOverrides: RingOverrides
}

/** Commit Pk in a label: up to two decimals, no trailing zero. */
function formatPk(pk: number): string {
  return String(Math.round(pk * 100) / 100)
}

export interface SensorRings {
  kind: 'sensor'
  entity: Entity
  sectorDeg: number
  color: string
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
}

export interface EffectorRings {
  kind: 'effector'
  entity: Entity
  sectorDeg: number
  color: string
  off: boolean
  maxM: number | null
  minM: number | null
  releaseM: number | null
  commitM: number | null
  releaseLabel: string | null
  commitLabel: string | null
}

export interface JammerRings {
  kind: 'jammer'
  entity: Entity
  sectorDeg: number
  color: string
  off: boolean
  rangeM: number | null
  minM: number | null
}

export interface AssetRings {
  kind: 'asset'
  entity: Entity
  color: string
  radiusM: number
}

export type EntityRings = SensorRings | EffectorRings | JammerRings | AssetRings

/**
 * Every ring the board draws, one record per entity. Pure over the scenario,
 * the ring visibility and the selected threat, so the memo that calls it does
 * no work on a playback frame. Visibility is `ringVisible`: the per-entity
 * override, else ui.layers.
 */
function buildRings(scenario: Scenario, ui: RingView, selectedUasId: string | null): EntityRings[] {
  const env = scenario.environment
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
  const pdLow = thresholds.pdDetect
  const doctrine = effectiveDoctrine(scenario)
  const units = ui.units
  const selectedUas = selectedUasId ? scenario.entities.find((e) => e.id === selectedUasId) : undefined
  const target = selectedUas ? modelFor(scenario, selectedUas)?.uas : undefined
  // The engine range is a slant range to the threat altitude, so a ring on a
  // plan-view board is its ground projection. The mount height is the only
  // per-entity term.
  const targetAltM = selectedUas ? threatAltitudeFt(scenario, selectedUas) * FT_TO_M : null

  // Every threat on the board feeds the envelope band. Each entity carries its
  // own altitude, so two ships of one model can project to two ranges.
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
      const r = effectiveDetectRangeM(spec, env, t.spec, pdLow)
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
        const [low, high] = pdContoursM(spec, env, target, [pdLow, PD_CONTOUR_HIGH])
        pdLowM = project(low)
        // Only a radar under the Pd model has a second contour. Every other
        // sensor keeps its scaled range as the lower contour.
        pdHighM = radarPdModeled(spec, target) ? project(high) : null
      }
      const classifySlantM = effectiveClassifyRangeM(spec, env, target)
      const style = sensorRingStyle({
        gate: sensorHoldGate(spec, target),
        on: entityActive(e),
        // The placard is a reference condition, so it is never target scaled
        // and never projected.
        placardM: effectiveDetectRangeM(spec, env),
        pdLowM,
        pdHighM,
        classifyM: classifySlantM == null ? null : project(classifySlantM),
        contoursOn: contoursOn && target != null,
        envelopeOn,
      })
      const color = style.grey ? DISABLED_RING_COLOR : entityInk(e, model)
      out.push({
        kind: 'sensor',
        entity: e,
        sectorDeg: spec.sectorDeg,
        color,
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
      })
      continue
    }

    if (e.kind === 'effector') {
      const spec = model?.effector
      if (!spec) continue
      const maxOn = ringVisible(ui, e.id, 'effectorMaxRange')
      const minOn = ringVisible(ui, e.id, 'effectorMinRange')
      const doctrinalOn = ringVisible(ui, e.id, 'effectorDoctrinal')
      const off = !entityActive(e)
      const sectorDeg = spec.sectorDeg ?? 360

      // A jammer keeps the flashlight cone: illumination, not a weapon arc.
      // No danger ink, no ground projection, no doctrinal ring. The min
      // circle stays under the cone key.
      if (spec.effectorType === 'jammer') {
        if (!maxOn) continue
        out.push({
          kind: 'jammer',
          entity: e,
          sectorDeg,
          color: off ? DISABLED_RING_COLOR : entityInk(e, model),
          off,
          rangeM: maxOn ? effectiveJamRangeM(spec, target) : null,
          minM: spec.minRangeM > 0 ? spec.minRangeM : null,
        })
        continue
      }

      if (!maxOn && !minOn && !doctrinalOn) continue
      const dAltM = targetAltM == null ? null : targetAltM - mountHeightOf(spec)
      const project = (m: number) => (dAltM == null ? m : groundRangeM(m, dAltM))
      let releaseM: number | null = null
      let commitM: number | null = null
      let commitPk = 0
      // Legacy release has no launch point, so doctrine off means no
      // doctrinal ring at all.
      if (target && doctrinalOn && doctrine.enabled) {
        const basePk = spec.pk ?? DEFAULT_PK[spec.effectorType]
        commitPk = commitPkFor(spec, doctrine)
        const commitSlantM = commitRangeM({
          basePk,
          uas: target,
          commitPk,
          maxRangeM: spec.maxRangeM,
        })
        const releaseSlantM = releaseRangeM(doctrine, spec.maxRangeM, commitSlantM)
        commitM = commitSlantM == null ? null : project(commitSlantM)
        releaseM = releaseSlantM == null ? null : project(releaseSlantM)
      }
      const style = effectorRingStyle({
        on: entityActive(e),
        maxM: project(spec.maxRangeM),
        minM: project(spec.minRangeM),
        releaseM,
        commitM,
      })
      const color = style.grey ? DISABLED_RING_COLOR : EFFECTOR_RING_COLOR
      out.push({
        kind: 'effector',
        entity: e,
        sectorDeg,
        color,
        off,
        maxM: maxOn ? style.maxM : null,
        minM: minOn ? style.minM : null,
        releaseM: style.releaseM,
        commitM: style.commitM,
        releaseLabel:
          style.releaseM == null ? null : `REL ${formatDistance(style.releaseM, units)}`,
        commitLabel:
          style.commitM == null
            ? null
            : `Pk ${formatPk(commitPk)} · ${formatDistance(style.commitM, units)}`,
      })
      continue
    }

    // The defended area is the boundary the engine scores arrival against
    // (defendedRadiusOf: Entity.defendedRadiusM, else the 500 m default), so
    // the ring on the board is the same distance the leaker count uses.
    if (e.kind === 'asset' && ui.layers.defendedAreas) {
      out.push({
        kind: 'asset',
        entity: e,
        color: entityInk(e, model),
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
const ringCache = new WeakMap<Scenario, { view: RingView; selected: string | null; rings: EntityRings[] }>()

function sharedRings(scenario: Scenario, view: RingView, selected: string | null): EntityRings[] {
  const cached = ringCache.get(scenario)
  if (cached && cached.selected === selected && cached.view.units === view.units &&
    cached.view.layers === view.layers && cached.view.ringOverrides === view.ringOverrides) {
    return cached.rings
  }
  const rings = buildRings(scenario, view, selected)
  ringCache.set(scenario, { view, selected, rings })
  return rings
}

type HintKey = RingKey | keyof typeof EXTRA_RING_HINTS

/** One ring edge a pointer can rest on. Derived once per prepared model. */
interface RingEdge {
  radiusM: number
  key: HintKey
  /** Arc the edge spans; 360 for a full ring. */
  sectorDeg: number
}

export interface RingHit {
  entity: Entity
  key: HintKey
  name: string
  hint: string
  radiusM: number
  distanceM: number
}

/** The edges one record draws, in draw order. A minimum range stays circular under a sector. */
function ringEdges(r: EntityRings): RingEdge[] {
  const out: RingEdge[] = []
  const sector = r.kind === 'asset' ? 360 : r.sectorDeg
  const edge = (radiusM: number | null | undefined, key: HintKey, sectorDeg = sector) => {
    if (radiusM != null && radiusM > 0) out.push({ radiusM, key, sectorDeg })
  }
  if (r.kind === 'sensor') {
    edge(r.placardM, 'sensorPlacard')
    edge(r.contourLowM, 'pdLow')
    edge(r.contourHighM, 'pdHigh')
    edge(r.classifyM, 'classifyRings')
    edge(r.band?.innerM, 'envelopeInner')
    edge(r.band?.outerM, 'envelopeOuter')
  } else if (r.kind === 'effector') {
    edge(r.maxM, 'effectorMaxRange')
    edge(r.minM, 'effectorMinRange', 360)
    edge(r.releaseM, 'release')
    edge(r.commitM, 'commitPk')
  } else if (r.kind === 'jammer') {
    edge(r.rangeM, 'jammerEffective')
    edge(r.minM, 'jammerMin', 360)
  } else {
    edge(r.radiusM, 'defendedArea')
  }
  return out
}

type EntityEdges = Array<[Entity, RingEdge[]]>

/** Radial edge distance only; sector spokes are not ring edges. Ties keep draw order. */
function hitRing(rings: EntityRings[], worldPt: Vec2, toleranceM: number): RingHit | null {
  return hitEdges(rings.map((r) => [r.entity, ringEdges(r)]), worldPt, toleranceM)
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
      const extra = e.key as keyof typeof EXTRA_RING_HINTS
      closest = {
        entity, key: e.key, radiusM: e.radiusM, distanceM,
        name: EXTRA_RING_LABELS[extra] ?? RING_LABELS[e.key as RingKey],
        hint: EXTRA_RING_HINTS[extra] ?? RING_HINTS[e.key as RingKey],
      }
    }
  }
  return closest
}

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
 * Prepare the ring model. The records for one scenario, view and selection
 * are cached on the scenario; `prev` lends its record identities to the
 * records whose fields did not change (section 7), so a memoized node holds
 * across a scenario swap. The edge list is derived on the first `hitAt` and
 * then shared by every hover over the same model.
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

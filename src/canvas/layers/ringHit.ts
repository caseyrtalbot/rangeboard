import type { Entity, Vec2 } from '../../model/types'
import { angleDiffDeg, bearingDeg, dist } from '../../geometry/geo'
import { EXTRA_RING_HINTS, EXTRA_RING_LABELS, RING_HINTS, RING_LABELS } from '../../panels/ringLabels'
import type { RingKey } from '../../state/rings'
import type { EntityRings } from './FootprintLayer'

type HintKey = RingKey | keyof typeof EXTRA_RING_HINTS

export interface RingHit {
  entity: Entity
  key: HintKey
  name: string
  hint: string
  radiusM: number
  distanceM: number
}

/** Radial edge distance only; sector spokes are not ring edges. Ties keep draw order. */
export function hitRing(rings: EntityRings[], worldPt: Vec2, toleranceM: number): RingHit | null {
  let closest: RingHit | null = null
  for (const r of rings) {
    const distance = dist(r.entity.pos, worldPt)
    const bearing = bearingDeg(r.entity.pos, worldPt)
    const sector = r.kind === 'asset' ? 360 : r.sectorDeg
    const consider = (radiusM: number | null | undefined, key: HintKey, sectorDeg = sector) => {
      if (radiusM == null || !(radiusM > 0)) return
      if (sectorDeg < 360 && angleDiffDeg(bearing, r.entity.headingDeg) > sectorDeg / 2) return
      const distanceM = Math.abs(distance - radiusM)
      if (!(distanceM <= toleranceM) || (closest && distanceM >= closest.distanceM)) return
      const extra = key as keyof typeof EXTRA_RING_HINTS
      closest = {
        entity: r.entity, key, radiusM, distanceM,
        name: EXTRA_RING_LABELS[extra] ?? RING_LABELS[key as RingKey],
        hint: EXTRA_RING_HINTS[extra] ?? RING_HINTS[key as RingKey],
      }
    }
    if (r.kind === 'sensor') {
      consider(r.placardM, 'sensorPlacard')
      consider(r.contourLowM, 'pdLow')
      consider(r.contourHighM, 'pdHigh')
      consider(r.classifyM, 'classifyRings')
      consider(r.band?.innerM, 'envelopeInner')
      consider(r.band?.outerM, 'envelopeOuter')
    } else if (r.kind === 'effector') {
      consider(r.maxM, 'effectorMaxRange')
      consider(r.minM, 'effectorMinRange', 360)
      consider(r.releaseM, 'release')
      consider(r.commitM, 'commitPk')
    } else if (r.kind === 'jammer') {
      consider(r.rangeM, 'jammerEffective')
      consider(r.minM, 'jammerMin', 360)
    } else {
      consider(r.radiusM, 'defendedArea')
    }
  }
  return closest
}

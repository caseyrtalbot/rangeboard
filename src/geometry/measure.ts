import type { Vec2 } from '../model/types'
import { angleDiffDeg, bearingDeg, dist } from './geo'
import type { DisplayUnits } from './geo'

/**
 * Plan-view measurement between two board points: bearing, range and, when the far end
 * is a moving air track, the BRAA altitude and aspect. Ground geometry only; the
 * altitude is the track's, not a slant correction.
 */

const NM_M = 1852
const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

/** Brevity aspect words, by target aspect angle (0 nose-on). Gaps go to the nearer word. */
export type AspectWord = 'HOT' | 'FLANK' | 'BEAM' | 'DRAG'

/** The far end of a measurement when it is an air track. */
export interface MeasureTarget {
  headingDeg: number
  altitudeFt: number
  /** False before the start delay and after path end: a parked track has no aspect. */
  moving: boolean
}

export interface MeasureReadout {
  /** From the first end to the second, degrees [0, 360), 0 = board north. */
  bearingDeg: number
  rangeM: number
  /** Target aspect angle, degrees [0, 180]: 0 when the target flies at the first end. */
  aspectDeg: number | null
  aspect: AspectWord | null
  /** Eight-point direction of the target's travel; brevity omits it on a HOT aspect. */
  travel: (typeof CARDINALS)[number] | null
  altitudeFt: number | null
}

export function aspectWord(aspectDeg: number): AspectWord {
  if (aspectDeg <= 35) return 'HOT'
  if (aspectDeg <= 75) return 'FLANK'
  if (aspectDeg <= 115) return 'BEAM'
  return 'DRAG'
}

export function cardinal8(headingDeg: number): (typeof CARDINALS)[number] {
  return CARDINALS[Math.round((((headingDeg % 360) + 360) % 360) / 45) % 8]
}

export function measureReadout(a: Vec2, b: Vec2, target?: MeasureTarget): MeasureReadout {
  const rangeM = dist(a, b)
  const aspectDeg =
    target?.moving && rangeM > 0 ? angleDiffDeg(target.headingDeg, bearingDeg(b, a)) : null
  const aspect = aspectDeg == null ? null : aspectWord(aspectDeg)
  return {
    bearingDeg: rangeM > 0 ? bearingDeg(a, b) : 0,
    rangeM,
    aspectDeg,
    aspect,
    travel: aspect && aspect !== 'HOT' && target ? cardinal8(target.headingDeg) : null,
    altitudeFt: target ? target.altitudeFt : null,
  }
}

/** Range at measurement precision: two decimals of a nautical mile or a kilometer. */
export function formatMeasureRange(m: number, units: DisplayUnits): string {
  if (units === 'aviation') return `${(m / NM_M).toFixed(2)} nm`
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`
}

/** The readout lines: bearing and range, then the track's altitude and aspect. */
export function measureLines(r: MeasureReadout, units: DisplayUnits): string[] {
  const bearing = `${String(Math.round(r.bearingDeg) % 360).padStart(3, '0')}°`
  const lines = [`${bearing} ${formatMeasureRange(r.rangeM, units)}`]
  if (r.altitudeFt != null) {
    const parts = [`${Math.round(r.altitudeFt).toLocaleString('en-US')} ft`]
    if (r.aspect) parts.push(r.travel ? `${r.aspect} ${r.travel}` : r.aspect)
    lines.push(parts.join(' · '))
  }
  return lines
}

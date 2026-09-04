import { describe, expect, it } from 'vitest'
import { DEFAULT_FIRE_DOCTRINE } from '../../model/types'
import type { UasSpec } from '../../model/types'
import { distanceFalloff, falloffRangeM, kineticPk } from '../../playback/attrition'
import { RING_KEYS } from '../../state/store'
import {
  COMMIT_DASH,
  DETECT_DASH,
  EFFECTOR_MIN_DASH,
  GATE_WORD,
  PD_HIGH_DASH,
  PLACARD_DASH,
  RELEASE_DASH,
  RING_STYLE,
  commitRangeM,
  effectorRingStyle,
  envelopeBandM,
  releaseRangeM,
  ringKindFor,
  sensorRingStyle,
} from './footprintStyle'

describe('sensorRingStyle', () => {
  const base = {
    on: true,
    placardM: 5000,
    pdLowM: 7200,
    pdHighM: 4300,
    classifyM: 3000,
    contoursOn: false,
    envelopeOn: false,
  }

  it('held, no contours: solid filled placard ring, classify kept', () => {
    const s = sensorRingStyle({ ...base, gate: 'ok' })
    expect(s).toEqual({
      kind: 'held',
      placardM: 5000,
      placardDash: null,
      placardFill: true,
      contourLowM: null,
      contourHighM: null,
      contourFill: false,
      classifyM: 3000,
      grey: false,
    })
  })

  it('held, contours on: dotted placard behind, fill moves to the low contour', () => {
    const s = sensorRingStyle({ ...base, gate: 'ok', contoursOn: true })
    expect(s.placardM).toBe(5000)
    expect(s.placardDash).toEqual(PLACARD_DASH)
    expect(s.placardFill).toBe(false)
    expect(s.contourLowM).toBe(7200)
    expect(s.contourHighM).toBe(4300)
    expect(s.contourFill).toBe(true)
    expect(s.classifyM).toBe(3000)
  })

  it('held, contours on with no threat: solid placard, no contour', () => {
    const s = sensorRingStyle({
      ...base,
      gate: 'ok',
      contoursOn: true,
      pdLowM: null,
      pdHighM: null,
    })
    expect(s.placardDash).toBeNull()
    expect(s.placardFill).toBe(true)
    expect(s.contourLowM).toBeNull()
    expect(s.contourHighM).toBeNull()
    expect(s.contourFill).toBe(false)
  })

  it('the envelope band removes the placard fill and the contour fill', () => {
    expect(sensorRingStyle({ ...base, gate: 'ok', envelopeOn: true }).placardFill).toBe(false)
    const s = sensorRingStyle({ ...base, gate: 'ok', contoursOn: true, envelopeOn: true })
    expect(s.contourFill).toBe(false)
    expect(s.placardFill).toBe(false)
    expect(s.contourLowM).toBe(7200)
  })

  it('cued: dashed placard, no fill, contours when on, classify ring kept', () => {
    const s = sensorRingStyle({ ...base, gate: 'needs-cue' })
    expect(s.kind).toBe('cued')
    expect(s.placardDash).toEqual(DETECT_DASH.cued)
    expect(s.placardFill).toBe(false)
    expect(s.contourLowM).toBeNull()
    expect(s.classifyM).toBe(3000)
    expect(s.grey).toBe(false)
    const c = sensorRingStyle({ ...base, gate: 'needs-cue', contoursOn: true })
    expect(c.placardDash).toEqual(DETECT_DASH.cued)
    expect(c.contourLowM).toBe(7200)
    expect(c.contourHighM).toBe(4300)
    expect(c.contourFill).toBe(false)
  })

  it.each(['rf-silent', 'rf-band', 'no-range'] as const)(
    'inert (%s): grey dashed placard, no fill, no contours, no classify ring',
    (gate) => {
      const s = sensorRingStyle({ ...base, gate, contoursOn: true })
      expect(s).toEqual({
        kind: 'inert',
        placardM: 5000,
        placardDash: DETECT_DASH.inert,
        placardFill: false,
        contourLowM: null,
        contourHighM: null,
        contourFill: false,
        classifyM: null,
        grey: true,
      })
    },
  )

  it('off: dotted grey placard, no fill, no contours, no classify ring', () => {
    const s = sensorRingStyle({ ...base, gate: 'ok', on: false, contoursOn: true })
    expect(s).toEqual({
      kind: 'off',
      placardM: 5000,
      placardDash: DETECT_DASH.off,
      placardFill: false,
      contourLowM: null,
      contourHighM: null,
      contourFill: false,
      classifyM: null,
      grey: true,
    })
  })

  it('off outranks every gate', () => {
    expect(sensorRingStyle({ ...base, gate: 'rf-silent', on: false }).kind).toBe('off')
    expect(sensorRingStyle({ ...base, gate: 'needs-cue', on: false }).kind).toBe('off')
  })

  it('drops a zero or null classify range and a zero contour range', () => {
    expect(sensorRingStyle({ ...base, gate: 'ok', classifyM: null }).classifyM).toBeNull()
    expect(sensorRingStyle({ ...base, gate: 'ok', classifyM: 0 }).classifyM).toBeNull()
    const s = sensorRingStyle({ ...base, gate: 'ok', contoursOn: true, pdLowM: 0, pdHighM: 0 })
    expect(s.contourLowM).toBeNull()
    expect(s.contourHighM).toBeNull()
    expect(s.placardDash).toBeNull()
    expect(s.placardFill).toBe(true)
  })

  it('maps every gate to one ring kind and one inspector word', () => {
    expect(ringKindFor('ok')).toBe('held')
    expect(ringKindFor('needs-cue')).toBe('cued')
    expect(ringKindFor('rf-silent')).toBe('inert')
    expect(ringKindFor('rf-band')).toBe('inert')
    expect(ringKindFor('no-range')).toBe('inert')
    expect(Object.keys(GATE_WORD).sort()).toEqual(['needs-cue', 'no-range', 'rf-band', 'rf-silent'])
  })
})

describe('envelopeBandM', () => {
  it('is null with no range, no positive range, one range, or no width', () => {
    expect(envelopeBandM([])).toBeNull()
    expect(envelopeBandM([0, -5, Number.NaN, Number.POSITIVE_INFINITY])).toBeNull()
    expect(envelopeBandM([4000])).toBeNull()
    expect(envelopeBandM([4000, 4001])).toBeNull()
  })

  it('spans the smallest to the largest positive range', () => {
    expect(envelopeBandM([4000, 0, 11900, 6600])).toEqual({ innerM: 4000, outerM: 11900 })
  })
})

describe('effectorRingStyle', () => {
  const on = { on: true, maxM: 10000, minM: 200, releaseM: 7400, commitM: 5100 }

  it('draws every ring when none coincide', () => {
    expect(effectorRingStyle(on)).toEqual({
      maxM: 10000,
      minM: 200,
      releaseM: 7400,
      commitM: 5100,
      grey: false,
    })
  })

  it('drops a zero min range and a zero commit range', () => {
    expect(effectorRingStyle({ ...on, minM: 0 }).minM).toBeNull()
    expect(effectorRingStyle({ ...on, commitM: 0 }).commitM).toBeNull()
  })

  it('pk-commit: release equals commit, only the commit ring draws', () => {
    const s = effectorRingStyle({ ...on, releaseM: 5100 })
    expect(s.releaseM).toBeNull()
    expect(s.commitM).toBe(5100)
    expect(effectorRingStyle({ ...on, releaseM: 5100.5 }).releaseM).toBeNull()
  })

  it('max-range: release equals max, only the max ring draws', () => {
    const s = effectorRingStyle({ ...on, releaseM: 10000 })
    expect(s.releaseM).toBeNull()
    expect(s.maxM).toBe(10000)
  })

  it('a commit range at max range hides under the max ring', () => {
    const s = effectorRingStyle({ ...on, releaseM: 10000, commitM: 10000 })
    expect(s.commitM).toBeNull()
    expect(s.releaseM).toBeNull()
  })

  it('off: grey max and min, no doctrinal rings', () => {
    expect(effectorRingStyle({ ...on, on: false })).toEqual({
      maxM: 10000,
      minM: 200,
      releaseM: null,
      commitM: null,
      grey: true,
    })
  })
})

/** Group 3 quad: size 0.9, no evasion. */
const QUAD_G3 = { group: 3, airframe: 'quad' } as UasSpec
/** Group 1 fpv: size 0.7 x evasion 0.7 = 0.49. */
const FPV_G1 = { group: 1, airframe: 'fpv' } as UasSpec

describe('kineticPk', () => {
  it('is the size and evasion product at the launcher, 1 with no target', () => {
    // basePk 1 at slant 0: falloff 1, so the value is the penalty product.
    expect(kineticPk(1, 10000, QUAD_G3, 0)).toBeCloseTo(0.9, 12)
    expect(kineticPk(1, 10000, FPV_G1, 0)).toBeCloseTo(0.49, 12)
    expect(kineticPk(1, 10000, undefined, 0)).toBe(1)
    expect(kineticPk(1, 10000, { group: 4, airframe: 'fixed-wing' } as UasSpec, 0)).toBe(1)
  })

  it('applies the falloff at the slant and clamps to [0, 1]', () => {
    // 0.8 * (1 - 0.3 * 5000/10000) * 0.9 = 0.8 * 0.85 * 0.9 = 0.612.
    expect(kineticPk(0.8, 10000, QUAD_G3, 5000)).toBeCloseTo(0.612, 12)
    expect(kineticPk(0.8, 10000, QUAD_G3, 10001)).toBe(0)
    expect(kineticPk(2, 10000, undefined, 0)).toBe(1)
  })
})

describe('commitRangeM', () => {
  it('is the slant range where the falloff brings Pk down to commitPk', () => {
    // Peak 0.8 * 0.9 = 0.72; falloff must be 0.6 / 0.72; r = 10000 * (1 - 0.6/0.72) / 0.3.
    const r = commitRangeM({ basePk: 0.8, uas: QUAD_G3, commitPk: 0.6, maxRangeM: 10000 })
    expect(r).toBeCloseTo((10000 * (1 - 0.6 / 0.72)) / 0.3, 6)
    expect(r).toBeCloseTo(5555.56, 1)
  })

  it('is the inverse of kineticPk at the commit Pk', () => {
    for (const [basePk, uas, commitPk] of [
      [0.8, QUAD_G3, 0.6],
      [0.85, FPV_G1, 0.35],
      [0.7, undefined, 0.5],
    ] as Array<[number, UasSpec | undefined, number]>) {
      const r = commitRangeM({ basePk, uas, commitPk, maxRangeM: 8000 })!
      expect(r).not.toBeNull()
      expect(kineticPk(basePk, 8000, uas, r)).toBeCloseTo(commitPk, 12)
    }
  })

  it('is null when the effector never commits, or has no envelope', () => {
    // 0.8 * 0.49 = 0.392 < 0.6: never commits.
    expect(commitRangeM({ basePk: 0.8, uas: FPV_G1, commitPk: 0.6, maxRangeM: 10000 })).toBeNull()
    expect(commitRangeM({ basePk: 0, uas: QUAD_G3, commitPk: 0.6, maxRangeM: 10000 })).toBeNull()
    expect(commitRangeM({ basePk: 0.8, uas: undefined, commitPk: 0.6, maxRangeM: 0 })).toBeNull()
  })

  it('is the max range when the effector commits everywhere', () => {
    expect(commitRangeM({ basePk: 1, uas: undefined, commitPk: 0.5, maxRangeM: 10000 })).toBe(10000)
  })
})

describe('releaseRangeM', () => {
  const doctrine = { ...DEFAULT_FIRE_DOCTRINE }

  it('follows the launch policy', () => {
    expect(releaseRangeM({ ...doctrine, launchPolicy: 'max-range' }, 10000, 5100)).toBe(10000)
    expect(
      releaseRangeM(
        { ...doctrine, launchPolicy: 'range-fraction', launchRangeFraction: 0.74 },
        10000,
        5100,
      ),
    ).toBeCloseTo(7400, 9)
    expect(releaseRangeM({ ...doctrine, launchPolicy: 'pk-commit' }, 10000, 5100)).toBe(5100)
    expect(releaseRangeM({ ...doctrine, launchPolicy: 'pk-commit' }, 10000, null)).toBeNull()
    expect(releaseRangeM({ ...doctrine, launchPolicy: 'latest' }, 10000, 5100)).toBeNull()
  })
})

describe('falloffRangeM', () => {
  it('inverts distanceFalloff on the envelope', () => {
    for (const f of [0.7, 0.85, 1]) {
      expect(distanceFalloff(falloffRangeM(f, 10000), 10000)).toBeCloseTo(f, 12)
    }
    expect(falloffRangeM(0.5, 10000)).toBe(10000)
    expect(falloffRangeM(1.2, 10000)).toBe(0)
  })
})

describe('RING_STYLE', () => {
  it('has one record per ring key', () => {
    for (const key of RING_KEYS) {
      const s = RING_STYLE[key]
      expect(s).toBeDefined()
      expect(s.width).toBeGreaterThanOrEqual(0)
      expect(['entity', 'danger']).toContain(s.ink)
    }
    expect(Object.keys(RING_STYLE).sort()).toEqual([...RING_KEYS].sort())
  })

  it('names the dashes the mockup draws', () => {
    expect(RING_STYLE.classifyRings.dash).toEqual([4, 6])
    expect(PD_HIGH_DASH).toEqual([4, 6])
    expect(RING_STYLE.effectorMinRange.dash).toEqual(EFFECTOR_MIN_DASH)
    expect(RING_STYLE.effectorDoctrinal.dash).toEqual(RELEASE_DASH)
    expect(COMMIT_DASH).toEqual([6, 3, 1, 3])
    expect(RING_STYLE.effectorMaxRange.dash).toBeNull()
    expect(RING_STYLE.sensorEnvelope.width).toBe(0)
  })
})

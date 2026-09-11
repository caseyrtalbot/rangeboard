import { expect, it } from 'vitest'
import type { UasSpec } from '../model/types'
import { kineticPk, missDistanceSigmaM } from './pk'

it('kineticPk multiplies base Pk by falloff, size penalty and fpv evasion, zero past max range', () => {
  const fpv = { group: 1, airframe: 'fpv' } as UasSpec
  // 0.8 * (1 - 0.3 * 0.5) * 0.7 (group 1) * 0.7 (fpv) = 0.3332
  expect(kineticPk(0.8, 10000, fpv, 5000)).toBeCloseTo(0.3332, 9)
  const fixed = { group: 4, airframe: 'fixed-wing' } as UasSpec
  expect(kineticPk(0.8, 10000, fixed, 0)).toBeCloseTo(0.8, 9)
  expect(kineticPk(0.8, 10000, undefined, 10000.5)).toBe(0)
})

it('missDistanceSigmaM is the root sum square of prediction and guidance error, null on the truth path', () => {
  expect(missDistanceSigmaM(null, 40)).toBeNull()
  // sqrt(30^2 + 40^2) = 50
  expect(missDistanceSigmaM(30, 40)).toBeCloseTo(50, 12)
  expect(missDistanceSigmaM(0, 7)).toBeCloseTo(7, 12)
})

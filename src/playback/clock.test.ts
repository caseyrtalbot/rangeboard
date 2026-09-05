import { expect, it } from 'vitest'
import { DT, stepIndex } from './clock'

it('DT is the 0.5 s engine step and stepIndex rounds a sample time to its step count', () => {
  expect(DT).toBe(0.5)
  expect(stepIndex(0.2)).toBe(0)
  expect(stepIndex(0.74)).toBe(1)
  // Two samples DT apart never share a step: 1.0 s is step 2, 1.5 s is step 3.
  expect(stepIndex(1.0)).toBe(2)
  expect(stepIndex(1.5)).toBe(3)
})

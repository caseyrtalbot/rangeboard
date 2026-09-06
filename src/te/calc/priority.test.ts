/**
 * Adaptive next-run priority (MASTER-CALCULATIONS).
 * The sources give no numeric fixture; these tests pin the computable form.
 */

import { describe, expect, it } from 'vitest'
import { adaptivePriority } from './priority'

describe('adaptivePriority', () => {
  it('multiplies value terms and divides by burden', () => {
    expect(adaptivePriority(3, 3, 3, 1)).toBe(27)
    expect(adaptivePriority(2, 3, 1, 2)).toBe(3)
    expect(adaptivePriority(1, 1, 1, 3)).toBeCloseTo(1 / 3, 10)
  })

  it('ranks a high-value low-burden run above a low-value high-burden run', () => {
    expect(adaptivePriority(3, 3, 2, 1)).toBeGreaterThan(adaptivePriority(2, 1, 1, 3))
  })

  it('higher burden lowers the score', () => {
    expect(adaptivePriority(3, 2, 2, 3)).toBeLessThan(adaptivePriority(3, 2, 2, 1))
  })
})

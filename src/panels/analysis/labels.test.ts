import { describe, expect, it } from 'vitest'
import { SURVIVAL_LABELS } from './labels'

describe('analysis labels', () => {
  it('carries the three survival names', () => {
    expect(SURVIVAL_LABELS).toEqual({
      leakers: 'Leakers',
      survives: 'Survives',
      limit: 'Survival limit',
    })
  })
})

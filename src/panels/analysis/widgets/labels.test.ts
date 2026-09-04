import { describe, expect, it } from 'vitest'
import { KPI_KEYS } from '../../../state/analysisLayout'
import { KPI_LABELS, SURVIVAL_LABELS } from './labels'

describe('analysis widget labels', () => {
  it('names every KPI key with a label and a hint', () => {
    for (const key of KPI_KEYS) {
      expect(KPI_LABELS[key].label.length).toBeGreaterThan(0)
      expect(KPI_LABELS[key].hint.length).toBeGreaterThan(0)
    }
    expect(Object.keys(KPI_LABELS).sort()).toEqual([...KPI_KEYS].sort())
  })

  it('carries the three survival names', () => {
    expect(SURVIVAL_LABELS).toEqual({
      leakers: 'Leakers',
      survives: 'Survives',
      limit: 'Survival limit',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { KPI_KEYS } from '../../../state/analysisLayout'
import { forecastKillLabel, KPI_LABELS, TRIAL_KPI_LABELS, SURVIVAL_LABELS } from './labels'

describe('analysis widget labels', () => {
  it('names every KPI key with a label and a hint', () => {
    for (const key of KPI_KEYS) {
      expect(KPI_LABELS[key].label.length).toBeGreaterThan(0)
      expect(KPI_LABELS[key].hint.length).toBeGreaterThan(0)
    }
    expect(Object.keys(KPI_LABELS).sort()).toEqual([...KPI_KEYS].sort())
  })

  it('names forecast mass by whether an active asset exists', () => {
    expect(forecastKillLabel(true)).toBe('Expected kills')
    expect(forecastKillLabel(false)).toBe('Expected neutralization')
    expect(KPI_LABELS.lateEk.label).toBe('Expected late kills')
    expect(TRIAL_KPI_LABELS.lateEk.label).toBe('Late defeats')
    expect(TRIAL_KPI_LABELS.killEk.label).toBe('Pre-arrival defeats')
    expect(TRIAL_KPI_LABELS.leakEn.label).toBe('Arrived undefeated')
  })

  it('carries the three survival names', () => {
    expect(SURVIVAL_LABELS).toEqual({
      leakers: 'Leakers',
      survives: 'Survives',
      limit: 'Survival limit',
    })
  })
})

/**
 * Test-matrix coverage math (MASTER-CALCULATIONS 3.5).
 * Runs map to cells via run.matrixCellId; only adjudicated valid,
 * non-excluded runs count as coverage evidence.
 */

import type { TeCampaign } from '../model/types'

export interface CellCoverage {
  cellId: string
  planned: number
  attempted: number
  valid: number
  minValid: number
  state: 'empty' | 'thin' | 'met' | 'redundant'
}

export function coverage(campaign: TeCampaign): CellCoverage[] {
  return campaign.matrix.map((cell): CellCoverage => {
    const runs = campaign.runs.filter((run) => run.matrixCellId === cell.id)
    const attempted = runs.filter((run) => run.startAt !== null).length
    const valid = runs.filter((run) => run.validity === 'valid' && !run.excluded).length
    const minValid = cell.minValidEvidence
    const state =
      valid === 0 ? 'empty' : valid < minValid ? 'thin' : valid > 2 * minValid ? 'redundant' : 'met'
    return { cellId: cell.id, planned: cell.plannedReps, attempted, valid, minValid, state }
  })
}

export function matrixTotals(campaign: TeCampaign): {
  cells: number
  plannedRuns: number
  estimatedHours: number | null
} {
  return {
    cells: campaign.matrix.length,
    plannedRuns: campaign.matrix.reduce((sum, cell) => sum + cell.plannedReps, 0),
    // Per-cell durations are not modeled yet.
    estimatedHours: null,
  }
}

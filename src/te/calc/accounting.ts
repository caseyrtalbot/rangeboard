/**
 * Campaign-level run accounting (MASTER-CALCULATIONS).
 * Valid-run rate shows test-process quality, not system performance; the
 * denominator is attempted runs.
 */

import type { TeCampaign } from '../model/types'

export function runAccounting(campaign: TeCampaign): {
  planned: number
  attempted: number
  valid: number
  conditional: number
  invalid: number
  excluded: number
  pending: number
} {
  const planned = campaign.matrix.reduce((sum, cell) => sum + cell.plannedReps, 0)
  let attempted = 0
  let valid = 0
  let conditional = 0
  let invalid = 0
  let excluded = 0
  let pending = 0
  for (const run of campaign.runs) {
    if (run.startAt !== null) attempted++
    if (run.excluded) {
      excluded++
      continue
    }
    if (run.validity === 'valid') valid++
    else if (run.validity === 'conditionally-valid') conditional++
    else if (run.validity === 'invalid') invalid++
    else pending++
  }
  return { planned, attempted, valid, conditional, invalid, excluded, pending }
}

export function validRunRate(campaign: TeCampaign): number | null {
  const { attempted, valid } = runAccounting(campaign)
  return attempted === 0 ? null : valid / attempted
}

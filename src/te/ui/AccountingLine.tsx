import type { TeCampaign } from '../model/types'
import { runAccounting, validRunRate } from '../calc/accounting'

export function AccountingLine({ campaign }: { campaign: TeCampaign }) {
  const acc = runAccounting(campaign)
  const rate = validRunRate(campaign)
  return (
    <div className="spec-summary">
      planned {acc.planned} · attempted {acc.attempted} · valid {acc.valid} · conditional {acc.conditional} · invalid {acc.invalid} · excluded {acc.excluded} · pending {acc.pending} · valid-run rate {rate === null ? 'n/a' : `${Math.round(rate * 100)}%`}
    </div>
  )
}

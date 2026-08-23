import type { LeakerImpact } from '../analysis/impact'
import { SEVERITY_LABEL, SEVERITY_RANK } from '../analysis/impact'
import { TIER_CLS } from './headlines'
import { formatTime } from '../geometry/geo'

/**
 * Asset-level I&W alerts: warned leakers grouped by defended asset, one line
 * per asset with the worst tier and the summed arrival expectation. Per-threat
 * detail stays in the expanded threat rows. Renders nothing when no leaker
 * carries a severity.
 */
export function LeakerWarningStrip({ impacts }: { impacts: LeakerImpact[] }) {
  const warned = impacts.filter((i) => i.severity != null)
  if (warned.length === 0) return null

  const byAsset = new Map<string, LeakerImpact[]>()
  for (const i of warned) {
    const key = i.assetId ?? '—'
    const group = byAsset.get(key)
    if (group) group.push(i)
    else byAsset.set(key, [i])
  }

  const lines = [...byAsset.entries()]
    .map(([assetKey, group]) => {
      const worst = group.reduce((a, b) =>
        SEVERITY_RANK[b.severity!] > SEVERITY_RANK[a.severity!] ? b : a,
      )
      const arrivals = group.filter((i) => i.arrivalS != null).map((i) => i.arrivalS!)
      return {
        assetKey,
        assetName: group[0].assetName ?? '—',
        tier: worst.severity!,
        n: group.length,
        firstArrivalS: arrivals.length > 0 ? Math.min(...arrivals) : null,
        ships: group.reduce((s, i) => s + i.expectedShipsArriving, 0),
        kg: group.reduce((s, i) => s + i.expectedWarheadKg, 0),
      }
    })
    .sort((a, b) => SEVERITY_RANK[b.tier] - SEVERITY_RANK[a.tier])

  return (
    <div className="iw-strip">
      {lines.map((l) => (
        <div className="iw-asset" key={l.assetKey}>
          <span className={`status ${TIER_CLS[l.tier]}`}>I&W {SEVERITY_LABEL[l.tier]}</span>
          <span className="iw-asset-name">{l.assetName}</span>
          <span className="iw-asset-stats">
            {[
              `${l.n} threat${l.n === 1 ? '' : 's'}`,
              l.firstArrivalS != null ? `first arrival T+${formatTime(l.firstArrivalS)}` : null,
              `${l.ships.toFixed(1)} ships`,
              l.kg > 0 ? `${Math.round(l.kg)} kg expected` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      ))}
    </div>
  )
}

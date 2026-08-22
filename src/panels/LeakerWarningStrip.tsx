import { useStore } from '../state/store'
import type { ImpactSeverity, LeakerImpact } from '../analysis/impact'
import { SEVERITY_LABEL, SEVERITY_RANK, wezKindFor } from '../analysis/impact'
import { formatTime } from '../geometry/geo'

/** Chip styling per tier: SEVERE red, MODERATE amber, LOW neutral. */
export const TIER_CLS: Record<ImpactSeverity, string> = {
  severe: 'bad',
  moderate: 'warn',
  low: 'neutral',
}

const TIERS: ImpactSeverity[] = ['severe', 'moderate', 'low']

/** Expected leaked warhead cell; 0 kg with ships arriving means unknown mass. */
function kgText(i: LeakerImpact): string {
  return i.expectedWarheadKg > 0 ? `${Math.round(i.expectedWarheadKg)} kg` : 'warhead unknown'
}

/**
 * Compact I&W strip above the threat rows: one line of tier-count chips,
 * expandable to one row per warned leaker. Renders nothing when no leaker
 * carries a severity.
 */
export function LeakerWarningStrip({ impacts }: { impacts: LeakerImpact[] }) {
  const scenario = useStore((s) => s.scenario)
  const warned = impacts
    .filter((i) => i.severity != null)
    .sort((a, b) => SEVERITY_RANK[b.severity!] - SEVERITY_RANK[a.severity!])
  if (warned.length === 0) return null

  const counts = TIERS.map((tier) => ({
    tier,
    n: warned.filter((i) => i.severity === tier).length,
  })).filter((c) => c.n > 0)

  const kindOf = (uasId: string) => {
    const entity = scenario.entities.find((e) => e.id === uasId)
    return wezKindFor(scenario.library.find((m) => m.id === entity?.specId))
  }

  return (
    <details className="subsection leaker-strip">
      <summary>
        I&W:{' '}
        {counts.map((c) => (
          <span key={c.tier} className={`status ${TIER_CLS[c.tier]}`}>
            {c.n} {SEVERITY_LABEL[c.tier]}
          </span>
        ))}
      </summary>
      <table className="threat-table">
        <tbody>
          {warned.map((i) => (
            <tr key={i.uasId}>
              <td>
                <span className={`status ${TIER_CLS[i.severity!]}`}>
                  {SEVERITY_LABEL[i.severity!]}
                </span>{' '}
                {i.name}
              </td>
              <td>
                {[
                  `target ${i.assetName ?? '—'}`,
                  i.arrivalS != null ? `arrives ${formatTime(i.arrivalS)}` : null,
                  `${i.expectedShipsArriving.toFixed(1)} ships`,
                  kgText(i),
                  `${kindOf(i.uasId)} WEZ`,
                  i.jamDegradedProb > 0.005
                    ? `arrives jam-degraded ${Math.round(i.jamDegradedProb * 100)}%`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

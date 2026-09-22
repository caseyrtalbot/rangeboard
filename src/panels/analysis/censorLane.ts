import { reached, type ExecutionHorizon } from '../../analysis/horizon'
import type { ImpactSeverity } from '../../model/types'

export interface Lane {
  key: string
  label: string
  entityIds: string[]
  /** Set on a group aggregate lane; the gutter chevron toggles the members. */
  groupKey: string | null
  detS: number | null
  suspectedAtS: number | null
  hostileAtS: number | null
  winS: [number, number] | null
  shotS: number | null
  arrS: number | null
  severity: ImpactSeverity | null
}

/** Censor members before grouping so future arrivals cannot affect group outcomes. */
export function censorLane(lane: Lane, horizon: ExecutionHorizon): Lane {
  if (!horizon.scoped) return lane
  return {
    ...lane,
    detS: reached(lane.detS, horizon) ? lane.detS : null,
    suspectedAtS: reached(lane.suspectedAtS, horizon) ? lane.suspectedAtS : null,
    hostileAtS: reached(lane.hostileAtS, horizon) ? lane.hostileAtS : null,
    winS:
      lane.winS && reached(lane.winS[0], horizon)
        ? [lane.winS[0], Math.min(lane.winS[1], horizon.horizonS)]
        : null,
    shotS: reached(lane.shotS, horizon) ? lane.shotS : null,
    arrS: reached(lane.arrS, horizon) ? lane.arrS : null,
    severity: reached(lane.arrS, horizon) ? lane.severity : null,
  }
}

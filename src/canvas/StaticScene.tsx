import { memo } from 'react'
import type { TrialResultView } from '../analysis/trialResult'
import type { TrialSweep } from '../playback/trialSweepAt'
import { trialSweepAt } from '../playback/trialSweepAt'
import { BoundaryLayer } from './layers/BoundaryLayer'
import { FootprintLayer } from './layers/FootprintLayer'
import { RangeLayer } from './layers/RangeLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'

// These three take no props and read the store themselves, so a publication
// here must not re-render them.
const StaticBoundaryLayer = memo(BoundaryLayer)
const StaticRangeLayer = memo(RangeLayer)
const StaticConnectionLayer = memo(ConnectionLayer)

interface Props {
  trial: TrialResultView | null
  horizonS: number | null
}

const EMPTY_SENSORS = new Set<string>()
const recentActiveSets: Set<string>[] = [EMPTY_SENSORS]
const activeSets = new WeakMap<TrialSweep, Set<string>>()
// oxlint-disable-next-line react/only-export-components
export function trialActiveSensorIds(sweep: TrialSweep | null): Set<string> {
  if (!sweep) return EMPTY_SENSORS
  const cached = activeSets.get(sweep)
  if (cached) return cached
  const ids = new Set(
    sweep.sensors
      .filter((s) => s.stateAtTime === 'measured' || s.stateAtTime === 'held-between-scans')
      .map((s) => s.sensorId),
  )
  const stable =
    recentActiveSets.find(
      (previous) => previous.size === ids.size && [...ids].every((id) => previous.has(id)),
    ) ?? ids
  if (stable === ids) {
    recentActiveSets.unshift(ids)
    if (recentActiveSets.length > 4) recentActiveSets.pop()
  }
  activeSets.set(sweep, stable)
  return stable
}

/** Configured ring geometry is unchanged; only sampled activity varies. */
export const StaticScene = memo(function StaticScene({ trial, horizonS }: Props) {
  const activeSensorIds = trialActiveSensorIds(
    trial && horizonS != null ? trialSweepAt(trial, horizonS) : null,
  )
  return (
    <>
      <StaticBoundaryLayer />
      <FootprintLayer activeSensorIds={activeSensorIds} />
      <StaticRangeLayer />
      <StaticConnectionLayer />
    </>
  )
})

import { memo } from 'react'
import type { TrialResultView } from '../analysis/trialResult'
import type { TrialSweep } from '../playback/trialSweepAt'
import { trialSweepAt } from '../playback/trialSweepAt'
import { BoundaryLayer } from './layers/BoundaryLayer'
import { FootprintLayer } from './layers/FootprintLayer'
import { RangeLayer } from './layers/RangeLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'

// These three read the store themselves, so a publication must not reach them.
const StaticBoundaryLayer = memo(BoundaryLayer)
const StaticRangeLayer = memo(RangeLayer)
const StaticConnectionLayer = memo(ConnectionLayer)

interface Props {
  trial: TrialResultView | null
  horizonS: number | null
}

const EMPTY_IDS = new Set<string>()
const recentActiveSets: Set<string>[] = [EMPTY_IDS]
const activeSets = new WeakMap<TrialSweep, Set<string>>()
/**
 * Systems whose rings are active at the sweep time: a sensor that is measured or
 * held between scans (coast alone does not light a ring), and an effector that
 * engages (any state but idle or depleted). A recent equal set is reused, so a
 * memoized ring node does not redraw each frame.
 */
// oxlint-disable-next-line react/only-export-components
export function trialActiveIds(sweep: TrialSweep | null): Set<string> {
  if (!sweep) return EMPTY_IDS
  const cached = activeSets.get(sweep)
  if (cached) return cached
  const ids = new Set(
    sweep.sensors
      .filter((s) => s.stateAtTime === 'measured' || s.stateAtTime === 'held-between-scans')
      .map((s) => s.sensorId),
  )
  for (const [effectorId, state] of sweep.effectorStates) {
    if (state !== 'idle' && state !== 'depleted') ids.add(effectorId)
  }
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
  const runActiveIds = trialActiveIds(
    trial && horizonS != null ? trialSweepAt(trial, horizonS) : null,
  )
  return (
    <>
      <StaticBoundaryLayer />
      <FootprintLayer runActiveIds={runActiveIds} />
      <StaticRangeLayer />
      <StaticConnectionLayer />
    </>
  )
})

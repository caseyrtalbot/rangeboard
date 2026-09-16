import { expect, it } from 'vitest'
import type { SweepSummary } from '../../playback/mcRun'
import { IDLE_MC, IDLE_SWEEP } from '../../state/runState'
import { currentSweep } from './mc'

const summary: SweepSummary = {
  factors: [],
  cells: [],
  responses: ['leakers'],
  replicatesPerCell: 40,
  seed: 1,
  elapsedMs: 100,
}
it('currentSweep accepts only a completed result for the current run', () => {
  for (const status of ['idle', 'running', 'stale', 'error', 'done'] as const) {
    const mc = { ...IDLE_MC, sweep: { ...IDLE_SWEEP, status, runId: 'run', summary } }
    expect(currentSweep(mc, 'run')).toBe(status === 'done' ? summary : null)
    expect(currentSweep(mc, 'another-run')).toBeNull()
  }
})

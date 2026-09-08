import { describe, expect, it, vi } from 'vitest'
import { mixedTrial } from './__fixtures__/trialFixture'
import { trialSweepAt } from './trialSweepAt'
import * as detection from './detection'
import { effectorStatesAt, shotsInFlightAt, trialShotTimelineOf } from './trackState'

describe('retained sampled sweep', () => {
  it('uses exact scan times and freezes measurements through holds and coasts', () => {
    const { view } = mixedTrial()
    expect(trialSweepAt(view, 1).sensors[0]).toMatchObject({ stateAtTime: 'not-held' })
    expect(trialSweepAt(view, 1).sensors[0].lastMeasurementTimeS).toBeUndefined()
    expect(trialSweepAt(view, 1.1).sensors[0]).toMatchObject({ stateAtTime: 'measured', lastMeasurementTimeS: 1.1, slantRangeM: 50, pd: 0.8 })
    expect(trialSweepAt(view, 2.5).sensors[0]).toMatchObject({ stateAtTime: 'held-between-scans', lastMeasurementTimeS: 1.1, slantRangeM: 50, pd: 0.8 })
    expect(trialSweepAt(view, 3.1).sensors[0]).toMatchObject({ stateAtTime: 'coasting', lastMeasurementTimeS: 1.1, slantRangeM: 50, pd: 0.8 })
    expect(trialSweepAt(view, 4).sensors).toHaveLength(1)
    expect(trialSweepAt(view, 4).holdingSensorIds).toEqual(new Set(['radar']))
    expect(trialSweepAt(view, 5.99).sensors[0].stateAtTime).toBe('not-held')
    expect(trialSweepAt(view, 6.1).sensors[0]).toMatchObject({ stateAtTime: 'measured', lastMeasurementTimeS: 6.1, slantRangeM: 20, pd: 0.5 })
    expect(trialSweepAt(view, 1.1).sensors[0].slantRangeM).toBe(50)
  })

  it('retains misses and draw ranks without making per-member coast histories or detection calls', () => {
    const sweepSpy = vi.spyOn(detection, 'prepareSweep')
    const detectSpy = vi.spyOn(detection, 'detectionsAt')
    try {
      const { view } = mixedTrial()
      const measured = trialSweepAt(view, 1.1)
      expect(measured.sensors[0].observation?.members.map(m => [m.memberIdx, m.drawIndex, m.detected]))
        .toEqual([[3, 0, false], [1, 1, true]])
      expect(trialSweepAt(view, 3.1).sensors[0].observation?.members[0].detected).toBe(false)
      expect(trialSweepAt(view, 3.2).sensors[0].observation).toBeUndefined()
      expect(trialSweepAt(view, 3.2)).toBe(trialSweepAt(view, 3.2))
      expect(sweepSpy).not.toHaveBeenCalled()
      expect(detectSpy).not.toHaveBeenCalled()
    } finally { vi.restoreAllMocks() }
  })

  it('reuses preparation, released guidance and magazine states with no aggregate ghosts', () => {
    const { view } = mixedTrial()
    const timeline = trialShotTimelineOf(view.scenario, view.attrition)
    expect(timeline.tracks).toEqual([])
    expect(trialSweepAt(view, 0.25).effectorStates.get('gun')).toBe('preparing')
    expect(shotsInFlightAt(timeline, 0.25)).toEqual([])
    expect(trialSweepAt(view, 0.75).effectorStates).toEqual(effectorStatesAt(timeline, 0.75))
    expect(shotsInFlightAt(timeline, 0.75)[0]).toMatchObject({ shipIdx: 2, uasId: 'moving' })
    // This committed shot remains in flight after member 3 was already destroyed.
    expect(shotsInFlightAt(timeline, 3.5).some(s => s.shipIdx === 3 && s.uasId === 'swarm')).toBe(true)
  })
})

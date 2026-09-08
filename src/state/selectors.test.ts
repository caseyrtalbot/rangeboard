import { EMPTY_HORIZON, FULL_RUN } from '../analysis/horizon'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { DT } from '../playback/clock'
import {
  durationOf,
  selectBoardPhase,
  selectExecutionHorizon,
  selectDurationS,
  selectObservedThroughStep,
  selectPlaybackFlags,
  selectRunComplete,
  selectSimTimeStep,
  selectWaves,
} from './selectors'
import { useStore } from './store'

function reset() {
  useStore.getState().replaceScenario(emptyScenario())
}

describe('playback selectors', () => {
  beforeEach(reset)

  it('quantizes both clocks to the DT grid', () => {
    const st = useStore.getState()
    st.startRun()
    st.advanceRun(12.3)
    st.pauseRun()
    st.scrubTo(12.7)
    const s = useStore.getState()
    expect(selectSimTimeStep(s)).toBe(Math.round(12.7 / DT) * DT)
    expect(selectObservedThroughStep(s)).toBe(Math.round(12.3 / DT) * DT)
  })

  it('caches the duration by scenario identity', () => {
    const s = useStore.getState()
    expect(selectDurationS(s)).toBe(durationOf(s.scenario))
    expect(durationOf(s.scenario)).toBe(durationOf(s.scenario))
    expect(selectDurationS(s)).toBeGreaterThanOrEqual(60)
  })

  it('reads complete only after playback seals the whole duration', () => {
    const st = useStore.getState()
    const d = selectDurationS(st)
    expect(selectRunComplete(st)).toBe(false)
    st.startRun()
    st.advanceRun(d)
    expect(selectRunComplete(useStore.getState())).toBe(false)
    useStore.getState().completeRun(d)
    expect(selectRunComplete(useStore.getState())).toBe(true)
  })

  it('returns the transport flags and a stable empty wave list', () => {
    const s = useStore.getState()
    expect(selectPlaybackFlags(s)).toEqual({
      playing: false,
      speedMult: s.playback.speedMult,
      runSeq: s.playback.runSeq,
      completedAtMs: null,
    })
    expect(selectWaves(s)).toBe(selectWaves(s))
    expect(selectWaves(s)).toEqual([])
  })
})

describe('execution horizon selector', () => {
  beforeEach(() => {
    reset()
    useStore.getState().setBoardPhase('prepare')
  })

  it('returns the same full-run constant outside Execute and the empty constant when ready', () => {
    expect(selectBoardPhase(useStore.getState())).toBe('prepare')
    expect(selectExecutionHorizon(useStore.getState())).toBe(FULL_RUN)
    useStore.getState().setBoardPhase('analyze')
    expect(selectExecutionHorizon(useStore.getState())).toBe(FULL_RUN)
    useStore.getState().setBoardPhase('execute')
    expect(selectExecutionHorizon(useStore.getState())).toBe(EMPTY_HORIZON)
    expect(selectExecutionHorizon(useStore.getState())).toBe(EMPTY_HORIZON)
    // A scrub before the first Play previews geometry; it observes nothing.
    useStore.getState().scrubTo(20)
    expect(useStore.getState().playback.startedAtMs).toBeNull()
    expect(selectExecutionHorizon(useStore.getState())).toBe(EMPTY_HORIZON)
  })

  it('caps the quantized cursor by observation and keeps identity for unchanged values', () => {
    const st = useStore.getState()
    st.setBoardPhase('execute')
    st.startRun()
    st.advanceRun(12.3)
    st.pauseRun()
    st.scrubTo(20)
    const h = selectExecutionHorizon(useStore.getState())
    expect(h).toEqual({ scoped: true, horizonS: Math.round(12.3 / DT) * DT })
    expect(selectExecutionHorizon(useStore.getState())).toBe(h)
    st.scrubTo(30)
    st.setTool('path')
    expect(selectExecutionHorizon(useStore.getState())).toBe(h)
    st.scrubTo(5)
    expect(selectExecutionHorizon(useStore.getState())).toEqual({ scoped: true, horizonS: 5 })
    expect(selectExecutionHorizon(useStore.getState())).not.toBe(h)
  })
})

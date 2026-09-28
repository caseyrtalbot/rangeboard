import { beforeEach, describe, expect, it } from 'vitest'
import type { RunTimelineRow } from '../../analysis/runTimeline'
import { useStore } from '../../state/store'
import { installTrial, observeTrial } from '../analysis/trialTestState'
import { seekRunTimelineHit } from './useRunTimelineSeek'
import { shownViewport } from './useShownT0'

const gun: RunTimelineRow = {
  key: 'effector:gun',
  kind: 'effector',
  label: 'Gun',
  meta: '',
  entityId: 'gun',
  spans: [{ kind: 'burst', startS: 40, endS: 52 }],
  marks: [{ kind: 'release', tS: 40 }],
}
const base = { t0S: 0, winS: 30 }

describe('seekRunTimelineHit', () => {
  beforeEach(() => {
    installTrial(3)
    observeTrial(60, 50)
    useStore.getState().setRunTimelineFollow(true)
  })

  it('seeks to a mark with Follow off and the shown viewport held', () => {
    const shown = shownViewport(base, true, 120)
    seekRunTimelineHit({ t: 'mark', row: gun, mark: gun.marks[0] }, base, true, 120)
    const st = useStore.getState()
    expect(st.playback.simTimeS).toBe(40)
    expect(st.ui.runTimeline.follow).toBe(false)
    expect(st.ui.runTimeline.viewport).toEqual(shown)
    expect(st.playback.observedThroughS).toBe(60)
  })

  it('holds the base viewport when Follow is already off', () => {
    seekRunTimelineHit({ t: 'mark', row: gun, mark: gun.marks[0] }, base, false, 120)
    expect(useStore.getState().ui.runTimeline.viewport).toBe(base)
  })

  it('does nothing for a span', () => {
    const before = useStore.getState()
    seekRunTimelineHit({ t: 'span', row: gun, span: gun.spans[0] }, base, true, 120)
    const after = useStore.getState()
    expect(after.playback).toBe(before.playback)
    expect(after.ui).toBe(before.ui)
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { IDLE_TRIAL } from '../state/runState'
import { installTrial } from './analysis/trialTestState'
import { TimelineBar } from './TimelineBar'

function render(engagementOpen = false) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <TimelineBar engagementOpen={engagementOpen} onToggleEngagement={() => {}} />,
  )
}

describe('sampled transport labels', () => {
  beforeEach(() => installTrial())

  it('uses matching Play, Pause, Replay and New run titles and accessible names', () => {
    expect(render()).toContain('title="Play" aria-label="Play"')
    useStore.setState(({ playback }) => ({
      playback: { ...playback, playing: true, phase: 'running' },
    }))
    expect(render()).toContain('title="Pause" aria-label="Pause"')
    useStore.setState(({ playback }) => ({
      playback: { ...playback, playing: false, phase: 'complete', completedAtMs: 1 },
    }))
    const html = render()
    expect(html).toContain('title="Replay" aria-label="Replay"')
    expect(html).toContain('>Replay</button>')
    expect(html).toContain('title="New run" aria-label="New run"')
    expect(html).not.toContain('Start a new clean run')
  })

  it('resumes a paused replay instead of labeling it as a completed Replay action', () => {
    useStore.setState(({ playback }) => ({
      playback: { ...playback, playing: false, phase: 'paused', completedAtMs: 1 },
    }))
    expect(render()).toContain('aria-label="Play"')
    expect(render()).not.toContain('aria-label="Replay"')
  })

  it('offers explicit Pause and Cancel during preparation without replacing repeated Play', () => {
    useStore.setState({ trial: { ...IDLE_TRIAL, status: 'preparing', startWhenReady: true } })
    const html = render()
    expect(html).toContain('Preparing trial')
    expect(html).toContain('aria-label="Play"')
    expect(html).toContain('aria-label="Pause trial preparation start"')
    expect(html).toContain('>Cancel</button>')
  })

  it.each(['error', 'cancelled'] as const)('offers Retry for %s preparation', (status) => {
    useStore.setState({ trial: { ...IDLE_TRIAL, status } })
    expect(render()).toContain('title="Retry" aria-label="Retry"')
  })

  it('shows the engagement toggle with the threat count and expanded state', () => {
    const { entities, paths } = useStore.getState().scenario
    const threats = entities.filter(
      (e) => e.kind === 'uas' && paths.some((p) => p.entityId === e.id),
    ).length
    const html = render()
    expect(html).toContain('id="engagement-toggle"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="engagement-strip"')
    expect(html).toContain(`Engagement ${threats}`)
    expect(render(true)).toContain('aria-expanded="true"')
  })

  it('shows no undo cue before an edit lands', () => {
    expect(render()).not.toContain('undo-cue')
  })
})

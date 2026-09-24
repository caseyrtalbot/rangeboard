import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { IDLE_TRIAL } from '../state/runState'
import { installTrial } from './analysis/trialTestState'
import { FrameAddPanel, TimelineBar } from './TimelineBar'

function render(engagementOpen = false) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <TimelineBar engagementOpen={engagementOpen} onToggleEngagement={() => {}} />,
  )
}

describe('sampled transport labels', () => {
  beforeEach(() => installTrial())

  it('uses matching Play, Pause, Replay and Reset run titles and accessible names', () => {
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
    expect(html).toContain('title="Reset run" aria-label="Reset run"')
    expect(html).not.toContain('New run')
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

  it('saves a frame from a popover, not a permanent name field', () => {
    const html = render()
    expect(html).toMatch(/<button[^>]*id="frame-add"[^>]*>\+ Frame<\/button>/)
    expect(html).toContain('aria-controls="frame-add-panel"')
    expect(html).not.toContain('aria-label="Frame name"')
    expect(html).not.toContain('frame-name')
    const panel = renderToStaticMarkup(<FrameAddPanel onDone={() => {}} />)
    expect(panel).toContain('aria-label="Frame name"')
    expect(panel).toMatch(/>Save<\/button>/)
  })

  it('leaves the run id to the status bar', () => {
    const html = render()
    expect(html).not.toContain('RUN-')
    expect(html).toContain('T+')
  })

  it('keeps the undo cue out of the timeline row', () => {
    expect(render()).not.toContain('undo-cue')
  })
})

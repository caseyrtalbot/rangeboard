import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { IDLE_TRIAL } from '../state/runState'
import { installTrial } from './analysis/trialTestState'
import { FrameAddPanel, TimelineBar } from './TimelineBar'

function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<TimelineBar />)
}

function setTimelineOpen(open: boolean) {
  useStore.setState(({ ui }) => ({ ui: { ...ui, runTimeline: { ...ui.runTimeline, open } } }))
}

describe('sampled transport labels', () => {
  beforeEach(() => installTrial())

  it('uses matching Play, Pause, Replay and Reset run titles and accessible names', () => {
    useStore.setState(({ playback }) => ({ playback: { ...playback, phase: 'ready' } }))
    expect(render()).toContain('title="Play (Space)" aria-label="Play"')
    useStore.setState(({ playback }) => ({
      playback: { ...playback, playing: true, phase: 'running' },
    }))
    expect(render()).toContain('title="Pause (Space)" aria-label="Pause"')
    useStore.setState(({ playback }) => ({
      playback: { ...playback, playing: false, phase: 'complete', completedAtMs: 1 },
    }))
    const html = render()
    expect(html).toContain('title="Replay (Space)" aria-label="Replay"')
    // Icon-only at 24 px: the word lives in the accessible name and the title.
    expect(html).not.toContain('>Replay</button>')
    expect(html).toContain('title="Reset run" aria-label="Reset run"')
    expect(html).not.toContain('New run')
    expect(html).not.toContain('Start a new clean run')
  })

  it('resumes a paused replay instead of labeling it as a completed Replay action', () => {
    useStore.setState(({ playback }) => ({
      playback: { ...playback, playing: false, phase: 'paused', completedAtMs: 1 },
    }))
    expect(render()).toContain('aria-label="Resume"')
    expect(render()).not.toContain('aria-label="Replay"')
  })

  it('offers explicit Pause and Cancel during preparation without replacing repeated Play', () => {
    useStore.setState(({ playback }) => ({
      playback: { ...playback, phase: 'ready' },
      trial: { ...IDLE_TRIAL, status: 'preparing', startWhenReady: true },
    }))
    const html = render()
    expect(html).toContain('Preparing trial')
    expect(html).toContain('aria-label="Play"')
    expect(html).toContain('aria-label="Pause trial preparation start"')
    expect(html).toContain('>Cancel</button>')
  })

  it.each(['error', 'cancelled'] as const)('offers Retry for %s preparation', (status) => {
    useStore.setState({ trial: { ...IDLE_TRIAL, status } })
    const html = render()
    expect(html).toContain('title="Retry (Space)" aria-label="Retry"')
    expect(html).not.toContain('>Retry</button>')
  })

  it('shows the Timeline toggle with the expanded state from the store', () => {
    setTimelineOpen(false)
    const html = render()
    expect(html).toMatch(
      /<button[^>]*id="run-timeline-toggle"[^>]*class="mini run-timeline-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="run-timeline"[^>]*title="Run timeline"[^>]*><span class="caret">▴<\/span> Timeline<\/button>/,
    )
    setTimelineOpen(true)
    expect(render()).toMatch(/id="run-timeline-toggle"[^>]*aria-expanded="true"/)
    setTimelineOpen(false)
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

  it('leaves the run id and the clock to the status bar', () => {
    const html = render()
    expect(html).not.toContain('RUN-')
    expect(html).not.toContain('T+')
    expect(html).toContain('class="scrub"')
  })

  it('keeps the undo cue out of the timeline row', () => {
    expect(render()).not.toContain('undo-cue')
  })
})

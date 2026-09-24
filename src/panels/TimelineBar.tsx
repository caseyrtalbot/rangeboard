import { memo, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../state/store'
import type { Store } from '../state/store'
import { defaultFrameName } from '../state/labels'
import {
  selectDurationS,
  selectFrames,
  selectPlaybackFlags,
  selectPlayLabel,
  selectSimTimeS,
  selectWaves,
} from '../state/selectors'
import { resetAnalysisRun, toggleAnalysisRun } from '../playback/runSession'
import { nextPublishedTimeS } from '../canvas/frameClock'
import { usePopover } from '../ui/usePopover'
import { IconPause, IconPlay, IconReset } from '../ui/icons'

const SPEEDS = [1, 2, 5, 10, 30]

/** Threats the engagement strip lists: `uas` entities that have a flight path. */
function selectThreatCount(s: Store): number {
  const { entities, paths } = s.scenario
  return entities.filter((e) => e.kind === 'uas' && paths.some((p) => p.entityId === e.id)).length
}

/**
 * The `+ Frame` popover: one name field and Save. An empty name saves under the
 * default name the placeholder shows.
 */
export function FrameAddPanel({ onDone }: { onDone: () => void }) {
  const scenarioName = useStore((s) => s.scenario.name)
  const basemap = useStore((s) => s.ui.basemap)
  const simTimeS = useStore(selectSimTimeS)
  const [name, setName] = useState('')
  const save = () => {
    useStore.getState().saveFrame(name.trim())
    setName('')
    onDone()
  }
  return (
    <div
      id="frame-add-panel"
      className="tb-menu-panel surface-float tb-menu-right frame-add-panel"
      role="dialog"
      aria-label="Save frame"
    >
      <input
        aria-label="Frame name"
        placeholder={defaultFrameName(scenarioName, simTimeS, basemap)}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
        }}
      />
      <button type="button" className="mini" onClick={save}>
        Save
      </button>
    </div>
  )
}

/** `+ Frame` and its popover. Lane B3's rail Frames button focuses `#frame-add`. */
function FrameAdd() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = usePopover(wrapRef, buttonRef)
  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        id="frame-add"
        type="button"
        className="mini"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="frame-add-panel"
        title="Save the current view, time, and basemap as a frame"
        onClick={toggle}
      >
        + Frame
      </button>
      {open && (
        <FrameAddPanel
          onDone={() => {
            setOpen(false)
            buttonRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}

/**
 * The one requestAnimationFrame loop that publishes `playback.simTimeS` every
 * PUBLISH_PERIOD_MS of wall time, at every speed. Each publication advances sim time
 * by the measured wall time at playback speed, so the clock does not drift. App mounts
 * it once, so the clock runs in every phase (Prepare renders no transport).
 */
export function usePlaybackLoop() {
  const playing = useStore((s) => s.playback.playing)
  const raf = useRef(0)
  useEffect(() => {
    if (!playing) return
    // Wall time and speed of the last publication. A frame inside the period
    // publishes nothing, unless the speed changed: the elapsed span is published at
    // once at the old speed, so the canvas clock never runs ahead of the store.
    let last = performance.now()
    let speed = useStore.getState().playback.speedMult
    const tick = (now: number) => {
      const st = useStore.getState()
      const changed = st.playback.speedMult !== speed
      const next = changed
        ? st.playback.simTimeS + ((now - last) / 1000) * speed
        : nextPublishedTimeS(st.playback.simTimeS, speed, now - last)
      if (next == null) {
        raf.current = requestAnimationFrame(tick)
        return
      }
      last = now
      speed = st.playback.speedMult
      // The store resolves the publication into an observation advance, or the one
      // completion once the clock reaches the run duration.
      st.playbackCommand({ type: 'publish', t: next })
      if (!useStore.getState().playback.playing) return
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing])
}

/**
 * Bottom transport: play/pause, scrub, speed, the frames strip and the Engagement
 * toggle. It owns the one requestAnimationFrame loop that publishes
 * `playback.simTimeS` every PUBLISH_PERIOD_MS of wall time, at every speed. Each
 * publication advances sim time by the measured wall time at playback speed, so
 * the clock does not drift.
 */
export const TimelineBar = memo(function TimelineBar({
  engagementOpen,
  onToggleEngagement,
}: {
  engagementOpen: boolean
  onToggleEngagement: () => void
}) {
  const { playing, speedMult } = useStore(useShallow(selectPlaybackFlags))
  const trialStatus = useStore((s) => s.trial.status)
  const playLabel = useStore(selectPlayLabel)
  const simTimeS = useStore(selectSimTimeS)
  const durationS = useStore(selectDurationS)
  const frames = useStore(selectFrames)
  const waves = useStore(selectWaves)
  const threatCount = useStore(selectThreatCount)
  const { scrubTo, setSpeedMult, applyFrame, deleteFrame, setWaveDelay, patchScenario } =
    useStore.getState()

  return (
    <div className="timeline">
      <button
        type="button"
        className="mini play"
        onClick={toggleAnalysisRun}
        title={`${playLabel} (Space)`}
        aria-label={playLabel}
      >
        {playing ? <IconPause /> : <IconPlay />}
        {(playLabel === 'Replay' || playLabel === 'Retry') && playLabel}
      </button>
      <button
        type="button"
        className="mini"
        onClick={() => resetAnalysisRun('manual')}
        title="Reset run"
        aria-label="Reset run"
      >
        <IconReset />
      </button>
      {trialStatus === 'preparing' && (
        <span className="live-head">
          <span role="status">Preparing trial</span>
          <button
            className="mini"
            onClick={() => useStore.getState().pauseRun()}
            aria-label="Pause trial preparation start"
          >
            Pause
          </button>
          <button className="mini" onClick={() => useStore.getState().cancelTrialPreparation()}>
            Cancel
          </button>
        </span>
      )}
      <input
        className="scrub"
        type="range"
        min={0}
        max={durationS}
        step={0.5}
        value={simTimeS}
        onChange={(e) => scrubTo(Number(e.target.value))}
      />
      <select
        value={speedMult}
        onChange={(e) => setSpeedMult(Number(e.target.value))}
        title="Playback speed"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>

      <div
        className="frames-strip"
        title="Raid waves: shared launch delays added to each member's path delay"
      >
        {waves.map((w, i) => (
          <span
            key={i}
            className="frame-chip"
            title={`Wave ${i + 1}: ${w.entityIds.length} ship(s), launch T+${w.startDelayS} s`}
          >
            <button type="button" style={{ cursor: 'default' }}>
              W{i + 1} · {w.entityIds.length}
            </button>
            <input
              type="number"
              min={0}
              step={5}
              style={{ width: 54 }}
              value={w.startDelayS}
              onChange={(e) => setWaveDelay(i, Number(e.target.value))}
              title={`Wave ${i + 1} launch delay, seconds`}
            />
          </span>
        ))}
        {waves.length > 0 && (
          <button
            onClick={() => patchScenario({ raid: { waves: [] } })}
            title="Clear all raid waves"
          >
            clear waves
          </button>
        )}
      </div>

      <div className="frames-strip">
        {frames.map((f) => (
          <span key={f.id} className="frame-chip">
            <button onClick={() => applyFrame(f.id)} title={`Go to ${f.name}`}>
              {f.name}
            </button>
            <button className="x" onClick={() => deleteFrame(f.id)} title="Delete frame">
              ×
            </button>
          </span>
        ))}
      </div>
      <FrameAdd />

      <button
        type="button"
        id="engagement-toggle"
        className="mini engagement-toggle"
        aria-expanded={engagementOpen}
        aria-controls="engagement-strip"
        title="Engagement timeline"
        onClick={onToggleEngagement}
      >
        <span className="caret">▴</span> Engagement {threatCount}
      </button>
    </div>
  )
})

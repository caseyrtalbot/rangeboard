import { memo, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../state/store'
import { defaultFrameName, formatRunLabel } from '../state/labels'
import {
  selectDurationS,
  selectFrames,
  selectPlaybackFlags,
  selectSimTimeS,
  selectWaves,
} from '../state/selectors'
import { formatTime } from '../geometry/geo'
import { resetAnalysisRun, toggleAnalysisRun } from '../playback/runSession'
import { nextPublishedTimeS } from '../canvas/frameClock'

const SPEEDS = [1, 2, 5, 10, 30]

/**
 * Bottom transport: play/pause, scrub, speed, and the frames strip. It owns
 * the playback loop: one requestAnimationFrame loop that publishes
 * `playback.simTimeS` every PUBLISH_PERIOD_MS of wall time at every speed
 * (10 Hz). Each publication advances sim time by the measured wall time at
 * playback speed, so the clock does not drift. The canvas interpolates
 * between publications with its own frame clock (`useFrameClock`).
 * Memoized with no props: it re-renders on its own selectors only.
 */
export const TimelineBar = memo(function TimelineBar() {
  const { playing, speedMult, runSeq } = useStore(useShallow(selectPlaybackFlags))
  const phase = useStore((s) => s.playback.phase)
  const trialStatus = useStore((s) => s.trial.status)
  const playLabel = playing ? 'Pause' : phase === 'complete' ? 'Replay' : trialStatus === 'error' || trialStatus === 'cancelled' ? 'Retry' : 'Play'
  const simTimeS = useStore(selectSimTimeS)
  const durationS = useStore(selectDurationS)
  const frames = useStore(selectFrames)
  const waves = useStore(selectWaves)
  const scenarioName = useStore((s) => s.scenario.name)
  const basemap = useStore((s) => s.ui.basemap)
  const {
    scrubTo,
    setSpeedMult,
    saveFrame,
    applyFrame,
    deleteFrame,
    setWaveDelay,
    patchScenario,
  } = useStore.getState()
  const [frameName, setFrameName] = useState('')
  const raf = useRef(0)

  useEffect(() => {
    if (!playing) return
    // Wall time and speed of the last publication. A frame inside the period
    // publishes nothing, except when the speed changed: the elapsed span is
    // published at once at the old speed, so the canvas clock never runs past
    // what the store then observes.
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
      if (next >= durationS) {
        st.advanceRun(durationS)
        st.completeRun(durationS)
        return
      }
      st.advanceRun(next)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, durationS])

  return (
    <div className="timeline">
      <button
        className="play"
        style={{ width: 'auto', minWidth: 36 }}
        onClick={toggleAnalysisRun}
        title={playLabel}
        aria-label={playLabel}
      >
        {playing ? '❚❚' : phase === 'complete' ? 'Replay' : trialStatus === 'error' || trialStatus === 'cancelled' ? 'Retry' : '▶'}
      </button>
      <button onClick={() => resetAnalysisRun('manual')} title="New run" aria-label="New run">
        New run
      </button>
      {trialStatus === 'preparing' && <span className="live-head">
        <span role="status">Preparing trial</span>
        <button onClick={() => useStore.getState().pauseRun()} aria-label="Pause trial preparation start">Pause</button>
        <button onClick={() => useStore.getState().cancelTrialPreparation()}>Cancel</button>
      </span>}
      <span className="time-readout">
        {formatRunLabel(runSeq)} · T+{formatTime(simTimeS)} / {formatTime(durationS)}
      </span>
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

      <div className="frames-strip" title="Raid waves: shared launch delays added to each member's path delay">
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
          <button onClick={() => patchScenario({ raid: { waves: [] } })} title="Clear all raid waves">
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
        <input
          className="frame-name"
          placeholder={defaultFrameName(scenarioName, simTimeS, basemap)}
          value={frameName}
          onChange={(e) => setFrameName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              saveFrame(frameName.trim())
              setFrameName('')
            }
          }}
        />
        <button
          onClick={() => {
            saveFrame(frameName.trim())
            setFrameName('')
          }}
          title="Save the current view, time, and basemap as a frame"
        >
          + Frame
        </button>
      </div>
    </div>
  )
})

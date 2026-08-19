import { useEffect, useRef, useState } from 'react'
import { useStore, scenarioDurationS } from '../state/store'
import { formatTime } from '../geometry/geo'

const SPEEDS = [1, 2, 5, 10, 30]

/** Bottom transport: play/pause, scrub, speed, and the frames strip. */
export function TimelineBar() {
  const playback = useStore((s) => s.playback)
  const scenario = useStore((s) => s.scenario)
  const frames = useStore((s) => s.scenario.frames)
  const { setPlaying, setSimTime, setSpeedMult, saveFrame, applyFrame, deleteFrame } =
    useStore.getState()
  const durationS = scenarioDurationS(scenario)
  const [frameName, setFrameName] = useState('')
  const raf = useRef(0)

  useEffect(() => {
    if (!playback.playing) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const st = useStore.getState()
      const next = st.playback.simTimeS + dt * st.playback.speedMult
      if (next >= durationS) {
        st.setSimTime(durationS)
        st.setPlaying(false)
        return
      }
      st.setSimTime(next)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playback.playing, durationS])

  return (
    <div className="timeline">
      <button
        className="play"
        onClick={() => {
          if (!playback.playing && playback.simTimeS >= durationS) setSimTime(0)
          setPlaying(!playback.playing)
        }}
        title="Play / pause"
      >
        {playback.playing ? '❚❚' : '▶'}
      </button>
      <button onClick={() => setSimTime(0)} title="Reset to T0">
        ⏮
      </button>
      <span className="time-readout">
        T+{formatTime(playback.simTimeS)} / {formatTime(durationS)}
      </span>
      <input
        className="scrub"
        type="range"
        min={0}
        max={durationS}
        step={0.5}
        value={playback.simTimeS}
        onChange={(e) => setSimTime(Number(e.target.value))}
      />
      <select
        value={playback.speedMult}
        onChange={(e) => setSpeedMult(Number(e.target.value))}
        title="Playback speed"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>

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
          placeholder="Frame name"
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
}

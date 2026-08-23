import { useEffect, useRef, useState } from 'react'
import { defaultFrameName, useStore, scenarioDurationS } from '../state/store'
import { formatTime } from '../geometry/geo'

const SPEEDS = [1, 2, 5, 10, 30]

/** Bottom transport: play/pause, scrub, speed, and the frames strip. */
export function TimelineBar() {
  const playback = useStore((s) => s.playback)
  const scenario = useStore((s) => s.scenario)
  const frames = useStore((s) => s.scenario.frames)
  const basemap = useStore((s) => s.ui.basemap)
  const { setPlaying, setSimTime, setSpeedMult, saveFrame, applyFrame, deleteFrame, setWaveDelay, patchScenario } =
    useStore.getState()
  const waves = scenario.raid?.waves ?? []
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
          placeholder={defaultFrameName(scenario.name, playback.simTimeS, basemap)}
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

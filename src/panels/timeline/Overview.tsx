import { memo, useRef, useState, type PointerEvent } from 'react'
import type { RunTimelineModel } from '../../analysis/runTimeline'
import type { TimeViewport } from '../../charts/timeViewport'
import { useStore } from '../../state/store'
import { panGlide, shownViewport, useShownT0 } from './useShownT0'
import { overviewGrab, overviewPlace, overviewTime } from './viewportActions'

const OVER_H = 22
/** Threat ramp band height, px; many threats share the band. */
const BAND_H = 2
const BAND_TOP = 3
const BAND_SPAN = 17

const RAMP = {
  unknown: 'color-mix(in srgb, var(--danger) 25%, var(--bg-panel))',
  suspected: 'color-mix(in srgb, var(--danger) 55%, var(--bg-panel))',
  hostile: 'var(--danger)',
} as const

/**
 * The whole run at fixed scale: each threat's classification ramp, the hard-kill
 * and mission-kill marks and the unobserved region. It re-renders on a model or
 * width change only.
 */
const Picture = memo(function Picture({
  model,
  widthPx,
}: {
  model: RunTimelineModel
  widthPx: number
}) {
  const { durationS } = model
  if (!(durationS > 0) || !(widthPx > 0)) return null
  const ox = (t: number) => (t / durationS) * widthPx
  const threats = model.groups.find((g) => g.key === 'threat')?.rows ?? []
  const step = threats.length > 0 ? Math.min(2.6, BAND_SPAN / threats.length) : 0
  const seenS = Math.min(durationS, Math.max(0, model.horizonS))
  return (
    <>
      {threats.map((row, i) => (
        <g key={row.key}>
          {row.spans.map((span, j) =>
            span.kind === 'classify' ? (
              <rect
                key={j}
                x={ox(span.startS)}
                y={BAND_TOP + i * step}
                width={Math.max(1, ox(span.endS) - ox(span.startS))}
                height={BAND_H}
                fill={typeof span.level === 'string' ? RAMP[span.level] : RAMP.unknown}
              />
            ) : null,
          )}
          {row.marks.map((mark, j) =>
            mark.kind === 'hard-kill' || mark.kind === 'mission-kill' ? (
              <rect
                key={`m${j}`}
                className={`runtl-over-${mark.kind}`}
                x={ox(mark.tS) - 1}
                y={2}
                width={2}
                height={OVER_H - 4}
                fill={mark.kind === 'hard-kill' ? 'var(--danger)' : 'var(--ew)'}
              />
            ) : null,
          )}
        </g>
      ))}
      {seenS < durationS && (
        <rect
          className="runtl-over-unobserved"
          x={ox(seenS)}
          y={0}
          width={widthPx - ox(seenS)}
          height={OVER_H}
        />
      )}
    </>
  )
})

/**
 * The viewport rectangle; it follows the clock with Follow on, with the rows'
 * glide. Keyed by scale, so a width change moves it without a glide.
 */
function Window({
  base,
  follow,
  durationS,
  widthPx,
}: {
  base: TimeViewport
  follow: boolean
  durationS: number
  widthPx: number
}) {
  const t0S = useShownT0(base, follow, durationS)
  if (!(durationS > 0)) return null
  const scale = widthPx / durationS
  return (
    <rect
      key={scale}
      className="runtl-over-window"
      style={{ transform: `translateX(${t0S * scale}px)`, transition: panGlide(follow) }}
      x={0}
      y={0.5}
      width={Math.max(2, base.winS * scale)}
      height={OVER_H - 1}
    />
  )
}

/**
 * The overview under the axis. A press takes pointer capture: outside the
 * window it centers the window at the pointer time, inside it keeps the grab
 * offset; each move pans the viewport and turns Follow off.
 */
export const Overview = memo(function Overview({
  model,
  base,
  follow,
  widthPx,
}: {
  model: RunTimelineModel
  base: TimeViewport
  follow: boolean
  widthPx: number
}) {
  const { durationS } = model
  // Seconds from the window start held under the pointer; null while no drag.
  const grabRef = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const timeAt = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return overviewTime(e.clientX - r.left, r.width, durationS)
  }
  const moveTo = (tS: number, grabS: number) => {
    const shown = shownViewport(base, follow, durationS)
    useStore.getState().setRunTimelineViewport(overviewPlace(shown, tS, grabS, durationS), false)
  }
  const end = (e: PointerEvent<SVGSVGElement>) => {
    if (grabRef.current == null) return
    grabRef.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="runtl-over">
      <div className="runtl-over-gutter">Whole run</div>
      <svg
        className={dragging ? 'runtl-over-svg dragging' : 'runtl-over-svg'}
        width={widthPx}
        height={OVER_H}
        aria-hidden="true"
        onPointerDown={(e) => {
          if (e.button !== 0 || !(durationS > 0)) return
          e.currentTarget.setPointerCapture(e.pointerId)
          const tS = timeAt(e)
          const grabS = overviewGrab(shownViewport(base, follow, durationS), tS)
          grabRef.current = grabS
          setDragging(true)
          moveTo(tS, grabS)
        }}
        onPointerMove={(e) => {
          if (grabRef.current != null) moveTo(timeAt(e), grabRef.current)
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <Picture model={model} widthPx={widthPx} />
        <Window base={base} follow={follow} durationS={durationS} widthPx={widthPx} />
      </svg>
    </div>
  )
})

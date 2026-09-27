import { memo } from 'react'
import type { RunTimelineModel } from '../../analysis/runTimeline'
import type { TimeViewport } from '../../charts/timeViewport'
import { GLIDE, useShownT0 } from './useShownT0'

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
      style={{ transform: `translateX(${t0S * scale}px)`, transition: GLIDE }}
      x={0}
      y={0.5}
      width={Math.max(2, base.winS * scale)}
      height={OVER_H - 1}
    />
  )
}

/** The overview under the axis. Phase 3 adds the drag that moves the viewport. */
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
  return (
    <div className="runtl-over">
      <div className="runtl-over-gutter">Whole run</div>
      <svg className="runtl-over-svg" width={widthPx} height={OVER_H} aria-hidden="true">
        <Picture model={model} widthPx={widthPx} />
        <Window base={base} follow={follow} durationS={model.durationS} widthPx={widthPx} />
      </svg>
    </div>
  )
})

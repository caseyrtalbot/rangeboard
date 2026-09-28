import { memo } from 'react'
import { viewportTicks, type TimeViewport } from '../../charts/timeViewport'
import { formatTime } from '../../geometry/geo'
import { panPx } from './layout'
import { panGlide, useShownT0 } from './useShownT0'

const AXIS_H = 20

/**
 * The time axis under the rows. Ticks are absolute run times from
 * `viewportTicks`, drawn at absolute run-time x inside the same pan transform
 * and glide as the rows, so the ticks and the rows move together. The tick set
 * spans one window either side of the shown one, so a glide never uncovers a
 * gap; the SVG clips at the plot width. Keyed by scale: only a Follow pan
 * glides.
 */
export const Axis = memo(function Axis({
  base,
  follow,
  durationS,
  widthPx,
  pxPerS,
}: {
  base: TimeViewport
  follow: boolean
  durationS: number
  widthPx: number
  pxPerS: number
}) {
  const t0S = useShownT0(base, follow, durationS)
  // Three windows at three widths keep the pixel scale, so the tick step is the shown one.
  const padded = { t0S: t0S - base.winS, winS: 3 * base.winS }
  const ticks = viewportTicks(padded, 3 * widthPx).filter((t) => t >= 0 && t <= durationS)
  return (
    <div className="runtl-axis">
      <div className="runtl-axis-gutter">T+ from run start</div>
      <svg className="runtl-axis-svg" width={widthPx} height={AXIS_H} aria-hidden="true">
        <g
          key={pxPerS}
          style={{ transform: `translateX(${panPx(t0S, pxPerS)}px)`, transition: panGlide(follow) }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={t * pxPerS} x2={t * pxPerS} y1={0} y2={4} />
              <text x={t * pxPerS + 3} y={14}>
                {formatTime(t)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
})

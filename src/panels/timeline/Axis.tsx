import { memo } from 'react'
import { viewportTicks, xOf, type TimeViewport } from '../../charts/timeViewport'
import { formatTime } from '../../geometry/geo'
import { useShownT0 } from './useShownT0'

const AXIS_H = 20

/**
 * The fixed time axis over the rows. Ticks are absolute run times from
 * `viewportTicks`, so a pan never shifts a tick's time. With Follow on it
 * re-renders on each publication; it holds only the ticks.
 */
export const Axis = memo(function Axis({
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
  const shown = { t0S, winS: base.winS }
  const x = xOf(shown, widthPx)
  return (
    <div className="runtl-axis">
      <div className="runtl-axis-gutter">T+ from run start</div>
      <svg className="runtl-axis-svg" width={widthPx} height={AXIS_H} aria-hidden="true">
        {viewportTicks(shown, widthPx).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={4} />
            <text x={x(t) + 3} y={14}>
              {formatTime(t)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
})

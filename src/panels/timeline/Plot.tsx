import { memo, useId, type ReactNode } from 'react'
import { PUBLISH_PERIOD_MS } from '../../canvas/frameClock'
import type { TimeViewport } from '../../charts/timeViewport'
import { selectSimTimeS } from '../../state/selectors'
import { useStore } from '../../state/store'
import { LaneItems } from './LaneMarks'
import { panPx, type Placed } from './layout'
import { useShownT0 } from './useShownT0'

/** One publication period, linear, so the pan and the playhead move in step. */
const GLIDE = `transform ${PUBLISH_PERIOD_MS}ms linear`

/**
 * The playhead subscribes to the clock alone. It sits at the absolute run-time
 * x inside the pan wrapper; a linear transition over one publication period
 * carries it between publications.
 */
const Playhead = memo(function Playhead({ pxPerS }: { pxPerS: number }) {
  const t = useStore(selectSimTimeS)
  return (
    <div
      className="runtl-playhead"
      style={{ transform: `translateX(${Math.round(t * pxPerS)}px)`, transition: GLIDE }}
    />
  )
})

/**
 * The pan wrapper: the only plot element that re-renders on a Follow update.
 * Its children are created by Plot, so they keep their identity and skip.
 */
function Pan({
  base,
  follow,
  durationS,
  pxPerS,
  children,
}: {
  base: TimeViewport
  follow: boolean
  durationS: number
  pxPerS: number
  children: ReactNode
}) {
  const t0S = useShownT0(base, follow, durationS)
  return (
    <div
      className="runtl-pan"
      style={{ transform: `translateX(${panPx(t0S, pxPerS)}px)`, transition: GLIDE }}
    >
      {children}
    </div>
  )
}

/** Row grounds and separators; they span the plot and never pan. */
const Grounds = memo(function Grounds({ lines, widthPx }: { lines: Placed[]; widthPx: number }) {
  return (
    <>
      {lines.map((line) => (
        <g key={line.key}>
          {line.t === 'group' && (
            <rect className="runtl-ground-group" x={0} y={line.y} width={widthPx} height={line.h} />
          )}
          <line
            className="runtl-rule"
            x1={0}
            x2={widthPx}
            y1={line.y + line.h - 0.5}
            y2={line.y + line.h - 0.5}
          />
        </g>
      ))}
    </>
  )
})

/** Every line's items; a summary or a fold draws its members at reduced opacity. */
const Rows = memo(function Rows({
  lines,
  pxPerS,
  hatch,
}: {
  lines: Placed[]
  pxPerS: number
  hatch: string
}) {
  return (
    <>
      {lines.map((line) => {
        if (line.t === 'group') return null
        if (line.t === 'summary' || line.t === 'fold')
          return (
            <g key={line.key} className="runtl-summary">
              {line.rows.map((row) => (
                <LaneItems
                  key={row.key}
                  row={row}
                  y={line.y}
                  h={line.h}
                  pxPerS={pxPerS}
                  hatch={hatch}
                  summary
                />
              ))}
            </g>
          )
        return (
          <LaneItems
            key={line.key}
            row={line.row}
            y={line.y}
            h={line.h}
            pxPerS={pxPerS}
            hatch={hatch}
          />
        )
      })}
    </>
  )
})

/**
 * The plot column. Spans and marks draw at absolute run-time pixels
 * (`pxPerS = widthPx / winS`) and one wrapper pans them by `-t0S * pxPerS`, so
 * the rows re-render only on a scale, width, model or session change, never on
 * a clock publication. The plot clips at its edges. The unobserved region past
 * the horizon is shaded; the model already dropped every item there.
 */
export const Plot = memo(function Plot({
  lines,
  heightPx,
  widthPx,
  pxPerS,
  base,
  follow,
  durationS,
  horizonS,
}: {
  lines: Placed[]
  heightPx: number
  widthPx: number
  pxPerS: number
  base: TimeViewport
  follow: boolean
  durationS: number
  /** `model.horizonS`; -Infinity when nothing is observed. */
  horizonS: number
}) {
  const hatchId = `runtl-hatch${useId()}`
  const hatch = `url(#${hatchId})`
  const shadeS = Math.min(durationS, Math.max(0, horizonS))
  const shadeX = shadeS * pxPerS
  const shadeW = (durationS - shadeS) * pxPerS
  return (
    <div className="runtl-plot" style={{ height: heightPx }}>
      <svg className="runtl-grounds" width={widthPx} height={heightPx} aria-hidden="true">
        <Grounds lines={lines} widthPx={widthPx} />
      </svg>
      <Pan base={base} follow={follow} durationS={durationS} pxPerS={pxPerS}>
        <svg className="runtl-svg" width={widthPx} height={heightPx} aria-hidden="true">
          <defs>
            <pattern
              id={hatchId}
              width={4}
              height={4}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width={1.5} height={4} fill="var(--warn)" />
            </pattern>
          </defs>
          {shadeW > 0 && (
            <g className="runtl-unobserved">
              <rect x={shadeX} y={0} width={shadeW} height={heightPx} />
              <line x1={shadeX} x2={shadeX} y1={0} y2={heightPx} />
            </g>
          )}
          <Rows lines={lines} pxPerS={pxPerS} hatch={hatch} />
        </svg>
        <Playhead pxPerS={pxPerS} />
      </Pan>
    </div>
  )
})

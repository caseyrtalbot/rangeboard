import { memo, useId, useRef, type ReactNode, type Ref } from 'react'
import type { TimeViewport } from '../../charts/timeViewport'
import { selectSimTimeS } from '../../state/selectors'
import { useStore } from '../../state/store'
import { hitAt, type RunTimelineHit } from './hit'
import { LaneItems } from './LaneMarks'
import { panPx, playheadX, type Placed } from './layout'
import { GLIDE, panGlide, useShownT0 } from './useShownT0'

/**
 * The playhead subscribes to the clock alone. It sits at the absolute run-time
 * x inside the pan wrapper; a linear transition over one publication period
 * carries it between publications.
 */
const Playhead = memo(function Playhead({
  pxPerS,
  durationS,
}: {
  pxPerS: number
  durationS: number
}) {
  const t = useStore(selectSimTimeS)
  return (
    <div
      className="runtl-playhead"
      style={{ transform: `translateX(${playheadX(t, durationS, pxPerS)}px)`, transition: GLIDE }}
    />
  )
})

/**
 * The pan wrapper: the only plot element that re-renders on a Follow update.
 * Its children are created by Plot, so they keep their identity and skip.
 * Plot keys it by scale, so a width or zoom change does not glide. Plot reads
 * its on-screen box through `panRef` to map a pointer to a run time.
 */
function Pan({
  base,
  follow,
  durationS,
  pxPerS,
  panRef,
  children,
}: {
  base: TimeViewport
  follow: boolean
  durationS: number
  pxPerS: number
  panRef: Ref<HTMLDivElement>
  children: ReactNode
}) {
  const t0S = useShownT0(base, follow, durationS)
  return (
    <div
      ref={panRef}
      className="runtl-pan"
      style={{ transform: `translateX(${panPx(t0S, pxPerS)}px)`, transition: panGlide(follow) }}
    >
      {children}
    </div>
  )
}

/** Row grounds and separators; they span the plot and never pan. */
const Grounds = memo(function Grounds({
  lines,
  widthPx,
  selected,
}: {
  lines: Placed[]
  widthPx: number
  selected: ReadonlySet<string>
}) {
  return (
    <>
      {lines.map((line) => (
        <g key={line.key}>
          {line.t === 'group' && (
            <rect className="runtl-ground-group" x={0} y={line.y} width={widthPx} height={line.h} />
          )}
          {selected.has(line.key) && (
            <rect
              className="runtl-ground-selected"
              x={0}
              y={line.y}
              width={widthPx}
              height={line.h}
            />
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
 * the horizon is shaded; the model already dropped every item there. Pointer
 * events resolve to a model item with `hitAt`; RunTimeline acts on them.
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
  selected,
  onItemClick,
  onItemHover,
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
  /** Line keys the board selection highlights. */
  selected: ReadonlySet<string>
  /** A click on a mark or a span. */
  onItemClick: (hit: RunTimelineHit) => void
  /** The item under the pointer on each move; null over empty plot and on leave. */
  onItemHover: (hit: RunTimelineHit | null, clientX: number, clientY: number) => void
}) {
  const panRef = useRef<HTMLDivElement | null>(null)
  // The pan box is read at event time, so a Follow glide in progress adds no offset.
  const hitOf = (clientX: number, clientY: number, plot: HTMLElement): RunTimelineHit | null => {
    const pan = panRef.current
    if (!pan || !(pxPerS > 0)) return null
    const tS = (clientX - pan.getBoundingClientRect().left) / pxPerS
    return hitAt(lines, tS, clientY - plot.getBoundingClientRect().top, pxPerS)
  }
  const hatchId = `runtl-hatch${useId()}`
  const hatch = `url(#${hatchId})`
  const shadeS = Math.min(durationS, Math.max(0, horizonS))
  const shadeX = shadeS * pxPerS
  const shadeW = (durationS - shadeS) * pxPerS
  return (
    <div
      className="runtl-plot"
      style={{ height: heightPx }}
      onClick={(e) => {
        const hit = hitOf(e.clientX, e.clientY, e.currentTarget)
        if (hit) onItemClick(hit)
      }}
      onPointerMove={(e) => {
        const hit = hitOf(e.clientX, e.clientY, e.currentTarget)
        // Drives the pointer cursor over a mark without a render.
        e.currentTarget.dataset.hit = hit ? hit.t : ''
        onItemHover(hit, e.clientX, e.clientY)
      }}
      onPointerLeave={(e) => {
        e.currentTarget.dataset.hit = ''
        onItemHover(null, e.clientX, e.clientY)
      }}
    >
      <svg className="runtl-grounds" width={widthPx} height={heightPx} aria-hidden="true">
        <Grounds lines={lines} widthPx={widthPx} selected={selected} />
      </svg>
      <Pan
        key={pxPerS}
        base={base}
        follow={follow}
        durationS={durationS}
        pxPerS={pxPerS}
        panRef={panRef}
      >
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
        <Playhead pxPerS={pxPerS} durationS={durationS} />
      </Pan>
    </div>
  )
})

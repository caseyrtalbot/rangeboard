import { selectEffectiveLayers } from '../../state/selectors'
import { Group, Line, Text } from 'react-konva'
import type { Boundary, BoundaryType } from '../../model/types'
import { useStore } from '../../state/store'
import { DANGER_INK, KIND_INK, withAlpha } from '../../ui/ink'
import { phaseLineLabel } from '../../model/phaseLine'

const STYLE: Record<BoundaryType, { stroke: string; dash: number[]; fill: string }> = {
  range: { stroke: '#7f9a86', dash: [10, 6], fill: 'rgba(127,154,134,0.06)' },
  restricted: { stroke: DANGER_INK, dash: [4, 4], fill: withAlpha(DANGER_INK, 0.09) },
  asset: { stroke: '#8fae7a', dash: [], fill: 'rgba(143,174,122,0.10)' },
  corridor: { stroke: '#7da7c4', dash: [14, 6], fill: 'rgba(125,167,196,0.06)' },
  // A control measure is a line, never an area: solid amber, no fill.
  'phase-line': { stroke: KIND_INK.effector, dash: [], fill: '' },
}

function BoundaryShape({ boundary }: { boundary: Boundary }) {
  const select = useStore((s) => s.select)
  const selected = useStore((s) => s.selection.boundaryId === boundary.id)
  const basemap = useStore((s) => s.ui.basemap)
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  const tool = useStore((s) => s.ui.tool)
  const style = STYLE[boundary.type]
  const flat = boundary.points.flatMap((p) => [p.x, p.y])
  const airspace = basemap === 'airspace'
  const phaseLine = boundary.type === 'phase-line'
  const closed = boundary.closed && !phaseLine
  const label = phaseLine
    ? phaseLineLabel(boundary)
    : airspace && boundary.altBandFt
      ? `${boundary.name}  ${boundary.altBandFt[0]}-${boundary.altBandFt[1]} ft`
      : boundary.name
  // A phase line reads at both ends; an area keeps one label at its first vertex.
  const anchors = phaseLine
    ? [boundary.points[0], boundary.points[boundary.points.length - 1]]
    : [boundary.points[0]]

  return (
    <Group>
      <Line
        points={flat}
        closed={closed}
        stroke={selected ? '#ffffff' : style.stroke}
        strokeWidth={airspace ? 2.5 : 1.5}
        dash={style.dash}
        strokeScaleEnabled={false}
        fill={closed ? style.fill : undefined}
        // With strokeScaleEnabled=false the hit stroke is in screen px;
        // dividing by scale would inflate it to hundreds of px.
        hitStrokeWidth={12}
        // Filled polygons and wide hit bands must not swallow clicks while drawing.
        listening={tool === 'select'}
        onClick={(e) => {
          e.cancelBubble = true
          select({ boundaryId: boundary.id })
        }}
      />
      {/* Counter-scaled group, so the label font size never changes and Konva
          never re-measures the text on a zoom step. */}
      {anchors.map((p, i) => (
        <Group key={i} x={p.x} y={p.y} scaleX={1 / k} scaleY={1 / k} listening={false}>
          <Text
            fontFamily="JetBrains Mono"
            text={label}
            fontSize={12}
            fill={style.stroke}
            listening={false}
          />
        </Group>
      ))}
    </Group>
  )
}

export function BoundaryLayer() {
  const boundaries = useStore((s) => s.scenario.boundaries)
  const show = useStore((s) => selectEffectiveLayers(s).boundaries)
  if (!show) return null
  return (
    <>
      {boundaries.map((b) => (
        <BoundaryShape key={b.id} boundary={b} />
      ))}
    </>
  )
}

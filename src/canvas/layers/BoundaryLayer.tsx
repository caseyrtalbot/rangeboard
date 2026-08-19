import { Group, Line, Text } from 'react-konva'
import type { Boundary, BoundaryType } from '../../model/types'
import { useStore } from '../../state/store'

const STYLE: Record<BoundaryType, { stroke: string; dash: number[]; fill: string }> = {
  range: { stroke: '#7f9a86', dash: [10, 6], fill: 'rgba(127,154,134,0.06)' },
  restricted: { stroke: '#c4564a', dash: [4, 4], fill: 'rgba(196,86,74,0.09)' },
  asset: { stroke: '#8fae7a', dash: [], fill: 'rgba(143,174,122,0.10)' },
  corridor: { stroke: '#7da7c4', dash: [14, 6], fill: 'rgba(125,167,196,0.06)' },
}

function BoundaryShape({ boundary }: { boundary: Boundary }) {
  const select = useStore((s) => s.select)
  const selected = useStore((s) => s.selection.boundaryId === boundary.id)
  const basemap = useStore((s) => s.ui.basemap)
  const camera = useStore((s) => s.camera)
  const tool = useStore((s) => s.ui.tool)
  const style = STYLE[boundary.type]
  const flat = boundary.points.flatMap((p) => [p.x, p.y])
  const airspace = basemap === 'airspace'
  const label =
    airspace && boundary.altBandFt
      ? `${boundary.name}  ${boundary.altBandFt[0]}-${boundary.altBandFt[1]} ft`
      : boundary.name

  return (
    <Group>
      <Line
        points={flat}
        closed={boundary.closed}
        stroke={selected ? '#ffffff' : style.stroke}
        strokeWidth={airspace ? 2.5 : 1.5}
        dash={style.dash}
        strokeScaleEnabled={false}
        fill={boundary.closed ? style.fill : undefined}
        hitStrokeWidth={12 / camera.scale}
        // Filled polygons and wide hit bands must not swallow clicks while drawing.
        listening={tool === 'select'}
        onClick={(e) => {
          e.cancelBubble = true
          select({ boundaryId: boundary.id })
        }}
      />
      <Text fontFamily="IBM Plex Mono"
        x={boundary.points[0].x}
        y={boundary.points[0].y}
        text={label}
        fontSize={12 / camera.scale}
        fill={style.stroke}
        listening={false}
      />
    </Group>
  )
}

export function BoundaryLayer() {
  const boundaries = useStore((s) => s.scenario.boundaries)
  return (
    <>
      {boundaries.map((b) => (
        <BoundaryShape key={b.id} boundary={b} />
      ))}
    </>
  )
}

import { Group, Line, Text } from 'react-konva'
import type { Boundary, BoundaryType } from '../../model/types'
import { useStore } from '../../state/store'

const STYLE: Record<BoundaryType, { stroke: string; dash: number[]; fill: string }> = {
  range: { stroke: '#9ad0a0', dash: [10, 6], fill: 'rgba(154,208,160,0.05)' },
  restricted: { stroke: '#ff5c5c', dash: [4, 4], fill: 'rgba(255,92,92,0.08)' },
  asset: { stroke: '#7dff8a', dash: [], fill: 'rgba(125,255,138,0.08)' },
  corridor: { stroke: '#6fd3ff', dash: [14, 6], fill: 'rgba(111,211,255,0.05)' },
}

function BoundaryShape({ boundary }: { boundary: Boundary }) {
  const select = useStore((s) => s.select)
  const selected = useStore((s) => s.selection.boundaryId === boundary.id)
  const basemap = useStore((s) => s.ui.basemap)
  const camera = useStore((s) => s.camera)
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
        onClick={(e) => {
          e.cancelBubble = true
          select({ boundaryId: boundary.id })
        }}
      />
      <Text
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

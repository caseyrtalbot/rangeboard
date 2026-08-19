import { Line } from 'react-konva'
import { useStore } from '../../state/store'
import { gridStepM } from '../../geometry/geo'

interface Props {
  size: { w: number; h: number }
}

/** Adaptive world grid. Hidden in sat mode when an image is loaded. */
export function GridLayer({ size }: Props) {
  const camera = useStore((s) => s.camera)
  const basemap = useStore((s) => s.ui.basemap)
  const hasImage = useStore((s) => Boolean(s.scenario.underlay.dataUrl))

  if (basemap === 'sat' && hasImage) return null

  const step = gridStepM(camera.scale)
  const left = -camera.x / camera.scale
  const top = -camera.y / camera.scale
  const right = left + size.w / camera.scale
  const bottom = top + size.h / camera.scale

  const stroke = basemap === 'airspace' ? '#232729' : '#26292c'
  const major = basemap === 'airspace' ? '#2e3336' : '#323639'

  const lines = []
  for (let x = Math.floor(left / step) * step; x <= right; x += step) {
    const isMajor = Math.round(x / step) % 5 === 0
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, top, x, bottom]}
        stroke={isMajor ? major : stroke}
        strokeWidth={1}
        strokeScaleEnabled={false}
        listening={false}
      />,
    )
  }
  for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
    const isMajor = Math.round(y / step) % 5 === 0
    lines.push(
      <Line
        key={`h${y}`}
        points={[left, y, right, y]}
        stroke={isMajor ? major : stroke}
        strokeWidth={1}
        strokeScaleEnabled={false}
        listening={false}
      />,
    )
  }
  return <>{lines}</>
}

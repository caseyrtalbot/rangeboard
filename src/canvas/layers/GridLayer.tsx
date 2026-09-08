import { selectEffectiveLayers } from '../../state/selectors'
import { memo } from 'react'
import { Line } from 'react-konva'
import { useStore } from '../../state/store'
import { gridStepM } from '../../geometry/geo'

interface Props {
  size: { w: number; h: number }
}

/** Adaptive world grid. Hidden in sat mode when an image or geo reference is set. */
export const GridLayer = memo(function GridLayer({ size }: Props) {
  const camera = useStore((s) => s.camera)
  const units = useStore((s) => s.ui.units)
  const basemap = useStore((s) => s.ui.basemap)
  const show = useStore((s) => selectEffectiveLayers(s).grid)
  const hasImage = useStore((s) => Boolean(s.scenario.underlay.dataUrl))
  const hasGeoRef = useStore((s) => Boolean(s.scenario.geoRef))

  if (!show) return null
  if (basemap === 'sat' && (hasImage || hasGeoRef)) return null

  const step = gridStepM(camera.scale, 90, units)
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
})

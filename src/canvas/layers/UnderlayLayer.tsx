import { useEffect, useState } from 'react'
import { Image as KonvaImage } from 'react-konva'
import { useStore } from '../../state/store'

/** Calibrated satellite/range image. Visible in sat mode only. */
export function UnderlayLayer() {
  const underlay = useStore((s) => s.scenario.underlay)
  const basemap = useStore((s) => s.ui.basemap)
  const moveUnderlay = useStore((s) => s.ui.moveUnderlay)
  const updateUnderlay = useStore((s) => s.updateUnderlay)
  const [img, setImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!underlay.dataUrl) {
      setImg(null)
      return
    }
    const el = new Image()
    el.onload = () => setImg(el)
    el.src = underlay.dataUrl
  }, [underlay.dataUrl])

  if (basemap !== 'sat' || !img || underlay.naturalW === 0) return null

  const heightM = underlay.widthM * (underlay.naturalH / underlay.naturalW)

  return (
    <KonvaImage
      image={img}
      x={underlay.pos.x}
      y={underlay.pos.y}
      width={underlay.widthM}
      height={heightM}
      opacity={underlay.opacity}
      draggable={moveUnderlay}
      listening={moveUnderlay}
      stroke={moveUnderlay ? '#a9b4bd' : undefined}
      strokeWidth={2}
      strokeScaleEnabled={false}
      onDragEnd={(e) => updateUnderlay({ pos: { x: e.target.x(), y: e.target.y() } })}
    />
  )
}

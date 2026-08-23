import { useEffect, useState } from 'react'
import { Image as KonvaImage } from 'react-konva'
import { useStore } from '../../state/store'
import {
  lonLatToWorld,
  pickZoom,
  tileIndex,
  tileToLonLat,
  tileWorldSizeM,
  worldToMerc,
} from '../../geometry/webmerc'

interface Props {
  size: { w: number; h: number }
}

const MAX_TILES = 48
const CACHE_CAP = 384
const MIN_Z = 2

const ERROR_RETRY_MS = 15000

const cache = new Map<string, HTMLImageElement | { retryAt: number }>()
let notifyLoaded: (() => void) | null = null

/** Cached tile image, or null while loading / after a recent failed fetch. */
function tileImage(z: number, x: number, y: number): HTMLImageElement | null {
  const key = `${z}/${x}/${y}`
  const hit = cache.get(key)
  if (hit instanceof window.Image) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.complete && hit.naturalWidth > 0 ? hit : null
  }
  if (hit && Date.now() < hit.retryAt) return null
  while (cache.size >= CACHE_CAP) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  const img = new window.Image()
  // Anonymous CORS keeps stage.toDataURL (board frame capture) untainted.
  img.crossOrigin = 'anonymous'
  img.onload = () => notifyLoaded?.()
  img.onerror = () => cache.set(key, { retryAt: Date.now() + ERROR_RETRY_MS })
  img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
  cache.set(key, img)
  return null
}

/** Esri World Imagery tiles anchored at the scenario geo reference. Sat mode only. */
export function TileLayer({ size }: Props) {
  const camera = useStore((s) => s.camera)
  const basemap = useStore((s) => s.ui.basemap)
  const geoRef = useStore((s) => s.scenario.geoRef)
  const opacity = useStore((s) => s.scenario.underlay.opacity)
  const [, setLoaded] = useState(0)

  useEffect(() => {
    notifyLoaded = () => setLoaded((n) => n + 1)
    return () => {
      notifyLoaded = null
    }
  }, [])

  if (basemap !== 'sat' || !geoRef) return null

  const left = -camera.x / camera.scale
  const top = -camera.y / camera.scale
  const right = left + size.w / camera.scale
  const bottom = top + size.h / camera.scale

  let z = pickZoom(geoRef.lat, camera.scale)
  let x0 = 0
  let x1 = 0
  let y0 = 0
  let y1 = 0
  for (;;) {
    const a = worldToMerc(geoRef, left, top)
    const b = worldToMerc(geoRef, right, bottom)
    const ta = tileIndex(z, a.mx, a.my)
    const tb = tileIndex(z, b.mx, b.my)
    x0 = ta.tx
    y0 = ta.ty
    x1 = tb.tx
    y1 = tb.ty
    if ((x1 - x0 + 1) * (y1 - y0 + 1) <= MAX_TILES || z <= MIN_Z) break
    z -= 1
  }

  const tileM = tileWorldSizeM(z, geoRef.lat)
  const tiles = []
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const img = tileImage(z, tx, ty)
      if (!img) continue
      const corner = tileToLonLat(z, tx, ty)
      const pos = lonLatToWorld(geoRef, corner.lon, corner.lat)
      tiles.push(
        <KonvaImage
          key={`${z}/${tx}/${ty}`}
          image={img}
          x={pos.x}
          y={pos.y}
          width={tileM}
          height={tileM}
          opacity={opacity}
          listening={false}
        />,
      )
    }
  }
  return <>{tiles}</>
}

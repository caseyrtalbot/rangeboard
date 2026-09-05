import type { Vec2 } from '../model/types'
import type { Camera } from './store'

/** Camera scale bounds, pixels per meter (mirrors CanvasStage zoom limits). */
const FIT_MIN_SCALE = 0.0005
const FIT_MAX_SCALE = 20

/**
 * Camera that fits the given world points in the canvas viewport. Reads the
 * mounted canvas host for its pixel size and falls back to a representative
 * viewport when none is mounted (tests, T&E workspace).
 */
export function fitCameraTo(points: Vec2[]): Camera | null {
  if (points.length === 0) return null
  let vw = 1000
  let vh = 700
  if (typeof document !== 'undefined') {
    const host = document.querySelector('[data-testid="canvas-host"]')
    if (host instanceof HTMLElement && host.clientWidth > 50 && host.clientHeight > 50) {
      vw = host.clientWidth
      vh = host.clientHeight
    }
  }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  // 15% margin around the raid extent.
  const w = Math.max(1, (maxX - minX) * 1.15)
  const h = Math.max(1, (maxY - minY) * 1.15)
  const scale = Math.min(FIT_MAX_SCALE, Math.max(FIT_MIN_SCALE, Math.min(vw / w, vh / h)))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return { scale, x: vw / 2 - cx * scale, y: vh / 2 - cy * scale }
}

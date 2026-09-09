/**
 * Board frame download. The canvas registers its Konva stage here while it is
 * mounted; a download renders the stage to a PNG at up to 1600 px wide.
 */

import type Konva from 'konva'

let stage: Konva.Stage | null = null

export function registerStage(s: Konva.Stage | null): void {
  stage = s
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'rangeboard-frame'
}

/** Download the current board canvas as a PNG. False when no stage is mounted. */
export function downloadBoardFrame(name: string): boolean {
  if (!stage) return false
  const pixelRatio = Math.min(2, 1600 / Math.max(1, stage.width()))
  const a = document.createElement('a')
  a.href = stage.toDataURL({ pixelRatio })
  a.download = `${safeName(name)}.png`
  a.click()
  return true
}

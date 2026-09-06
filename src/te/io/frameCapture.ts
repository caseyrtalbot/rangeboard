/**
 * Board frame capture for the T&E plane. The canvas registers its Konva stage
 * here; capture runs from the Board workspace (the stage must be mounted) and
 * stores a PNG into the active campaign's frame library.
 */

import type Konva from 'konva'
import { useTeStore } from '../state/teStore'
import { useStore } from '../../state/store'
import { newId } from '../../model/types'
import { nowIso } from '../model/empty'

let stage: Konva.Stage | null = null

export function registerStage(s: Konva.Stage | null): void {
  stage = s
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'rangeboard-frame'
}

/** Download the current board canvas as a PNG without requiring a campaign. */
export function downloadBoardFrame(name: string): boolean {
  if (!stage) return false
  const pixelRatio = Math.min(2, 1600 / Math.max(1, stage.width()))
  const a = document.createElement('a')
  a.href = stage.toDataURL({ pixelRatio })
  a.download = `${safeName(name)}.png`
  a.click()
  return true
}

/**
 * Capture the current board view as a PNG frame on the active campaign.
 * Returns the frame id, or null when no stage or campaign is available.
 */
export function captureFrameToCampaign(name: string): string | null {
  const te = useTeStore.getState()
  if (!stage || !te.activeCampaignId) return null
  const pixelRatio = Math.min(2, 1600 / Math.max(1, stage.width()))
  const pngDataUrl = stage.toDataURL({ pixelRatio })
  const id = newId('tefrm')
  te.addItem('frames', {
    id,
    name: name || `Frame ${nowIso().slice(0, 16).replace('T', ' ')}`,
    pngDataUrl,
    capturedAt: nowIso(),
    simTimeS: useStore.getState().playback.simTimeS,
    note: '',
  })
  return id
}

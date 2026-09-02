import type { TeCampaign, TeState } from '../model/types'
import { emptyCampaign, emptyPackage } from '../model/empty'
import { useTeStore } from '../state/teStore'
import { notifyRecovery, stashUnreadableSave } from '../../io/recovery'
import { TE_KEY, TE_RECOVERY_PREFIX } from '../../io/storageKeys'

/**
 * Fill fields added after a save was written so old campaigns round-trip.
 * Deep-fills only `charter`, `decision`, and `evidencePackage`; top-level
 * optional fields (presetKey, sourceCampaignId) get defaults from the spread.
 * Record arrays (measures, threats, cards, ...) are NOT deep-filled. Do not
 * add new per-record fields; if one ever becomes necessary, read it
 * defensively (`?? default`) at every use site or extend this function with
 * a per-record filler in the same change.
 */
export function fillCampaign(parsed: TeCampaign): TeCampaign {
  const empty = emptyCampaign(parsed.name ?? 'Campaign', parsed.code ?? 'CAMP')
  return {
    ...empty,
    ...parsed,
    charter: { ...empty.charter, ...parsed.charter },
    decision: { ...empty.decision, ...parsed.decision },
    evidencePackage: parsed.evidencePackage?.sections?.length
      ? parsed.evidencePackage
      : emptyPackage(),
  }
}

/**
 * Parse a raw T&E autosave record. Throws on malformed JSON; returns null when
 * the record is not a schema-1 state. Exported for tests.
 */
export function parseTeAutosave(raw: string): TeState | null {
  const parsed = JSON.parse(raw) as TeState | null
  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.campaigns)) return null
  return {
    schemaVersion: 1,
    campaigns: parsed.campaigns.map(fillCampaign),
    activeCampaignId: parsed.activeCampaignId ?? null,
  }
}

/**
 * Load the T&E autosave. A record that exists but cannot be loaded is copied
 * to a recovery key before the autosave subscriber can overwrite it.
 */
export function loadTeAutosave(): TeState | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(TE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let state: TeState | null = null
  try {
    state = parseTeAutosave(raw)
  } catch {
    state = null
  }
  if (state) return state
  notifyRecovery('T&E campaigns', stashUnreadableSave(raw, TE_RECOVERY_PREFIX))
  return null
}

/**
 * Subscribe the T&E store to localStorage autosave. Call once at startup.
 * Writes are debounced; a pending write is flushed synchronously when the tab
 * is hidden or unloaded so a close never loses the last edit.
 */
export function startTeAutosave(): void {
  const saved = loadTeAutosave()
  if (saved) useTeStore.getState().replaceState(saved)
  let timer: number | undefined
  let pending: TeState | null = null

  function flush(): void {
    window.clearTimeout(timer)
    timer = undefined
    const s = pending
    pending = null
    if (!s) return
    const store = useTeStore.getState()
    try {
      localStorage.setItem(TE_KEY, JSON.stringify(s))
      store.setSaveState(new Date().toISOString(), null)
    } catch {
      // Storage full (frame captures): skip autosave, export still works.
      store.setSaveState(store.lastSavedAt, 'Not saved: storage full. Export the campaign.')
    }
  }

  useTeStore.subscribe((state, prev) => {
    if (state.campaigns === prev.campaigns && state.activeCampaignId === prev.activeCampaignId)
      return
    pending = {
      schemaVersion: 1,
      campaigns: state.campaigns,
      activeCampaignId: state.activeCampaignId,
    }
    window.clearTimeout(timer)
    timer = window.setTimeout(flush, 500)
  })
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}


function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'campaign'
}

export function exportCampaignJson(c: TeCampaign): void {
  const blob = new Blob(
    [JSON.stringify({ rangeboardCampaign: 1, campaign: c }, null, 2)],
    { type: 'application/json' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName(c.name)}.te.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importCampaignFile(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    file
      .text()
      .then((text) => {
        const d = JSON.parse(text) as { rangeboardCampaign?: number; campaign?: TeCampaign }
        if (d?.rangeboardCampaign !== 1 || !d.campaign) {
          window.alert('That file is not a RangeBoard campaign.')
          return
        }
        useTeStore.getState().loadCampaign(fillCampaign(d.campaign))
      })
      .catch(() => window.alert('Could not read that file as JSON.'))
  }
  input.click()
}

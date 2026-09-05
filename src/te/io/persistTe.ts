import type { TeCampaign, TeState } from '../model/types'
import { deliveryBlockers } from '../validate'
import { emptyCampaign, emptyPackage } from '../model/empty'
import { useTeStore } from '../state/teStore'
import { allowAutosave, assertAutosaveAllowed, blockAutosave, notifyRecovery, recoverUnreadableSave } from '../../io/recovery'
import { idsOf, invalid, objectAt, reference, validateShape } from '../../io/runtimeValidation'
import { validateCampaignReferences, validateCampaignShape } from './validateTe'
import { parseAutosave } from '../../io/persist'
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
  validateCampaignShape(parsed)
  const empty = emptyCampaign(parsed.name ?? 'Campaign', parsed.code ?? 'CAMP')
  const filled: TeCampaign = {
    ...empty,
    ...parsed,
    charter: { ...empty.charter, ...parsed.charter },
    decision: { ...empty.decision, ...parsed.decision },
    evidencePackage: parsed.evidencePackage ?? emptyPackage(),
  }
  validateCampaignReferences(filled)
  if (filled.evidencePackage.deliveredAt) {
    const blockers = deliveryBlockers(filled)
    if (blockers.length) invalid('campaign.evidencePackage.deliveredAt', blockers.join(' '))
  }
  filled.configs.forEach((config, i) => {
    if (config.scenarioSnapshot !== null) {
      try { parseAutosave(config.scenarioSnapshot) } catch (error) { invalid(`campaign.configs[${i}].scenarioSnapshot`, (error as Error).message) }
    }
  })
  return filled
}

/**
 * Parse a raw T&E autosave record. Throws a path/reason on invalid JSON or
 * runtime shape; only a validated, default-filled schema-1 state is returned.
 */
export function parseTeAutosave(raw: string): TeState {
  return parseTeStateData(JSON.parse(raw))
}

export function parseTeStateData(value: unknown): TeState {
  validateShape(value, 'TeState', 'te', true)
  const parsed = value as TeState
  const campaignIds = idsOf(parsed.campaigns, 'te.campaigns')
  reference(parsed.activeCampaignId, campaignIds, 'te.activeCampaignId')
  return { ...parsed, campaigns: parsed.campaigns.map(fillCampaign), activeCampaignId: parsed.activeCampaignId ?? null }
}

export function parseCampaignData(value: unknown): TeCampaign {
  const root = objectAt(value, 'campaignFile')
  if (root.rangeboardCampaign !== 1) invalid('campaignFile.rangeboardCampaign', 'expected 1')
  validateCampaignShape(root.campaign)
  return fillCampaign(root.campaign)
}

/** Protect the live record even if browser-storage access or recovery fails. */
export function loadTeAutosave(): TeState | null {
  let raw: string | null
  try { raw = localStorage.getItem(TE_KEY) } catch {
    blockAutosave(TE_KEY, 'Autosave paused: existing browser storage could not be read. Export current work and reload when storage is available.')
    const store = useTeStore.getState()
    store.setSaveState(store.lastSavedAt, 'Autosave paused: browser storage could not be read. Export current work and reload when storage is available.')
    return null
  }
  if (raw === null) { allowAutosave(TE_KEY); return null }
  try {
    const state = parseTeAutosave(raw)
    allowAutosave(TE_KEY)
    return state
  } catch (error) {
    notifyRecovery('T&E campaigns', recoverUnreadableSave(raw, TE_KEY, TE_RECOVERY_PREFIX), (error as Error).message)
    return null
  }
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
      assertAutosaveAllowed(TE_KEY)
      localStorage.setItem(TE_KEY, JSON.stringify(s))
      store.setSaveState(new Date().toISOString(), null)
    } catch (error) {
      store.setSaveState(store.lastSavedAt, `Not saved: ${error instanceof Error ? error.message.replace(/\.$/, '') : 'storage unavailable'}. Export the campaign.`)
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
        useTeStore.getState().loadCampaign(parseCampaignData(JSON.parse(text)))
      })
      .catch((error: unknown) => window.alert(`Could not import campaign: ${error instanceof Error ? error.message : 'unreadable JSON'}`))
  }
  input.click()
}

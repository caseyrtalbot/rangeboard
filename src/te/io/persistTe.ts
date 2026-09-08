import type { TeCampaign, TeState } from '../model/types'
import type { Scenario } from '../../model/types'
import { deliveryBlockers } from '../validate'
import { emptyCampaign, emptyPackage } from '../model/empty'
import { useTeStore } from '../state/teStore'
import type { AutosaveAdapter } from '../../io/autosave'
import { createAutosave } from '../../io/autosave'
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
  return filled
}

/**
 * Parse a configuration's stored Board snapshot. Called when a snapshot is opened,
 * never at load: validating every snapshot of every configuration on load costs one
 * full scenario parse, shape check and reference walk each, synchronously, before
 * first paint. The error carries the same path and reason the load path used.
 */
export function parseConfigSnapshot(snapshot: string, path: string): Scenario {
  try {
    return parseAutosave(snapshot)
  } catch (error) {
    invalid(path, (error as Error).message)
  }
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

/**
 * The T&E half of the autosave lifecycle in `io/autosave.ts`: the T&E key, the
 * T&E parser, the campaigns and active-id selection, adoption through
 * `replaceState` and the ISO save status. The restore is deferred, so the
 * lifecycle writes nothing until `restoreTeAutosave` has read the record back.
 */
export const teAutosaveAdapter: AutosaveAdapter<TeState> = {
  key: TE_KEY,
  recoveryPrefix: TE_RECOVERY_PREFIX,
  label: 'T&E campaigns',
  parse: parseTeAutosave,
  adopt: (state) => useTeStore.getState().replaceState(state),
  deferred: true,
  subscribe: (changed) =>
    useTeStore.subscribe((state, prev) => {
      if (state.campaigns === prev.campaigns && state.activeCampaignId === prev.activeCampaignId)
        return
      changed({
        schemaVersion: 1,
        campaigns: state.campaigns,
        activeCampaignId: state.activeCampaignId,
      })
    }),
  reportSaved: () => useTeStore.getState().setSaveState(new Date().toISOString(), null),
  reportPaused: (message) => {
    const store = useTeStore.getState()
    store.setSaveState(store.lastSavedAt, message)
  },
  reportWriteFailure: (error) => {
    const store = useTeStore.getState()
    const reason = error instanceof Error ? error.message.replace(/\.$/, '') : 'storage unavailable'
    store.setSaveState(store.lastSavedAt, `Not saved: ${reason}. Export the campaign.`)
  },
}

const teAutosave = createAutosave(teAutosaveAdapter)

/**
 * Read the saved T&E record back into the store. Runs at most once. Kept off the
 * first-paint path: the read parses a second JSON document, validates its shape and
 * walks every campaign reference. `startTeAutosave` writes nothing until this has run,
 * so an untouched store can never overwrite a saved record.
 */
export function restoreTeAutosave(): void {
  teAutosave.restore()
}

/**
 * Subscribe the T&E store to localStorage autosave. Call once at startup.
 * Writes are debounced; a pending write is flushed synchronously when the tab
 * is hidden or unloaded so a close never loses the last edit. Restoring the saved
 * record is `restoreTeAutosave`, scheduled separately.
 */
export function startTeAutosave(): void {
  teAutosave.observe()
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

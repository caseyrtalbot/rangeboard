import { describe, expect, it } from 'vitest'
import type { TeCampaign } from '../model/types'
import { emptyCampaign } from '../model/empty'
import { runtimeShapes } from '../../io/runtimeSchema'
import { CAMPAIGN_LEGACY_FIELDS, TE_STATE_LEGACY_FIELDS, teLegacyOmissions } from './compatTe'
import { fillCampaign, parseTeStateData } from './persistTe'

const base = JSON.stringify(emptyCampaign('Research', 'R'))
const save = (): Record<string, unknown> => JSON.parse(base) as Record<string, unknown>
const filled = (legacy: Record<string, unknown>): Record<string, unknown> =>
  fillCampaign(legacy as unknown as TeCampaign) as unknown as Record<string, unknown>

// The declaration is the one owner: an omission the validator accepts must have
// a fill, and a field fillCampaign supplies must be an accepted omission.
describe('T&E schema-1 compatibility ownership', () => {
  it('accepts exactly the omissions the declarations name', () => {
    expect(teLegacyOmissions.TeCampaign).toEqual(new Set(Object.keys(CAMPAIGN_LEGACY_FIELDS)))
    expect(teLegacyOmissions.TeState).toEqual(new Set(Object.keys(TE_STATE_LEGACY_FIELDS)))
    for (const [field, { shape }] of Object.entries(CAMPAIGN_LEGACY_FIELDS)) {
      if (shape) expect(teLegacyOmissions[shape], field).toBe('all')
    }
  })

  it('fills every accepted campaign omission', () => {
    const empty = save()
    for (const field of Object.keys(CAMPAIGN_LEGACY_FIELDS)) {
      const legacy = save()
      delete legacy[field]
      expect(filled(legacy)[field], field).toEqual(empty[field])
    }
  })

  it('fills every field a legacy container may omit', () => {
    const empty = save()
    for (const [field, { shape }] of Object.entries(CAMPAIGN_LEGACY_FIELDS)) {
      if (!shape) continue
      for (const key of Object.keys(runtimeShapes[shape].properties ?? {})) {
        const legacy = save()
        const container = { ...(legacy[field] as Record<string, unknown>) }
        delete container[key]
        legacy[field] = container
        const out = filled(legacy)[field] as Record<string, unknown>
        expect(out[key], `${field}.${key}`).toEqual((empty[field] as Record<string, unknown>)[key])
      }
    }
  })

  it('fills a missing campaign selection', () => {
    expect(Object.keys(TE_STATE_LEGACY_FIELDS)).toEqual(['activeCampaignId'])
    expect(parseTeStateData({ schemaVersion: 1, campaigns: [save()] }).activeCampaignId).toBeNull()
  })
})

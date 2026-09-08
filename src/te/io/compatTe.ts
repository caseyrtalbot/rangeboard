/**
 * T&E owner of the schema-1 compatibility declarations described in
 * `src/io/compat.ts`: every field a legacy campaign or T&E record may omit,
 * with the filler that supplies it. `runtimeValidation.ts` derives its accepted
 * omissions from here and `fillCampaign` / `parseTeStateData`
 * (`persistTe.ts`) derive their fills from the same entries.
 *
 * Defaults come from `emptyCampaign()` and `emptyPackage()` (`te/model/empty.ts`).
 * Record arrays (measures, threats, cards, ...) are not deep-filled, so they
 * carry no entry here.
 */

import type { LegacyFields, LegacyOmissions } from '../../io/compat'
import { legacyOmissions } from '../../io/compat'

/** Campaign fields a legacy save may omit. */
export const CAMPAIGN_LEGACY_FIELDS: LegacyFields = {
  charter: { fill: 'container', shape: 'CampaignCharter' },
  decision: { fill: 'container', shape: 'DecisionCharter' },
  evidencePackage: { fill: 'default' },
  frames: { fill: 'default' },
  illustrative: { fill: 'default' },
}

/** T&E record fields a legacy save may omit. `parseTeStateData` defaults a
 * missing campaign selection to null; the record has no empty factory to spread. */
export const TE_STATE_LEGACY_FIELDS: LegacyFields = {
  activeCampaignId: { fill: 'migrated' },
}

/** The T&E half of the validator's legacy-omission table. */
export const teLegacyOmissions: LegacyOmissions = {
  ...legacyOmissions('TeCampaign', CAMPAIGN_LEGACY_FIELDS),
  ...legacyOmissions('TeState', TE_STATE_LEGACY_FIELDS),
}

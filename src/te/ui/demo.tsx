import { buildJiatf401 } from '../seed/jiatf401'
import { useTeStore } from '../state/teStore'

/**
 * Load the JIATF-401 demo campaign. Every number in it is notional; the
 * campaign carries illustrative: true and renders a persistent banner.
 */
export function loadDemoCampaign(): void {
  useTeStore.getState().loadCampaign(buildJiatf401())
}

import type { BasemapMode, Connection, EntityKind, Scenario } from '../model/types'
import { newId } from '../model/types'
import { formatTime } from '../geometry/geo'
import type { SuggestedLink } from '../model/integration'

/** Display name per entity kind, for default entity and model names. */
export const KIND_NAMES: Record<EntityKind, string> = {
  sensor: 'Sensor',
  effector: 'Effector',
  c2: 'C2',
  uas: 'UAS',
  asset: 'Asset',
  marker: 'Marker',
}

/** Run label shown in the timeline and the debrief: RUN-0001. */
export function formatRunLabel(seq: number): string {
  return `RUN-${String(seq).padStart(4, '0')}`
}

/** Default kill-chain label from the endpoint kinds; empty when the pair implies none. */
export function defaultConnectionLabel(fromKind: EntityKind, toKind: EntityKind): string {
  if (fromKind === 'sensor' && toKind === 'c2') return 'track data'
  if (fromKind === 'c2' && toKind === 'effector') return 'engage order'
  if (fromKind === 'sensor' && toKind === 'effector') return 'direct cue'
  return ''
}

/** Typed connections for accepted or auto-applied suggestions; skips existing pairs. */
export function typedConnections(s: Scenario, links: SuggestedLink[]): Connection[] {
  const added: Connection[] = []
  for (const { fromId, toId, verdict } of links) {
    const dupe = (c: Connection) => c.fromId === fromId && c.toId === toId
    if (s.connections.some(dupe) || added.some(dupe)) continue
    added.push({
      id: newId('con'),
      fromId,
      toId,
      label: verdict.label,
      medium: verdict.medium,
      confidence: verdict.confidence,
      note: verdict.note,
      latencyS: verdict.latencyS,
    })
  }
  return added
}

/** Default frame name: scenario, sim time, and basemap. */
export function defaultFrameName(
  scenarioName: string,
  simTimeS: number,
  basemap: BasemapMode,
): string {
  return `${scenarioName} T+${formatTime(simTimeS)} ${basemap}`
}

/** Minor version bump: '1.0' -> '1.1'. Non-standard strings get a '.1' suffix. */
export function bumpCardVersion(v: string): string {
  const m = /^(\d+)\.(\d+)$/.exec(v.trim())
  if (m) return `${m[1]}.${Number(m[2]) + 1}`
  return `${v.trim() || '1'}.1`
}

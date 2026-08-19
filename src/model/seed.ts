import type { Scenario, Underlay } from './types'
import { SEED_LIBRARY } from './seedLibrary'
import { SEED_SYSTEMS } from './seedSystems'

export { SEED_LIBRARY } from './seedLibrary'
export { SEED_SYSTEMS, SEED_FORMATIONS } from './seedSystems'

export function emptyUnderlay(): Underlay {
  return { dataUrl: null, pos: { x: 0, y: 0 }, widthM: 10000, naturalW: 0, naturalH: 0, opacity: 0.85 }
}

export function emptyScenario(): Scenario {
  return {
    schemaVersion: 1,
    name: 'Untitled scenario',
    library: SEED_LIBRARY.map((m) => ({ ...m })),
    systemPresets: SEED_SYSTEMS.map((p) => ({ ...p })),
    entities: [],
    connections: [],
    boundaries: [],
    paths: [],
    testCards: [],
    frames: [],
    underlay: emptyUnderlay(),
  }
}

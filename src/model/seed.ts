import type { EnvironmentSpec, Scenario, Underlay } from './types'
import { SEED_LIBRARY } from './seedLibrary'
import { SEED_SYSTEMS } from './seedSystems'

export { SEED_LIBRARY } from './seedLibrary'
export { SEED_SYSTEMS, SEED_FORMATIONS } from './seedSystems'

/** Calm standard day: no wind, 15 C, low field elevation, clear daylight, rural EM. */
export function defaultEnvironment(): EnvironmentSpec {
  return {
    windSpeedMps: 0,
    windFromDeg: 270,
    temperatureC: 15,
    fieldElevationFt: 1000,
    precipitation: 'clear',
    light: 'day',
    emBackground: 'rural',
    apply: true,
  }
}

export function emptyUnderlay(): Underlay {
  return { dataUrl: null, pos: { x: 0, y: 0 }, widthM: 10000, naturalW: 0, naturalH: 0, opacity: 0.85 }
}

export function emptyScenario(): Scenario {
  return {
    schemaVersion: 1,
    name: 'Untitled scenario',
    library: SEED_LIBRARY.map((m) => ({ ...m })),
    systemPresets: SEED_SYSTEMS.map((p) => ({ ...p })),
    environment: defaultEnvironment(),
    engageOn: 'detected',
    mcdaWeights: { warning: 3, coverage: 3, confirm: 2, engage: 3, attrition: 3 },
    scorecards: [],
    entities: [],
    connections: [],
    boundaries: [],
    paths: [],
    testCards: [],
    frames: [],
    underlay: emptyUnderlay(),
  }
}

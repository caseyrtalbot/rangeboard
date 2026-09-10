import type { EnvironmentSpec, RequirementThresholds, Scenario, Underlay } from './types'
import {
  DEFAULT_FIRE_DOCTRINE,
  DEFAULT_REPLICATES,
  DEFAULT_REQUIREMENT_THRESHOLDS,
  DEFAULT_SAMPLING,
  DEFAULT_SEED,
  DEFAULT_TARGET_HALF_WIDTH,
} from './types'
import { initialLibrary, initialSystemPresets } from './libraryLifecycle'

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
    visibilityM: null,
    apply: true,
  }
}

/** Test-defined gate criteria for a new scenario. Never engine constants. */
function defaultRequirements(): RequirementThresholds {
  return { ...DEFAULT_REQUIREMENT_THRESHOLDS }
}

function emptyUnderlay(): Underlay {
  return { dataUrl: null, pos: { x: 0, y: 0 }, widthM: 10000, naturalW: 0, naturalH: 0, opacity: 0.85 }
}

export function emptyScenario(): Scenario {
  return {
    schemaVersion: 1,
    name: 'Untitled scenario',
    library: initialLibrary(),
    systemPresets: initialSystemPresets(),
    deletedSeedIds: [],
    observedPresetId: null,
    // A fresh scenario runs the real mode: Monte Carlo under total uncertainty,
    // LHS draws, stopping on half-width. An old save without these fields
    // still reads deterministic and aleatory through `runSettings`.
    runMode: 'monte-carlo',
    seed: DEFAULT_SEED,
    replicates: DEFAULT_REPLICATES,
    targetHalfWidth: DEFAULT_TARGET_HALF_WIDTH,
    uncertainty: 'total',
    sampling: DEFAULT_SAMPLING,
    environment: defaultEnvironment(),

    roe: 'tight',
    doctrine: { ...DEFAULT_FIRE_DOCTRINE },
    mcdaWeights: { warning: 3, coverage: 3, confirm: 2, engage: 3, attrition: 3 },
    scorecards: [],
    raid: { waves: [] },
    requirements: defaultRequirements(),
    entities: [],
    connections: [],
    boundaries: [],
    paths: [],
    testCards: [],
    frames: [],
    underlay: emptyUnderlay(),
    geoRef: null,
  }
}

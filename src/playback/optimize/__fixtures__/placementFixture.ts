import { emptyScenario } from '../../../model/seed'
import type { Entity, Scenario, SpecModel, Vec2 } from '../../../model/types'
import { DEFAULT_SEED, MOUNT_HEIGHT_M } from '../../../model/types'
import { FT_TO_M } from '../../../analysis/sensorEnv'
import type { OptimizeRequest } from '../../optimizeTypes'

/**
 * A placement fixture in the style of the mcRun hand-built laydown: a
 * planning-basis radar at the origin (no Pd draw), one interceptor with a
 * 1.5 km envelope, one round and Pk 0.6, and a group 4 fixed-wing target
 * flying east at 40 m/s along y = 0 from x = -6000 to a defended asset at
 * the origin (200 m boundary). The interceptor starts at (0, 5000), 5 km
 * off the path and outside its own envelope of every path point, so the
 * one ship always leaks; anywhere within 1.5 km of the path it takes its
 * one shot and the ship leaks with probability 1 - Pk.
 */
const FIXTURE_ALT_FT = MOUNT_HEIGHT_M / FT_TO_M

const RADAR: SpecModel = {
  id: 'tst-radar',
  name: 'test radar',
  kind: 'sensor',
  description: '',
  color: '#fff',
  builtin: false,
  sensor: {
    sensorType: 'radar',
    role: 'surveillance',
    rangeBasis: 'planning',
    detectRangeM: 50000,
    classifyRangeM: null,
    sectorDeg: 360,
  },
}

const TARGET: SpecModel = {
  id: 'tst-uas',
  name: 'test uas',
  kind: 'uas',
  description: '',
  color: '#fff',
  builtin: false,
  uas: {
    group: 4,
    airframe: 'fixed-wing',
    cruiseSpeedMps: 40,
    maxSpeedMps: 60,
    enduranceMin: 60,
    altBandFt: [0, 5000],
    navMode: 'rf-manual',
    emissionsNote: '',
  },
}

const INTERCEPTOR: SpecModel = {
  id: 'tst-int',
  name: 'tst-int',
  kind: 'effector',
  description: '',
  color: '#fff',
  builtin: false,
  effector: {
    effectorType: 'interceptor',
    minRangeM: 0,
    maxRangeM: 1500,
    engageTimeS: 0,
    magazineSize: 1,
    pk: 0.6,
  },
}

/** The movable effector's id. */
export const EFFECTOR_ID = 'eff'

/** Where the effector starts: 5 km off the path. */
export const START_POS: Vec2 = { x: 0, y: 5000 }

/** The range boundary: a box around the path and the start. */
export const RANGE_POINTS: Vec2[] = [
  { x: -7000, y: -3000 },
  { x: 1000, y: -3000 },
  { x: 1000, y: 6000 },
  { x: -7000, y: 6000 },
]

function ent(
  id: string,
  kind: Entity['kind'],
  specId: string | null,
  pos: Vec2,
  extra: Partial<Entity> = {},
): Entity {
  return { id, name: id, kind, specId, pos, headingDeg: 0, color: null, notes: '', ...extra }
}

/** The fixture scenario with the effector at `effectorPos`. */
export function placementScenario(effectorPos: Vec2 = START_POS): Scenario {
  const s = emptyScenario()
  s.runMode = 'deterministic'
  s.uncertainty = 'aleatory'
  s.targetHalfWidth = null
  s.roe = 'free'
  s.library = [...s.library, RADAR, TARGET, INTERCEPTOR]
  const from: Vec2 = { x: -6000, y: 0 }
  // Fixed ids: the draw keys hash the ids.
  s.entities = [
    ent('radar', 'sensor', RADAR.id, { x: 0, y: 0 }),
    ent(EFFECTOR_ID, 'effector', INTERCEPTOR.id, effectorPos),
    ent('uas', 'uas', TARGET.id, from, { altitudeFt: FIXTURE_ALT_FT }),
    ent('asset', 'asset', null, { x: 0, y: 0 }, { defendedRadiusM: 200 }),
  ]
  s.connections = [{ id: 'c1', fromId: 'radar', toId: EFFECTOR_ID, label: '' }]
  s.paths = [
    { id: 'p1', entityId: 'uas', points: [from, { x: 0, y: 0 }], speedMps: 40, startDelayS: 0 },
  ]
  return s
}

/** A request over the fixture: minimize leakers by moving the effector inside the range box. */
export function placementRequest(overrides: Partial<OptimizeRequest> = {}): OptimizeRequest {
  return {
    type: 'optimize',
    runId: 'optimize-fixed-run',
    scenario: placementScenario(),
    objective: { response: 'leakers', direction: 'minimize' },
    movableIds: [EFFECTOR_ID],
    bounds: { boundaryId: null, points: RANGE_POINTS },
    budget: { evaluations: 60, replicates: 40, seed: DEFAULT_SEED },
    ...overrides,
  }
}

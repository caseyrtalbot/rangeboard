/**
 * Fidelity tags.
 *
 * Every engine model carries one tag: how it is built (`tier`) and how far it is checked
 * (`validation`). A result then states which models produced it. `MODEL_TAGS` records what
 * is true today, not what is planned. `standard` quotes a row of the standards table in
 * `docs/ENGINEERING_REFERENCE.md`, section "Standards referenced by model tags", where a
 * published method applies.
 */
import type {
  Entity, EntityKind, Scenario, SensorSpec, SpecModel, UasSpec,
} from '../model/types'
import { effectiveDoctrine, entityActive, physicsSwitches, runSettings } from '../model/types'
import { expenditureChannel } from '../playback/pk'
import { scanPeriodS } from './doctrineFactors'
import { radarPdModeled } from './sensorEnv'

/** Every model the engine runs. */
export type ModelId =
  | 'radar-pd' | 'radar-scan' | 'eoir-range' | 'acoustic-range' | 'rf-detect' | 'jam'
  | 'environment' | 'horizon' | 'track-init' | 'doctrine' | 'kinetic-pk' | 'flyout'
  | 'draw-policy' | 'parameter-spread'
  | 'tracker' | 'fusion' | 'classification' | 'operator' | 'false-tracks'

/** How a model is built: a planning factor table, or a physical law. */
type FidelityTier = 'planning' | 'physics'

/** How far a model is checked: not at all, against math, against a datasheet, or in trial. */
type ValidationStatus = 'none' | 'analytic' | 'datasheet' | 'trial'

/** One model and its status. */
export interface ModelTag {
  id: ModelId
  label: string
  tier: FidelityTier
  validation: ValidationStatus
  /**
   * A row of docs/ENGINEERING_REFERENCE.md, section "Standards referenced by model tags",
   * where one applies.
   */
  standard?: string
  note: string
}

/** The one tag table. */
export const MODEL_TAGS: Record<ModelId, ModelTag> = {
  'radar-pd': {
    id: 'radar-pd',
    label: 'Radar Pd',
    tier: 'physics',
    validation: 'datasheet',
    standard: 'Radar: Swerling cases evaluated with Marcum-Q and Shnidman',
    note:
      'Closed-form Pd. Marcum-Q values are pinned in radarPd.test.ts. The range law is ' +
      'checked against the Blighter A400 series datasheet and the Echodyne EchoShield ' +
      'and EchoGuard sheets in validation.verify.test.ts.',
  },
  'radar-scan': {
    id: 'radar-scan',
    label: 'Radar scan',
    tier: 'physics',
    validation: 'analytic',
    standard: 'Statistical rigor in T&E',
    note: 'One draw per scan, M-of-N over scans, in closed form.',
  },
  'eoir-range': {
    id: 'eoir-range',
    label: 'EO/IR range',
    tier: 'planning',
    validation: 'none',
    standard: 'EO/IR: Johnson criteria retained as a legacy cross-check',
    note: 'Johnson criteria scale a placard range by target span. No sensor model behind it.',
  },
  'acoustic-range': {
    id: 'acoustic-range',
    label: 'Acoustic range',
    tier: 'planning',
    validation: 'none',
    standard: 'Acoustic: ISO 9613-2',
    note: 'Transmission loss solved from a placard range. No atmospheric absorption term.',
  },
  'rf-detect': {
    id: 'rf-detect',
    label: 'RF detect',
    tier: 'planning',
    validation: 'none',
    note: 'Band match and a placard range. The link budget is not modeled.',
  },
  jam: {
    id: 'jam',
    label: 'Jam',
    tier: 'planning',
    validation: 'none',
    note: 'Band, boresight and power-range gates. The jam-to-signal ratio is a planning factor.',
  },
  environment: {
    id: 'environment',
    label: 'Environment',
    tier: 'planning',
    validation: 'none',
    note: 'One multiplier per condition. No weather or terrain data.',
  },
  horizon: {
    id: 'horizon',
    label: 'Horizon',
    tier: 'physics',
    validation: 'analytic',
    note: 'The 4/3 earth radio horizon from mount height and target altitude.',
  },
  'track-init': {
    id: 'track-init',
    label: 'Track init',
    tier: 'planning',
    validation: 'none',
    note: 'A time by sensor role where no scan model applies.',
  },
  doctrine: {
    id: 'doctrine',
    label: 'Doctrine',
    tier: 'planning',
    validation: 'none',
    note: 'Gate, dwell and latency times per system. Every time is a planning factor.',
  },
  'kinetic-pk': {
    id: 'kinetic-pk',
    label: 'Kinetic Pk',
    tier: 'planning',
    validation: 'none',
    note: 'A base Pk with a distance falloff and size and evasion penalties.',
  },
  flyout: {
    id: 'flyout',
    label: 'Flyout',
    tier: 'physics',
    validation: 'analytic',
    note: 'Time of flight from a constant speed, with the intercept point solved by iteration.',
  },
  'draw-policy': {
    id: 'draw-policy',
    label: 'Draw policy',
    tier: 'physics',
    validation: 'analytic',
    standard: 'Statistical rigor in T&E',
    note: 'Keyed draws: every uniform hashes the seed, the replicate and its event key. The deterministic policy carries mass instead.',
  },
  'parameter-spread': {
    id: 'parameter-spread',
    label: 'Parameter spread',
    tier: 'planning',
    validation: 'none',
    note: 'Spread shapes and widths are planning factors until a trial count replaces them.',
  },
  tracker: {
    id: 'tracker',
    label: 'Tracker',
    tier: 'planning',
    validation: 'none',
    note: 'Track position is truth; a Kalman estimate arrives in Phase 2.',
  },
  fusion: {
    id: 'fusion',
    label: 'Fusion',
    tier: 'planning',
    validation: 'none',
    note: 'Two technologies held at once halve the declaration dwell.',
  },
  classification: {
    id: 'classification',
    label: 'Classification',
    tier: 'planning',
    validation: 'none',
    note: 'Rule ladder: speed, intent keyword, range factor.',
  },
  operator: {
    id: 'operator',
    label: 'Operator',
    tier: 'planning',
    validation: 'none',
    note: 'No operator queue; doctrine dwells only.',
  },
  'false-tracks': {
    id: 'false-tracks',
    label: 'False tracks',
    tier: 'planning',
    validation: 'none',
    note: 'None.',
  },
}

/** Model ids `modelsForEntity` reports, per entity kind. An asset carries none. */
const ENTITY_MODELS: Partial<Record<EntityKind, ModelId[]>> = {
  sensor: [
    'radar-pd', 'radar-scan', 'eoir-range', 'acoustic-range', 'rf-detect',
    'environment', 'horizon', 'track-init', 'tracker', 'false-tracks',
  ],
  effector: ['jam', 'doctrine', 'kinetic-pk', 'flyout'],
  uas: ['radar-pd', 'environment', 'kinetic-pk'],
  c2: ['doctrine', 'fusion', 'classification', 'operator'],
}

/** Tag order every reader gets: the order MODEL_TAGS declares. */
const MODEL_ORDER = Object.keys(MODEL_TAGS) as ModelId[]

/**
 * Specs of the active entities of one kind. `entityId` narrows the scan to
 * one entity; the spec resolves through the scenario library, as impact.ts
 * does, because this module must not import the store.
 */
function activeSpecs<T>(
  scenario: Scenario,
  kind: EntityKind,
  pick: (m: SpecModel) => T | undefined,
  entityId?: string,
): T[] {
  const out: T[] = []
  for (const e of scenario.entities) {
    if (e.kind !== kind || !entityActive(e)) continue
    if (entityId != null && e.id !== entityId) continue
    const model = scenario.library.find((m) => m.id === e.specId)
    const spec = model ? pick(model) : undefined
    if (spec != null) out.push(spec)
  }
  return out
}

/**
 * Scan period of one sensor against each active target. With no target the
 * sensor runs no Pd model, so it takes the one unmodeled look.
 */
function scanPeriods(spec: SensorSpec, targets: UasSpec[]): Array<number | null> {
  if (targets.length === 0) return [scanPeriodS(spec, false)]
  return targets.map((t) => scanPeriodS(spec, radarPdModeled(spec, t)))
}

/** Every model id the laydown exercises. `entity` narrows one side of each pair. */
function usedIds(scenario: Scenario, entity?: Entity): Set<ModelId> {
  const sensors = activeSpecs(
    scenario, 'sensor', (m) => m.sensor, entity?.kind === 'sensor' ? entity.id : undefined,
  )
  const effectors = activeSpecs(
    scenario, 'effector', (m) => m.effector, entity?.kind === 'effector' ? entity.id : undefined,
  )
  const targets = activeSpecs(
    scenario, 'uas', (m) => m.uas, entity?.kind === 'uas' ? entity.id : undefined,
  )
  // A c2 model may carry no spec; the entity counts through its kind alone.
  const c2Count = scenario.entities.filter(
    (e) => e.kind === 'c2' && entityActive(e) && (entity?.kind !== 'c2' || e.id === entity.id),
  ).length
  // The sensor count for fusion is the laydown's, so one sensor entity still reports fusion.
  const allSensors = entity?.kind === 'sensor' ? activeSpecs(scenario, 'sensor', (m) => m.sensor) : sensors
  const kinetic = effectors.filter((e) => expenditureChannel(e.effectorType) === 'kinetic')
  // The engine reads kineticPk for every non-jammer effector (DE and HPM
  // included); only the flyout term is confined to the kinetic channel.
  const aimed = effectors.filter((e) => e.effectorType !== 'jammer')
  const out = new Set<ModelId>()
  const add = (id: ModelId, when: boolean): void => {
    if (when) out.add(id)
  }
  add('radar-pd', sensors.some((s) => targets.some((t) => radarPdModeled(s, t))))
  add('radar-scan', sensors.some((s) => scanPeriods(s, targets).some((p) => p != null)))
  add('eoir-range', sensors.some((s) => s.sensorType === 'eo-ir'))
  add('acoustic-range', sensors.some((s) => s.sensorType === 'acoustic'))
  add('rf-detect', sensors.some((s) => s.sensorType === 'rf'))
  add('jam', effectors.some((e) => e.effectorType === 'jammer'))
  add('environment', scenario.environment.apply)
  // sensorGeometryGate answers before the horizon test for an acoustic sensor.
  add('horizon', sensors.some((s) => s.sensorType !== 'acoustic'))
  add('track-init', sensors.some((s) => scanPeriods(s, targets).every((p) => p == null)))
  add('doctrine', effectiveDoctrine(scenario).enabled)
  add('kinetic-pk', aimed.length > 0)
  add('flyout', kinetic.some((e) => (e.flyoutSpeedMps ?? 0) > 0))
  const run = runSettings(scenario)
  add('draw-policy', run.runMode === 'monte-carlo')
  add('parameter-spread', run.runMode === 'monte-carlo' && run.uncertainty === 'total')
  add('tracker', sensors.length > 0)
  add('fusion', allSensors.length >= 2)
  add('classification', effectiveDoctrine(scenario).enabled)
  add('operator', c2Count > 0)
  add(
    'false-tracks',
    !physicsSwitches(scenario).includes('noFalseTracks')
      && sensors.some((s) => s.sensorType === 'radar' && s.falseAlarmRatePerScan != null),
  )
  return out
}

/** The models a laydown exercises, in MODEL_TAGS order. Pure; reads the scenario only. */
export function modelsUsed(
  scenario: Scenario,
  table: Record<ModelId, ModelTag> = MODEL_TAGS,
): ModelTag[] {
  const ids = usedIds(scenario)
  return MODEL_ORDER.filter((id) => ids.has(id)).map((id) => table[id])
}

/** The models behind one entity, in MODEL_TAGS order; empty for an asset or an unknown id. */
export function modelsForEntity(
  scenario: Scenario,
  entityId: string,
  table: Record<ModelId, ModelTag> = MODEL_TAGS,
): ModelTag[] {
  const entity = scenario.entities.find((e) => e.id === entityId)
  if (!entity || !entityActive(entity)) return []
  const allowed = ENTITY_MODELS[entity.kind]
  if (!allowed) return []
  const ids = usedIds(scenario, entity)
  return MODEL_ORDER.filter((id) => allowed.includes(id) && ids.has(id)).map((id) => table[id])
}

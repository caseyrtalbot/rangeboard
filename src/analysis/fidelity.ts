/**
 * Fidelity tags.
 *
 * Every engine model carries one tag: how it is built (`tier`) and how far it is checked
 * (`validation`). A result then states which models produced it. `MODEL_TAGS` records what
 * is true today, not what is planned. `standard` quotes a row of the standards table in
 * `docs/engine-refactor/PLAN.md` section 12 where a published method applies.
 */

/** Every model the engine runs. */
export type ModelId =
  | 'radar-pd' | 'radar-scan' | 'eoir-range' | 'acoustic-range' | 'rf-detect' | 'jam'
  | 'environment' | 'horizon' | 'track-init' | 'doctrine' | 'kinetic-pk' | 'flyout'
  | 'draw-policy' | 'parameter-spread'

/** How a model is built: a planning factor table, or a physical law. */
export type FidelityTier = 'planning' | 'physics'

/** How far a model is checked: not at all, against math, against a datasheet, or in trial. */
export type ValidationStatus = 'none' | 'analytic' | 'datasheet' | 'trial'

/** One model and its status. */
export interface ModelTag {
  id: ModelId
  label: string
  tier: FidelityTier
  validation: ValidationStatus
  /** A row of docs/engine-refactor/PLAN.md section 12 where one applies. */
  standard?: string
  note: string
}

/** The one tag table. */
export const MODEL_TAGS: Record<ModelId, ModelTag> = {
  'radar-pd': {
    id: 'radar-pd',
    label: 'Radar Pd',
    tier: 'physics',
    validation: 'analytic',
    standard: 'Radar: Swerling cases evaluated with Marcum-Q and Shnidman',
    note: 'Closed-form Pd. The Marcum-Q values are pinned in radarPd.test.ts.',
  },
  'radar-scan': {
    id: 'radar-scan',
    label: 'Radar scan',
    tier: 'physics',
    validation: 'analytic',
    standard: 'Statistical rigor in T&E',
    note: 'One draw per scan, M-of-N over scans. The closed forms landed in wave 1 slice 1.',
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
    note: 'One seeded stream per replicate. The deterministic policy carries mass instead.',
  },
  'parameter-spread': {
    id: 'parameter-spread',
    label: 'Parameter spread',
    tier: 'planning',
    validation: 'none',
    note: 'Spread shapes and widths are planning factors until a trial count replaces them.',
  },
}

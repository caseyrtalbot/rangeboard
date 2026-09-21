/**
 * Schema-1 compatibility declarations: every field a legacy save may omit, with the
 * filler that supplies it. `runtimeValidation.ts` derives its omission sets from
 * these entries and `fillScenario` derives its fills from the same ones. The values
 * themselves come from `emptyScenario()` (`model/seed.ts`).
 */

/** What supplies a field a legacy record omits. */
export interface LegacyFill {
  /**
   * `default` takes the value from the empty record's spread, `container`
   * deep-fills one level over the empty record's container, `reconciled` merges
   * against the current seeds, `migrated` has a named filler in the fill path.
   */
  fill: 'default' | 'container' | 'reconciled' | 'migrated'
  /** Runtime shape of a container whose every field a legacy record may omit. */
  shape?: string
}

/** Legacy-omission surface of one record type, keyed by field name. */
type LegacyFields = Record<string, LegacyFill>

/** Accepted omissions, keyed by runtime shape name. 'all' accepts every field. */
export type LegacyOmissions = Record<string, ReadonlySet<string> | 'all'>

/** Derive the validator's accepted omissions from one domain declaration. */
function legacyOmissions(owner: string, fields: LegacyFields): LegacyOmissions {
  const out: LegacyOmissions = { [owner]: new Set(Object.keys(fields)) }
  for (const field of Object.values(fields)) if (field.shape) out[field.shape] = 'all'
  return out
}

/**
 * Deep-fill one level for every `container` field: the saved container wins field by
 * field over the empty one. Fields filled any other way are left to their filler.
 */
export function fillContainers<T extends object>(
  parsed: T,
  empty: T,
  fields: LegacyFields,
): Partial<T> {
  const saved = parsed as Record<string, unknown>
  const defaults = empty as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(fields)) {
    if (field.fill !== 'container') continue
    out[key] = { ...(defaults[key] as object), ...(saved[key] as object) }
  }
  return out as Partial<T>
}

/**
 * Board fields a legacy scenario may omit. `library` and `systemPresets` reconcile
 * against the current seeds (`model/libraryLifecycle.ts`); `doctrine` carries the
 * launch-policy migration in `fillScenario`.
 */
export const SCENARIO_LEGACY_FIELDS: LegacyFields = {
  library: { fill: 'reconciled' },
  systemPresets: { fill: 'reconciled' },
  environment: { fill: 'container', shape: 'EnvironmentSpec' },
  requirements: { fill: 'container', shape: 'RequirementThresholds' },
  underlay: { fill: 'container', shape: 'Underlay' },
  mcdaWeights: { fill: 'container', shape: 'McdaVector' },
  raid: { fill: 'container', shape: 'RaidPlan' },
  doctrine: { fill: 'migrated', shape: 'FireDoctrine' },
  geoRef: { fill: 'default' },
}

/** The Board half of the validator's legacy-omission table. */
export const boardLegacyOmissions: LegacyOmissions = legacyOmissions(
  'Scenario',
  SCENARIO_LEGACY_FIELDS,
)

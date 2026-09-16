import type { LegacyOmissions } from './compat'
import { boardLegacyOmissions } from './compat'
import { runtimeShapes } from './runtimeSchema'

/** JSON structural contract, generated from the domain types, with semantics below. */
export interface RuntimeShape {
  type?: 'undefined' | 'string' | 'number' | 'boolean'
  literal?: string | number | boolean | null
  ref?: string
  union?: RuntimeShape[]
  tuple?: RuntimeShape[]
  array?: RuntimeShape
  properties?: Record<string, { shape: RuntimeShape; optional?: boolean }>
  values?: RuntimeShape
}

export function invalid(path: string, reason: string): never {
  throw new Error(`${path}: ${reason}`)
}

export function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid(path, 'expected an object')
  return value as Record<string, unknown>
}

// New-image admission uses a conservative 5 MiB storage budget, accounting
// for UTF-16 code units. Browser quotas/free space vary. Existing saved images
// remain portable; actual storage failures are authoritative. This does not
// cap records or guarantee sufficient quota for an admitted image.
export const MAX_ARRAY_LENGTH = 2 ** 32 - 1
export const MAX_IMAGE_CODE_UNITS = (5 * 1024 * 1024) / 2
export function validateImage(value: string, path: string, newImage = false): void {
  if (newImage && value.length > MAX_IMAGE_CODE_UNITS)
    invalid(path, 'embedded image exceeds the 5 MiB browser-storage budget; use a smaller image')
  const comma = value.indexOf(',')
  const payload = value.slice(comma + 1)
  if (!payload) invalid(path, 'image data URL has no payload')
  if (/;base64$/i.test(value.slice(0, comma))) {
    // Match the native decoder's forgiving-base64 grammar without allocating
    // the decoded image: ASCII whitespace and unpadded tails are supported;
    // padding is legal only at the end of a complete four-character group.
    let encoded = payload.replace(/[\t\n\f\r ]/g, '')
    if (encoded.length % 4 === 0) encoded = encoded.replace(/={1,2}$/, '')
    if (!encoded || encoded.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(encoded))
      invalid(path, 'invalid base64 image payload (length, alphabet or padding)')
  }
  if (!/^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(value))
    invalid(path, 'expected an image data URL')
}

// Every accepted omission comes from `io/compat.ts`, which fills it. Only missing
// fields get defaults; a present null/string/array is always checked against its
// actual type.
const legacyMissing: LegacyOmissions = boardLegacyOmissions

/** Validate all known nested fields; retain extension data for forward compatibility. */
export function validateShape(value: unknown, name: string, path = name, legacy = false): void {
  check(value, { ref: name }, path, legacy)
}

function check(
  value: unknown,
  shape: RuntimeShape,
  path: string,
  legacy: boolean,
  owner = '',
): void {
  if (shape.ref) return check(value, runtimeShapes[shape.ref], path, legacy, shape.ref)
  if (shape.union) {
    // Discriminated objects select their branch first, preserving useful error paths.
    const branches = shape.union.filter((s) => {
      const p = s.ref ? runtimeShapes[s.ref].properties : s.properties
      const kind = p?.kind?.shape
      return (
        !kind ||
        !('literal' in kind) ||
        (value && typeof value === 'object' && 'kind' in value && value.kind === kind.literal)
      )
    })
    const errors: string[] = []
    for (const branch of branches) {
      try {
        check(value, branch, path, legacy, owner)
        return
      } catch (error) {
        errors.push((error as Error).message)
      }
    }
    invalid(
      path,
      errors.find((e) => !e.includes('expected undefined') && !e.includes('expected null')) ??
        'unexpected value',
    )
  }
  if ('literal' in shape) {
    if (value !== shape.literal) invalid(path, `expected ${JSON.stringify(shape.literal)}`)
    return
  }
  if (shape.type) {
    if (typeof value !== shape.type) invalid(path, `expected ${shape.type}`)
    if (shape.type === 'number' && !Number.isFinite(value))
      invalid(path, 'expected a finite number')
    return
  }
  if (shape.array || shape.tuple) {
    if (!Array.isArray(value)) invalid(path, 'expected an array')
    if (shape.tuple && value.length !== shape.tuple.length)
      invalid(path, `expected ${shape.tuple.length} entries`)
    value.forEach((v, i) => check(v, shape.array ?? shape.tuple![i], `${path}[${i}]`, legacy))
    const element = shape.array?.ref ? runtimeShapes[shape.array.ref] : shape.array
    if (element?.properties?.id) idsOf(value, path)
    return
  }
  const object = objectAt(value, path)
  const defaults = legacy && legacyMissing[owner]
  for (const [key, property] of Object.entries(shape.properties ?? {})) {
    if (!Object.hasOwn(object, key)) {
      if (property.optional || defaults === 'all' || (defaults && defaults.has(key))) continue
      invalid(`${path}.${key}`, 'required field is missing')
    }
    // JS callers can have omitted optional fields represented as undefined;
    // parsed JSON cannot. Null remains a real value and must validate.
    check(object[key], property.shape, `${path}.${key}`, legacy)
  }
  if (shape.values)
    for (const [key, v] of Object.entries(object)) check(v, shape.values, `${path}.${key}`, legacy)
  semantics(object, owner, path)
}

function semantics(o: Record<string, unknown>, owner: string, path: string): void {
  function range(key: string, lo: number, hi = Infinity, integer = false, strictLo = false): void {
    const n = o[key]
    if (n == null) return
    if (
      typeof n !== 'number' ||
      !Number.isFinite(n) ||
      (strictLo ? n <= lo : n < lo) ||
      n > hi ||
      (integer && !Number.isSafeInteger(n))
    ) {
      invalid(
        `${path}.${key}`,
        `expected ${integer ? 'a safe integer' : 'a finite number'} ${strictLo ? '>' : '>='} ${lo}${hi === Infinity ? '' : ` and <= ${hi}`}`,
      )
    }
  }
  function ordered(key: string): void {
    const a = o[key]
    if (Array.isArray(a) && a[0] > a[1])
      invalid(`${path}.${key}`, 'lower bound exceeds upper bound')
  }
  if ('id' in o) {
    if (typeof o.id !== 'string' || !o.id.trim()) invalid(`${path}.id`, 'expected a nonempty ID')
    // Engine result maps are ordinary objects (for example mcRun.perThreat).
    // Their inherited property names cannot be safe persisted record keys.
    if (Object.hasOwn(Object.prototype, o.id))
      invalid(
        `${path}.id`,
        'reserved ID conflicts with an object-backed engine map; rename this ID and its references before import',
      )
  }
  if (owner === 'Scenario') {
    range('seed', 0, 4294967295, true)
    range('replicates', 1, MAX_ARRAY_LENGTH, true)
    range('targetHalfWidth', 0, Infinity, false, true)
  }
  if (owner === 'Vec2') {
    // Geometry squares differences; two opposite coordinates must remain representable.
    const limit = Math.sqrt(Number.MAX_VALUE / 2) / 2
    range('x', -limit, limit)
    range('y', -limit, limit)
  }
  if (owner === 'RaidWave') range('startDelayS', 0)
  if (owner === 'FormationSpec') range('count', 1, MAX_ARRAY_LENGTH, true)
  if (owner === 'SensorSpec')
    for (const key of ['trackInitN', 'trackInitM', 'trackDropMisses'])
      range(key, 1, MAX_ARRAY_LENGTH, true)
  if (owner === 'GeoRef') {
    range('lat', -90, 90)
    range('lon', -180, 180)
  }
  if (owner === 'Underlay') {
    range('opacity', 0, 1)
    range('widthM', 0, Infinity, false, true)
    range('naturalW', 0, Infinity, true)
    range('naturalH', 0, Infinity, true)
    if (typeof o.dataUrl === 'string') {
      validateImage(o.dataUrl, `${path}.dataUrl`)
      range('naturalW', 0, Infinity, true, true)
      range('naturalH', 0, Infinity, true, true)
    }
  }
  if (owner === 'SpecModel') {
    for (const field of ['sensor', 'effector', 'uas']) {
      if (o.kind === field && o[field] == null)
        invalid(`${path}.${field}`, `required for kind ${field}`)
      if (o.kind !== field && o[field] != null)
        invalid(`${path}.${field}`, `incompatible with kind ${String(o.kind)}`)
    }
  }
  if (
    [
      'SensorSpec',
      'EffectorSpec',
      'UasSpec',
      'Entity',
      'ThreatProfile',
      'FormationSpec',
      'FlightPath',
      'FireDoctrine',
      'Connection',
      'EnvironmentSpec',
    ].includes(owner)
  ) {
    for (const key of [
      'detectRangeM',
      'classifyRangeM',
      'minRangeM',
      'maxRangeM',
      'mountHeightM',
      'resolutionM',
      'instrumentedRangeM',
      'urbanRangeM',
      'maxAltitudeFt',
      'altitudeFt',
      'defendedRadiusM',
      'spacingM',
      'startDelayS',
      'trackInitS',
      'engageTimeS',
      'salvoCooldownS',
      'eirpW',
      'ratedEirpW',
      'bdaS',
      'targetS',
      'trackFirmS',
      'declareHostileS',
      'latencyS',
      'windSpeedMps',
      'controlLinkRangeM',
      'operatingRadiusM',
      'combatRadiusM',
      'warheadKg',
      'effectRadiusM',
      'standoffRangeM',
      'enduranceMin',
    ])
      range(key, 0)
    for (const key of ['rcsM2', 'refRcsM2', 'spanM', 'refSpanM', 'flyoutSpeedMps'])
      range(key, 0, Infinity, false, true)
    // Zero speed/update period are existing stationary/threshold configurations.
    for (const key of ['speedMps', 'cruiseSpeedMps', 'maxSpeedMps', 'updateRateS']) range(key, 0)
    for (const key of ['pk', 'commitPk', 'pkCommit', 'launchRangeFraction']) range(key, 0, 1)
    for (const key of ['placardPd', 'pfa']) range(key, 0, 1, false, true)
    for (const key of ['count', 'trackInitM', 'trackInitN', 'trackDropMisses', 'opportunities'])
      range(key, 1, Number.MAX_SAFE_INTEGER, true)
    range('magazineSize', 0, Number.MAX_SAFE_INTEGER, true)
    range('sectorDeg', 0, 360)
    ordered('elevationDeg')
    ordered('altBandFt')
    if (
      typeof o.minRangeM === 'number' &&
      typeof o.maxRangeM === 'number' &&
      o.minRangeM > o.maxRangeM
    )
      invalid(`${path}.minRangeM`, 'exceeds maxRangeM')
    if (
      typeof o.trackInitM === 'number' &&
      typeof o.trackInitN === 'number' &&
      o.trackInitM > o.trackInitN
    )
      invalid(`${path}.trackInitM`, 'exceeds trackInitN')
  }
  if (owner === 'RequirementThresholds') {
    for (const k of ['maxResidualPerTrack', 'pdDetect', 'pdTrackCumulative']) range(k, 0, 1)
    range('minWarningS', 0)
  }
  if (owner === 'McdaVector')
    for (const k of Object.keys(o)) if (typeof o[k] === 'number') range(k, 0, 5)
  if (o.kind === 'lognormal') range('sigmaDb', 0)
  if (o.kind === 'triangular') {
    // sampleSpread uses nominal * (1 + offset), with the mode at nominal.
    // Offsets must enclose zero and cannot put positive quantities below zero.
    // lo = hi = 0 is the sampler's supported fixed-nominal case.
    if (Number(o.lo) > Number(o.hi)) invalid(path, 'triangular lower offset exceeds upper offset')
    range('lo', -1, 0)
    range('hi', 0)
  }
  if (o.kind === 'beta') {
    range('trials', 0)
    range('successes', 0, Number(o.trials))
  }
  if (
    o.camera &&
    typeof o.camera === 'object' &&
    Number((o.camera as Record<string, unknown>).scale) <= 0
  )
    invalid(`${path}.camera.scale`, 'expected a positive scale')
}

/** Uniqueness is scoped to a collection; archival snapshots keep historical IDs. */
export function idsOf(records: readonly { id: string }[], path: string): Set<string> {
  const ids = new Set<string>()
  records.forEach((record, i) => {
    if (ids.has(record.id)) invalid(`${path}[${i}].id`, `duplicate ID ${record.id}`)
    ids.add(record.id)
  })
  return ids
}
export function reference(
  id: string | null | undefined,
  ids: ReadonlySet<string>,
  path: string,
  blank = false,
): void {
  if (id == null || (blank && id === '')) return
  if (!ids.has(id)) invalid(path, `unknown reference ${JSON.stringify(id)}`)
}

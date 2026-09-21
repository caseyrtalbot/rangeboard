import type {
  EffectorSpec,
  IrSignature,
  JamBand,
  SensorRole,
  SensorSpec,
  SpecModel,
  SwerlingCase,
  ThreatProfile,
  UasSpec,
} from './types'
import { TRACK_INIT_M, TRACK_INIT_N } from './types'

/**
 * Specification editing by named field: one field name, one raw input value,
 * one new model. The rules live here for which empty value clears back to the
 * planning factor, which value is clamped, how a paired field follows its
 * partner, and how a tuple is rebuilt.
 */

/** Synthetic sensor fields: each end of the elevation tuple is edited alone. */
type SensorSynthetic = 'elevationMinDeg' | 'elevationMaxDeg'
/** Synthetic UAS fields: each end of the altitude band is edited alone. */
type UasSynthetic = 'altFloorFt' | 'altCeilingFt'

export type SensorEditField = `sensor.${keyof SensorSpec | SensorSynthetic}`
export type EffectorEditField = `effector.${keyof EffectorSpec}`
export type UasEditField = `uas.${keyof UasSpec | UasSynthetic}`
export type ThreatEditField = `threatProfile.${keyof ThreatProfile}`

/** Every spec field the panels can edit by name. */
export type SpecEditField = SensorEditField | EffectorEditField | UasEditField | ThreatEditField

/** What a form control hands the reducer before any field rule runs. */
export type SpecEditValue = string | number | boolean | null | undefined | readonly string[]

/** The number behind a control value. A number input gives 0 for an empty field. */
function num(value: SpecEditValue): number {
  return Number(value)
}

/** A measured value that clears to the planning factor: positive, else null. */
function positiveOrNull(value: SpecEditValue): number | null {
  const n = num(value)
  return n > 0 ? n : null
}

/** A count that clears to the planning factor: positive, else absent. */
function positiveOrAbsent(value: SpecEditValue): number | undefined {
  const n = num(value)
  return n > 0 ? n : undefined
}

/**
 * Mount height from the raw input string: an empty field keeps the planning
 * factor, and a height is never negative. Both panels parse it here.
 */
function mountHeight(value: SpecEditValue): number | null {
  if (value === '' || value == null) return null
  return Math.max(0, num(value))
}

/** A sector or azimuth coverage, degrees, held inside the drawable range. */
function sector(value: SpecEditValue): number {
  return Math.min(360, Math.max(5, num(value)))
}

/** A band set, rejected when empty: an empty set reads back as "every band". */
function bands(value: SpecEditValue): JamBand[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  return [...value] as JamBand[]
}

function editSensor(spec: SensorSpec, key: string, value: SpecEditValue): SensorSpec {
  switch (key) {
    case 'role':
      return { ...spec, role: (value || undefined) as SensorRole | undefined }
    case 'detectRangeM':
      return { ...spec, detectRangeM: Math.max(0, num(value)) }
    case 'classifyRangeM':
      return { ...spec, classifyRangeM: positiveOrNull(value) }
    case 'sectorDeg':
      return { ...spec, sectorDeg: sector(value) }
    case 'elevationMinDeg':
      return { ...spec, elevationDeg: [num(value), spec.elevationDeg?.[1] ?? 90] }
    case 'elevationMaxDeg':
      return { ...spec, elevationDeg: [spec.elevationDeg?.[0] ?? 0, num(value)] }
    case 'maxAltitudeFt':
      return { ...spec, maxAltitudeFt: positiveOrNull(value) }
    case 'mountHeightM':
      return { ...spec, mountHeightM: mountHeight(value) }
    case 'resolutionM':
      return { ...spec, resolutionM: positiveOrNull(value) }
    case 'instrumentedRangeM':
      return { ...spec, instrumentedRangeM: positiveOrNull(value) }
    case 'refRcsM2':
      return { ...spec, refRcsM2: positiveOrNull(value) }
    case 'placardPd': {
      const n = num(value)
      return { ...spec, placardPd: n > 0 ? Math.min(0.99, n) : null }
    }
    case 'pfa':
      return { ...spec, pfa: value === '' || value == null ? null : num(value) }
    case 'updateRateS':
      return { ...spec, updateRateS: positiveOrNull(value) }
    case 'trackInitM': {
      // M of N: N follows M up so the pair in use stays valid.
      const trackInitM = positiveOrAbsent(value)
      const trackInitN =
        trackInitM != null && (spec.trackInitN ?? TRACK_INIT_N) < trackInitM
          ? trackInitM
          : spec.trackInitN
      return { ...spec, trackInitM, trackInitN }
    }
    case 'trackInitN': {
      // M follows N down so the pair in use stays valid.
      const trackInitN = positiveOrAbsent(value)
      const trackInitM =
        trackInitN != null && (spec.trackInitM ?? TRACK_INIT_M) > trackInitN
          ? trackInitN
          : spec.trackInitM
      return { ...spec, trackInitM, trackInitN }
    }
    case 'trackDropMisses':
      return { ...spec, trackDropMisses: positiveOrAbsent(value) }
    case 'refSpanM':
      return { ...spec, refSpanM: positiveOrNull(value) }
    case 'refAcousticDb':
      return { ...spec, refAcousticDb: positiveOrNull(value) }
    case 'rfBands': {
      const next = bands(value)
      return next == null ? spec : { ...spec, rfBands: next }
    }
    case 'urbanRangeM':
      return { ...spec, urbanRangeM: positiveOrNull(value) }
    // A field with no rule of its own takes the control value as it stands.
    default:
      return { ...spec, [key]: value } as SensorSpec
  }
}

function editEffector(spec: EffectorSpec, key: string, value: SpecEditValue): EffectorSpec {
  switch (key) {
    case 'sectorDeg':
      return { ...spec, sectorDeg: sector(value) }
    case 'maxAltitudeFt':
      return { ...spec, maxAltitudeFt: positiveOrNull(value) }
    case 'mountHeightM':
      return { ...spec, mountHeightM: mountHeight(value) }
    case 'flyoutSpeedMps':
      return { ...spec, flyoutSpeedMps: positiveOrNull(value) }
    case 'eirpW':
      return { ...spec, eirpW: positiveOrAbsent(value) }
    case 'ratedEirpW':
      return { ...spec, ratedEirpW: positiveOrAbsent(value) }
    case 'jamBands': {
      const next = bands(value)
      return next == null ? spec : { ...spec, jamBands: next }
    }
    default:
      return { ...spec, [key]: value } as EffectorSpec
  }
}

function editUas(spec: UasSpec, key: string, value: SpecEditValue): UasSpec {
  switch (key) {
    case 'group':
      return { ...spec, group: num(value) as UasSpec['group'] }
    case 'swerling':
      return {
        ...spec,
        swerling: value === '' || value == null ? null : (num(value) as SwerlingCase),
      }
    case 'irSignature':
      return { ...spec, irSignature: (value || undefined) as IrSignature | undefined }
    case 'rcsM2':
      return { ...spec, rcsM2: positiveOrNull(value) }
    case 'spanM':
      return { ...spec, spanM: positiveOrNull(value) }
    case 'acousticDb':
      return { ...spec, acousticDb: positiveOrNull(value) }
    case 'altFloorFt':
      return { ...spec, altBandFt: [num(value), spec.altBandFt[1]] }
    case 'altCeilingFt':
      return { ...spec, altBandFt: [spec.altBandFt[0], num(value)] }
    case 'controlLinkRangeM':
      return { ...spec, controlLinkRangeM: positiveOrNull(value) }
    case 'operatingRadiusM':
      return { ...spec, operatingRadiusM: positiveOrNull(value) }
    case 'combatRadiusM':
      return { ...spec, combatRadiusM: positiveOrNull(value) }
    case 'oneWay':
      // Empty leaves employment to the airframe default.
      return { ...spec, oneWay: value === '' || value == null ? undefined : value === 'one-way' }
    default:
      return { ...spec, [key]: value } as UasSpec
  }
}

function editThreatProfile(spec: ThreatProfile, key: string, value: SpecEditValue): ThreatProfile {
  switch (key) {
    case 'count':
      return { ...spec, count: Math.max(1, num(value)) }
    default:
      return { ...spec, [key]: value } as ThreatProfile
  }
}

/**
 * The model with one named spec field edited. Returns the model itself when
 * the section is absent or the field rule rejects the value, so a caller can
 * skip the write and record no history.
 */
export function editSpecField(
  model: SpecModel,
  field: SpecEditField,
  value: SpecEditValue,
): SpecModel {
  const cut = field.indexOf('.')
  const section = field.slice(0, cut)
  const key = field.slice(cut + 1)
  if (section === 'sensor') {
    if (!model.sensor) return model
    const next = editSensor(model.sensor, key, value)
    return next === model.sensor ? model : { ...model, sensor: next }
  }
  if (section === 'effector') {
    if (!model.effector) return model
    const next = editEffector(model.effector, key, value)
    return next === model.effector ? model : { ...model, effector: next }
  }
  if (section === 'uas') {
    if (!model.uas) return model
    const next = editUas(model.uas, key, value)
    return next === model.uas ? model : { ...model, uas: next }
  }
  if (!model.threatProfile) return model
  const next = editThreatProfile(model.threatProfile, key, value)
  return next === model.threatProfile ? model : { ...model, threatProfile: next }
}

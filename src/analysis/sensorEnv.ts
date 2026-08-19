import type { EnvironmentSpec, SensorSpec, SensorType, UasGroup, UasSpec } from '../model/types'

/**
 * Sensor performance under environmental covariates and target effects.
 * Model: each covariate multiplies the sensor's spec range by a factor.
 * Factors follow the COURAGEOUS project findings (Brewczynski et al.,
 * Remote Sens. 2024, 16, 3714): rain and fog attenuate radar and EO/IR,
 * visible-light cameras are daylight sensors, urban EM clutter cuts RF
 * detection, and wind masks acoustic signatures. Values are representative
 * planning factors, not test data.
 */
export const SENSOR_ENV_MODEL = {
  rain: { radar: 0.75, 'eo-ir': 0.6, rf: 1, acoustic: 0.7 } as Record<SensorType, number>,
  fog: { radar: 0.85, 'eo-ir': 0.4, rf: 1, acoustic: 1 } as Record<SensorType, number>,
  night: { radar: 1, 'eo-ir': 0.6, rf: 1, acoustic: 1 } as Record<SensorType, number>,
  urbanEm: { radar: 0.9, 'eo-ir': 1, rf: 0.6, acoustic: 0.85 } as Record<SensorType, number>,
  /** Acoustic range loss per m/s of wind, with a floor. */
  acousticWindLossPerMps: 0.03,
  acousticWindFloor: 0.4,
  /**
   * Radar detection range vs target size. Seed radar figures are quoted
   * against Group 1 small UAS; larger airframes return more energy and are
   * seen farther (range grows with the fourth root of RCS). Capped planning
   * values, not the raw radar equation.
   */
  radarGroupFactor: { 1: 1, 2: 1.2, 3: 1.6, 4: 1.9, 5: 2.2 } as Record<UasGroup, number>,
  source: 'COURAGEOUS project (Remote Sens. 2024) + radar range equation',
}

/** Range multiplier for one sensor technology under the current environment, (0, 1]. */
export function sensorEnvFactor(type: SensorType, env: EnvironmentSpec): number {
  if (!env.apply) return 1
  let f = 1
  const precip = env.precipitation ?? 'clear'
  if (precip === 'rain') f *= SENSOR_ENV_MODEL.rain[type]
  if (precip === 'fog') f *= SENSOR_ENV_MODEL.fog[type]
  if ((env.light ?? 'day') === 'night') f *= SENSOR_ENV_MODEL.night[type]
  if ((env.emBackground ?? 'rural') === 'urban') f *= SENSOR_ENV_MODEL.urbanEm[type]
  if (type === 'acoustic' && env.windSpeedMps > 0) {
    f *= Math.max(
      SENSOR_ENV_MODEL.acousticWindFloor,
      1 - env.windSpeedMps * SENSOR_ENV_MODEL.acousticWindLossPerMps,
    )
  }
  return f
}

/** Radar range multiplier for the target's size class. 1 when unknown. */
export function radarTargetFactor(group: UasGroup | undefined): number {
  return group ? SENSOR_ENV_MODEL.radarGroupFactor[group] : 1
}

/** Detect range after environment and, for radar, target-size effects. */
export function effectiveDetectRangeM(
  spec: SensorSpec,
  env: EnvironmentSpec,
  targetGroup?: UasGroup,
): number {
  const size = spec.sensorType === 'radar' && env.apply ? radarTargetFactor(targetGroup) : 1
  return spec.detectRangeM * sensorEnvFactor(spec.sensorType, env) * size
}

/** Classify range under the same effects. Null when the sensor cannot classify. */
export function effectiveClassifyRangeM(
  spec: SensorSpec,
  env: EnvironmentSpec,
  targetGroup?: UasGroup,
): number | null {
  if (spec.classifyRangeM == null) return null
  const size = spec.sensorType === 'radar' && env.apply ? radarTargetFactor(targetGroup) : 1
  return spec.classifyRangeM * sensorEnvFactor(spec.sensorType, env) * size
}

/**
 * True when the UAS emits an RF control or video link a passive RF sensor can
 * hear. Autonomous, inertial, optical, and fiber-guided threats are RF silent
 * (COURAGEOUS: frequency monitors only detect active transmissions).
 */
export function rfDetectable(uas: UasSpec): boolean {
  return uas.navMode === 'rf-manual' || uas.navMode === 'mixed'
}

/** True when a jammer has something to deny: an RF link or GNSS navigation. */
export function jammable(uas: UasSpec): boolean {
  return uas.navMode === 'gps' || uas.navMode === 'rf-manual' || uas.navMode === 'mixed'
}

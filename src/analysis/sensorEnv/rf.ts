import type { EnvironmentSpec, JamBand, SensorSpec, UasSpec } from '../../model/types'
import { JAM_BANDS } from '../../model/types'
import { targetLinkBands } from '../ewPhysics'

/**
 * Passive RF detection rules: band overlap, the emitting-link test and the
 * urban range override. No target scaling today; lane 3.2 adds the link
 * budget from radiated power, free-space loss, urban margin and receiver
 * sensitivity, the direction-finding accuracy by signal to noise and the
 * multi-node geolocation here.
 */

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

/** Bands an RF sensor receives. Absent means every band. */
export function rfSensorBands(spec: SensorSpec): JamBand[] {
  return spec.rfBands && spec.rfBands.length > 0 ? spec.rfBands : JAM_BANDS
}

/**
 * True when the RF sensor can hear this threat: it emits at all, and one of
 * its EMITTING link bands is inside the receiver's coverage. GNSS is a
 * band the threat receives, never one it transmits, so it never counts.
 */
export function rfCanHear(spec: SensorSpec, uas: UasSpec): boolean {
  if (!rfDetectable(uas)) return false
  const rx = new Set(rfSensorBands(spec))
  return targetLinkBands(uas).some((b) => b !== 'gnss' && rx.has(b))
}

/** True when the environment's urban override applies to this RF sensor. */
export function urbanOverride(spec: SensorSpec, env: EnvironmentSpec): boolean {
  return (
    spec.sensorType === 'rf' &&
    spec.detectRangeM > 0 &&
    env.apply &&
    (env.emBackground ?? 'rural') === 'urban' &&
    spec.urbanRangeM != null &&
    Number.isFinite(spec.urbanRangeM) &&
    spec.urbanRangeM > 0
  )
}

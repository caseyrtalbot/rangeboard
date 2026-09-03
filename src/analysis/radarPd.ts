/**
 * Radar probability of detection at range, calibrated at the placard.
 *
 * A radar placard says "detects the reference target at r0". The engine
 * reads that as one point on a Pd-versus-SNR curve: at r0 the reference
 * target returns the SNR that gives pd0 at pfa for the reference
 * fluctuation case. The radar range equation then carries that SNR to any
 * other target and range (SNR scales with RCS and with the inverse fourth
 * power of range), and the target's own fluctuation case turns the SNR back
 * into a Pd. Single scan, square-law detector, one pulse: no pulse
 * integration, clutter, MTI or Doppler gating.
 *
 * Sources: Mahafza, Radar Systems Analysis and Design Using MATLAB, 3rd ed.,
 * CRC Press 2013, section 13.5 (Swerling I Eq. 13.45, Swerling III
 * Eq. 13.51); Albersheim, "A closed-form approximation to Robertson's
 * detection characteristics", Proc. IEEE 69(7), 1981, as restated in
 * Richards, Fundamentals of Radar Signal Processing, chapter 6.
 */
import type { SwerlingCase } from '../model/types'

/** The placard as one point on the Pd curve. r0M is the placard SLANT range. */
export interface RadarCalibration {
  /** Placard detect range against the reference target, meters. */
  r0M: number
  /** Reference target RCS the placard is quoted against, m2. */
  rcs0M2: number
  /** Pd the placard is quoted at. */
  pd0: number
  /** False-alarm probability the placard assumes. */
  pfa: number
  /** Fluctuation case of the reference target. */
  swerling0: SwerlingCase
}

/** Albersheim's SNR coefficient at N = 1: 6.2 + 4.54 / sqrt(N + 0.44). */
const ALBERSHEIM_N1 = 6.2 + 4.54 / Math.sqrt(1.44)

/** Pfa clamped strictly inside (0, 1) so every log and power below stays finite. */
function pfaSafe(pfa: number): number {
  if (!Number.isFinite(pfa)) return 1e-6
  return Math.min(Math.max(pfa, 1e-300), 1 - 1e-15)
}

/**
 * Single-scan Pd for a given SNR (linear), Pfa and Swerling case.
 *
 * Swerling 1 (Mahafza Eq. 13.45, np = 1): Pd = Pfa ^ (1 / (1 + SNR)).
 * Swerling 3 (Mahafza Eq. 13.51, np = 1, vT = -ln Pfa):
 *   Pd = exp(-vT / (1 + SNR/2)) * (1 + vT / (1 + SNR/2) + 2/SNR) / (1 + 2/SNR),
 *   written here as (SNR * (1 + vT/d) + 2) / (SNR + 2) so SNR = 0 gives Pfa
 *   with no division by zero. Checked against numeric integration of the
 *   Marcum Q over the 4-dof chi-square target: under 0.001 dB apart at
 *   Pd 0.5, 0.8 and 0.9 for Pfa 1e-6, so the closed form is kept.
 * Swerling 0: the algebraic inverse of Albersheim's approximation (N = 1),
 *   valid Pd 0.1 to 0.9 and Pfa 1e-3 to 1e-7 within about 0.2 dB. Outside
 *   that band the same formula extrapolates through the logistic, so the
 *   result stays inside (0, 1) but is not a checked value. At SNR 0 it
 *   returns the formula's own floor, about 0.017 at Pfa 1e-6, not Pfa.
 *
 * A negative or non-finite SNR reads as 0; an infinite SNR returns 1.
 */
export function pdFromSnr(snr: number, pfa: number, swerling: SwerlingCase): number {
  if (snr === Infinity) return 1
  const s = Number.isFinite(snr) && snr > 0 ? snr : 0
  const q = pfaSafe(pfa)
  if (swerling === 1) return Math.pow(q, 1 / (1 + s))
  if (swerling === 3) {
    const vt = -Math.log(q)
    const d = 1 + s / 2
    return Math.exp(-vt / d) * (s * (1 + vt / d) + 2) / (s + 2)
  }
  // Albersheim solved for B = ln(Pd / (1 - Pd)); s^(10 / C) is 10^(SNR_dB / C).
  const a = Math.log(0.62 / q)
  const x = Math.pow(s, 10 / ALBERSHEIM_N1)
  const b = (x - a) / (0.12 * a + 1.7)
  return 1 / (1 + Math.exp(-b))
}

/**
 * SNR (linear) that yields `pd` at `pfa` for the case. Monotone inverse of
 * pdFromSnr: Swerling 1 and 0 invert their closed forms, Swerling 3 bisects
 * pdFromSnr, which is monotone in SNR.
 *
 * pd >= 1 returns Infinity (no finite SNR reaches certainty). pd <= 0, or a
 * pd at or below the case's zero-SNR floor (Pfa for Swerling 1 and 3, the
 * Albersheim floor for Swerling 0), returns 0.
 */
export function snrForPd(pd: number, pfa: number, swerling: SwerlingCase): number {
  if (!(pd > 0)) return 0
  if (pd >= 1) return Infinity
  const q = pfaSafe(pfa)
  if (swerling === 1) return Math.max(0, Math.log(q) / Math.log(pd) - 1)
  if (swerling === 3) {
    if (pd <= q) return 0
    let lo = 0
    let hi = 1
    while (pdFromSnr(hi, q, 3) < pd) {
      lo = hi
      hi *= 2
      if (hi === Infinity) return Infinity
    }
    // 200 halvings take the bracket below double precision at any scale.
    for (let i = 0; i < 200 && lo < hi; i++) {
      const mid = (lo + hi) / 2
      if (mid <= lo || mid >= hi) break
      if (pdFromSnr(mid, q, 3) < pd) lo = mid
      else hi = mid
    }
    return hi
  }
  const a = Math.log(0.62 / q)
  const b = Math.log(pd / (1 - pd))
  const x = a + 0.12 * a * b + 1.7 * b
  if (!(x > 0)) return 0
  return Math.pow(x, ALBERSHEIM_N1 / 10)
}

/** SNR the reference target returns at the placard range. */
function snr0Of(cal: RadarCalibration): number {
  return snrForPd(cal.pd0, cal.pfa, cal.swerling0)
}

/**
 * Calibrated SNR at range R: snr0 * (rcs / rcs0) * (r0 / R)^4 * envRangeFactor^4,
 * where snr0 = snrForPd(pd0, pfa, swerling0) and r0 is the placard slant range
 * (radar range equation, Mahafza chapter 1). The environment multiplier is a
 * range factor, so it enters the SNR as the fourth power.
 *
 * rangeM <= 0 returns Infinity (the target sits on the antenna). r0M <= 0
 * returns 0 (a placard of zero range sees nothing). rcs0M2 <= 0 reads as
 * equal to rcsM2.
 */
export function snrAtRange(cal: RadarCalibration, rcsM2: number, rangeM: number, envRangeFactor: number): number {
  if (!(cal.r0M > 0)) return 0
  if (!(rangeM > 0)) return Infinity
  const rcsRatio = cal.rcs0M2 > 0 && rcsM2 > 0 ? rcsM2 / cal.rcs0M2 : 1
  const m = envRangeFactor > 0 ? envRangeFactor : 0
  const rangeRatio = (cal.r0M * m) / rangeM
  return snr0Of(cal) * rcsRatio * Math.pow(rangeRatio, 4)
}

/** Single-scan Pd for a target of `rcsM2` and case `swerling` at `rangeM`. */
export function pdAtRange(
  cal: RadarCalibration,
  rcsM2: number,
  rangeM: number,
  envRangeFactor: number,
  swerling: SwerlingCase,
): number {
  return pdFromSnr(snrAtRange(cal, rcsM2, rangeM, envRangeFactor), cal.pfa, swerling)
}

/**
 * Largest range at which pdAtRange >= pd. Closed form from the fourth-root law:
 * R = r0 * m * ((rcs / rcs0) * (snr0 / snrForPd(pd))) ^ (1/4). When the target
 * case matches swerling0 and pd equals pd0 the SNR ratio is exactly 1 and this
 * is r0 * m * (rcs / rcs0) ^ (1/4), the rcsRangeFactor law.
 *
 * pd >= 1 returns 0. pd <= 0, or a pd the case reaches at zero SNR, returns
 * Infinity: every range satisfies it, so no bound exists. Callers that draw
 * must clamp. Never NaN for finite inputs.
 */
export function rangeForPd(
  cal: RadarCalibration,
  rcsM2: number,
  pd: number,
  envRangeFactor: number,
  swerling: SwerlingCase,
): number {
  if (pd >= 1) return 0
  if (!(pd > 0)) return Infinity
  if (!(cal.r0M > 0)) return 0
  const need = snrForPd(pd, cal.pfa, swerling)
  if (need === Infinity) return 0
  if (!(need > 0)) return Infinity
  const rcsRatio = cal.rcs0M2 > 0 && rcsM2 > 0 ? rcsM2 / cal.rcs0M2 : 1
  const m = envRangeFactor > 0 ? envRangeFactor : 0
  return cal.r0M * m * Math.pow(rcsRatio * (snr0Of(cal) / need), 0.25)
}

/**
 * Probability that at least m of n independent scans with Pd `p` detect:
 * the upper tail of the binomial. m <= 0 returns 1, m > n returns 0, p is
 * clamped to [0, 1].
 */
export function mOfN(p: number, m: number, n: number): number {
  if (m <= 0) return 1
  if (m > n || !(n > 0)) return 0
  const q = Number.isFinite(p) ? Math.min(Math.max(p, 0), 1) : 0
  let sum = 0
  let coef = 1
  for (let k = 0; k <= n; k++) {
    if (k >= m) sum += coef * Math.pow(q, k) * Math.pow(1 - q, n - k)
    // Walk the binomial coefficient C(n, k) -> C(n, k + 1).
    coef = (coef * (n - k)) / (k + 1)
  }
  return Math.min(1, sum)
}

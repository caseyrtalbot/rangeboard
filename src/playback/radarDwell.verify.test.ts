import { describe, expect, it } from 'vitest'
import type { SwerlingCase } from '../model/types'
import { SHNIDMAN_TYPICAL_ERROR_DB, shnidmanPdFromSnr, shnidmanSnrForPd } from './radarDwell'

/**
 * VALIDATION AGAINST SHNIDMAN'S PUBLISHED APPROXIMATION.
 *
 * Sources, read 2026-09-10:
 * - D. A. Shnidman, "Determination of Required SNR Values," IEEE
 *   Transactions on Aerospace and Electronic Systems 38(3), 2002,
 *   pp. 1059-1064, doi:10.1109/TAES.2002.1039422. The paper defines the
 *   inverse problem in mean SNR per pulse and reports error below 1 dB,
 *   mostly below 0.5 dB.
 * - NASA/Aerospace ATR-2023-01267, Appendix B, pp. 42-43,
 *   nasa.gov/wp-content/uploads/2023/10/atr-2023-01267.pdf. It reproduces
 *   eta, K, alpha, SNR0, C1 and C2 and defines NCI as the number of
 *   noncoherently integrated pulses.
 *
 * Each expected dB value below was evaluated by hand from those printed
 * equations, not copied from the implementation. All points are inside the
 * published Pd, Pfa and N domain. The forward assertion then verifies that
 * integrated Pd is the inverse at that (N, SNR, Swerling) point.
 */

const lin = (db: number) => Math.pow(10, db / 10)
const db = (snr: number) => 10 * Math.log10(snr)

interface Point {
  pulses: number
  snrDb: number
  swerling: SwerlingCase
  pd: number
}

const POINTS: Point[] = [
  // N 10, Pd .5: eta 3.1533115541, SNR0 23.2570838475, K infinity,
  // C = 1; required per-pulse SNR 2.3257083848 = 3.6655525862 dB.
  { pulses: 10, snrDb: 3.6655525862, swerling: 0, pd: 0.5 },
  // N 20, Pd .8: eta 3.7508311623, SNR0 36.8533658003, K 1,
  // C1 5.3570832 dB; required SNR 6.3263830238 = 8.0115548225 dB.
  { pulses: 20, snrDb: 8.0115548225, swerling: 1, pd: 0.8 },
  // N 100, Pd .9: eta 4.0573696264, SNR0 73.8421198175, K 2,
  // C1+C2 4.2359452484 dB; required SNR 1.9583877347 = 2.9189868052 dB.
  { pulses: 100, snrDb: 2.9189868052, swerling: 3, pd: 0.9 },
]

describe('Shnidman noncoherent integration (read 2026-09-10)', () => {
  it('matches three hand-derived (N, per-pulse SNR, Swerling) points', () => {
    for (const point of POINTS) {
      const required = shnidmanSnrForPd(point.pd, 1e-6, point.pulses, point.swerling)
      expect(Math.abs(db(required) - point.snrDb)).toBeLessThan(SHNIDMAN_TYPICAL_ERROR_DB)
      expect(shnidmanPdFromSnr(lin(point.snrDb), 1e-6, point.pulses, point.swerling)).toBeCloseTo(
        point.pd,
        7,
      )
    }
  })
})

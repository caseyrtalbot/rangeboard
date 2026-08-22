import { describe, expect, it } from 'vitest'
import { SEED_LIBRARY } from '../model/seedLibrary'
import type { ThreatTactic } from './tactics'
import { THREAT_TACTICS, fanAxes, resolvePlatform } from './tactics'

function tacticWith(designators: string[]): ThreatTactic {
  return {
    id: 'TEST',
    name: 'test',
    description: 'test',
    sourceRef: 'test',
    platforms: designators.map((designator) => ({ designator })),
    defaultShipCount: 1,
    shipsPerWave: 1,
    waveSpacingS: 0,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 1000,
    formation: null,
  }
}

describe('resolvePlatform', () => {
  it('matches an exact seed name', () => {
    const m = resolvePlatform(tacticWith(['Red air: Shahed-136 / Geran-2 OWA (G3)']), SEED_LIBRARY)
    expect(m?.id).toBe('lib-shahed136')
  })

  it('matches a seed id', () => {
    const m = resolvePlatform(tacticWith(['lib-gerbera']), SEED_LIBRARY)
    expect(m?.id).toBe('lib-gerbera')
  })

  it('matches a family substring', () => {
    expect(resolvePlatform(tacticWith(['Shahed-136']), SEED_LIBRARY)?.id).toBe('lib-shahed136')
    expect(resolvePlatform(tacticWith(['Lancet-3']), SEED_LIBRARY)?.id).toBe('lib-lancet3')
  })

  it('falls through to the first resolvable designator', () => {
    const m = resolvePlatform(tacticWith(['An-2 decoy', 'Gerbera']), SEED_LIBRARY)
    expect(m?.id).toBe('lib-gerbera')
  })

  it('returns null when nothing matches or the tactic is generic', () => {
    expect(resolvePlatform(tacticWith(['An-2 decoy']), SEED_LIBRARY)).toBeNull()
    expect(resolvePlatform(tacticWith([]), SEED_LIBRARY)).toBeNull()
  })

  it('never matches non-UAS library entries', () => {
    expect(resolvePlatform(tacticWith(['Defended asset']), SEED_LIBRARY)).toBeNull()
  })
})

describe('fanAxes', () => {
  it('one axis returns the bearing normalized', () => {
    expect(fanAxes(45, 1, 0)).toEqual([45])
    expect(fanAxes(-90, 1, 120)).toEqual([270])
    expect(fanAxes(720, 1, 0)).toEqual([0])
  })

  it('fans symmetrically around the bearing', () => {
    expect(fanAxes(90, 3, 90)).toEqual([45, 90, 135])
    expect(fanAxes(90, 2, 60)).toEqual([60, 120])
  })

  it('normalizes axes across the 0/360 wrap', () => {
    expect(fanAxes(0, 3, 90)).toEqual([315, 0, 45])
    expect(fanAxes(350, 3, 40)).toEqual([330, 350, 10])
  })

  it('keeps every result inside [0, 360)', () => {
    for (const deg of fanAxes(-400, 5, 300)) {
      expect(deg).toBeGreaterThanOrEqual(0)
      expect(deg).toBeLessThan(360)
    }
  })
})

describe('THREAT_TACTICS integrity', () => {
  it('has 18-24 tactics with unique ids', () => {
    expect(THREAT_TACTICS.length).toBeGreaterThanOrEqual(18)
    expect(THREAT_TACTICS.length).toBeLessThanOrEqual(24)
    const ids = THREAT_TACTICS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every tactic names its source and carries usable geometry', () => {
    for (const t of THREAT_TACTICS) {
      expect(t.name.length, t.id).toBeGreaterThan(0)
      expect(t.description.length, t.id).toBeGreaterThan(0)
      expect(t.sourceRef.length, t.id).toBeGreaterThan(0)
      expect(t.defaultShipCount, t.id).toBeGreaterThanOrEqual(1)
      expect(t.shipsPerWave, t.id).toBeGreaterThanOrEqual(1)
      expect(t.defaultShipCount, t.id).toBeGreaterThanOrEqual(t.shipsPerWave)
      expect(t.waveSpacingS, t.id).toBeGreaterThanOrEqual(0)
      expect(t.axes, t.id).toBeGreaterThanOrEqual(1)
      expect(t.standoffM, t.id).toBeGreaterThan(0)
      expect(t.defaultBearingDeg, t.id).toBeGreaterThanOrEqual(0)
      expect(t.defaultBearingDeg, t.id).toBeLessThan(360)
      if (t.axes === 1) expect(t.axisSpreadDeg, t.id).toBe(0)
      else expect(t.axisSpreadDeg, t.id).toBeGreaterThan(0)
      if (t.formation) {
        expect(t.formation.count, t.id).toBeGreaterThanOrEqual(1)
        expect(t.formation.spacingM, t.id).toBeGreaterThan(0)
      }
    }
  })

  it('every named platform designator resolves against the seed library', () => {
    for (const t of THREAT_TACTICS) {
      for (const p of t.platforms) {
        const m = resolvePlatform(tacticWith([p.designator]), SEED_LIBRARY)
        expect(m, `${t.id}: ${p.designator}`).not.toBeNull()
      }
    }
  })

  it('decoy designators resolve and interleave at a sane interval', () => {
    for (const t of THREAT_TACTICS) {
      if (!t.decoy) continue
      const m = resolvePlatform(tacticWith([t.decoy.designator]), SEED_LIBRARY)
      expect(m, `${t.id}: ${t.decoy.designator}`).not.toBeNull()
      expect(t.decoy.everyNth, t.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('generic GEN-* tactics carry no platforms', () => {
    for (const t of THREAT_TACTICS) {
      if (t.id.startsWith('GEN-')) expect(t.platforms, t.id).toEqual([])
    }
  })

  it('covers every RAID_BUILDERS pattern with a successor tactic', () => {
    const ids = new Set(THREAT_TACTICS.map((t) => t.id))
    // stream -> RUS-LR-01, multi-axis -> RUS-LR-02, decoy mix -> RUS-LR-04,
    // FPV wave -> RUS-TAC-02 / UKR-TAC-01, FPV multi-axis -> UKR-TAC-05,
    // recon-cued pair -> UKR-TAC-04.
    for (const id of [
      'RUS-LR-01',
      'RUS-LR-02',
      'RUS-LR-04',
      'RUS-TAC-02',
      'UKR-TAC-01',
      'UKR-TAC-05',
      'UKR-TAC-04',
    ]) {
      expect(ids.has(id), id).toBe(true)
    }
  })
})

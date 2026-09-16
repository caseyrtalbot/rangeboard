import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario, Vec2 } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { ModelId, ModelTag } from './fidelity'
import { MODEL_TAGS } from './fidelity'
import { assessRunValidity, findingsForGate, invalidatedTracksForGate } from './runValidity'

/** MODEL_TAGS with every model checked, so unvalidated-model never fires. */
const VALIDATED = Object.fromEntries(
  Object.entries(MODEL_TAGS).map(([id, tag]) => [id, { ...tag, validation: 'analytic' }]),
) as Record<ModelId, ModelTag>

function entity(id: string, kind: Entity['kind'], specId: string | null, pos: Vec2): Entity {
  return {
    id,
    name: id.toUpperCase(),
    kind,
    specId,
    pos,
    headingDeg: 0,
    color: null,
    notes: '',
  }
}

/** Threat with a straight 20 km path from `spawn`. */
function addThreat(scenario: Scenario, id: string, spawn: Vec2): void {
  scenario.entities.push(entity(id, 'uas', 'lib-mavic3', spawn))
  scenario.paths.push({
    id: `p-${id}`,
    entityId: id,
    points: [spawn, { x: spawn.x + 20000, y: spawn.y }],
    speedMps: 15,
    startDelayS: 0,
  })
}

function assessment(uasId: string, patch: Partial<ThreatAssessment> = {}): ThreatAssessment {
  return {
    uasId,
    status: 'engageable',
    firstDetectS: 10,
    firstDetectSensorId: 's1',
    firstConfirmS: 15,
    techs: ['radar'],
    swarmMerged: false,
    cpaAssetId: null,
    cpaS: null,
    cpaDistanceM: null,
    assetId: null,
    closestApproachM: null,
    arrivalS: null,
    warningS: null,
    windowS: [20, 40],
    windowEffectorId: 'e1',
    classificationAtS: { unknownAtS: 10, suspectedAtS: 10, hostileAtS: 15 },
    engageGateS: 10,
    detectingSensorIds: ['s1'],
    effectorWindows: [],
    ...patch,
  }
}

/** Clean laydown: one asset, one threat spawning well outside every ring. */
function cleanScenario(): Scenario {
  const s = emptyScenario()
  // The fresh scenario runs Monte Carlo; these tests set the mode explicitly.
  s.runMode = 'deterministic'
  s.entities.push(entity('a1', 'asset', null, { x: 0, y: 0 }))
  addThreat(s, 'u1', { x: 40000, y: 0 })
  return s
}

describe('assessRunValidity rollup', () => {
  it('reports a clean Monte Carlo laydown with validated models as valid', () => {
    const s = cleanScenario()
    s.runMode = 'monte-carlo'
    const result = assessRunValidity(s, [assessment('u1')], VALIDATED)
    expect(result.validity).toBe('valid')
    expect(result.findings).toHaveLength(0)
  })

  it('reports pending when no track was assessed', () => {
    expect(assessRunValidity(cleanScenario(), []).validity).toBe('pending')
  })

  it('reports valid-limited when only caveats apply', () => {
    const s = emptyScenario()
    s.runMode = 'deterministic'
    addThreat(s, 'u1', { x: 40000, y: 0 })
    const result = assessRunValidity(s, [assessment('u1')])
    expect(result.validity).toBe('valid-limited')
    expect(result.findings.map((f) => f.id)).toEqual([
      'no-defended-asset',
      'planning-envelope',
      'unvalidated-model',
    ])
  })
})

describe('spawn-in-ring finding', () => {
  function spawnInRingScenario(): Scenario {
    const s = cleanScenario()
    // Elevation: the LSTAR cone is [0, 30] deg, so the sensor stands 1 km off
    // the spawn, not on it. A 300 ft Mavic 3 over the spawn is then at 5.0 deg
    // from the 4 m phase center; directly overhead it is at 90 deg, in the
    // cone of silence, and nothing is held.
    s.entities.push(entity('s1', 'sensor', 'lib-lstar', { x: 40000, y: 1000 })) // 10 km omni radar
    return s
  }

  it('invalidates the run and names the detect gate', () => {
    const result = assessRunValidity(spawnInRingScenario(), [assessment('u1')])
    expect(result.validity).toBe('invalid')
    const finding = result.findings.find((f) => f.id === 'spawn-in-ring')!
    expect(finding.severity).toBe('invalidating')
    expect(finding.uasIds).toEqual(['u1'])
    expect(finding.gates).toEqual(['detect'])
    expect(finding.message).toBe(
      'First detection not assessed: U1 starts inside detection coverage.',
    )
  })

  it('lists one finding for a threat held by two sensors', () => {
    const s = spawnInRingScenario()
    s.entities.push(entity('s2', 'sensor', 'lib-lstar', { x: 41000, y: 0 }))
    const finding = assessRunValidity(s, [assessment('u1')]).findings.find(
      (f) => f.id === 'spawn-in-ring',
    )!
    expect(finding.uasIds).toEqual(['u1'])
    expect(finding.message).toBe(
      'First detection not assessed: U1 starts inside detection coverage.',
    )
  })

  it('does not fire when the spawn point is outside every ring', () => {
    const s = cleanScenario()
    s.entities.push(entity('s1', 'sensor', 'lib-lstar', { x: 0, y: 0 }))
    const ids = assessRunValidity(s, [assessment('u1')]).findings.map((f) => f.id)
    expect(ids).not.toContain('spawn-in-ring')
  })
})

describe('limiting findings', () => {
  it('flags a laydown with no defended asset', () => {
    const s = emptyScenario()
    s.runMode = 'deterministic'
    addThreat(s, 'u1', { x: 40000, y: 0 })
    const finding = assessRunValidity(s, [assessment('u1')]).findings.find(
      (f) => f.id === 'no-defended-asset',
    )!
    expect(finding.severity).toBe('limiting')
    expect(finding.uasIds).toEqual([])
    expect(finding.gates).toEqual(['detect', 'track'])
    expect(finding.message).toBe(
      'No defended asset is placed. Warning time, arrival and leakage are not measurable.',
    )
  })

  it('does not flag a disabled asset as a placed asset', () => {
    const s = cleanScenario()
    s.entities[0].enabled = false
    const ids = assessRunValidity(s, [assessment('u1')]).findings.map((f) => f.id)
    expect(ids).toContain('no-defended-asset')
  })

  it('flags environment effects switched off while covariates are set', () => {
    const s = cleanScenario()
    s.environment.apply = false
    s.environment.precipitation = 'rain'
    s.environment.windSpeedMps = 6
    const finding = assessRunValidity(s, [assessment('u1')]).findings.find(
      (f) => f.id === 'environment-not-applied',
    )!
    expect(finding.severity).toBe('limiting')
    expect(finding.gates).toEqual(['detect', 'track', 'identify'])
    expect(finding.message).toContain('rain, wind 6 m/s')
  })

  it('does not flag environment effects switched off on a standard day', () => {
    const s = cleanScenario()
    s.environment.apply = false
    const ids = assessRunValidity(s, [assessment('u1')]).findings.map((f) => f.id)
    expect(ids).not.toContain('environment-not-applied')
  })

  it('flags threats with no flight path from the assessment status', () => {
    const s = cleanScenario()
    s.entities.push(entity('u2', 'uas', 'lib-mavic3', { x: 0, y: 5000 }))
    const finding = assessRunValidity(s, [
      assessment('u1'),
      assessment('u2', { status: 'no-path' }),
    ]).findings.find((f) => f.id === 'threat-without-path')!
    expect(finding.severity).toBe('limiting')
    expect(finding.uasIds).toEqual(['u2'])
    expect(finding.gates).toHaveLength(6)
  })

  it('flags a pathless threat the sweep never reported', () => {
    const s = cleanScenario()
    s.entities.push(entity('u2', 'uas', 'lib-mavic3', { x: 0, y: 5000 }))
    const finding = assessRunValidity(s, [assessment('u1')]).findings.find(
      (f) => f.id === 'threat-without-path',
    )!
    expect(finding.uasIds).toEqual(['u2'])
    expect(finding.message).toContain('U2')
  })
})

describe('gate helpers', () => {
  it('collects only invalidated tracks for the named gate', () => {
    const findings = assessRunValidity(
      (() => {
        const s = cleanScenario()
        // Elevation: 1 km off the spawn, so the 300 ft threat sits at 5.0 deg,
        // inside the LSTAR [0, 30] deg cone. On the spawn it is at 90 deg.
        s.entities.push(entity('s1', 'sensor', 'lib-lstar', { x: 40000, y: 1000 }))
        return s
      })(),
      [assessment('u1')],
    ).findings
    expect([...invalidatedTracksForGate(findings, 'detect')]).toEqual(['u1'])
    expect([...invalidatedTracksForGate(findings, 'track')]).toEqual([])
    expect(findingsForGate(findings, 'detect').map((f) => f.id)).toEqual([
      'spawn-in-ring',
      'planning-envelope',
      'unvalidated-model',
    ])
  })
})

describe('run basis findings', () => {
  it('limits every gate under the deterministic mode and clears under Monte Carlo', () => {
    const det = assessRunValidity(cleanScenario(), [assessment('u1')]).findings
    const finding = det.find((f) => f.id === 'planning-envelope')!
    expect(finding.severity).toBe('limiting')
    expect(finding.uasIds).toEqual([])
    expect(finding.gates).toHaveLength(6)
    expect(finding.message).toBe(
      'Point values from the threshold envelope. Run Monte Carlo for an interval.',
    )
    const s = cleanScenario()
    s.runMode = 'monte-carlo'
    expect(assessRunValidity(s, [assessment('u1')]).findings.map((f) => f.id)).not.toContain(
      'planning-envelope',
    )
  })

  it('names every unvalidated model the laydown uses', () => {
    const s = cleanScenario()
    s.entities.push(entity('e1', 'effector', 'lib-coyote', { x: 0, y: 0 }))
    const finding = assessRunValidity(s, [assessment('u1')]).findings.find(
      (f) => f.id === 'unvalidated-model',
    )!
    expect(finding.severity).toBe('limiting')
    expect(finding.gates).toHaveLength(6)
    expect(finding.message).toBe(
      'These models are not validated: Environment, Doctrine, Kinetic Pk, Classification. ' +
        'Their outputs are planning factors.',
    )
  })

  it('is absent when the table marks every used model validated', () => {
    const ids = assessRunValidity(cleanScenario(), [assessment('u1')], VALIDATED).findings.map(
      (f) => f.id,
    )
    expect(ids).not.toContain('unvalidated-model')
  })
})

describe('forecast-trial-disagreement', () => {
  function compare(
    forecastS: number | null,
    trialS: number | null,
    kills = 3,
    band = [2, 4],
    insideRing = false,
  ) {
    const s = cleanScenario()
    s.entities.push(
      entity('s1', 'sensor', 'lib-lstar', insideRing ? { x: 40000, y: 1000 } : { x: 0, y: 0 }),
    )
    s.library = s.library.map((model) =>
      model.id === 'lib-lstar' ? { ...model, sensor: { ...model.sensor!, updateRateS: 5 } } : model,
    )
    const mc = {
      durationS: 0,
      replicates: 40,
      kills: { lo: [band[0]], hi: [band[1]] },
      perThreat: { u1: { shipCount: 5 } },
    } as unknown as import('../playback/mcRun').McSummary
    return assessRunValidity(s, [assessment('u1', { firstDetectS: forecastS })], VALIDATED, {
      assessments: [assessment('u1', { firstDetectS: trialS })],
      kills,
      mc,
    }).findings.find((finding) => finding.id === 'forecast-trial-disagreement')
  }

  it.each([4.9, 5])(
    'does not fire for a detection difference of %s seconds within one scan',
    (difference) => {
      expect(compare(10, 10 + difference)).toBeUndefined()
    },
  )

  it.each([5.1, -5.1])(
    'fires beyond a scan in either direction (%s), naming both values',
    (difference) => {
      const finding = compare(10, 10 + difference)!
      expect(finding.message).toContain('deterministic forecast T+10 s')
      expect(finding.message).toContain(`simulated trial T+${10 + difference} s`)
      expect(finding.message).toContain('5 s scan period of S1')
      expect(finding.severity).toBe('limiting')
      expect(finding.gates).toEqual([])
    },
  )

  it.each([2, 3, 4])('keeps kills %s inside the inclusive band', (kills) => {
    expect(compare(10, 10, kills)).toBeUndefined()
  })

  it.each([1, 5])('fires outside either band end for kills %s, naming trial and band', (kills) => {
    const finding = compare(10, 10, kills)!
    expect(finding.message).toContain(`simulated trial ${kills}/5 members`)
    expect(finding.message).toContain('ensemble 95 % mean band 2 to 4/5 members through T+0 s')
  })

  it('keeps undefined times and unavailable bands unassessed', () => {
    expect(compare(null, 10)).toBeUndefined()
    expect(compare(10, null)).toBeUndefined()
    expect(compare(10, 10, 5, [NaN, NaN])).toBeUndefined()
  })

  it('reuses spawn-in-ring as the possible cause', () => {
    expect(compare(10, 0, 3, [2, 4], true)!.message).toContain(
      'Possible cause: spawn-in-ring. First detection not assessed: U1 starts inside detection coverage.',
    )
  })
})

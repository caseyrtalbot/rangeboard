import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario, Vec2 } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import { assessRunValidity, findingsForGate, invalidatedTracksForGate } from './runValidity'

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
  s.entities.push(entity('a1', 'asset', null, { x: 0, y: 0 }))
  addThreat(s, 'u1', { x: 40000, y: 0 })
  return s
}

describe('assessRunValidity rollup', () => {
  it('reports a clean laydown as valid with no findings', () => {
    const result = assessRunValidity(cleanScenario(), [assessment('u1')])
    expect(result.validity).toBe('valid')
    expect(result.findings).toHaveLength(0)
  })

  it('reports pending when no track was assessed', () => {
    expect(assessRunValidity(cleanScenario(), []).validity).toBe('pending')
  })

  it('reports valid-limited when only caveats apply', () => {
    const s = emptyScenario()
    addThreat(s, 'u1', { x: 40000, y: 0 })
    const result = assessRunValidity(s, [assessment('u1')])
    expect(result.validity).toBe('valid-limited')
    expect(result.findings.map((f) => f.id)).toEqual(['no-defended-asset'])
  })
})

describe('spawn-in-ring finding', () => {
  function spawnInRingScenario(): Scenario {
    const s = cleanScenario()
    s.entities.push(entity('s1', 'sensor', 'lib-lstar', { x: 40000, y: 0 })) // 10 km omni radar
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
      'Flight paths start inside a detect ring (detected at T0): U1 held by S1',
    )
  })

  it('lists one finding for a threat held by two sensors', () => {
    const s = spawnInRingScenario()
    s.entities.push(entity('s2', 'sensor', 'lib-lstar', { x: 41000, y: 0 }))
    const finding = assessRunValidity(s, [assessment('u1')]).findings.find(
      (f) => f.id === 'spawn-in-ring',
    )!
    expect(finding.uasIds).toEqual(['u1'])
    expect(finding.message).toContain('U1 held by S1, S2')
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
    addThreat(s, 'u1', { x: 40000, y: 0 })
    const finding = assessRunValidity(s, [assessment('u1')]).findings.find(
      (f) => f.id === 'no-defended-asset',
    )!
    expect(finding.severity).toBe('limiting')
    expect(finding.uasIds).toEqual([])
    expect(finding.gates).toEqual(['detect', 'track'])
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
        s.entities.push(entity('s1', 'sensor', 'lib-lstar', { x: 40000, y: 0 }))
        return s
      })(),
      [assessment('u1')],
    ).findings
    expect([...invalidatedTracksForGate(findings, 'detect')]).toEqual(['u1'])
    expect([...invalidatedTracksForGate(findings, 'track')]).toEqual([])
    expect(findingsForGate(findings, 'detect').map((f) => f.id)).toEqual(['spawn-in-ring'])
  })
})

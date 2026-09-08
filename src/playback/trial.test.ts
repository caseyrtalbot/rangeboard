import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario } from '../model/types'
import { idHash } from '../geometry/prng'
import { resolveEngagements } from './attrition'
import { prepareSweep, resolvedThresholds } from './detection'
import type { SensorScanObservation } from './detection'
import { monteCarloPolicy } from './policy'
import { assessAllThreats } from './sim'
import { runTrial } from './trial'
import { createTrialManifest, TRIAL_DRAW_POLICY_VERSION, TRIAL_ENGINE_REVISION } from './trialTypes'

function laydown(): Scenario {
  const scenario = emptyScenario()
  scenario.roe = 'free'
  scenario.seed = 4821
  scenario.doctrine!.enabled = false
  const entity = (id: string, kind: Entity['kind'], specId: string, y: number): Entity => ({
    id, kind, specId, name: id, pos: { x: 0, y }, headingDeg: 0, color: null, notes: '',
  })
  scenario.entities = [
    entity('radar', 'sensor', 'lib-giraffe1x', 0),
    entity('c2', 'c2', 'lib-faadc2', 0),
    entity('effector', 'effector', 'lib-coyote', -1697),
    { ...entity('uas', 'uas', 'lib-mohajer6', -5000), altitudeFt: 1000,
      formation: { count: 3, shape: 'line', spacingM: 100 } },
  ]
  scenario.connections = [
    { id: 'link-1', fromId: 'radar', toId: 'c2', label: '' },
    { id: 'link-2', fromId: 'c2', toId: 'effector', label: '' },
  ]
  scenario.paths = [{ id: 'path', entityId: 'uas', points: [{ x: 0, y: -5000 }, { x: 0, y: -800 }],
    speedMps: 30, startDelayS: 0 }]
  const target = scenario.library.find((model) => model.id === 'lib-mohajer6')!
  target.uas = { ...target.uas!, swerling: 1 }
  return scenario
}

describe('one nominal aleatory trial', () => {
  it('retains the complete existing policy assessments and ledger exactly and reproduces after transport', () => {
    const scenario = laydown()
    const original = structuredClone(scenario)
    const manifest = createTrialManifest(scenario, 'trial-fixed-id', 'fixed-basis')
    const policy = monteCarloPolicy(manifest.seed, manifest.replicateIndex, resolvedThresholds(scenario))
    const assessments = assessAllThreats(scenario, policy)
    const report = resolveEngagements(scenario, assessments, policy)
    const result = runTrial(scenario, manifest)
    expect(result.assessments).toEqual(assessments)
    expect(result.report).toEqual(report)
    expect(report.events.length).toBeGreaterThan(0)
    expect(result.observations.length).toBeGreaterThan(0)
    expect(result.report.events.every((event) => event.killDelta === 0 || event.killDelta === 1)).toBe(true)
    expect(runTrial(structuredClone(scenario), structuredClone(manifest))).toEqual(result)
    expect(scenario).toEqual(original)
    expect(Object.isFrozen(manifest)).toBe(true)
    expect(Object.isFrozen(result.manifest)).toBe(true)
    expect(manifest).toMatchObject({ replicateIndex: idHash('trial-fixed-id'), basis: 'nominal-aleatory',
      engineRevision: TRIAL_ENGINE_REVISION, drawPolicyVersion: TRIAL_DRAW_POLICY_VERSION, buildRevision: null })
    // Forecast/ensemble controls do not change the nominal trial's parameter basis.
    const total = { ...scenario, uncertainty: 'total' as const, runMode: 'monte-carlo' as const, replicates: 999 }
    expect(runTrial(total, manifest)).toEqual(result)
  })

  it('retains each continue-jam decision with its actual shared ledger draw identity', () => {
    const scenario = laydown()
    const target = scenario.library.find((model) => model.id === 'lib-mohajer6')!
    target.uas = { ...target.uas!, navMode: 'mixed', jamBehavior: 'continue' }
    const effector = scenario.library.find((model) => model.id === 'lib-coyote')!
    effector.effector = { effectorType: 'jammer', minRangeM: 0, maxRangeM: 10000,
      engageTimeS: 0, pk: 0.5, salvoCooldownS: 10 }
    const manifest = createTrialManifest(scenario, 'trial-jam', 'fixed-basis')
    const policy = monteCarloPolicy(manifest.seed, manifest.replicateIndex, resolvedThresholds(scenario))
    const result = runTrial(scenario, manifest)
    expect(result.jamDecisions.length).toBeGreaterThan(0)
    expect(result.report).toEqual(resolveEngagements(scenario, assessAllThreats(scenario, policy), policy))
    expect(result.jamDecisions).toHaveLength(result.report.events.length)
    for (const decision of result.jamDecisions) {
      const event = result.report.events.find((event) => event.effectorId === decision.effectorId &&
        event.uasId === decision.uasId && event.tEffectS === decision.tEffectS)!
      expect(event.channel).toBe('jam')
      expect(event.killDelta).toBe(0)
      expect(decision.outcome).toBe(policy.jam(decision.probability, decision.effectorId,
        decision.uasId, decision.tEffectS))
    }
  })

  it('rejects incompatible provenance and altered seed or run-derived index', () => {
    const scenario = laydown()
    const manifest = createTrialManifest(scenario, 'trial-fixed-id', 'fixed-basis')
    for (const altered of [
      { engineRevision: 'unknown' }, { drawPolicyVersion: 'unknown' },
      { seed: manifest.seed + 1 }, { replicateIndex: manifest.replicateIndex + 1 },
      { runId: '' }, { basisSignature: '' },
    ]) expect(() => runTrial(scenario, { ...manifest, ...altered })).toThrow()
  })

  it('keeps never-detected scans and holds separately without inventing between-scan decisions', () => {
    const scenario = laydown()
    const radar = scenario.library.find((model) => model.id === 'lib-giraffe1x')!
    radar.sensor = { ...radar.sensor!, updateRateS: 2 }
    const manifest = createTrialManifest(scenario, 'trial-hold', 'fixed-basis')
    const result = runTrial(scenario, manifest)
    const observations = result.observations.filter((sample) => sample.sensorId === 'radar')
    expect(observations.length).toBeGreaterThan(1)
    expect(observations.slice(1).every((sample, i) => sample.tS - observations[i].tS === 2)).toBe(true)
    const holds = result.assessments[0].sensorObservations![0]
    expect(holds.heldSamples).toBeGreaterThan(observations.length)
    expect(holds.intervals.some(([start, end]) => end > start)).toBe(true)
    radar.sensor.sectorDeg = 1
    scenario.entities[0].headingDeg = 180
    const missed = runTrial(scenario, manifest)
    expect(missed.assessments[0].status).toBe('never-detected')
    expect(missed.assessments[0].sensorObservations).toEqual([])
    expect(missed.observations.length).toBeGreaterThan(0)
    expect(missed.observations.every((sample) => sample.members.length === 0)).toBe(true)
    expect(missed.report.events).toEqual([])
  })

  it('maps nearest-first admitted draw ranks back to formation members and retains missed members', () => {
    const scenario = laydown()
    const sensor = scenario.entities[0]
    const target = scenario.library.find((model) => model.id === 'lib-mohajer6')!.uas!
    scenario.library.find((model) => model.id === 'lib-giraffe1x')!.sensor!.sectorDeg = 90
    const observations: SensorScanObservation[] = []
    const policy = monteCarloPolicy(4821, 4, resolvedThresholds(scenario))
    const calls: number[] = []
    const draw = { ...policy, detect: (_pd: number, _sensor: string, _uas: string, _t: number, rank: number) => {
      calls.push(rank)
      return rank === 1
    } }
    const sweep = prepareSweep(scenario, [sensor], undefined, target, 1000, draw,
      (sample) => observations.push(sample))
    sweep.hits([{ x: 0, y: -3000 }, { x: 0, y: -1000 }, { x: 0, y: -2000 },
      { x: 0, y: 1000 }], 'uas', 0)
    expect(calls).toEqual([0, 1, 2])
    expect(observations[0].members.map((member) => [member.memberIdx, member.drawIndex, member.detected]))
      .toEqual([[1, 0, false], [2, 1, true], [0, 2, false]])
    expect(observations[0].members.every((member) => member.pd != null)).toBe(true)
    sweep.hits([{ x: 0, y: -1000 }], 'uas', 0.5, { scanStep: () => false, holding: () => true })
    expect(observations).toHaveLength(1)
    expect(calls).toHaveLength(3)
    sweep.hits([{ x: 0, y: -3000 }, { x: 0, y: -1000 }, { x: 0, y: -1000 }], 'uas', 1)
    expect(observations[1].members.map((member) => member.memberIdx)).toEqual([1, 2, 0])
  })

  it('retains threshold-sensor misses and cue-gated attempts without new draws', () => {
    const scenario = laydown()
    const radar = scenario.library.find((model) => model.id === 'lib-giraffe1x')!
    radar.sensor = { sensorType: 'radar', rangeBasis: 'planning', detectRangeM: 2000,
      classifyRangeM: 1200, sectorDeg: 360 }
    const observations: SensorScanObservation[] = []
    const sweep = prepareSweep(scenario, [scenario.entities[0]], undefined, undefined, 10,
      undefined, (sample) => observations.push(sample))
    sweep.hits([{ x: 0, y: -1000 }, { x: 0, y: -3000 }], 'uas', 0)
    expect(observations[0].members.map((member) => [member.pd, member.detected, member.classified]))
      .toEqual([[null, true, true], [null, false, false]])
    radar.sensor = { ...radar.sensor, sensorType: 'eo-ir' }
    prepareSweep(scenario, [scenario.entities[0]], undefined, undefined, 10,
      undefined, (sample) => observations.push(sample)).hits([{ x: 0, y: -1000 }], 'uas', 0)
    expect(observations[1]).toMatchObject({ gate: 'needs-cue', cued: false, members: [] })
  })
})

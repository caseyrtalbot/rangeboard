import { emptyScenario } from '../../model/seed'
import type { Entity } from '../../model/types'
import { analysisBasisSignature } from '../../state/analysisBasis'
import { trialResultOf } from '../../analysis/trialResult'
import type { ThreatAssessment } from '../sim'
import type { EngagementEvent, ThreatAttrition } from '../attritionReport'
import type { TrialResult } from '../trialTypes'
import { createTrialManifest } from '../trialTypes'

export function trialEvent(over: Partial<EngagementEvent>): EngagementEvent {
  return { tS: 0, tReleaseS: 0.5, tEffectS: 2, effectorId: 'gun', uasId: 'swarm', shipIdx: 3,
    channel: 'kill', softShot: false, effectorType: 'gun', channelClass: 'kinetic', lateEffect: false,
    pk: 0.7, killDelta: 1, ...over }
}

export function trialAssessment(uasId: string, over: Partial<ThreatAssessment> = {}): ThreatAssessment {
  return { uasId, status: 'engageable', firstDetectS: null, firstDetectSensorId: null, firstConfirmS: null,
    techs: [], swarmMerged: false, cpaAssetId: null, cpaS: null, cpaDistanceM: null, assetId: null,
    closestApproachM: null, arrivalS: null, warningS: null, windowS: null, windowEffectorId: null,
    classificationAtS: { unknownAtS: null, suspectedAtS: null, hostileAtS: null }, engageGateS: null,
    detectingSensorIds: [], sensorObservations: [], effectorWindows: [], ...over }
}

export function mixedTrial() {
  const scenario = emptyScenario()
  const entity = (id: string, kind: Entity['kind'], count = 1): Entity => ({
    id, name: id, kind, specId: null, pos: { x: 0, y: 0 }, headingDeg: 90, color: null, notes: '',
    ...(kind === 'uas' ? { formation: { count, shape: 'line' as const, spacingM: 20 } } : {}),
  })
  scenario.entities = [entity('swarm', 'uas', 5), entity('moving', 'uas', 3), entity('parked', 'uas', 2),
    entity('flyby', 'uas'), { ...entity('radar', 'sensor'), specId: 'test-radar' },
    { ...entity('gun', 'effector'), specId: 'test-gun', systemId: 'system-a' },
    { ...entity('jammer', 'effector'), specId: 'test-jammer' }, entity('asset', 'asset')]
  scenario.library = [
    { id: 'test-radar', name: 'Radar', kind: 'sensor', builtin: false, description: '', color: '#fff', sensor: { sensorType: 'radar', detectRangeM: 10000, classifyRangeM: 1000, sectorDeg: 360 } },
    { id: 'test-gun', name: 'Gun', kind: 'effector', builtin: false, description: '', color: '#fff', effector: { effectorType: 'gun', minRangeM: 0, maxRangeM: 10000, engageTimeS: 0.5, pk: 0.7, magazineSize: 10 } },
    { id: 'test-jammer', name: 'Jammer', kind: 'effector', builtin: false, description: '', color: '#fff', effector: { effectorType: 'jammer', minRangeM: 0, maxRangeM: 10000, engageTimeS: 0, pk: 0.5 } },
  ]
  scenario.paths = ['swarm', 'moving', 'flyby'].map(id => ({ id: `path-${id}`, entityId: id,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 500 }], speedMps: 10, startDelayS: 0 }))
  const hold = { sensorId: 'radar', sensorType: 'radar' as const, firstDetectS: 1.1, lastDetectS: 6.6,
    firstClassifyS: 6.1, heldSamples: 10, resolvedEver: true, minSlantM: 20,
    intervals: [[1.1, 4.6], [6.1, 6.6]] as Array<[number, number]>, trackInitAtS: 2.1,
    coastIntervals: [[3.1, 4.6]] as Array<[number, number]> }
  const assessments = [trialAssessment('swarm', { firstDetectS: 1.1, firstDetectSensorId: 'radar', arrivalS: 5,
    classificationAtS: { unknownAtS: 1.1, suspectedAtS: 2.1, hostileAtS: 6.1 },
    sensorObservations: [hold], detectingSensorIds: ['radar'], engageGateS: 1.2,
    windowS: [1.2, 10], effectorWindows: [{ effectorId: 'jammer', intervals: [[0, 2], [5, 7]] },
      { effectorId: 'gun', intervals: [[1.2, 10]] }] }),
  trialAssessment('moving'), trialAssessment('parked', { status: 'no-path' }), trialAssessment('flyby', { status: 'never-detected' })]
  const events = [
    trialEvent({ uasId: 'moving', shipIdx: 2 }),
    trialEvent({ tS: 1.2, tReleaseS: 1.4, tEffectS: 1.5, shipIdx: 2, channel: 'jam', softShot: true, effectorId: 'jammer', effectorType: 'jammer', channelClass: 'ew', killDelta: 0 }),
    trialEvent({ tS: 1.3, tReleaseS: 1.8 }),
    trialEvent({ tS: 2, tReleaseS: 2.5, tEffectS: 3, shipIdx: 1, softShot: true, effectorId: 'jammer', effectorType: 'jammer', channelClass: 'ew' }),
    trialEvent({ tS: 2.5, tReleaseS: 3, tEffectS: 4, shipIdx: 3, killDelta: 0 }),
    trialEvent({ tS: 5, tReleaseS: 5.5, tEffectS: 6, shipIdx: 2, channel: 'jam', softShot: true, effectorId: 'jammer', effectorType: 'jammer', channelClass: 'ew', killDelta: 0, lateEffect: true }),
    trialEvent({ tS: 5.5, tReleaseS: 6, tEffectS: 8, shipIdx: 4, lateEffect: true }),
    trialEvent({ tS: 6, tReleaseS: 6.5, tEffectS: 9, shipIdx: 2, softShot: true, lateEffect: true, effectorId: 'jammer', effectorType: 'jammer', channelClass: 'ew' }),
  ]
  const threats: ThreatAttrition[] = assessments.filter(a => a.status !== 'no-path').map(a => {
    const shipCount = scenario.entities.find(e => e.id === a.uasId)!.formation!.count
    const own = events.filter(e => e.uasId === a.uasId)
    const count = (soft: boolean, late: boolean) => own.filter(e => e.softShot === soft && e.lateEffect === late).reduce((sum, e) => sum + e.killDelta, 0)
    const expectedKills = count(false, false) + count(true, false)
    return { uasId: a.uasId, shipCount, expectedKills, expectedHardKills: count(false, false), expectedSoftKills: count(true, false),
      expectedLateKills: count(false, true) + count(true, true), expectedLateHardKills: count(false, true), expectedLateSoftKills: count(true, true),
      arrived: a.arrivalS != null, expectedLeakers: a.arrivalS != null ? shipCount - expectedKills : 0,
      expectedNoArrival: a.arrivalS == null ? shipCount - expectedKills : 0, leakProbability: 1, continueJamProb: 0,
      firstShotS: own[0]?.tS ?? null, shotsFired: own.filter(e => e.channelClass === 'kinetic').length,
      deSalvos: 0, jamSalvos: own.filter(e => e.channelClass === 'ew').length, killedByEffectorId: null, killedBySoft: false }
  })
  const manifest = createTrialManifest(scenario, 'mixed-fixed-trial', analysisBasisSignature(scenario))
  const result: TrialResult = { manifest, assessments, report: { threats, events, effectors: [], totals: {
    raidSize: 9, expectedKills: 3, expectedHardKills: 2, expectedSoftKills: 1, expectedLateKills: 2,
    expectedLeakers: 3, expectedNoArrival: 3, reportedLeakers: 3, shotsFired: 4, deSalvos: 0, jamSalvos: 4,
  } }, observations: [
    { uasId: 'swarm', sensorId: 'radar', sensorType: 'radar', tS: 1.1, gate: 'ok', cued: false, resolved: true,
      members: [{ memberIdx: 3, drawIndex: 0, slantM: 40, pd: 0.9, detected: false, classified: false },
        { memberIdx: 1, drawIndex: 1, slantM: 50, pd: 0.8, detected: true, classified: false }] },
    { uasId: 'swarm', sensorId: 'radar', sensorType: 'radar', tS: 3.1, gate: 'ok', cued: false, resolved: true,
      members: [{ memberIdx: 1, drawIndex: 0, slantM: 30, pd: 0.6, detected: false, classified: false }] },
    { uasId: 'swarm', sensorId: 'radar', sensorType: 'radar', tS: 6.1, gate: 'ok', cued: false, resolved: true,
      members: [{ memberIdx: 1, drawIndex: 0, slantM: 20, pd: 0.5, detected: true, classified: true }] },
  ], jamDecisions: [
    { effectorId: 'jammer', uasId: 'swarm', tEffectS: 1.5, probability: 0.5, outcome: 1 },
    { effectorId: 'jammer', uasId: 'swarm', tEffectS: 6, probability: 0.5, outcome: 0 },
  ] }
  return { scenario, manifest, result, view: trialResultOf(scenario, manifest, result) }
}

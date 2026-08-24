import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity } from '../model/types'
import type { AttritionReport } from '../playback/attrition'
import type { DetectionHit, ThreatAssessment } from '../playback/sim'
import { systemTelemetryAt } from './systemTelemetry'

function entity(id: string, kind: Entity['kind'], specId: string, systemId?: string): Entity {
  return {
    id,
    name: id,
    kind,
    specId,
    pos: { x: 0, y: 0 },
    headingDeg: 0,
    color: null,
    notes: '',
    systemId,
  }
}

describe('systemTelemetryAt', () => {
  it('reports live sensor, C2, effector, effect, and capacity data by component', () => {
    const scenario = emptyScenario()
    const sensor = entity('sensor', 'sensor', 'lib-lstar', 'sys1')
    const c2 = entity('c2', 'c2', 'lib-faadc2', 'sys1')
    const effector = entity('effector', 'effector', 'lib-xm914', 'sys1')
    const threat = entity('threat', 'uas', 'lib-shahed136')
    scenario.entities.push(sensor, c2, effector, threat)
    scenario.connections.push(
      { id: 'c1', fromId: sensor.id, toId: c2.id, label: '' },
      { id: 'c2', fromId: c2.id, toId: effector.id, label: '' },
    )
    const assessment: ThreatAssessment = {
      uasId: threat.id,
      status: 'engageable',
      firstDetectS: 5,
      firstDetectSensorId: sensor.id,
      firstConfirmS: null,
      techs: ['radar'],
      swarmMerged: false,
      assetId: null,
      arrivalS: 60,
      closestApproachM: null,
      warningS: 55,
      windowS: [10, 30],
      windowEffectorId: effector.id,
      classificationAtS: { unknownAtS: 5, suspectedAtS: 5, hostileAtS: 10 },
      engageGateS: 5,
      detectingSensorIds: [sensor.id],
      sensorObservations: [
        {
          sensorId: sensor.id,
          sensorType: 'radar',
          firstDetectS: 5,
          lastDetectS: 30,
          firstClassifyS: 8,
          heldSamples: 51,
          resolvedEver: true,
          intervals: [[5, 30]],
        },
      ],
      effectorWindows: [{ effectorId: effector.id, intervals: [[10, 30]] }],
    }
    const report: AttritionReport = {
      threats: [],
      effectors: [],
      totals: {
        raidSize: 1,
        expectedKills: 0.5,
        expectedHardKills: 0.5,
        expectedSoftKills: 0,
        expectedLeakers: 0.5,
        shotsFired: 1,
        jamSalvos: 0,
      },
      events: [
        {
          tS: 10,
          tEffectS: 11,
          effectorId: effector.id,
          uasId: threat.id,
          shipIdx: 0,
          channel: 'kill',
          softShot: false,
          pk: 0.5,
          killDelta: 0.5,
        },
      ],
    }
    const hits = new Map<string, DetectionHit[]>([
      [
        threat.id,
        [{ sensorId: sensor.id, sensorType: 'radar', classified: true, resolved: true }],
      ],
    ])
    const groups = systemTelemetryAt(scenario, [assessment], report, 12, hits)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      activeComponents: 3,
      componentCount: 3,
      tracksNow: 1,
      tracksSeen: 1,
      salvosAssigned: 1,
      effectsLanded: 1,
      expectedKills: 0.5,
    })
    expect(groups[0].components.find((row) => row.entityId === sensor.id)).toMatchObject({
      state: 'tracking',
      tracksNow: 1,
      tracksSeen: 1,
      classifications: 1,
    })
    expect(groups[0].components.find((row) => row.entityId === c2.id)).toMatchObject({
      state: 'routing',
      tracksNow: 1,
      downstreamEffectors: 1,
    })
    expect(groups[0].components.find((row) => row.entityId === effector.id)).toMatchObject({
      state: 'cooldown',
      targetsNow: 1,
      salvosAssigned: 1,
      effectsLanded: 1,
      capacityRemaining: 29,
    })
  })
})

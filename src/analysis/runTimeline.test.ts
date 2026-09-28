import { describe, expect, it } from 'vitest'
import type { Entity, Scenario } from '../model/types'
import { mixedTrial, trialEvent } from '../playback/__fixtures__/trialFixture'
import type { TrackEstimate } from '../playback/trackTypes'
import { trackId } from '../playback/tracker'
import { createTrialManifest, type TrialResult } from '../playback/trialTypes'
import { analysisBasisSignature } from '../state/analysisBasis'
import type { RunTimelineModel, RunTimelineRow } from './runTimeline'
import { runTimelineOf } from './runTimeline'
import { trialResultOf } from './trialResult'

function estimate(id: string, tS: number, quality: number, coasting = false): TrackEstimate {
  return {
    id,
    uasId: id.includes(':false:') ? null : id.split(':')[1],
    sensorIds: ['radar'],
    state: { x: 0, y: 0, vx: 0, vy: 0, tS },
    covariance: new Array(16).fill(0),
    quality,
    hits: 1,
    misses: coasting ? 1 : 0,
    coasting,
    source: id.includes(':false:') ? 'false' : 'estimate',
  }
}

/**
 * mixedTrial plus a C2 node on every route, a second sensor, a disabled
 * platform, fused track summaries, a track ledger with one false track, a
 * killed threat (moving), a fly-by (flyby) and an event with no release time.
 */
function timelineTrial(
  edit?: (result: TrialResult) => void,
  editScenario?: (scenario: Scenario) => void,
) {
  const base = mixedTrial()
  const scenario = structuredClone(base.scenario)
  scenario.sweepStepS = 0.5
  const plain = (id: string, kind: Entity['kind']): Entity => ({
    id,
    name: id,
    kind,
    specId: null,
    pos: { x: 0, y: 0 },
    headingDeg: 90,
    color: null,
    notes: '',
  })
  scenario.entities.push(plain('c2', 'c2'), plain('eo', 'sensor'), {
    ...plain('spare', 'effector'),
    enabled: false,
  })
  scenario.entities.find((e) => e.id === 'moving')!.formation!.count = 1
  scenario.connections = [
    ['radar', 'c2'],
    ['c2', 'gun'],
    ['c2', 'jammer'],
  ].map(([fromId, toId]) => ({ id: `${fromId}-${toId}`, fromId, toId, label: '' }))
  editScenario?.(scenario)

  const result = structuredClone(base.result)
  const swarm = result.assessments.find((a) => a.uasId === 'swarm')!
  swarm.sensorObservations![0].intervals = [
    [1.1, 4.6],
    [6.1, 11.6],
  ]
  swarm.stableTrackAtS = 3
  swarm.fusedTrack = {
    initAtS: 1.15,
    lastAtS: 12,
    nodes: [{ c2Id: 'c2', fromS: 1.15 }],
    members: [
      { sensorId: 'radar', fromS: 1.15 },
      { sensorId: 'eo', fromS: 7 },
    ],
  }
  const moving = result.assessments.find((a) => a.uasId === 'moving')!
  Object.assign(moving, {
    firstDetectS: 0.5,
    arrivalS: 30,
    fusedTrack: {
      initAtS: 0.5,
      lastAtS: 1.5,
      nodes: [],
      members: [{ sensorId: 'radar', fromS: 0.5 }],
    },
  })
  const flyby = result.assessments.find((a) => a.uasId === 'flyby')!
  Object.assign(flyby, {
    status: 'detect-only',
    firstDetectS: 10,
    cpaS: 20,
    detectingSensorIds: ['radar'],
    classificationAtS: { unknownAtS: 10, suspectedAtS: null, hostileAtS: null },
    fusedTrack: {
      initAtS: 10,
      lastAtS: 14,
      nodes: [{ c2Id: 'c2', fromS: 10 }],
      members: [{ sensorId: 'radar', fromS: 10 }],
    },
  })
  result.report.events.find((e) => e.uasId === 'moving')!.shipIdx = 0
  // A release after the effect is malformed: release time unknown.
  result.report.events.push(
    trialEvent({ tS: 13, tReleaseS: 50, tEffectS: 14, uasId: 'flyby', shipIdx: 0, killDelta: 0 }),
  )
  result.report.events.sort((a, b) => a.tS - b.tS)
  result.report.threats.find((t) => t.uasId === 'moving')!.shipCount = 1
  const real = trackId('radar', 'swarm')
  const falseId = 'radar:false:0:0'
  result.tracks = [
    estimate(real, 1.5, 0.2),
    estimate(real, 3, 0.4),
    estimate(falseId, 3.5, 0.11),
    estimate(falseId, 4, 0.12),
    estimate(falseId, 4.5, 0.13, true),
    estimate(falseId, 5, 0.14, true),
    estimate(real, 6.5, 0.9),
    estimate(real, 9.5, 0.6),
    estimate(real, 11.5, 0.7),
  ]
  edit?.(result)
  const manifest = createTrialManifest(scenario, 'timeline-fixed', analysisBasisSignature(scenario))
  result.manifest = manifest
  return { view: trialResultOf(scenario, manifest, result), baseView: base.view }
}

function row(model: RunTimelineModel, key: string): RunTimelineRow | undefined {
  for (const group of model.groups)
    for (const r of group.rows) {
      if (r.key === key) return r
      const sub = r.subLanes?.find((s) => s.key === key)
      if (sub) return sub
    }
  return undefined
}

const spans = (r: RunTimelineRow | undefined) =>
  r!.spans.map((s) => [s.kind, s.startS, s.endS, ...(s.level !== undefined ? [s.level] : [])])
const marks = (r: RunTimelineRow | undefined) =>
  r!.marks.map((m) => [m.kind, m.tS, m.text, m.after].filter((v) => v !== undefined))

describe('runTimelineOf rows (SPEC 1.2)', () => {
  it('orders groups by side then kind, drops disabled platforms and empty groups', () => {
    const { view, baseView } = timelineTrial()
    const model = runTimelineOf(view, Infinity)
    expect(model.durationS).toBe(60)
    expect(model.groups.map((g) => [g.key, g.side, g.label])).toEqual([
      ['sensor', 'blue', 'Sensors'],
      ['c2', 'blue', 'C2'],
      ['track', 'blue', 'Tracks'],
      ['effector', 'blue', 'Effectors'],
      ['threat', 'red', 'Threats'],
    ])
    expect(model.groups.map((g) => g.rows.map((r) => r.key))).toEqual([
      ['sensor:radar', 'sensor:eo'],
      ['c2:c2'],
      ['track:swarm', 'track:moving', 'track:flyby', 'track:radar:false:0:0'],
      ['effector:gun', 'effector:jammer'],
      ['threat:swarm', 'threat:moving', 'threat:flyby'],
    ])
    expect(row(model, 'effector:spare')).toBeUndefined()
    expect(row(model, 'threat:parked')).toBeUndefined()
    // mixedTrial has no C2 node and no fused or false track.
    const base = runTimelineOf(baseView, Infinity)
    expect(base.groups.map((g) => g.key)).toEqual(['sensor', 'effector', 'threat'])
  })

  it('builds sensor sub-lanes with 5 s quality chunks, coast and detect marks', () => {
    const model = runTimelineOf(timelineTrial().view, Infinity)
    const threat = row(model, 'sensor:radar:swarm')
    expect(threat).toMatchObject({ label: 'swarm', entityId: 'swarm', kind: 'sensor' })
    expect(spans(threat)).toEqual([
      ['hold', 1.1, 3.1, 0.4],
      ['coast', 3.1, 5.1],
      ['hold', 6.1, 10, 0.6],
      ['hold', 10, 12.1, 0.7],
    ])
    expect(marks(threat)).toEqual([
      ['detect', 1.1, 'swarm'],
      ['detect', 6.1, 'swarm'],
    ])
    const ghost = row(model, 'sensor:radar:radar:false:0:0')
    expect(ghost).toMatchObject({ label: 'False track 1', entityId: null })
    expect(spans(ghost)).toEqual([
      ['hold', 3.5, 4.5, 0.13],
      ['coast', 4.5, 5.5],
    ])
    expect(marks(ghost)).toEqual([['detect', 3.5, 'False track 1']])
  })

  it('merges the sensor row: hold where any sub-lane holds, else coast', () => {
    const model = runTimelineOf(timelineTrial().view, Infinity)
    const radar = row(model, 'sensor:radar')!
    expect(radar).toMatchObject({ label: 'radar', meta: 'Radar', entityId: 'radar' })
    expect(radar.subLanes!.map((s) => s.key)).toEqual([
      'sensor:radar:swarm',
      'sensor:radar:radar:false:0:0',
    ])
    expect(spans(radar)).toEqual([
      ['hold', 1.1, 3.1],
      ['coast', 3.1, 3.5],
      ['hold', 3.5, 4.5],
      ['coast', 4.5, 5.5],
      ['hold', 6.1, 12.1],
    ])
    expect(marks(radar).map((m) => m[1])).toEqual([1.1, 3.5, 6.1])
    // An enabled platform is present with no items.
    expect(row(model, 'sensor:eo')).toMatchObject({ spans: [], marks: [], subLanes: [], meta: '' })
  })

  it('marks C2 init, firm and assignments on the node that formed and routed them', () => {
    const model = runTimelineOf(timelineTrial().view, Infinity)
    expect(marks(row(model, 'c2:c2'))).toEqual([
      ['init', 1.15, 'swarm'],
      ['assign', 1.2, 'jammer'],
      ['assign', 1.3, 'gun'],
      ['assign', 2, 'jammer'],
      ['assign', 2.5, 'gun'],
      ['firm', 3, 'swarm'],
      ['assign', 5, 'jammer'],
      ['assign', 5.5, 'gun'],
      ['assign', 6, 'jammer'],
      ['init', 10, 'flyby'],
      ['assign', 13, 'gun'],
    ])
  })

  it('keeps an assign mark on the assigning C2 node when a sensor first detects after the horizon', () => {
    // A second node with the faster route to the gun, fed by the eo sensor alone.
    // The eo sensor first held the swarm at 7 s, after the last gun assignment at 5.5.
    const twoNodes = (scenario: Scenario) => {
      scenario.entities.push({
        id: 'c2b',
        name: 'c2b',
        kind: 'c2',
        specId: null,
        pos: { x: 0, y: 0 },
        headingDeg: 90,
        color: null,
        notes: '',
      })
      scenario.connections.find((c) => c.id === 'radar-c2')!.latencyS = 10
      scenario.connections.push(
        { id: 'eo-c2b', fromId: 'eo', toId: 'c2b', label: '' },
        { id: 'c2b-gun', fromId: 'c2b', toId: 'gun', label: '' },
      )
    }
    const fullRun = (result: TrialResult) => {
      result.assessments.find((a) => a.uasId === 'swarm')!.detectingSensorIds = ['radar', 'eo']
    }
    const gunAssigns = (model: RunTimelineModel, key: string) =>
      marks(row(model, key)).filter(([kind, , text]) => kind === 'assign' && text === 'gun')

    // The ledger names the node that assigned each salvo: the marks stay on it.
    const recorded = timelineTrial((result) => {
      fullRun(result)
      for (const e of result.report.events) if (e.uasId === 'swarm') e.c2Id = 'c2'
    }, twoNodes).view
    const model = runTimelineOf(recorded, 6)
    expect(gunAssigns(model, 'c2:c2')).toEqual([
      ['assign', 1.3, 'gun'],
      ['assign', 2.5, 'gun'],
      ['assign', 5.5, 'gun'],
    ])
    expect(gunAssigns(model, 'c2:c2b')).toEqual([])

    // A legacy ledger has no field: the full-run routing puts the gun on c2b.
    const legacy = runTimelineOf(timelineTrial(fullRun, twoNodes).view, 6)
    expect(gunAssigns(legacy, 'c2:c2')).toEqual([])
    expect(gunAssigns(legacy, 'c2:c2b').map((m) => m[1])).toEqual([1.3, 2.5, 5.5])
  })

  it('builds real track rows with the ramp from init, assignments and a drop', () => {
    const model = runTimelineOf(timelineTrial().view, Infinity)
    const swarm = row(model, 'track:swarm')
    expect(swarm).toMatchObject({ label: 'swarm track', entityId: 'swarm', meta: 'radar, eo' })
    expect(spans(swarm)).toEqual([
      ['classify', 1.15, 2.1, 'unknown'],
      ['classify', 2.1, 6.1, 'suspected'],
      ['classify', 6.1, 12.5, 'hostile'],
    ])
    // Arrived before its last fused step: no drop.
    expect(marks(swarm)).toEqual([
      ['init', 1.15],
      ['assign', 1.2, 'jammer'],
      ['assign', 1.3, 'gun'],
      ['assign', 2, 'jammer'],
      ['assign', 2.5, 'gun'],
      ['firm', 3],
      ['assign', 5, 'jammer'],
      ['assign', 5.5, 'gun'],
      ['assign', 6, 'jammer'],
    ])
    // Killed: no drop.
    expect(marks(row(model, 'track:moving'))).toEqual([
      ['assign', 0, 'gun'],
      ['init', 0.5],
    ])
    const flyby = row(model, 'track:flyby')
    expect(spans(flyby)).toEqual([['classify', 10, 14.5, 'unknown']])
    expect(marks(flyby)).toEqual([
      ['init', 10],
      ['assign', 13, 'gun'],
      ['drop', 14.5],
    ])
  })

  it('builds false track rows after the real ones', () => {
    const model = runTimelineOf(timelineTrial().view, Infinity)
    const ghost = row(model, 'track:radar:false:0:0')
    expect(ghost).toMatchObject({ label: 'False track 1', entityId: null, meta: 'radar' })
    expect(spans(ghost)).toEqual([
      ['hold', 3.5, 4.5],
      ['coast', 4.5, 5.5],
    ])
    expect(marks(ghost)).toEqual([
      ['init', 3.5],
      ['drop', 5.5],
    ])
  })
})

describe('runTimelineOf effectors and threats (SPEC 1.2)', () => {
  it('builds effector preparation, flight, release with rounds left and effects', () => {
    const model = runTimelineOf(timelineTrial().view, Infinity)
    const gun = row(model, 'effector:gun')!
    expect(gun.meta).toBe('Gun · 10 rds')
    expect(gun.spans.map((s) => [s.kind, s.startS, s.endS, s.label])).toEqual([
      ['prep', 0, 0.5, 'moving'],
      ['flight', 0.5, 2, 'moving'],
      ['prep', 1.3, 1.8, 'swarm'],
      ['flight', 1.8, 2, 'swarm'],
      ['prep', 2.5, 3, 'swarm'],
      ['flight', 3, 4, 'swarm'],
      ['prep', 5.5, 6, 'swarm'],
      ['flight', 6, 8, 'swarm'],
      ['prep', 13, 14, 'release time unavailable'],
    ])
    expect(marks(gun)).toEqual([
      ['release', 0.5, 'moving', '9 left'],
      ['release', 1.8, 'swarm', '8 left'],
      ['hard-kill', 2, 'moving', 'pk 0.70'],
      ['hard-kill', 2, 'swarm', 'pk 0.70'],
      ['release', 3, 'swarm', '7 left'],
      ['miss', 4, 'swarm', 'pk 0.70'],
      ['release', 6, 'swarm', '6 left'],
      ['hard-kill', 8, 'swarm', 'pk 0.70'],
      ['miss', 14, 'flyby', 'pk 0.70'],
    ])
  })

  it('builds jammer dwell, jam decisions and mission kills', () => {
    const model = runTimelineOf(timelineTrial().view, Infinity)
    const jammer = row(model, 'effector:jammer')!
    expect(jammer.meta).toBe('Jammer')
    expect(spans(jammer)).toEqual([
      ['prep', 1.2, 1.4],
      ['dwell', 1.4, 1.5],
      ['prep', 2, 2.5],
      ['dwell', 2.5, 3],
      ['prep', 5, 5.5],
      ['dwell', 5.5, 6],
      ['prep', 6, 6.5],
      ['dwell', 6.5, 9],
    ])
    expect(marks(jammer)).toEqual([
      ['release', 1.4, 'swarm'],
      ['jam-decision', 1.5, 'swarm', 'pk 0.70'],
      ['release', 2.5, 'swarm'],
      ['mission-kill', 3, 'swarm', 'pk 0.70'],
      ['release', 5.5, 'swarm'],
      ['jam-decision', 6, 'swarm', 'pk 0.70'],
      ['release', 6.5, 'swarm'],
      ['mission-kill', 9, 'swarm', 'pk 0.70'],
    ])
  })

  it('builds a leaker threat: undetected, ramp to arrival, windows, shots, effects', () => {
    const model = runTimelineOf(timelineTrial().view, Infinity)
    const swarm = row(model, 'threat:swarm')!
    expect(swarm).toMatchObject({ kind: 'threat', label: 'swarm', meta: '×5', entityId: 'swarm' })
    expect(swarm.spans.map((s) => [s.kind, s.startS, s.endS, s.level ?? s.label])).toEqual([
      ['undetected', 0, 1.1, undefined],
      ['window', 0, 2.5, 'jammer'],
      ['classify', 1.1, 2.1, 'unknown'],
      ['window', 1.2, 10.5, 'gun'],
      ['classify', 2.1, 5, 'suspected'],
      ['window', 5, 7.5, 'jammer'],
    ])
    expect(swarm.marks.map((m) => [m.kind, m.tS, m.text])).toEqual([
      ['shot', 1.4, 'jammer'],
      ['jam-decision', 1.5, 'jammer'],
      ['shot', 1.8, 'gun'],
      ['hard-kill', 2, 'gun'],
      ['shot', 2.5, 'jammer'],
      ['mission-kill', 3, 'jammer'],
      ['shot', 3, 'gun'],
      ['miss', 4, 'gun'],
      ['arrival', 5, undefined],
      ['shot', 5.5, 'jammer'],
      ['jam-decision', 6, 'jammer'],
      ['shot', 6, 'gun'],
      ['shot', 6.5, 'jammer'],
      ['hard-kill', 8, 'gun'],
      ['mission-kill', 9, 'jammer'],
    ])
  })

  it('draws a ghost to the planned arrival after a kill, and a CPA for a fly-by', () => {
    const model = runTimelineOf(timelineTrial().view, Infinity)
    const moving = row(model, 'threat:moving')
    expect(moving!.meta).toBe('')
    expect(spans(moving)).toEqual([
      ['undetected', 0, 0.5],
      ['ghost', 2, 30],
    ])
    expect(marks(moving)).toEqual([
      ['shot', 0.5, 'gun'],
      ['hard-kill', 2, 'gun', 'pk 0.70'],
    ])
    const flyby = row(model, 'threat:flyby')
    expect(spans(flyby)).toEqual([
      ['undetected', 0, 10],
      ['classify', 10, 60, 'unknown'],
    ])
    // Release unknown: no shot mark, the effect still draws.
    expect(marks(flyby)).toEqual([
      ['miss', 14, 'gun', 'pk 0.70'],
      ['cpa', 20],
    ])
  })
})

describe('runTimelineOf horizon (SPEC 1.4) and memo (SPEC 2.4)', () => {
  it('draws a mark exactly at the horizon and clips a span at it', () => {
    const model = runTimelineOf(timelineTrial().view, 2)
    expect(model.horizonS).toBe(2)
    expect(marks(row(model, 'effector:gun'))).toEqual([
      ['release', 0.5, 'moving', '9 left'],
      ['release', 1.8, 'swarm', '8 left'],
      ['hard-kill', 2, 'moving', 'pk 0.70'],
      ['hard-kill', 2, 'swarm', 'pk 0.70'],
    ])
    expect(spans(row(model, 'threat:swarm'))).toEqual([
      ['undetected', 0, 1.1],
      ['window', 0, 2],
      ['classify', 1.1, 2, 'unknown'],
      ['window', 1.2, 2],
    ])
    // A span starting exactly at the horizon has zero width and does not draw.
    expect(spans(row(model, 'effector:jammer'))).toEqual([
      ['prep', 1.2, 1.4],
      ['dwell', 1.4, 1.5],
    ])
  })

  it('reads a clipped chunk level at the horizon, never from a later estimate', () => {
    const view = timelineTrial().view
    expect(spans(row(runTimelineOf(view, 8), 'sensor:radar:swarm'))).toEqual([
      ['hold', 1.1, 3.1, 0.4],
      ['coast', 3.1, 5.1],
      ['hold', 6.1, 8, 0.9],
    ])
    expect(spans(row(runTimelineOf(view, 2), 'sensor:radar:swarm'))).toEqual([
      ['hold', 1.1, 2, 0.2],
    ])
  })

  it('shows a track row and a sub-lane only once their first item is reached', () => {
    const view = timelineTrial().view
    const before = runTimelineOf(view, 1.14)
    expect(row(before, 'track:swarm')).toBeUndefined()
    expect(row(before, 'track:moving')).toBeDefined()
    // The assignment at 0 comes before the fused track at 0.5.
    expect(row(runTimelineOf(view, 0.2), 'track:moving')).toBeUndefined()
    expect(row(before, 'sensor:radar')!.subLanes!.map((s) => s.key)).toEqual(['sensor:radar:swarm'])
    const at = runTimelineOf(view, 1.15)
    expect(row(at, 'track:swarm')).toMatchObject({ spans: [], marks: [{ kind: 'init', tS: 1.15 }] })
    expect(row(at, 'track:swarm')!.meta).toBe('radar')
    expect(row(runTimelineOf(view, 7), 'track:swarm')!.meta).toBe('radar, eo')
  })

  it('keeps platform and threat rows below zero and omits the track group', () => {
    const view = timelineTrial().view
    for (const h of [-1, NaN]) {
      const model = runTimelineOf(view, h)
      expect(model.horizonS).toBe(Number.isNaN(h) ? -Infinity : -1)
      expect(model.groups.map((g) => g.key)).toEqual(['sensor', 'c2', 'effector', 'threat'])
      for (const group of model.groups)
        for (const r of group.rows) {
          expect(r.spans).toEqual([])
          expect(r.marks).toEqual([])
          expect(r.subLanes ?? []).toEqual([])
        }
    }
  })

  it('caps the horizon at the observed bound and returns full rows at the duration', () => {
    const view = timelineTrial().view
    const full = runTimelineOf(view, 60)
    expect(runTimelineOf(view, 1000)).toBe(full)
    expect(full.horizonS).toBe(60)
    const radar = row(full, 'sensor:radar')!
    expect(spans(radar).at(-1)).toEqual(['hold', 6.1, 12.1])
    expect(row(full, 'threat:flyby')!.spans.at(-1)!.endS).toBe(60)
  })

  it('keeps a drop and a CPA that come before a later kill', () => {
    const view = timelineTrial((result) => {
      result.report.events.push(
        trialEvent({ tS: 24, tReleaseS: 24.5, tEffectS: 25, uasId: 'flyby', shipIdx: 0 }),
      )
    }).view
    for (const h of [22, 60]) {
      const model = runTimelineOf(view, h)
      expect(marks(row(model, 'track:flyby')).map((m) => m[0])).toContain('drop')
      expect(marks(row(model, 'threat:flyby')).map((m) => m[0])).toContain('cpa')
    }
    const full = row(runTimelineOf(view, 60), 'threat:flyby')
    expect(marks(full).map((m) => m[0])).toContain('hard-kill')
    // No planned arrival: the ghost runs to the path end.
    expect(spans(full).at(-1)).toEqual(['ghost', 25, 60])
  })

  it('returns the same model for the same horizon and the same row once fully reached', () => {
    const view = timelineTrial().view
    const at20 = runTimelineOf(view, 20)
    expect(runTimelineOf(view, 20)).toBe(at20)
    const at30 = runTimelineOf(view, 30)
    expect(row(at30, 'effector:jammer')).toBe(row(at20, 'effector:jammer'))
    expect(row(at30, 'sensor:radar')).toBe(row(at20, 'sensor:radar'))
    // The ghost runs to 30: clipped at 20, whole at 30 and after.
    expect(row(at30, 'threat:moving')).not.toBe(row(at20, 'threat:moving'))
    expect(row(runTimelineOf(view, 60), 'threat:moving')).toBe(row(at30, 'threat:moving'))
    // A reached sub-lane keeps its identity while its sensor row is clipped.
    const at8 = runTimelineOf(view, 8)
    const falseLane = 'sensor:radar:radar:false:0:0'
    expect(row(at8, 'sensor:radar')).not.toBe(row(at20, 'sensor:radar'))
    expect(row(at8, falseLane)).toBe(row(at20, falseLane))
  })
})

describe('runTimelineOf review cases', () => {
  it('ends a formation at the effect that removes its last member', () => {
    // A fifth kill: the members fall at 2, 3, 4, 8 and 9 s.
    const view = timelineTrial((result) => {
      result.report.events.push(trialEvent({ tS: 3.5, tReleaseS: 3.6, tEffectS: 4, shipIdx: 0 }))
      result.report.events.sort((a, b) => a.tS - b.tS)
    }).view
    const swarm = row(runTimelineOf(view, 60), 'threat:swarm')
    // Windows stop at 9 s. The last member falls after the arrival at 5 s: no ghost.
    expect(spans(swarm).filter(([kind]) => kind === 'window')).toEqual([
      ['window', 0, 2.5],
      ['window', 1.2, 9],
      ['window', 5, 7.5],
    ])
    expect(spans(swarm).some(([kind]) => kind === 'ghost')).toBe(false)
    expect(marks(swarm).map((m) => m[0])).toContain('arrival')
  })

  it('draws a directed-energy event as a burst', () => {
    const view = timelineTrial((result) => {
      result.report.events.find((e) => e.tS === 1.3)!.channelClass = 'directed-energy'
    }).view
    expect(spans(row(runTimelineOf(view, 60), 'effector:gun'))).toContainEqual(['burst', 1.8, 2])
  })

  it('draws holds without a level and no false track when the run kept no estimates', () => {
    const view = timelineTrial((result) => {
      delete result.tracks
    }).view
    const model = runTimelineOf(view, 60)
    expect(row(model, 'sensor:radar:swarm')!.spans.every((s) => s.level === undefined)).toBe(true)
    expect(row(model, 'track:radar:false:0:0')).toBeUndefined()
  })

  it('marks init on each node that held the picture and firm on the nodes that held it by then', () => {
    const view = timelineTrial((result) => {
      result.assessments.find((a) => a.uasId === 'swarm')!.fusedTrack!.nodes = [
        { c2Id: 'c2', fromS: 4 },
      ]
    }).view
    const c2 = marks(row(runTimelineOf(view, 60), 'c2:c2')).filter(([kind]) => kind !== 'assign')
    // The node took the picture at 4 s, after the firm track at 3 s.
    expect(c2).toEqual([
      ['init', 4, 'swarm'],
      ['init', 10, 'flyby'],
    ])
  })

  it('numbers false tracks by first estimate, not ledger order', () => {
    const view = timelineTrial((result) => {
      result.tracks = [...result.tracks!, estimate('eo:false:0:0', 3, 0.3)]
    }).view
    const early = runTimelineOf(view, 3.2)
    expect(row(early, 'track:eo:false:0:0')!.label).toBe('False track 1')
    expect(row(early, 'track:radar:false:0:0')).toBeUndefined()
    expect(row(runTimelineOf(view, 60), 'track:radar:false:0:0')!.label).toBe('False track 2')
  })
})

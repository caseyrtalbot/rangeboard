import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { LadderSpan } from '../charts/types'
import type { Connection, Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import { MOUNT_HEIGHT_M } from '../model/types'
import { DT } from '../playback/sim'
import { PHASE_STYLE } from '../playback/trackState'
import { scenarioDurationS } from '../state/store'
import { CHART_SLOT_TOKENS, OTHER_TOKEN } from '../charts/tokens'
import { FT_TO_M } from './sensorEnv'
import { engagementPicture } from './impact'
import {
  effectorSeries,
  groupResidualSeries,
  heldTracksSeries,
  kpiSeries,
  meanHeldPdSeries,
  phaseLadderRow,
  releaseLadderRows,
  salvoMarks,
  salvosInFlightSeries,
  sampleCount,
  scanLoadSeries,
  sensorSeries,
  systemSeries,
  threatSeries,
  TRACK_LADDER_STYLE,
  trackLadderRows,
  trackMarks,
  trackSlots,
} from './series'

/** Planning-basis radar: no RCS scaling and no Pd model, so detection is the range test. */
function radar(detectRangeM: number): SpecModel {
  return {
    id: 'tst-radar',
    name: 'test radar',
    kind: 'sensor',
    description: '',
    color: '#fff',
    builtin: false,
    sensor: {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM,
      classifyRangeM: null,
      sectorDeg: 360,
      rangeBasis: 'planning',
    },
  }
}

/** Group 4 fixed-wing target: size penalty 1.0 and no evasion penalty. */
const TARGET: SpecModel = {
  id: 'tst-uas',
  name: 'test uas',
  kind: 'uas',
  description: '',
  color: '#fff',
  builtin: false,
  uas: {
    group: 4,
    airframe: 'fixed-wing',
    cruiseSpeedMps: 40,
    maxSpeedMps: 60,
    enduranceMin: 60,
    altBandFt: [0, 5000],
    navMode: 'gps',
    emissionsNote: '',
  },
}

const INTERCEPTOR: SpecModel = {
  id: 'tst-int',
  name: 'test interceptor',
  kind: 'effector',
  description: '',
  color: '#fff',
  builtin: false,
  effector: {
    effectorType: 'interceptor',
    minRangeM: 0,
    maxRangeM: 1000,
    engageTimeS: 0,
    pk: 0.5,
    magazineSize: 10,
    salvoCooldownS: 1000,
  },
}

/** Planning-basis scan radar at 1 Hz: a missed scan coasts, five misses drop. */
const SCAN_RADAR: SpecModel = {
  ...radar(3000),
  id: 'tst-scan',
  sensor: { ...radar(3000).sensor!, updateRateS: 1 },
}

/** Threats fly at the mount height, so slant range equals ground range. */
const FIXTURE_ALT_FT = MOUNT_HEIGHT_M / FT_TO_M

let seq = 0
function ent(
  kind: Entity['kind'],
  specId: string | null,
  pos: Vec2,
  extra?: Partial<Entity>,
): Entity {
  seq += 1
  return {
    id: `${kind}-${seq}`,
    name: `${kind}-${seq}`,
    kind,
    specId,
    pos,
    headingDeg: 0,
    color: null,
    notes: '',
    ...(kind === 'uas' ? { altitudeFt: FIXTURE_ALT_FT } : {}),
    ...extra,
  }
}

function link(fromId: string, toId: string, latencyS?: number): Connection {
  seq += 1
  return { id: `con-${seq}`, fromId, toId, label: '', ...(latencyS != null ? { latencyS } : {}) }
}

function flight(entityId: string, points: Vec2[], startDelayS = 0): FlightPath {
  seq += 1
  return { id: `path-${seq}`, entityId, points, speedMps: 40, startDelayS }
}

function legacyScenario(): Scenario {
  const s = emptyScenario()
  s.doctrine = { ...s.doctrine!, enabled: false }
  return s
}

/**
 * Radar and interceptor at the origin on a direct link, one threat flying
 * east through the 1000 m envelope, asset 2500 m east so the kill lands
 * before arrival. Detection at t = 0, first shot at t = 5.5.
 */
function killScenario(): { scenario: Scenario; sensorId: string; effId: string; uasId: string } {
  const scenario = legacyScenario()
  scenario.library = [...scenario.library, radar(50000), TARGET, INTERCEPTOR]
  const sensor = ent('sensor', 'tst-radar', { x: 0, y: 0 })
  const eff = ent('effector', 'tst-int', { x: 0, y: 0 })
  const uas = ent('uas', 'tst-uas', { x: -1210, y: 0 })
  const asset = ent('asset', null, { x: 2500, y: 0 })
  scenario.entities = [sensor, eff, uas, asset]
  scenario.connections = [link(sensor.id, eff.id, 2)]
  scenario.paths = [flight(uas.id, [{ x: -1210, y: 0 }, { x: 3000, y: 0 }])]
  return { scenario, sensorId: sensor.id, effId: eff.id, uasId: uas.id }
}

/** Giraffe 1X (scan model, Pd model) against a Swerling 1 fixed-wing inbound from 15 km. */
function pdScenario(): { scenario: Scenario; sensorId: string; uasId: string } {
  const scenario = legacyScenario()
  const mohajer = scenario.library.find((m) => m.id === 'lib-mohajer6')!
  const target: SpecModel = {
    ...mohajer,
    id: 'tst-mohajer',
    builtin: false,
    uas: { ...mohajer.uas!, swerling: 1 },
  }
  scenario.library = [...scenario.library, target]
  const sensor = ent('sensor', 'lib-giraffe1x', { x: 0, y: 0 })
  const uas = ent('uas', 'tst-mohajer', { x: -15000, y: 0 })
  scenario.entities = [sensor, uas]
  scenario.paths = [flight(uas.id, [{ x: -15000, y: 0 }, { x: 0, y: 0 }])]
  return { scenario, sensorId: sensor.id, uasId: uas.id }
}

/**
 * A 2000 m radar at the origin and `count` threats: the first three start
 * 3, 4 and 5 km west (detected at 25, 50 and 75 s), the rest fly 50 km
 * north of the radar and are never detected.
 */
function slotScenario(count: number): { scenario: Scenario; ids: string[] } {
  const scenario = legacyScenario()
  scenario.library = [...scenario.library, radar(2000), TARGET]
  const sensor = ent('sensor', 'tst-radar', { x: 0, y: 0 })
  const threats: Entity[] = []
  const paths: FlightPath[] = []
  for (let i = 0; i < count; i += 1) {
    const detected = i < 3
    const y = detected ? 0 : 50000
    const x0 = detected ? -3000 - 1000 * i : -3000
    const uas = ent('uas', 'tst-uas', { x: x0, y })
    threats.push(uas)
    paths.push(flight(uas.id, [{ x: x0, y }, { x: 1000, y }]))
  }
  // Entity order is the reverse of detection order, so the sort must do the work.
  scenario.entities = [sensor, ...threats.slice().reverse()]
  scenario.paths = paths
  return { scenario, ids: threats.map((t) => t.id) }
}

/**
 * The scan radar at the origin and a Mavic 3 flying `points` at 60 m/s.
 * The 3000 m ring is the only gate, so a leg past 3000 m is a missed scan.
 */
function coastScenario(points: Vec2[]): { scenario: Scenario; sensorId: string; uasId: string } {
  const scenario = legacyScenario()
  scenario.library = [...scenario.library, SCAN_RADAR]
  const sensor = ent('sensor', 'tst-scan', { x: 0, y: 0 })
  const uas = ent('uas', 'lib-mavic3', points[0])
  scenario.entities = [sensor, uas]
  scenario.paths = [{ ...flight(uas.id, points), speedMps: 60 }]
  return { scenario, sensorId: sensor.id, uasId: uas.id }
}

/** The kill scenario with a 4 s interceptor flight, so a salvo has width. */
function flightScenario(): ReturnType<typeof killScenario> {
  const out = killScenario()
  out.scenario.library = out.scenario.library.map((m) =>
    m.id === 'tst-int' ? { ...m, effector: { ...m.effector!, engageTimeS: 4 } } : m,
  )
  return out
}

describe('sampleCount and series length', () => {
  it('samples ceil(duration / DT) + 1 points on every builder', () => {
    const { scenario, sensorId, effId, uasId } = killScenario()
    const n = Math.ceil(scenarioDurationS(scenario) / DT) + 1
    expect(sampleCount(scenario)).toBe(n)
    const all = [
      ...kpiSeries(scenario),
      ...sensorSeries(scenario, sensorId),
      ...effectorSeries(scenario, effId),
      ...threatSeries(scenario, uasId),
      ...systemSeries(scenario),
    ]
    expect(all.length).toBeGreaterThan(0)
    for (const s of all) expect(s.values.length).toBe(n)
  })

  it('is pure: a second call returns equal arrays', () => {
    const { scenario, sensorId, effId, uasId } = killScenario()
    expect(kpiSeries(scenario)).toEqual(kpiSeries(scenario))
    expect(sensorSeries(scenario, sensorId)).toEqual(sensorSeries(scenario, sensorId))
    expect(effectorSeries(scenario, effId)).toEqual(effectorSeries(scenario, effId))
    expect(threatSeries(scenario, uasId)).toEqual(threatSeries(scenario, uasId))
    expect(systemSeries(scenario)).toEqual(systemSeries(scenario))
  })
})

describe('kpiSeries', () => {
  it('ends at the run totals', () => {
    const { scenario } = killScenario()
    const { report } = engagementPicture(scenario)
    const byId = new Map(kpiSeries(scenario).map((s) => [s.id, s]))
    expect([...byId.keys()]).toEqual([
      'kpi.detected', 'kpi.classified', 'kpi.targetable', 'kpi.engaged', 'kpi.kineticShots',
      'kpi.deSalvos', 'kpi.jamSalvos', 'kpi.expectedKills', 'kpi.lateKills',
      'kpi.arrivedTracks', 'kpi.leakerShips',
    ])
    const last = (id: string) => byId.get(id)!.values.at(-1)!
    expect(report.totals.expectedKills).toBeGreaterThan(0)
    expect(last('kpi.expectedKills')).toBeCloseTo(report.totals.expectedKills, 9)
    expect(last('kpi.leakerShips')).toBeCloseTo(report.totals.expectedLeakers, 9)
    expect(last('kpi.kineticShots')).toBe(report.totals.shotsFired)
    expect(byId.get('kpi.detected')!.values[0]).toBe(1)
    expect(byId.get('kpi.jamSalvos')!.color).toBe('ew')
    for (const s of byId.values()) expect(s.kind).toBe('step')
  })
})

describe('threatSeries', () => {
  it('residual runs from shipCount to shipCount minus all kill mass', () => {
    const { scenario, uasId } = killScenario()
    const { report } = engagementPicture(scenario)
    const att = report.threats.find((t) => t.uasId === uasId)!
    const residual = threatSeries(scenario, uasId).find((s) => s.id === 'residual')!
    expect(residual.unit).toBe('ships')
    expect(residual.values[0]).toBe(att.shipCount)
    expect(att.expectedKills).toBeGreaterThan(0)
    expect(residual.values.at(-1)).toBeCloseTo(
      att.shipCount - att.expectedKills - att.expectedLateKills,
      9,
    )
  })

  it('phase is a PHASE_STYLE index, non-decreasing until a ghost', () => {
    const { scenario, uasId } = killScenario()
    const phase = threatSeries(scenario, uasId).find((s) => s.id === 'phase')!
    const ghost = Object.keys(PHASE_STYLE).indexOf('ghost')
    expect(ghost).toBe(6)
    let prev = 0
    for (const v of phase.values) {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(6)
      if (prev === ghost) break
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
    const engaged = Object.keys(PHASE_STYLE).indexOf('engaged')
    expect(phase.values.at(-1)).toBeGreaterThanOrEqual(engaged)
  })

  it('carries one Pd series per radar observation, colored by sensor order', () => {
    const { scenario, sensorId, uasId } = pdScenario()
    const pd = threatSeries(scenario, uasId).find((s) => s.id === `pd.${sensorId}`)!
    expect(pd.kind).toBe('line')
    expect(pd.color).toBe(CHART_SLOT_TOKENS[0])
  })
})

describe('sensorSeries', () => {
  it('remaps pdSeries onto the t = 0 grid', () => {
    const { scenario, sensorId, uasId } = pdScenario()
    const { assessments } = engagementPicture(scenario)
    const obs = assessments
      .find((a) => a.uasId === uasId)!
      .sensorObservations!.find((o) => o.sensorId === sensorId)!
    expect(obs.pdSeries!.length).toBeGreaterThan(10)
    expect(obs.firstDetectS).toBeGreaterThan(0)
    const pd = sensorSeries(scenario, sensorId).find((s) => s.id === `pd.${uasId}`)!
    const offset = Math.round(obs.firstDetectS / DT)
    for (let i = 0; i < offset; i += 1) expect(pd.values[i]).toBeNaN()
    for (const k of [0, 5, obs.pdSeries!.length - 1]) {
      expect(pd.values[offset + k]).toBe(obs.pdSeries![k])
    }
  })

  it('slant range equals ground range at the mount height and the hold flag is 0/1', () => {
    const { scenario, sensorId, uasId } = pdScenario()
    const byId = new Map(sensorSeries(scenario, sensorId).map((s) => [s.id, s]))
    const slant = byId.get(`slant.${uasId}`)!
    expect(slant.unit).toBe('m')
    expect(slant.values[0]).toBeCloseTo(15000, 6)
    expect(slant.values[Math.round(100 / DT)]).toBeCloseTo(15000 - 40 * 100, 6)
    const held = byId.get(`held.${uasId}`)!
    expect(held.kind).toBe('step')
    expect(held.values[0]).toBe(0)
    expect(held.values.every((v) => v === 0 || v === 1)).toBe(true)
    expect(held.values.some((v) => v === 1)).toBe(true)
  })
})

describe('effectorSeries', () => {
  it('holds the latest Pk, counts salvos and drains the magazine', () => {
    const { scenario, effId, uasId } = killScenario()
    const { report } = engagementPicture(scenario)
    const ev = report.events.find((e) => e.effectorId === effId)!
    const byId = new Map(effectorSeries(scenario, effId).map((s) => [s.id, s]))
    const pk = byId.get(`pk.${uasId}`)!
    const at = Math.round(ev.tS / DT)
    expect(pk.values[at - 1]).toBeNaN()
    expect(pk.values[at]).toBe(ev.pk)
    const rounds = byId.get('rounds')!
    expect(rounds.unit).toBe('rounds')
    expect(rounds.values[0]).toBe(10)
    expect(rounds.values.at(-1)).toBe(10 - report.totals.shotsFired)
    expect(byId.get('salvos')!.values.at(-1)).toBe(report.totals.shotsFired)
  })

  it('yields no rounds series for an unlimited magazine', () => {
    const { scenario, effId } = killScenario()
    const model = scenario.library.find((m) => m.id === 'tst-int')!
    const unlimited = { ...model, effector: { ...model.effector!, magazineSize: undefined } }
    scenario.library = scenario.library.map((m) => (m.id === 'tst-int' ? unlimited : m))
    const ids = effectorSeries(scenario, effId).map((s) => s.id)
    expect(ids).not.toContain('rounds')
    expect(ids).toContain('salvos')
  })
})

describe('systemSeries and trackMarks', () => {
  it('holds detect-to-shot latency from the first shot and a constant hop latency', () => {
    const { scenario, effId, uasId } = killScenario()
    const { assessments, report } = engagementPicture(scenario)
    const a = assessments.find((x) => x.uasId === uasId)!
    const att = report.threats.find((x) => x.uasId === uasId)!
    const byId = new Map(systemSeries(scenario).map((s) => [s.id, s]))
    const latency = byId.get(`latency.${uasId}`)!
    const at = Math.round(att.firstShotS! / DT)
    expect(latency.values[at - 1]).toBeNaN()
    expect(latency.values[at]).toBeCloseTo(att.firstShotS! - a.firstDetectS!, 9)
    const hop = byId.get(`hop.${effId}.${uasId}`)!
    expect(hop.unit).toBe('s')
    expect(hop.values.every((v) => v === 2)).toBe(true)
  })

  it('marks arrival, first shot and the gate', () => {
    const { scenario, uasId } = killScenario()
    const { assessments, report } = engagementPicture(scenario)
    const a = assessments.find((x) => x.uasId === uasId)!
    const att = report.threats.find((x) => x.uasId === uasId)!
    expect(trackMarks(scenario, uasId)).toEqual([
      { tS: a.arrivalS, label: 'ARR', color: 'danger' },
      { tS: att.firstShotS, label: 'SHOT', color: 'accent' },
      { tS: a.engageGateS, label: 'GATE', color: 'accent' },
    ])
  })

  it('marks CPA for a fly-by with no arrival', () => {
    const { scenario, uasId } = killScenario()
    scenario.entities = scenario.entities.map((e) =>
      e.kind === 'asset' ? { ...e, pos: { x: 0, y: 5000 } } : e,
    )
    const marks = trackMarks(scenario, uasId)
    expect(marks[0].label).toBe('CPA')
    expect(marks[0].color).toBe('warn')
    expect(marks.map((m) => m.label)).not.toContain('ARR')
  })
})

describe('trackSlots', () => {
  it('assigns slots by first detection, never-detected last, in entity order', () => {
    const { scenario, ids } = slotScenario(4)
    const slots = trackSlots(scenario)
    expect(slots.get(ids[0])).toBe('chart-1')
    expect(slots.get(ids[1])).toBe('chart-2')
    expect(slots.get(ids[2])).toBe('chart-3')
    expect(slots.get(ids[3])).toBe('chart-4')
  })

  it('folds the sixth track into the other token and keeps slots under a filter', () => {
    const { scenario, ids } = slotScenario(6)
    const slots = trackSlots(scenario)
    // The undetected tracks sit in entity order, which is the reverse of ids.
    expect(slots.get(ids[5])).toBe('chart-4')
    expect(slots.get(ids[4])).toBe('chart-5')
    expect(slots.get(ids[3])).toBe(OTHER_TOKEN)
    const visible = new Set([ids[3], ids[2]])
    const filtered = [...slots].filter(([id]) => visible.has(id))
    expect(filtered).toEqual([[ids[2], 'chart-3'], [ids[3], OTHER_TOKEN]])
  })
})

/** Plain triples for a span list, so a test pins times and kinds in one literal. */
function triples(spans: LadderSpan[]): Array<[string, number, number]> {
  return spans.map((sp) => [sp.label ?? '', sp.startS, sp.endS])
}

/** Sorted by start, no two filled spans overlap, every color from the style table. */
function expectPartition(spans: LadderSpan[]): void {
  let end = Number.NEGATIVE_INFINITY
  for (const sp of spans) {
    expect(sp.endS).toBeGreaterThanOrEqual(sp.startS)
    if (sp.startS !== sp.endS) expect(sp.startS).toBeGreaterThanOrEqual(end)
    end = Math.max(end, sp.endS)
    const kind = sp.label as keyof typeof TRACK_LADDER_STYLE
    expect(sp.color).toBe(TRACK_LADDER_STYLE[kind].color)
  }
}

describe('trackLadderRows', () => {
  it('partitions a hold with a coast and a drop: init, track, coast, drop, track', () => {
    // Out past 3000 m at 6.67 s, turn at 11 s, back inside at 15.33 s: scans 7
    // to 15 miss, the fifth miss drops at 11, and 16 detects into a new interval.
    const { scenario, sensorId, uasId } = coastScenario([
      { x: 0, y: -2600 }, { x: 0, y: -3260 }, { x: 0, y: -2600 },
    ])
    const { assessments } = engagementPicture(scenario)
    const obs = assessments[0].sensorObservations!.find((o) => o.sensorId === sensorId)!
    expect(obs.intervals).toEqual([[0, 10.5], [16, 22.5]])
    expect(obs.coastIntervals).toEqual([[7, 10.5]])
    expect(obs.trackInitAtS).toBe(2)
    const rows = trackLadderRows(scenario, sensorId)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(uasId)
    // Inclusive DT intervals: [7, 10.5] covers [7, 11); the drop sits at 11.
    expect(triples(rows[0].spans)).toEqual([
      ['init', 0, 2], ['track', 2, 7], ['coast', 7, 11], ['drop', 11, 11], ['track', 16, 23],
    ])
    expectPartition(rows[0].spans)
  })

  it('subtracts a coast that lands inside the init window', () => {
    // Inside at scan 0, out at scan 1 (3050 m), back at 2: M-of-N initiates at 4.
    const { scenario, sensorId } = coastScenario([
      { x: 0, y: -2990 }, { x: 0, y: -3050 }, { x: 0, y: -2600 },
    ])
    const spans = trackLadderRows(scenario, sensorId)[0].spans
    expect(triples(spans)).toEqual([
      ['init', 0, 1], ['coast', 1, 2], ['init', 2, 4], ['track', 4, 9.5],
    ])
    expectPartition(spans)
  })

  it('keeps the init fill inside the hold intervals when the window spans a drop', () => {
    // Out at scan 1, dropped at the fifth miss, back at 18: M-of-N initiates at 21
    // in the second interval, so the gap between 5 and 18 draws nothing.
    const { scenario, sensorId } = coastScenario([
      { x: 0, y: -2950 }, { x: 0, y: -3500 }, { x: 0, y: -2600 },
    ])
    const { assessments } = engagementPicture(scenario)
    const obs = assessments[0].sensorObservations!.find((o) => o.sensorId === sensorId)!
    expect(obs.intervals).toEqual([[0, 4.5], [18, 24.5]])
    expect(obs.trackInitAtS).toBe(21)
    const spans = trackLadderRows(scenario, sensorId)[0].spans
    expect(triples(spans)).toEqual([
      ['init', 0, 1], ['coast', 1, 5], ['drop', 5, 5], ['init', 18, 21], ['track', 21, 25],
    ])
    expectPartition(spans)
  })

  it('opens with a search span to first detection and gives no row without a path', () => {
    const { scenario, sensorId, uasId } = pdScenario()
    const { assessments } = engagementPicture(scenario)
    const obs = assessments[0].sensorObservations!.find((o) => o.sensorId === sensorId)!
    const spans = trackLadderRows(scenario, sensorId)[0].spans
    expect(spans[0]).toEqual({
      startS: 0, endS: obs.firstDetectS, color: PHASE_STYLE.searching.color, label: 'search',
    })
    expect(spans[1].label).toBe('init')
    expect(spans[1].endS).toBe(obs.trackInitAtS)
    expectPartition(spans)
    expect(trackLadderRows({ ...scenario, paths: [] }, sensorId)).toEqual([])
    expect(uasId).toBe(assessments[0].uasId)
  })
})

describe('scanLoadSeries', () => {
  it('counts the held flags of the sensor and gives zeros for an unknown id', () => {
    const { scenario, sensorId, uasId } = killScenario()
    const n = sampleCount(scenario)
    const held = sensorSeries(scenario, sensorId).find((s) => s.id === `held.${uasId}`)!
    const load = scanLoadSeries(scenario, sensorId)
    expect(load.id).toBe('scanLoad')
    expect(load.unit).toBe('tracks')
    expect(load.values).toEqual(held.values)
    expect(load.values[0]).toBe(1)
    const none = scanLoadSeries(scenario, 'no-such-sensor')
    expect(none.values).toHaveLength(n)
    expect(none.values.every((v) => v === 0)).toBe(true)
  })
})

describe('heldTracksSeries and meanHeldPdSeries', () => {
  it('on the planning radar the held count follows the hold flag and the mean Pd is NaN', () => {
    // A planning radar records no pdSeries, so no held track has a finite Pd.
    const { scenario, sensorId, uasId } = killScenario()
    const held = sensorSeries(scenario, sensorId).find((s) => s.id === `held.${uasId}`)!
    const tracks = heldTracksSeries(scenario)
    expect(tracks.id).toBe('tracksHeld')
    expect(tracks.kind).toBe('step')
    expect(tracks.values).toEqual(held.values)
    const pd = meanHeldPdSeries(scenario)
    expect(pd.id).toBe('meanPd')
    expect(pd.kind).toBe('line')
    expect(pd.values.every((v) => Number.isNaN(v))).toBe(true)
  })

  it('on the scan radar the mean Pd is the held track Pd, and a disabled sensor counts nothing', () => {
    const { scenario, sensorId, uasId } = pdScenario()
    const byId = new Map(sensorSeries(scenario, sensorId).map((s) => [s.id, s]))
    const held = byId.get(`held.${uasId}`)!.values
    const pd = byId.get(`pd.${uasId}`)!.values
    const i = held.indexOf(1)
    expect(meanHeldPdSeries(scenario).values[i]).toBe(pd[i])
    const off = {
      ...scenario,
      entities: scenario.entities.map((e) => (e.id === sensorId ? { ...e, enabled: false } : e)),
    }
    expect(heldTracksSeries(off).values.every((v) => v === 0)).toBe(true)
  })
})

describe('salvosInFlightSeries', () => {
  it('is 1 from release to effect and 0 after', () => {
    const { scenario } = flightScenario()
    const { report } = engagementPicture(scenario)
    expect(report.events).toHaveLength(1)
    const ev = report.events[0]
    expect(ev.tEffectS).toBe(ev.tS + 4)
    const s = salvosInFlightSeries(scenario)
    expect(s.id).toBe('salvosInFlight')
    const rel = Math.round(ev.tS / DT)
    const fx = Math.round(ev.tEffectS / DT)
    expect(s.values[rel - 1]).toBe(0)
    expect(s.values[rel]).toBe(1)
    expect(s.values[fx - 1]).toBe(1)
    expect(s.values[fx]).toBe(0)
  })
})

describe('groupResidualSeries', () => {
  it('sums the residual ships of each group member', () => {
    const { scenario, uasId } = killScenario()
    const residual = threatSeries(scenario, uasId).find((s) => s.id === 'residual')!
    const groups = groupResidualSeries(scenario)
    expect(groups).toHaveLength(1)
    expect(groups[0].id.startsWith('group.')).toBe(true)
    expect(groups[0].unit).toBe('ships')
    expect(groups[0].color).toBe('chart-1')
    expect(groups[0].values).toEqual(residual.values)
  })
})

describe('salvoMarks and releaseLadderRows', () => {
  it('marks REL at tS and FX at tEffectS in time order', () => {
    const { scenario, effId } = flightScenario()
    const ev = engagementPicture(scenario).report.events[0]
    expect(salvoMarks(scenario, effId)).toEqual([
      { tS: ev.tS, label: 'REL', color: 'accent' },
      { tS: ev.tEffectS, label: 'FX', color: 'danger' },
    ])
  })

  it('draws one salvo span per event on the track row in its hue slot', () => {
    const { scenario, effId, uasId } = flightScenario()
    const ev = engagementPicture(scenario).report.events[0]
    expect(releaseLadderRows(scenario, effId)).toEqual([
      {
        id: uasId,
        label: uasId,
        spans: [{ startS: ev.tS, endS: ev.tEffectS, color: 'chart-1', label: 'salvo' }],
      },
    ])
    expect(releaseLadderRows(scenario, 'no-such-effector')).toEqual([])
  })
})

describe('phaseLadderRow', () => {
  it('draws no span while undetected, then PHASE_STYLE spans with no gap to the duration', () => {
    const { scenario, uasId } = pdScenario()
    const { assessments } = engagementPicture(scenario)
    const firstDetectS = assessments[0].firstDetectS!
    expect(firstDetectS).toBeGreaterThan(0)
    const row = phaseLadderRow(scenario, uasId)
    expect(row.label).toBe('Phase')
    // The Giraffe holds the track from first detection to the end: one TRACKED span.
    expect(row.spans).toEqual([{
      startS: Math.ceil(firstDetectS / DT) * DT,
      endS: scenarioDurationS(scenario),
      color: PHASE_STYLE.tracked.color,
      label: PHASE_STYLE.tracked.label,
    }])
    expect(phaseLadderRow(scenario, 'no-such-track').spans).toEqual([])
  })

  it('merges equal phases and runs the rungs with no gap and no overlap', () => {
    const { scenario, uasId } = killScenario()
    const row = phaseLadderRow(scenario, uasId)
    const labels = row.spans.map((sp) => sp.label)
    expect(labels.length).toBeGreaterThan(1)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toContain(PHASE_STYLE.engaged.label)
    const colors = Object.values(PHASE_STYLE).map((p) => p.color)
    row.spans.forEach((sp, i) => {
      expect(colors).toContain(sp.color)
      if (i > 0) expect(sp.startS).toBe(row.spans[i - 1].endS)
    })
    expect(row.spans[0].startS).toBe(0)
    expect(row.spans.at(-1)!.endS).toBe(scenarioDurationS(scenario))
  })
})

describe('sensorSeries Pd per track', () => {
  it('returns one Pd series per detected track, hued in first-detection order', () => {
    const { scenario, sensorId } = pdScenario()
    const far = ent('uas', 'tst-mohajer', { x: -18000, y: 0 })
    scenario.entities = [...scenario.entities, far]
    scenario.paths = [...scenario.paths, flight(far.id, [{ x: -18000, y: 0 }, { x: 0, y: 0 }])]
    const { assessments } = engagementPicture(scenario)
    const withPd = assessments.filter((a) =>
      a.sensorObservations?.some((o) => o.sensorId === sensorId && o.pdSeries),
    )
    expect(withPd).toHaveLength(2)
    const pd = sensorSeries(scenario, sensorId).filter((s) => s.id.startsWith('pd.'))
    expect(pd).toHaveLength(2)
    expect(pd.map((s) => s.color)).toEqual([CHART_SLOT_TOKENS[0], CHART_SLOT_TOKENS[1]])
    expect(pd.find((s) => s.id === `pd.${far.id}`)!.color).toBe(CHART_SLOT_TOKENS[1])
  })
})

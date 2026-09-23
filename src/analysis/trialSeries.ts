import type { ChartMark, LadderRow, LadderSpan, Series } from '../charts/types'
import { CHART_SLOT_TOKENS, OTHER_TOKEN } from '../charts/tokens'
import { entityActive } from '../model/types'
import { modelFor } from '../model/scenario'
import type { EngagementEvent } from '../playback/attritionReport'
import { DT } from '../playback/clock'
import { engagementIsKinetic, engagementReleaseS } from '../playback/engagementTiming'
import { trialSweepAt } from '../playback/trialSweepAt'
import { trialTrackStatesAt } from '../playback/trialTrackState'
import type { TrialResultView } from './trialResult'
import { trialSnapshotAt } from './trialResult'
import { trialKpisAt } from './liveStats'
import { trialThreatPictureAt } from './threatAggregation'

type TrialSeries = Series & { basis: 'simulated-trial' }
type TrialLadder = LadderRow & { basis: 'simulated-trial' }

export interface TrialSeriesSet {
  basis: 'simulated-trial'
  observedThroughS: number
  durationS: number
  kpi: TrialSeries[]
  sensors: Record<string, TrialSeries[]>
  effectors: Record<string, TrialSeries[]>
  threats: Record<string, TrialSeries[]>
  bySystem: TrialSeries[]
  byEffectorType: TrialSeries[]
  residual: TrialSeries[]
  groupResidual: TrialSeries[]
  sensorLadders: Record<string, TrialLadder[]>
  engagementWindows: TrialLadder[]
  phase: TrialLadder[]
  engagementLadder: TrialLadder[]
  marks: Record<string, ChartMark[]>
}

interface Columns {
  kpi: TrialSeries[]
  sensors: Record<string, TrialSeries[]>
  effectors: Record<string, TrialSeries[]>
  threats: Record<string, TrialSeries[]>
  bySystem: TrialSeries[]
  byEffectorType: TrialSeries[]
  residual: TrialSeries[]
  groupResidual: TrialSeries[]
}
interface Index {
  columns: Columns
  appendAt: Array<(t: number) => void>
  samples: number
  events: EngagementEvent[]
  recent: TrialSeriesSet[]
}
const cache = new WeakMap<TrialResultView, Index>()
const phaseLabels = [
  'Undetected',
  'Searching',
  'Tracked',
  'Hostile',
  'Targeted',
  'Engaged',
  'Neutralized',
]
const phaseColors = ['text-dim', 'text-dim', 'warn', 'danger', 'accent', 'chart-3', 'text-dim']

function countAt(times: number[], t: number): number {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (times[mid] <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

function indexOf(view: TrialResultView): Index {
  const cached = cache.get(view)
  if (cached) return cached
  const columns: Columns = {
    kpi: [],
    sensors: {},
    effectors: {},
    threats: {},
    bySystem: [],
    byEffectorType: [],
    residual: [],
    groupResidual: [],
  }
  const appendAt: Index['appendAt'] = []
  const events = [...view.attrition.events].sort((a, b) => a.tS - b.tS)
  const add = (
    list: TrialSeries[],
    id: string,
    label: string,
    unit: string | null,
    color: string,
    at: (t: number) => number,
  ) => {
    const series: TrialSeries = {
      id,
      label,
      unit,
      color,
      kind: 'step',
      basis: 'simulated-trial',
      values: [],
    }
    list.push(series)
    appendAt.push((t) => series.values.push(at(t)))
  }
  const counted = (
    list: TrialSeries[],
    id: string,
    label: string,
    times: number[],
    color = 'accent',
    unit: string | null = null,
  ) => {
    times.sort((a, b) => a - b)
    add(list, id, label, unit, color, (t) => countAt(times, t))
  }
  let snapshot: ReturnType<typeof trialSnapshotAt>
  let kpis: ReturnType<typeof trialKpisAt>
  let sweep: ReturnType<typeof trialSweepAt>
  let tracks: ReturnType<typeof trialTrackStatesAt>
  appendAt.push((t) => {
    snapshot = trialSnapshotAt(view, t)
    kpis = trialKpisAt(view, t)
    sweep = trialSweepAt(view, t)
    tracks = trialTrackStatesAt(view, t)
  })
  const specs = [
    ['detected', 'Detected tracks', 'chart-1'],
    ['classified', 'Classified tracks', 'chart-2'],
    ['targetable', 'Targetable tracks', 'accent'],
    ['engaged', 'Engaged tracks', 'chart-3'],
    ['kineticShots', 'Kinetic shots', 'accent'],
    ['deSalvos', 'DE salvos', 'accent'],
    ['jamSalvos', 'EW salvos', 'ew'],
    ['expectedKills', 'Pre-arrival defeats', 'chart-4'],
    ['lateKills', 'Late defeats', 'accent'],
    ['arrivedTracks', 'Arrived track files', 'accent'],
  ] as const
  for (const [key, label, color] of specs)
    add(columns.kpi, `kpi.${key}`, label, null, color, () => kpis[key])
  add(
    columns.kpi,
    'kpi.leakerShips',
    'Arrived undefeated members',
    'members',
    'chart-5',
    () => kpis.reportedLeakers ?? NaN,
  )
  add(
    columns.kpi,
    'kpi.activeMembers',
    'Active members',
    'members',
    'chart-1',
    () => snapshot.counts.activeAtHorizon,
  )
  add(
    columns.kpi,
    'tracksHeld',
    'Held track files',
    'tracks',
    'chart-1',
    () =>
      new Set(sweep.sensors.filter((s) => s.stateAtTime !== 'not-held').map((s) => s.threatId))
        .size,
  )
  add(columns.kpi, 'meanPd', 'Last measured Pd of held tracks', 'Pd', 'chart-4', () => {
    const best = new Map<string, number>()
    for (const s of sweep.sensors)
      if (s.stateAtTime !== 'not-held' && s.pd != null)
        best.set(s.threatId, Math.max(best.get(s.threatId) ?? 0, s.pd))
    return best.size ? [...best.values()].reduce((sum, pd) => sum + pd, 0) / best.size : NaN
  })
  const releases = events
    .filter(engagementIsKinetic)
    .map((e) => ({ event: e, release: engagementReleaseS(e, view.scenario) }))
  add(columns.kpi, 'salvosInFlight', 'Salvos in flight', null, 'chart-2', (t) =>
    releases.some(({ event, release }) => release == null && event.tS <= t && t < event.tEffectS)
      ? NaN
      : releases.filter(
          ({ event, release }) => release != null && release <= t && t < event.tEffectS,
        ).length,
  )

  const threats = view.scenario.entities.filter((e) => e.kind === 'uas' && entityActive(e))
  threats.forEach((entity, slot) => {
    const color = CHART_SLOT_TOKENS[slot] ?? OTHER_TOKEN
    const list = (columns.threats[entity.id] = [])
    const state = () => tracks.find((track) => track.entity.id === entity.id)!
    const a = view.assessments.find((a) => a.uasId === entity.id)!
    const assigned = events.filter((e) => e.uasId === entity.id)
    add(list, 'residual', 'Active members', 'members', color, () => state().activeCount)
    add(
      columns.residual,
      `residual.${entity.id}`,
      entity.name,
      'members',
      color,
      () => state().activeCount,
    )
    add(list, 'phase', 'Track-file phase', null, 'accent', (t) => {
      if (state().activeCount === 0) return 6
      if (assigned[0]?.tS <= t) return 5
      if (a.status === 'engageable' && a.windowS && a.windowS[0] <= t && t <= a.windowS[1]) return 4
      if (a.classificationAtS.hostileAtS != null && a.classificationAtS.hostileAtS <= t) return 3
      if (sweep.sensors.some((s) => s.threatId === entity.id && s.stateAtTime !== 'not-held'))
        return 2
      return a.firstDetectS != null && a.firstDetectS <= t ? 1 : 0
    })
    add(list, 'engagementTime', 'Detection to first assignment', 's', color, (t) =>
      a.firstDetectS != null && a.firstDetectS <= t && assigned[0]?.tS <= t
        ? assigned[0].tS - a.firstDetectS
        : NaN,
    )
  })
  trialThreatPictureAt(view, 0).forEach((group, slot) => {
    const ids = new Set(group.members.map((member) => member.uasId))
    add(
      columns.groupResidual,
      `group.${group.id}`,
      group.label,
      'members',
      CHART_SLOT_TOKENS[slot] ?? OTHER_TOKEN,
      () =>
        tracks
          .filter((track) => ids.has(track.entity.id))
          .reduce((sum, track) => sum + track.activeCount, 0),
    )
  })
  // One pass: each read of the retained ledger allocates, so a per-sensor filter
  // would rebuild the whole ledger once per sensor.
  const detectionTimes = new Map<string, number[]>()
  for (const scan of view.observations) {
    let n = 0
    for (const m of scan.members) if (m.detected) n += 1
    if (n === 0) continue
    const times = detectionTimes.get(scan.sensorId) ?? []
    for (let k = 0; k < n; k += 1) times.push(scan.tS)
    detectionTimes.set(scan.sensorId, times)
  }
  for (const sensor of view.scenario.entities.filter(
    (e) => e.kind === 'sensor' && entityActive(e),
  )) {
    const list = (columns.sensors[sensor.id] = [])
    counted(
      list,
      'detections',
      'Detected member scan decisions',
      detectionTimes.get(sensor.id) ?? [],
      'chart-1',
      'decisions',
    )
    add(list, 'falseAlarms', 'False alarms unavailable', 'events', 'text-dim', () => NaN)
    add(
      list,
      'scanLoad',
      'Held track files',
      'tracks',
      'chart-1',
      () =>
        sweep.sensors.filter((s) => s.sensorId === sensor.id && s.stateAtTime !== 'not-held')
          .length,
    )
    add(
      list,
      'coasts',
      'Coasting track files',
      'tracks',
      'text-dim',
      () =>
        sweep.sensors.filter((s) => s.sensorId === sensor.id && s.stateAtTime === 'coasting')
          .length,
    )
    for (const threat of threats) {
      const color = CHART_SLOT_TOKENS[threats.indexOf(threat)] ?? OTHER_TOKEN
      const state = () =>
        sweep.sensors.find((s) => s.sensorId === sensor.id && s.threatId === threat.id)
      add(
        list,
        `pd.${threat.id}`,
        `Last measured Pd ${threat.name}`,
        'Pd',
        color,
        () => state()?.pd ?? NaN,
      )
      add(
        list,
        `slant.${threat.id}`,
        `Last measured slant ${threat.name}`,
        'm',
        color,
        () => state()?.slantRangeM ?? NaN,
      )
      add(list, `held.${threat.id}`, `Held ${threat.name}`, null, color, () =>
        state() != null && state()!.stateAtTime !== 'not-held' ? 1 : 0,
      )
      add(list, `coast.${threat.id}`, `Coast ${threat.name}`, null, color, () =>
        state()?.stateAtTime === 'coasting' ? 1 : 0,
      )
      add(
        columns.threats[threat.id],
        `pd.${sensor.id}`,
        `Last measured Pd ${sensor.name}`,
        'Pd',
        color,
        () => state()?.pd ?? NaN,
      )
    }
  }
  for (const effector of view.scenario.entities.filter(
    (e) => e.kind === 'effector' && entityActive(e),
  )) {
    const list = (columns.effectors[effector.id] = [])
    const shots = events.filter((e) => e.effectorId === effector.id)
    counted(
      list,
      'salvos',
      'Assigned salvos',
      shots.map((e) => e.tS),
    )
    counted(
      list,
      'roundsExpended',
      'Kinetic rounds expended',
      shots.filter(engagementIsKinetic).map((e) => e.tS),
      'accent',
      'rounds',
    )
    counted(
      list,
      'hits',
      'Member removals',
      shots.filter((e) => e.killDelta === 1).map((e) => e.tEffectS),
      'chart-4',
      'members',
    )
    const magazine = modelFor(view.scenario, effector)?.effector?.magazineSize
    if (magazine != null) {
      const assignments = shots.map((e) => e.tS)
      add(list, 'rounds', 'Rounds left', 'rounds', 'accent', (t) =>
        Math.max(0, magazine - countAt(assignments, t)),
      )
    }
    for (const threat of threats) {
      const effects = shots
        .filter((e) => e.uasId === threat.id)
        .sort((a, b) => a.tEffectS - b.tEffectS)
      const times = effects.map((e) => e.tEffectS)
      add(
        list,
        `pk.${threat.id}`,
        `Effect Pk ${threat.name}`,
        'Pk',
        'chart-3',
        (t) => effects[countAt(times, t) - 1]?.pk ?? NaN,
      )
    }
  }
  const systems = new Map<string, EngagementEvent[]>()
  const types = new Map<string, EngagementEvent[]>()
  for (const entity of view.scenario.entities.filter(
    (e) => e.kind === 'effector' && entityActive(e),
  )) {
    const key = entity.systemId ?? 'independent'
    systems.set(key, [])
    const type = modelFor(view.scenario, entity)?.effector?.effectorType
    if (type) types.set(type, [])
  }
  for (const event of events) {
    const entity = view.scenario.entities.find((e) => e.id === event.effectorId)
    systems.get(entity?.systemId ?? 'independent')?.push(event)
    types.get(event.effectorType)?.push(event)
  }
  for (const [key, list] of systems)
    counted(
      columns.bySystem,
      `system.${key}.kills`,
      `Member removals · ${key}`,
      list.filter((e) => e.killDelta === 1).map((e) => e.tEffectS),
      'chart-4',
      'members',
    )
  for (const [key, list] of types) {
    counted(
      columns.byEffectorType,
      `${key}.salvos`,
      `${key} salvos`,
      list.map((e) => e.tS),
    )
    counted(
      columns.byEffectorType,
      `${key}.hits`,
      `${key} member removals`,
      list.filter((e) => e.killDelta === 1).map((e) => e.tEffectS),
      'chart-4',
      'members',
    )
  }
  // Every column reads one shared grid snapshot, prepared first in appendAt.
  const index = { columns, appendAt, samples: 0, events, recent: [] }
  cache.set(view, index)
  return index
}

function laddersAt(
  view: TrialResultView,
  events: EngagementEvent[],
  t: number,
): Pick<TrialSeriesSet, 'engagementLadder' | 'marks' | 'engagementWindows' | 'sensorLadders'> {
  const rows = new Map<string, TrialLadder>()
  const marks: Record<string, ChartMark[]> = {}
  const sensorLadders: Record<string, TrialLadder[]> = {}
  const engagementWindows: TrialLadder[] = []
  for (const a of view.assessments) {
    const entity = view.scenario.entities.find((e) => e.id === a.uasId)!
    const list: ChartMark[] = []
    const mark = (at: number | null | undefined, label: string, color: string) => {
      if (at != null && at <= t) list.push({ tS: at, label, color })
    }
    if (a.arrivalS != null) mark(a.arrivalS, 'ARR', 'danger')
    else mark(a.cpaS, 'CPA', 'warn')
    mark(a.engageGateS, 'GATE', 'accent')
    mark(events.find((e) => e.uasId === a.uasId)?.tS, 'SHOT', 'accent')
    marks[a.uasId] = list
    for (const window of a.effectorWindows) {
      const spans = window.intervals
        .filter(([start]) => start <= t)
        .map(([start, end]) => ({
          startS: start,
          endS: Math.min(t, end),
          label: 'In-range window',
          color: 'accent',
        }))
      if (spans.length)
        engagementWindows.push({
          id: JSON.stringify([a.uasId, window.effectorId]),
          label: `${entity.name} · ${view.scenario.entities.find((e) => e.id === window.effectorId)?.name ?? window.effectorId}`,
          basis: 'simulated-trial',
          spans,
        })
    }
    for (const observation of a.sensorObservations ?? []) {
      if (observation.firstDetectS > t) continue
      const spans: LadderSpan[] = []
      for (const [start, end] of observation.intervals) {
        if (start > t) continue
        const stop = Math.min(t, end + DT)
        let cursor = start
        for (const [coastStart, coastEnd] of observation.coastIntervals ?? []) {
          if (coastStart > stop || coastEnd < cursor) continue
          if (coastStart > cursor)
            spans.push({
              startS: cursor,
              endS: coastStart,
              label: 'Held track file',
              color: 'warn',
            })
          spans.push({
            startS: Math.max(cursor, coastStart),
            endS: Math.min(stop, coastEnd + DT),
            label: 'Coast',
            color: 'text-dim',
          })
          cursor = Math.min(stop, coastEnd + DT)
        }
        if (cursor < stop)
          spans.push({ startS: cursor, endS: stop, label: 'Held track file', color: 'warn' })
      }
      const rows = sensorLadders[observation.sensorId] ?? []
      rows.push({ id: a.uasId, label: entity.name, basis: 'simulated-trial', spans })
      sensorLadders[observation.sensorId] = rows
    }
  }
  for (const event of events) {
    if (event.tS > t) break
    const id = JSON.stringify([event.effectorId, event.uasId])
    let row = rows.get(id)
    if (!row) {
      const name = (id: string) => view.scenario.entities.find((e) => e.id === id)?.name ?? id
      row = {
        id,
        label: `${name(event.effectorId)} → ${name(event.uasId)}`,
        basis: 'simulated-trial',
        spans: [],
      }
      rows.set(id, row)
    }
    const list = marks[event.effectorId] ?? []
    list.push({ tS: event.tS, label: 'ASG', color: 'warn' })
    const release = engagementReleaseS(event, view.scenario)
    const span = (startS: number, endS: number, label: string, color: string) => {
      if (startS <= t) row!.spans.push({ startS, endS: Math.min(t, endS), label, color })
    }
    if (release == null) span(event.tS, event.tEffectS, 'launch timing unavailable', 'warn')
    else {
      if (release > event.tS) span(event.tS, release, 'preparation', 'warn')
      span(
        release,
        event.tEffectS,
        engagementIsKinetic(event) ? 'flight' : event.channelClass === 'ew' ? 'EW dwell' : 'beam',
        'accent',
      )
      if (release <= t) list.push({ tS: release, label: 'REL', color: 'accent' })
    }
    if (event.tEffectS <= t)
      list.push({
        tS: event.tEffectS,
        label:
          event.channel === 'jam'
            ? 'JAM DECISION'
            : event.killDelta === 1
              ? event.softShot
                ? 'MISSION KILL'
                : 'HARD KILL'
              : 'NO ADDITIONAL EFFECT',
        color: event.channelClass === 'ew' ? 'ew' : 'danger',
      })
    marks[event.effectorId] = list
  }
  for (const list of Object.values(marks)) list.sort((a, b) => a.tS - b.tS)
  return { engagementLadder: [...rows.values()], marks, sensorLadders, engagementWindows }
}

export function trialSeriesOf(view: TrialResultView, horizonS: number): TrialSeriesSet {
  const t = Math.min(Number.isNaN(horizonS) ? 0 : Math.max(0, horizonS), view.observedThroughS)
  const index = indexOf(view)
  const cached = index.recent.find((set) => set.observedThroughS === t)
  if (cached) return cached
  const n = Math.floor(t / DT) + 1
  while (index.samples < n) {
    const at = index.samples * DT
    for (const append of index.appendAt) append(at)
    index.samples++
  }
  const prefix = (list: TrialSeries[]) => list.map((s) => ({ ...s, values: s.values.slice(0, n) }))
  const prefixMap = (map: Record<string, TrialSeries[]>) =>
    Object.fromEntries(Object.entries(map).map(([id, list]) => [id, prefix(list)]))
  const phase = Object.entries(index.columns.threats).map(([id, list]): TrialLadder => {
    const values = list.find((s) => s.id === 'phase')!.values
    const spans: LadderSpan[] = []
    let start = 0
    for (let i = 1; i <= n; i++) {
      if (i < n && values[i] === values[start]) continue
      if (values[start] !== 0)
        spans.push({
          startS: start * DT,
          endS: Math.min(t, i * DT),
          label: phaseLabels[values[start]],
          color: phaseColors[values[start]],
        })
      start = i
    }
    return {
      id,
      label: view.scenario.entities.find((e) => e.id === id)?.name ?? id,
      basis: 'simulated-trial',
      spans,
    }
  })
  const result: TrialSeriesSet = {
    basis: 'simulated-trial',
    observedThroughS: t,
    durationS: view.durationS,
    kpi: prefix(index.columns.kpi),
    sensors: prefixMap(index.columns.sensors),
    effectors: prefixMap(index.columns.effectors),
    threats: prefixMap(index.columns.threats),
    bySystem: prefix(index.columns.bySystem),
    byEffectorType: prefix(index.columns.byEffectorType),
    residual: prefix(index.columns.residual),
    groupResidual: prefix(index.columns.groupResidual),
    phase,
    ...laddersAt(view, index.events, t),
  }
  index.recent.unshift(result)
  if (index.recent.length > 4) index.recent.pop()
  return result
}

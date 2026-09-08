import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { trialResultOf } from '../../../analysis/trialResult'
import { trialSeriesOf } from '../../../analysis/trialSeries'
import { runTrial } from '../../../playback/trial'
import { createTrialManifest } from '../../../playback/trialTypes'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import { IDLE_TRIAL } from '../../../state/runState'
import { installTrial, observeTrial, unstartTrial } from '../widgets/trialTestState'
import { trialSystemTelemetryAt } from '../../../analysis/systemTelemetry'
import { formatTime } from '../../../geometry/geo'
import { emptyScenario } from '../../../model/seed'
import type { Connection, Entity, EntityKind } from '../../../model/types'
import { useStore } from '../../../state/store'
import { DetailPane } from './DetailPane'

function captureTrial() {
  const { scenario, playback } = useStore.getState()
  const manifest = createTrialManifest(scenario, playback.runId, analysisBasisSignature(scenario))
  const result = runTrial(scenario, manifest)
  useStore.setState({ trial: { ...IDLE_TRIAL, status: 'ready', scenario, manifest, result } })
  return trialResultOf(scenario, manifest, result)
}

function entityOf(kind: EntityKind): Entity {
  const entity = useStore.getState().scenario.entities.find((e) => e.kind === kind)
  if (!entity) throw new Error(`no ${kind} placed`)
  return entity
}

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading pane needs the two in step.
function render(entityId: string): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<DetailPane entityId={entityId} />)
}

/** The markup of one section, from its `data-section` to the next one or the end. */
function section(html: string, key: string): string {
  const start = html.indexOf(`data-section="${key}"`)
  expect(start).toBeGreaterThan(-1)
  const next = html.indexOf('data-section="', start + 1)
  return html.slice(start, next === -1 ? undefined : next)
}

function bodyRows(html: string): number {
  const body = html.slice(html.indexOf('<tbody>'))
  return (body.match(/<tr>/g) ?? []).length
}

function expectSections(html: string, keys: Array<[string, string]>): void {
  for (const [key, title] of keys) {
    expect(html).toContain(`data-section="${key}"`)
    expect(html).toContain(`<span class="wg-t">${title}</span>`)
  }
}

function expectNoControls(html: string): void {
  expect(html).not.toContain('<input')
  expect(html).not.toContain('<select')
}

describe('DetailPane', () => {
  beforeEach(() => {
    const store = useStore.getState()
    store.setBoardPhase('analyze')
    store.replaceScenario(emptyScenario())
    store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    store.addEntityFromModel('lib-coyote', { x: 1697, y: -1697 })
    store.addEntityFromModel('lib-faadc2', { x: -500, y: 0 })
    store.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const uas = entityOf('uas')
    store.beginPath(uas.id)
    store.addDraftPoint({ x: 0, y: -100 })
    store.finishPath()
    const sensor = entityOf('sensor')
    const c2 = entityOf('c2')
    const effector = entityOf('effector')
    const connections: Connection[] = [
      { id: 'con-1', fromId: sensor.id, toId: c2.id, label: '', latencyS: 2 },
      { id: 'con-2', fromId: c2.id, toId: effector.id, label: '', latencyS: 3 },
    ]
    store.patchScenario({ connections })
    // Fixed draw identities keep sampled assertions repeatable.
    const scenario = useStore.getState().scenario
    const ids = new Map(scenario.entities.map(e => [e.id, e.kind]))
    store.patchScenario({ entities: scenario.entities.map(e => ({ ...e, id: ids.get(e.id)! })),
      paths: scenario.paths.map(p => ({ ...p, entityId: ids.get(p.entityId)! })),
      connections: scenario.connections.map(c => ({ ...c, fromId: ids.get(c.fromId)!, toId: ids.get(c.toId)! })) })
    useStore.setState({ playback: { ...useStore.getState().playback, runId: 'detail-fixed-trial' } })
    captureTrial()
    store.startRun()
    store.pauseRun()
  })

  it.each(['asset', 'marker'] as const)('renders nothing for a %s and for an unknown id', (kind) => {
    const asset: Entity = {
      id: 'ent-asset',
      name: 'Asset 1',
      kind,
      specId: 'lib-asset',
      pos: { x: 0, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    }
    const store = useStore.getState()
    store.patchScenario({ entities: [...store.scenario.entities, asset] })
    expect(render('ent-asset')).toBe('')
    expect(render('ent-missing')).toBe('')
  })

  it('renders the sensor pane with one gate row per threat', () => {
    const sensor = entityOf('sensor')
    const html = render(sensor.id)
    expect(html).toContain('data-detail="sensor"')
    expect(html).toContain('aria-label="Back to the lens stack"')
    expect(html).toContain('‹ Back')
    expect(html).toContain(sensor.name)
    expect(html).toContain('<span class="state inactive"><i class="state-square" aria-hidden="true"></i>SEARCH<')
    expect(html).toContain('surveillance')
    expectSections(html, [
      ['pd', 'Pd per track'],
      ['slant', 'Slant range per track'],
      ['ladder', 'Track ladder'],
      ['load', 'Load and hold'],
      ['gates', 'Sensor state by threat'],
    ])
    expect(bodyRows(section(html, 'gates'))).toBe(1)
    expect(section(html, 'load')).toContain('Held track files')
    // The models behind this sensor, tier and validation status on each chip.
    expect(html).toContain('class="fid-tags"')
    expect(html).toContain('data-tier="physics" data-validation="analytic"')
    expect(html).toContain('Horizon · physics · analytic')
    expect(html).not.toContain('Kinetic Pk ·')
    expectNoControls(html)
  })

  it('renders the effector pane', () => {
    const effector = entityOf('effector')
    const html = render(effector.id)
    expect(html).toContain('data-detail="effector"')
    expect(html).toContain('<span class="state inactive"><i class="state-square" aria-hidden="true"></i>READY<')
    expect(html).toContain('interceptor')
    expectSections(html, [
      ['pk', 'Pk per track'],
      ['magazine', 'Magazine'],
      ['release', 'Assignment, release and effect'],
      ['doctrine', 'Doctrine by threat'],
      ['capacity', 'Capacity'],
    ])
    expect(bodyRows(section(html, 'doctrine'))).toBe(1)
    expect(section(html, 'capacity')).toContain('BDA dwell')
    expect(html).toContain('Kinetic Pk · planning · none')
    expectNoControls(html)
  })

  it('renders the threat pane with the track file rows', () => {
    const uas = entityOf('uas')
    const html = render(uas.id)
    expect(html).toContain('data-detail="threat"')
    expect(html).toContain('<span class="state inactive" style="color:')
    expect(html).toContain('quad')
    expectSections(html, [
      ['file', 'Track file'],
      ['phase', 'Phase'],
      ['pd', 'Pd by sensor'],
      ['survival', 'Survival'],
    ])
    const file = section(html, 'file')
    for (const label of [
      'Platform',
      'Navigation',
      'Position',
      'Speed / heading',
      'Held by',
      'Classification',
      'EW',
      'Salvos',
      'Effects',
      'Residual',
      'Reached arrival',
      'Altitude (constant)',
      'Slant range',
      'Bearing',
      'Engage status',
      'Warning',
      'First detect',
      'RCS',
      'Swerling',
    ]) {
      expect(file).toContain(`<span class="rl">${label}</span>`)
    }
    expect(file.match(/<div class="row">/g)?.length).toBe(19)
    expect(file).toContain('T+0:00 observed')
    expect(file).toContain('Group 1 · quad')
    expect(file).toContain('GPS and RF mixed')
    expect(file).toContain('0 landed · 0 hard kill · 0 mission kill')
    expect(file).toContain('1 active · 0 hard kill · 0 mission kill · 1 members')
    expect(section(html, 'planned-path')).toContain('no defended asset placed')
    expectNoControls(html)
  })

  it('does not substitute a full-run route diagnosis for reached trial status', () => {
    const store = useStore.getState()
    store.patchScenario({ connections: store.scenario.connections.map(c => ({ ...c, confidence: 'documented' as const })) })
    captureTrial()
    const file = section(render(entityOf('uas').id), 'file')
    expect(file).toContain('Engage status</span><span class="rv num">—')
    expect(file).not.toContain('no fire-control source')
    expect(file).not.toContain('full run')
  })

  it('renders the system pane with the hop through this node', () => {
    const c2 = entityOf('c2')
    observeTrial(30, 30)
    const html = render(c2.id)
    expect(html).toContain('data-detail="system"')
    expect(html).toContain('command and control')
    expectSections(html, [
      ['hops', 'Kill-chain hops'],
      ['timing', 'Detect to effect'],
      ['coverage', 'Route coverage'],
    ])
    expect(bodyRows(section(html, 'hops'))).toBe(1)
    expect(section(html, 'hops')).toContain('untyped')
    expect(bodyRows(section(html, 'timing'))).toBe(1)
    expectNoControls(html)
  })

  it.each(['uas', 'sensor', 'effector', 'c2'] as const)(
    'caps %s telemetry at 30 seconds after a forward scrub', (kind) => {
      const store = useStore.getState()
      store.setBoardPhase('execute')
      store.startRun()
      store.advanceRun(30)
      store.pauseRun()
      const at30 = render(entityOf(kind).id)
      store.scrubTo(100)
      const preview = render(entityOf(kind).id)
      const telemetry = kind === 'uas' ? ['file'] : kind === 'sensor' ? ['load', 'gates']
        : kind === 'effector' ? ['doctrine', 'capacity'] : ['hops', 'timing', 'coverage']
      for (const key of telemetry) {
        expect(section(preview, key)).toBe(section(at30, key))
        for (const match of section(preview, key).matchAll(/(?:T\+)?(\d+):(\d{2})/g)) {
          expect(Number(match[1]) * 60 + Number(match[2])).toBeLessThanOrEqual(30)
        }
      }
      expect(preview).not.toContain('EXPECTED DEFEAT')
      if (kind === 'uas') {
        expect(section(preview, 'planned-path')).toContain('Planned arrival')
        expect(section(preview, 'planned-path')).toContain('Planned CPA')
        expect(section(preview, 'file')).not.toContain('full path')
      }
    },
  )

  it.each(['uas', 'sensor', 'effector', 'c2'] as const)(
    'shows untouched %s telemetry at EMPTY_HORIZON before first Play', (kind) => {
      const store = useStore.getState()
      store.setBoardPhase('execute')
      unstartTrial()
      const html = render(entityOf(kind).id)
      expect(html).toContain('Simulated trial · ready')
      expect(html).not.toContain('EXPECTED DEFEAT')
      if (kind === 'uas') {
        const file = section(html, 'file')
        expect(file).not.toMatch(/T\+\d/)
        expect(file).toContain('0 sensors')
        expect(file).toContain('0 landed · 0 hard kill · 0 mission kill')
        expect(file).toContain('0 kinetic · 0 DE · 0 EW · 0 inbound')
        expect(file).toContain('Residual</span><span class="rv num">—')
        expect(file).not.toMatch(/[1-9] (active|hard kill|mission kill|landed)/)
        expect(section(html, 'phase')).not.toContain('chart-legend')
      } else if (kind === 'sensor') {
        expect(section(html, 'load')).toContain('Held track files</span><span class="rv num">—')
        expect(section(html, 'load')).toContain('Hold clock (union)</span><span class="rv num">—')
        expect(section(html, 'ladder')).toContain('No track observed.')
        expect(section(html, 'slant')).toContain('No track observed.')
      } else if (kind === 'effector') {
        for (const label of ['Kinetic shots', 'DE salvos', 'Jam salvos']) {
          expect(section(html, 'capacity')).toContain(`${label}</span><span class="rv num">—`)
        }
        expect(section(html, 'doctrine')).toContain('No threats with flight paths.')
        expect(section(html, 'doctrine')).not.toMatch(/\d+:\d{2}/)
        expect(section(html, 'release')).toContain('No salvo assigned.')
      } else {
        expect(section(html, 'hops')).toContain('No route through this node.')
        expect(section(html, 'timing')).not.toMatch(/\d+:\d{2}/)
        expect(section(html, 'coverage')).not.toContain('no route')
      }
    },
  )

  it('reveals the preparation and flight legend only when each interval is reached', () => {
    const store = useStore.getState()
    const effector = entityOf('effector')
    const event = useStore.getState().trial.result!.report.events[0]
    expect(event.tReleaseS).toBeGreaterThan(event.tS)
    expect(event.tEffectS).toBeGreaterThan(event.tReleaseS!)
    store.setBoardPhase('execute')
    store.startRun()
    store.advanceRun(event.tS + 1)
    store.pauseRun()
    store.scrubTo(event.tEffectS + 1)
    const preparing = section(render(effector.id), 'release')
    expect(preparing).toContain('preparation')
    expect(preparing).not.toContain('· flight')
    store.scrubTo(event.tS + 1)
    store.startRun()
    store.advanceRun(event.tReleaseS! + 1)
    store.pauseRun()
    expect(section(render(effector.id), 'release')).toContain('· flight')
  })

  it('counts capacity by reached assignment and sampled sensor load/hold at observation time', () => {
    const store = useStore.getState()
    const view = captureTrial()
    const report = view.attrition
    const effector = entityOf('effector')
    const sensor = entityOf('sensor')
    expect(report.events.length).toBeGreaterThan(0)
    store.setBoardPhase('execute')
    store.startRun()
    store.advanceRun(30)
    store.pauseRun()
    store.scrubTo(100)
    const events = report.events.filter((event) => event.effectorId === effector.id && event.tS <= 30)
    const capacity = section(render(effector.id), 'capacity')
    expect(capacity).toContain(`Kinetic shots</span><span class="rv num">${events.filter((event) => event.channelClass === 'kinetic').length}`)
    const component = trialSystemTelemetryAt(view, 30)
      .flatMap((group) => group.components).find((candidate) => candidate.entityId === sensor.id)!
    const load = section(render(sensor.id), 'load')
    expect(load).toContain(`Held track files</span><span class="rv num">${trialSeriesOf(view, 30).sensors[sensor.id].find(s => s.id === 'scanLoad')!.values[60]}`)
    expect(load).toContain(`Hold clock (union)</span><span class="rv num">${formatTime(component.holdSeconds)}`)
  })

  it('keeps Prepare and Analyze detail output identical for every pane', () => {
    for (const kind of ['uas', 'sensor', 'effector', 'c2'] as const) {
      useStore.getState().setBoardPhase('prepare')
      const prepare = render(entityOf(kind).id)
      useStore.getState().setBoardPhase('analyze')
      expect(render(entityOf(kind).id)).toBe(prepare)
    }
  })


  it('does not populate sensor track lists or C2 routes from future detections', () => {
    const store = useStore.getState()
    const sensor = entityOf('sensor')
    const c2 = entityOf('c2')
    store.patchScenario({ entities: store.scenario.entities.map((entity) => entity.id === sensor.id
      ? { ...entity, pos: { x: 0, y: 3000 } } : entity),
      paths: store.scenario.paths.map(path => ({ ...path, startDelayS: 60 })) })
    const { assessments } = captureTrial()
    expect(assessments[0].sensorObservations?.[0].firstDetectS).toBeGreaterThan(30)
    store.setBoardPhase('execute')
    store.startRun()
    store.advanceRun(30)
    store.pauseRun()
    store.scrubTo(200)
    const sensorHtml = render(sensor.id)
    expect(section(sensorHtml, 'ladder')).toContain('No track observed.')
    expect(section(sensorHtml, 'slant')).toContain('No track observed.')
    expect(section(render(c2.id), 'hops')).toContain('No route through this node.')
    expect(section(render(entityOf('uas').id), 'file')).not.toContain('T+2:')
    expect(section(render(entityOf('uas').id), 'pd')).toContain('No radar Pd model observed this track.')
    store.setBoardPhase('analyze')
    expect(section(render(sensor.id), 'ladder')).toContain('No track observed.')
    expect(section(render(c2.id), 'hops')).toContain('No route through this node.')
    observeTrial(200, 200)
    expect(section(render(sensor.id), 'ladder')).not.toContain('No track observed.')
    expect(bodyRows(section(render(c2.id), 'hops'))).toBe(1)
  })

})

it('shows realized mixed-member effects at the observed boundary, never forecast E[k]', () => {
  installTrial(3)
  const html = render('swarm')
  const file = section(html, 'file')
  expect(file).toContain('T+0:03 observed')
  expect(file).toContain('3 landed · 1 hard kill · 1 mission kill')
  expect(file).toContain('3 active · 1 hard kill · 1 mission kill · 5 members')
  expect(file).not.toMatch(/E\[k\]|Expected|expected/)
  observeTrial(1.99)
  const before = section(render('swarm'), 'file')
  expect(before).toContain('0 hard kill · 0 mission kill')
  expect(before).toContain('5 active')
})

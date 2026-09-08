import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { engagementPicture } from '../../../analysis/impact'
import { scanLoadSeries } from '../../../analysis/series'
import { systemTelemetryAt } from '../../../analysis/systemTelemetry'
import { formatTime } from '../../../geometry/geo'
import { emptyScenario } from '../../../model/seed'
import type { Connection, Entity, EntityKind } from '../../../model/types'
import { useStore } from '../../../state/store'
import { DetailPane, hasDetailPane } from './index'

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
  })

  it('names the four kinds that have a pane', () => {
    expect(hasDetailPane('sensor')).toBe(true)
    expect(hasDetailPane('effector')).toBe(true)
    expect(hasDetailPane('uas')).toBe(true)
    expect(hasDetailPane('c2')).toBe(true)
    expect(hasDetailPane('asset')).toBe(false)
    expect(hasDetailPane('marker')).toBe(false)
  })

  it('renders nothing for an asset and for an unknown id', () => {
    const asset: Entity = {
      id: 'ent-asset',
      name: 'Asset 1',
      kind: 'asset',
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
      ['gates', 'Gates by threat'],
    ])
    expect(bodyRows(section(html, 'gates'))).toBe(1)
    expect(section(html, 'load')).toContain('Tracks per scan')
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
      'CPA (full path)',
      'Arrival (full path)',
      'Altitude (constant)',
      'Slant range',
      'Bearing',
      'Engage status (full run)',
      'Warning (full path)',
      'First detect (full path)',
      'RCS',
      'Swerling',
    ]) {
      expect(file).toContain(`<span class="rl">${label}</span>`)
    }
    expect(file.match(/<div class="row">/g)?.length).toBe(20)
    expect(file).toContain('T+0:00 cursor · full-path/full-run fields marked')
    expect(file).toContain('Group 1 · quad')
    expect(file).toContain('GPS and RF mixed')
    expect(file).toContain('E[k] 0.00')
    expect(file).toContain('1.00 of 1 ships')
    expect(file).toContain('no defended asset placed')
    expectNoControls(html)
  })

  it('names the missing fire-control source when a typed route blocks the Coyote', () => {
    // The beforeEach links are untyped, so the route does not bind the gate.
    const uas = entityOf('uas')
    const before = section(render(uas.id), 'file')
    expect(before).not.toContain('no fire-control source')
    // Typed links (a confidence is what types a hop) make Giraffe 1X to FAAD C2
    // to Coyote a fully typed route with no fire-control sensor: no-fc-uplink.
    const store = useStore.getState()
    store.patchScenario({
      connections: store.scenario.connections.map((c) => ({ ...c, confidence: 'documented' as const })),
    })
    const file = section(render(uas.id), 'file')
    expect(file).toContain('<span class="rl">Engage status (full run)</span>')
    expect(file).toContain('no fire-control source on the route')
    expect(file).toContain('needs a fire-control track from')
    expect(file).toContain('KuRFS')
  })

  it('renders the system pane with the hop through this node', () => {
    const c2 = entityOf('c2')
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
      const html = render(entityOf(kind).id)
      expect(html).not.toContain('EXPECTED DEFEAT')
      if (kind === 'uas') {
        const file = section(html, 'file')
        expect(file).not.toMatch(/T\+\d/)
        expect(file).toContain('0 sensors')
        expect(file).toContain('0 landed · E[k] 0.00')
        expect(file).toContain('0 kinetic · 0 DE · 0 EW · 0 inbound')
        expect(file).not.toContain('1.00 of 1 ships')
        expect(section(html, 'phase')).not.toContain('chart-legend')
      } else if (kind === 'sensor') {
        expect(section(html, 'load')).toContain('Tracks per scan</span><span class="rv num">0')
        expect(section(html, 'load')).toContain('Hold clock (union)</span><span class="rv num">—')
        expect(section(html, 'ladder')).toContain('No track observed.')
        expect(section(html, 'slant')).toContain('No track observed.')
      } else if (kind === 'effector') {
        for (const label of ['Kinetic shots', 'DE salvos', 'Jam salvos']) {
          expect(section(html, 'capacity')).toContain(`${label}</span><span class="rv num">0`)
        }
        expect(section(html, 'doctrine')).toContain('title="Forecast available in Analyze">—')
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
    const event = engagementPicture(store.scenario).report.events[0]
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

  it('counts capacity by reached effect and sensor load/hold at observation time', () => {
    const store = useStore.getState()
    const { scenario } = store
    const { assessments, report } = engagementPicture(scenario)
    const effector = entityOf('effector')
    const sensor = entityOf('sensor')
    expect(report.events.length).toBeGreaterThan(0)
    store.setBoardPhase('execute')
    store.startRun()
    store.advanceRun(30)
    store.pauseRun()
    store.scrubTo(100)
    const events = report.events.filter((event) => event.effectorId === effector.id && event.tEffectS <= 30)
    const capacity = section(render(effector.id), 'capacity')
    expect(capacity).toContain(`Kinetic shots</span><span class="rv num">${events.filter((event) => event.channelClass === 'kinetic').length}`)
    const component = systemTelemetryAt(scenario, assessments, report, 30, new Map())
      .flatMap((group) => group.components).find((candidate) => candidate.entityId === sensor.id)!
    const load = section(render(sensor.id), 'load')
    expect(load).toContain(`Tracks per scan</span><span class="rv num">${scanLoadSeries(scenario, sensor.id).values[60]}`)
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
      ? { ...entity, pos: { x: 0, y: 3000 } } : entity) })
    const { assessments } = engagementPicture(useStore.getState().scenario)
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
    expect(section(render(sensor.id), 'ladder')).not.toContain('No track observed.')
    expect(bodyRows(section(render(c2.id), 'hops'))).toBe(1)
  })

})

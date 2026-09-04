import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../../model/seed'
import type { Entity, Scenario } from '../../../model/types'
import { DEFAULT_KPI_TILES, KPI_KEYS } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { KpiTilesWidget } from './KpiTilesWidget'
import { KPI_LABELS } from './labels'

/** One builtin quadcopter with a straight flight path, so the run has a track. */
function threatScenario(): Scenario {
  const scenario = emptyScenario()
  const uas: Entity = {
    id: 'uas-1',
    name: 'Mavic 1',
    kind: 'uas',
    specId: 'lib-mavic3',
    pos: { x: -3000, y: 0 },
    headingDeg: 90,
    color: null,
    notes: '',
  }
  scenario.entities = [uas]
  scenario.paths = [
    { id: 'path-1', entityId: uas.id, points: [{ x: -3000, y: 0 }, { x: 3000, y: 0 }], speedMps: 20, startDelayS: 0 },
  ]
  return scenario
}

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading widget needs the two in step.
function render(params: Record<string, unknown>, customize = false): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <KpiTilesWidget
      id="rs-kpi"
      params={params}
      collapsed={false}
      customize={customize}
      index={0}
      count={1}
    />,
  )
}

describe('KpiTilesWidget', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(threatScenario())
  })

  it('renders the six default tiles by label when params name no tile', () => {
    const html = render({})
    for (const key of DEFAULT_KPI_TILES) expect(html).toContain(KPI_LABELS[key].label)
    expect(html).toContain('tiles c3')
    expect(html).toContain(`${DEFAULT_KPI_TILES.length} of ${KPI_KEYS.length}`)
    expect(html).not.toContain(KPI_LABELS.minWarning.label)
  })

  it('drops unknown keys and lays four or fewer tiles in two columns', () => {
    const html = render({ tiles: ['detect', 'bogus', 'minWarning'] })
    expect(html).toContain('tiles c2')
    expect(html).toContain(KPI_LABELS.detect.label)
    expect(html).toContain(KPI_LABELS.minWarning.label)
    expect(html).toContain('2 of 13')
  })

  it('reads a dash and "not yet" on time tiles before the first play', () => {
    const html = render({ tiles: ['firstDetect'] })
    expect(html).toContain('not yet')
  })

  it('shows the checkbox grid over every key in customize mode', () => {
    const html = render({}, true)
    expect(html).toContain('class="params"')
    for (const key of KPI_KEYS) expect(html).toContain(KPI_LABELS[key].label)
    expect(html).not.toContain('tiles c3')
  })

  it('says so when no threat has a flight path', () => {
    useStore.getState().replaceScenario(emptyScenario())
    expect(render({})).toContain('No threats with flight paths.')
  })
})

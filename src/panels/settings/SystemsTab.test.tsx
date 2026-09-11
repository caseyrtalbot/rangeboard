import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { fillScenario } from '../../io/persist'
import { emptyScenario } from '../../model/seed'
import { useOverrides } from '../../state/overrides'
import { useStore } from '../../state/store'
import { SystemsTab } from './SystemsTab'

const SENSOR = 'lib-giraffe1x'
const EFFECTOR = 'lib-coyote'

/**
 * Load a save through `fillScenario`, which sets the load notice the tab reads.
 * `strip` removes a sensor key from the saved Giraffe, so the reconcile adopts
 * it back from the seed: a board written before that field existed.
 */
function load(strip?: string): void {
  const save = JSON.parse(JSON.stringify(emptyScenario()))
  if (strip) {
    const model = save.library.find((m: { id: string }) => m.id === SENSOR)
    delete model.sensor[strip]
  }
  useStore.getState().replaceScenario(fillScenario(save))
}

// Zustand 5 gives react-dom/server the initial state, so keep both stores the
// panel reads aligned with their live state before each static render.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  Object.assign(useOverrides.getInitialState(), useOverrides.getState())
  return renderToStaticMarkup(<SystemsTab />)
}

describe('SystemsTab', () => {
  beforeEach(() => {
    // A load that adopts nothing clears the notice the previous test set.
    load()
    useOverrides.getState().resetAll()
  })

  it('says nothing is in use before a system is placed', () => {
    const html = render()
    expect(html).toContain('No system is in use.')
    expect(html).toContain('0 systems in use, 0 overrides')
  })

  it('lists every field of every model in use with its grade, layer, source and spread', () => {
    useStore.getState().addEntityFromModel(SENSOR, { x: 0, y: 0 })
    useStore.getState().addEntityFromModel(EFFECTOR, { x: 100, y: 0 })
    const html = render()

    expect(html).toContain('2 systems in use, 0 overrides')
    expect(html).toContain('Giraffe 1X 3D radar (Saab)')
    expect(html).toContain('Coyote Block 2 interceptor')
    // A datasheet row with no recorded lineage derives its grade and layer.
    expect(html).toContain('detectRangeM')
    expect(html).toContain('MANUFACTURER_CLAIM')
    expect(html).toContain('Saab Giraffe 1X product page')
    expect(html).toContain('lognormal ±3 dB')
    // A referenced row, a planning factor and a null value each take their own lineage.
    expect(html).toContain('REPORTED')
    expect(html).toContain('INFERRED')
    expect(html).toContain('UNKNOWN')
    expect(html).toContain('planning factor')
    expect(html).toContain('unknown')
    expect(html).toContain('>L1<')
    expect(html).toContain('>L2<')
    expect(html).toContain('>L3<')
    expect(html).toContain('beta 17/20')
    expect(html).toContain('triangular -0.2..0.3')
    expect(html).toContain('fixed')
    // Attributes are not fields: a string spec key never gets a row.
    expect(html).not.toContain('sensorType')
    expect(html).not.toContain('effectorType')
    // A model no active entity uses stays out.
    expect(html).not.toContain('Roadrunner-M interceptor (Anduril)')
  })

  it('shows a tuple field and its two-input edit form', () => {
    useStore.getState().addEntityFromModel(SENSOR, { x: 0, y: 0 })
    const html = render()
    expect(html).toContain('elevationDeg')
    expect(html).toContain('0, 70')
    expect(html).toContain(`aria-label="Edit elevationDeg on Giraffe 1X 3D radar (Saab)"`)
  })

  it('stamps the load notice and a chip on each field the load adopted', () => {
    load('rangeAccuracyM')
    useStore.getState().addEntityFromModel(SENSOR, { x: 0, y: 0 })
    const html = render()

    expect(html).toContain('Load adopted 1 seed field on 1 builtin model from data package v3')
    expect(html).toContain('seed v3')
    // The chip sits beside the adopted value, not beside an untouched one.
    expect(html).toMatch(/rangeAccuracyM<\/td><td>[^<]*<span class="chip det"[^>]*>seed v3<\/span>/)
    expect(html).not.toMatch(/detectRangeM<\/td><td>[^<]*<span class="chip det"/)
  })

  it('a New scenario and a parse that is not installed leave no stale stamp', () => {
    load('rangeAccuracyM')
    useStore.getState().addEntityFromModel(SENSOR, { x: 0, y: 0 })
    // Parsing another record (a baseline, an import) does not touch the Board's stamp.
    fillScenario(JSON.parse(JSON.stringify(emptyScenario())))
    expect(render()).toContain('Load adopted 1 seed field')
    // New builds fresh seed objects: no stamp follows them.
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().addEntityFromModel(SENSOR, { x: 0, y: 0 })
    const html = render()
    expect(html).not.toContain('Load adopted')
    expect(html).not.toContain('seed v3')
  })

  it('shows no notice and no chip when the save already holds every seed key', () => {
    useStore.getState().addEntityFromModel(SENSOR, { x: 0, y: 0 })
    const html = render()
    expect(html).not.toContain('Load adopted')
    expect(html).not.toContain('seed v3')
  })

  it('marks the override beside the source value and offers its reset', () => {
    useStore.getState().addEntityFromModel(SENSOR, { x: 0, y: 0 })
    expect(render()).not.toContain('override 2500')

    useOverrides.getState().setOverride(SENSOR, 'detectRangeM', 2500, 'site survey')
    const html = render()

    expect(html).toContain('override 2500')
    expect(html).toContain('1 system in use, 1 override')
    expect(html).toContain(`aria-label="Reset detectRangeM on Giraffe 1X 3D radar (Saab)"`)
    expect(html).toContain('aria-label="Reset every override"')
    // The scenario library keeps the sourced value: an override never edits it.
    const model = useStore.getState().scenario.library.find((m) => m.id === SENSOR)
    expect(model?.sensor?.detectRangeM).toBe(4000)
    expect(html).toContain('>4000 m<')
  })
})

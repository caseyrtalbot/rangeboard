import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { Inspector } from './Inspector'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<Inspector />)
}

/** Place one model on the board and select the entity it makes. */
function selectFromModel(modelId: string): void {
  const st = useStore.getState()
  st.replaceScenario(emptyScenario())
  st.addEntityFromModel(modelId, { x: 0, y: 0 })
  const entity = useStore.getState().scenario.entities[0]!
  useStore.getState().select({ entityIds: [entity.id] })
}

describe('Inspector provenance marks', () => {
  beforeEach(() => {
    const st = useStore.getState()
    st.replaceScenario(emptyScenario())
    st.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    const sensor = useStore.getState().scenario.entities.find((e) => e.kind === 'sensor')!
    useStore.getState().select({ entityIds: [sensor.id] })
  })

  it('marks a sourced field filled with its basis, source and date in the title', () => {
    const html = render()
    const tag = /<span class="prov-mark" title="([^"]*)"/.exec(html)
    expect(tag).not.toBeNull()
    expect(tag![1]).toMatch(
      /^(datasheet|reference) · .+ · \d{4}-\d{2}-\d{2}( · spread .+)?$/,
    )
  })

  it('marks an unsourced field as a hollow planning factor', () => {
    expect(render()).toContain('<span class="prov-mark pf" title="planning factor"')
  })

  it('names the field spread in the mark title', () => {
    const html = render()
    // The Giraffe 1X detection range is sourced and takes the 3 dB PF spread.
    expect(html).toMatch(/<span class="prov-mark" title="[^"]* · spread ±3 dB"/)
  })
})

describe('Inspector effector and threat marks', () => {
  it('marks a sourced effector range and its unsourced Pk planning factor', () => {
    selectFromModel('lib-skyranger30')
    const html = render()
    const wez = html.slice(html.indexOf('WEZ'), html.indexOf('Engagement time'))
    expect(wez).toContain('class="prov-mark" title="datasheet')
    const pk = html.slice(html.indexOf('Single-shot Pk'), html.indexOf('Magazine'))
    // A Pk with no row takes the PF table beta, so the title names its pseudo-counts.
    expect(pk).toContain('<span class="prov-mark pf" title="planning factor · spread 17 of 20 (pseudo)"')
  })

  it('tags the threat radar cross section row', () => {
    selectFromModel('lib-mavic3')
    const html = render()
    const rcs = html.slice(html.indexOf('Radar cross section'), html.indexOf('Fluctuation model'))
    expect(rcs).toContain('<span class="prov-mark pf" title="planning factor · spread ±6 dB"')
  })
})

describe('Inspector flyout speed rows', () => {
  it('quotes the stated speed and 0.7 of it as the average, marked planning factor', () => {
    selectFromModel('lib-coyote')
    const html = render()
    const rows = html.slice(html.indexOf('Flyout speed'), html.indexOf('Altitude ceiling'))
    // Coyote Block 2: 154 m/s stated, so 154 x 0.7 = 107.8, shown as 108 m/s.
    expect(rows).toContain('154 m/s')
    expect(rows).toContain('Average flyout speed')
    expect(rows).toContain('108 m/s')
    expect(rows).toContain('<span class="prov-mark pf" title="planning factor"')
  })
})

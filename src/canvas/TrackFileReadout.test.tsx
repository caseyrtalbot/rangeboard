import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { engagementPicture } from '../analysis/impact'
import { emptyScenario } from '../model/seed'
import { buildTrackTimeline } from '../playback/trackState'
import { useStore } from '../state/store'
import { TrackFileReadout } from './TrackFileReadout'

function render(): string {
  const scenario = useStore.getState().scenario
  const { assessments, report } = engagementPicture(scenario)
  const timeline = buildTrackTimeline(scenario, assessments, report)
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <TrackFileReadout timeline={timeline} assessments={assessments} size={{ w: 1200, h: 800 }} />,
  )
}

describe('TrackFileReadout', () => {
  beforeEach(() => {
    const store = useStore.getState()
    store.replaceScenario(emptyScenario())
    store.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const threat = useStore.getState().scenario.entities.find((entity) => entity.kind === 'uas')!
    useStore.getState().beginPath(threat.id)
    useStore.getState().addDraftPoint({ x: 0, y: -100 })
    useStore.getState().finishPath()
    useStore.getState().select({ entityIds: [threat.id] })
  })

  it('keeps only current essentials in the compact canvas card', () => {
    const html = render()

    expect(html).toContain('class="readout compact"')
    expect(html).toContain('DJI Mavic 3 (G1 quad) 1')
    expect(html.match(/class="ro-k"/g)?.length).toBe(3)
    expect(html).toContain('<div class="ro-k">CURSOR</div>')
    expect(html).toContain('<div class="ro-k">SPEED / HDG</div>')
    expect(html).toContain('<div class="ro-k">ALT</div>')
    expect(html).not.toContain('<div class="ro-k">PLATFORM</div>')
    expect(html).not.toContain('<div class="ro-k">ARRIVAL</div>')
  })

  it('states the cursor source and retains the Details action', () => {
    const html = render()

    expect(html).toContain('PLANNING MODEL · CURSOR @ 0.5 S · ALT CONSTANT · NOT INSTRUMENTED')
    expect(html).toContain('title="Details in Analysis"')
    expect(html).toContain('>Details</button>')
  })
})

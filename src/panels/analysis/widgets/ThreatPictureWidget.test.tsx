import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../../../playback/__fixtures__/detection-outside-rings.json'
import { EMPTY_HORIZON, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import { engagementPicture } from '../../../analysis/impact'
import { formatTime } from '../../../geometry/geo'
import { parseAutosave } from '../../../io/persist'
import { useStore } from '../../../state/store'
import { selectExecutionHorizon } from '../../../state/selectors'
import { ThreatPictureWidget } from './ThreatPictureWidget'

function render(horizon: ExecutionHorizon) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<ThreatPictureWidget horizon={horizon} id="threat" params={{ expanded: true }} collapsed={false} customize={false} index={0} count={1} />)
}

describe('ThreatPictureWidget visibility', () => {
  beforeEach(() => {
    const scenario = parseAutosave(JSON.stringify(fixture))
    scenario.paths.forEach((path) => { path.startDelayS += 20 })
    useStore.getState().replaceScenario(scenario)
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    useStore.getState().scrubTo(2000)
  })

  it('retains Analyze preview wording and reached-at-cursor member times', () => {
    const { report } = engagementPicture(useStore.getState().scenario)
    const html = render(FULL_RUN)
    expect(html).toContain('Threats at preview cursor')
    expect(html).toContain('preview ')
    expect(html).toContain(`ENG ${formatTime(report.events[0].tS)}`)
    expect(html).toContain('EXPECTED')
  })

  it('clamps expanded members, counts, titles and sensor hits before the first event', () => {
    useStore.getState().setBoardPhase('execute')
    const html = render(selectExecutionHorizon(useStore.getState()))
    expect(html).toContain('T+0:01')
    expect(html).toContain('UNSEEN')
    expect(html).toContain('D — · ID — · ENG — · Expected FX —')
    expect(html).toContain('0.00 expected kills')
    expect(html).not.toContain('4:10')
    expect(html).not.toContain('>ENGAGED<')
    expect(html).not.toContain('>EXPECTED DEFEAT<')
    expect(html).not.toContain('Threats at preview cursor')
  })

  it('has an empty member list for EMPTY_HORIZON', () => {
    const html = render(EMPTY_HORIZON)
    expect(html).toContain('No threat telemetry yet.')
    expect(html).toContain('ready')
    expect(html).not.toContain('threat-data-group')
    expect(html).not.toContain('T+')
  })
})

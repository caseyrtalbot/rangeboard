import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_HORIZON, FULL_RUN } from '../../analysis/horizon'
import { parseAutosave } from '../../io/persist'
import fixture from '../../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { useStore } from '../../state/store'
import { selectExecutionHorizon } from '../../state/selectors'
import { censorLane, EngagementStrip } from './EngagementStrip'
import { EngagementLanesWidget } from './widgets/EngagementLanesWidget'

const lane: Parameters<typeof censorLane>[0] = {
  key: 'threat', label: 'Threat 1', entityIds: ['threat'], groupKey: null,
  detS: 0, suspectedAtS: 0, hostileAtS: 0, winS: [20, 500],
  shotS: 20, arrS: 475, severity: 'severe',
}

function render(embedded = true) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<EngagementStrip embedded={embedded} />)
}

describe('censorLane', () => {
  it('preserves unscoped identity', () => {
    expect(censorLane(lane, FULL_RUN)).toBe(lane)
  })

  it('clips the captured lane at 30 seconds without mutating it', () => {
    expect(censorLane(lane, { scoped: true, horizonS: 30 })).toEqual({
      ...lane, winS: [20, 30], arrS: null, severity: null,
    })
    expect(lane.winS).toEqual([20, 500])
    expect(lane.arrS).toBe(475)
  })

  it('retains only lane identity at the empty horizon', () => {
    expect(censorLane(lane, EMPTY_HORIZON)).toEqual({
      ...lane, detS: null, suspectedAtS: null, hostileAtS: null,
      winS: null, shotS: null, arrS: null, severity: null,
    })
  })

  it('drops unreached window and classification times and includes an arrival at the boundary', () => {
    expect(censorLane({ ...lane, suspectedAtS: 10, hostileAtS: 20 }, { scoped: true, horizonS: 5 }))
      .toMatchObject({ detS: 0, suspectedAtS: null, hostileAtS: null, winS: null, shotS: null })
    expect(censorLane(lane, { scoped: true, horizonS: 475 }))
      .toMatchObject({ arrS: 475, severity: 'severe' })
  })
})

describe('EngagementStrip execution scope', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(parseAutosave(JSON.stringify(fixture))!)
    useStore.getState().setBoardPhase('execute')
  })

  it('keeps names without outcome marks before Play', () => {
    const html = render()
    expect(html).toContain('DJI Mavic 3 (G1 quad) 1')
    expect(html).toContain('aria-label="No outcomes observed yet"')
    expect(html).not.toContain('shape-rendering=')
    expect(html).not.toContain('<path')
    expect(html).not.toContain('never detected')
    expect(render(false)).toContain('aria-label="No outcomes observed yet"')
  })

  it('caps the accessible scope and arrival marks while scrubbing forward', () => {
    useStore.getState().advanceRun(30)
    useStore.getState().pauseRun()
    useStore.getState().scrubTo(500)
    const html = render()
    expect(html).toContain('aria-label="Outcomes through T+0:30"')
    expect(html).not.toContain('<path')
    expect(html).toContain('clip-path=')
    expect(render(false)).toContain('aria-label="Outcomes through T+0:30"')
  })

  it('preserves full-run marks in Prepare and Analyze', () => {
    useStore.getState().setBoardPhase('prepare')
    const prepare = render()
    useStore.getState().setBoardPhase('analyze')
    expect(render()).toBe(prepare)
    expect(prepare).toContain('<path')
    expect(prepare).not.toContain('clip-path=')
  })

  it('passes scope to the widget frame meta', () => {
    Object.assign(useStore.getInitialState(), useStore.getState())
    const props = { id: 'lanes', params: {}, collapsed: false, customize: false, index: 0, count: 1 }
    const scoped = renderToStaticMarkup(<EngagementLanesWidget {...props} horizon={selectExecutionHorizon(useStore.getState())} />)
    expect(scoped).not.toContain('planning envelope · per threat')
    const full = renderToStaticMarkup(<EngagementLanesWidget {...props} horizon={FULL_RUN} />)
    expect(full).toContain('planning envelope · per threat')
  })
})

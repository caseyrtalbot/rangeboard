import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_HORIZON, FULL_RUN } from '../../analysis/horizon'
import { installTrial, observeTrial, unstartTrial } from './trialTestState'
import { trialAssessment } from '../../playback/__fixtures__/trialFixture'
import { createTrialManifest } from '../../playback/trialTypes'
import { analysisBasisSignature } from '../../state/analysisBasis'
import { useStore } from '../../state/store'
import { censorLane, EngagementStrip } from './EngagementStrip'

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

const STATE_TEXT = {
  preparing: 'Preparing trial', error: 'Trial preparation failed', cancelled: 'Trial cancelled',
}

describe('EngagementStrip execution scope', () => {
  beforeEach(() => {
    installTrial(3)
    useStore.getState().setBoardPhase('execute')
  })

  it('renders an empty strip with trial state text before Play', () => {
    unstartTrial()
    const html = render()
    expect(html).not.toContain('Simulated trial')
    expect(html).toContain('No trial yet. Press Play to start one.')
    expect(html).not.toContain('engstrip-name-text')
    expect(html).toContain('aria-label="No outcomes observed yet"')
    expect(html).not.toContain('shape-rendering=')
    expect(html).not.toContain('<path')
    expect(html).not.toContain('never detected')
    expect(render(false)).toContain('aria-label="No outcomes observed yet"')
  })

  it('caps the accessible scope and arrival marks while scrubbing forward', () => {
    observeTrial(3, 50)
    const html = render()
    expect(html).toContain('aria-label="Outcomes through T+0:03"')
    expect(html).not.toContain('<path')
    expect(html).toContain('clip-path=')
    expect(render(false)).toContain('aria-label="Outcomes through T+0:03"')
  })

  it('bounds trial marks in Prepare and Analyze and reveals arrivals only when reached', () => {
    useStore.getState().setBoardPhase('prepare')
    const prepare = render()
    useStore.getState().setBoardPhase('analyze')
    expect(render()).toBe(prepare)
    expect(prepare).not.toContain('<path')
    expect(prepare).toContain('clip-path=')
    observeTrial(5)
    expect(render()).toContain('<path')
    observeTrial(5, 0)
    expect(render()).not.toContain('<path')
  })

  it.each(['preparing', 'error', 'cancelled'] as const)('renders no forecast lanes when %s', status => {
    const trial = useStore.getState().trial
    useStore.setState({ trial: { ...trial, status, error: status === 'error' ? 'Trial preparation failed' : null } })
    const html = render()
    expect(html).toContain(STATE_TEXT[status])
    expect(html).not.toContain('engstrip-name-text')
    expect(html).not.toContain('shape-rendering=')
  })

  it('censors members before grouping so an observed arrival survives unreached group arrivals', () => {
    const fixture = installTrial(3)
    const ids = Array.from({ length: 15 }, (_, i) => `raid-${i}`)
    const base = fixture.scenario.entities.find(entity => entity.id === 'flyby')!
    const scenario = { ...fixture.scenario,
      entities: [...fixture.scenario.entities.filter(entity => entity.kind !== 'uas'),
        ...ids.map((id, i) => ({ ...base, id, name: `Raid ${i + 1}` }))],
      paths: ids.map(id => ({ ...fixture.scenario.paths[0], id: `path-${id}`, entityId: id })),
    }
    const manifest = createTrialManifest(scenario, fixture.manifest.runId, analysisBasisSignature(scenario))
    const assessments = ids.map((id, i) => trialAssessment(id, { arrivalS: i === 0 ? 2 : 10 }))
    const result = { ...fixture.result, manifest, assessments, observations: [], jamDecisions: [],
      report: { ...fixture.result.report, events: [], threats: ids.map(id => ({ ...fixture.result.report.threats[0], uasId: id, shipCount: 1, firstShotS: null })) },
    }
    useStore.setState({ scenario, trial: { ...useStore.getState().trial, scenario, manifest, result } })
    const html = render()
    expect(html).toContain('Raid ×15')
    expect(html.match(/<path /g)).toHaveLength(1)
    expect(html).toContain('fill="var(--danger)"')
  })
})

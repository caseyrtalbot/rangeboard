import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { EMPTY_HORIZON, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import * as forecast from '../../../analysis/impact'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import { createTrialManifest } from '../../../playback/trialTypes'
import { runTrial } from '../../../playback/trial'
import { IDLE_TRIAL } from '../../../state/runState'
import { formatTime } from '../../../geometry/geo'
import { parseAutosave } from '../../../io/persist'
import { useStore } from '../../../state/store'
import { EventLedgerList, EventLedgerWidget } from './EventLedgerWidget'

function render(horizon: ExecutionHorizon, collapsed = false) {
  const st = useStore.getState()
  useStore.setState({ playback: { ...st.playback, startedAtMs: horizon === EMPTY_HORIZON ? null : 1, observedThroughS: horizon.scoped ? Math.max(0, horizon.horizonS) : 250 } })
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<EventLedgerWidget horizon={horizon} id="ledger" params={{}} collapsed={collapsed} customize={false} index={0} count={1} />)
}

function report() {
  return useStore.getState().trial.result!.report
}

afterEach(() => vi.restoreAllMocks())

describe('EventLedgerWidget visibility', () => {
  beforeEach(() => {
    const scenario = parseAutosave(JSON.stringify(fixture))
    scenario.paths.forEach((path) => { path.startDelayS += 20 })
    useStore.getState().replaceScenario(scenario)
    const manifest = createTrialManifest(scenario, useStore.getState().playback.runId, analysisBasisSignature(scenario))
    useStore.setState({ trial: { ...IDLE_TRIAL, status: 'ready', scenario, manifest, result: runTrial(scenario, manifest) } })
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    useStore.getState().scrubTo(250)
  })

  it('uses the trial ledger and realized removal labels even outside Execute', () => {
    const event = report().events[0]
    expect(event).toBeDefined()
    const spy = vi.spyOn(forecast, 'engagementPicture')
    const html = render(FULL_RUN)
    expect(spy).not.toHaveBeenCalled()
    expect(html).toContain(`${formatTime(event.tS)} → ${formatTime(event.tEffectS)}`)
    expect(html).toContain(`Removed ${event.killDelta.toFixed(0)}`)
    expect(html).toContain(`${report().events.filter(e => e.tS <= 250).length} events`)
  })

  it('has no rows or future total before the first assignment, even when collapsed', () => {
    expect(report().events[0].tS).toBeGreaterThan(1)
    const horizon = { scoped: true, horizonS: 1 }
    expect(render(horizon)).toContain('No engagement events yet.')
    expect(render(horizon)).not.toContain('event-row')
    expect(render(horizon, true)).toContain('0 events')
    expect(render(horizon, true)).not.toContain(`of ${report().events.length}`)
  })

  it('shows no event rows for EMPTY_HORIZON despite a future cursor', () => {
    const html = render(EMPTY_HORIZON)
    expect(html).toContain('Simulated trial · ready')
    expect(html).not.toContain('event-row')
  })

  it('keeps assigned effects pending until their inclusive effect boundary', () => {
    const event = report().events[0]
    expect(event.tEffectS).toBeGreaterThan(event.tS)
    const pending = render({ scoped: true, horizonS: event.tS })
    expect(pending).toContain(`${formatTime(event.tS)} → —`)
    expect(pending).toContain('P —')
    expect(pending).toContain('Removed —')
    expect(pending).not.toContain(formatTime(event.tEffectS))
    expect(pending).not.toContain(`Removed ${event.killDelta.toFixed(0)}`)
    const landed = render({ scoped: true, horizonS: event.tEffectS })
    expect(landed).toContain(`${formatTime(event.tS)} → ${formatTime(event.tEffectS)}`)
    expect(landed).toContain(`Removed ${event.killDelta.toFixed(0)}`)
  })

  it('defaults standalone evidence lists to full-run and censors pagination totals', () => {
    const scenario = useStore.getState().scenario
    const full = report()
    const event = full.events[0]
    const many = { ...full, events: Array.from({ length: 30 }, (_, i) => ({ ...event, tS: i + 10, tEffectS: i + 50 })) }
    const unscoped = renderToStaticMarkup(<EventLedgerList scenario={scenario} report={many} />)
    expect(unscoped).toContain('10 remaining')
    const scoped = renderToStaticMarkup(<EventLedgerList scenario={scenario} report={many} horizon={{ scoped: true, horizonS: 30 }} />)
    expect(scoped).toContain('1 remaining')
    expect(scoped).not.toContain('10 remaining')
    expect(scoped).not.toContain(formatTime(50))
  })
})

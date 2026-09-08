import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../../../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { EMPTY_HORIZON, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import { engagementPicture } from '../../../analysis/impact'
import { formatTime } from '../../../geometry/geo'
import { parseAutosave } from '../../../io/persist'
import { useStore } from '../../../state/store'
import { EventLedgerList, EventLedgerWidget } from './EventLedgerWidget'

function render(horizon: ExecutionHorizon, collapsed = false) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<EventLedgerWidget horizon={horizon} id="ledger" params={{}} collapsed={collapsed} customize={false} index={0} count={1} />)
}

function report() {
  return engagementPicture(useStore.getState().scenario).report
}

describe('EventLedgerWidget visibility', () => {
  beforeEach(() => {
    const scenario = parseAutosave(JSON.stringify(fixture))
    scenario.paths.forEach((path) => { path.startDelayS += 20 })
    useStore.getState().replaceScenario(scenario)
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    useStore.getState().scrubTo(250)
  })

  it('retains assignment/effect values and full totals when unscoped', () => {
    const event = report().events[0]
    expect(event).toBeDefined()
    const html = render(FULL_RUN)
    expect(html).toContain(`${formatTime(event.tS)} → ${formatTime(event.tEffectS)}`)
    expect(html).toContain(`ΔE[k] ${event.killDelta.toFixed(3)}`)
    expect(html).toContain(`of ${report().events.length}`)
  })

  it('has no rows or future total before the first assignment, even when collapsed', () => {
    expect(report().events[0].tS).toBeGreaterThan(1)
    const horizon = { scoped: true, horizonS: 1 }
    expect(render(horizon)).toContain('No engagement events yet.')
    expect(render(horizon)).not.toContain('event-row')
    expect(render(horizon, true)).toContain('planning envelope · 0 of 0')
    expect(render(horizon, true)).not.toContain(`of ${report().events.length}`)
  })

  it('shows no event rows for EMPTY_HORIZON despite a future cursor', () => {
    const html = render(EMPTY_HORIZON)
    expect(html).toContain('0 of 0')
    expect(html).toContain('No engagement events yet.')
    expect(html).not.toContain('event-row')
  })

  it('keeps assigned effects pending until their inclusive effect boundary', () => {
    const event = report().events[0]
    expect(event.tEffectS).toBeGreaterThan(event.tS)
    const pending = render({ scoped: true, horizonS: event.tS })
    expect(pending).toContain(`${formatTime(event.tS)} → —`)
    expect(pending).toContain('P —')
    expect(pending).toContain('ΔE[k] —')
    expect(pending).not.toContain(formatTime(event.tEffectS))
    expect(pending).not.toContain(`ΔE[k] ${event.killDelta.toFixed(3)}`)
    const landed = render({ scoped: true, horizonS: event.tEffectS })
    expect(landed).toContain(`${formatTime(event.tS)} → ${formatTime(event.tEffectS)}`)
    expect(landed).toContain(`ΔE[k] ${event.killDelta.toFixed(3)}`)
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

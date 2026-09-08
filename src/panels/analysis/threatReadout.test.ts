import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_HORIZON, FULL_RUN } from '../../analysis/horizon'
import { detectionsAt } from '../../playback/detection'
import { trackStatesAt } from '../../playback/trackState'
import { engagementPicture } from '../../analysis/impact'
import { threatPictureAt } from '../../analysis/threatAggregation'
import { emptyScenario } from '../../model/seed'
import { buildTrackTimeline } from '../../playback/trackState'
import { useStore } from '../../state/store'
import { ThreatPicture } from './ThreatPicture'
import { threatReadoutAt } from './threatReadout'

function fixture(softShot = false, killDelta = 0.999) {
  const scenario = useStore.getState().scenario
  const entity = scenario.entities.find((candidate) => candidate.kind === 'uas')!
  const { assessments, report: baseReport } = engagementPicture(scenario)
  const report = {
    ...baseReport,
    events: [{
      tS: 5,
      tEffectS: 10,
      effectorId: 'fixture-effector',
      uasId: entity.id,
      shipIdx: 0,
      channel: 'kill' as const,
      softShot,
      effectorType: softShot ? 'jammer' as const : 'interceptor' as const,
      channelClass: softShot ? 'ew' as const : 'kinetic' as const,
      lateEffect: false,
      pk: killDelta,
      killDelta,
    }],
  }
  const timeline = buildTrackTimeline(scenario, assessments, report)
  return { scenario, entity, assessments, report, timeline }
}

describe('threat outcome wording', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const threat = useStore.getState().scenario.entities.find((entity) => entity.kind === 'uas')!
    useStore.getState().beginPath(threat.id)
    useStore.getState().addDraftPoint({ x: 0, y: -100 })
    useStore.getState().finishPath()
  })

  it.each([
    [false, 'hard-kill effects'],
    [true, 'mission-kill effects'],
  ] as const)('qualifies ghost outcomes with softShot=%s', (softShot, effects) => {
    const input = fixture(softShot)
    const readout = threatReadoutAt({ ...input, tS: 10, units: 'metric' })

    expect(readout.phase).toBe('ghost')
    expect(readout.pillLabel).toBe('EXPECTED DEFEAT')
    expect(readout.ghostLine).toBe(
      `Expected residual below cutoff at T+0:10 (${effects}). Motion continues along the planned path.`,
    )
    expect(readout.state?.expectedKills).toBe(0.999)
    expect(readout.state?.residual).toBeCloseTo(0.001)
    expect(readout.state?.eliminatedBySoft).toBe(softShot)
    expect(readout.rows.find((row) => row.id === 'effects')?.value).toBe('1 landed · E[k] 1.00')
    expect(readout.rows.find((row) => row.id === 'residual')?.value).toBe('0.00 of 1 ships')

    const before = threatReadoutAt({ ...input, tS: 9.5, units: 'metric' })
    expect(before.pillLabel).toBe('ENGAGED')
    expect(before.ghostLine).toBeNull()
  })

  it('preserves fractional outcomes below the ghost cutoff without claiming a realized kill', () => {
    const readout = threatReadoutAt({ ...fixture(false, 0.952), tS: 10, units: 'metric' })

    expect(readout.pillLabel).toBe('EXPECTED DEFEAT')
    expect(readout.ghostLine).toContain('Expected residual below cutoff')
    expect(readout.state?.expectedKills).toBe(0.952)
    expect(readout.rows.find((row) => row.id === 'effects')?.value).toBe('1 landed · E[k] 0.95')
    expect(readout.rows.find((row) => row.id === 'residual')?.value).toBe('0.05 of 1 ships')
  })

  it.each(['live', 'projected', 'debrief'] as const)(
    'renders expected defeat and unchanged group quantities in %s mode',
    (mode) => {
      const { scenario, assessments, report } = fixture()
      const groups = threatPictureAt(scenario, assessments, report, 10, new Map())
      const html = renderToStaticMarkup(createElement(ThreatPicture, { groups, mode, membersOpen: true }))

      expect(html).toContain('EXPECTED DEFEAT')
      expect(html).not.toContain('DEFEATED')
      expect(html).not.toContain('>EFFECT<')
      expect(html).toContain('Expected FX 0:10')
      expect(html).toContain('title="1.00 expected kills · 0.00 expected surviving ships · 1 salvos"')
      expect(html).toContain('0.1%')
    },
  )

  it('labels partial live effects as expected', () => {
    const { scenario, assessments, report } = fixture(false, 0.75)
    const groups = threatPictureAt(scenario, assessments, report, 10, new Map())
    const html = renderToStaticMarkup(createElement(ThreatPicture, {
      groups, mode: 'live', membersOpen: true,
    }))

    expect(html).toContain('EXPECTED EFFECT')
    expect(html).not.toContain('EFFECT OBS')
    expect(html).not.toContain('EXPECTED DEFEAT')
    expect(html).toContain('title="0.75 expected kills · 0.25 expected surviving ships · 1 salvos"')
  })

  it('ignores a future supplied sweep and hides unreached defeat at a 30-second horizon', () => {
    const input = fixture()
    const report = { ...input.report, events: input.report.events.map((event) => ({ ...event, tS: 35, tEffectS: 40 })) }
    const timeline = buildTrackTimeline(input.scenario, input.assessments, report)
    const readout = threatReadoutAt({
      ...input, timeline, tS: 100, units: 'metric', horizon: { scoped: true, horizonS: 30 },
      sweep: { states: trackStatesAt(timeline, 100), hits: detectionsAt(input.scenario, 100) },
    })
    expect(readout.pillLabel).not.toBe('EXPECTED DEFEAT')
    expect(readout.ghostLine).toBeNull()
    expect(readout.state?.effectsLanded).toBe(0)
    expect(readout.cursorText).toBe('T+0:30')
    expect(readout.rows.some((row) => row.horizon === 'full-path')).toBe(false)
    expect(readout.planningRows.map((row) => row.label)).toEqual(['Planned CPA', 'Planned arrival'])
    const reached = threatReadoutAt({ ...input, timeline, tS: 100, units: 'metric', horizon: { scoped: true, horizonS: 40 } })
    expect(reached.pillLabel).toBe('EXPECTED DEFEAT')
    expect(reached.ghostLine).toContain('T+0:40')
  })

  it('shows untouched telemetry even when a T0 sensor fallback would detect a pathless threat', () => {
    useStore.getState().addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    const input = fixture()
    const scenario = { ...input.scenario, paths: [] }
    expect(detectionsAt(scenario, 0).get(input.entity.id)?.length).toBeGreaterThan(0)
    const readout = threatReadoutAt({ ...input, scenario, tS: 100, units: 'metric', horizon: EMPTY_HORIZON })
    expect(readout.state).toBeUndefined()
    expect(readout.phase).toBe('undetected')
    expect(readout.ghostLine).toBeNull()
    expect(readout.cursorText).toBe('—')
    expect(readout.engageText).toBe('—')
    expect(readout.warningText).toBe('—')
    expect(readout.firstDetectText).toBe('—')
    for (const id of ['position', 'classification', 'ew', 'residual']) {
      expect(readout.rows.find((row) => row.id === id)?.value).toBe('—')
    }
    expect(readout.rows.find((row) => row.id === 'hold')?.value).toBe('0 sensors')
  })

  it('preserves the full-run default and censors first detection and warning independently', () => {
    const input = fixture()
    const assessments = input.assessments.map((assessment) => ({
      ...assessment, firstDetectS: 35, arrivalS: 80, warningS: 45,
    }))
    const resolve = (horizonS: number) => threatReadoutAt({
      ...input, assessments, tS: 100, units: 'metric', horizon: { scoped: true, horizonS },
    })
    expect(resolve(30).firstDetectText).toBe('—')
    expect(resolve(35).firstDetectText).toContain('T+0:35')
    expect(resolve(35).warningText).toBe('—')
    expect(resolve(80).warningText).toBe('0:45')
    const defaults = threatReadoutAt({ ...input, tS: 100, units: 'metric' })
    expect(threatReadoutAt({ ...input, tS: 100, units: 'metric', horizon: FULL_RUN })).toEqual(defaults)
    expect(defaults.planningRows).toEqual([])
    expect(defaults.rows.find((row) => row.id === 'arrival')?.label).toBe('Arrival (full path)')
  })

})

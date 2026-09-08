import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
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
})

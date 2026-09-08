import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { engagementPicture } from '../../analysis/impact'
import { threatPictureAt } from '../../analysis/threatAggregation'
import { emptyScenario } from '../../model/seed'
import { buildTrackTimeline } from '../../playback/trackState'
import { useStore } from '../../state/store'
import { ThreatPicture } from './ThreatPicture'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_HORIZON } from '../../analysis/horizon'
import { mixedTrial } from '../../playback/__fixtures__/trialFixture'
import { trialSweepAt } from '../../playback/trialSweepAt'
import { threatReadoutAt, trialTelemetryAt } from './threatReadout'

vi.mock('../../playback/detection', async importOriginal => ({
  ...await importOriginal<typeof import('../../playback/detection')>(),
  detectionsAt: () => { throw new Error('No deterministic detection fallback') },
}))

function fixture() {
  const { scenario, view } = mixedTrial()
  return { scenario, trial: view, entity: scenario.entities[0], units: 'metric' as const }
}

describe('trial threat readout', () => {
  it('shows integer member outcomes without ghosting surviving formation members', () => {
    const input = fixture()
    const readout = threatReadoutAt({ ...input, tS: 3 })
    expect(readout.phase).not.toBe('ghost')
    expect(readout.rows.find(row => row.id === 'residual')?.value).toBe('3 active · 1 hard kill · 1 mission kill · 5 members')
    expect(readout.rows.find(row => row.id === 'effects')?.value).toBe('3 landed · 1 hard kill · 1 mission kill')
    expect(readout.ghostLine).toContain('1 hard-killed members frozen')
    expect(JSON.stringify(readout)).not.toContain('E[k]')
  })

  it('rejects a future sweep and caps effects, classification, arrivals and warning at R2 horizon', () => {
    const input = fixture()
    input.trial.assessments[0].warningS = 3.9
    const readout = threatReadoutAt({ ...input, tS: 50, horizonS: 50, horizon: { scoped: true, horizonS: 1 },
      trialSweep: trialSweepAt(input.trial, 50) })
    expect(readout.state?.effectsLanded).toBe(0)
    expect(readout.state?.holdingSensorIds).toEqual([])
    expect(readout.state?.classification).toBe('unknown')
    expect(readout.firstDetectText).toBe('—')
    expect(readout.warningText).toBe('—')
    expect(readout.rows.find(row => row.id === 'arrival')?.value).toBe('—')
    expect(readout.cursorText).toBe('T+0:01')
    expect(readout.planningRows.map(row => row.label)).toEqual(['Planned CPA', 'Planned arrival'])
    const reached = threatReadoutAt({ ...input, tS: 5 })
    expect(reached.firstDetectText).toContain('radar')
    expect(reached.warningText).toBe('0:03')
    expect(reached.rows.find(row => row.id === 'arrival')?.value).toContain('3 undefeated members')
  })

  it('does not reconstruct a pathless detection or use legacy caller inputs', () => {
    const input = fixture()
    const readout = threatReadoutAt({ ...input, trial: null, tS: 50, assessments: input.trial.assessments })
    expect(readout.state).toBeUndefined()
    expect(readout.phase).toBe('undetected')
    expect(readout.warningText).toBe('—')
    const parked = threatReadoutAt({ ...input, entity: input.scenario.entities[2], tS: 50 })
    expect(parked.state?.holdingSensorIds).toEqual([])
    expect(parked.phase).toBe('undetected')
    expect(parked.state?.shipCount).toBe(2)
  })

  it.each([null, 0])('preserves the untouched R2 gate with horizonS=%s', horizonS => {
    const readout = threatReadoutAt({ ...fixture(), horizonS, tS: 100, horizon: EMPTY_HORIZON })
    expect(readout.state).toBeUndefined()
    expect(readout.cursorText).toBe('—')
    expect(readout.firstDetectText).toBe('—')
    expect(readout.rows.find(row => row.id === 'hold')?.value).toBe('0 sensors')
  })

  it('keeps an EW channel separate from sampled jam and counts only released incoming rounds', () => {
    const { trial } = fixture()
    expect(trialTelemetryAt(trial, 'swarm', 1.3).incomingSalvos).toBe(0)
    expect(trialTelemetryAt(trial, 'swarm', 1.3).jammedNow).toBe(false)
    expect(trialTelemetryAt(trial, 'swarm', 1.5).jammedNow).toBe(true)
    expect(trialTelemetryAt(trial, 'swarm', 1.8).incomingSalvos).toBe(1)
    expect(trialTelemetryAt(trial, 'swarm', 2).incomingSalvos).toBe(0)
    expect(trialTelemetryAt(trial, 'swarm', 3.1).coasting).toBe(true)
  })
})

function forecastFixture(softShot = false, killDelta = 0.999) {
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

describe('forecast threat-picture wording (retained)', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const threat = useStore.getState().scenario.entities.find((entity) => entity.kind === 'uas')!
    useStore.getState().beginPath(threat.id)
    useStore.getState().addDraftPoint({ x: 0, y: -100 })
    useStore.getState().finishPath()
  })

  it.each(['live', 'projected', 'debrief'] as const)(
    'renders expected defeat and unchanged group quantities in %s mode',
    (mode) => {
      const { scenario, assessments, report } = forecastFixture()
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
    const { scenario, assessments, report } = forecastFixture(false, 0.75)
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

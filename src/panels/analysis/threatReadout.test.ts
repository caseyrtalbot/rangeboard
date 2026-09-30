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
import { mixedTrial, trialEvent } from '../../playback/__fixtures__/trialFixture'
import { trialSweepAt } from '../../playback/trialSweepAt'
import {
  deathPill,
  lateKillText,
  threatReadoutAt,
  trialTelemetryAt,
  trialOutcomeRows,
  CHAIN_STAGES,
  STAGES_REACHED,
  trackStageWord,
  TTA_TONE_S,
  ttaReadout,
} from './threatReadout'
import { trialThreatPictureAt } from '../../analysis/threatAggregation'

vi.mock('../../playback/detection', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../playback/detection')>()),
  detectionsAt: () => {
    throw new Error('No deterministic detection fallback')
  },
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
    expect(readout.rows.find((row) => row.id === 'residual')?.value).toBe(
      '3 active · 1 hard kill · 1 mission kill · 5 members',
    )
    expect(readout.rows.find((row) => row.id === 'effects')?.value).toBe(
      '3 landed · 1 hard kill · 1 mission kill',
    )
    expect(readout.ghostLine).toContain('1 hard-killed members frozen')
    expect(JSON.stringify(readout)).not.toContain('E[k]')
  })

  it('rejects a future sweep and caps effects, classification, arrivals and warning at R2 horizon', () => {
    const input = fixture()
    input.trial.assessments[0].warningS = 3.9
    const readout = threatReadoutAt({
      ...input,
      tS: 50,
      horizonS: 50,
      horizon: { scoped: true, horizonS: 1 },
      trialSweep: trialSweepAt(input.trial, 50),
    })
    expect(readout.state?.effectsLanded).toBe(0)
    expect(readout.state?.holdingSensorIds).toEqual([])
    expect(readout.state?.classification).toBe('unknown')
    expect(readout.firstDetectText).toBe('—')
    expect(readout.warningText).toBe('—')
    expect(readout.rows.find((row) => row.id === 'arrival')?.value).toBe('—')
    expect(readout.cursorText).toBe('T+0:01')
    expect(readout.planningRows.map((row) => row.label)).toEqual(['Planned CPA', 'Planned arrival'])
    const reached = threatReadoutAt({ ...input, tS: 5 })
    expect(reached.firstDetectText).toContain('radar')
    expect(reached.warningText).toBe('0:03')
    expect(reached.rows.find((row) => row.id === 'arrival')?.value).toContain(
      '3 undefeated members',
    )
  })

  it('does not reconstruct a pathless detection or use legacy caller inputs', () => {
    const input = fixture()
    const readout = threatReadoutAt({
      ...input,
      trial: null,
      tS: 50,
      assessments: input.trial.assessments,
    })
    expect(readout.state).toBeUndefined()
    expect(readout.phase).toBe('undetected')
    expect(readout.warningText).toBe('—')
    const parked = threatReadoutAt({ ...input, entity: input.scenario.entities[2], tS: 50 })
    expect(parked.state?.holdingSensorIds).toEqual([])
    expect(parked.phase).toBe('undetected')
    expect(parked.state?.shipCount).toBe(2)
  })

  it.each([null, 0])('preserves the untouched R2 gate with horizonS=%s', (horizonS) => {
    const readout = threatReadoutAt({ ...fixture(), horizonS, tS: 100, horizon: EMPTY_HORIZON })
    expect(readout.state).toBeUndefined()
    expect(readout.cursorText).toBe('—')
    expect(readout.firstDetectText).toBe('—')
    expect(readout.rows.find((row) => row.id === 'hold')?.value).toBe('0 sensors')
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

describe('dead-threat pill words', () => {
  /** `moving` (three ships) with every ship removed at 2 s; `soft` per ship, arrival optional. */
  function movingDead(soft: boolean[], arrivalS: number | null = null) {
    const { scenario, view } = mixedTrial()
    const late = arrivalS != null && arrivalS < 2
    const events = soft.map((softShot, shipIdx) =>
      trialEvent({
        uasId: 'moving',
        shipIdx,
        softShot,
        lateEffect: late,
        ...(softShot
          ? { effectorId: 'jammer', effectorType: 'jammer', channelClass: 'ew' as const }
          : {}),
      }),
    )
    const trial = {
      ...view,
      assessments: view.assessments.map((a) => (a.uasId === 'moving' ? { ...a, arrivalS } : a)),
      attrition: { ...view.attrition, events },
    }
    const entity = scenario.entities.find((e) => e.id === 'moving')!
    return { trial, entity, scenario }
  }

  it.each([
    ['HARD KILL', [false, false, false], null],
    ['MISSION KILL', [true, true, true], null],
    ['DEFEATED (MIXED)', [false, true, false], null],
    ['LEAKED', [false, false, false], 1],
  ] as const)('reads %s once every member is removed', (pill, soft, arrivalS) => {
    const { trial, entity, scenario } = movingDead([...soft], arrivalS)
    expect(trialTelemetryAt(trial, 'moving', 1.9).phase).not.toBe('ghost')
    // A ghost once every member is removed, hard or soft.
    expect(trialTelemetryAt(trial, 'moving', 2).phase).toBe('ghost')
    const readout = threatReadoutAt({ scenario, trial, entity, units: 'metric', tS: 3 })
    expect(readout.pillLabel).toBe(pill)
    expect(readout.state?.death?.tS).toBe(2)
  })

  it('names the pill from the death record', () => {
    const death = { tS: 2, soft: false, late: false, mixed: false }
    expect(deathPill(death)).toBe('HARD KILL')
    expect(deathPill({ ...death, soft: true })).toBe('MISSION KILL')
    expect(deathPill({ ...death, soft: true, mixed: true })).toBe('DEFEATED (MIXED)')
    expect(deathPill({ ...death, late: true })).toBe('LEAKED')
    expect(lateKillText(95)).toBe('late kill T+1:35')
  })

  it('bounds track quality at a hard cut and keeps a mission-killed picture running', () => {
    const held = (input: ReturnType<typeof movingDead>) => {
      const [swarm] = input.trial.assessments
      const hold = {
        ...swarm.sensorObservations![0],
        intervals: [[0.5, 20]] as Array<[number, number]>,
      }
      const trial = {
        ...input.trial,
        assessments: input.trial.assessments.map((a) =>
          a.uasId === 'moving' ? { ...a, firstDetectS: 0.5, sensorObservations: [hold] } : a,
        ),
      }
      return threatReadoutAt({ ...input, trial, units: 'metric', tS: 30 }).rows.find(
        (row) => row.id === 'classification',
      )?.value
    }
    // Hard: quality reads to the 2 s cut, fully held. Soft: the airframe flies on.
    expect(held(movingDead([false, false, false]))).toContain('continuity 100%')
    expect(held(movingDead([true, true, true]))).toContain('continuity 67%')
  })

  it('debrief threat record reads LEAKED with a late kill word, never DEFEATED', () => {
    const { trial } = movingDead([false, false, false], 1)
    const groups = trialThreatPictureAt(trial, trial.durationS)
    const moving = groups.flatMap((g) => g.members).find((r) => r.uasId === 'moving')!
    // FX on the card is the pre-arrival death, blank for a late kill.
    expect(moving).toMatchObject({
      leaked: true,
      effectMet: false,
      lateKillS: 2,
      firstEffectS: null,
    })
    const html = renderToStaticMarkup(
      createElement(ThreatPicture, { groups, mode: 'debrief', membersOpen: true }),
    )
    expect(html).toContain('LEAKED')
    expect(html).toContain('late kill T+0:02')
    expect(html).toContain('FX —')
    const defeated = movingDead([false, false, false])
    const row = trialThreatPictureAt(defeated.trial, defeated.trial.durationS)
      .flatMap((g) => g.members)
      .find((r) => r.uasId === 'moving')!
    expect(row).toMatchObject({ leaked: false, effectMet: true, lateKillS: null, firstEffectS: 2 })
  })
})

function forecastFixture(softShot = false, killDelta = 0.999) {
  const scenario = useStore.getState().scenario
  const entity = scenario.entities.find((candidate) => candidate.kind === 'uas')!
  const { assessments, report: baseReport } = engagementPicture(scenario)
  const report = {
    ...baseReport,
    events: [
      {
        tS: 5,
        tEffectS: 10,
        effectorId: 'fixture-effector',
        uasId: entity.id,
        shipIdx: 0,
        channel: 'kill' as const,
        softShot,
        effectorType: softShot ? ('jammer' as const) : ('interceptor' as const),
        channelClass: softShot ? ('ew' as const) : ('kinetic' as const),
        lateEffect: false,
        pk: killDelta,
        killDelta,
      },
    ],
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
      const html = renderToStaticMarkup(
        createElement(ThreatPicture, { groups, mode, membersOpen: true }),
      )

      expect(html).toContain('EXPECTED DEFEAT')
      expect(html).not.toContain('DEFEATED')
      expect(html).not.toContain('>EFFECT<')
      expect(html).toContain('Expected FX 0:10')
      expect(html).toContain(
        'title="1.00 expected kills · 0.00 expected surviving ships · 1 salvos"',
      )
      expect(html).toContain('0.1%')
    },
  )

  it('labels partial live effects as expected', () => {
    const { scenario, assessments, report } = forecastFixture(false, 0.75)
    const groups = threatPictureAt(scenario, assessments, report, 10, new Map())
    const html = renderToStaticMarkup(
      createElement(ThreatPicture, {
        groups,
        mode: 'live',
        membersOpen: true,
      }),
    )

    expect(html).toContain('EXPECTED EFFECT')
    expect(html).not.toContain('EFFECT OBS')
    expect(html).not.toContain('EXPECTED DEFEAT')
    expect(html).toContain('title="0.75 expected kills · 0.25 expected surviving ships · 1 salvos"')
  })
})

describe('trial outcome rows', () => {
  it('uses assessment milestones and realized defeats, excluding pathless entities', () => {
    const { view } = mixedTrial()
    const rows = trialOutcomeRows(view)
    expect(rows.map((row) => row.id)).toEqual(['swarm', 'moving', 'flyby'])
    // FX is the threat's death under the one dead rule, never the first member
    // removal: neither formation lost every member.
    expect(rows[0]).toMatchObject({
      detect: 1.1,
      identify: 6.1,
      engage: 1.2,
      effect: null,
      salvos: 7,
      states: ['leaked'],
      lateKillS: null,
    })
    expect(rows[1]).toMatchObject({
      detect: null,
      identify: null,
      engage: 0,
      effect: null,
      salvos: 1,
      states: ['active'],
    })
    expect(rows[2]).toMatchObject({
      detect: null,
      identify: null,
      engage: null,
      effect: null,
      salvos: 0,
      states: ['active'],
    })
  })

  it.each([false, true])(
    'distinguishes a fully defeated formation with softShot %s',
    (softShot) => {
      const { view } = mixedTrial()
      const events = [0, 1, 2].map((shipIdx) => trialEvent({ uasId: 'moving', shipIdx, softShot }))
      const trial = { ...view, attrition: { ...view.attrition, events } }
      expect(trialOutcomeRows(trial).find((row) => row.id === 'moving')?.states).toEqual([
        softShot ? 'defeated (mission)' : 'defeated (hard)',
      ])
    },
  )

  it('preserves both defeat types when a whole formation has mixed outcomes', () => {
    const { view } = mixedTrial()
    const events = [0, 1, 2].map((shipIdx) =>
      trialEvent({ uasId: 'moving', shipIdx, softShot: shipIdx === 1 }),
    )
    const trial = { ...view, attrition: { ...view.attrition, events } }
    expect(trialOutcomeRows(trial).find((row) => row.id === 'moving')?.states).toEqual([
      'defeated (hard)',
      'defeated (mission)',
    ])
  })

  it('keeps leakage credit when every remaining member is defeated after arrival', () => {
    const { view } = mixedTrial()
    const events = [
      ...view.attrition.events,
      trialEvent({ shipIdx: 0, tS: 7, tEffectS: 10, lateEffect: true }),
    ]
    const trial = { ...view, attrition: { ...view.attrition, events } }
    expect(trialOutcomeRows(trial).find((row) => row.id === 'swarm')?.states).toEqual(['leaked'])
  })

  it('shows no path for a retained path that the assessment cannot model', () => {
    const { view } = mixedTrial()
    const trial = {
      ...view,
      scenario: {
        ...view.scenario,
        paths: [
          ...view.scenario.paths,
          { ...view.scenario.paths[0], id: 'invalid-path', entityId: 'parked', points: [] },
        ],
      },
    }
    expect(trialOutcomeRows(trial).find((row) => row.id === 'parked')?.states).toEqual(['no path'])
  })
})

describe('Monitor stage and time to arrival', () => {
  const none = {
    leaked: false,
    dead: false,
    engaged: false,
    targeted: false,
    identified: false,
    held: false,
    detected: false,
  }

  it('derives the latest reached stage, leaked over a late kill', () => {
    expect(trackStageWord(none)).toBe('undetected')
    expect(trackStageWord({ ...none, detected: true })).toBe('detected')
    expect(trackStageWord({ ...none, detected: true, held: true })).toBe('tracked')
    expect(trackStageWord({ ...none, held: true, identified: true })).toBe('identified')
    expect(trackStageWord({ ...none, identified: true, targeted: true })).toBe('targeted')
    expect(trackStageWord({ ...none, targeted: true, engaged: true })).toBe('engaged')
    expect(trackStageWord({ ...none, engaged: true, dead: true })).toBe('defeated')
    expect(trackStageWord({ ...none, dead: true, leaked: true })).toBe('leaked')
    expect(CHAIN_STAGES).toHaveLength(6)
    expect(STAGES_REACHED.defeated).toBe(6)
    expect(STAGES_REACHED.leaked).toBe(6)
    expect(STAGES_REACHED.identified).toBe(3)
  })

  it('reads TTA in m:ss with the D13 display tones', () => {
    expect(TTA_TONE_S).toEqual({ critical: 60, warning: 120 })
    expect(ttaReadout(null, 10)).toEqual({ text: '—', tone: null, sortS: Infinity })
    expect(ttaReadout(310, 10)).toEqual({ text: '5:00', tone: null, sortS: 300 })
    expect(ttaReadout(130, 10)).toMatchObject({ text: '2:00', tone: null })
    expect(ttaReadout(129, 10)).toMatchObject({ text: '1:59', tone: 'warning' })
    expect(ttaReadout(70, 10)).toMatchObject({ text: '1:00', tone: 'warning' })
    expect(ttaReadout(69, 10)).toMatchObject({ text: '0:59', tone: 'critical' })
    expect(ttaReadout(10, 10)).toMatchObject({ text: 'arrived', tone: 'critical' })
    expect(ttaReadout(5, 10)).toMatchObject({ text: 'arrived', sortS: -5 })
  })
})

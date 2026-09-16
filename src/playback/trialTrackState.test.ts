import { describe, expect, it } from 'vitest'
import { mixedTrial } from './__fixtures__/trialFixture'
import { trialMemberStatesAt, trialTrackStatesAt, trialTrackTimelineOf } from './trialTrackState'
import { memberPositions } from './tracks'
import { posAtTime } from '../geometry/geo'

describe('sampled member tracks', () => {
  it('addresses ledger members within each threat and freezes hard kills through later turns', () => {
    const { view, scenario } = mixedTrial()
    const entity = scenario.entities.find((e) => e.id === 'swarm')!
    const path = scenario.paths.find((p) => p.entityId === 'swarm')!
    const atEffect = posAtTime(path.points, 10, 0, 2)
    const terminal = memberPositions(entity, atEffect.pos, atEffect.headingDeg)[3]
    const timeline = trialTrackTimelineOf(view, 'swarm')
    expect(trialTrackTimelineOf(view, 'swarm')).toBe(timeline)
    for (const t of [7, 15]) {
      const members = timeline.stateAtTime(t).members
      expect(members.map((m) => m.memberIdx)).toEqual([0, 1, 2, 3, 4])
      expect(members[3]).toMatchObject({
        uasId: 'swarm',
        outcome: 'hard-kill',
        position: terminal,
        heading: atEffect.headingDeg,
        reachedEffectTimeS: 2,
        effectSourceIdx: 2,
      })
      expect(members[0].outcome).toBe('active')
    }
    expect(timeline.stateAtTime(7).members[0].position).not.toEqual(
      timeline.stateAtTime(15).members[0].position,
    )
    expect(timeline.stateAtTime(1.9).members[3].outcome).toBe('active')
    expect(timeline.stateAtTime(1.9).members[3].position).not.toEqual(terminal)
    expect(trialMemberStatesAt(view, 'moving', 7).map((m) => m.outcome)).toEqual([
      'active',
      'active',
      'hard-kill',
    ])
    expect(trialMemberStatesAt(view, 'parked', 15).every((m) => m.outcome === 'active')).toBe(true)
    expect(() => trialTrackTimelineOf(view)).toThrow('identity')
  })

  it('retains soft-kill motion and late effects independently from arrival credit', () => {
    const { view } = mixedTrial()
    const before = trialMemberStatesAt(view, 'swarm', 7)
    const later = trialMemberStatesAt(view, 'swarm', 15)
    expect(before[1]).toMatchObject({
      outcome: 'mission-kill',
      lateEffect: false,
      leakageCredit: false,
    })
    expect(before[1].position).not.toEqual(later[1].position)
    expect(before[4]).toMatchObject({ outcome: 'active', lateEffect: false, leakageCredit: true })
    expect(later[4]).toMatchObject({ outcome: 'hard-kill', lateEffect: true, leakageCredit: true })
    expect(later[2]).toMatchObject({
      outcome: 'mission-kill',
      lateEffect: true,
      leakageCredit: true,
    })
    expect(trialTrackStatesAt(view, 15).find((t) => t.entity.id === 'swarm')).toMatchObject({
      activeCount: 1,
      hardKillCount: 2,
      missionKillCount: 2,
      arrivedCount: 5,
    })
  })

  it('joins sampled jam decisions to the ledger member and resets between illumination intervals', () => {
    const { view } = mixedTrial()
    expect(trialMemberStatesAt(view, 'swarm', 1.49)[2].jamState).toBeNull()
    expect(trialMemberStatesAt(view, 'swarm', 1.5)[2].jamState).toEqual({ jammed: true })
    expect(trialMemberStatesAt(view, 'swarm', 1.5)[0].jamState).toBeNull()
    expect(trialMemberStatesAt(view, 'swarm', 2.1)[2].jamState).toEqual({ jammed: false })
    expect(trialMemberStatesAt(view, 'swarm', 6)[2].jamState).toEqual({ jammed: false })
  })
})

it('retains exact soft-kill kinematics, including heading through a path turn', () => {
  const { view, scenario } = mixedTrial()
  for (const t of [3, 5, 15]) {
    const member = trialMemberStatesAt(view, 'swarm', t)[1]
    const sample = posAtTime(scenario.paths[0].points, 10, 0, t)
    expect(member.outcome).toBe('mission-kill')
    expect(member.position).toEqual(
      memberPositions(scenario.entities[0], sample.pos, sample.headingDeg)[1],
    )
    expect(member.heading).toBe(sample.headingDeg)
  }
  expect(trialMemberStatesAt(view, 'swarm', 2.999)[1].outcome).toBe('active')
  expect(trialMemberStatesAt(view, 'missing', 5)).toEqual([])
})

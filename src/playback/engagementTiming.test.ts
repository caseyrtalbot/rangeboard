import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { engagementIsKinetic, engagementReleaseS } from './engagementTiming'

const event = { effectorId: 'launcher', tS: 10, tEffectS: 20 }

function captured(delay: number | undefined) {
  const scenario = emptyScenario()
  scenario.entities = [
    {
      id: 'launcher',
      kind: 'effector',
      specId: 'custom-effector',
      name: '',
      pos: { x: 0, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    },
  ]
  scenario.library = [
    {
      id: 'custom-effector',
      kind: 'effector',
      name: '',
      description: '',
      color: '#fff',
      builtin: false,
      effector: {
        effectorType: 'interceptor',
        minRangeM: 0,
        maxRangeM: 1000,
        engageTimeS: delay ?? 0,
      },
    },
  ]
  if (delay === undefined)
    delete (scenario.library[0].effector as { engageTimeS?: number }).engageTimeS
  return scenario
}

describe('engagementReleaseS', () => {
  it('uses explicit physical release independently of a changed scenario', () => {
    expect(engagementReleaseS({ ...event, tReleaseS: 12.25 }, captured(5))).toBe(12.25)
    expect(engagementReleaseS({ ...event, tReleaseS: 12.25 })).toBe(12.25)
  })

  it('reconstructs only from a captured effector spec and its resolved default', () => {
    expect(engagementReleaseS(event, captured(3.25))).toBe(13.25)
    expect(engagementReleaseS(event, captured(0))).toBe(10)
    expect(engagementReleaseS(event, captured(undefined))).toBe(10)
    expect(engagementReleaseS(event)).toBeNull()
    expect(engagementReleaseS(event, emptyScenario())).toBeNull()
    expect(engagementReleaseS(event, { ...captured(3), library: [] })).toBeNull()
  })

  it('keeps malformed or inconsistent explicit timing unavailable without fallback', () => {
    for (const tReleaseS of [NaN, Infinity, 9, 21]) {
      expect(engagementReleaseS({ ...event, tReleaseS }, captured(3))).toBeNull()
    }
    expect(engagementReleaseS(event, captured(-1))).toBeNull()
    expect(engagementReleaseS(event, captured(11))).toBeNull()
    expect(engagementReleaseS(event, captured(Infinity))).toBeNull()
  })

  it('accepts zero preparation and zero flight intervals without inventing duration', () => {
    expect(engagementReleaseS({ ...event, tReleaseS: 10 })).toBe(10)
    expect(engagementReleaseS({ ...event, tReleaseS: 20 })).toBe(20)
    expect(engagementReleaseS({ ...event, tReleaseS: 10, tEffectS: 10 })).toBe(10)
  })
})

it('distinguishes kinetic rounds from energy and EW channels', () => {
  expect(engagementIsKinetic({ channelClass: 'kinetic' })).toBe(true)
  expect(engagementIsKinetic({ channelClass: 'directed-energy' })).toBe(false)
  expect(engagementIsKinetic({ channelClass: 'ew' })).toBe(false)
})

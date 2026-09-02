import { describe, expect, it } from 'vitest'
import { DETECT_DASH, GATE_WORD, ringKindFor, sensorRingStyle } from './footprintStyle'

describe('sensorRingStyle', () => {
  const base = { on: true, placardM: 5000, scaledM: 5000, classifyM: 3000 }

  it('held: solid filled ring at the scaled range, no placard when it coincides', () => {
    const s = sensorRingStyle({ ...base, gate: 'ok' })
    expect(s).toEqual({
      kind: 'held',
      detectM: 5000,
      placardM: null,
      classifyM: 3000,
      fill: true,
      dash: null,
      grey: false,
    })
  })

  it('held: dotted placard ring behind when the scaled range differs by more than 1 m', () => {
    const s = sensorRingStyle({ ...base, gate: 'ok', scaledM: 7200, classifyM: 4300 })
    expect(s.detectM).toBe(7200)
    expect(s.placardM).toBe(5000)
    expect(s.classifyM).toBe(4300)
    expect(sensorRingStyle({ ...base, gate: 'ok', scaledM: 5000.5 }).placardM).toBeNull()
    expect(sensorRingStyle({ ...base, gate: 'ok', scaledM: 4998 }).placardM).toBe(5000)
  })

  it('cued: dashed outline, no fill, at the scaled range, classify ring kept', () => {
    const s = sensorRingStyle({ ...base, gate: 'needs-cue', scaledM: 2500 })
    expect(s.kind).toBe('cued')
    expect(s.detectM).toBe(2500)
    expect(s.placardM).toBe(5000)
    expect(s.classifyM).toBe(3000)
    expect(s.fill).toBe(false)
    expect(s.dash).toEqual(DETECT_DASH.cued)
    expect(s.grey).toBe(false)
  })

  it.each(['rf-silent', 'rf-band', 'no-range'] as const)(
    'inert (%s): grey dashed outline at the placard range, no fill, no classify ring',
    (gate) => {
      const s = sensorRingStyle({ ...base, gate, scaledM: 9999 })
      expect(s).toEqual({
        kind: 'inert',
        detectM: 5000,
        placardM: null,
        classifyM: null,
        fill: false,
        dash: DETECT_DASH.inert,
        grey: true,
      })
    },
  )

  it('off: dotted grey outline at the placard range, never scaled, no classify ring', () => {
    const s = sensorRingStyle({ ...base, gate: 'ok', on: false, scaledM: 7200 })
    expect(s).toEqual({
      kind: 'off',
      detectM: 5000,
      placardM: null,
      classifyM: null,
      fill: false,
      dash: DETECT_DASH.off,
      grey: true,
    })
  })

  it('off outranks every gate', () => {
    expect(sensorRingStyle({ ...base, gate: 'rf-silent', on: false }).kind).toBe('off')
    expect(sensorRingStyle({ ...base, gate: 'needs-cue', on: false }).kind).toBe('off')
  })

  it('drops a zero or null classify range', () => {
    expect(sensorRingStyle({ ...base, gate: 'ok', classifyM: null }).classifyM).toBeNull()
    expect(sensorRingStyle({ ...base, gate: 'ok', classifyM: 0 }).classifyM).toBeNull()
  })

  it('maps every gate to one ring kind and one inspector word', () => {
    expect(ringKindFor('ok')).toBe('held')
    expect(ringKindFor('needs-cue')).toBe('cued')
    expect(ringKindFor('rf-silent')).toBe('inert')
    expect(ringKindFor('rf-band')).toBe('inert')
    expect(ringKindFor('no-range')).toBe('inert')
    expect(Object.keys(GATE_WORD).sort()).toEqual(['needs-cue', 'no-range', 'rf-band', 'rf-silent'])
  })
})

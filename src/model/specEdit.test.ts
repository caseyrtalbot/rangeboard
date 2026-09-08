import { describe, expect, it } from 'vitest'
import { editSpecField } from './specEdit'
import type { SpecModel } from './types'
import { MOUNT_HEIGHT_M, TRACK_INIT_M, TRACK_INIT_N } from './types'

/** A radar model with the fields these rules read, and one source row. */
function sensorModel(): SpecModel {
  return {
    id: 'lib-probe', name: 'Probe radar', kind: 'sensor', description: '', color: '#fff',
    builtin: false,
    sensor: {
      sensorType: 'radar', detectRangeM: 10000, classifyRangeM: 5000, sectorDeg: 360,
      elevationDeg: [0, 70], mountHeightM: 6, updateRateS: 2, trackInitM: 3, trackInitN: 5,
      rfBands: ['uhf-433', 'ism-2400'],
    },
    provenance: [
      { field: 'detectRangeM', value: '10 km', source: 'a maker page', date: '2026-09-08', basis: 'datasheet' },
    ],
  }
}

function effectorModel(): SpecModel {
  return {
    id: 'lib-probe-eff', name: 'Probe jammer', kind: 'effector', description: '', color: '#fff',
    builtin: false,
    effector: {
      effectorType: 'jammer', minRangeM: 0, maxRangeM: 3000, engageTimeS: 5,
      mountHeightM: 4, jamBands: ['gnss', 'ism-2400'], eirpW: 40,
    },
  }
}

function uasModel(): SpecModel {
  return {
    id: 'lib-probe-uas', name: 'Probe UAS', kind: 'uas', description: '', color: '#fff',
    builtin: false,
    uas: {
      group: 1, airframe: 'quad', cruiseSpeedMps: 15, maxSpeedMps: 25, enduranceMin: 30,
      altBandFt: [100, 2000], navMode: 'gps', emissionsNote: '', rcsM2: 0.02,
    },
    threatProfile: { designator: 'THR-A', routeIntent: '', altitudeFt: 500, speedMps: 15, count: 2 },
  }
}

describe('M-of-N track initiation', () => {
  it('raises N when M rises above it and leaves M alone', () => {
    const next = editSpecField(sensorModel(), 'sensor.trackInitM', 7)
    expect(next.sensor?.trackInitM).toBe(7)
    expect(next.sensor?.trackInitN).toBe(7)
  })

  it('keeps N when M stays inside it', () => {
    const next = editSpecField(sensorModel(), 'sensor.trackInitM', 2)
    expect(next.sensor?.trackInitM).toBe(2)
    expect(next.sensor?.trackInitN).toBe(5)
  })

  it('lowers M when N drops below it', () => {
    const next = editSpecField(sensorModel(), 'sensor.trackInitN', 2)
    expect(next.sensor?.trackInitN).toBe(2)
    expect(next.sensor?.trackInitM).toBe(2)
  })

  it('keeps M when N stays above it', () => {
    const next = editSpecField(sensorModel(), 'sensor.trackInitN', 9)
    expect(next.sensor?.trackInitN).toBe(9)
    expect(next.sensor?.trackInitM).toBe(3)
  })

  it('couples an absent partner against its planning factor', () => {
    const model = sensorModel()
    model.sensor = { ...model.sensor!, trackInitM: undefined, trackInitN: undefined }
    // N is absent, so the PF governs the pair in use.
    const raised = editSpecField(model, 'sensor.trackInitM', TRACK_INIT_N + 1)
    expect(raised.sensor?.trackInitN).toBe(TRACK_INIT_N + 1)
    const lowered = editSpecField(model, 'sensor.trackInitN', TRACK_INIT_M - 1)
    expect(lowered.sensor?.trackInitM).toBe(TRACK_INIT_M - 1)
  })

  it('clears each end to the planning factor and stops coupling', () => {
    const cleared = editSpecField(sensorModel(), 'sensor.trackInitM', 0)
    expect(cleared.sensor?.trackInitM).toBeUndefined()
    expect(cleared.sensor?.trackInitN).toBe(5)
    const clearedN = editSpecField(sensorModel(), 'sensor.trackInitN', 0)
    expect(clearedN.sensor?.trackInitN).toBeUndefined()
    expect(clearedN.sensor?.trackInitM).toBe(3)
  })
})

describe('mount height', () => {
  it('parses the raw input, floors at zero and clears to the planning factor', () => {
    expect(editSpecField(sensorModel(), 'sensor.mountHeightM', '12.5').sensor?.mountHeightM).toBe(12.5)
    expect(editSpecField(sensorModel(), 'sensor.mountHeightM', '-3').sensor?.mountHeightM).toBe(0)
    const cleared = editSpecField(sensorModel(), 'sensor.mountHeightM', '')
    expect(cleared.sensor?.mountHeightM).toBeNull()
    // Null reads back as the planning factor everywhere the height is used.
    expect(cleared.sensor?.mountHeightM ?? MOUNT_HEIGHT_M).toBe(MOUNT_HEIGHT_M)
  })

  it('parses an effector launcher height through the same rule', () => {
    expect(editSpecField(effectorModel(), 'effector.mountHeightM', '9').effector?.mountHeightM).toBe(9)
    expect(editSpecField(effectorModel(), 'effector.mountHeightM', '').effector?.mountHeightM).toBeNull()
  })
})

describe('clearing and clamping', () => {
  it('clears a measured sensor field to null and keeps a positive one', () => {
    expect(editSpecField(sensorModel(), 'sensor.classifyRangeM', 0).sensor?.classifyRangeM).toBeNull()
    expect(editSpecField(sensorModel(), 'sensor.classifyRangeM', 800).sensor?.classifyRangeM).toBe(800)
    expect(editSpecField(sensorModel(), 'sensor.updateRateS', 0).sensor?.updateRateS).toBeNull()
  })

  it('holds the sector inside the drawable range and floors the detect range', () => {
    expect(editSpecField(sensorModel(), 'sensor.sectorDeg', 400).sensor?.sectorDeg).toBe(360)
    expect(editSpecField(sensorModel(), 'sensor.sectorDeg', 1).sensor?.sectorDeg).toBe(5)
    expect(editSpecField(sensorModel(), 'sensor.detectRangeM', -5).sensor?.detectRangeM).toBe(0)
    expect(editSpecField(sensorModel(), 'sensor.placardPd', 2).sensor?.placardPd).toBe(0.99)
  })

  it('rebuilds each end of the elevation tuple and the UAS altitude band', () => {
    expect(editSpecField(sensorModel(), 'sensor.elevationMinDeg', -5).sensor?.elevationDeg).toEqual([-5, 70])
    expect(editSpecField(sensorModel(), 'sensor.elevationMaxDeg', 85).sensor?.elevationDeg).toEqual([0, 85])
    expect(editSpecField(uasModel(), 'uas.altFloorFt', 300).uas?.altBandFt).toEqual([300, 2000])
    expect(editSpecField(uasModel(), 'uas.altCeilingFt', 900).uas?.altBandFt).toEqual([100, 900])
  })

  it('maps an empty select back to the planning-factor default', () => {
    expect(editSpecField(sensorModel(), 'sensor.pfa', '').sensor?.pfa).toBeNull()
    expect(editSpecField(sensorModel(), 'sensor.pfa', '1e-6').sensor?.pfa).toBe(1e-6)
    expect(editSpecField(sensorModel(), 'sensor.role', '').sensor?.role).toBeUndefined()
    expect(editSpecField(uasModel(), 'uas.swerling', '').uas?.swerling).toBeNull()
    expect(editSpecField(uasModel(), 'uas.swerling', '3').uas?.swerling).toBe(3)
    expect(editSpecField(uasModel(), 'uas.oneWay', '').uas?.oneWay).toBeUndefined()
    expect(editSpecField(uasModel(), 'uas.oneWay', 'one-way').uas?.oneWay).toBe(true)
    expect(editSpecField(uasModel(), 'uas.oneWay', 'rth').uas?.oneWay).toBe(false)
  })

  it('reads a select number as the typed value and keeps a count at one or more', () => {
    expect(editSpecField(uasModel(), 'uas.group', '3').uas?.group).toBe(3)
    expect(editSpecField(uasModel(), 'threatProfile.count', 0).threatProfile?.count).toBe(1)
    expect(editSpecField(uasModel(), 'threatProfile.count', 4).threatProfile?.count).toBe(4)
  })

  it('rejects an empty band set and returns the model itself', () => {
    const model = sensorModel()
    expect(editSpecField(model, 'sensor.rfBands', [])).toBe(model)
    expect(editSpecField(model, 'sensor.rfBands', ['uhf-433']).sensor?.rfBands).toEqual(['uhf-433'])
    const jammer = effectorModel()
    expect(editSpecField(jammer, 'effector.jamBands', [])).toBe(jammer)
    expect(editSpecField(jammer, 'effector.jamBands', ['gnss']).effector?.jamBands).toEqual(['gnss'])
  })
})

describe('surrounding state', () => {
  it('keeps every sibling field, the other sections and the model shell', () => {
    const before = uasModel()
    const after = editSpecField(before, 'uas.rcsM2', 0.5)
    expect(after.uas).toEqual({ ...before.uas, rcsM2: 0.5 })
    expect(after.threatProfile).toBe(before.threatProfile)
    expect(after.name).toBe(before.name)
    expect(before.uas?.rcsM2).toBe(0.02)
  })

  it('leaves the provenance rows to the caller', () => {
    const after = editSpecField(sensorModel(), 'sensor.detectRangeM', 4000)
    expect(after.provenance?.map((r) => r.field)).toEqual(['detectRangeM'])
  })

  it('returns the model itself when the named section is absent', () => {
    const model = sensorModel()
    expect(editSpecField(model, 'uas.cruiseSpeedMps', 20)).toBe(model)
    expect(editSpecField(model, 'effector.maxRangeM', 20)).toBe(model)
    expect(editSpecField(model, 'threatProfile.speedMps', 20)).toBe(model)
  })
})

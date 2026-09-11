import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario } from '../model/types'
import { DEFAULT_FIRE_DOCTRINE } from '../model/types'
import { MODEL_TAGS, modelsForEntity, modelsUsed, type ModelId } from './fidelity'

const IDS: ModelId[] = [
  'radar-pd', 'radar-scan', 'eoir-range', 'acoustic-range', 'rf-detect', 'rf-link', 'jam',
  'environment', 'horizon', 'track-init', 'doctrine', 'kinetic-pk', 'flyout',
  'draw-policy', 'parameter-spread',
  'tracker', 'fusion', 'classification', 'operator', 'false-tracks',
]

describe('MODEL_TAGS', () => {
  it('holds one tag per ModelId whose id equals its key', () => {
    expect(Object.keys(MODEL_TAGS).sort()).toEqual([...IDS].sort())
    for (const id of IDS) expect(MODEL_TAGS[id].id).toBe(id)
  })

  it('gives every unvalidated model the planning tier', () => {
    for (const tag of Object.values(MODEL_TAGS)) {
      if (tag.validation === 'none') expect(tag.tier).toBe('planning')
    }
  })

  it('labels every model once', () => {
    const labels = Object.values(MODEL_TAGS).map((t) => t.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('writes a note on every tag and no em-dash in any string', () => {
    for (const tag of Object.values(MODEL_TAGS)) {
      expect(tag.note.length).toBeGreaterThan(0)
      expect(`${tag.label}${tag.note}${tag.standard ?? ''}`).not.toContain('—')
    }
  })
})

function entity(id: string, kind: Entity['kind'], specId: string): Entity {
  return {
    id,
    name: id.toUpperCase(),
    kind,
    specId,
    pos: { x: 0, y: 0 },
    headingDeg: 0,
    color: null,
    notes: '',
  }
}

/** One sourced-basis radar and one quadcopter with an RCS, so the Pd model applies. */
function radarLaydown(): Scenario {
  const s = emptyScenario()
  s.entities.push(entity('s1', 'sensor', 'lib-echoguard'))
  s.entities.push(entity('u1', 'uas', 'lib-mavic3'))
  return s
}

function rfLaydown(): Scenario {
  const s = emptyScenario()
  s.entities.push(entity('s1', 'sensor', 'lib-rf360'))
  s.entities.push(entity('u1', 'uas', 'lib-mavic3'))
  return s
}

describe('modelsUsed', () => {
  it('reads a radar laydown as Pd-modeled and scanning, with no EO/IR model', () => {
    const ids = modelsUsed(radarLaydown()).map((t) => t.id)
    expect(ids).toContain('radar-pd')
    expect(ids).toContain('radar-scan')
    expect(ids).toContain('horizon')
    expect(ids).not.toContain('eoir-range')
    expect(ids).not.toContain('kinetic-pk')
  })

  it('reads a directed-energy laydown as Kinetic Pk with no flyout', () => {
    const s = radarLaydown()
    s.entities.push(entity('e1', 'effector', 'lib-phel'))
    const ids = modelsUsed(s).map((t) => t.id)
    expect(ids).toContain('kinetic-pk')
    expect(ids).not.toContain('flyout')
  })

  it('reads an acoustic-only laydown without the horizon model', () => {
    const s = emptyScenario()
    s.entities.push(entity('s1', 'sensor', 'lib-discovair'))
    s.entities.push(entity('u1', 'uas', 'lib-mavic3'))
    const ids = modelsUsed(s).map((t) => t.id)
    expect(ids).toContain('acoustic-range')
    expect(ids).not.toContain('horizon')
  })

  it('drops doctrine when the scenario turns fire doctrine off', () => {
    const s = radarLaydown()
    s.doctrine = { ...DEFAULT_FIRE_DOCTRINE, enabled: false }
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('doctrine')
    expect(modelsUsed(radarLaydown()).map((t) => t.id)).toContain('doctrine')
  })

  it('reads an empty laydown as environment, doctrine and classification, and nothing with all off', () => {
    const s = emptyScenario()
    // The fresh scenario runs Monte Carlo; the envelope reading is explicit here.
    s.runMode = 'deterministic'
    expect(modelsUsed(s).map((t) => t.id)).toEqual(['environment', 'doctrine', 'classification'])
    s.environment.apply = false
    s.doctrine = { ...DEFAULT_FIRE_DOCTRINE, enabled: false }
    expect(modelsUsed(s)).toEqual([])
  })

  it('adds the draw policy under the Monte Carlo run mode and returns MODEL_TAGS order', () => {
    const s = radarLaydown()
    s.runMode = 'monte-carlo'
    const ids = modelsUsed(s).map((t) => t.id)
    expect(ids).toContain('draw-policy')
    expect(ids).toEqual((Object.keys(MODEL_TAGS) as ModelId[]).filter((id) => ids.includes(id)))
  })

  it('adds the parameter spread under the total uncertainty mode only', () => {
    const s = radarLaydown()
    s.runMode = 'monte-carlo'
    s.uncertainty = 'total'
    expect(modelsUsed(s).map((t) => t.id)).toContain('parameter-spread')
    s.uncertainty = 'aleatory'
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('parameter-spread')
    // The mode is a scenario fact; a deterministic run draws no parameter.
    s.runMode = 'deterministic'
    s.uncertainty = 'total'
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('parameter-spread')
  })
})

describe('modelsUsed, Phase 2 tags', () => {
  it('reads the tracker from one active sensor and fusion from two', () => {
    const s = radarLaydown()
    let ids = modelsUsed(s).map((t) => t.id)
    expect(ids).toContain('tracker')
    expect(ids).not.toContain('fusion')
    s.entities.push(entity('s2', 'sensor', 'lib-discovair'))
    ids = modelsUsed(s).map((t) => t.id)
    expect(ids).toContain('fusion')
    s.entities[s.entities.length - 1].enabled = false
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('fusion')
  })

  it('reads no tracker from a laydown with no sensor', () => {
    const s = emptyScenario()
    s.entities.push(entity('u1', 'uas', 'lib-mavic3'))
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('tracker')
  })

  it('follows the doctrine switch for classification', () => {
    const s = radarLaydown()
    expect(modelsUsed(s).map((t) => t.id)).toContain('classification')
    s.doctrine = { ...DEFAULT_FIRE_DOCTRINE, enabled: false }
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('classification')
  })

  it('reads the operator from an active c2 entity only', () => {
    const s = radarLaydown()
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('operator')
    s.entities.push(entity('c1', 'c2', 'lib-faadc2'))
    expect(modelsUsed(s).map((t) => t.id)).toContain('operator')
    s.entities[s.entities.length - 1].enabled = false
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('operator')
  })

  it('reads false tracks from a radar false-alarm rate unless noFalseTracks is on', () => {
    const s = radarLaydown()
    const radar = s.library.find((m) => m.id === 'lib-echoguard')!
    // Every seed radar carries a rate since lane 2.1; a null rate is no source.
    radar.sensor = { ...radar.sensor!, falseAlarmRatePerScan: null }
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('false-tracks')
    radar.sensor = { ...radar.sensor, falseAlarmRatePerScan: 0.5 }
    expect(modelsUsed(s).map((t) => t.id)).toContain('false-tracks')
    s.physics = ['noFalseTracks']
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('false-tracks')
    // The rate on a non-radar sensor is not a false-track source.
    s.physics = []
    radar.sensor = { ...radar.sensor, falseAlarmRatePerScan: null }
    const acoustic = s.library.find((m) => m.id === 'lib-discovair')!
    acoustic.sensor = { ...acoustic.sensor!, falseAlarmRatePerScan: 0.5 }
    s.entities.push(entity('s2', 'sensor', 'lib-discovair'))
    expect(modelsUsed(s).map((t) => t.id)).not.toContain('false-tracks')
  })
})

describe('modelsUsed, RF link tag', () => {
  it('adds the link budget for an RF sensor and emitting target with both fields', () => {
    const s = rfLaydown()
    expect(modelsUsed(s).map((tag) => tag.id)).toContain('rf-link')
    expect(modelsForEntity(s, 's1').map((tag) => tag.id)).toContain('rf-link')
    expect(modelsForEntity(s, 'u1').map((tag) => tag.id)).toContain('rf-link')
  })

  it('omits the link budget under its fallback switch or a null required field', () => {
    const s = rfLaydown()
    s.physics = ['rfBandGate']
    expect(modelsUsed(s).map((tag) => tag.id)).not.toContain('rf-link')
    s.physics = []
    const target = s.library.find((model) => model.id === 'lib-mavic3')!
    target.uas = { ...target.uas!, radiatedPowerW: null }
    expect(modelsUsed(s).map((tag) => tag.id)).not.toContain('rf-link')
  })
})

describe('modelsForEntity', () => {
  /** The radar laydown plus one kinetic interceptor with a stated flyout speed. */
  function withEffector(): Scenario {
    const s = radarLaydown()
    s.entities.push(entity('e1', 'effector', 'lib-coyote'))
    return s
  }

  it('gives the radar its sensor models and no effector model', () => {
    const ids = modelsForEntity(withEffector(), 's1').map((t) => t.id)
    expect(ids).toContain('radar-pd')
    expect(ids).toContain('radar-scan')
    expect(ids).toContain('horizon')
    expect(ids).not.toContain('kinetic-pk')
    expect(ids).not.toContain('doctrine')
  })

  it('gives the effector its doctrine, Pk and flyout models', () => {
    const ids = modelsForEntity(withEffector(), 'e1').map((t) => t.id)
    expect(ids).toEqual(['doctrine', 'kinetic-pk', 'flyout'])
  })

  it('gives a sensor the tracker and a c2 node fusion, classification and the operator', () => {
    const s = withEffector()
    s.entities.push(entity('s2', 'sensor', 'lib-discovair'))
    s.entities.push(entity('c1', 'c2', 'lib-faadc2'))
    const sensorIds = modelsForEntity(s, 's1').map((t) => t.id)
    expect(sensorIds).toContain('tracker')
    expect(sensorIds).not.toContain('fusion')
    expect(sensorIds).not.toContain('operator')
    expect(modelsForEntity(s, 'c1').map((t) => t.id)).toEqual([
      'doctrine', 'fusion', 'classification', 'operator',
    ])
  })

  it('returns nothing for an asset, a disabled entity and an unknown id', () => {
    const s = withEffector()
    s.entities.push(entity('a1', 'asset', 'lib-asset'))
    s.entities.push({ ...entity('s2', 'sensor', 'lib-echoguard'), enabled: false })
    expect(modelsForEntity(s, 'a1')).toEqual([])
    expect(modelsForEntity(s, 's2')).toEqual([])
    expect(modelsForEntity(s, 'nope')).toEqual([])
  })
})

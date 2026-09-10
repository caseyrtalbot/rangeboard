import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario } from '../model/types'
import { DEFAULT_FIRE_DOCTRINE } from '../model/types'
import { MODEL_TAGS, modelsForEntity, modelsUsed, type ModelId } from './fidelity'

const IDS: ModelId[] = [
  'radar-pd', 'radar-scan', 'eoir-range', 'acoustic-range', 'rf-detect', 'jam',
  'environment', 'horizon', 'track-init', 'doctrine', 'kinetic-pk', 'flyout',
  'draw-policy', 'parameter-spread',
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

  it('reads an empty laydown as environment and doctrine, and nothing with both off', () => {
    const s = emptyScenario()
    // The fresh scenario runs Monte Carlo; the envelope reading is explicit here.
    s.runMode = 'deterministic'
    expect(modelsUsed(s).map((t) => t.id)).toEqual(['environment', 'doctrine'])
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

  it('returns nothing for an asset, a disabled entity and an unknown id', () => {
    const s = withEffector()
    s.entities.push(entity('a1', 'asset', 'lib-asset'))
    s.entities.push({ ...entity('s2', 'sensor', 'lib-echoguard'), enabled: false })
    expect(modelsForEntity(s, 'a1')).toEqual([])
    expect(modelsForEntity(s, 's2')).toEqual([])
    expect(modelsForEntity(s, 'nope')).toEqual([])
  })
})

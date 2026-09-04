import { describe, expect, it } from 'vitest'
import { MODEL_TAGS, type ModelId } from './fidelity'

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

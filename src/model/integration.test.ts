import { describe, expect, it } from 'vitest'
import { emptyScenario, SEED_LIBRARY } from './seed'
import type { Entity, Scenario, SpecModel } from './types'
import {
  evaluateIntegration,
  integrationBoardStatus,
  integrationSummary,
  linkDirection,
  MEDIUM_SUGGEST_RADIUS_M,
  profileFor,
  suggestLinksFor,
} from './integration'
import { INTEGRATION_PROFILES } from './integrationData'

const byId = new Map(SEED_LIBRARY.map((m) => [m.id, m]))

function spec(id: string): SpecModel {
  const m = byId.get(id)
  if (!m) throw new Error(`no seed model ${id}`)
  return m
}

let entitySeq = 0

function place(s: Scenario, specId: string, x: number, y: number): Entity {
  const m = spec(specId)
  entitySeq += 1
  const e: Entity = {
    id: `e${entitySeq}`,
    name: m.name,
    kind: m.kind,
    specId,
    pos: { x, y },
    headingDeg: 0,
    color: null,
    notes: '',
  }
  s.entities.push(e)
  return e
}

describe('integration data integrity', () => {
  it('every profile and every referenced spec id resolves to a seed model', () => {
    for (const p of INTEGRATION_PROFILES) {
      expect(byId.has(p.specId), p.specId).toBe(true)
      for (const pair of p.pairs) {
        expect(byId.has(pair.withSpecId), `${p.specId} -> ${pair.withSpecId}`).toBe(true)
      }
      for (const d of p.denied ?? []) {
        expect(byId.has(d.withSpecId), `${p.specId} denied ${d.withSpecId}`).toBe(true)
      }
      for (const id of [...(p.fcSources ?? []), ...(p.requiredC2 ?? [])]) {
        expect(byId.has(id), `${p.specId} ref ${id}`).toBe(true)
      }
    }
  })

  it('every seed sensor/effector/c2 model has a profile', () => {
    for (const m of SEED_LIBRARY) {
      if (m.kind !== 'sensor' && m.kind !== 'effector' && m.kind !== 'c2') continue
      expect(profileFor(m.id), m.id).not.toBeNull()
    }
  })

  it('carries the researched effector guidance data', () => {
    expect(profileFor('lib-coyote')?.fcSources).toEqual(['lib-kurfs', 'lib-tpq53'])
    expect(profileFor('lib-anvil')?.requiredC2).toContain('lib-lattice')
    expect(profileFor('lib-roadrunner')?.requiredC2).toContain('lib-lattice')
    for (const id of ['lib-lpws', 'lib-smash', 'lib-dronebuster', 'lib-phel', 'lib-thor']) {
      expect(profileFor(id)?.standalone, id).toBe(true)
    }
  })
})

describe('integrationSummary', () => {
  const library = SEED_LIBRARY

  it('lists partners from both sides of the pair table, best confidence first', () => {
    const s = integrationSummary('lib-kurfs', library)!
    const ids = s.partners.map((p) => p.specId)
    expect(ids).toContain('lib-coyote')
    expect(ids).toContain('lib-faadc2')
    const first = s.partners[0]
    expect(first.confidence).toBe('documented')
  })

  it('states the Coyote kill-chain needs in the guidance sentence', () => {
    const s = integrationSummary('lib-coyote', library)!
    expect(s.guidance).toContain('fire-control track')
    expect(s.guidance).toContain('KuRFS')
    expect(s.guidance).toContain('Engages only through')
  })

  it('a denied pair never appears as a partner', () => {
    const s = integrationSummary('lib-rps42', library)!
    expect(s.partners.map((p) => p.specId)).not.toContain('lib-coyote')
    expect(s.denied.map((d) => d.specId)).toContain('lib-coyote')
  })

  it('standalone systems say so; unprofiled models return null', () => {
    expect(integrationSummary('lib-lpws', library)?.guidance).toContain('no connections')
    expect(integrationSummary('custom-123', library)).toBeNull()
    expect(integrationSummary(null, library)).toBeNull()
  })
})

describe('evaluateIntegration', () => {
  it('gates on kill-chain-directional kinds only', () => {
    // Sensor-sensor pairs exist in the research (KuRFS/TPQ-50) but never evaluate.
    expect(evaluateIntegration(spec('lib-kurfs'), spec('lib-lstar'))).toBeNull()
    // Effector -> c2 is the wrong direction.
    expect(evaluateIntegration(spec('lib-coyote'), spec('lib-faadc2'))).toBeNull()
    expect(evaluateIntegration(spec('lib-coyote'), spec('lib-xm914'))).toBeNull()
    expect(evaluateIntegration(spec('lib-kurfs'), spec('lib-shahed136'))).toBeNull()
  })

  it('denied beats a claimed pair (FAAD C2 -> Modi)', () => {
    // Modi's profile claims a probable FAAD C2 pairing; the FAAD C2 denial wins.
    const v = evaluateIntegration(spec('lib-faadc2'), spec('lib-modi'))
    expect(v).not.toBeNull()
    expect(v?.ok).toBe(false)
    expect(v?.confidence).toBeNull()
    expect(v?.latencyS).toBe(0)
  })

  it('denied beats the protocol fallback (RPS-42 -> Coyote)', () => {
    // Both sides speak faad-c2, but the researched denial wins.
    const v = evaluateIntegration(spec('lib-rps42'), spec('lib-coyote'))
    expect(v?.ok).toBe(false)
    expect(v?.note).toMatch(/Ku-band/)
  })

  it('pair beats the protocol fallback (KuRFS -> Coyote)', () => {
    // Shared faad-c2 protocol would give a probable cue; the documented pair wins.
    const v = evaluateIntegration(spec('lib-kurfs'), spec('lib-coyote'))
    expect(v?.ok).toBe(true)
    expect(v?.role).toBe('fc-uplink')
    expect(v?.confidence).toBe('documented')
    expect(v?.medium).toBe('proprietary-rf')
    expect(v?.label).toBe('fc uplink')
    expect(v?.latencyS).toBe(1)
    expect(v?.source).toBeTruthy()
  })

  it('routes Anduril effectors through Lattice', () => {
    const v = evaluateIntegration(spec('lib-lattice'), spec('lib-anvil'))
    expect(v?.ok).toBe(true)
    expect(v?.confidence).toBe('documented')
    // Anvil only engages when routed through Lattice.
    expect(profileFor('lib-anvil')?.requiredC2).toEqual(['lib-lattice'])
  })

  it('SMASH and Dronebuster never get an ok network verdict', () => {
    for (const m of SEED_LIBRARY) {
      if (m.kind !== 'sensor' && m.kind !== 'c2') continue
      for (const target of ['lib-smash', 'lib-dronebuster']) {
        const v = evaluateIntegration(m, spec(target))
        expect(v?.ok ?? false, `${m.id} -> ${target}`).toBe(false)
      }
    }
    expect(profileFor('lib-smash')?.pairs).toEqual([])
    expect(profileFor('lib-dronebuster')?.pairs).toEqual([])
  })

  it('falls back to a probable verdict on a shared open standard', () => {
    // RfOne and Lattice share cot-tak but have no researched pair.
    const v = evaluateIntegration(spec('lib-rfone'), spec('lib-lattice'))
    expect(v?.ok).toBe(true)
    expect(v?.role).toBe('track-data')
    expect(v?.confidence).toBe('probable')
    expect(v?.medium).toBe('cable')
    expect(v?.note).toContain('cot-tak')
    expect(v?.latencyS).toBe(0.5)
  })

  it('returns null when neither pair nor protocol supports a link', () => {
    expect(evaluateIntegration(spec('lib-teleidoscope'), spec('lib-medusa'))).toBeNull()
  })
})

describe('suggestLinksFor', () => {
  it('gates candidates by the verdict medium radius', () => {
    const s = emptyScenario()
    const kurfs = place(s, 'lib-kurfs', 0, 0)
    const near = place(s, 'lib-coyote', 14000, 0)
    const far = place(s, 'lib-faadc2', 2000, 0)
    // Coyote link is proprietary-rf (15 km); FAAD C2 link is cable (1.5 km).
    expect(MEDIUM_SUGGEST_RADIUS_M['proprietary-rf']).toBe(15000)
    const out = suggestLinksFor(s, kurfs.id)
    expect(out.map((l) => l.toId)).toEqual([near.id])
    expect(out.map((l) => l.fromId)).toEqual([kurfs.id])
    far.pos = { x: 1200, y: 0 }
    expect(
      suggestLinksFor(s, kurfs.id)
        .map((l) => l.toId)
        .sort(),
    ).toEqual([near.id, far.id].sort())
  })

  it('keeps the kill-chain direction regardless of which entity is placed', () => {
    const s = emptyScenario()
    const c2 = place(s, 'lib-faadc2', 0, 0)
    const radar = place(s, 'lib-kurfs', 100, 0)
    const out = suggestLinksFor(s, c2.id)
    expect(out).toHaveLength(1)
    expect(out[0].fromId).toBe(radar.id)
    expect(out[0].toId).toBe(c2.id)
    expect(out[0].verdict.label).toBe('track data')
  })

  it('skips pairs already connected in that direction', () => {
    const s = emptyScenario()
    const kurfs = place(s, 'lib-kurfs', 0, 0)
    const c2 = place(s, 'lib-faadc2', 100, 0)
    expect(suggestLinksFor(s, kurfs.id)).toHaveLength(1)
    s.connections.push({ id: 'c1', fromId: kurfs.id, toId: c2.id, label: 'track data' })
    expect(suggestLinksFor(s, kurfs.id)).toHaveLength(0)
    expect(suggestLinksFor(s, c2.id)).toHaveLength(0)
  })

  it('an existing c2-c2 link in either direction suppresses the reverse suggestion', () => {
    // The sim traverses c2-c2 interop both ways, so a stored Lattice -> FAAD
    // link makes a FAAD -> Lattice suggestion a functionally duplicate arrow.
    const s = emptyScenario()
    const lattice = place(s, 'lib-lattice', 0, 0)
    const faad = place(s, 'lib-faadc2', 100, 0)
    expect(suggestLinksFor(s, faad.id)).toHaveLength(1)
    s.connections.push({ id: 'c1', fromId: lattice.id, toId: faad.id, label: 'c2 interop' })
    expect(suggestLinksFor(s, faad.id)).toHaveLength(0)
    expect(suggestLinksFor(s, lattice.id)).toHaveLength(0)
  })

  it('ignores disabled and non-kill-chain entities', () => {
    const s = emptyScenario()
    const kurfs = place(s, 'lib-kurfs', 0, 0)
    const c2 = place(s, 'lib-faadc2', 100, 0)
    c2.enabled = false
    place(s, 'lib-shahed136', 50, 0)
    expect(suggestLinksFor(s, kurfs.id)).toHaveLength(0)
    kurfs.enabled = false
    expect(suggestLinksFor(s, kurfs.id)).toHaveLength(0)
  })

  it('sorts documented before probable, then nearest first', () => {
    const s = emptyScenario()
    const kurfs = place(s, 'lib-kurfs', 0, 0)
    const lattice = place(s, 'lib-lattice', 100, 0) // probable, nearer
    const faad = place(s, 'lib-faadc2', 250, 0) // documented, farther
    const out = suggestLinksFor(s, kurfs.id)
    expect(out.map((l) => l.toId)).toEqual([faad.id, lattice.id])
    expect(out[0].verdict.confidence).toBe('documented')
    expect(out[1].verdict.confidence).toBe('probable')
  })

  it('caps the list at 6', () => {
    const s = emptyScenario()
    const kurfs = place(s, 'lib-kurfs', 0, 0)
    // Five documented partners plus three probable ones, all in cable range
    // (Coyote rides the wider proprietary-rf radius).
    const partners = [
      'lib-coyote',
      'lib-faadc2',
      'lib-lpws',
      'lib-xm914',
      'lib-demshorad',
      'lib-lattice',
      'lib-phel',
      'lib-leonidas',
    ]
    partners.forEach((id, i) => place(s, id, 10 + i * 10, 0))
    const out = suggestLinksFor(s, kurfs.id)
    expect(out).toHaveLength(6)
    expect(out.slice(0, 5).every((l) => l.verdict.confidence === 'documented')).toBe(true)
    expect(out[5].verdict.confidence).toBe('probable')
  })
})

describe('integrationBoardStatus', () => {
  it('returns null for a missing entity or an unprofiled spec', () => {
    const s = emptyScenario()
    expect(integrationBoardStatus(s, 'nope')).toBeNull()
    const threat = place(s, 'lib-shahed136', 0, 0)
    expect(integrationBoardStatus(s, threat.id)).toBeNull()
  })

  it('splits partners into linked, out of range and not on board', () => {
    const s = emptyScenario()
    const coyote = place(s, 'lib-coyote', 0, 0)
    const kurfs = place(s, 'lib-kurfs', 1000, 0)
    // Beyond every medium's suggest radius.
    place(s, 'lib-faadc2', 50000, 0)
    s.connections.push({ id: 'c1', fromId: kurfs.id, toId: coyote.id, label: 'fc uplink' })
    const st = integrationBoardStatus(s, coyote.id)!
    const by = new Map(st.partners.map((p) => [p.specId, p]))

    const k = by.get('lib-kurfs')!
    expect(k.required).toBe(true)
    expect(k.instances).toEqual([
      { entityId: kurfs.id, name: kurfs.name, distM: 1000, linked: true, inRange: true },
    ])
    const f = by.get('lib-faadc2')!
    expect(f.required).toBe(true)
    expect(f.instances).toHaveLength(1)
    expect(f.instances[0].linked).toBe(false)
    expect(f.instances[0].inRange).toBe(false)
    expect(by.get('lib-tpq53')!.instances).toHaveLength(0)
    expect(by.get('lib-lstar')!.required).toBe(false)
    expect(st.missing).toEqual([])
  })

  it('reads a link stored in either direction', () => {
    const s = emptyScenario()
    const coyote = place(s, 'lib-coyote', 0, 0)
    const kurfs = place(s, 'lib-kurfs', 100, 0)
    s.connections.push({ id: 'c1', fromId: coyote.id, toId: kurfs.id, label: '' })
    const st = integrationBoardStatus(s, coyote.id)!
    expect(st.partners.find((p) => p.specId === 'lib-kurfs')!.instances[0].linked).toBe(true)
  })

  it('reports a requirement group missing until any one member is placed', () => {
    const s = emptyScenario()
    const coyote = place(s, 'lib-coyote', 0, 0)
    expect(integrationBoardStatus(s, coyote.id)!.missing).toEqual([
      { kind: 'required-c2', names: [spec('lib-faadc2').name, spec('lib-lattice').name] },
      { kind: 'fc-source', names: [spec('lib-kurfs').name, spec('lib-tpq53').name] },
    ])
    // A disabled member does not satisfy the group.
    const off = place(s, 'lib-tpq53', 500, 0)
    off.enabled = false
    expect(integrationBoardStatus(s, coyote.id)!.missing.map((m) => m.kind)).toEqual([
      'required-c2',
      'fc-source',
    ])
    place(s, 'lib-lattice', 500, 0)
    expect(integrationBoardStatus(s, coyote.id)!.missing.map((m) => m.kind)).toEqual(['fc-source'])
    place(s, 'lib-kurfs', 500, 0)
    expect(integrationBoardStatus(s, coyote.id)!.missing).toEqual([])
  })

  it('sorts unsatisfied required, unlinked on board, not on board, then linked', () => {
    const s = emptyScenario()
    const coyote = place(s, 'lib-coyote', 0, 0)
    // fc-source group satisfied by KuRFS (linked); required-c2 group unsatisfied.
    const kurfs = place(s, 'lib-kurfs', 1000, 0)
    s.connections.push({ id: 'c1', fromId: kurfs.id, toId: coyote.id, label: '' })
    place(s, 'lib-lstar', 2000, 0)
    const ids = integrationBoardStatus(s, coyote.id)!.partners.map((p) => p.specId)
    // Bucket 0: FAAD C2 (documented) before Lattice (probable).
    expect(ids.slice(0, 2)).toEqual(['lib-faadc2', 'lib-lattice'])
    expect(ids[2]).toBe('lib-lstar')
    // TPQ-53 is in a satisfied group, so it sorts with the other unplaced partners.
    expect(ids.indexOf('lib-tpq53')).toBeGreaterThan(2)
    expect(ids[ids.length - 1]).toBe('lib-kurfs')
  })

  it('folds in an in-range shared-protocol partner and keeps it once linked', () => {
    const s = emptyScenario()
    const lattice = place(s, 'lib-lattice', 0, 0)
    const rf = place(s, 'lib-rfone', 200, 0)
    const find = () =>
      integrationBoardStatus(s, rf.id)!.partners.find((p) => p.specId === 'lib-lattice')
    const p = find()!
    expect(p.confidence).toBe('probable')
    expect(p.required).toBe(false)
    expect(p.source).toBeUndefined()
    expect(p.instances).toEqual([
      { entityId: lattice.id, name: lattice.name, distM: 200, linked: false, inRange: true },
    ])
    s.connections.push({ id: 'c1', fromId: rf.id, toId: lattice.id, label: 'track data' })
    expect(find()!.instances[0].linked).toBe(true)
  })

  it('linkDirection follows the kill chain and keeps c2-c2 order', () => {
    const s = emptyScenario()
    const radar = place(s, 'lib-kurfs', 0, 0)
    const c2 = place(s, 'lib-faadc2', 0, 0)
    const eff = place(s, 'lib-coyote', 0, 0)
    const c2b = place(s, 'lib-lattice', 0, 0)
    expect(linkDirection(c2, radar)).toEqual({ fromId: radar.id, toId: c2.id })
    expect(linkDirection(eff, c2)).toEqual({ fromId: c2.id, toId: eff.id })
    expect(linkDirection(c2b, c2)).toEqual({ fromId: c2b.id, toId: c2.id })
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { emptyScenario, SEED_LIBRARY, SEED_SYSTEMS } from './seed'
import { evaluateIntegration } from './integration'

/**
 * System presets reference shared library models by specId only; they carry
 * no spec copies of their own. These tests pin that convention so preset
 * numbers can never drift from the base library models: every referenced id
 * must resolve, and a fresh placement must carry the base model's numbers
 * end to end.
 */

const byId = new Map(SEED_LIBRARY.map((m) => [m.id, m]))

describe('seed system preset integrity', () => {
  it('every component specId resolves to a base library model', () => {
    for (const preset of SEED_SYSTEMS) {
      for (const comp of preset.components) {
        expect(byId.has(comp.specId), `${preset.name}: ${comp.specId}`).toBe(true)
      }
    }
  })

  it('every link index points at a component', () => {
    for (const preset of SEED_SYSTEMS) {
      for (const [a, b] of preset.links) {
        expect(a, preset.name).toBeGreaterThanOrEqual(0)
        expect(b, preset.name).toBeGreaterThanOrEqual(0)
        expect(a, preset.name).toBeLessThan(preset.components.length)
        expect(b, preset.name).toBeLessThan(preset.components.length)
      }
    }
  })


  it('every preset link is one the integration model supports', () => {
    // addSystemFromPreset writes these links straight into Connection records
    // without consulting evaluateIntegration, so a preset can otherwise draw a
    // kill chain that integrationData.ts denies.
    const offenders: string[] = []
    for (const preset of SEED_SYSTEMS) {
      for (const [a, b] of preset.links) {
        const from = byId.get(preset.components[a].specId)!
        const to = byId.get(preset.components[b].specId)!
        const verdict = evaluateIntegration(from, to)
        if (!verdict) offenders.push(`${preset.id} [${a},${b}]: no basis ${from.id} -> ${to.id}`)
        else if (!verdict.ok) offenders.push(`${preset.id} [${a},${b}]: denied ${from.id} -> ${to.id}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('magazine-armed effector models used by presets carry a magazine size', () => {
    for (const preset of SEED_SYSTEMS) {
      for (const comp of preset.components) {
        const eff = byId.get(comp.specId)?.effector
        if (!eff) continue
        if (eff.effectorType === 'interceptor' || eff.effectorType === 'gun') {
          expect(eff.magazineSize, `${preset.name}: ${comp.specId}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('the MEROPS interceptor model keeps its finite magazine and engage time', () => {
    const merops = byId.get('lib-merops')!.effector!
    expect(merops.magazineSize).toBe(4)
    expect(merops.engageTimeS).toBe(120)
  })
})

describe('placed preset components match the base library models', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
  })

  for (const preset of SEED_SYSTEMS) {
    it(`${preset.name}: placement carries base sensor and effector numbers`, () => {
      useStore.getState().addSystemFromPreset(preset.id, { x: 0, y: 0 })
      const s = useStore.getState().scenario
      const placed = s.entities
      // Every component resolves and places (no silently dropped models).
      expect(placed).toHaveLength(preset.components.length)
      for (const e of placed) {
        const model = s.library.find((m) => m.id === e.specId)
        const base = byId.get(e.specId!)
        expect(model, `${preset.name}: ${e.specId}`).toBeDefined()
        expect(base, `${preset.name}: ${e.specId}`).toBeDefined()
        // No drift on any spec field the analysis reads.
        expect(model!.sensor, `${preset.name}: ${e.specId} sensor`).toEqual(base!.sensor)
        expect(model!.effector, `${preset.name}: ${e.specId} effector`).toEqual(base!.effector)
        if (base!.effector) {
          const { magazineSize, engageTimeS, minRangeM, maxRangeM, pk } = model!.effector!
          expect({ magazineSize, engageTimeS, minRangeM, maxRangeM, pk }).toEqual({
            magazineSize: base!.effector.magazineSize,
            engageTimeS: base!.effector.engageTimeS,
            minRangeM: base!.effector.minRangeM,
            maxRangeM: base!.effector.maxRangeM,
            pk: base!.effector.pk,
          })
        }
      }
    })
  }
})

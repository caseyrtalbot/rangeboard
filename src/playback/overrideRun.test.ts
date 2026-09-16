import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import type { Override } from '../model/libraryField'
import { applyOverrides } from '../model/applyOverrides'
import { runReplicates } from './mcRun'
import { runTrial } from './trial'
import { createTrialManifest } from './trialTypes'
import { analysisBasisSignature } from '../state/analysisBasis'

/** The JIATF-401 firing laydown (seed 4821, 30 replicates, legacy kinetic Pk): the Coyote fires. */
function laydown() {
  return parseAutosave(JSON.stringify(fixture))
}

/** A calibrated Pk of 0.02 on the effector the scenario fires. */
const LOW_PK: Override = {
  modelId: 'lib-coyote', field: 'pk', value: 0.02, reason: 'calibrated', date: '2026-09-15T00:00:00.000Z',
}

const last = (xs: number[]) => xs[xs.length - 1]

describe('an override reaches the run', () => {
  it('lowers the replicate run kills against the library value at one seed', () => {
    const scenario = laydown()
    const library = runReplicates(scenario)
    const overridden = runReplicates(applyOverrides(scenario, [LOW_PK]))

    expect(scenario.library.find((m) => m.id === LOW_PK.modelId)!.effector!.pk).toBe(0.85)
    expect(last(library.kills.mean)).toBeGreaterThan(0)
    expect(last(overridden.kills.mean)).toBeLessThan(last(library.kills.mean))
    expect(last(overridden.leakers.mean)).toBeGreaterThan(last(library.leakers.mean))
  }, 15_000)

  it('is read by the trial from its manifest, over the captured scenario', () => {
    const scenario = laydown()
    const signature = analysisBasisSignature(scenario)
    const library = runTrial(scenario, createTrialManifest(scenario, 'run-1', signature))
    const overridden = runTrial(scenario, createTrialManifest(scenario, 'run-1', signature, { overrides: [LOW_PK] }))

    expect(library.report.totals.expectedKills).toBeGreaterThan(0)
    expect(overridden.report.totals.expectedKills).toBeLessThan(library.report.totals.expectedKills)
    expect(overridden.manifest.overrides).toEqual([LOW_PK])
    // The captured scenario keeps the library value.
    expect(scenario.library.find((m) => m.id === LOW_PK.modelId)!.effector!.pk).toBe(0.85)
  })
})

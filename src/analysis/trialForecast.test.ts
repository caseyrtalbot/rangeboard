import { describe, expect, it } from 'vitest'
import fixture from '../playback/__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import type { Override } from '../model/libraryField'
import { applyOverrides } from '../model/applyOverrides'
import type { McSummary } from '../playback/mcRun'
import { runTrial } from '../playback/trial'
import { createTrialManifest } from '../playback/trialTypes'
import { analysisBasisSignature } from '../state/analysisBasis'
import { engagementPicture } from './impact'
import { assessRunValidity } from './runValidity'
import { trialForecast, trialResultOf } from './trialResult'

/** A site survey shortens the LSTAR detect range; the trial ran on it. */
const SHORT_RANGE: Override = {
  modelId: 'lib-lstar',
  field: 'detectRangeM',
  value: 6000,
  reason: 'site survey',
  date: '2026-09-15T00:00:00.000Z',
}
/** A band wide enough that only the detect-time comparison can fire. */
const mc = {
  durationS: 0,
  replicates: 40,
  kills: { lo: [0], hi: [10] },
  perThreat: { u1: { shipCount: 1 } },
} as unknown as McSummary

/**
 * The firing laydown with the LSTAR as its one sensor: its detection has no
 * Pd draw, so the trial and the deterministic forecast detect at the same
 * time when they run the same values, and only the values can part them.
 */
function laydown() {
  const base = parseAutosave(JSON.stringify(fixture))
  return {
    ...base,
    // A stated scan period, so the comparison has one to measure against.
    library: base.library.map((m) =>
      m.id === 'lib-lstar' ? { ...m, sensor: { ...m.sensor!, updateRateS: 5 } } : m,
    ),
    entities: base.entities.map((e) =>
      e.kind !== 'sensor'
        ? e
        : e.id === 'ent-mtnvzhmr-22'
          ? { ...e, specId: 'lib-lstar' }
          : { ...e, enabled: false },
    ),
  }
}

describe('trialForecast', () => {
  const scenario = laydown()
  const signature = analysisBasisSignature(scenario)
  const manifest = createTrialManifest(scenario, 'run-1', signature, { overrides: [SHORT_RANGE] })
  const view = trialResultOf(scenario, manifest, runTrial(scenario, manifest))
  const disagreement = (forecast: ReturnType<typeof engagementPicture>) =>
    assessRunValidity(view.scenario, forecast.assessments, undefined, {
      assessments: view.assessments,
      kills: 0,
      mc,
    }).findings.filter((f) => f.id === 'forecast-trial-disagreement')

  it('runs the values the trial ran, so a shared detect-range override raises no disagreement', () => {
    const first = (rows: { firstDetectS: number | null }[]) =>
      Math.min(...rows.map((a) => a.firstDetectS ?? Infinity))
    const library = engagementPicture(view.scenario)
    const forecast = trialForecast(view)
    expect(first(forecast.assessments)).toBeGreaterThan(first(library.assessments))
    // Within the LSTAR's 5 s scan of the trial's own first detect.
    expect(Math.abs(first(forecast.assessments) - first(view.assessments))).toBeLessThanOrEqual(5)
    expect(forecast.assessments).toEqual(
      engagementPicture(applyOverrides(scenario, [SHORT_RANGE])).assessments,
    )
    expect(disagreement(library)).toHaveLength(1)
    expect(disagreement(forecast)).toHaveLength(0)
  })

  it("is the captured scenario's own picture with no override", () => {
    const plain = createTrialManifest(scenario, 'run-1', signature)
    const bare = trialResultOf(scenario, plain, runTrial(scenario, plain))
    expect(trialForecast(bare).assessments).toEqual(engagementPicture(scenario).assessments)
  })
})

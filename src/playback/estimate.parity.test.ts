import { describe, expect, it } from 'vitest'
import jiatfFixture from './__fixtures__/detection-outside-rings.json'
import layeredFixture from './__fixtures__/layered-acoustic-merops.json'
import { parseAutosave } from '../io/persist'
import type { Scenario } from '../model/types'
import { runReplicates } from './mcRun'
import { runTrial } from './trial'
import { createTrialManifest } from './trialTypes'

/**
 * Estimate-path parity (Casey, 2026-09-10, after the Phase 3 gate): the golden
 * fixtures pin `physics: ['truthTracks', 'noFalseTracks', 'noOperatorQueue']`, so
 * `sensitivity.parity`, `accuracy.verify` and `convergence.verify` guard the truth path.
 * This file guards the path the Board runs by default: Phase 3 physics, the Kalman
 * estimate, fusion, false tracks and the operator queue on. The before/after capture and
 * the model-specific reasons for every moved value are in
 * docs/field-te/evidence/p3-gate-2026-09-10/comparison.md. A later physics change moves
 * one of them only with a replacement named in its slice brief. The layered event
 * count and kill mass below are the post-flyout measurement and still match.
 * The Monte Carlo means that moved are still the pre-horizon expects. The
 * flight horizon is the flight from the estimate time; the measured means are
 * in docs/field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md.
 * The 4.68 figure is not this pin.
 */

const SEED = 4821
const REPLICATES = 200

function estimatePath(fixture: unknown): Scenario {
  const s = parseAutosave(JSON.stringify(fixture))
  delete s.physics
  return s
}

function trialOf(fixture: unknown, name: string) {
  const s = estimatePath(fixture)
  return runTrial(s, createTrialManifest(s, `p2-gate-${name}`, 'p2-gate'))
}

const pick = (r: ReturnType<typeof runTrial>) =>
  r.assessments.map((t) => [
    t.uasId,
    t.status,
    t.firstDetectS,
    t.firstConfirmS,
    t.stableTrackAtS,
    t.declaredHostileAtS,
    t.engageGateS,
  ])

const killMass = (r: ReturnType<typeof runTrial>) =>
  r.report.events.reduce((s, e) => s + (e.killDelta ?? 0), 0)

const last = (v: number | number[]) => (Array.isArray(v) ? v[v.length - 1] : v)

function monteCarlo(fixture: unknown) {
  const s = estimatePath(fixture)
  s.runMode = 'monte-carlo'
  s.seed = SEED
  s.replicates = REPLICATES
  s.targetHalfWidth = null
  s.uncertainty = 'aleatory'
  return runReplicates(s)
}

describe('estimate-path parity: the trial at seed 4821, replicate of the gate run id', () => {
  it('JIATF-401 laydown', () => {
    const r = trialOf(jiatfFixture, 'detection-outside-rings')
    expect(pick(r)).toEqual([['ent-mtnvzhmr-25', 'engageable', 1, null, 505, 548, 548]])
    expect(r.report.events).toHaveLength(2)
    expect(killMass(r)).toBe(0)
    expect(r.tracks).toHaveLength(3168)
  })

  it('layered acoustic laydown', () => {
    const r = trialOf(layeredFixture, 'layered-acoustic-merops')
    expect(pick(r)).toEqual([
      ['ent-mt5bofdd-2q', 'no-stable-track', 1177.5, null, null, null, null],
      ['ent-mt5bofdd-2s', 'no-stable-track', 986.5, null, null, null, null],
      ['ent-mt5bq0rc-2u', 'no-path', null, null, null, null, null],
      ['ent-mt5bqja3-2v', 'no-stable-track', 24.5, null, null, null, null],
      ['ent-mt5bqnfg-2x', 'engageable', 0.5, 0.5, 1.5, 6.5, 6.5],
      ['ent-mt5bqnfg-2z', 'engageable', 0.5, 0.5, 1.5, 6.5, 6.5],
      ['ent-mt5bqnfg-31', 'engageable', 0.5, 0.5, 1.5, 6.5, 6.5],
      ['ent-mt5bqnfg-33', 'engageable', 0.5, 0.5, 1.5, 6.5, 6.5],
      ['ent-mt5bqnfg-35', 'engageable', 0.5, 0.5, 1.5, 6.5, 6.5],
      ['ent-mt5bqnfg-37', 'engageable', 0.5, 0.5, 1.5, 6.5, 6.5],
    ])
    expect(r.report.events).toHaveLength(11)
    expect(killMass(r)).toBe(1)
    expect(r.tracks).toHaveLength(14192)
  })
})

describe('estimate-path parity: 200 aleatory replicates at seed 4821', () => {
  it('JIATF-401 end-of-run means', () => {
    const m = monteCarlo(jiatfFixture)
    expect(m.replicates).toBe(REPLICATES)
    expect(last(m.leakers.mean)).toBeCloseTo(1, 9)
    expect(last(m.kills.mean)).toBeCloseTo(0, 9)
    expect(last(m.firmTrackS.mean)).toBeCloseTo(505.0625, 9)
  }, 60_000)

  it('layered acoustic end-of-run means', () => {
    const m = monteCarlo(layeredFixture)
    expect(m.replicates).toBe(REPLICATES)
    expect(last(m.leakers.mean)).toBeCloseTo(0, 9)
    expect(last(m.kills.mean)).toBeCloseTo(1.1, 9)
    expect(last(m.firmTrackS.mean)).toBeCloseTo(1.5, 9)
  }, 120_000)
})

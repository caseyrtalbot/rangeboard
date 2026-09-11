import { describe, expect, it } from 'vitest'
import jiatfFixture from './__fixtures__/detection-outside-rings.json'
import layeredFixture from './__fixtures__/layered-acoustic-merops.json'
import { parseAutosave } from '../io/persist'
import type { Scenario } from '../model/types'
import { runReplicates } from './mcRun'
import { runTrial } from './trial'
import { createTrialManifest } from './trialTypes'

/**
 * Estimate-path parity (Casey, 2026-09-10, after the Phase 2 gate): the golden
 * fixtures pin `physics: ['truthTracks', 'noFalseTracks', 'noOperatorQueue']`, so
 * `sensitivity.parity`, `accuracy.verify` and `convergence.verify` guard the truth path.
 * This file guards the path the Board runs by default: the Kalman estimate, fusion,
 * false tracks and the operator queue on. The numbers are the Phase 2 gate capture in
 * docs/field-te/evidence/p2-gate-2026-09-10/after-estimate/timeline.json (main 467ceda),
 * so Phase 3 baselines stay comparable. A physics change moves one of them only with a
 * hand-derived replacement named in the slice's brief, as for the other parity files.
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
    t.uasId, t.status, t.firstDetectS, t.firstConfirmS, t.stableTrackAtS, t.declaredHostileAtS, t.engageGateS,
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
    expect(pick(r)).toEqual([
      ['ent-mtnvzhmr-25', 'engageable', 1, null, 509.5, 547.5, 547.5],
    ])
    expect(r.report.events).toHaveLength(2)
    expect(killMass(r)).toBe(1)
    expect(r.tracks).toHaveLength(3173)
  })

  it('layered acoustic laydown', () => {
    const r = trialOf(layeredFixture, 'layered-acoustic-merops')
    expect(pick(r)).toEqual([
      ['ent-mt5bofdd-2q', 'engageable', 196, 942.5, 785.5, 795.5, 795.5],
      ['ent-mt5bofdd-2s', 'engageable', 236.5, 1062.5, 903, 913, 913],
      ['ent-mt5bq0rc-2u', 'no-path', null, null, null, null, null],
      ['ent-mt5bqja3-2v', 'engageable', 15.5, 699, 352, 362, 362],
      ['ent-mt5bqnfg-2x', 'engageable', 0.5, 72, 1.5, 11.5, 11.5],
      ['ent-mt5bqnfg-2z', 'engageable', 0.5, 74, 1.5, 11.5, 11.5],
      ['ent-mt5bqnfg-31', 'engageable', 0.5, 73, 1.5, 11.5, 11.5],
      ['ent-mt5bqnfg-33', 'engageable', 0.5, 78.5, 1.5, 11.5, 11.5],
      ['ent-mt5bqnfg-35', 'engageable', 0.5, 76, 1.5, 11.5, 11.5],
      ['ent-mt5bqnfg-37', 'engageable', 0.5, 85.5, 1.5, 11.5, 11.5],
    ])
    expect(r.report.events).toHaveLength(25)
    expect(killMass(r)).toBe(6)
    expect(r.tracks).toHaveLength(25157)
  })
})

describe('estimate-path parity: 200 aleatory replicates at seed 4821', () => {
  it('JIATF-401 end-of-run means', () => {
    const m = monteCarlo(jiatfFixture)
    expect(m.replicates).toBe(REPLICATES)
    expect(last(m.leakers.mean)).toBeCloseTo(0.06, 9)
    expect(last(m.kills.mean)).toBeCloseTo(0.94, 9)
    expect(last(m.firmTrackS.mean)).toBeCloseTo(509.575, 9)
  }, 60_000)

  it('layered acoustic end-of-run means', () => {
    const m = monteCarlo(layeredFixture)
    expect(m.replicates).toBe(REPLICATES)
    expect(last(m.leakers.mean)).toBeCloseTo(2.12, 9)
    expect(last(m.kills.mean)).toBeCloseTo(6.88, 9)
    expect(last(m.firmTrackS.mean)).toBeCloseTo(1.5, 9)
  }, 120_000)
})

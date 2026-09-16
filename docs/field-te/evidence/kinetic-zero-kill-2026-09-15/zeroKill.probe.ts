/**
 * Reference script for the zero-kill kinetic finding, 2026-09-15. Not a test.
 *
 * This is the verbatim probe that produced `probe-baseline.txt` (committed tree)
 * and `probe-fixed.txt` (candidate `shot.ts` horizon fix). Its imports are
 * relative to `src/playback/`, where it ran. To re-run it:
 *
 *   1. Copy this file to `src/playback/zeroKill.probe.test.ts`.
 *   2. Append:
 *        import { describe, it } from 'vitest'
 *        describe('zero-kill probe', () => { it('probe', main, 300_000) })
 *   3. Run:
 *        PROBE_OUT=/tmp/probe.txt npx vitest run --dir src zeroKill.probe
 *   4. Delete the copy. It must not stay under `src/`.
 *
 * Never run bare `npx vitest run`; scope with `--dir src`.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
const OUT = process.env.PROBE_OUT ?? '/dev/stdout'
const log = (...xs: unknown[]) => appendFileSync(OUT, xs.map((x) => String(x)).join(' ') + '\n')
import { parseScenarioJson } from '../engine/loadScenario'
import { createTrialManifest } from './trialTypes'
import { runTrial } from './trial'
import { runReplicates } from './mcRun'
import { predictedStateAt, predictionSigmaAtS } from './intercept'
import { PROCESS_NOISE_Q, positionSigmaM } from './kalman'
import { kineticEffectProbability, missDistanceSigmaM, rayleighProbabilityWithin } from './pk/kinetic'
import { limitedPosAtTime } from './flight'
import { dist } from '../geometry/geo'
import type { EffectorSpec, Scenario, UasSpec } from '../model/types'

const FILE = 'docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'

/** Per-axis variance of a track estimate propagated by T, term by term. */
function decompose(cov: number[], T: number) {
  const q3 = (PROCESS_NOISE_Q * T * T * T) / 3
  const axis = (pp: number, pv: number, vv: number) => ({
    pos: +pp.toFixed(2),
    cross: +(2 * T * pv).toFixed(2),
    vel: +(T * T * vv).toFixed(2),
    cwna: +q3.toFixed(2),
    total: +(pp + 2 * T * pv + T * T * vv + q3).toFixed(2),
  })
  const x = axis(cov[0], cov[2], cov[10])
  const y = axis(cov[5], cov[7], cov[15])
  return {
    T: +T.toFixed(3),
    x,
    y,
    sigmaM: +Math.sqrt((x.total + y.total) / 2).toFixed(2),
    cwnaShare: +(q3 / ((x.total + y.total) / 2)).toFixed(4),
  }
}

function probe(label: string, s: Scenario) {
  const manifest = createTrialManifest(s, 'RUN-0001', 'probe')
  const trial = runTrial(s, manifest)
  const coyote = s.entities.find((e) => e.specId === 'lib-coyote')!
  const spec = s.library.find((m) => m.id === 'lib-coyote')!.effector as EffectorSpec
  const mavic = s.entities.find((e) => e.specId === 'lib-mavic3')!
  const uas = s.library.find((m) => m.id === 'lib-mavic3')!.uas as UasSpec
  const path = s.paths.find((p) => p.entityId === mavic.id)!
  const speed = path.speedMps ?? uas.cruiseSpeedMps
  const a = trial.assessments.find((x) => x.uasId === mavic.id)!
  log(`\n=== ${label} physics=${JSON.stringify(manifest.physicsSwitches)} ===`)
  log('spec', JSON.stringify({ ...spec }))
  log('formation', JSON.stringify(mavic.formation ?? null), 'pathSpeed', speed)
  log('assessment', JSON.stringify({
    status: a.status, firstDetectS: a.firstDetectS, arrivalS: a.arrivalS, engageGateS: a.engageGateS,
    stableTrackAtS: a.stableTrackAtS, declaredHostileAtS: a.declaredHostileAtS, gates: a.effectorGates,
    windowS: a.windowS, fused: a.fusedTracks?.length,
  }))
  const t = trial.report.threats.find((x) => x.uasId === mavic.id)!
  log('threat report', JSON.stringify({ shipCount: t.shipCount, expectedKills: t.expectedKills, expectedLeakers: t.expectedLeakers, shotsFired: t.shotsFired, firstShotS: t.firstShotS }))
  log('report totals', JSON.stringify({ expectedKills: trial.report.expectedKills, expectedLeakers: trial.report.expectedLeakers, events: trial.report.events.length }))
  for (const ev of trial.report.events) {
    const fused = a.fusedTracks ?? []
    let est = null as (typeof fused)[number] | null
    for (const f of fused) if (f.state.tS <= ev.tS + 1e-9) est = f
    const tRel = ev.tReleaseS ?? ev.tS + spec.engageTimeS
    const atRel = limitedPosAtTime(path.points, speed, path.startDelayS, tRel, uas, s.environment)
    const atEff = limitedPosAtTime(path.points, speed, path.startDelayS, ev.tEffectS, uas, s.environment)
    const sigAtT = est ? positionSigmaM(est.covariance) : null
    const tofS = ev.tEffectS - tRel
    const sigRel = predictionSigmaAtS(est, tRel)
    const sigEff = predictionSigmaAtS(est, ev.tEffectS)
    // The candidate horizon: the flight alone, measured from the estimate time.
    const sigTof = est ? predictionSigmaAtS(est, est.state.tS + tofS) : null
    const sigMiss = sigRel == null ? null : missDistanceSigmaM(sigRel, spec.guidanceNoiseM ?? 0)
    const sigMissTof = sigTof == null ? null : missDistanceSigmaM(sigTof, spec.guidanceNoiseM ?? 0)
    const rangeRel = dist(coyote.pos, atRel.pos)
    const rangeEff = dist(coyote.pos, atEff.pos)
    const ctx = { basePk: spec.pk ?? 0.85, uas, slantM: rangeEff, predictionSigmaM: sigRel }
    log(JSON.stringify({
      uasId: ev.uasId, ship: ev.shipIdx,
      tS: ev.tS, tReleaseS: tRel, tEffectS: +ev.tEffectS.toFixed(3), tofS: +tofS.toFixed(3),
      capped: ev.flightCapped ?? false, late: ev.lateEffect, pk: ev.pk, killDelta: ev.killDelta,
      estimate: est ? { tS: est.state.tS, source: est.source, coasting: est.coasting, hits: est.hits, sigmaNowM: +sigAtT!.toFixed(4), cov: [est.covariance[0], est.covariance[5], est.covariance[2], est.covariance[7], est.covariance[10], est.covariance[15]].map((v) => +v.toFixed(4)), speedEst: +Math.hypot(est.state.vx, est.state.vy).toFixed(2) } : null,
      targetAtRelease: { x: +atRel.pos.x.toFixed(1), y: +atRel.pos.y.toFixed(1), rangeM: +rangeRel.toFixed(1) },
      targetAtEffect: { x: +atEff.pos.x.toFixed(1), y: +atEff.pos.y.toFixed(1), rangeM: +rangeEff.toFixed(1) },
      sigmaPredAtReleaseM: sigRel == null ? null : +sigRel.toFixed(2),
      sigmaPredAtEffectM: sigEff == null ? null : +sigEff.toFixed(2),
      sigmaPredOverTofM: sigTof == null ? null : +sigTof.toFixed(2),
      sigmaMissM: sigMiss == null ? null : +sigMiss.toFixed(2),
      pIntercept: sigMiss == null ? null : rayleighProbabilityWithin(spec.lethalRadiusM ?? 0, sigMiss),
      pInterceptOverTof: sigMissTof == null ? null : rayleighProbabilityWithin(spec.lethalRadiusM ?? 0, sigMissTof),
      pkPhysical: kineticEffectProbability(spec, { ...ctx, fallback: false }),
      pkLegacy: kineticEffectProbability(spec, { ...ctx, fallback: true }),
      pkPhysicalIfTruth: kineticEffectProbability(spec, { ...ctx, predictionSigmaM: null, fallback: false }),
      pkPhysicalIfSigmaNow: kineticEffectProbability(spec, { ...ctx, predictionSigmaM: sigAtT, fallback: false }),
      pkPhysicalOverTof: kineticEffectProbability(spec, { ...ctx, predictionSigmaM: sigTof, fallback: false }),
    }))
    if (est) {
      log('  decompose@release', JSON.stringify(decompose([...est.covariance], tRel - est.state.tS)))
      log('  decompose@tof    ', JSON.stringify(decompose([...est.covariance], tofS)))
    }
  }
  const mc = runReplicates(s)
  const last = (b: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Array.isArray(v) ? v[v.length - 1] : v])))
  log('MC', mc.replicates, 'replicates seed', mc.seed, 'kills', last(mc.kills as never), 'leakers', last(mc.leakers as never))
}

import jiatfFixture from './__fixtures__/detection-outside-rings.json'
import layeredFixture from './__fixtures__/layered-acoustic-merops.json'
import { parseAutosave } from '../io/persist'

function parity(label: string, fixture: unknown, name: string) {
  const s = parseAutosave(JSON.stringify(fixture))
  delete s.physics
  const r = runTrial(s, createTrialManifest(s, `p2-gate-${name}`, 'p2-gate'))
  log(`\n=== parity ${label} trial ===`)
  log('tracks', r.tracks.length, 'events', r.report.events.length, 'killMass', r.report.events.reduce((a, e) => a + (e.killDelta ?? 0), 0))
  for (const ev of r.report.events) {
    const a = r.assessments.find((x) => x.uasId === ev.uasId)!
    const ent = s.entities.find((e) => e.id === ev.effectorId)!
    const spec = s.library.find((m) => m.id === ent.specId)!.effector as EffectorSpec
    const uEnt = s.entities.find((e) => e.id === ev.uasId)!
    const uas = s.library.find((m) => m.id === uEnt.specId)!.uas as UasSpec
    let est = null as (typeof a.fusedTracks extends undefined ? never : NonNullable<typeof a.fusedTracks>[number]) | null
    for (const f of a.fusedTracks ?? []) if (f.state.tS <= ev.tS + 1e-9) est = f
    const tRel = ev.tReleaseS ?? ev.tS + spec.engageTimeS
    const tofS = ev.tEffectS - tRel
    const sigRel = predictionSigmaAtS(est, tRel)
    const sigTof = est ? predictionSigmaAtS(est, est.state.tS + tofS) : null
    const sigMiss = sigRel == null ? null : missDistanceSigmaM(sigRel, spec.guidanceNoiseM ?? 0)
    const sigMissTof = sigTof == null ? null : missDistanceSigmaM(sigTof, spec.guidanceNoiseM ?? 0)
    log(JSON.stringify({
      effector: ent.name, type: spec.effectorType, uas: uEnt.name, group: uas.group, airframe: uas.airframe, ship: ev.shipIdx,
      tS: ev.tS, tReleaseS: tRel, tEffectS: +ev.tEffectS.toFixed(3), tofS: +tofS.toFixed(3),
      channel: ev.channel, pk: ev.pk, killDelta: ev.killDelta, late: ev.lateEffect,
      flightCapped: ev.flightCapped ?? false,
      windows: (a.effectorGates ?? []).map((g) => g.effectorId === ev.effectorId ? g : null).filter(Boolean),
      windowS: a.windowS,
      estPosAtRelease: est ? (() => { const p = predictedStateAt(est, tRel); return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), slantFromLauncherM: +dist(ent.pos, { x: p.x, y: p.y }).toFixed(2) } })() : null,
      estPosAtEffect: est ? (() => { const p = predictedStateAt(est, ev.tEffectS); return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), slantFromLauncherM: +dist(ent.pos, { x: p.x, y: p.y }).toFixed(2) } })() : null,
      launcher: ent.pos, estStatePos: { x: +est!.state.x.toFixed(1), y: +est!.state.y.toFixed(1) }, estVel: { vx: +est!.state.vx.toFixed(2), vy: +est!.state.vy.toFixed(2) },
      flyoutSpeedMps: spec.flyoutSpeedMps, maxRangeM: spec.maxRangeM, minRangeM: spec.minRangeM, engageTimeS: spec.engageTimeS,
      estTs: est?.state.tS,
      cov: est ? [est.covariance[0], est.covariance[5], est.covariance[2], est.covariance[7], est.covariance[10], est.covariance[15]].map((v: number) => +v.toFixed(4)) : null,
      sigmaPredAtReleaseM: sigRel == null ? null : +sigRel.toFixed(4),
      sigmaPredOverTofM: sigTof == null ? null : +sigTof.toFixed(4),
      sigmaMissM: sigMiss == null ? null : +sigMiss.toFixed(4),
      sigmaMissOverTofM: sigMissTof == null ? null : +sigMissTof.toFixed(4),
      lethalRadiusM: spec.lethalRadiusM, guidanceNoiseM: spec.guidanceNoiseM, basePk: spec.pk,
      pIntercept: sigMiss == null ? null : rayleighProbabilityWithin(spec.lethalRadiusM ?? 0, sigMiss),
      pInterceptOverTof: sigMissTof == null ? null : rayleighProbabilityWithin(spec.lethalRadiusM ?? 0, sigMissTof),
    }))
  }
  s.runMode = 'monte-carlo'; s.seed = 4821; s.replicates = 200; s.targetHalfWidth = null; s.uncertainty = 'aleatory'
  const m = runReplicates(s)
  const lastOf = (v: number[]) => v[v.length - 1]
  log('MC200', JSON.stringify({ leakers: lastOf(m.leakers.mean), kills: lastOf(m.kills.mean), firmTrackS: lastOf(m.firmTrackS.mean) }))
}

/** The p4 gate laydown: the same board with a four-ship Mavic line. */
function fourShip(base: Scenario): Scenario {
  return {
    ...base,
    entities: base.entities.map((e) => (
      e.specId === 'lib-mavic3'
        ? { ...e, formation: { count: 4, shape: 'line' as const, spacingM: 50 } }
        : e
    )),
  }
}

/**
 * Entry point. Prints the two protected estimate-path parity fixtures, then the
 * firing-scenario shots under both kinetic models, one ship and four.
 */
export function main(): void {
  writeFileSync(OUT, '')
  parity('JIATF-401', jiatfFixture, 'detection-outside-rings')
  parity('layered', layeredFixture, 'layered-acoustic-merops')
  const base = parseScenarioJson(readFileSync(FILE, 'utf8'))
  probe('one-ship physical (default)', base)
  probe('one-ship legacyKineticPk', { ...base, physics: ['legacyKineticPk'] })
  const four = fourShip(base)
  probe('four-ship physical (default)', four)
  probe('four-ship legacyKineticPk', { ...four, physics: ['legacyKineticPk'] })
}

import type { BasemapMode, FrameSnap, Scenario } from '../model/types'
import { markPresentationVariant } from '../model/scenario'
import { analysisBasisSignature } from './analysisBasis'
import type { McState, PlaybackState, RunResetReason, TrialState } from './runState'
import { freshPlayback, IDLE_MC, IDLE_TRIAL } from './runState'
import { durationOf } from './selectors'
import { selectTrialSelection } from './trialSelectors'

/**
 * A caller names an intent; this module resolves the transition. Store-free: the
 * store applies the returned patch through `set`, so nothing here enters undo
 * history. Only observation advances `observedThroughS`, and only while the
 * retained sampled trial is valid for the current scenario and run.
 */
export type PlaybackCommand =
  /** Play, resume or replay; prepares the trial first when it is not ready. */
  | { type: 'play' }
  | { type: 'pause' }
  /** Play when stopped, pause when playing. */
  | { type: 'toggle' }
  /** Preview time; playback stops, observation is untouched. */
  | { type: 'scrub'; t: number }
  /** A saved frame: scrub plus its camera and basemap. */
  | { type: 'frame'; frame: FrameSnap }
  /** One clock publication at `t`; completes the run once `t` reaches the duration. */
  | { type: 'publish'; t: number }
  /** Observation advance to `t` (playing). */
  | { type: 'advance'; t: number }
  /** Seal the run at `durationS`. */
  | { type: 'complete'; durationS: number }
  /** New identity, clock at zero, nothing observed, no retained analysis. */
  | { type: 'newRun'; reason: RunResetReason }

/** What a command reads. `presetId` is the active analysis lens. */
export interface PlaybackContext {
  scenario: Scenario
  playback: PlaybackState
  trial: TrialState
  presetId: string
  nowMs: number
}

/** Slices a transition may replace; the store maps `basemap` into `ui`. */
export interface PlaybackPatch {
  playback?: PlaybackState
  trial?: TrialState
  scenario?: Scenario
  mc?: McState
  camera?: FrameSnap['camera']
  basemap?: BasemapMode
}

export type PlaybackTransition =
  | { kind: 'none' }
  | {
      kind: 'apply'
      patch: PlaybackPatch
      /** Run sequence the next startup issues; set when this run consumed its number. */
      writeRunSeq?: number
      /** Start trial preparation after the patch is applied. */
      prepare?: boolean
    }
  /** An observation record without a retained trial: reset, then issue the command again. */
  | { kind: 'reset' }

const NONE: PlaybackTransition = { kind: 'none' }

/** Resolve one intent against the current playback context. */
export function resolvePlayback(
  command: PlaybackCommand,
  ctx: PlaybackContext,
): PlaybackTransition {
  switch (command.type) {
    case 'toggle':
      return resolvePlayback({ type: ctx.playback.playing ? 'pause' : 'play' }, ctx)
    case 'play':
      return play(ctx)
    case 'pause':
      return {
        kind: 'apply',
        patch: {
          ...cancelPendingStart(ctx.trial),
          playback: {
            ...ctx.playback,
            playing: false,
            phase: ctx.playback.startedAtMs == null ? 'ready' : 'paused',
          },
        },
      }
    case 'scrub':
      return { kind: 'apply', patch: scrub(ctx, command.t) }
    case 'frame':
      return {
        kind: 'apply',
        patch: {
          ...scrub(ctx, command.frame.simTimeS),
          camera: { ...command.frame.camera },
          basemap: command.frame.basemap,
        },
      }
    case 'publish': {
      // A publication belongs to a playing run; a late frame after pause or
      // completion publishes nothing, so completion happens once.
      if (!ctx.playback.playing) return NONE
      const durationS = durationOf(ctx.scenario)
      if (command.t < durationS) return advance(ctx, command.t)
      // At the duration with no ready trial there is nothing to seal, and a playing
      // run that changes nothing keeps the frame loop alive. Pause it.
      return trialReady(ctx) ? complete(ctx, durationS) : resolvePlayback({ type: 'pause' }, ctx)
    }
    case 'advance':
      return advance(ctx, command.t)
    case 'complete':
      return complete(ctx, command.durationS)
    case 'newRun':
      return newRun(ctx, command.reason)
  }
}

/** Pause, scrub and frame navigation cancel a pending automatic start. */
function cancelPendingStart(trial: TrialState): Pick<PlaybackPatch, 'trial'> {
  return trial.startWhenReady ? { trial: { ...trial, startWhenReady: false } } : {}
}

/** Frame navigation and the scrubber preview time; neither is evidence of playback. */
function scrub(ctx: PlaybackContext, t: number): PlaybackPatch {
  const simTimeS = Math.max(0, t)
  const ready = simTimeS === 0 && ctx.playback.startedAtMs == null
  return {
    ...cancelPendingStart(ctx.trial),
    playback: {
      ...ctx.playback,
      playing: false,
      simTimeS,
      phase: ready ? 'ready' : 'review',
    },
  }
}

/**
 * The observed lens belongs to the run: the first start and a reset stamp it on
 * the scenario through `set`, never through history. A new stamp is a
 * presentation variant, so every engine-keyed cache still hits.
 */
function observedLens(ctx: PlaybackContext): Pick<PlaybackPatch, 'scenario'> {
  if ((ctx.scenario.observedPresetId ?? null) === ctx.presetId) return {}
  const scenario = { ...ctx.scenario, observedPresetId: ctx.presetId }
  markPresentationVariant(scenario, ctx.scenario)
  return { scenario }
}

/** The stamps and the sequence write a run makes exactly once, on its first start. */
function firstStart(ctx: PlaybackContext): {
  patch: Pick<PlaybackPatch, 'scenario'>
  writeRunSeq?: number
} {
  if (ctx.playback.startedAtMs != null) return { patch: {} }
  return { patch: observedLens(ctx), writeRunSeq: ctx.playback.runSeq + 1 }
}

function trialReady(ctx: PlaybackContext): boolean {
  return selectTrialSelection(ctx).status === 'ready'
}

function advance(ctx: PlaybackContext, t: number): PlaybackTransition {
  if (!trialReady(ctx)) return NONE
  const simTimeS = Math.max(0, t)
  const first = firstStart(ctx)
  return {
    kind: 'apply',
    writeRunSeq: first.writeRunSeq,
    patch: {
      ...first.patch,
      playback: {
        ...ctx.playback,
        playing: true,
        phase: 'running',
        simTimeS,
        observedThroughS: Math.max(ctx.playback.observedThroughS, simTimeS),
        startedAtMs: ctx.playback.startedAtMs ?? ctx.nowMs,
        basisSignature: ctx.playback.basisSignature ?? analysisBasisSignature(ctx.scenario),
      },
    },
  }
}

/** Seal the run; an earlier completion keeps its time across every replay. */
function complete(ctx: PlaybackContext, durationS: number): PlaybackTransition {
  if (!trialReady(ctx)) return NONE
  const first = firstStart(ctx)
  return {
    kind: 'apply',
    writeRunSeq: first.writeRunSeq,
    patch: {
      ...first.patch,
      playback: {
        ...ctx.playback,
        playing: false,
        simTimeS: durationS,
        observedThroughS: Math.max(ctx.playback.observedThroughS, durationS),
        phase: 'complete',
        startedAtMs: ctx.playback.startedAtMs ?? ctx.nowMs,
        completedAtMs: ctx.playback.completedAtMs ?? ctx.nowMs,
        basisSignature: ctx.playback.basisSignature ?? analysisBasisSignature(ctx.scenario),
      },
    },
  }
}

/**
 * Play resolves to repair (an observation record without a retained trial resets
 * first), wait (the run starts when preparation lands), replay (a completed run
 * restarts from zero) or resume (clamped to the observed horizon).
 */
function play(ctx: PlaybackContext): PlaybackTransition {
  const { playback, trial } = ctx
  if (trial.manifest == null && playback.startedAtMs != null) return { kind: 'reset' }
  if (trial.status !== 'ready') {
    return {
      kind: 'apply',
      patch: { trial: { ...trial, startWhenReady: true } },
      prepare: trial.status !== 'preparing',
    }
  }
  if (!trialReady(ctx)) return NONE
  const first = firstStart(ctx)
  return {
    kind: 'apply',
    writeRunSeq: first.writeRunSeq,
    patch: {
      ...first.patch,
      trial: { ...trial, startWhenReady: false },
      playback: {
        ...playback,
        playing: true,
        phase: 'running',
        simTimeS:
          playback.phase === 'complete'
            ? 0
            : Math.min(playback.simTimeS, playback.observedThroughS),
        startedAtMs: playback.startedAtMs ?? ctx.nowMs,
        // Completion and achieved observation survive every replay.
        basisSignature: trial.manifest!.basisSignature,
      },
    },
  }
}

/** Only a manual reset issues a new sequence number. */
function newRun(ctx: PlaybackContext, reason: RunResetReason): PlaybackTransition {
  const manual = reason === 'manual'
  const runSeq = manual ? ctx.playback.runSeq + 1 : ctx.playback.runSeq
  return {
    kind: 'apply',
    writeRunSeq: manual ? runSeq : undefined,
    patch: {
      ...observedLens(ctx),
      playback: freshPlayback(runSeq, ctx.playback.speedMult, reason),
      mc: IDLE_MC,
      trial: IDLE_TRIAL,
    },
  }
}

import type { Entity } from '../model/types'
import type { Tool } from '../state/store'

/**
 * Board interaction routing. App (keyboard), CanvasStage (stage clicks, drops,
 * the placement target) and EntityLayer (entity clicks) each normalize their
 * DOM or Konva event into an intent, read the relevant state into a
 * snapshot, and dispatch the action this module returns. The precedence
 * rules live here once; the callers own no ordering of their own.
 *
 * Store-free: the snapshot is plain data, so the full matrix is table-tested.
 */

/** Everything the Escape chain and the click owners need to decide. */
export interface InteractionState {
  /** The command palette or the analysis Layout surface is open; it owns Escape itself. */
  paletteOpen: boolean
  /** The Settings dialog is open; it owns every key. */
  settingsOpen: boolean
  /** The ROE dropdown is open; `usePopover` closes it in the capture phase. */
  roeMenuOpen: boolean
  locationDialogOpen: boolean
  /** The library drawer is open (the drawer and the placement share one Escape). */
  libraryOpen: boolean
  /** A library item is armed and waits for a canvas click. */
  placementArmed: boolean
  tool: Tool
  /** Both calibrate points are placed; Escape then also restores toolbar focus. */
  calibratePlaced: boolean
  raidDraft: boolean
  /** A connect gesture has its first end (`ui.connectFromId`). */
  connectFrom: boolean
  /** A path draft has its UAS (`ui.pathEntityId`). */
  pathStarted: boolean
  /** The key event target is an input, textarea, select or contenteditable. */
  typing: boolean
  /** A marquee just committed on this mouseup; the paired click is stale. */
  clickSuppressed: boolean
}

export type Intent =
  | { kind: 'escape' }
  | { kind: 'click-entity'; entityKind: Entity['kind']; shiftKey: boolean }
  | { kind: 'click-stage'; onEmpty: boolean; inPlacePair: boolean }
  | { kind: 'drop'; modelId: string; systemId: string }
  | { kind: 'tool-change' }
  | { kind: 'arm-placement' }

/**
 * `continue`: another owner (a popover, the palette, the Settings dialog, the
 * stage under an entity) handles the event; the caller does nothing.
 * `consume`: the event ends here with no state change.
 */
export type Action =
  | { type: 'continue' }
  | { type: 'consume' }
  | { type: 'close-location-dialog' }
  | { type: 'cancel-placement' }
  | { type: 'cancel-calibration' }
  | { type: 'clear-board' }
  | { type: 'begin-connect' }
  | { type: 'complete-connect' }
  | { type: 'begin-path' }
  | { type: 'select-entity'; additive: boolean }
  | { type: 'place' }
  | { type: 'commit-raid' }
  | { type: 'add-draft-point' }
  | { type: 'set-calibrate-point' }
  | { type: 'clear-selection' }
  | { type: 'add-entity-from-model'; modelId: string }
  | { type: 'add-system-from-preset'; systemId: string }
  | { type: 'clear-placement' }
  | { type: 'arm-placement' }

const CONTINUE: Action = { type: 'continue' }
const CONSUME: Action = { type: 'consume' }

/** Routes one intent against one snapshot. Pure. */
export function routeInteraction(intent: Intent, state: InteractionState): Action {
  switch (intent.kind) {
    case 'escape':
      return routeEscape(state)
    case 'click-entity':
      return routeEntityClick(intent, state)
    case 'click-stage':
      return routeStageClick(intent, state)
    case 'drop':
      if (intent.modelId) return { type: 'add-entity-from-model', modelId: intent.modelId }
      if (intent.systemId) return { type: 'add-system-from-preset', systemId: intent.systemId }
      return CONSUME
    case 'tool-change':
      // Picking a tool or a Range setup action disarms the placement.
      return { type: 'clear-placement' }
    case 'arm-placement':
      // Arming cancels every draft, the context menu, the connect suggestion
      // and resets the tool; the caller performs that compound reset.
      return { type: 'arm-placement' }
  }
}

/**
 * Escape order: the command palette or Layout surface, then the Settings
 * dialog, then the Location dialog, then an armed placement or the open
 * drawer, then a two-point calibration, then the canvas draft, tool and
 * selection. The ROE dropdown closes in `usePopover` and leaves the placement
 * armed. A typing target gets Escape only for the dialog and calibration steps.
 */
function routeEscape(state: InteractionState): Action {
  if (state.paletteOpen || state.settingsOpen) return CONTINUE
  if (state.locationDialogOpen) return { type: 'close-location-dialog' }
  if (state.roeMenuOpen) return CONTINUE
  if (state.libraryOpen || state.placementArmed) return { type: 'cancel-placement' }
  if (state.calibratePlaced) return { type: 'cancel-calibration' }
  if (state.typing) return CONTINUE
  return { type: 'clear-board' }
}

/**
 * An entity click either ends at the entity or bubbles to the stage. Connect
 * and select own it; a path tool owns only the UAS that starts the draft;
 * boundary, calibrate and an armed raid draft let it fall through as a stage
 * point so the aim gesture may land on an asset.
 */
function routeEntityClick(
  intent: Extract<Intent, { kind: 'click-entity' }>,
  state: InteractionState,
): Action {
  if (state.tool === 'connect')
    return state.connectFrom ? { type: 'complete-connect' } : { type: 'begin-connect' }
  if (state.tool === 'path')
    return intent.entityKind === 'uas' && !state.pathStarted ? { type: 'begin-path' } : CONTINUE
  if (state.tool !== 'select') return CONTINUE
  if (state.raidDraft) return CONTINUE
  return { type: 'select-entity', additive: intent.shiftKey }
}

/**
 * A stage click is the empty canvas or an entity click that bubbled. The
 * marquee's paired click is stale; an armed placement owns the click; the raid
 * draft is ahead of the draw tools so the click is never a stray vertex; the
 * second click of an in-place double-click is not a vertex; only a plain
 * select click on empty canvas clears the selection.
 */
function routeStageClick(
  intent: Extract<Intent, { kind: 'click-stage' }>,
  state: InteractionState,
): Action {
  if (state.clickSuppressed) return CONSUME
  if (state.placementArmed) return { type: 'place' }
  if (state.raidDraft) return { type: 'commit-raid' }
  if (state.tool === 'boundary' || state.tool === 'path')
    return intent.inPlacePair ? CONSUME : { type: 'add-draft-point' }
  if (state.tool === 'calibrate') return { type: 'set-calibrate-point' }
  if (intent.onEmpty && state.tool === 'select') return { type: 'clear-selection' }
  return CONSUME
}

/** The at-rest snapshot; callers spread the fields they know. */
export const IDLE_INTERACTION: InteractionState = {
  paletteOpen: false,
  settingsOpen: false,
  roeMenuOpen: false,
  locationDialogOpen: false,
  libraryOpen: false,
  placementArmed: false,
  tool: 'select',
  calibratePlaced: false,
  raidDraft: false,
  connectFrom: false,
  pathStarted: false,
  typing: false,
  clickSuppressed: false,
}

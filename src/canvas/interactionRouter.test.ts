import { describe, expect, it } from 'vitest'
import type { Tool } from '../state/store'
import { IDLE_INTERACTION, routeInteraction } from './interactionRouter'
import type { Action, InteractionState } from './interactionRouter'

const TOOLS: Tool[] = ['select', 'boundary', 'connect', 'path', 'cap', 'calibrate']
const state = (patch: Partial<InteractionState>): InteractionState => ({
  ...IDLE_INTERACTION,
  ...patch,
})
const escape = (patch: Partial<InteractionState>) =>
  routeInteraction({ kind: 'escape' }, state(patch)).type
const stage = (patch: Partial<InteractionState>, onEmpty = true, inPlacePair = false) =>
  routeInteraction({ kind: 'click-stage', onEmpty, inPlacePair }, state(patch))
const entity = (
  patch: Partial<InteractionState>,
  entityKind: 'uas' | 'sensor' = 'sensor',
  shiftKey = false,
) => routeInteraction({ kind: 'click-entity', entityKind, shiftKey }, state(patch))

describe('escape precedence', () => {
  // Each row adds one more open surface below the previous one; the higher one always wins.
  it.each<[string, Partial<InteractionState>, Action['type']]>([
    [
      'palette over everything',
      { paletteOpen: true, settingsOpen: true, locationDialogOpen: true, placementArmed: true },
      'continue',
    ],
    [
      'settings over the dialog',
      { settingsOpen: true, locationDialogOpen: true, placementArmed: true },
      'continue',
    ],
    [
      'location dialog over the placement',
      { locationDialogOpen: true, placementArmed: true, calibratePlaced: true },
      'close-location-dialog',
    ],
    [
      'location dialog while typing',
      { locationDialogOpen: true, typing: true },
      'close-location-dialog',
    ],
    [
      'roe menu leaves the placement armed',
      { roeMenuOpen: true, placementArmed: true },
      'continue',
    ],
    [
      'placement over calibration',
      { placementArmed: true, calibratePlaced: true, tool: 'calibrate' },
      'cancel-placement',
    ],
    ['placement while typing', { placementArmed: true, typing: true }, 'cancel-placement'],
    ['open drawer alone', { libraryOpen: true }, 'cancel-placement'],
    [
      'two-point calibration over the board',
      { tool: 'calibrate', calibratePlaced: true, raidDraft: true },
      'cancel-calibration',
    ],
    [
      'two-point calibration while typing',
      { tool: 'calibrate', calibratePlaced: true, typing: true },
      'cancel-calibration',
    ],
    ['one-point calibration is a board clear', { tool: 'calibrate' }, 'clear-board'],
    ['typing swallows the board clear', { typing: true }, 'continue'],
    ['idle board', {}, 'clear-board'],
  ])('%s', (_name, patch, expected) => {
    expect(escape(patch)).toBe(expected)
  })

  it('clears the board for every drawing tool and draft', () => {
    for (const tool of TOOLS) {
      expect(
        escape({
          tool,
          raidDraft: true,
          connectFrom: true,
          pathStarted: true,
          capCenterPlaced: true,
        }),
      ).toBe('clear-board')
    }
  })
})

describe('stage click precedence', () => {
  it('drops a marquee-paired click before anything else', () => {
    for (const tool of TOOLS) {
      expect(stage({ tool, clickSuppressed: true, placementArmed: true, raidDraft: true })).toEqual(
        { type: 'consume' },
      )
    }
  })

  it('an armed placement owns the click ahead of the raid draft and the tools', () => {
    for (const tool of TOOLS)
      expect(stage({ tool, placementArmed: true, raidDraft: true })).toEqual({ type: 'place' })
  })

  it('an armed raid draft commits ahead of every tool, on empty canvas or an entity', () => {
    for (const tool of TOOLS) {
      expect(stage({ tool, raidDraft: true })).toEqual({ type: 'commit-raid' })
      expect(stage({ tool, raidDraft: true }, false)).toEqual({ type: 'commit-raid' })
    }
  })

  it.each<[Tool, boolean, Action]>([
    ['boundary', false, { type: 'add-draft-point' }],
    ['boundary', true, { type: 'consume' }],
    ['path', false, { type: 'add-draft-point' }],
    ['path', true, { type: 'consume' }],
    ['calibrate', false, { type: 'set-calibrate-point' }],
    ['calibrate', true, { type: 'set-calibrate-point' }],
    ['connect', false, { type: 'consume' }],
    ['select', false, { type: 'clear-selection' }],
    ['select', true, { type: 'clear-selection' }],
  ])('%s tool, in-place pair %s', (tool, inPlacePair, expected) => {
    expect(stage({ tool }, true, inPlacePair)).toEqual(expected)
    // A bubbled entity click reaches the same tools; only select stops deselecting.
    expect(stage({ tool }, false, inPlacePair)).toEqual(
      tool === 'select' ? { type: 'consume' } : expected,
    )
  })

  it.each<[boolean, boolean, Action]>([
    [false, false, { type: 'add-draft-point' }],
    [false, true, { type: 'add-draft-point' }],
    [true, false, { type: 'finish-cap' }],
    // The second click of a double click on the center finishes with the default radius.
    [true, true, { type: 'finish-cap' }],
  ])('cap tool, center placed %s, in-place pair %s', (capCenterPlaced, inPlacePair, expected) => {
    expect(stage({ tool: 'cap', capCenterPlaced }, true, inPlacePair)).toEqual(expected)
    expect(stage({ tool: 'cap', capCenterPlaced }, false, inPlacePair)).toEqual(expected)
  })

  it('a click on a ring edge keeps the selection so the readout keeps its threat', () => {
    const onRing = (tool: Tool) =>
      routeInteraction(
        { kind: 'click-stage', onEmpty: true, inPlacePair: false, onRing: true },
        state({ tool }),
      )
    expect(onRing('select')).toEqual({ type: 'consume' })
    expect(onRing('path')).toEqual({ type: 'add-draft-point' })
  })
})

describe('entity click precedence', () => {
  it.each<[string, Partial<InteractionState>, 'uas' | 'sensor', Action]>([
    ['connect starts', { tool: 'connect' }, 'sensor', { type: 'begin-connect' }],
    [
      'connect completes',
      { tool: 'connect', connectFrom: true },
      'sensor',
      { type: 'complete-connect' },
    ],
    [
      'connect ignores the raid draft',
      { tool: 'connect', raidDraft: true },
      'sensor',
      { type: 'begin-connect' },
    ],
    ['path starts on a UAS', { tool: 'path' }, 'uas', { type: 'begin-path' }],
    ['path bubbles a non-UAS', { tool: 'path' }, 'sensor', { type: 'continue' }],
    [
      'path bubbles once drafting',
      { tool: 'path', pathStarted: true },
      'uas',
      { type: 'continue' },
    ],
    ['boundary bubbles', { tool: 'boundary' }, 'uas', { type: 'continue' }],
    ['cap bubbles a UAS', { tool: 'cap', pathStarted: true }, 'uas', { type: 'continue' }],
    [
      'cap bubbles once centered',
      { tool: 'cap', pathStarted: true, capCenterPlaced: true },
      'sensor',
      { type: 'continue' },
    ],
    ['calibrate bubbles', { tool: 'calibrate' }, 'uas', { type: 'continue' }],
    ['raid draft bubbles under select', { raidDraft: true }, 'uas', { type: 'continue' }],
    ['select picks the entity', {}, 'sensor', { type: 'select-entity', additive: false }],
  ])('%s', (_name, patch, kind, expected) => {
    expect(entity(patch, kind)).toEqual(expected)
  })

  it('shift adds to the selection only under select', () => {
    expect(entity({}, 'uas', true)).toEqual({ type: 'select-entity', additive: true })
    expect(entity({ tool: 'connect' }, 'uas', true)).toEqual({ type: 'begin-connect' })
  })
})

describe('drop, tool change and arming', () => {
  it('routes a drop by its payload, model first', () => {
    expect(
      routeInteraction({ kind: 'drop', modelId: 'm1', systemId: 's1' }, IDLE_INTERACTION),
    ).toEqual({ type: 'add-entity-from-model', modelId: 'm1' })
    expect(
      routeInteraction({ kind: 'drop', modelId: '', systemId: 's1' }, IDLE_INTERACTION),
    ).toEqual({ type: 'add-system-from-preset', systemId: 's1' })
    expect(
      routeInteraction(
        { kind: 'drop', modelId: '', systemId: '' },
        state({ placementArmed: true }),
      ),
    ).toEqual({ type: 'consume' })
  })

  it('a tool change disarms the placement in every state and arming is always a compound reset', () => {
    for (const tool of TOOLS) {
      expect(
        routeInteraction(
          { kind: 'tool-change' },
          state({ tool, placementArmed: true, raidDraft: true }),
        ),
      ).toEqual({ type: 'clear-placement' })
      expect(
        routeInteraction({ kind: 'arm-placement' }, state({ tool, connectFrom: true })),
      ).toEqual({ type: 'arm-placement' })
    }
  })
})

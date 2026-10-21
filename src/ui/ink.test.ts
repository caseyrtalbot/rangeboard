import { describe, expect, it } from 'vitest'
import type { Entity } from '../model/types'
import { AFFILIATION, BOARD_INK_DARK, BOARD_INK_PAPER, boardInk } from './ink'
import type { BoardInk } from './ink'

/** WCAG relative luminance. A copy of the helper in src/playback/trackState.test.ts. */
function luminance(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const r = channel(parseInt(hex.slice(1, 3), 16))
  const g = channel(parseInt(hex.slice(3, 5), 16))
  const b = channel(parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** The symbol inks: every field a frame, a line or a mark draws in. */
const SYMBOL_INKS: Array<keyof BoardInk> = [
  'hostile',
  'unknown',
  'friend',
  'neutral',
  'ew',
  'ghost',
  'destroyed',
  'noTrack',
  'warn',
]

/** --bg, .canvas-host.airspace and .canvas-host.sat in src/index.css, plus the board tone. */
const NIGHT_GROUNDS = ['#121313', '#16181a', '#131619', '#0e0f10']
const PAPER_BOARD = '#eeebe4'

function entity(kind: Entity['kind'], color: string | null = null): Entity {
  return { kind, color } as Entity
}

describe('symbol inks', () => {
  it('clear the 3:1 graphic floor on every night ground', () => {
    for (const key of SYMBOL_INKS) {
      for (const bg of NIGHT_GROUNDS) {
        expect(contrast(BOARD_INK_DARK[key], bg), `${key} on ${bg}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('clear the 3:1 graphic floor on the paper board', () => {
    for (const key of SYMBOL_INKS) {
      expect(contrast(BOARD_INK_PAPER[key], PAPER_BOARD), key).toBeGreaterThanOrEqual(3)
    }
  })

  it('strike the destroyed X in a value apart from the ghost frame in both themes', () => {
    expect(contrast(BOARD_INK_DARK.destroyed, BOARD_INK_DARK.ghost)).toBeGreaterThan(1.5)
    expect(contrast(BOARD_INK_PAPER.destroyed, BOARD_INK_PAPER.ghost)).toBeGreaterThan(1.5)
  })
})

describe('boardInk', () => {
  it('draws one hue per affiliation', () => {
    expect(AFFILIATION.sensor).toBe('friend')
    expect(AFFILIATION.uas).toBe('hostile')
    expect(AFFILIATION.marker).toBe('neutral')
    for (const ink of [BOARD_INK_DARK, BOARD_INK_PAPER]) {
      expect(boardInk(entity('sensor'), ink)).toBe(ink.friend)
      expect(boardInk(entity('effector'), ink)).toBe(ink.friend)
      expect(boardInk(entity('c2'), ink)).toBe(ink.friend)
      expect(boardInk(entity('asset'), ink)).toBe(ink.friend)
      expect(boardInk(entity('uas'), ink)).toBe(ink.hostile)
      expect(boardInk(entity('marker'), ink)).toBe(ink.neutral)
    }
  })

  it('lets an explicit entity colour win', () => {
    expect(boardInk(entity('sensor', '#123456'), BOARD_INK_DARK)).toBe('#123456')
  })
})

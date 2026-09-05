// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CHART_HUES, CHART_SLOT_TOKENS, TOKEN_FALLBACK, readTokens, resolveColor } from './tokens'

const HUES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']

describe('chart tokens', () => {
  it('holds the five validated hues in slot order', () => {
    expect([...CHART_HUES]).toEqual(HUES)
    expect(CHART_SLOT_TOKENS.map((t) => TOKEN_FALLBACK[t])).toEqual(HUES)
  })

  it('matches the --chart-N declarations in index.css', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    for (let n = 1; n <= 5; n++) {
      const m = css.match(new RegExp(`--chart-${n}:\\s*(#[0-9a-f]{6})`, 'i'))
      expect(m, `--chart-${n} declared`).not.toBeNull()
      expect(m![1].toLowerCase()).toBe(CHART_HUES[n - 1])
    }
  })

  it('resolves colors without a document', () => {
    expect(typeof document).toBe('undefined')
    expect(resolveColor('#abc')).toBe('#abc')
    expect(resolveColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)')
    expect(resolveColor('chart-2')).toBe('#d95926')
    expect(resolveColor('no-such-token')).toBe('no-such-token')
  })

  it('reads the fallback set in node', () => {
    const t = readTokens()
    expect(t.color('chart-1')).toBe('#3987e5')
    expect(t.color('accent')).toBe('#a9b4bd')
    expect(t.color('danger')).toBe('#c96458')
    expect(t.ink).toBe(TOKEN_FALLBACK['text-dim'])
    expect(t.surface).toBe('#171a1d')
    expect(t.grid).toBe('rgba(255,255,255,.07)')
    expect(t.fontMono).toContain('JetBrains Mono')
    expect(t.fontUi).toContain('Archivo')
    expect(resolveColor('ew', t)).toBe('#7da7c4')
  })
})

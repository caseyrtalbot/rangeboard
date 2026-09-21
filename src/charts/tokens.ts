/**
 * Chart kit tokens. The kit draws every color from the CSS custom properties in
 * `src/index.css`. A series names its color by token or by a literal hex, and the
 * frame resolves the tokens once per render through `readTokens()`. Without a
 * `document` every lookup answers from `TOKEN_FALLBACK`. Per-track series take the
 * five chart hues in first-detection order and keep that slot under filters; the
 * sixth track and beyond fold into `OTHER_TOKEN`.
 */

/** The five categorical chart hues, in slot order. Fixed values. */
export const CHART_HUES: readonly string[] = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']

/** Token names for the five chart hue slots. */
export const CHART_SLOT_TOKENS: readonly string[] = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
]

/** The fold color for tracks beyond slot 5. */
export const OTHER_TOKEN = 'text-dim'

/** Grid hairline, the mockup value. Same alpha as `--border-subtle` rounded. */
const GRID = 'rgba(255,255,255,.07)'

/** The panel surface, `--surface-panel`. The endpoint dot strokes with it. */
const SURFACE = '#171a1d'

const FONT_MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const FONT_UI = "'Archivo', system-ui, sans-serif"

/**
 * Resolved values of the `index.css` tokens the kit reads. `--text-dim` is an alpha ramp
 * value in the sheet, so its fallback is the rgba string, not a hex.
 */
export const TOKEN_FALLBACK: Readonly<Record<string, string>> = {
  'chart-1': CHART_HUES[0],
  'chart-2': CHART_HUES[1],
  'chart-3': CHART_HUES[2],
  'chart-4': CHART_HUES[3],
  'chart-5': CHART_HUES[4],
  accent: '#a9b4bd',
  ew: '#7da7c4',
  danger: '#c96458',
  good: '#8fae7a',
  warn: '#d98f41',
  text: 'rgba(255, 255, 255, 0.91)',
  'text-dim': 'rgba(255, 255, 255, 0.61)',
  'surface-panel': SURFACE,
}

/** The token set one chart render reads. */
export interface ChartTokens {
  color(name: string): string
  fontMono: string
  fontUi: string
  grid: string
  ink: string
  surface: string
}

/**
 * Read the kit tokens with one `getComputedStyle(document.documentElement)` call.
 * Call it once per chart render, never per point and never at module load.
 */
export function readTokens(): ChartTokens {
  const style = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement)
  const cache = new Map<string, string>()
  const read = (name: string): string => {
    const hit = cache.get(name)
    if (hit !== undefined) return hit
    const sheet = style ? style.getPropertyValue(`--${name}`).trim() : ''
    const value = sheet || TOKEN_FALLBACK[name] || name
    cache.set(name, value)
    return value
  }
  const font = (name: string, fallback: string): string => {
    const sheet = style ? style.getPropertyValue(`--${name}`).trim() : ''
    return sheet || fallback
  }
  return {
    color: read,
    fontMono: font('font-mono', FONT_MONO),
    fontUi: font('font-ui', FONT_UI),
    grid: GRID,
    ink: read('text-dim'),
    surface: read('surface-panel'),
  }
}

/**
 * Resolve a series color. A literal (`#hex`, `rgb(...)`) passes through; a token name reads
 * `tokens.color`, else `TOKEN_FALLBACK`, else the name itself.
 */
export function resolveColor(name: string, tokens?: ChartTokens): string {
  if (name.startsWith('#') || name.startsWith('rgb')) return name
  if (tokens) return tokens.color(name)
  return TOKEN_FALLBACK[name] ?? name
}

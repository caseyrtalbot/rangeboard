import { useSyncExternalStore } from 'react'
import { useStore } from '../state/store'
import type { BoardInk } from '../ui/ink'
import { BOARD_INK_DARK, BOARD_INK_PAPER } from '../ui/ink'

const LIGHT_QUERY = '(prefers-color-scheme: light)'

function lightMedia(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(LIGHT_QUERY)
    : null
}

function subscribe(onChange: () => void): () => void {
  const media = lightMedia()
  if (!media) return () => {}
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function osPrefersLight(): boolean {
  return lightMedia()?.matches ?? false
}

/**
 * The board ink for the theme on screen. It resolves `ui.theme` the way index.css
 * does: `system` follows `prefers-color-scheme`, and an environment without
 * `matchMedia` reads as dark, like the sheet's own default.
 */
export function useBoardInk(): BoardInk {
  const theme = useStore((s) => s.ui.theme)
  const osLight = useSyncExternalStore(subscribe, osPrefersLight, () => false)
  const light = theme === 'light' || (theme === 'system' && osLight)
  return light ? BOARD_INK_PAPER : BOARD_INK_DARK
}

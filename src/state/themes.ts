import type { Theme } from './store'

/** The theme choices the Toolbar (Ops) and the View menu (Board) both offer. */
export const THEMES: Array<{ v: Theme; label: string }> = [
  { v: 'system', label: 'System' },
  { v: 'dark', label: 'Dark' },
  { v: 'light', label: 'Light' },
]

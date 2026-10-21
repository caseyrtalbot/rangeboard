import type { Boundary, PhaseLineDesignation } from './types'

/** Every designation with its long name, in the order the pickers show them. */
export const PHASE_LINE_DESIGNATIONS: ReadonlyArray<{
  id: PhaseLineDesignation
  name: string
}> = [
  { id: 'PL', name: 'Phase line' },
  { id: 'FLOT', name: 'Forward line of own troops' },
  { id: 'FEBA', name: 'Forward edge of the battle area' },
  { id: 'FSCL', name: 'Fire support coordination line' },
  { id: 'CFL', name: 'Coordinated fire line' },
]

/** The board and picker label: the designation, then the name when one is set. */
export function phaseLineLabel(b: Boundary): string {
  const designation = b.designation ?? 'PL'
  const name = b.name.trim()
  return name ? `${designation} ${name}` : designation
}

/** The phase lines of a boundary list, in board order. */
export function phaseLines(boundaries: Boundary[]): Boundary[] {
  return boundaries.filter((b) => b.type === 'phase-line')
}

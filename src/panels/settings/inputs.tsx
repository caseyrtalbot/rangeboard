/**
 * Commit-on-blur number inputs and the sensitivity-depth copy that the Run tab and
 * the Fragility screen share.
 */

import type { SensitivityDepth } from '../../model/types'

/**
 * An integer input that commits on blur or Enter, so typing a seed digit by
 * digit is one scenario edit, not one undo entry and one run reset per key.
 * The `key` remounts the uncontrolled input when the committed value changes.
 */
export function IntInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number
  min?: number
  max?: number
  onCommit: (v: number) => void
}) {
  const commit = (raw: string) => {
    const n = Math.round(Number(raw))
    if (raw === '' || !Number.isFinite(n)) return
    const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n))
    if (clamped !== value) onCommit(clamped)
  }
  return (
    <input
      key={value}
      type="number"
      step={1}
      min={min}
      max={max}
      defaultValue={value}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit((event.target as HTMLInputElement).value)
      }}
    />
  )
}

/**
 * A decimal input that commits on blur or Enter, as `IntInput`. Bounds are
 * exclusive: a value at or outside them is ignored. An empty field commits null
 * while `nullable`, which is how the half-width rule is cleared.
 */
export function DecimalInput({
  value,
  min = 0,
  max,
  nullable = true,
  onCommit,
}: {
  value: number | null
  min?: number
  max?: number
  nullable?: boolean
  onCommit: (v: number | null) => void
}) {
  const commit = (raw: string) => {
    if (raw.trim() === '') {
      if (nullable && value != null) onCommit(null)
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= min || (max != null && n >= max)) return
    if (n !== value) onCommit(n)
  }
  return (
    <input
      key={value ?? 'none'}
      type="number"
      step="any"
      min={min}
      max={max}
      defaultValue={value ?? ''}
      placeholder={nullable ? 'None' : undefined}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit((event.target as HTMLInputElement).value)
      }}
    />
  )
}

/** The depth as the Run tab names it, for a label or a chip. */
export const SENSITIVITY_DEPTH_NAME: Record<SensitivityDepth, string> = {
  full: 'Morris then Sobol',
  quick: 'one-at-a-time',
}

/** What the depth does, in one sentence. The Fragility screen prints it above its run button. */
export const SENSITIVITY_DEPTH_SENTENCE: Record<SensitivityDepth, string> = {
  full: 'Morris screening, then Sobol indices on the fields it keeps',
  quick: 'One-at-a-time at p10 and p90',
}

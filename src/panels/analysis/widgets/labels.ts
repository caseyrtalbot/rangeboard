/**
 * Analysis widget names.
 *
 * The three survival words and the KPI tile names are written once here, so
 * the tiles, the threat picture, the projection and the gates cannot drift.
 */

import type { KpiKey } from '../../../state/analysisLayout'

/** The outcome words: the tile, the per-track line and the effect gate. */
export const SURVIVAL_LABELS = {
  leakers: 'Leakers',
  survives: 'Survives',
  limit: 'Survival limit',
} as const

/** Tile label and the one-sentence hover hint of every KPI key. */
export const KPI_LABELS: Record<KpiKey, { label: string; hint: string }> = {
  detect: { label: 'Detect', hint: 'Threats first detected by the cursor time.' },
  trackNow: {
    label: 'Track now',
    hint: 'Threats held by one or more enabled sensors at the cursor time.',
  },
  idClass: { label: 'ID / class', hint: 'Threats promoted to hostile by the classification ladder.' },
  targetNow: {
    label: 'Target now',
    hint: 'Threats inside a usable ROE-gated effector window now, ghost tracks excluded.',
  },
  engaged: { label: 'Engaged', hint: 'Threats with at least one salvo of any channel assigned by now.' },
  salvos: {
    label: 'Salvos',
    hint: 'Salvos by cost: kinetic rounds, then d for directed-energy bursts, then j for EW salvos.',
  },
  killEk: {
    label: 'Expected kills',
    hint: 'Expected kill mass that landed at or before the threat reached the defended asset.',
  },
  lateEk: {
    label: 'Expected late kills',
    hint: 'Expected kill mass that landed after the threat was over the asset. Does not protect the asset.',
  },
  leakEn: {
    label: 'Leak E[n]',
    hint: 'Expected ship mass that reached the defended asset. Expected late kills never reduce it.',
  },
  firstDetect: { label: 'First detect', hint: 'The earliest first detection over every track.' },
  firstEffect: { label: 'First effect', hint: 'The first effect that removed expected kill mass.' },
  detectToEffect: {
    label: 'Detect to effect',
    hint: 'The time from the first detection to the first effect.',
  },
  minWarning: {
    label: 'Min warning',
    hint: 'The shortest warning time: arrival minus first detection, over every track.',
  },
}

export function forecastKillLabel(hasActiveAsset: boolean): string {
  return hasActiveAsset ? KPI_LABELS.killEk.label : 'Expected neutralization'
}

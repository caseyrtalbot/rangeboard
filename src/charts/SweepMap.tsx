import { Fragment } from 'react'
import { DT } from '../playback/clock'
import type { SensitivityResponse, SweepCell } from '../playback/mcRun'
import type { SweepFactor, SweepFactorId } from '../playback/sweepFactors'
import { SWEEP_ENVIRONMENT_PRESETS, SWEEP_VALUES_MAX, SWEEP_VALUES_MIN } from '../playback/sweepFactors'
import { bandMean, countSub, formatCount, statMean, timeStatSub } from '../panels/analysis/mc'

export const SWEEP_FACTOR_LABELS: Record<SweepFactorId, string> = {
  threatAltitudeFt: 'Threat altitude (ft AGL)',
  threatSpeedMps: 'Threat speed (m/s)',
  approachAzimuthDeg: 'Approach azimuth (° true)',
  raidSize: 'Raid size (entities in first wave)',
  environmentPreset: 'Environment preset',
}
export const SWEEP_RESPONSE_LABELS: Record<SensitivityResponse, string> = {
  leakers: 'Leakers (members)', kills: 'Kills (members)', firstDetectS: 'First detect (s)',
  minWarningS: 'Min warning (s)', salvos: 'Salvos (count)',
}

export function sweepGridValid(factors: SweepFactor[]): boolean {
  return factors.length >= 1 && factors.length <= 2
    && new Set(factors.map(f => f.id)).size === factors.length
    && factors.every(f => f.values.length >= SWEEP_VALUES_MIN && f.values.length <= SWEEP_VALUES_MAX)
    && factors.reduce((n, f) => n * f.values.length, 1) <= 36
}

function responseValue(cell: SweepCell, response: SensitivityResponse): number | null {
  const s = cell.summary
  if (response === 'kills' || response === 'leakers') {
    const band = s[response]
    return bandMean(band, band.mean.length - 1, s.replicates)
  }
  if (response === 'salvos') {
    const values = Object.values(s.perEffector).map(e => statMean(e.salvos))
    return s.replicates > 0 && values.every(v => v != null) ? values.reduce<number>((sum, v) => sum + v!, 0) : null
  }
  return statMean(s[response])
}

const axisValue = (value: string | number) => typeof value === 'number' ? `${value}`
  : SWEEP_ENVIRONMENT_PRESETS.find(p => p.id === value)?.label ?? value

/** Relative thirds describe this grid's range, never a requirement pass/fail. */
export function SweepMap({ factors, cells, response, replicatesPerCell, progress = 0, durationS, hasAsset = true }: {
  factors: SweepFactor[]
  cells: SweepCell[]
  response: SensitivityResponse
  replicatesPerCell: number
  progress?: number
  durationS: number
  hasAsset?: boolean
}) {
  if (!sweepGridValid(factors)) return <p role="alert">Choose one or two different factors, 2–6 values each, at most 36 cells.</p>
  const [x, y] = factors
  const rows = y?.values ?? ['Full run']
  const resultAt = (i: number, j: number) => cells.find(c => c.index.length === factors.length && c.index[0] === i && (!y || c.index[1] === j))
  const displayed = x.values.flatMap((_, i) => rows.map((_, j) => resultAt(i, j))).filter((c): c is SweepCell => c != null)
  const valueOf = (cell: SweepCell) => !hasAsset && (response === 'leakers' || response === 'minWarningS') ? null : responseValue(cell, response)
  const values = displayed.map(valueOf).filter((v): v is number => v != null)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const step = (high - low) / 3
  const higherBetter = response === 'kills' || response === 'minWarningS'
  const tones = higherBetter ? ['critical', 'warning', 'nominal'] : ['nominal', 'warning', 'critical']
  return (
    <figure style={{ margin: 0 }} aria-label={`Sweep map · ${SWEEP_RESPONSE_LABELS[response]}`}>
      <figcaption className="muted small">
        Each cell’s full run (horizon on cell) · MC mean per replicate · {replicatesPerCell} replicates per cell.
        {' '}Relative range, not requirement thresholds: {values.length === 0 ? 'no values yet'
          : low === high ? `all ${formatCount(low)} (middle step)`
            : `${tones[0]} ${formatCount(low)} to <${formatCount(low + step)}; warning ${formatCount(low + step)} to <${formatCount(high - step)}; ${tones[2]} ${formatCount(high - step)} to ${formatCount(high)}`}.
        {!hasAsset && (response === 'leakers' || response === 'minWarningS') && ' No defended asset; response unavailable.'}
        {' '}— unavailable or pending; ✓ completed, values pending.
      </figcaption>
      <p className="small">Columns: {SWEEP_FACTOR_LABELS[x.id]}{y && <> · Rows: {SWEEP_FACTOR_LABELS[y.id]}</>}</p>
      <div style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) repeat(${x.values.length}, minmax(0, 1fr))`, gap: 'var(--space-1)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-dense-size)' }}>
        <span />{x.values.map((v, i) => <span key={i} style={{ overflowWrap: 'anywhere' }}>{axisValue(v)}</span>)}
        {rows.map((v, j) => <Fragment key={j}>
          <span style={{ overflowWrap: 'anywhere' }}>{axisValue(v)}</span>
          {x.values.map((_, i) => {
            const cell = resultAt(i, j)
            const value = cell ? valueOf(cell) : null
            const completed = i * rows.length + j < progress
            const tone = value == null ? null : tones[low === high ? 1 : Math.min(2, Math.floor((value - low) / step))]
            const detail = cell && (response === 'firstDetectS' || response === 'minWarningS')
              ? timeStatSub(cell.summary[response], response === 'firstDetectS' ? 'detected' : 'warning')
              : cell && (response === 'kills' || response === 'leakers') ? countSub(cell.summary[response], cell.summary[response].mean.length - 1, cell.summary.replicates) : ''
            const cellDuration = cell ? (cell.summary.kills.mean.length - 1) * DT : durationS
            return <span key={i} data-sweep-cell={`${i},${j}`} data-tone={tone ?? (completed ? 'complete' : 'pending')}
              title={`${axisValue(x.values[i])}${y ? ` / ${axisValue(v)}` : ''} · ${SWEEP_RESPONSE_LABELS[response]} · ${cell?.summary.replicates ?? replicatesPerCell} replicates · full run ${cellDuration} s${detail ? ` · ${detail}` : ''}`}
              style={{ padding: 'var(--space-1)', textAlign: 'center', overflowWrap: 'anywhere', background: tone ? `var(--status-${tone})` : undefined, color: tone ? 'var(--ink)' : completed ? 'var(--status-nominal)' : 'var(--text-secondary)' }}>
              {value == null ? cell ? '—' : completed ? '✓' : '—' : formatCount(value)}
            </span>
          })}
        </Fragment>)}
      </div>
    </figure>
  )
}

/** One plotted series, sampled on the engine DT grid. */
export interface Series {
  id: string
  label: string
  unit: string | null
  /** Sampled at DT from t = 0. Index i is t = i * DT. NaN where undefined. */
  values: number[]
  /** Token name ('chart-1', 'accent', 'danger', 'ew', 'text-dim') or a hex. */
  color: string
  kind: 'line' | 'step'
  /** Monte Carlo bands, same length as values, when present. [low, high]. */
  band80?: [number[], number[]]
  band95?: [number[], number[]]
}

/** A vertical mark on the time axis: arrival, first shot, a gate time. */
export interface ChartMark {
  tS: number
  label: string
  color: string
}

/** One filled interval on a ladder row. */
export interface LadderSpan {
  startS: number
  endS: number
  color: string
  label?: string
}

/** One ladder row: a label in the gutter and its spans. */
export interface LadderRow {
  id: string
  label: string
  spans: LadderSpan[]
}

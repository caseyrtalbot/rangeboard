import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'
import { readTokens, resolveColor, type ChartTokens } from './tokens'

const ChartTokensContext = createContext<ChartTokens | null>(null)

/** The tokens of the enclosing `ChartFrame`. Outside a frame, one fresh read. */
export function useChartTokens(): ChartTokens {
  const ctx = useContext(ChartTokensContext)
  return useMemo(() => ctx ?? readTokens(), [ctx])
}

/** One legend entry: the series label beside its swatch. */
interface ChartLegendItem {
  /** Series id; the React key, because two tracks can share a name. */
  id: string
  label: string
  color: string
}

interface ChartFrameProps {
  /** Explicit plot width in px. Absent = fill the container width. */
  width?: number
  height: number
  /** Axis title, the unit only. */
  yLabel?: string | null
  legend?: ChartLegendItem[]
  children: ReactNode
}

/**
 * The shared chart shell: reads the tokens once, sizes the plot, draws the axis title
 * above and the legend under it. With `width` the plot is a fixed pixel box; without it
 * the plot sits in a Recharts `ResponsiveContainer` at 100 percent width.
 */
export function ChartFrame({ width, height, yLabel, legend, children }: ChartFrameProps) {
  const tokens = useMemo(() => readTokens(), [])
  return (
    <ChartTokensContext.Provider value={tokens}>
      <div className="chart" style={width != null ? { width } : undefined}>
        {yLabel ? <div className="chart-ylabel">{yLabel}</div> : null}
        <div className="chart-plot" style={{ height }}>
          {width != null ? (
            children
          ) : (
            <ResponsiveContainer width="100%" height={height}>
              {children}
            </ResponsiveContainer>
          )}
        </div>
        {legend && legend.length > 0 ? (
          <div className="chart-legend">
            {legend.map((l) => (
              <span key={l.id}>
                <i style={{ background: resolveColor(l.color, tokens) }} />
                {l.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </ChartTokensContext.Provider>
  )
}

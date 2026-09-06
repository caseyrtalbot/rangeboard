import { useMemo } from 'react'
import type { TornadoRow } from '../../../charts/Tornado'
import { Tornado } from '../../../charts/Tornado'
import { uncertainFields } from '../../../analysis/uncertainty'
import { entityActive, runSettings } from '../../../model/types'
import { useStore } from '../../../state/store'
import { PfTag } from '../../inspector/kit'
import { State } from '../../../ui/kit'
import { currentSensitivity, formatCount } from './mc'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

/**
 * One-at-a-time sensitivity on the end-of-run leaker mean: one bar per
 * uncertain field from its p10 run to its p90 run, the nominal run as the rule.
 * The rows come from the worker, sorted by swing, so the widget only draws.
 */
export function SensitivityWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  void params
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const mc = useStore((s) => s.mc)
  const sensitivity = mc.sensitivity
  const start = useStore((s) => s.runSensitivity)
  const run = runSettings(scenario)
  const fields = useMemo(() => uncertainFields(scenario), [scenario])
  const hasAsset = scenario.entities.some((entity) => entity.kind === 'asset' && entityActive(entity))
  const summary = hasAsset ? currentSensitivity(mc, runId) : null
  const library = scenario.library
  const rows: TornadoRow[] = useMemo(
    () =>
      (summary?.rows ?? []).map((row) => ({
        id: `${row.modelId}:${row.field}`,
        label: row.field,
        low: row.low,
        high: row.high,
        // A connection latency and the doctrine dwell carry no model, so they read PF.
        tag: <PfTag model={library.find((m) => m.id === row.modelId)} field={row.field} />,
      })),
    [summary, library],
  )
  const meta =
    summary != null ? `leakers · ${summary.replicates} reps · seed ${summary.seed}` : 'leakers'

  return (
    <WidgetFrame
      id={id}
      type="sensitivity"
      title="Sensitivity"
      meta={meta}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {run.runMode === 'deterministic' ? (
        <p className="muted small">Sensitivity needs the Monte Carlo run mode.</p>
      ) : !hasAsset ? (
        <p className="muted small">Leakers unavailable: no defended asset. Sensitivity requires a defended asset.</p>
      ) : fields.length === 0 ? (
        <p className="muted small">No field carries a spread.</p>
      ) : sensitivity.status === 'running' ? (
        <p className="muted small">
          {sensitivity.progress} of {sensitivity.total} fields
        </p>
      ) : summary != null ? (
        <>
          <p className="muted small">Full-run MC mean leakers (ships). One parameter at p10/p90, all others nominal; paired replicates. Endpoints are parameter perturbations, not uncertainty intervals. SE is the paired standard error of the swing.</p>
          <Tornado rows={rows} nominal={summary.nominal} unit="ships" />
          <table className="tb">
            <thead>
              <tr>
                <th>Model</th>
                <th>Field</th>
                <th>At parameter p10</th>
                <th>At parameter p90</th>
                <th>Swing</th>
                <th>SE</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={`${row.modelId}:${row.field}`}>
                  <td>{row.label}</td>
                  <td className="mono">{row.field}</td>
                  <td>{formatCount(row.low)}</td>
                  <td>{formatCount(row.high)}</td>
                  <td>{formatCount(row.swing)}</td>
                  <td>{row.se.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="mc-run" onClick={() => start()}>
            Run again
          </button>
        </>
      ) : (
        <>
          {sensitivity.status === 'stale' ? <State tone="warning">STALE</State> : null}
          <button className="mc-run" onClick={() => start()}>
            Run sensitivity
          </button>
          {sensitivity.error != null ? (
            <p className="muted small">{sensitivity.error}</p>
          ) : null}
        </>
      )}
    </WidgetFrame>
  )
}

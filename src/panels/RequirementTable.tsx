/**
 * The requirement gate table on Prepare, Inputs (D5): gate, pass-line label, box
 * and forecast met on the panel's four columns, so the boxes align with the Run
 * and Environment boxes above. Rows follow the kill chain.
 */

import { useState } from 'react'
import type {
  RequirementGate,
  RequirementGateId,
  RequirementGateReport,
} from '../analysis/requirements'
import type { RequirementThresholds } from '../model/types'
import { useStore } from '../state/store'
import { State } from '../ui/kit'
import type { StateTone } from '../ui/kit'
import { ThresholdInput } from './analysis/RequirementSettings'

type ThresholdField = keyof RequirementThresholds

/** The pass lines each gate tests; a gate without one shows a dash. */
const PASS_LINES: Record<
  RequirementGateId,
  Array<{ field: ThresholdField; q: string; title: string; unit?: string }>
> = {
  detect: [
    {
      field: 'pdDetect',
      q: 'Pd ≥',
      title:
        'Detect: single-scan Pd. A radar contact counts as DETECT when its single-scan Pd reaches this value',
    },
    {
      field: 'minWarningS',
      q: 'warn ≥',
      unit: 's',
      title: 'Detect: min warning. Blank = no minimum',
    },
  ],
  track: [{ field: 'pdTrackCumulative', q: 'cum. Pd ≥', title: 'Track: cumulative Pd' }],
  identify: [],
  target: [],
  engage: [],
  effect: [
    { field: 'maxResidualPerTrack', q: 'residual ≤', title: 'Effect: max residual per track' },
  ],
}

/** DETECT and EFFECT carry their forecast metric under the gate name. */
const SUB_LINE: ReadonlySet<RequirementGateId> = new Set(['detect', 'effect'])

const STATUS_TONE: Record<RequirementGate['status'], StateTone> = {
  pass: 'nominal',
  fail: 'critical',
  'not-evaluated': 'inactive',
}

/** Met in the tone of the status; not-evaluated reads a hollow N/E with its reason. */
function Met({ gate }: { gate: RequirementGate }) {
  if (gate.status === 'not-evaluated')
    return (
      <State tone="inactive" hollow title={gate.notEvaluatedReason ?? 'Not evaluated'}>
        N/E
      </State>
    )
  const text = `${gate.met}/${gate.required}`
  return (
    <State tone={STATUS_TONE[gate.status]} title={`${gate.label}: ${text} met · ${gate.metric}`}>
      {text}
    </State>
  )
}

function GateRow({
  gate,
  open,
  onToggle,
}: {
  gate: RequirementGate
  open: boolean
  onToggle: () => void
}) {
  const lines = PASS_LINES[gate.id]
  const blocking = gate.status === 'fail' && gate.failures.length > 0
  const failId = `gate-${gate.id}-blocking`
  return (
    <>
      <div className={`gt-r${blocking ? ' fail' : ''}`} role="row">
        <span className="gt-g" role="cell" title={`${gate.label}: ${gate.detail}`}>
          {gate.label.toUpperCase()}
          {SUB_LINE.has(gate.id) && <small>{gate.metric}</small>}
        </span>
        <span className="gt-thr" role="cell">
          {lines.length === 0 ? (
            <span className="gt-tl">
              <span className="gt-q" />
              <span className="gt-none" title="No pass line for this gate">
                —
              </span>
            </span>
          ) : (
            lines.map((line) => {
              const id = `gate-${gate.id}-${line.field}`
              return (
                <span className="gt-tl" key={line.field}>
                  <label className="gt-q" htmlFor={id} title={line.title}>
                    {line.q}
                  </label>
                  {line.unit ? (
                    <span className="nu-row">
                      <ThresholdInput field={line.field} id={id} />
                      <span className="nu-unit">{line.unit}</span>
                    </span>
                  ) : (
                    <ThresholdInput field={line.field} id={id} />
                  )}
                </span>
              )
            })
          )}
        </span>
        <span className="gt-met" role="cell">
          {blocking ? (
            <button
              type="button"
              className="gt-toggle"
              aria-expanded={open}
              aria-controls={failId}
              title="Show blocking tracks"
              onClick={onToggle}
            >
              <Met gate={gate} />
            </button>
          ) : (
            <Met gate={gate} />
          )}
        </span>
      </div>
      {blocking && open && (
        <div className="gt-fail" id={failId} role="row">
          <span className="gt-fail-cell" role="cell">
            <span className="gt-fail-l">Blocking</span>
            {gate.failures.map((failure) => (
              <button
                key={failure.uasId}
                type="button"
                className="mini"
                title={`${failure.name}: ${failure.reason}`}
                onClick={() =>
                  useStore.getState().select({ entityIds: [failure.uasId] }, false, 'panel')
                }
              >
                {failure.name} <span className="gt-why">{failure.reason}</span>
              </button>
            ))}
          </span>
        </div>
      )}
    </>
  )
}

/** The six forecast gates with their pass-line boxes; a failed gate opens its blocking tracks. */
export function RequirementTable({ report }: { report: RequirementGateReport }) {
  const [openGate, setOpenGate] = useState<RequirementGateId | null>(null)
  return (
    <div className="gtable" role="table" aria-label="Requirement gates">
      <div className="gt-h" role="row">
        <span role="columnheader">Gate</span>
        <span className="gt-thr" role="columnheader">
          Pass line
        </span>
        <span className="gt-met" role="columnheader">
          Met
        </span>
      </div>
      {report.gates.map((gate) => (
        <GateRow
          key={gate.id}
          gate={gate}
          open={openGate === gate.id}
          onToggle={() => setOpenGate(openGate === gate.id ? null : gate.id)}
        />
      ))}
    </div>
  )
}

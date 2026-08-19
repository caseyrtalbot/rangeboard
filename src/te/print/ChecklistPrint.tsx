/**
 * One checklist instance as a print artifact. Unchecked items keep an empty
 * tick box for paper use; completed items show their state and completer.
 */

import type { TeChecklist } from '../model/types'
import { PRow, PSection } from './PrintOverlay'

export function ChecklistPrint({ checklist }: { checklist: TeChecklist }) {
  return (
    <article className="p-doc">
      <div className="p-ribbon">
        <span>
          <b>CHECKLIST</b> {checklist.id}
        </span>
        <span>Phase: {checklist.phase.toUpperCase()}</span>
        <span>Runner: {checklist.runner}</span>
      </div>
      <h2>{checklist.name}</h2>

      <PSection n={1} title="Header">
        <PRow label="Name" value={checklist.name} />
        <PRow label="Phase" value={checklist.phase} />
        <PRow label="Runner" value={checklist.runner} />
        <PRow label="Started" value={checklist.startedAt} />
        <PRow label="Completed" value={checklist.completedAt ?? 'not completed'} />
        <PRow label="Run" value={checklist.runId ?? ''} />
        <PRow label="Day" value={checklist.dayDate} />
      </PSection>

      <PSection n={2} title="Items">
        <table className="p-table">
          <thead>
            <tr>
              <th style={{ width: '5em' }}>State</th>
              <th>Item</th>
              <th>Value</th>
              <th>Completer</th>
              <th style={{ width: '11em' }}>Time</th>
              <th>N/A reason</th>
            </tr>
          </thead>
          <tbody>
            {checklist.items.map((it, i) => (
              <tr key={i}>
                {it.state === 'unchecked' ? (
                  <td className="p-tick" />
                ) : (
                  <td>{it.state === 'na' ? 'N/A' : 'checked'}</td>
                )}
                <td>{it.text}</td>
                <td>{it.value}</td>
                <td>{it.completer}</td>
                <td>{it.at ?? ''}</td>
                <td>{it.naReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PSection>

      {(checklist.outcome !== null || checklist.conditionalLimits !== '') && (
        <PSection n={3} title="Outcome">
          <PRow label="Outcome" value={checklist.outcome ?? ''} />
          <PRow label="Conditional limits" value={checklist.conditionalLimits} />
        </PSection>
      )}
    </article>
  )
}

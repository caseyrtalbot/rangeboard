/**
 * Guided debrief print artifact (MASTER-FORMS 3.7). Questions render as rows;
 * unanswered questions leave a blank line for handwriting.
 */

import type { TeCampaign, TeDebrief } from '../model/types'
import { PBlank, PRow, PSection } from './PrintOverlay'

const KIND_LABELS: Record<TeDebrief['kind'], string> = {
  immediate: 'Immediate factual debrief',
  daily: 'Daily debrief',
  aar: 'After-action review',
}

export function DebriefPrint({ campaign, debrief }: { campaign: TeCampaign; debrief: TeDebrief }) {
  return (
    <article className="p-doc">
      <div className="p-ribbon">
        <span>
          <b>DEBRIEF</b> {debrief.id}
        </span>
        <span>Kind: {debrief.kind.toUpperCase()}</span>
        <span>Date: {debrief.date}</span>
        <span>Run: {debrief.runId ?? 'not run-specific'}</span>
      </div>
      <h2>{KIND_LABELS[debrief.kind]}</h2>
      {campaign.illustrative && <p className="p-illustrative">ILLUSTRATIVE: every value is notional.</p>}

      {debrief.answers.map((a, i) =>
        a.answer ? (
          <PRow key={i} label={a.question} value={a.answer} />
        ) : (
          <PBlank key={i} label={a.question} />
        ),
      )}

      {debrief.improvements.length > 0 && (
        <PSection title="Improvements">
          <table className="p-table">
            <thead>
              <tr>
                <th>Improvement</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Destination</th>
              </tr>
            </thead>
            <tbody>
              {debrief.improvements.map((imp) => (
                <tr key={imp.id}>
                  <td>{imp.text}</td>
                  <td>{imp.owner}</td>
                  <td>{imp.dueDate}</td>
                  <td>{imp.destination}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PSection>
      )}

      <p className="p-note">
        Draw out the learning point: what does this change about the next event?
      </p>
    </article>
  )
}

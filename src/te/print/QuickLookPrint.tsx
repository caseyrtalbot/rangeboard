/**
 * Post-run quick look (MASTER-FORMS 3.10-A). Auto-report within minutes:
 * identifiers, configuration match, event-derived times, per-measure quick
 * values, prediction comparison, and the six-option next-run recommendation.
 */

import type { TeCampaign, TeRun } from '../model/types'
import { eventTimeS } from '../calc/timeline'
import { displayId } from '../model/ids'
import { PRow, PSection } from './PrintOverlay'

const NEXT_RUN_OPTIONS = [
  'Accept the run for later review',
  'Repeat the run',
  'Continue to the next condition',
  'Hold for missing data',
  'Add a diagnostic run',
  'Stop, sufficient coverage exists',
]

export function QuickLookPrint({ campaign, run }: { campaign: TeCampaign; run: TeRun }) {
  const card = campaign.cards.find((c) => c.id === run.cardId)
  const cardLabel = card ? displayId(card.cardCode, run.cardVersion) : run.cardId
  const plannedConfig = card?.configId ?? null
  const actualConfig = run.actualConfigId
  const configMatch =
    plannedConfig === null || actualConfig === null
      ? 'NOT CONFIRMED'
      : plannedConfig === actualConfig
        ? 'MATCH'
        : 'MISMATCH'
  const eventTimes = (card?.eventMarks ?? [])
    .map((mark) => ({ mark, seconds: eventTimeS(run, mark) }))
    .filter((row) => row.seconds !== null)

  return (
    <article className="p-doc">
      <div className="p-ribbon">
        <span>
          <b>POST-RUN QUICK LOOK</b> {run.id}
        </span>
        <span>Card: {cardLabel}</span>
        <span>Cell: {run.matrixCellId ?? 'not set'}</span>
      </div>
      <h2>Post-run quick look</h2>
      {campaign.illustrative && <p className="p-illustrative">ILLUSTRATIVE: every value is notional.</p>}

      <PSection n={1} title="Identifiers">
        <PRow label="Run" value={run.id} />
        <PRow label="Card and version" value={cardLabel} />
        <PRow label="Start" value={run.startAt ?? 'not recorded'} />
        <PRow label="End" value={run.endAt ?? 'not recorded'} />
      </PSection>

      <PSection n={2} title="Required files">
        <PRow label="Required files (card)" value={card?.requiredFiles ?? 'card not found'} />
        <PRow label="Files recorded" value={run.dataFilesNote || 'not recorded'} />
      </PSection>

      <PSection n={3} title="Configuration match">
        <PRow
          label="Planned vs actual"
          value={`planned ${plannedConfig ?? 'not set'} / actual ${actualConfig ?? 'not recorded'}: ${configMatch}`}
        />
      </PSection>

      <PSection n={4} title="Event-derived times">
        {eventTimes.length === 0 ? (
          <p className="p-note">No card event marks recorded for this run.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Mark</th>
                <th style={{ width: '12em' }}>Time from start</th>
              </tr>
            </thead>
            <tbody>
              {eventTimes.map((row) => (
                <tr key={row.mark}>
                  <td>{row.mark}</td>
                  <td>{Math.round((row.seconds as number) * 10) / 10} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={5} title="Per-measure quick values">
        {run.observations.length === 0 ? (
          <p className="p-note">No observations recorded.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Measure</th>
                <th>Status</th>
                <th>Quick value</th>
                <th>Threshold</th>
              </tr>
            </thead>
            <tbody>
              {run.observations.map((o) => {
                const m = campaign.measures.find((x) => x.id === o.measureId)
                const value =
                  o.value !== null
                    ? `${o.value} ${m?.unit ?? ''}`.trim()
                    : o.success !== null
                      ? o.success
                        ? 'success'
                        : 'failure'
                      : ''
                const threshold =
                  m && m.thresholdApproved && m.threshold !== null
                    ? `${m.threshold} ${m.unit}`.trim()
                    : 'characterize (no approved threshold)'
                return (
                  <tr key={o.measureId}>
                    <td>{m ? `${m.id}: ${m.name}` : o.measureId}</td>
                    <td>{o.status}</td>
                    <td>{value}</td>
                    <td>{threshold}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={6} title="Differences from prediction">
        <PRow label="Card prediction" value={card?.prediction || 'no prediction on card'} />
      </PSection>

      <PSection n={7} title="Next-run recommendation (select one)">
        <ul className="p-checklist">
          {NEXT_RUN_OPTIONS.map((opt) => (
            <li key={opt}>{opt}</li>
          ))}
        </ul>
      </PSection>

      <p className="p-note">
        Quick look supports the next-run decision. It does not replace final analysis.
      </p>
    </article>
  )
}

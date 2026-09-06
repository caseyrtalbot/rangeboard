/**
 * Run record and immediate debrief form (MASTER-FORMS).
 * Identifiers, times, roles, actuals, event log, observations, deviations,
 * anomalies, data quality, validity history, and the six debrief fields.
 */

import type { TeCampaign, TeRun } from '../model/types'
import { runEvidenceLabel } from '../validate'
import { displayId } from '../model/ids'
import { PBlank, PRow, PSection } from './PrintOverlay'

function measureName(campaign: TeCampaign, id: string): string {
  const m = campaign.measures.find((x) => x.id === id)
  return m ? `${m.id}: ${m.name}` : id
}

export function RunRecordPrint({ campaign, run }: { campaign: TeCampaign; run: TeRun }) {
  const card = campaign.cards.find((c) => c.id === run.cardId)
  const cardLabel = card ? displayId(card.cardCode, run.cardVersion) : run.cardId
  const deviations = campaign.deviations.filter((d) => d.runId === run.id)
  const anomalies = campaign.anomalies.filter((a) => a.runId === run.id)
  const debriefFields: Array<[string, string]> = [
    ['What was planned vs what occurred', run.debrief.plannedVsOccurred],
    ['What differed', run.debrief.differences],
    ['What sources recorded', run.debrief.sourcesRecorded],
    ['Warnings or failures', run.debrief.warningsOrFailures],
    ['Unexpected result', run.debrief.unexpectedResult],
    ['Repeat needed', run.debrief.repeatNeeded],
  ]

  return (
    <article className="p-doc">
      <div className="p-ribbon">
        <span>
          <b>RUN RECORD</b> {run.id}
        </span>
        <span>Card: {cardLabel}</span>
        <span>Cell: {run.matrixCellId ?? 'not set'}</span>
        <span>Validity: {run.validity.toUpperCase()}</span>
      </div>
      <p className="p-note">{runEvidenceLabel(run)}</p>
      <h2>{card?.title || 'Run record'}</h2>
      {campaign.illustrative && <p className="p-illustrative">ILLUSTRATIVE: every value is notional.</p>}

      <PSection n={1} title="Identifiers">
        <PRow label="Run" value={run.id} />
        <PRow label="Card and version" value={cardLabel} />
        <PRow label="Matrix cell" value={run.matrixCellId ?? 'not set'} />
        <PRow label="Planned purpose" value={run.plannedPurpose} />
        <PRow label="Campaign" value={`${campaign.code}: ${campaign.name}`} />
      </PSection>

      {(run.observationAmendments ?? []).map((a, i) => (
        <PSection key={i} title={`Observation correction ${i + 1}`}>
          <PRow label="Attribution" value={`${a.at}; ${a.by}; ${a.reason}`} />
          {([['Previous', a.previous], ['Corrected', a.corrected]] as const).map(([label, observations]) =>
            observations.map(o => <PRow
              key={`${label}-${o.measureId}`}
              label={`${label}: ${measureName(campaign, o.measureId)}`}
              value={`${o.status}; ${String(o.value ?? o.success ?? 'no value')}; ${o.note}`}
            />),
          )}
        </PSection>
      ))}
      <PSection n={2} title="Times">
        <PRow label="Start" value={run.startAt ?? 'not recorded'} />
        <PRow label="End" value={run.endAt ?? 'not recorded'} />
      </PSection>

      <PSection n={3} title="Roles">
        {run.roles.length === 0 ? (
          <p className="p-note">No roles recorded.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Person</th>
              </tr>
            </thead>
            <tbody>
              {run.roles.map((r, i) => (
                <tr key={i}>
                  <td>{r.role}</td>
                  <td>{r.person}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={4} title="Actual configuration, threat, and condition">
        <PRow label="Actual configuration" value={run.actualConfigId ?? 'not recorded'} />
        <PRow label="Actual threat" value={run.actualThreatId ?? 'not recorded'} />
        <PRow label="Actual condition" value={run.actualConditionId ?? 'not recorded'} />
        <PRow label="Actuals note" value={run.actualsNote} />
      </PSection>

      <PSection n={5} title="Time-ordered event log">
        {run.events.length === 0 ? (
          <p className="p-note">No events recorded.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Mark</th>
                <th style={{ width: '13em' }}>Time</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {run.events.map((e) => (
                <tr key={e.id}>
                  <td>{e.mark}</td>
                  <td>{e.at}</td>
                  <td>{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={6} title="Per-measure observations">
        {run.observations.length === 0 ? (
          <p className="p-note">No observations recorded.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Measure</th>
                <th>Status</th>
                <th>Success</th>
                <th>Value</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {run.observations.map((o) => (
                <tr key={o.measureId}>
                  <td>{measureName(campaign, o.measureId)}</td>
                  <td>{o.status}</td>
                  <td>{o.success === null ? '' : o.success ? 'yes' : 'no'}</td>
                  <td>{o.value ?? ''}</td>
                  <td>{o.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={7} title="Direct operator observations">
        <p>{run.operatorObservations || 'None recorded.'}</p>
      </PSection>

      <PSection n={8} title="Deviations">
        {deviations.length === 0 ? (
          <p className="p-note">No deviations.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Id</th>
                <th>Time</th>
                <th>Actual state</th>
                <th>Effect</th>
                <th>Disposition</th>
              </tr>
            </thead>
            <tbody>
              {deviations.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.at}</td>
                  <td>{d.actualState}</td>
                  <td>{d.effect}</td>
                  <td>{d.disposition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={9} title="Anomalies">
        {anomalies.length === 0 ? (
          <p className="p-note">No anomalies.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Id</th>
                <th>Time</th>
                <th>Observation</th>
                <th>Class</th>
                <th>Root cause status</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>{a.at}</td>
                  <td>{a.observation}</td>
                  <td>{a.classification}</td>
                  <td>{a.rootCauseStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={10} title="Data quality">
        <PRow label="Data files and storage" value={run.dataFilesNote} />
        <PRow label="Initial data-quality result" value={run.initialDataQuality} />
      </PSection>

      <PSection n={11} title="Validity and adjudication">
        <PRow label="Final status" value={run.validity} />
        <PRow label="Excluded from accounting" value={run.excluded ? 'yes' : 'no'} />
        {run.adjudications.length > 0 && (
          <table className="p-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Time</th>
                <th>By</th>
                <th>Validity</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {run.adjudications.map((a) => (
                <tr key={a.version}>
                  <td>{a.version}</td>
                  <td>{a.at}</td>
                  <td>{a.by}</td>
                  <td>{a.validity}</td>
                  <td>{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={12} title="Allowed measures and prohibited uses">
        <PRow
          label="Allowed measures"
          value={
            run.allowedMeasureIds.length > 0
              ? run.allowedMeasureIds.map((id) => measureName(campaign, id)).join('; ')
              : run.validity === 'conditionally-valid'
                ? 'none named'
                : 'not restricted'
          }
        />
        <PRow label="Prohibited uses" value={run.prohibitedUses} />
        <PRow label="Limits" value={run.limits} />
      </PSection>

      <PSection n={13} title="Immediate debrief">
        {debriefFields.map(([label, value]) =>
          value ? <PRow key={label} label={label} value={value} /> : <PBlank key={label} label={label} />,
        )}
      </PSection>

      <PSection n={14} title="Preliminary use">
        <p>{run.preliminaryUse ?? 'Not set.'}</p>
      </PSection>
    </article>
  )
}

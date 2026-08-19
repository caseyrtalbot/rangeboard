/**
 * The canonical 19-section test card print artifact (MASTER-FORMS 2.3).
 * Control ribbon on top, numbered sections in fixed order, procedure as a
 * step table, event marks as a tick-box table on paper.
 */

import type { TeCampaign, TeCard } from '../model/types'
import { displayId } from '../model/ids'
import { PRow, PSection } from './PrintOverlay'

function name(c: TeCampaign, list: 'measures' | 'threats' | 'conditions' | 'configs' | 'questions' | 'hypotheses', id: string | null): string {
  if (!id) return 'not set'
  const rec = (c[list] as Array<{ id: string; name?: string; wording?: string; title?: string }>).find((r) => r.id === id)
  if (!rec) return id
  return `${id}${rec.name ? `: ${rec.name}` : ''}`
}

export function TestCardPrint({ campaign, card }: { campaign: TeCampaign; card: TeCard }) {
  const runs = campaign.runs.filter((r) => r.cardId === card.id)
  const devs = campaign.deviations.filter((d) => d.cardId === card.id)
  const measures = card.measureIds
    .map((id) => campaign.measures.find((m) => m.id === id))
    .filter((m) => m != null)
  const factorNames = (ids: string[]) =>
    ids.map((id) => campaign.factors.find((f) => f.id === id)?.name ?? id).join('; ')

  return (
    <article className="p-doc">
      <div className="p-ribbon">
        <span>
          <b>TEST CARD</b> {displayId(card.cardCode, card.version)}
        </span>
        <span>Status: {card.status.toUpperCase()}</span>
        <span>CFG: {card.configId ?? 'not set'}</span>
        <span>THR: {card.threatId ?? 'not set'}</span>
        <span>COND: {card.conditionId ?? 'not set'}</span>
        <span>Cell: {card.matrixCellId ?? 'not set'}</span>
      </div>
      <h2>{card.title || 'Untitled card'}</h2>
      {campaign.illustrative && <p className="p-illustrative">ILLUSTRATIVE: every value is notional.</p>}

      <PSection n={1} title="Control">
        <PRow label="Card" value={displayId(card.cardCode, card.version)} />
        <PRow label="Owner" value={card.owner} />
        <PRow label="Approvers" value={card.approvers} />
        <PRow label="Effective" value={card.effectiveAt ?? 'not issued'} />
        <PRow label="Campaign" value={`${campaign.code}: ${campaign.name}`} />
      </PSection>

      <PSection n={2} title="Traceability">
        <PRow label="Questions" value={card.questionIds.join('; ')} />
        <PRow label="Claims" value={card.claimIds.join('; ')} />
        <PRow label="Hypotheses" value={card.hypothesisIds.join('; ')} />
        <PRow label="Measures" value={card.measureIds.join('; ')} />
      </PSection>

      <PSection n={3} title="Purpose and intent">
        <PRow label="Purpose" value={card.purpose} />
        <PRow label="Why this run next" value={card.whyHighestValueNext} />
        <PRow label="Result that could change the decision" value={card.resultThatCouldChangeDecision} />
        <PRow label="Prediction" value={card.prediction} />
        <PRow label="Changed factor" value={card.changedFactor} />
      </PSection>

      <PSection n={4} title="Planned repetition">
        <PRow label="Repetition number" value={String(card.repetitionNumber)} />
        <PRow label="Minimum valid sample" value={String(card.minValidSample)} />
        <PRow label="Priority reason" value={card.priorityReason} />
        <PRow label="Order and blocking" value={card.orderAndBlocking} />
      </PSection>

      <PSection n={5} title="System state">
        <PRow label="Configuration" value={name(campaign, 'configs', card.configId)} />
        <PRow label="System state" value={card.systemStateNote} />
        <PRow label="Operators" value={card.operators} />
        <PRow label="Training state" value={card.trainingState} />
      </PSection>

      <PSection n={6} title="Threat state">
        <PRow label="Threat profile" value={name(campaign, 'threats', card.threatId)} />
        <PRow label="Red initial state" value={card.redInitialState} />
        <PRow label="Red-controlled variables" value={card.redControlled} />
        <PRow label="Red fixed variables" value={card.redFixed} />
        <PRow label="Blinding and information control" value={card.blinding} />
        <PRow label="Invalidating red deviations" value={card.invalidatingRedDeviations} />
        <PRow label="Reset before repeat" value={card.resetBeforeRepeat} />
      </PSection>

      <PSection n={7} title="Condition">
        <PRow label="Condition" value={name(campaign, 'conditions', card.conditionId)} />
        <PRow label="Notes" value={card.conditionNote} />
        <PRow label="Operating limits" value={card.operatingLimits} />
      </PSection>

      <PSection n={8} title="Variables">
        <PRow label="Independent" value={factorNames(card.independentFactorIds)} />
        <PRow label="Held controls" value={factorNames(card.heldFactorIds)} />
        <PRow label="Recorded covariates" value={factorNames(card.covariateFactorIds)} />
      </PSection>

      <PSection n={9} title="Measures and thresholds">
        <table className="p-table">
          <thead>
            <tr>
              <th>Measure</th>
              <th>Unit</th>
              <th>Threshold</th>
              <th>Objective</th>
            </tr>
          </thead>
          <tbody>
            {measures.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.id}: {m.name}
                </td>
                <td>{m.unit}</td>
                <td>
                  {m.thresholdApproved && m.threshold != null
                    ? m.threshold
                    : 'characterize (no approved threshold)'}
                </td>
                <td>{m.objective ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <PRow label="Notes" value={card.measuresNote} />
      </PSection>

      <PSection n={10} title="Data and truth">
        <PRow label="Sources" value={card.dataSources} />
        <PRow label="Ground truth" value={card.groundTruth} />
        <PRow label="Common time and tolerance" value={card.commonTimeAndTolerance} />
        <PRow label="Monitoring and fallback" value={card.monitoringAndFallback} />
        {card.eventMarks.length > 0 && (
          <table className="p-table">
            <thead>
              <tr>
                <th style={{ width: '3em' }}>Mark</th>
                <th>Event</th>
                <th style={{ width: '9em' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {card.eventMarks.map((m, i) => (
                <tr key={i}>
                  <td className="p-tick" />
                  <td>{m}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={11} title="Preconditions (required state)">
        <ul className="p-checklist">
          {card.preconditions.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </PSection>

      <PSection n={12} title="Procedure">
        <PRow
          label="Site calls"
          value={`start "${card.siteCalls.start}"  pause "${card.siteCalls.pause}"  stop "${card.siteCalls.stop}"  abort "${card.siteCalls.abort}"`}
        />
        <PRow
          label="Recording margins"
          value={`${card.preEventMarginS} s before, ${card.postEventMarginS} s after`}
        />
        <table className="p-table">
          <thead>
            <tr>
              <th style={{ width: '2.5em' }}>#</th>
              <th>Action</th>
              <th style={{ width: '11em' }}>Role</th>
              <th>Complete when</th>
              <th style={{ width: '4em' }}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {card.procedure.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>{s.action}</td>
                <td>{s.role}</td>
                <td>{s.observableCompletion}</td>
                <td>
                  {s.canSilentlyInvalidate ? 'INV ' : ''}
                  {s.isRecorderStartStop ? 'REC' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PSection>

      <PSection n={13} title="Expected result">
        <PRow label="Nominal behavior" value={card.expectedResult} />
        <PRow label="Known expected artifacts" value={card.knownArtifacts} />
      </PSection>

      <PSection n={14} title="Stop and restart">
        <PRow label="Safety and regulatory stops" value={card.safetyStops} />
        <PRow label="Data and equipment stops" value={card.dataEquipmentStops} />
        <PRow label="Safe state" value={card.safeState} />
        <PRow label="Restart authority" value={card.restartAuthority} />
        <PRow label="Run-specific hold conditions" value={card.holdConditions} />
      </PSection>

      <PSection n={15} title="Validity and repeat">
        <PRow label="Required conditions" value={card.requiredValidityConditions} />
        <PRow label="Invalidating failures" value={card.invalidatingFailures} />
        <PRow label="Conditional uses" value={card.conditionalUses} />
      </PSection>

      <PSection n={16} title="Outputs">
        <PRow label="Required files" value={card.requiredFiles} />
        <PRow label="Storage path" value={card.storagePath} />
      </PSection>

      <PSection n={17} title="Deviation record and runs">
        <PRow
          label="Runs executed against this card"
          value={runs.length ? runs.map((r) => `${r.id} (${r.validity})`).join('; ') : 'none yet'}
        />
        {devs.length > 0 && (
          <table className="p-table">
            <thead>
              <tr>
                <th>Deviation</th>
                <th>Run</th>
                <th>Actual difference</th>
                <th>Effect</th>
                <th>Disposition</th>
              </tr>
            </thead>
            <tbody>
              {devs.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.runId}</td>
                  <td>{d.actualState}</td>
                  <td>{d.effect}</td>
                  <td>{d.disposition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="p-note">
          Never edit this card to match what occurred. Record a deviation. A deviation that
          becomes the intended method requires a new card version before the next execution.
        </p>
      </PSection>

      <PSection n={18} title="Allowed conclusion">
        <p>{card.allowedConclusion || 'Bounded to the tested configuration, threat, geometry, and conditions.'}</p>
      </PSection>

      <PSection n={19} title="Prohibited conclusion">
        <p>{card.prohibitedConclusion || 'State what must not be inferred.'}</p>
      </PSection>

      {card.frameIds.length > 0 && (
        <PSection title="Attached board frames">
          {card.frameIds.map((fid) => {
            const f = campaign.frames.find((x) => x.id === fid)
            if (!f) return null
            return (
              <figure key={fid} className="p-figure">
                <img src={f.pngDataUrl} alt={f.name} />
                <figcaption>{f.name}</figcaption>
              </figure>
            )
          })}
        </PSection>
      )}
    </article>
  )
}

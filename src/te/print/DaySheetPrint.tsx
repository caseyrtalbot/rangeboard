/**
 * Printable day sheet (MASTER-FORMS). Run accounting, coverage, planned
 * runs for issued cards, go/no-go log, next priority cells, and hand-fill
 * blanks for the conductor.
 */

import type { TeCampaign } from '../model/types'
import { runAccounting, validRunRate } from '../calc/accounting'
import { coverage } from '../calc/matrix'
import { displayId } from '../model/ids'
import { PBlank, PRow, PSection } from './PrintOverlay'

export function DaySheetPrint({ campaign }: { campaign: TeCampaign }) {
  const acc = runAccounting(campaign)
  const rate = validRunRate(campaign)
  const cov = coverage(campaign)
  const issued = campaign.cards.filter((c) => c.status === 'issued')
  const priorityCells = campaign.matrix
    .map((cell) => ({ cell, cov: cov.find((x) => x.cellId === cell.id) }))
    .filter((x) => x.cov != null && x.cov.valid < x.cov.minValid)
    .sort((a, b) => a.cell.priority - b.cell.priority)
    .slice(0, 3)

  return (
    <article className="p-doc">
      <div className="p-ribbon">
        <span>
          <b>DAY SHEET</b> {campaign.code}
        </span>
        <span>{campaign.name}</span>
        <span>Phase: {campaign.phase.toUpperCase()}</span>
        <span>Date: ____________</span>
      </div>
      <h2>Day sheet</h2>
      {campaign.illustrative && <p className="p-illustrative">ILLUSTRATIVE: every value is notional.</p>}

      <PSection n={1} title="Run accounting">
        <PRow label="Planned" value={String(acc.planned)} />
        <PRow label="Attempted" value={String(acc.attempted)} />
        <PRow label="Valid" value={String(acc.valid)} />
        <PRow label="Conditional" value={String(acc.conditional)} />
        <PRow label="Invalid" value={String(acc.invalid)} />
        <PRow label="Excluded" value={String(acc.excluded)} />
        <PRow label="Pending" value={String(acc.pending)} />
        <PRow
          label="Valid-run rate"
          value={rate === null ? 'no attempted runs' : `${Math.round(rate * 1000) / 10}%`}
        />
      </PSection>

      <PSection n={2} title="Coverage by matrix cell">
        <table className="p-table">
          <thead>
            <tr>
              <th>Cell</th>
              <th>Planned</th>
              <th>Attempted</th>
              <th>Valid</th>
              <th>Min valid</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {cov.map((c) => (
              <tr key={c.cellId}>
                <td>{c.cellId}</td>
                <td>{c.planned}</td>
                <td>{c.attempted}</td>
                <td>{c.valid}</td>
                <td>{c.minValid}</td>
                <td>{c.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PSection>

      <PSection n={3} title="Planned runs (issued cards)">
        {issued.length === 0 ? (
          <p className="p-note">No issued cards.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Title</th>
                <th>Cell</th>
                <th>Repetition</th>
                <th>Min valid sample</th>
                <th>Runs so far</th>
              </tr>
            </thead>
            <tbody>
              {issued.map((c) => (
                <tr key={c.id}>
                  <td>{displayId(c.cardCode, c.version)}</td>
                  <td>{c.title}</td>
                  <td>{c.matrixCellId ?? 'not set'}</td>
                  <td>{c.repetitionNumber}</td>
                  <td>{c.minValidSample}</td>
                  <td>{campaign.runs.filter((r) => r.cardId === c.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={4} title="Go/no-go log">
        {campaign.gonogos.length === 0 ? (
          <p className="p-note">No go/no-go decisions recorded.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Id</th>
                <th>Scope</th>
                <th>Decision</th>
                <th>Time</th>
                <th>Approvers</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {campaign.gonogos.map((g) => (
                <tr key={g.id}>
                  <td>{g.id}</td>
                  <td>{g.scope}</td>
                  <td>{g.decision}</td>
                  <td>{g.at}</td>
                  <td>{g.approvers}</td>
                  <td>{g.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={5} title="Next three priority cells">
        {priorityCells.length === 0 ? (
          <p className="p-note">No unmet cells. Coverage minimums are met.</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Cell</th>
                <th>Question</th>
                <th>Priority</th>
                <th>Valid / min</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {priorityCells.map(({ cell, cov: c }) => (
                <tr key={cell.id}>
                  <td>{cell.id}</td>
                  <td>{cell.questionId}</td>
                  <td>{cell.priority}</td>
                  <td>
                    {c?.valid ?? 0} / {cell.minValidEvidence}
                  </td>
                  <td>{c?.state ?? 'empty'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PSection>

      <PSection n={6} title="Day setup (fill by hand)">
        <PBlank label="Day objective" />
        <PBlank label="Current conditions" />
        <PBlank label="Estimated time remaining" />
      </PSection>
    </article>
  )
}

import { useState } from 'react'
import type { TeCampaign } from '../model/types'
import { useTeStore } from '../state/teStore'
import { displayId } from '../model/ids'
import { PrintOverlay } from '../print/PrintOverlay'
import { TestCardPrint } from '../print/TestCardPrint'
import { DaySheetPrint } from '../print/DaySheetPrint'
import { RunRecordPrint } from '../print/RunRecordPrint'
import { QuickLookPrint } from '../print/QuickLookPrint'
import { ChecklistPrint } from '../print/ChecklistPrint'
import { DebriefPrint } from '../print/DebriefPrint'
import { PackagePrint } from '../print/PackagePrint'
import {
  exportAccountingCsv,
  exportActionsCsv,
  exportAllCsv,
  exportEventsCsv,
  exportFindingsCsv,
  exportMatrixCsv,
  exportMeasureResultsCsv,
  exportRunsCsv,
} from '../io/exportCsv'
import { exportCampaignJson } from '../io/persistTe'
import { Field, SubTitle, TextField } from './kit'

type Artifact =
  | { kind: 'card'; id: string }
  | { kind: 'day' }
  | { kind: 'run'; id: string }
  | { kind: 'quicklook'; id: string }
  | { kind: 'checklist'; id: string }
  | { kind: 'debrief'; id: string }
  | { kind: 'package' }

function PickRow({
  label,
  options,
  onOpen,
}: {
  label: string
  options: Array<{ id: string; label: string }>
  onOpen: (id: string) => void
}) {
  const [sel, setSel] = useState('')
  return (
    <div className="field-row te-table-row">
      <Field label={label}>
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <button className="mini" disabled={!sel} onClick={() => onOpen(sel)}>
        Open print view
      </button>
    </div>
  )
}

export function ProductsPanel({ campaign }: { campaign: TeCampaign }) {
  const [open, setOpen] = useState<Artifact | null>(null)
  const { patchItem, removeItem } = useTeStore.getState()

  const overlay = (() => {
    if (!open) return null
    if (open.kind === 'card') {
      const card = campaign.cards.find((c) => c.id === open.id)
      if (!card) return null
      return (
        <PrintOverlay title={`Test card ${displayId(card.cardCode, card.version)}`} onClose={() => setOpen(null)}>
          <TestCardPrint campaign={campaign} card={card} />
        </PrintOverlay>
      )
    }
    if (open.kind === 'day') {
      return (
        <PrintOverlay title="Day sheet" onClose={() => setOpen(null)}>
          <DaySheetPrint campaign={campaign} />
        </PrintOverlay>
      )
    }
    if (open.kind === 'run' || open.kind === 'quicklook') {
      const run = campaign.runs.find((r) => r.id === open.id)
      if (!run) return null
      return (
        <PrintOverlay
          title={open.kind === 'run' ? `Run record ${run.id}` : `Quick look ${run.id}`}
          onClose={() => setOpen(null)}
        >
          {open.kind === 'run' ? (
            <RunRecordPrint campaign={campaign} run={run} />
          ) : (
            <QuickLookPrint campaign={campaign} run={run} />
          )}
        </PrintOverlay>
      )
    }
    if (open.kind === 'checklist') {
      const cl = campaign.checklists.find((c) => c.id === open.id)
      if (!cl) return null
      return (
        <PrintOverlay title={cl.name} onClose={() => setOpen(null)}>
          <ChecklistPrint checklist={cl} />
        </PrintOverlay>
      )
    }
    if (open.kind === 'debrief') {
      const d = campaign.debriefs.find((x) => x.id === open.id)
      if (!d) return null
      return (
        <PrintOverlay title={`Debrief ${d.id}`} onClose={() => setOpen(null)}>
          <DebriefPrint campaign={campaign} debrief={d} />
        </PrintOverlay>
      )
    }
    return (
      <PrintOverlay title="Decision evidence package" onClose={() => setOpen(null)}>
        <PackagePrint campaign={campaign} />
      </PrintOverlay>
    )
  })()

  return (
    <div className="te-panel">
      <div className="inspector-body">
        <SubTitle>Print and tablet products</SubTitle>
        <p className="muted small">
          Every artifact opens in a print view: use the browser dialog to print or save a PDF for
          the tablet.
        </p>
        <PickRow
          label="Test card"
          options={campaign.cards.map((c) => ({
            id: c.id,
            label: `${displayId(c.cardCode, c.version)} (${c.status}) ${c.title}`,
          }))}
          onOpen={(id) => setOpen({ kind: 'card', id })}
        />
        <div className="field-row te-table-row">
          <Field label="Day sheet (run accounting, coverage, priorities)">
            <span className="muted small">Uses the current campaign state.</span>
          </Field>
          <button className="mini" onClick={() => setOpen({ kind: 'day' })}>
            Open print view
          </button>
        </div>
        <PickRow
          label="Run record (full evidence record)"
          options={campaign.runs.map((r) => ({ id: r.id, label: `${r.id} (${r.validity})` }))}
          onOpen={(id) => setOpen({ kind: 'run', id })}
        />
        <PickRow
          label="Post-run quick look"
          options={campaign.runs.map((r) => ({ id: r.id, label: `${r.id} (${r.validity})` }))}
          onOpen={(id) => setOpen({ kind: 'quicklook', id })}
        />
        <PickRow
          label="Checklist instance"
          options={campaign.checklists.map((c) => ({
            id: c.id,
            label: `${c.name} ${c.dayDate}${c.completedAt ? '' : ' (open)'}`,
          }))}
          onOpen={(id) => setOpen({ kind: 'checklist', id })}
        />
        <PickRow
          label="Guided debrief"
          options={campaign.debriefs.map((d) => ({ id: d.id, label: `${d.kind} ${d.date}` }))}
          onOpen={(id) => setOpen({ kind: 'debrief', id })}
        />
        <div className="field-row te-table-row">
          <Field label="Decision evidence package (20 sections)">
            <span className="muted small">
              Generate the sections on the Deliver tab first.
            </span>
          </Field>
          <button className="mini" onClick={() => setOpen({ kind: 'package' })}>
            Open print view
          </button>
        </div>

        <SubTitle>Spreadsheet exports (CSV, opens in Excel or Sheets)</SubTitle>
        <div className="inspector-actions">
          <button onClick={() => exportRunsCsv(campaign)}>Runs</button>
          <button onClick={() => exportMeasureResultsCsv(campaign)}>Measure results</button>
          <button onClick={() => exportMatrixCsv(campaign)}>Matrix coverage</button>
          <button onClick={() => exportAccountingCsv(campaign)}>Accounting</button>
          <button onClick={() => exportEventsCsv(campaign)}>Events (telemetry)</button>
          <button onClick={() => exportFindingsCsv(campaign)}>Findings</button>
          <button onClick={() => exportActionsCsv(campaign)}>Actions</button>
          <button className="primary" onClick={() => exportAllCsv(campaign)}>
            Export all
          </button>
        </div>

        <SubTitle>Campaign file</SubTitle>
        <div className="inspector-actions">
          <button onClick={() => exportCampaignJson(campaign)}>Export campaign JSON</button>
        </div>

        <SubTitle>Captured board frames</SubTitle>
        <p className="muted small">
          Capture frames from the Board workspace ("Capture frame" in the toolbar). Attach them to
          cards on the Cards tab; they render in print views.
        </p>
        {campaign.frames.length === 0 && <p className="muted">No frames captured yet.</p>}
        <div className="te-frames">
          {campaign.frames.map((f) => (
            <div key={f.id} className="te-frame">
              <img src={f.pngDataUrl} alt={f.name} />
              <TextField label="Name" value={f.name} onChange={(v) => patchItem('frames', f.id, { name: v })} />
              <button className="mini danger" onClick={() => removeItem('frames', f.id)}>
                remove
              </button>
            </div>
          ))}
        </div>
      </div>
      {overlay}
    </div>
  )
}

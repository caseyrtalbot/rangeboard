import { useState } from 'react'
import { activeCampaign, useTeStore } from '../state/teStore'
import type { TePhaseTab } from '../state/teStore'
import { campaignReadiness } from '../calc/readiness'
import type { ArtifactKey, StageStatus } from '../calc/readiness'
import { exportCampaignJson, importCampaignFile } from '../io/persistTe'
import { displayId } from '../model/ids'
import { PrintOverlay } from '../print/PrintOverlay'
import { TestCardPrint } from '../print/TestCardPrint'
import { RunRecordPrint } from '../print/RunRecordPrint'
import { PackagePrint } from '../print/PackagePrint'
import { CampaignPanel } from './CampaignPanel'
import { DesignPanel } from './DesignPanel'
import { CardsPanel } from './CardsPanel'
import { ExecutePanel } from './ExecutePanel'
import { AnalyzePanel } from './AnalyzePanel'
import { DeliverPanel } from './DeliverPanel'
import { ProductsPanel } from './ProductsPanel'
import { Field, ReadinessRail } from './kit'
import { loadDemoCampaign } from './demo'

const PHASES: Array<{ id: TePhaseTab; label: string }> = [
  { id: 'campaign', label: '1 Campaign' },
  { id: 'design', label: '2 Design' },
  { id: 'cards', label: '3 Cards' },
  { id: 'execute', label: '4 Execute' },
  { id: 'analyze', label: '5 Analyze' },
  { id: 'deliver', label: '6 Deliver' },
  { id: 'products', label: 'Products' },
]

/** Campaign code suggestion: word initials plus digit groups, id-grammar charset. */
function suggestCode(name: string): string {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w !== '')
    .map((w) => (/^\d+$/.test(w) ? w : w[0]))
    .join('')
    .toUpperCase()
    .slice(0, 6)
}

function fmtClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function StartScreen() {
  const createCampaign = useTeStore((s) => s.createCampaign)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)
  return (
    <div className="te-start">
      <div className="te-start-box">
        <h2>T&E Operations</h2>
        <p className="muted">
          Run a counter-UAS test campaign end to end: qualify the request, design the evidence,
          issue test cards, execute runs, compute results, and deliver the decision package.
        </p>
        <Field label="Campaign name">
          <input
            value={name}
            placeholder="Early-warning architecture evaluation"
            onChange={(e) => {
              setName(e.target.value)
              if (!codeTouched) setCode(suggestCode(e.target.value))
            }}
          />
        </Field>
        <Field label="Campaign code (short, used in record IDs)">
          <input
            value={code}
            placeholder="J401"
            onChange={(e) => {
              const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
              setCode(clean)
              setCodeTouched(clean !== '')
            }}
          />
        </Field>
        <div className="inspector-actions">
          <button
            className="primary"
            disabled={!name.trim() || !code.trim()}
            onClick={() => createCampaign(name.trim(), code.trim())}
          >
            Create campaign
          </button>
          <button onClick={importCampaignFile}>Import…</button>
          <button onClick={loadDemoCampaign}>Load JIATF-401 demo</button>
        </div>
      </div>
    </div>
  )
}

/** Header saved-state readout: dim time on success, plain error text on failure. */
function SavedIndicator() {
  const lastSavedAt = useTeStore((s) => s.lastSavedAt)
  const saveError = useTeStore((s) => s.saveError)
  if (saveError) {
    return (
      <span className="status bad" role="status">
        {saveError}
      </span>
    )
  }
  if (!lastSavedAt) return null
  return (
    <span className="muted" role="status" title="Autosave writes every change.">
      Saved <span className="num">{fmtClock(lastSavedAt)}</span>
    </span>
  )
}

/** Artifact previews that a print component can render. */
type Preview =
  | { kind: 'card'; id: string }
  | { kind: 'run'; id: string }
  | { kind: 'package' }

export function OpsWorkspace() {
  const campaigns = useTeStore((s) => s.campaigns)
  const activeId = useTeStore((s) => s.activeCampaignId)
  const phase = useTeStore((s) => s.ui.phase)
  const { setPhase, setActiveCampaign, deleteCampaign } = useTeStore.getState()
  const campaign = activeCampaign({ campaigns, activeCampaignId: activeId })
  const [railOpen, setRailOpen] = useState(true)
  const [preview, setPreview] = useState<Preview | null>(null)

  if (!campaign) return <StartScreen />

  const readiness = campaignReadiness(campaign)
  const statusByStage = new Map<string, StageStatus>(
    readiness.stages.map((s) => [s.id, s.status]),
  )

  /** Rail preview: open a print view where one exists, else go to the stage. */
  function previewArtifact(key: ArtifactKey, stage: TePhaseTab): void {
    if (!campaign) return
    if (key === 'cards') {
      const card =
        [...campaign.cards].reverse().find((x) => x.status === 'issued') ??
        campaign.cards[campaign.cards.length - 1]
      if (card) {
        setPreview({ kind: 'card', id: card.id })
        return
      }
    }
    if (key === 'runs') {
      const run = campaign.runs[campaign.runs.length - 1]
      if (run) {
        setPreview({ kind: 'run', id: run.id })
        return
      }
    }
    if (key === 'package') {
      setPreview({ kind: 'package' })
      return
    }
    setPhase(stage)
  }

  const overlay = (() => {
    if (!preview) return null
    if (preview.kind === 'card') {
      const card = campaign.cards.find((x) => x.id === preview.id)
      if (!card) return null
      return (
        <PrintOverlay
          title={`Test card ${displayId(card.cardCode, card.version)}`}
          onClose={() => setPreview(null)}
        >
          <TestCardPrint campaign={campaign} card={card} />
        </PrintOverlay>
      )
    }
    if (preview.kind === 'run') {
      const run = campaign.runs.find((r) => r.id === preview.id)
      if (!run) return null
      return (
        <PrintOverlay title={`Run record ${run.id}`} onClose={() => setPreview(null)}>
          <RunRecordPrint campaign={campaign} run={run} />
        </PrintOverlay>
      )
    }
    return (
      <PrintOverlay title="Decision evidence package" onClose={() => setPreview(null)}>
        <PackagePrint campaign={campaign} />
      </PrintOverlay>
    )
  })()

  return (
    <div className="te-workspace">
      <div className="te-header">
        <select
          className="te-campaign-select"
          value={campaign.id}
          onChange={(e) => {
            if (e.target.value === '__new__') setActiveCampaign('')
            else setActiveCampaign(e.target.value)
          }}
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}: {c.name}
            </option>
          ))}
          <option value="__new__">+ New / start screen…</option>
        </select>
        <span className={`status ${campaign.phase === 'closed' ? 'neutral' : 'good'}`}>
          {campaign.phase}
        </span>
        {campaign.illustrative && (
          <span className="status warn" title="Every number in this campaign is notional.">
            illustrative demo
          </span>
        )}
        <SavedIndicator />
        <div className="spacer" />
        <button
          type="button"
          className="mini"
          aria-pressed={railOpen}
          title={railOpen ? 'Hide the readiness rail' : 'Show the readiness rail'}
          onClick={() => setRailOpen((o) => !o)}
        >
          Readiness <span className="num">{readiness.pct}%</span>
        </button>
        <div className="seg">
          <button onClick={() => exportCampaignJson(campaign)}>Export JSON</button>
          <button onClick={importCampaignFile}>Import</button>
          <button
            className="danger"
            onClick={() => {
              if (window.confirm('Delete this campaign? Export first if you need a copy.')) {
                deleteCampaign(campaign.id)
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
      <div className="te-body">
        <nav className="te-nav">
          {PHASES.map((p) => {
            const status = statusByStage.get(p.id) ?? null
            return (
              <button
                key={p.id}
                className={phase === p.id ? 'active' : ''}
                onClick={() => setPhase(p.id)}
              >
                {status && <span className={`step-dot ${status}`} />}
                {p.label}
              </button>
            )
          })}
        </nav>
        <main className="te-main">
          {campaign.evidencePackage.deliveredAt && <p className="status warn">
            Delivered record: campaign evidence is frozen. Export this record and start a
            follow-on campaign for further work.
          </p>}
          {phase === 'campaign' && <CampaignPanel key={campaign.id} campaign={campaign} />}
          {phase === 'design' && <DesignPanel key={campaign.id} campaign={campaign} />}
          {phase === 'cards' && <CardsPanel key={campaign.id} campaign={campaign} />}
          {phase === 'execute' && <ExecutePanel key={campaign.id} campaign={campaign} />}
          {phase === 'analyze' && <AnalyzePanel key={campaign.id} campaign={campaign} />}
          {phase === 'deliver' && <DeliverPanel key={campaign.id} campaign={campaign} />}
          {phase === 'products' && <ProductsPanel key={campaign.id} campaign={campaign} />}
        </main>
        {railOpen && (
          <ReadinessRail
            pct={readiness.pct}
            items={readiness.artifacts.map((a) => ({
              label: a.label,
              state: a.state,
              detail: a.detail,
              onPreview: () => previewArtifact(a.key, a.stage),
            }))}
          />
        )}
      </div>
      {overlay}
    </div>
  )
}

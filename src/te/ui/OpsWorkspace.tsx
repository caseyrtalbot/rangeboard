import { useState } from 'react'
import { activeCampaign, useTeStore } from '../state/teStore'
import type { TePhaseTab } from '../state/teStore'
import { exportCampaignJson, importCampaignFile } from '../io/persistTe'
import { CampaignPanel } from './CampaignPanel'
import { DesignPanel } from './DesignPanel'
import { CardsPanel } from './CardsPanel'
import { ExecutePanel } from './ExecutePanel'
import { AnalyzePanel } from './AnalyzePanel'
import { DeliverPanel } from './DeliverPanel'
import { ProductsPanel } from './ProductsPanel'
import { Field } from './kit'
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

function StartScreen() {
  const createCampaign = useTeStore((s) => s.createCampaign)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
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
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Campaign code (short, used in record IDs)">
          <input
            value={code}
            placeholder="J401"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
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

export function OpsWorkspace() {
  const campaigns = useTeStore((s) => s.campaigns)
  const activeId = useTeStore((s) => s.activeCampaignId)
  const phase = useTeStore((s) => s.ui.phase)
  const { setPhase, setActiveCampaign, deleteCampaign } = useTeStore.getState()
  const campaign = activeCampaign({ campaigns, activeCampaignId: activeId })

  if (!campaign) return <StartScreen />

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
        <div className="spacer" />
        <div className="tool-group">
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
          {PHASES.map((p) => (
            <button
              key={p.id}
              className={phase === p.id ? 'active' : ''}
              onClick={() => setPhase(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <main className="te-main">
          {phase === 'campaign' && <CampaignPanel campaign={campaign} />}
          {phase === 'design' && <DesignPanel campaign={campaign} />}
          {phase === 'cards' && <CardsPanel campaign={campaign} />}
          {phase === 'execute' && <ExecutePanel campaign={campaign} />}
          {phase === 'analyze' && <AnalyzePanel campaign={campaign} />}
          {phase === 'deliver' && <DeliverPanel campaign={campaign} />}
          {phase === 'products' && <ProductsPanel campaign={campaign} />}
        </main>
      </div>
    </div>
  )
}

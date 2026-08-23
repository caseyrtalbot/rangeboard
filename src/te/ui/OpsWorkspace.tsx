import { useState } from 'react'
import type { TeCampaign } from '../model/types'
import { activeCampaign, useTeStore } from '../state/teStore'
import type { TePhaseTab } from '../state/teStore'
import { chainHealth, designLint, qualificationBlockers } from '../validate'
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

type StepStatus = 'good' | 'warn' | 'neutral'

/** Presentational progress dots for the stepper; navigation stays free. */
function stepStatus(c: TeCampaign, id: TePhaseTab): StepStatus | null {
  const qualified = qualificationBlockers(c).length === 0
  switch (id) {
    case 'campaign':
      return qualified ? 'good' : 'neutral'
    case 'design': {
      const passed = c.qualificationPassedAt != null
      if (
        passed &&
        c.questions.length > 0 &&
        c.measures.length > 0 &&
        designLint(c).length === 0
      )
        return 'good'
      return passed && c.questions.length > 0 ? 'warn' : 'neutral'
    }
    case 'cards':
      return c.cards.some((card) => card.status === 'issued') ? 'good' : 'neutral'
    case 'execute':
      if (c.runs.length === 0) return 'neutral'
      return c.runs.every((r) => r.validity !== 'pending') ? 'good' : 'warn'
    case 'analyze': {
      const clean = Object.values(chainHealth(c)).every((n) => n === 0)
      const adjudicated = c.runs.some((r) => r.validity !== 'pending')
      if (adjudicated && clean) return 'good'
      if (c.runs.length > 0 && !clean) return 'warn'
      return 'neutral'
    }
    case 'deliver':
      return c.evidencePackage.deliveredAt != null ? 'good' : 'neutral'
    case 'products':
      return null
  }
}

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
            const status = stepStatus(campaign, p.id)
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
          {phase === 'campaign' && <CampaignPanel key={campaign.id} campaign={campaign} />}
          {phase === 'design' && <DesignPanel key={campaign.id} campaign={campaign} />}
          {phase === 'cards' && <CardsPanel key={campaign.id} campaign={campaign} />}
          {phase === 'execute' && <ExecutePanel key={campaign.id} campaign={campaign} />}
          {phase === 'analyze' && <AnalyzePanel key={campaign.id} campaign={campaign} />}
          {phase === 'deliver' && <DeliverPanel key={campaign.id} campaign={campaign} />}
          {phase === 'products' && <ProductsPanel key={campaign.id} campaign={campaign} />}
        </main>
      </div>
    </div>
  )
}

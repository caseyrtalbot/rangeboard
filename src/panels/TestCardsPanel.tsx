import { useState } from 'react'
import type { TestCard } from '../model/types'
import {
  CARD_TEMPLATES,
  cardFromTemplate,
  controlledVarsText,
  describeConfiguration,
  describeThreats,
  MEASURES_DTI,
  standardCovariates,
} from '../model/seedCards'
import { useStore } from '../state/store'
import { engagementPicture } from '../analysis/impact'
import { buildAarSummary } from '../analysis/aar'
import { aarHeadline } from './headlines'
import { EmptyState, ObjectHeader, Section } from './inspector/kit'

/** Standard independent variables for C-UAS test design. */
const STANDARD_IVS = [
  'threat type',
  'ingress axis',
  'altitude',
  'speed',
  'ROE',
  'sky',
  'light',
  'EM background',
  'wind',
]

function Field({
  label,
  action,
  children,
}: {
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const Wrapper = action ? 'div' : 'label'
  return (
    <Wrapper className="field">
      <span>
        {label} {action}
      </span>
      {children}
    </Wrapper>
  )
}

/** Datalist options for a plain input. Suggestions only; typing stays free. */
function Options({ id, values }: { id: string; values: string[] }) {
  return (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  )
}

/** One-shot picker: choosing an option calls onPick and resets to the placeholder. */
function PickSelect({
  placeholder,
  options,
  onPick,
}: {
  placeholder: string
  options: string[]
  onPick: (v: string) => void
}) {
  return (
    <select
      className="mini"
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value)
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function TextField({
  card,
  field,
  label,
  rows,
  listId,
  action,
}: {
  card: TestCard
  field: keyof TestCard
  label: string
  rows?: number
  listId?: string
  action?: React.ReactNode
}) {
  const updateCard = useStore((s) => s.updateCard)
  const value = card[field] as string
  return (
    <Field label={label} action={action}>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => updateCard(card.id, { [field]: e.target.value })} />
      ) : (
        <input list={listId} value={value} onChange={(e) => updateCard(card.id, { [field]: e.target.value })} />
      )}
    </Field>
  )
}

/** One line per item; edits round-trip through a textarea. */
function ListField({
  card,
  field,
  label,
  action,
}: {
  card: TestCard
  field: 'measures' | 'procedure'
  label: string
  action?: React.ReactNode
}) {
  const updateCard = useStore((s) => s.updateCard)
  return (
    <Field label={label} action={action}>
      <textarea
        rows={4}
        value={card[field].join('\n')}
        placeholder="One item per line"
        onChange={(e) => updateCard(card.id, { [field]: e.target.value.split('\n') })}
        onBlur={(e) =>
          updateCard(card.id, { [field]: e.target.value.split('\n').filter((l) => l.trim() !== '') })
        }
      />
    </Field>
  )
}

/** Checkbox rows plus a free-add input over a string list. Storage shape stays with the caller. */
function CheckPicker({
  values,
  options,
  addPlaceholder,
  onChange,
}: {
  values: string[]
  options: Array<{ value: string; label: string }>
  addPlaceholder: string
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const known = new Set(options.map((o) => o.value))
  // Legacy or free-typed values stay visible and removable.
  const extras = values.filter((v) => !known.has(v))
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
  const add = () => {
    const v = draft.trim()
    if (v !== '' && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }
  return (
    <div>
      {[...extras.map((v) => ({ value: v, label: v })), ...options].map((o) => (
        <label key={o.value} className="check-row">
          <input type="checkbox" checked={values.includes(o.value)} onChange={() => toggle(o.value)} />
          {o.label}
        </label>
      ))}
      <div className="field-row">
        <input
          value={draft}
          placeholder={addPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button className="mini" onClick={add}>
          Add
        </button>
      </div>
    </div>
  )
}

const splitIds = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean)

function CardEditor({ card }: { card: TestCard }) {
  const scenario = useStore((s) => s.scenario)
  const { deleteCard, toggleCardEntity, addRun, updateRun, updateCard, newCardVersion, select } =
    useStore.getState()
  const campaignValues = [
    ...new Set(
      [
        ...scenario.testCards.map((c) => c.campaign),
        ...CARD_TEMPLATES.map((t) => t.category),
      ].filter(Boolean),
    ),
  ]

  const fillExpectedFromAnalysis = () => {
    const { assessments, report, impacts } = engagementPicture(scenario)
    const aar = buildAarSummary(scenario, assessments, report, impacts)
    const lines = [`Planning envelope · full-run expected: ${aarHeadline(aar)}`]
    for (const t of aar.threats) {
      lines.push(`${t.name}: ${t.outcome}, leak ${Math.round(t.leakProbability * 100)}%`)
    }
    updateCard(card.id, { expectedResults: lines.join('\n') })
  }

  return (
    <div className="inspector-body">
      <Options id="dl-card-campaign" values={campaignValues} />
      <Options id="dl-card-iv" values={STANDARD_IVS} />
      <ObjectHeader name={card.cardId} type={`Test card · version ${card.version}`} />
      <div className="inspector-actions">
        <button className="mini" onClick={() => select({ cardId: newCardVersion(card.id) })}>
          New version
        </button>
      </div>
      <TextField card={card} field="campaign" label="Campaign" listId="dl-card-campaign" />
      <div className="field">
        <span>Question IDs</span>
        {splitIds(card.questionIds).length === 0 && (
          <div className="muted small">No question IDs yet. Add an ID below.</div>
        )}
        <CheckPicker
          values={splitIds(card.questionIds)}
          options={[]}
          addPlaceholder="Add question ID"
          onChange={(next) => updateCard(card.id, { questionIds: next.join(', ') })}
        />
      </div>
      <TextField
        card={card}
        field="customerQuestion"
        label="Customer question"
        rows={2}
        action={
          <PickSelect
            placeholder="From template…"
            options={[...new Set(CARD_TEMPLATES.map((t) => t.customerQuestion))]}
            onPick={(v) => updateCard(card.id, { customerQuestion: v })}
          />
        }
      />
      <TextField
        card={card}
        field="purpose"
        label="Test purpose"
        rows={2}
        action={
          <PickSelect
            placeholder="From template…"
            options={[...new Set(CARD_TEMPLATES.map((t) => t.purpose))]}
            onPick={(v) => updateCard(card.id, { purpose: v })}
          />
        }
      />
      <TextField card={card} field="hypothesis" label="Hypothesis" rows={2} />
      <TextField
        card={card}
        field="configuration"
        label="System configuration"
        rows={2}
        action={
          <button
            className="mini"
            onClick={() => updateCard(card.id, { configuration: describeConfiguration(scenario) })}
          >
            Fill from scenario
          </button>
        }
      />
      <TextField
        card={card}
        field="threatProfile"
        label="Threat profile"
        action={
          <button
            className="mini"
            onClick={() => updateCard(card.id, { threatProfile: describeThreats(scenario) })}
          >
            Fill from scenario
          </button>
        }
      />
      <TextField card={card} field="independentVars" label="Independent variables" listId="dl-card-iv" />
      <TextField
        card={card}
        field="controlledVars"
        label="Controlled variables"
        action={
          <button
            className="mini"
            onClick={() =>
              updateCard(card.id, { controlledVars: controlledVarsText(scenario.environment) })
            }
          >
            Fill from environment
          </button>
        }
      />
      <TextField
        card={card}
        field="covariates"
        label="Covariates"
        action={
          <button
            className="mini"
            onClick={() => updateCard(card.id, { covariates: standardCovariates(scenario.environment) })}
          >
            Refresh from environment
          </button>
        }
      />
      <div className="field">
        <span>Measures</span>
        <CheckPicker
          values={card.measures}
          options={MEASURES_DTI.map((m) => ({ value: m, label: m }))}
          addPlaceholder="Add measure"
          onChange={(next) => updateCard(card.id, { measures: next })}
        />
      </div>
      <ListField card={card} field="procedure" label="Procedure (one step per line)" />
      <TextField card={card} field="thresholds" label="Thresholds" rows={2} />
      <TextField card={card} field="abortCriteria" label="Safety / abort criteria" rows={2} />
      <TextField
        card={card}
        field="expectedResults"
        label="Expected results"
        rows={2}
        action={
          <button className="mini" onClick={fillExpectedFromAnalysis}>
            Fill from analysis
          </button>
        }
      />

      <div className="subsection">
        <div className="panel-subtitle">Linked entities (highlighted on canvas)</div>
        {scenario.entities.length === 0 && <div className="muted small">No entities on the canvas yet.</div>}
        {scenario.entities.map((e) => (
          <label key={e.id} className="check-row">
            <input
              type="checkbox"
              checked={card.linkedEntityIds.includes(e.id)}
              onChange={() => toggleCardEntity(card.id, e.id)}
            />
            {e.name} <span className="muted">({e.kind})</span>
          </label>
        ))}
      </div>

      <div className="subsection">
        <div className="panel-subtitle">
          Run log
          <button className="mini" onClick={() => addRun(card.id)}>
            + run
          </button>
        </div>
        {card.runs.map((r) => (
          <div key={r.id} className="run-row">
            <div className="field-row">
              <Field label="Run">
                <input value={r.runId} readOnly />
              </Field>
              <Field label="Validity">
                <select
                  value={r.validity}
                  onChange={(e) =>
                    updateRun(card.id, r.id, { validity: e.target.value as typeof r.validity })
                  }
                >
                  <option value="pending">pending</option>
                  <option value="valid">valid</option>
                  <option value="valid-limited">valid, limited</option>
                  <option value="invalid">invalid</option>
                </select>
              </Field>
            </div>
            <Field label="Result">
              <textarea
                rows={2}
                value={r.result}
                onChange={(e) => updateRun(card.id, r.id, { result: e.target.value })}
              />
            </Field>
            <Field label="Deviations">
              <input
                value={r.deviations}
                onChange={(e) => updateRun(card.id, r.id, { deviations: e.target.value })}
              />
            </Field>
          </div>
        ))}
      </div>

      <div className="inspector-actions">
        <button
          className="danger"
          onClick={() => {
            deleteCard(card.id)
            select({ cardId: null })
          }}
        >
          Delete card
        </button>
      </div>
    </div>
  )
}

export function TestCardsPanel() {
  const cards = useStore((s) => s.scenario.testCards)
  const environment = useStore((s) => s.scenario.environment)
  const selectedId = useStore((s) => s.selection.cardId)
  const hasEntitySelection = useStore((s) => s.selection.entityIds.length > 0)
  const { addCard, addCardFromSelection, select } = useStore.getState()
  const selected = cards.find((c) => c.id === selectedId)

  return (
    <div className="cards-panel">
      <div className="cards-list">
        {cards.map((c) => (
          <button
            key={c.id}
            className={`card-chip ${selectedId === c.id ? 'active' : ''}`}
            onClick={() => select({ cardId: c.id })}
          >
            {c.cardId} v{c.version}
          </button>
        ))}
        <button className="card-chip add" onClick={() => select({ cardId: addCard() })}>
          + New card
        </button>
        {hasEntitySelection && (
          <button className="card-chip add" onClick={() => select({ cardId: addCardFromSelection() })}>
            + New card from selection
          </button>
        )}
        <select
          className="card-chip add"
          value=""
          onChange={(e) => {
            const t = CARD_TEMPLATES.find((x) => x.name === e.target.value)
            if (t) select({ cardId: addCard(cardFromTemplate(t, environment)) })
          }}
        >
          <option value="">+ From scenario template…</option>
          {CARD_TEMPLATES.map((t) => (
            <option key={t.name} value={t.name}>
              {t.category}: {t.name}
            </option>
          ))}
        </select>
      </div>
      {selected ? (
        <CardEditor card={selected} />
      ) : (
        <div className="inspector-body insp">
          <Section label="Test card">
            <EmptyState
              title="No card selected"
              body="Test cards follow the Field Guide standard card. Create one, fill the test logic, and link the entities that execute it."
            />
          </Section>
        </div>
      )}
    </div>
  )
}

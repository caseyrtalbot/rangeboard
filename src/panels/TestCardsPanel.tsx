import type { TestCard } from '../model/types'
import { CARD_TEMPLATES, cardFromTemplate } from '../model/seedCards'
import { useStore } from '../state/store'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function TextField({
  card,
  field,
  label,
  rows,
}: {
  card: TestCard
  field: keyof TestCard
  label: string
  rows?: number
}) {
  const updateCard = useStore((s) => s.updateCard)
  const value = card[field] as string
  return (
    <Field label={label}>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => updateCard(card.id, { [field]: e.target.value })} />
      ) : (
        <input value={value} onChange={(e) => updateCard(card.id, { [field]: e.target.value })} />
      )}
    </Field>
  )
}

/** One line per item; edits round-trip through a textarea. */
function ListField({
  card,
  field,
  label,
}: {
  card: TestCard
  field: 'measures' | 'procedure'
  label: string
}) {
  const updateCard = useStore((s) => s.updateCard)
  return (
    <Field label={label}>
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

function CardEditor({ card }: { card: TestCard }) {
  const scenario = useStore((s) => s.scenario)
  const { deleteCard, toggleCardEntity, addRun, updateRun, select } = useStore.getState()

  return (
    <div className="inspector-body">
      <div className="field-row">
        <TextField card={card} field="cardId" label="Test card ID" />
        <TextField card={card} field="version" label="Version" />
      </div>
      <div className="field-row">
        <TextField card={card} field="campaign" label="Campaign" />
        <TextField card={card} field="questionIds" label="Question IDs" />
      </div>
      <TextField card={card} field="customerQuestion" label="Customer question" rows={2} />
      <TextField card={card} field="purpose" label="Test purpose" rows={2} />
      <TextField card={card} field="hypothesis" label="Hypothesis" rows={2} />
      <TextField card={card} field="configuration" label="System configuration" rows={2} />
      <TextField card={card} field="threatProfile" label="Threat profile" />
      <TextField card={card} field="independentVars" label="Independent variables" />
      <TextField card={card} field="controlledVars" label="Controlled variables" />
      <TextField card={card} field="covariates" label="Covariates" />
      <ListField card={card} field="measures" label="Measures (one per line)" />
      <ListField card={card} field="procedure" label="Procedure (one step per line)" />
      <TextField card={card} field="thresholds" label="Thresholds" rows={2} />
      <TextField card={card} field="abortCriteria" label="Safety / abort criteria" rows={2} />
      <TextField card={card} field="expectedResults" label="Expected results" rows={2} />

      <div className="subsection">
        <div className="panel-subtitle">Linked entities (highlighted on canvas)</div>
        {scenario.entities.length === 0 && <div className="muted">No entities on the canvas yet.</div>}
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
                <input
                  value={r.runId}
                  onChange={(e) => updateRun(card.id, r.id, { runId: e.target.value })}
                />
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
  const { addCard, select } = useStore.getState()
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
        <div className="inspector-body muted">
          <p>Test cards follow the Field Guide standard card. Create one, fill the test logic, and
          link the entities that execute it.</p>
        </div>
      )}
    </div>
  )
}

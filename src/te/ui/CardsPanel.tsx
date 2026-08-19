import { useState } from 'react'
import type { FactorClass, ProcedureStep, TeCampaign, TeCard, TeRecordStatus } from '../model/types'
import { RUN_ROLES } from '../model/types'
import { useTeStore } from '../state/teStore'
import { emptyProcedureStep, nowIso } from '../model/empty'
import { CARD_TEMPLATES } from '../seed/cardTemplates'
import { PrintOverlay } from '../print/PrintOverlay'
import { TestCardPrint } from '../print/TestCardPrint'
import {
  ChipList,
  Field,
  GateList,
  LinesField,
  MultiPicker,
  NumberField,
  Pill,
  SelectField,
  SubTitle,
  TextField,
  fmtDate,
} from './kit'

const DEFAULT_EVENT_MARKS = [
  'start recording',
  'start run',
  'threat enters eligibility region',
  'first detection',
  'first stable track',
  'usable C2 track',
  'operator decision',
  'protected-boundary crossing',
  'run complete',
  'stop recording',
]

function statusKind(s: TeRecordStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (s === 'issued') return 'good'
  if (s === 'approved' || s === 'in-review') return 'warn'
  if (s === 'withdrawn') return 'bad'
  return 'neutral'
}

function CardEditor({ campaign, card }: { campaign: TeCampaign; card: TeCard }) {
  const { patchItem, issueCard, reviseCard, selectRecord } = useTeStore.getState()
  const [issueBlockers, setIssueBlockers] = useState<string[]>([])
  const [printing, setPrinting] = useState(false)
  const frozen = card.status === 'issued' || card.status === 'superseded'
  const set = (patch: Partial<TeCard>) => patchItem('cards', card.id, patch)
  const setStep = (stepId: string, patch: Partial<ProcedureStep>) =>
    set({ procedure: card.procedure.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) })
  const moveStep = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= card.procedure.length) return
    const next = [...card.procedure]
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    set({ procedure: next })
  }
  const factorOpts = (cls: FactorClass) =>
    campaign.factors
      .filter((f) => f.classification === cls)
      .map((f) => ({ id: f.id, label: f.name || f.id }))
  const runs = campaign.runs.filter((r) => r.cardId === card.id)
  const devs = campaign.deviations.filter((d) => d.cardId === card.id)

  const recordGate = (kind: 'cold' | 'dry') => {
    const by = window.prompt(kind === 'cold' ? 'Cold reader name?' : 'Dry-run lead name?')
    if (!by || !by.trim()) return
    if (kind === 'cold') set({ coldReaderBy: by.trim(), coldReaderAt: nowIso() })
    else set({ dryRunBy: by.trim(), dryRunAt: nowIso() })
  }

  const autoFill = () => {
    const patch: Partial<TeCard> = {}
    const hyp = card.hypothesisIds
      .map((id) => campaign.hypotheses.find((h) => h.id === id))
      .find((h) => h != null)
    if (hyp) {
      const text = [hyp.predictedValue, hyp.producesBehavior].filter((t) => t.trim() !== '').join('; ')
      if (text) patch.prediction = text
    }
    if (!card.purpose.trim()) {
      const q = card.questionIds
        .map((id) => campaign.questions.find((x) => x.id === id))
        .find((x) => x != null)
      if (q && q.wording.trim()) patch.purpose = q.wording
    }
    if (card.eventMarks.length === 0) patch.eventMarks = [...DEFAULT_EVENT_MARKS]
    if (card.preconditions.length === 0 && campaign.authorities.length > 0) {
      patch.preconditions = campaign.authorities.map((a) => `${a.authorityType || 'authority'}: ${a.status}`)
    }
    set(patch)
  }

  return (
    <div className="run-row">
      <div className="inspector-actions">
        <Pill kind={statusKind(card.status)} text={`${card.status} ${card.version}`} />
        <button className="mini" disabled={frozen} onClick={() => recordGate('cold')}>
          Record cold-reader pass
        </button>
        <button className="mini" disabled={frozen} onClick={() => recordGate('dry')}>
          Record dry-run pass
        </button>
        <button className="mini" disabled={card.status !== 'draft'} onClick={autoFill}>
          Auto-fill from design
        </button>
        <button className="primary" disabled={frozen} onClick={() => setIssueBlockers(issueCard(card.id))}>
          Issue card
        </button>
        {card.status === 'issued' && (
          <button
            className="mini"
            onClick={() => {
              const nid = reviseCard(card.id)
              if (nid) selectRecord('cards', nid)
            }}
          >
            Revise (new version)
          </button>
        )}
        <button className="mini" onClick={() => setPrinting(true)}>Print</button>
      </div>
      <p className="muted small">
        Cold reader: {card.coldReaderAt ? `${card.coldReaderBy} ${fmtDate(card.coldReaderAt)}` : 'not recorded'}.
        Dry run: {card.dryRunAt ? `${card.dryRunBy} ${fmtDate(card.dryRunAt)}` : 'not recorded'}.
      </p>
      <GateList items={issueBlockers} kind="bad" />
      {frozen && (
        <p className="muted small">
          Issued cards are frozen. Record a deviation, or revise to a new version.
        </p>
      )}

      <SubTitle>1. Control</SubTitle>
      <div className="field-row">
        <TextField label="Title" value={card.title} onChange={(v) => set({ title: v })} disabled={frozen} />
        <TextField label="Version" value={card.version} onChange={(v) => set({ version: v })} disabled={frozen} />
      </div>
      <div className="field-row">
        <TextField label="Owner" value={card.owner} onChange={(v) => set({ owner: v })} disabled={frozen} />
        <TextField label="Approvers" value={card.approvers} onChange={(v) => set({ approvers: v })} disabled={frozen} />
      </div>
      <p className="muted small">
        Card {card.cardCode}; effective {card.effectiveAt ? fmtDate(card.effectiveAt) : 'not issued'}.
      </p>

      <SubTitle>2. Traceability</SubTitle>
      <MultiPicker
        label="Questions"
        options={campaign.questions.map((q) => ({ id: q.id, label: `${q.id} ${q.wording.slice(0, 40)}` }))}
        value={card.questionIds}
        onChange={(v) => set({ questionIds: v })}
        disabled={frozen}
      />
      <MultiPicker
        label="Hypotheses"
        options={campaign.hypotheses.map((h) => ({ id: h.id, label: `${h.id} ${h.producesBehavior.slice(0, 40)}` }))}
        value={card.hypothesisIds}
        onChange={(v) => set({ hypothesisIds: v })}
        disabled={frozen}
      />
      <MultiPicker
        label="Measures"
        options={campaign.measures.map((m) => ({ id: m.id, label: `${m.id} ${m.name}` }))}
        value={card.measureIds}
        onChange={(v) => set({ measureIds: v })}
        disabled={frozen}
      />
      <div className="field-row">
        <SelectField label="Matrix cell" value={card.matrixCellId} allowEmpty="not set" options={campaign.matrix.map((x) => ({ v: x.id, label: `${x.id} ${x.method.slice(0, 24)}` }))} onChange={(v) => set({ matrixCellId: v })} disabled={frozen} />
        <SelectField label="Configuration" value={card.configId} allowEmpty="not set" options={campaign.configs.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))} onChange={(v) => set({ configId: v })} disabled={frozen} />
      </div>
      <div className="field-row">
        <SelectField label="Threat" value={card.threatId} allowEmpty="not set" options={campaign.threats.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))} onChange={(v) => set({ threatId: v })} disabled={frozen} />
        <SelectField label="Condition" value={card.conditionId} allowEmpty="not set" options={campaign.conditions.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))} onChange={(v) => set({ conditionId: v })} disabled={frozen} />
      </div>

      <SubTitle>3. Purpose and intent</SubTitle>
      <TextField label="Purpose (one sentence: why the run exists)" rows={2} value={card.purpose} onChange={(v) => set({ purpose: v })} disabled={frozen} />
      <TextField label="Why this is the highest-value next run" value={card.whyHighestValueNext} onChange={(v) => set({ whyHighestValueNext: v })} disabled={frozen} />
      <TextField label="Result that could change the decision" value={card.resultThatCouldChangeDecision} onChange={(v) => set({ resultThatCouldChangeDecision: v })} disabled={frozen} />
      <div className="field-row">
        <TextField label="Prediction" value={card.prediction} onChange={(v) => set({ prediction: v })} disabled={frozen} />
        <TextField label="Changed factor" value={card.changedFactor} onChange={(v) => set({ changedFactor: v })} disabled={frozen} />
      </div>

      <SubTitle>4. Planned repetition</SubTitle>
      <div className="field-row">
        <NumberField label="Repetition number" value={card.repetitionNumber} onChange={(v) => set({ repetitionNumber: v ?? 1 })} disabled={frozen} />
        <NumberField label="Minimum valid sample" value={card.minValidSample} onChange={(v) => set({ minValidSample: v ?? 1 })} disabled={frozen} />
      </div>
      <div className="field-row">
        <TextField label="Priority reason" value={card.priorityReason} onChange={(v) => set({ priorityReason: v })} disabled={frozen} />
        <TextField label="Order and blocking" value={card.orderAndBlocking} onChange={(v) => set({ orderAndBlocking: v })} disabled={frozen} />
      </div>

      <SubTitle>5. System state</SubTitle>
      <TextField label="System state" rows={2} value={card.systemStateNote} onChange={(v) => set({ systemStateNote: v })} disabled={frozen} />
      <div className="field-row">
        <TextField label="Operators" value={card.operators} onChange={(v) => set({ operators: v })} disabled={frozen} />
        <TextField label="Training state" value={card.trainingState} onChange={(v) => set({ trainingState: v })} disabled={frozen} />
      </div>

      <SubTitle>6. Threat state</SubTitle>
      <TextField label="Red initial state" rows={2} value={card.redInitialState} onChange={(v) => set({ redInitialState: v })} disabled={frozen} />
      <div className="field-row">
        <TextField label="Red-controlled variables" value={card.redControlled} onChange={(v) => set({ redControlled: v })} disabled={frozen} />
        <TextField label="Red fixed variables" value={card.redFixed} onChange={(v) => set({ redFixed: v })} disabled={frozen} />
      </div>
      <TextField label="Blinding and information control" value={card.blinding} onChange={(v) => set({ blinding: v })} disabled={frozen} />
      <div className="field-row">
        <TextField label="Invalidating red deviations" value={card.invalidatingRedDeviations} onChange={(v) => set({ invalidatingRedDeviations: v })} disabled={frozen} />
        <TextField label="Reset before repeat" value={card.resetBeforeRepeat} onChange={(v) => set({ resetBeforeRepeat: v })} disabled={frozen} />
      </div>

      <SubTitle>7. Condition</SubTitle>
      <TextField label="Condition notes" rows={2} value={card.conditionNote} onChange={(v) => set({ conditionNote: v })} disabled={frozen} />
      <TextField label="Operating limits" value={card.operatingLimits} onChange={(v) => set({ operatingLimits: v })} disabled={frozen} />

      <SubTitle>8. Variables</SubTitle>
      <MultiPicker label="Independent variables" options={factorOpts('independent-variable')} value={card.independentFactorIds} onChange={(v) => set({ independentFactorIds: v })} disabled={frozen} />
      <MultiPicker label="Held controls" options={factorOpts('held-control')} value={card.heldFactorIds} onChange={(v) => set({ heldFactorIds: v })} disabled={frozen} />
      <MultiPicker label="Recorded covariates" options={factorOpts('recorded-covariate')} value={card.covariateFactorIds} onChange={(v) => set({ covariateFactorIds: v })} disabled={frozen} />

      <SubTitle>9. Measures</SubTitle>
      {card.measureIds.length === 0 && <p className="muted small">No measures linked yet. Link them in section 2.</p>}
      {card.measureIds.map((id) => {
        const m = campaign.measures.find((x) => x.id === id)
        return (
          <div key={id} className="muted small">
            {m ? `${m.id}: ${m.name} (${m.unit || 'no unit'})` : id}
          </div>
        )
      })}
      <TextField label="Card-local measures note" rows={2} value={card.measuresNote} onChange={(v) => set({ measuresNote: v })} disabled={frozen} />

      <SubTitle>10. Data and truth</SubTitle>
      <TextField label="Data sources" rows={2} value={card.dataSources} onChange={(v) => set({ dataSources: v })} disabled={frozen} />
      <TextField label="Ground truth" rows={2} value={card.groundTruth} onChange={(v) => set({ groundTruth: v })} disabled={frozen} />
      <div className="field-row">
        <TextField label="Common time and tolerance" value={card.commonTimeAndTolerance} onChange={(v) => set({ commonTimeAndTolerance: v })} disabled={frozen} />
        <TextField label="Monitoring and fallback" value={card.monitoringAndFallback} onChange={(v) => set({ monitoringAndFallback: v })} disabled={frozen} />
      </div>
      <LinesField label="Event marks (tap-button vocabulary, one per line)" value={card.eventMarks} onChange={(v) => set({ eventMarks: v })} disabled={frozen} />

      <SubTitle>11. Preconditions</SubTitle>
      <LinesField label="Required state before start (one per line)" value={card.preconditions} onChange={(v) => set({ preconditions: v })} disabled={frozen} />

      <SubTitle
        action={
          <button className="mini" disabled={frozen} onClick={() => set({ procedure: [...card.procedure, emptyProcedureStep()] })}>
            + step
          </button>
        }
      >
        12. Procedure
      </SubTitle>
      <div className="field-row">
        <TextField label="Start call" value={card.siteCalls.start} onChange={(v) => set({ siteCalls: { ...card.siteCalls, start: v } })} disabled={frozen} />
        <TextField label="Pause call" value={card.siteCalls.pause} onChange={(v) => set({ siteCalls: { ...card.siteCalls, pause: v } })} disabled={frozen} />
        <TextField label="Stop call" value={card.siteCalls.stop} onChange={(v) => set({ siteCalls: { ...card.siteCalls, stop: v } })} disabled={frozen} />
        <TextField label="Abort call" value={card.siteCalls.abort} onChange={(v) => set({ siteCalls: { ...card.siteCalls, abort: v } })} disabled={frozen} />
      </div>
      <div className="field-row">
        <NumberField label="Pre-event margin (s)" value={card.preEventMarginS} onChange={(v) => set({ preEventMarginS: v ?? 0 })} disabled={frozen} />
        <NumberField label="Post-event margin (s)" value={card.postEventMarginS} onChange={(v) => set({ postEventMarginS: v ?? 0 })} disabled={frozen} />
      </div>
      {card.procedure.map((s, i) => (
        <div key={s.id} className="field-row te-table-row">
          <Field label={`Step ${i + 1} action`}>
            <input value={s.action} disabled={frozen} onChange={(e) => setStep(s.id, { action: e.target.value })} />
          </Field>
          <SelectField label="Role" value={s.role} options={RUN_ROLES.map((v) => ({ v, label: v }))} onChange={(v) => v && setStep(s.id, { role: v })} disabled={frozen} />
          <Field label="Complete when">
            <input value={s.observableCompletion} disabled={frozen} onChange={(e) => setStep(s.id, { observableCompletion: e.target.value })} />
          </Field>
          <Field label="INV">
            <input type="checkbox" checked={s.canSilentlyInvalidate} disabled={frozen} onChange={(e) => setStep(s.id, { canSilentlyInvalidate: e.target.checked })} />
          </Field>
          <Field label="REC">
            <input type="checkbox" checked={s.isRecorderStartStop} disabled={frozen} onChange={(e) => setStep(s.id, { isRecorderStartStop: e.target.checked })} />
          </Field>
          <button className="mini" disabled={frozen || i === 0} onClick={() => moveStep(i, -1)}>↑</button>
          <button className="mini" disabled={frozen || i === card.procedure.length - 1} onClick={() => moveStep(i, 1)}>↓</button>
          <button className="mini danger" disabled={frozen} onClick={() => set({ procedure: card.procedure.filter((x) => x.id !== s.id) })}>×</button>
        </div>
      ))}

      <SubTitle>13. Expected result</SubTitle>
      <TextField label="Nominal behavior" rows={2} value={card.expectedResult} onChange={(v) => set({ expectedResult: v })} disabled={frozen} />
      <TextField label="Known expected artifacts" value={card.knownArtifacts} onChange={(v) => set({ knownArtifacts: v })} disabled={frozen} />

      <SubTitle>14. Stop and restart</SubTitle>
      <TextField label="Safety and regulatory stops" rows={2} value={card.safetyStops} onChange={(v) => set({ safetyStops: v })} disabled={frozen} />
      <TextField label="Data and equipment stops" rows={2} value={card.dataEquipmentStops} onChange={(v) => set({ dataEquipmentStops: v })} disabled={frozen} />
      <div className="field-row">
        <TextField label="Safe state" value={card.safeState} onChange={(v) => set({ safeState: v })} disabled={frozen} />
        <TextField label="Restart authority" value={card.restartAuthority} onChange={(v) => set({ restartAuthority: v })} disabled={frozen} />
      </div>
      <TextField label="Run-specific hold conditions" rows={2} value={card.holdConditions} onChange={(v) => set({ holdConditions: v })} disabled={frozen} />

      <SubTitle>15. Validity and repeat</SubTitle>
      <TextField label="Required validity conditions" rows={2} value={card.requiredValidityConditions} onChange={(v) => set({ requiredValidityConditions: v })} disabled={frozen} />
      <TextField label="Invalidating failures" rows={2} value={card.invalidatingFailures} onChange={(v) => set({ invalidatingFailures: v })} disabled={frozen} />
      <TextField label="Conditional uses" rows={2} value={card.conditionalUses} onChange={(v) => set({ conditionalUses: v })} disabled={frozen} />

      <SubTitle>16. Outputs</SubTitle>
      <TextField label="Required files" rows={2} value={card.requiredFiles} onChange={(v) => set({ requiredFiles: v })} disabled={frozen} />
      <TextField label="Storage path" value={card.storagePath} onChange={(v) => set({ storagePath: v })} disabled={frozen} />

      <SubTitle>17. Deviations and runs</SubTitle>
      {runs.length === 0 && <p className="muted small">No runs executed against this card yet.</p>}
      {runs.map((r) => (
        <div key={r.id} className="muted small">
          {r.id}: {r.validity}
          {r.excluded ? ' (excluded)' : ''}
        </div>
      ))}
      {devs.map((d) => (
        <div key={d.id} className="muted small">
          {d.id} on {d.runId}: {d.actualState || 'deviation'} ({d.effect}, {d.disposition})
        </div>
      ))}
      <p className="muted small">
        Never edit this card to match what occurred. Record a deviation. A deviation that becomes
        the intended method requires a new card version.
      </p>

      <SubTitle>18. Allowed conclusion</SubTitle>
      <TextField label="What this run's evidence may support" rows={2} value={card.allowedConclusion} onChange={(v) => set({ allowedConclusion: v })} disabled={frozen} />

      <SubTitle>19. Prohibited conclusion</SubTitle>
      <TextField label="What must not be inferred" rows={2} value={card.prohibitedConclusion} onChange={(v) => set({ prohibitedConclusion: v })} disabled={frozen} />

      <MultiPicker
        label="Canvas frames"
        options={campaign.frames.map((f) => ({ id: f.id, label: f.name }))}
        value={card.frameIds}
        onChange={(v) => set({ frameIds: v })}
        disabled={frozen}
      />

      {printing && (
        <PrintOverlay title={`Test card ${card.cardCode} ${card.version}`} onClose={() => setPrinting(false)}>
          <TestCardPrint campaign={campaign} card={card} />
        </PrintOverlay>
      )}
    </div>
  )
}

export function CardsPanel({ campaign }: { campaign: TeCampaign }) {
  const { addCard, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.cards ?? null)
  const card = campaign.cards.find((c) => c.id === selected)
  return (
    <div className="te-panel">
      <div className="inspector-body">
        <ChipList
          items={campaign.cards.map((c) => ({
            id: c.id,
            label: `${c.cardCode} ${c.version} (${c.status})`,
            dim: c.status === 'superseded',
          }))}
          selectedId={selected}
          onSelect={(id) => selectRecord('cards', id)}
          onAdd={() => selectRecord('cards', addCard())}
          addLabel="+ New card"
        />
        <Field label="+ From template">
          <select
            value=""
            onChange={(e) => {
              const t = CARD_TEMPLATES.find((x) => x.key === e.target.value)
              if (!t) return
              selectRecord('cards', addCard(t.patch))
            }}
          >
            <option value="">pick a worked template…</option>
            {CARD_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.key}: {t.name}
              </option>
            ))}
          </select>
        </Field>
        {card ? (
          <CardEditor key={card.id} campaign={campaign} card={card} />
        ) : (
          <p className="muted small">Select a card, create a new one, or start from a template.</p>
        )}
      </div>
    </div>
  )
}

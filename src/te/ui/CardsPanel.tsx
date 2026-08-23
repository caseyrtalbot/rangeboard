import { useState } from 'react'
import type { FactorClass, ProcedureStep, TeCampaign, TeCard, TeRecordStatus } from '../model/types'
import { RUN_ROLES } from '../model/types'
import { linkedRecordFill, useTeStore } from '../state/teStore'
import { emptyProcedureStep, nowIso } from '../model/empty'
import { cardIssueBlockers } from '../validate'
import { CARD_TEMPLATES } from '../seed/cardTemplates'
import { DATA_STANDARDS } from '../seed/constants'
import { PrintOverlay } from '../print/PrintOverlay'
import { TestCardPrint } from '../print/TestCardPrint'
import { GENERIC_MARKS } from '../seed/constants'
import { HELP, allPeople } from './help'
import {
  ChipList,
  Field,
  GateList,
  MultiPicker,
  NumberField,
  PersonField,
  PhaseIntro,
  Pill,
  SelectField,
  SubTitle,
  SuggestField,
  TextField,
  VersionField,
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

/**
 * Check rows over a known string vocabulary plus one free-add row.
 * Checked rows are the stored lines; storage stays string[].
 */
function LineChecklist({
  label,
  options,
  value,
  onChange,
  help,
  disabled,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  help?: string
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')
  const known = [...new Set(options.map((o) => o.trim()).filter((o) => o !== ''))]
  const trimmed = value.map((v) => v.trim())
  const countOf = (line: string) => trimmed.filter((t) => t === line).length
  const extras: string[] = []
  for (const t of trimmed) {
    if (!known.includes(t) && !extras.includes(t)) extras.push(t)
  }
  const removeOne = (line: string) => {
    const i = trimmed.indexOf(line)
    onChange(value.filter((_, j) => j !== i))
  }
  const toggle = (line: string) =>
    countOf(line) > 0 ? removeOne(line) : onChange([...value, line])
  const add = () => {
    const line = draft.trim()
    if (line === '' || trimmed.includes(line)) return
    onChange([...value, line])
    setDraft('')
  }
  return (
    <div className="subsection">
      <div className="panel-subtitle">
        {label}
        {help && (
          <span className="help-dot" tabIndex={0} data-help={help}>
            ?
          </span>
        )}
      </div>
      {known.map((o) => (
        <label key={o} className="check-row">
          <input type="checkbox" checked={countOf(o) > 0} disabled={disabled} onChange={() => toggle(o)} />
          {countOf(o) > 1 ? `${o} x${countOf(o)}` : o}
        </label>
      ))}
      {extras.map((x) => (
        <label key={x} className="check-row" title="Uncheck removes this line.">
          <input type="checkbox" checked disabled={disabled} onChange={() => removeOne(x)} />
          {countOf(x) > 1 ? `${x} x${countOf(x)}` : x}
        </label>
      ))}
      {!disabled && (
        <div className="field-row">
          <input
            value={draft}
            placeholder="Add your own"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
          />
          <button type="button" className="mini" disabled={draft.trim() === ''} onClick={add}>
            Add
          </button>
        </div>
      )}
    </div>
  )
}

function statusKind(s: TeRecordStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (s === 'issued') return 'good'
  if (s === 'approved' || s === 'in-review') return 'warn'
  if (s === 'withdrawn') return 'bad'
  return 'neutral'
}

function CardEditor({ campaign, card }: { campaign: TeCampaign; card: TeCard }) {
  const { patchItem, issueCard, reviseCard, selectRecord } = useTeStore.getState()
  const [printing, setPrinting] = useState(false)
  const frozen = card.status === 'issued' || card.status === 'superseded'
  const people = allPeople(campaign)
  const issueBlockers = frozen ? [] : cardIssueBlockers(campaign, card)
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

  /** Applies a link change plus the empty-field fill the new links allow. */
  const applyLinks = (links: Partial<TeCard>) => {
    const next = { ...card, ...links }
    set({ ...links, ...linkedRecordFill(campaign, next) })
  }

  const pickMatrixCell = (v: string | null) => {
    const cell = campaign.matrix.find((x) => x.id === v)
    if (!cell) {
      set({ matrixCellId: v })
      return
    }
    applyLinks({
      matrixCellId: v,
      questionIds: [...new Set([...card.questionIds, cell.questionId])].filter((id) => id !== ''),
      hypothesisIds:
        cell.hypothesisId && !card.hypothesisIds.includes(cell.hypothesisId)
          ? [...card.hypothesisIds, cell.hypothesisId]
          : card.hypothesisIds,
      configId: cell.configId || card.configId,
      threatId: cell.threatId || card.threatId,
      conditionId: cell.conditionId || card.conditionId,
      measureIds: [...new Set([...card.measureIds, ...cell.measureIds])],
    })
  }

  const autoFill = () => {
    const patch: Partial<TeCard> = linkedRecordFill(campaign, card)
    if (card.eventMarks.length === 0) patch.eventMarks = [...DEFAULT_EVENT_MARKS]
    if (card.preconditions.length === 0 && campaign.authorities.length > 0) {
      patch.preconditions = campaign.authorities.map((a) => `${a.authorityType || 'authority'}: ${a.status}`)
    }
    set(patch)
  }

  const refill = () => {
    if (!window.confirm('Refill every linked field? This overwrites existing text.')) return
    set(linkedRecordFill(campaign, card, true))
  }

  const threat = campaign.threats.find((x) => x.id === card.threatId)
  const condition = campaign.conditions.find((x) => x.id === card.conditionId)
  const linkedMeasures = card.measureIds
    .map((id) => campaign.measures.find((m) => m.id === id))
    .filter((m) => m !== undefined)
  const otherCards = campaign.cards.filter((x) => x.id !== card.id)
  const changedFactorNames = campaign.factors
    .filter((x) => x.classification === 'independent-variable')
    .map((x) => x.name || x.id)
  const changedFactorOpts = (
    card.changedFactor && !changedFactorNames.includes(card.changedFactor)
      ? [card.changedFactor, ...changedFactorNames]
      : changedFactorNames
  ).map((x) => ({ v: x, label: x }))
  const markVocabulary = [
    ...DEFAULT_EVENT_MARKS,
    ...GENERIC_MARKS,
    ...linkedMeasures.flatMap((m) => [m.startEvent, m.stopEvent]),
  ]
  const authorityLines = campaign.authorities.map((a) => `${a.authorityType || 'authority'}: ${a.status}`)
  const siteCallSuggestions = (key: 'start' | 'pause' | 'stop' | 'abort', standard: string) => [
    standard,
    ...otherCards.map((x) => x.siteCalls[key]),
  ]

  return (
    <div className="run-row">
      {!frozen && (
        <>
          <SubTitle
            action={
              <span className="help-dot" tabIndex={0} data-help={HELP['card-issue']}>
                ?
              </span>
            }
          >
            Issue gate
          </SubTitle>
          <Pill
            kind={issueBlockers.length ? 'warn' : 'good'}
            text={issueBlockers.length ? `${issueBlockers.length} blocker(s)` : 'ready to issue'}
          />
          <GateList items={issueBlockers} kind="bad" />
          <div className="field-row">
            <PersonField label="Cold reader" value={card.coldReaderBy} onChange={(v) => set(card.coldReaderAt ? { coldReaderBy: v, coldReaderAt: null } : { coldReaderBy: v })} people={people} help={HELP['cold-reader']} />
            <div className="field">
              <span>&nbsp;</span>
              <button className="mini" disabled={!card.coldReaderBy.trim()} onClick={() => set({ coldReaderBy: card.coldReaderBy, coldReaderAt: nowIso() })}>
                Record check
              </button>
            </div>
            <PersonField label="Dry-run lead" value={card.dryRunBy} onChange={(v) => set(card.dryRunAt ? { dryRunBy: v, dryRunAt: null } : { dryRunBy: v })} people={people} help={HELP['dry-run']} />
            <div className="field">
              <span>&nbsp;</span>
              <button className="mini" disabled={!card.dryRunBy.trim()} onClick={() => set({ dryRunBy: card.dryRunBy, dryRunAt: nowIso() })}>
                Record check
              </button>
            </div>
          </div>
        </>
      )}
      <div className="inspector-actions">
        <Pill kind={statusKind(card.status)} text={`${card.status} ${card.version}`} />
        <button className="mini" disabled={card.status !== 'draft'} onClick={autoFill}>
          Auto-fill from design
        </button>
        <button className="mini" disabled={frozen} onClick={refill}>
          Refill from linked records
        </button>
        <button className="primary" disabled={frozen || issueBlockers.length > 0} onClick={() => issueCard(card.id)}>
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
      {frozen && (
        <p className="muted small">
          Issued cards are frozen. Record a deviation, or revise to a new version.
        </p>
      )}

      <SubTitle>1. Control</SubTitle>
      <div className="field-row">
        <TextField label="Title" value={card.title} onChange={(v) => set({ title: v })} disabled={frozen} />
        <VersionField label="Version" value={card.version} />
      </div>
      <p className="muted small">The version changes only through Revise.</p>
      <div className="field-row">
        <PersonField label="Owner" value={card.owner} onChange={(v) => set({ owner: v })} people={people} disabled={frozen} />
        <PersonField label="Approvers" value={card.approvers} onChange={(v) => set({ approvers: v })} people={people} disabled={frozen} />
      </div>
      <p className="muted small">
        Card {card.cardCode}; effective {card.effectiveAt ? fmtDate(card.effectiveAt) : 'not issued'}.
      </p>

      <SubTitle>2. Traceability</SubTitle>
      <MultiPicker
        label="Questions"
        options={campaign.questions.map((q) => ({ id: q.id, label: `${q.id} ${q.wording.slice(0, 40)}` }))}
        value={card.questionIds}
        onChange={(v) => applyLinks({ questionIds: v })}
        disabled={frozen}
      />
      <MultiPicker
        label="Hypotheses"
        options={campaign.hypotheses.map((h) => ({ id: h.id, label: `${h.id} ${h.producesBehavior.slice(0, 40)}` }))}
        value={card.hypothesisIds}
        onChange={(v) => applyLinks({ hypothesisIds: v })}
        disabled={frozen}
      />
      <MultiPicker
        label="Measures"
        options={campaign.measures.map((m) => ({ id: m.id, label: `${m.id} ${m.name}` }))}
        value={card.measureIds}
        onChange={(v) => applyLinks({ measureIds: v })}
        disabled={frozen}
      />
      <div className="field-row">
        <SelectField label="Matrix cell" value={card.matrixCellId} allowEmpty="not set" options={campaign.matrix.map((x) => ({ v: x.id, label: `${x.id} ${x.method.slice(0, 24)}` }))} onChange={pickMatrixCell} disabled={frozen} />
        <SelectField label="Configuration" value={card.configId} allowEmpty="not set" options={campaign.configs.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))} onChange={(v) => applyLinks({ configId: v })} disabled={frozen} />
      </div>
      <p className="muted small">Picking a matrix cell fills the linked records.</p>
      <div className="field-row">
        <SelectField label="Threat" value={card.threatId} allowEmpty="not set" options={campaign.threats.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))} onChange={(v) => applyLinks({ threatId: v })} disabled={frozen} />
        <SelectField label="Condition" value={card.conditionId} allowEmpty="not set" options={campaign.conditions.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))} onChange={(v) => applyLinks({ conditionId: v })} disabled={frozen} />
      </div>

      <SubTitle>3. Purpose and intent</SubTitle>
      <TextField label="Purpose (one sentence: why the run exists)" rows={2} value={card.purpose} onChange={(v) => set({ purpose: v })} disabled={frozen} />
      <TextField label="Why this is the highest-value next run" value={card.whyHighestValueNext} onChange={(v) => set({ whyHighestValueNext: v })} disabled={frozen} />
      <TextField label="Result that could change the decision" value={card.resultThatCouldChangeDecision} onChange={(v) => set({ resultThatCouldChangeDecision: v })} disabled={frozen} />
      <div className="field-row">
        <TextField label="Prediction" value={card.prediction} onChange={(v) => set({ prediction: v })} disabled={frozen} />
        <SelectField label="Changed factor" value={card.changedFactor || null} allowEmpty="not set" options={changedFactorOpts} onChange={(v) => set({ changedFactor: v ?? '' })} disabled={frozen} />
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
        <PersonField label="Operators" value={card.operators} onChange={(v) => set({ operators: v })} people={people} disabled={frozen} />
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
        <SuggestField label="Invalidating red deviations" value={card.invalidatingRedDeviations} onChange={(v) => set({ invalidatingRedDeviations: v })} suggestions={threat ? [threat.prohibitedActions, ...threat.adaptationRules.map((r) => r.trigger)] : []} disabled={frozen} />
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
      <LineChecklist label="Event marks (tap-button vocabulary)" options={markVocabulary} value={card.eventMarks} onChange={(v) => set({ eventMarks: v })} disabled={frozen} />

      <SubTitle>11. Preconditions</SubTitle>
      <LineChecklist label="Required state before start" options={authorityLines} value={card.preconditions} onChange={(v) => set({ preconditions: v })} disabled={frozen} />

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
        <SuggestField label="Start call" value={card.siteCalls.start} onChange={(v) => set({ siteCalls: { ...card.siteCalls, start: v } })} suggestions={siteCallSuggestions('start', 'START RUN')} disabled={frozen} />
        <SuggestField label="Pause call" value={card.siteCalls.pause} onChange={(v) => set({ siteCalls: { ...card.siteCalls, pause: v } })} suggestions={siteCallSuggestions('pause', 'HOLD')} disabled={frozen} />
        <SuggestField label="Stop call" value={card.siteCalls.stop} onChange={(v) => set({ siteCalls: { ...card.siteCalls, stop: v } })} suggestions={siteCallSuggestions('stop', 'STOP STOP STOP')} disabled={frozen} />
        <SuggestField label="Abort call" value={card.siteCalls.abort} onChange={(v) => set({ siteCalls: { ...card.siteCalls, abort: v } })} suggestions={siteCallSuggestions('abort', 'ABORT ABORT ABORT')} disabled={frozen} />
      </div>
      <div className="field-row">
        <NumberField label="Pre-event margin (s)" value={card.preEventMarginS} onChange={(v) => set({ preEventMarginS: v ?? 0 })} disabled={frozen} />
        <NumberField label="Post-event margin (s)" value={card.postEventMarginS} onChange={(v) => set({ postEventMarginS: v ?? 0 })} disabled={frozen} />
      </div>
      {card.procedure.map((s, i) => (
        <div key={s.id} className="field-row te-table-row te-step-row">
          <Field label={`Step ${i + 1} action`}>
            <textarea
              rows={1}
              value={s.action}
              disabled={frozen}
              onChange={(e) => setStep(s.id, { action: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
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
        <SuggestField label="Restart authority" value={card.restartAuthority} onChange={(v) => set({ restartAuthority: v })} suggestions={[...people, ...RUN_ROLES]} disabled={frozen} />
      </div>
      <TextField label="Run-specific hold conditions" rows={2} value={card.holdConditions} onChange={(v) => set({ holdConditions: v })} disabled={frozen} />

      <SubTitle>15. Validity and repeat</SubTitle>
      <TextField label="Required validity conditions" rows={2} value={card.requiredValidityConditions} onChange={(v) => set({ requiredValidityConditions: v })} disabled={frozen} />
      <TextField label="Invalidating failures" rows={2} value={card.invalidatingFailures} onChange={(v) => set({ invalidatingFailures: v })} disabled={frozen} />
      <TextField label="Conditional uses" rows={2} value={card.conditionalUses} onChange={(v) => set({ conditionalUses: v })} disabled={frozen} />

      <SubTitle>16. Outputs</SubTitle>
      <SuggestField label="Required files" rows={2} value={card.requiredFiles} onChange={(v) => set({ requiredFiles: v })} suggestions={[...otherCards.map((x) => x.requiredFiles), ...DATA_STANDARDS.map((d) => `${d.name}: ${d.value}`)]} disabled={frozen} />
      <SuggestField label="Storage path" value={card.storagePath} onChange={(v) => set({ storagePath: v })} suggestions={otherCards.map((x) => x.storagePath)} disabled={frozen} />

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
      <SuggestField label="What this run's evidence may support" rows={2} value={card.allowedConclusion} onChange={(v) => set({ allowedConclusion: v })} suggestions={[threat?.permittedGeneralization ?? '', condition?.permittedGeneralization ?? '']} disabled={frozen} />

      <SubTitle>19. Prohibited conclusion</SubTitle>
      <SuggestField label="What must not be inferred" rows={2} value={card.prohibitedConclusion} onChange={(v) => set({ prohibitedConclusion: v })} suggestions={[threat?.prohibitedGeneralization ?? '', condition?.prohibitedGeneralization ?? '']} disabled={frozen} />

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
  const { addCard, createCardFromMatrixCell, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.cards ?? null)
  const [cellId, setCellId] = useState('')
  const card = campaign.cards.find((c) => c.id === selected)
  const issued = campaign.cards.filter((c) => c.status === 'issued').length
  const gate = issued
    ? { kind: 'good' as const, text: `${issued} issued` }
    : { kind: 'neutral' as const, text: 'no card issued' }
  return (
    <div className="te-panel">
      <PhaseIntro phase="cards" gate={gate} />
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
        <div className="field-row">
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
          <Field label="New card from cell">
            <select value={cellId} onChange={(e) => setCellId(e.target.value)}>
              <option value="">pick a matrix cell…</option>
              {campaign.matrix.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id} {x.method.slice(0, 24)}
                </option>
              ))}
            </select>
          </Field>
          <div className="field">
            <span>&nbsp;</span>
            <button
              className="mini"
              disabled={!campaign.matrix.some((x) => x.id === cellId)}
              onClick={() => {
                const id = createCardFromMatrixCell(cellId)
                if (id) selectRecord('cards', id)
                setCellId('')
              }}
            >
              Create
            </button>
          </div>
        </div>
        {card ? (
          <CardEditor key={card.id} campaign={campaign} card={card} />
        ) : (
          <p className="muted small">Select a card, create a new one, or start from a template.</p>
        )}
      </div>
    </div>
  )
}

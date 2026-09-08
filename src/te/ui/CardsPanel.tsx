/**
 * Cards stage: decision groups C1-C10.
 * Inherited values render read-through with provenance; the stage gate is
 * a generated StageReview above Issue. Issued cards stay frozen; every
 * write goes through the store.
 */

import { useState } from 'react'
import type { FactorClass, ProcedureStep, TeCampaign, TeCard, TeRecordStatus } from '../model/types'
import { RUN_ROLES } from '../model/types'
import { useTeStore } from '../state/teStore'
import { DEFAULT_EVENT_MARKS, linkedRecordFill } from '../model/cardLinks'
import { emptyProcedureStep, nowIso } from '../model/empty'
import { cardIssueBlockers, sanitizeCardTemplatePatch } from '../validate'
import { CARD_TEMPLATES } from '../seed/cardTemplates'
import { DATA_STANDARDS, GENERIC_MARKS, KINETIC_MARKS, RESET_ACTIONS, STOP_TAXONOMY, WHY_NEXT_REASONS } from '../seed/constants'
import { boardSignals } from './DesignBuilders'
import { PrintOverlay } from '../print/PrintOverlay'
import { exportCampaignJson } from '../io/persistTe'
import { TestCardPrint } from '../print/TestCardPrint'
import { HELP, HINTS, allPeople } from './help'
import {
  AdvancedDisclosure,
  ChipList,
  DecisionGroup,
  EntityPicker,
  ExampleHint,
  Field,
  MultiPicker,
  NumberField,
  NumberUnitField,
  PersonPicker,
  PhaseIntro,
  Pill,
  RecordCheck,
  SelectField,
  StageReview,
  SubTitle,
  SuggestField,
  TextField,
  VersionField,
  fmtDate,
} from './kit'
import {
  ChipString,
  ClassedLinesTable,
  DerivedText,
  LineChecklist,
  MonitoringBuilder,
  OrderBlockingBuilder,
  RedStateBuilder,
} from './CardBlocks'

function statusKind(s: TeRecordStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (s === 'issued') return 'good'
  if (s === 'approved' || s === 'in-review') return 'warn'
  if (s === 'withdrawn') return 'bad'
  return 'neutral'
}

const nz = (s: string) => s.trim() !== ''

function stateOf(...flags: boolean[]): 'done' | 'partial' | 'empty' {
  if (flags.every(Boolean)) return 'done'
  if (flags.some(Boolean)) return 'partial'
  return 'empty'
}

function splitLines(s: string): string[] {
  return s
    .split(/[\n;]/)
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

/** Compose a short title from the linked question, threat, and condition. */
function deriveTitle(campaign: TeCampaign, card: TeCard): string {
  const q = card.questionIds.map((id) => campaign.questions.find((x) => x.id === id)).find((x) => x)
  const threat = campaign.threats.find((x) => x.id === card.threatId)
  const condition = campaign.conditions.find((x) => x.id === card.conditionId)
  const head = q ? q.wording.replace(/[?.]\s*$/, '').slice(0, 48) : ''
  const parts = [head, threat?.name ? `vs ${threat.name}` : '', condition?.name ? `in ${condition.name}` : '']
  return parts.filter((p) => p !== '').join(' ')
}

/** Storage path from the campaign convention: a prior card's pattern, else a default. */
function deriveStoragePath(campaign: TeCampaign, card: TeCard): string {
  const donor = campaign.cards.find(
    (x) => x.id !== card.id && x.storagePath.trim() !== '' && x.storagePath.includes(x.cardCode),
  )
  if (donor) return donor.storagePath.split(donor.cardCode).join(card.cardCode)
  return `data/${campaign.code}/${card.cardCode}/`
}

/** Creation paths: matrix cell (default), template, blank. */
function CardStartRow({ campaign }: { campaign: TeCampaign }) {
  const { addCard, createCardFromMatrixCell, selectRecord } = useTeStore.getState()
  // Board-matched templates rank first and carry a flag. Ranking only.
  const signals = boardSignals()
  const boardTemplateKeys = [
    ...(signals.softkill ? ['TC-CUAS-EW-SOFTKILL-001'] : []),
    ...(signals.c2 ? ['TC-CUAS-C2-HANDOFF-001'] : []),
  ]
  const templates = [...CARD_TEMPLATES].sort(
    (a, b) => Number(boardTemplateKeys.includes(b.key)) - Number(boardTemplateKeys.includes(a.key)),
  )
  return (
    <div className="field-row">
      {campaign.matrix.length > 0 && (
        <Field label="From matrix cell" help="The cell's links and fills carry into the card.">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value === '') return
              const id = createCardFromMatrixCell(e.target.value)
              if (id) selectRecord('cards', id)
            }}
          >
            <option value="">pick a cell…</option>
            {campaign.matrix.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id} {x.method.slice(0, 24)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="From template" help="A worked card structure. Placeholders block issue until resolved.">
        <select
          value=""
          onChange={(e) => {
            const t = CARD_TEMPLATES.find((x) => x.key === e.target.value)
            if (!t) return
            selectRecord('cards', addCard(sanitizeCardTemplatePatch(campaign, t.patch)))
          }}
        >
          <option value="">pick a template…</option>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.key}: {t.name}
              {boardTemplateKeys.includes(t.key) ? ' (matches board)' : ''}
            </option>
          ))}
        </select>
      </Field>
      <div className="field">
        <span>&nbsp;</span>
        <button type="button" className="mini" onClick={() => selectRecord('cards', addCard())}>
          Blank card
        </button>
      </div>
    </div>
  )
}

function CardEditor({ campaign, card }: { campaign: TeCampaign; card: TeCard }) {
  const { patchItem, issueCard, reviseCard, selectRecord, linkCardCell, setCardLinks, fillCard, refillCard } =
    useTeStore.getState()
  const [printing, setPrinting] = useState(false)
  const [showCellPicker, setShowCellPicker] = useState(false)
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

  // Link and fill rules live in the store; the panel passes the selection only.
  const pickMatrixCell = (v: string | null) => {
    setShowCellPicker(false)
    linkCardCell(card.id, v)
  }

  const refill = () => {
    if (!window.confirm('Refill every linked field? This overwrites existing text.')) return
    refillCard(card.id)
  }

  // Linked records and live derivations. The stored string stays the truth;
  // derivations recompute for display and provenance state.
  const config = campaign.configs.find((x) => x.id === card.configId)
  const threat = campaign.threats.find((x) => x.id === card.threatId)
  const condition = campaign.conditions.find((x) => x.id === card.conditionId)
  const firstQuestion = card.questionIds
    .map((id) => campaign.questions.find((x) => x.id === id))
    .find((x) => x)
  const linkedMeasures = card.measureIds
    .map((id) => campaign.measures.find((m) => m.id === id))
    .filter((m) => m !== undefined)
  const otherCards = campaign.cards.filter((x) => x.id !== card.id)
  const deriv = linkedRecordFill(campaign, card, true)
  const configSource = config ? `${config.name || config.id} ${config.version}` : 'configuration'
  const threatSource = threat ? threat.name || threat.id : 'threat'
  const conditionSource = condition ? condition.name || condition.id : 'condition'
  const titleDerived = deriveTitle(campaign, card)
  const storageDerived = deriveStoragePath(campaign, card)
  const measureNames = linkedMeasures.map((m) => m.name || m.id)
  const expectedDerived =
    card.prediction.trim() === ''
      ? ''
      : [card.prediction.trim(), measureNames.length > 0 ? `Scored on: ${measureNames.join(', ')}` : '']
          .filter((t) => t !== '')
          .join('\n')
  const allowedDerived = [threat?.permittedGeneralization ?? '', condition?.permittedGeneralization ?? '']
    .filter((t) => t.trim() !== '')
    .join('\n')
  const prohibitedDerived = [threat?.prohibitedGeneralization ?? '', condition?.prohibitedGeneralization ?? '']
    .filter((t) => t.trim() !== '')
    .join('\n')

  const ivFactors = factorOpts('independent-variable')
  const heldFactors = factorOpts('held-control')
  const covariateFactors = factorOpts('recorded-covariate')
  const changedFactorNames = campaign.factors
    .filter((x) => x.classification === 'independent-variable')
    .map((x) => x.name || x.id)
  const changedFactorOpts = (
    card.changedFactor && !changedFactorNames.includes(card.changedFactor)
      ? [card.changedFactor, ...changedFactorNames]
      : changedFactorNames
  ).map((x) => ({ v: x, label: x }))
  const signals = boardSignals()
  const markVocabulary = [
    ...DEFAULT_EVENT_MARKS,
    ...GENERIC_MARKS,
    ...(signals.kinetic ? KINETIC_MARKS : []),
    ...linkedMeasures.flatMap((m) => [m.startEvent, m.stopEvent]),
  ]
  const authorityLines = campaign.authorities.map((a) => `${a.authorityType || 'authority'}: ${a.status}`)
  const siteCallSuggestions = (key: 'start' | 'pause' | 'stop' | 'abort', standard: string) => [
    standard,
    ...otherCards.map((x) => x.siteCalls[key]),
  ]
  const redDeviationOptions = threat
    ? [...splitLines(threat.prohibitedActions), ...threat.adaptationRules.map((r) => r.trigger)]
    : []
  const fileOptions = [
    ...DATA_STANDARDS.map((d) => d.name),
    ...linkedMeasures.flatMap((m) => [m.truth.primarySource, m.truth.backupSource]),
    ...otherCards.flatMap((x) => splitLines(x.requiredFiles)),
  ]
  const claimOptions = campaign.registers
    .filter((r) => r.kind === 'claim')
    .map((r) => ({ id: r.id, label: r.statement.slice(0, 60) || r.id, sub: r.id }))
  const threatDesc = threat
    ? [threat.name || threat.id, `Group ${threat.uasGroup}`, threat.airframe].filter((t) => t !== '').join(', ')
    : ''
  const repeatPlanned = card.repetitionNumber > 1 || card.minValidSample > 1
  const hasRedContent =
    nz(card.redInitialState) ||
    nz(card.redControlled) ||
    nz(card.redFixed) ||
    nz(card.blinding) ||
    nz(card.invalidatingRedDeviations)
  const showC5 =
    card.threatId != null ||
    card.conditionId != null ||
    campaign.authorities.length > 0 ||
    hasRedContent ||
    nz(card.conditionNote) ||
    nz(card.operatingLimits)

  const c1State = stateOf(
    card.questionIds.length > 0,
    card.measureIds.length > 0,
    card.configId != null,
    card.threatId != null,
    card.conditionId != null,
  )
  const c2State = stateOf(nz(card.title), nz(card.purpose), nz(card.prediction), nz(card.whyHighestValueNext))
  const c3State = stateOf(card.repetitionNumber > 0, card.minValidSample > 0, nz(card.orderAndBlocking))
  const c4State = stateOf(nz(card.systemStateNote), nz(card.operators), nz(card.trainingState))
  const c5State = stateOf(nz(card.redInitialState), nz(card.redControlled) || nz(card.redFixed), nz(card.blinding))
  const c6State = stateOf(
    nz(card.dataSources),
    nz(card.groundTruth),
    card.eventMarks.length > 0,
    nz(card.requiredFiles),
  )
  const c7State = stateOf(
    card.procedure.length > 0,
    card.procedure.length > 0 &&
      card.procedure.every((s) => nz(s.action) && nz(s.observableCompletion)),
  )
  const c8State = stateOf(
    nz(card.safetyStops) || nz(card.dataEquipmentStops) || nz(card.holdConditions),
    nz(card.safeState),
    nz(card.restartAuthority),
    nz(card.requiredValidityConditions) || nz(card.invalidatingFailures),
  )
  const c9State = stateOf(nz(card.expectedResult), nz(card.allowedConclusion), nz(card.prohibitedConclusion))
  const c10State = frozen
    ? 'done'
    : stateOf(card.coldReaderAt != null, card.dryRunAt != null, issueBlockers.length === 0)

  const reviewRows = [
    { label: 'What it tests', value: firstQuestion?.wording ?? '' },
    {
      label: 'Against',
      value: [threat?.name ?? '', condition?.name ? `in ${condition.name}` : ''].filter((t) => t !== '').join(' '),
    },
    {
      label: 'Configuration',
      value: config
        ? `${config.name || config.id} ${config.version} ${config.frozen ? '(frozen)' : '(not frozen)'}`
        : '',
    },
    {
      label: 'Sampling',
      value: `attempt ${card.repetitionNumber}; ${card.minValidSample} valid needed`,
    },
    {
      label: 'Cold read',
      value: card.coldReaderAt ? `${card.coldReaderBy} ${fmtDate(card.coldReaderAt)}` : '',
    },
    { label: 'Dry run', value: card.dryRunAt ? `${card.dryRunBy} ${fmtDate(card.dryRunAt)}` : '' },
  ]

  const cellLabel = card.matrixCellId
    ? (() => {
        const cell = campaign.matrix.find((x) => x.id === card.matrixCellId)
        return cell ? `${cell.id} ${cell.method.slice(0, 24)}` : card.matrixCellId
      })()
    : ''

  return (
    <div className="run-row">
      <div className="inspector-actions">
        <Pill kind={statusKind(card.status)} text={`${card.status} ${card.version}`} />
        <span className="muted small num">{card.cardCode}</span>
        <button type="button" className="mini" disabled={card.status !== 'draft'} onClick={() => fillCard(card.id)}>
          Auto-fill from design
        </button>
        <button type="button" className="mini" disabled={frozen} onClick={refill}>
          Refill from linked records
        </button>
        {card.status === 'issued' && (
          <button
            type="button"
            className="mini"
            onClick={() => {
              const nid = reviseCard(card.id)
              if (nid) selectRecord('cards', nid)
            }}
          >
            Revise (new version)
          </button>
        )}
        <button type="button" className="mini" onClick={() => setPrinting(true)}>
          Print
        </button>
      </div>
      {frozen && (
        <p className="muted small">
          Issued cards are frozen. Record a deviation, or revise to a new version.
        </p>
      )}
      <div className="field-row">
        <PersonPicker label="Owner" value={card.owner} onChange={(v) => set({ owner: v })} people={people} disabled={frozen} />
        <PersonPicker label="Approvers" multi value={card.approvers} onChange={(v) => set({ approvers: v })} people={people} disabled={frozen} />
        <VersionField label="Version" value={card.version} />
      </div>
      <p className="muted small">
        Effective {card.effectiveAt ? fmtDate(card.effectiveAt) : 'not issued'}. The version changes only through Revise.
      </p>

      <DecisionGroup
        id="c1-links"
        question="Where does this card come from?"
        hint="Traceability: matrix cell, question, hypothesis, measures, configuration, threat, condition, claims."
        tier="required"
        state={c1State}
      >
        {card.matrixCellId && !showCellPicker ? (
          <div className="provenance-line">
            <span className="provenance-chip">from {cellLabel}</span>
            {!frozen && (
              <button type="button" className="mini" onClick={() => setShowCellPicker(true)}>
                Change cell
              </button>
            )}
          </div>
        ) : (
          <EntityPicker
            label="Matrix cell"
            help="Picking a cell fills the linked records."
            options={campaign.matrix.map((x) => ({ id: x.id, label: `${x.id} ${x.method.slice(0, 24)}` }))}
            value={card.matrixCellId}
            onChange={pickMatrixCell}
            disabled={frozen}
          />
        )}
        <EntityPicker
          label="Questions"
          multi
          values={card.questionIds}
          onChangeMulti={(v) => setCardLinks(card.id, { questionIds: v })}
          options={campaign.questions.map((q) => ({ id: q.id, label: q.wording.slice(0, 60) || q.id, sub: q.id }))}
          disabled={frozen}
        />
        {(card.questionIds.length > 0 || card.hypothesisIds.length > 0) && (
          <EntityPicker
            label="Hypotheses"
            multi
            values={card.hypothesisIds}
            onChangeMulti={(v) => setCardLinks(card.id, { hypothesisIds: v })}
            options={campaign.hypotheses.map((h) => ({
              id: h.id,
              label: h.producesBehavior.slice(0, 60) || h.id,
              sub: h.id,
            }))}
            disabled={frozen}
          />
        )}
        <EntityPicker
          label="Measures"
          multi
          values={card.measureIds}
          onChangeMulti={(v) => setCardLinks(card.id, { measureIds: v })}
          options={campaign.measures.map((m) => ({
            id: m.id,
            label: m.name || m.id,
            sub: `${m.id}${m.frozen ? '' : ' (not frozen)'}`,
          }))}
          disabled={frozen}
        />
        <div className="field-row">
          <EntityPicker
            label="Configuration"
            options={campaign.configs.map((x) => ({
              id: x.id,
              label: x.name || x.id,
              sub: x.frozen ? 'frozen' : 'not frozen',
            }))}
            value={card.configId}
            onChange={(v) => setCardLinks(card.id, { configId: v })}
            disabled={frozen}
          />
          <EntityPicker
            label="Threat"
            options={campaign.threats.map((x) => ({ id: x.id, label: x.name || x.id, sub: x.id }))}
            value={card.threatId}
            onChange={(v) => setCardLinks(card.id, { threatId: v })}
            disabled={frozen}
          />
          <EntityPicker
            label="Condition"
            options={campaign.conditions.map((x) => ({ id: x.id, label: x.name || x.id, sub: x.id }))}
            value={card.conditionId}
            onChange={(v) => setCardLinks(card.id, { conditionId: v })}
            disabled={frozen}
          />
        </div>
        <EntityPicker
          label="Claims this card tests"
          help="Claims come from the register. A tested claim carries into findings."
          multi
          values={card.claimIds}
          onChangeMulti={(v) => set({ claimIds: v })}
          options={claimOptions}
          disabled={frozen}
        />
        {campaign.frames.length > 0 && (
          <AdvancedDisclosure label="Canvas frames">
            <MultiPicker
              label="Frames"
              options={campaign.frames.map((f) => ({ id: f.id, label: f.name }))}
              value={card.frameIds}
              onChange={(v) => set({ frameIds: v })}
              disabled={frozen}
            />
          </AdvancedDisclosure>
        )}
      </DecisionGroup>

      <DecisionGroup
        id="c2-why"
        question="Why run this next, and what do we expect?"
        hint="Purpose, priority, prediction. Predictions are recorded before the run."
        tier="required"
        state={c2State}
      >
        <DerivedText
          label="Title"
          value={card.title}
          derived={titleDerived}
          source="linked records"
          onChange={(v) => set({ title: v })}
          disabled={frozen}
        />
        <DerivedText
          label="Purpose"
          help="One sentence: why this run exists."
          rows={2}
          value={card.purpose}
          derived={deriv.purpose ?? ''}
          source={firstQuestion?.id ?? 'linked question'}
          onChange={(v) => set({ purpose: v })}
          disabled={frozen}
        />
        <ChipString
          label="Why run this next?"
          value={card.whyHighestValueNext}
          onChange={(v) => set({ whyHighestValueNext: v })}
          options={WHY_NEXT_REASONS}
          disabled={frozen}
        />
        <TextField
          label="Priority note"
          value={card.priorityReason}
          onChange={(v) => set({ priorityReason: v })}
          disabled={frozen}
        />
        <DerivedText
          label="Prediction"
          help={HELP.prediction}
          value={card.prediction}
          derived={deriv.prediction ?? ''}
          source="linked hypothesis"
          onChange={(v) => set({ prediction: v })}
          disabled={frozen}
        />
        <ExampleHint {...HINTS.prediction} />
        <DerivedText
          label="What result would change the customer's choice?"
          value={card.resultThatCouldChangeDecision}
          derived={deriv.resultThatCouldChangeDecision ?? ''}
          source="decision record"
          onChange={(v) => set({ resultThatCouldChangeDecision: v })}
          disabled={frozen}
        />
        {(ivFactors.length > 0 || nz(card.changedFactor)) && (
          <SelectField
            label="Which one factor does this run change?"
            value={card.changedFactor || null}
            allowEmpty="not set"
            options={changedFactorOpts}
            onChange={(v) => set({ changedFactor: v ?? '' })}
            disabled={frozen}
          />
        )}
      </DecisionGroup>

      <DecisionGroup
        id="c3-sampling"
        question="How many attempts, in what order?"
        hint="Sampling plan: repetition number, minimum valid sample, order and blocking."
        tier="recommended"
        state={c3State}
      >
        <div className="field-row">
          <NumberField
            label="This is attempt number"
            help="Which repetition of this card the next run is."
            value={card.repetitionNumber}
            onChange={(v) => set({ repetitionNumber: v ?? 1 })}
            disabled={frozen}
          />
          <NumberField
            label="Valid runs needed"
            help="Valid repetitions needed before we can score."
            value={card.minValidSample}
            onChange={(v) => set({ minValidSample: v ?? 1 })}
            disabled={frozen}
          />
        </div>
        <OrderBlockingBuilder
          value={card.orderAndBlocking}
          derived={deriv.orderAndBlocking ?? ''}
          source="matrix cell"
          onChange={(v) => set({ orderAndBlocking: v })}
          disabled={frozen}
        />
        {(repeatPlanned || nz(card.resetBeforeRepeat)) && (
          <ChipString
            label="What must reset before the next attempt?"
            value={card.resetBeforeRepeat}
            onChange={(v) => set({ resetBeforeRepeat: v })}
            options={RESET_ACTIONS}
            disabled={frozen}
          />
        )}
        {(ivFactors.length > 0 || card.independentFactorIds.length > 0) && (
          <MultiPicker
            label="Factors this run changes"
            options={ivFactors}
            value={card.independentFactorIds}
            onChange={(v) => set({ independentFactorIds: v })}
            disabled={frozen}
          />
        )}
        {(heldFactors.length > 0 || card.heldFactorIds.length > 0) && (
          <MultiPicker
            label="Factors held constant"
            options={heldFactors}
            value={card.heldFactorIds}
            onChange={(v) => set({ heldFactorIds: v })}
            disabled={frozen}
          />
        )}
        {(covariateFactors.length > 0 || card.covariateFactorIds.length > 0) && (
          <MultiPicker
            label="Conditions we record but do not control"
            options={covariateFactors}
            value={card.covariateFactorIds}
            onChange={(v) => set({ covariateFactorIds: v })}
            disabled={frozen}
          />
        )}
      </DecisionGroup>

      <DecisionGroup
        id="c4-system"
        question="What state is the system in, and who runs it?"
        tier="recommended"
        state={c4State}
      >
        <DerivedText
          label="System state"
          rows={2}
          value={card.systemStateNote}
          derived={deriv.systemStateNote ?? ''}
          source={configSource}
          onChange={(v) => set({ systemStateNote: v })}
          disabled={frozen}
        />
        <div className="field-row">
          <PersonPicker
            label="Operators"
            multi
            value={card.operators}
            onChange={(v) => set({ operators: v })}
            people={people}
            disabled={frozen}
          />
          <DerivedText
            label="Training state"
            value={card.trainingState}
            derived={deriv.trainingState ?? ''}
            source={configSource}
            onChange={(v) => set({ trainingState: v })}
            disabled={frozen}
          />
        </div>
      </DecisionGroup>

      {showC5 && (
        <DecisionGroup
          id="c5-red"
          question="What does red do, and what voids the run?"
          hint="Red picture: OPFOR start state, controlled variables, blinding, operating limits."
          tier="recommended"
          state={c5State}
        >
          {(card.threatId != null || hasRedContent) && (
            <>
              {threat ? (
                <RedStateBuilder
                  value={card.redInitialState}
                  onChange={(v) => set({ redInitialState: v })}
                  threatDesc={threatDesc}
                  kinetic={signals.kinetic}
                  disabled={frozen}
                />
              ) : (
                <TextField
                  label="Red start state"
                  rows={2}
                  value={card.redInitialState}
                  onChange={(v) => set({ redInitialState: v })}
                  disabled={frozen}
                />
              )}
              <div className="field-row">
                <DerivedText
                  label="What red controls"
                  value={card.redControlled}
                  derived={deriv.redControlled ?? ''}
                  source={threatSource}
                  onChange={(v) => set({ redControlled: v })}
                  disabled={frozen}
                />
                <DerivedText
                  label="What red holds fixed"
                  value={card.redFixed}
                  derived={deriv.redFixed ?? ''}
                  source={threatSource}
                  onChange={(v) => set({ redFixed: v })}
                  disabled={frozen}
                />
              </div>
              <DerivedText
                label="Who is kept unaware, and of what?"
                help={HINTS.blinding.definition}
                value={card.blinding}
                derived={deriv.blinding ?? ''}
                source={threatSource}
                onChange={(v) => set({ blinding: v })}
                disabled={frozen}
              />
              <ChipString
                label="Red actions that void the run"
                value={card.invalidatingRedDeviations}
                onChange={(v) => set({ invalidatingRedDeviations: v })}
                options={redDeviationOptions}
                disabled={frozen}
              />
            </>
          )}
          {(card.conditionId != null || nz(card.conditionNote)) && (
            <DerivedText
              label="Condition note"
              rows={2}
              value={card.conditionNote}
              derived={deriv.conditionNote ?? ''}
              source={conditionSource}
              onChange={(v) => set({ conditionNote: v })}
              disabled={frozen}
            />
          )}
          {(campaign.authorities.length > 0 || nz(card.operatingLimits)) && (
            <DerivedText
              label="Operating limits"
              value={card.operatingLimits}
              derived={deriv.operatingLimits ?? ''}
              source="active authorities"
              onChange={(v) => set({ operatingLimits: v })}
              disabled={frozen}
            />
          )}
        </DecisionGroup>
      )}

      <DecisionGroup
        id="c6-truth"
        question="How do we know what really happened?"
        hint="Truth sources, common time base, event marks, required files."
        tier="recommended"
        state={c6State}
      >
        <DerivedText
          label="Data sources"
          rows={2}
          value={card.dataSources}
          derived={deriv.dataSources ?? ''}
          source="linked measures"
          onChange={(v) => set({ dataSources: v })}
          disabled={frozen}
        />
        <DerivedText
          label="Truth source"
          help={HINTS['truth-source'].definition}
          rows={2}
          value={card.groundTruth}
          derived={deriv.groundTruth ?? ''}
          source="linked measures"
          onChange={(v) => set({ groundTruth: v })}
          disabled={frozen}
        />
        <DerivedText
          label="Shared clock and allowed time error"
          value={card.commonTimeAndTolerance}
          derived={deriv.commonTimeAndTolerance ?? ''}
          source="linked measures"
          onChange={(v) => set({ commonTimeAndTolerance: v })}
          disabled={frozen}
        />
        <MonitoringBuilder
          value={card.monitoringAndFallback}
          onChange={(v) => set({ monitoringAndFallback: v })}
          roles={[...RUN_ROLES]}
          disabled={frozen}
        />
        <LineChecklist
          label="Event marks"
          help="The tap-button vocabulary for the run log."
          options={markVocabulary}
          value={card.eventMarks}
          onChange={(v) => set({ eventMarks: v })}
          disabled={frozen}
        />
        <ChipString
          label="Required files"
          value={card.requiredFiles}
          onChange={(v) => set({ requiredFiles: v })}
          options={fileOptions}
          sep={'\n'}
          disabled={frozen}
        />
        <DerivedText
          label="Storage path"
          value={card.storagePath}
          derived={storageDerived}
          source="campaign convention"
          onChange={(v) => set({ storagePath: v })}
          disabled={frozen}
        />
        <AdvancedDisclosure label="Measure caveats">
          {linkedMeasures.length === 0 && (
            <p className="muted small">No measures linked yet. Link them under Where does this card come from.</p>
          )}
          {linkedMeasures.map((m) => (
            <div key={m.id} className="muted small">
              {m.id}: {m.name} ({m.unit || 'no unit'})
            </div>
          ))}
          <TextField
            label="How a measure applies to this run"
            rows={2}
            value={card.measuresNote}
            onChange={(v) => set({ measuresNote: v })}
            disabled={frozen}
          />
        </AdvancedDisclosure>
      </DecisionGroup>

      <DecisionGroup
        id="c7-procedure"
        question="What are the exact steps?"
        hint="Each step names a role and an observable completion."
        tier="required"
        state={c7State}
      >
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
            <SelectField
              label="Role"
              value={s.role}
              options={RUN_ROLES.map((v) => ({ v, label: v }))}
              onChange={(v) => v && setStep(s.id, { role: v })}
              disabled={frozen}
            />
            <Field label="Done when" help="Done when you can observe what, exactly.">
              <input
                value={s.observableCompletion}
                disabled={frozen}
                onChange={(e) => setStep(s.id, { observableCompletion: e.target.value })}
              />
            </Field>
            <Field label="Void" help="This step can silently void the run.">
              <input
                type="checkbox"
                checked={s.canSilentlyInvalidate}
                disabled={frozen}
                onChange={(e) => setStep(s.id, { canSilentlyInvalidate: e.target.checked })}
              />
            </Field>
            <Field label="Rec" help="Recorder start or stop step.">
              <input
                type="checkbox"
                checked={s.isRecorderStartStop}
                disabled={frozen}
                onChange={(e) => setStep(s.id, { isRecorderStartStop: e.target.checked })}
              />
            </Field>
            <button type="button" className="mini" disabled={frozen || i === 0} onClick={() => moveStep(i, -1)}>
              ↑
            </button>
            <button
              type="button"
              className="mini"
              disabled={frozen || i === card.procedure.length - 1}
              onClick={() => moveStep(i, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="mini danger"
              disabled={frozen}
              onClick={() => set({ procedure: card.procedure.filter((x) => x.id !== s.id) })}
            >
              ×
            </button>
          </div>
        ))}
        {card.procedure.length === 0 && <p className="muted small">No steps yet. Add step.</p>}
        <button
          type="button"
          className="card-chip add"
          disabled={frozen}
          onClick={() => set({ procedure: [...card.procedure, emptyProcedureStep()] })}
        >
          Add step
        </button>
        <div className="field-row">
          <SuggestField label="Start call" value={card.siteCalls.start} onChange={(v) => set({ siteCalls: { ...card.siteCalls, start: v } })} suggestions={siteCallSuggestions('start', 'START RUN')} disabled={frozen} />
          <SuggestField label="Pause call" value={card.siteCalls.pause} onChange={(v) => set({ siteCalls: { ...card.siteCalls, pause: v } })} suggestions={siteCallSuggestions('pause', 'HOLD')} disabled={frozen} />
          <SuggestField label="Stop call" value={card.siteCalls.stop} onChange={(v) => set({ siteCalls: { ...card.siteCalls, stop: v } })} suggestions={siteCallSuggestions('stop', 'STOP STOP STOP')} disabled={frozen} />
          <SuggestField label="Abort call" value={card.siteCalls.abort} onChange={(v) => set({ siteCalls: { ...card.siteCalls, abort: v } })} suggestions={siteCallSuggestions('abort', 'ABORT ABORT ABORT')} disabled={frozen} />
        </div>
        <div className="field-row">
          <NumberUnitField
            label="Recorded before the event"
            unit="s"
            value={card.preEventMarginS}
            onChange={(v) => set({ preEventMarginS: v ?? 0 })}
            disabled={frozen}
          />
          <NumberUnitField
            label="Recorded after the event"
            unit="s"
            value={card.postEventMarginS}
            onChange={(v) => set({ postEventMarginS: v ?? 0 })}
            disabled={frozen}
          />
        </div>
        <LineChecklist
          label="Required state before start"
          help="Preconditions. Authority rows track the approval register."
          options={authorityLines}
          value={card.preconditions}
          onChange={(v) => set({ preconditions: v })}
          disabled={frozen}
        />
      </DecisionGroup>

      <DecisionGroup
        id="c8-stops"
        question="When do we stop, and when does a run still count?"
        hint={HINTS['stop-rule'].definition}
        tier="recommended"
        state={c8State}
      >
        <SubTitle>Stops and holds</SubTitle>
        <ClassedLinesTable
          fields={[
            { key: 'safetyStops', label: 'safety' },
            { key: 'dataEquipmentStops', label: 'data' },
            { key: 'holdConditions', label: 'hold' },
          ]}
          textLabel="Stop or hold when"
          classLabel="Class"
          addLabel="Add stop rule"
          empty="No stop rules yet. Add stop rule."
          values={{
            safetyStops: card.safetyStops,
            dataEquipmentStops: card.dataEquipmentStops,
            holdConditions: card.holdConditions,
          }}
          onChange={(p) => set(p as Partial<TeCard>)}
          suggestions={STOP_TAXONOMY.map((text) => ({ text, cls: 'data' }))}
          disabled={frozen}
        />
        <div className="field-row">
          <TextField
            label="Safe state"
            help="The state the site and system go to on a stop."
            value={card.safeState}
            onChange={(v) => set({ safeState: v })}
            disabled={frozen}
          />
          <EntityPicker
            label="Restart authority"
            help="Who clears a restart after a stop."
            options={[...people, ...RUN_ROLES].map((v) => ({ id: v, label: v }))}
            allowFree
            freeValue={card.restartAuthority}
            onFree={(v) => set({ restartAuthority: v })}
            disabled={frozen}
          />
        </div>
        <SubTitle>Validity rules</SubTitle>
        <ExampleHint {...HINTS['validity-rule']} />
        <ClassedLinesTable
          fields={[
            { key: 'requiredValidityConditions', label: 'required' },
            { key: 'invalidatingFailures', label: 'voids run' },
            { key: 'conditionalUses', label: 'conditional' },
          ]}
          textLabel="Condition"
          classLabel="Effect"
          addLabel="Add validity rule"
          empty="No validity rules yet. Add validity rule."
          values={{
            requiredValidityConditions: card.requiredValidityConditions,
            invalidatingFailures: card.invalidatingFailures,
            conditionalUses: card.conditionalUses,
          }}
          onChange={(p) => set(p as Partial<TeCard>)}
          suggestions={STOP_TAXONOMY.map((text) => ({ text, cls: 'voids run' }))}
          disabled={frozen}
        />
      </DecisionGroup>

      <DecisionGroup
        id="c9-scope"
        question="What can this run prove?"
        hint="Evidence scope: expected behavior, allowed and prohibited conclusions."
        tier="recommended"
        state={c9State}
      >
        <DerivedText
          label="Expected behavior"
          rows={2}
          value={card.expectedResult}
          derived={expectedDerived}
          source="prediction and measures"
          onChange={(v) => set({ expectedResult: v })}
          disabled={frozen}
        />
        <ChipString
          label="Expected data quirks"
          help="Oddities in the data that are normal, not failures."
          value={card.knownArtifacts}
          onChange={(v) => set({ knownArtifacts: v })}
          options={[]}
          disabled={frozen}
        />
        <DerivedText
          label="This evidence can support"
          rows={2}
          value={card.allowedConclusion}
          derived={allowedDerived}
          source="threat and condition"
          onChange={(v) => set({ allowedConclusion: v })}
          disabled={frozen}
        />
        <DerivedText
          label="This evidence must not be read as"
          rows={2}
          value={card.prohibitedConclusion}
          derived={prohibitedDerived}
          source="threat and condition"
          onChange={(v) => set({ prohibitedConclusion: v })}
          disabled={frozen}
        />
      </DecisionGroup>

      {(runs.length > 0 || devs.length > 0) && (
        <DecisionGroup id="c-runs" question="Runs against this card" state="done" defaultOpen={false}>
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
        </DecisionGroup>
      )}

      <DecisionGroup
        id="c10-issue"
        question="Is this card safe to issue?"
        hint={HELP['card-issue']}
        tier="required"
        state={c10State}
      >
        <div className="field-row">
          <RecordCheck
            label="Cold read"
            help={HELP['cold-reader']}
            by={card.coldReaderBy}
            at={card.coldReaderAt}
            people={people}
            onRecord={(by) => set({ coldReaderBy: by, coldReaderAt: nowIso() })}
            disabled={frozen}
          />
          <RecordCheck
            label="Dry run"
            help={HELP['dry-run']}
            by={card.dryRunBy}
            at={card.dryRunAt}
            people={people}
            onRecord={(by) => set({ dryRunBy: by, dryRunAt: nowIso() })}
            disabled={frozen}
          />
        </div>
        {frozen ? (
          <p className="muted small">
            Issued {card.effectiveAt ? fmtDate(card.effectiveAt) : ''}. The card is frozen.
          </p>
        ) : (
          <StageReview
            title={`Issue review ${card.cardCode} ${card.version}`}
            rows={reviewRows}
            issues={issueBlockers.map((text) => ({ level: 'block' as const, text }))}
            passLabel="Issue card"
            onPass={() => issueCard(card.id)}
          />
        )}
      </DecisionGroup>

      {printing && (
        <PrintOverlay
          title={`Test card ${card.cardCode} ${card.version}`}
          onExport={() => exportCampaignJson(campaign)}
          onClose={() => setPrinting(false)}
        >
          <TestCardPrint campaign={campaign} card={card} />
        </PrintOverlay>
      )}
    </div>
  )
}

export function CardsPanel({ campaign }: { campaign: TeCampaign }) {
  const { selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.cards ?? null)
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
        />
        <CardStartRow campaign={campaign} />
        {card ? (
          <CardEditor key={card.id} campaign={campaign} card={card} />
        ) : (
          <p className="muted small">
            Select a card, or start one from a matrix cell, a template, or blank.
          </p>
        )}
      </div>
    </div>
  )
}

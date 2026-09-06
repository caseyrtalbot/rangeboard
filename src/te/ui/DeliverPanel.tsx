/**
 * Deliver stage as ordered decision groups L1-L6. One scrolling
 * column, free navigation, only the gates block. Evidence generation runs on
 * link change and fills only empty fields; the package generator respects
 * the edited flag; the closeout ends in a generated StageReview.
 */

import { useState } from 'react'
import type { TeCampaign, TeEvidencePackage, TeFinding } from '../model/types'
import { newId } from '../../model/types'
import { useTeStore } from '../state/teStore'
import { closeoutBlockers, deliveryBlockers, findingBlockers, runEvidenceLabel, runIncludable } from '../validate'
import { AAR_QUESTIONS } from '../seed/questionBanks'
import {
  AdvancedDisclosure,
  ChipList,
  DateField,
  DecisionGroup,
  EntityPicker,
  ExampleHint,
  GateList,
  PersonPicker,
  PhaseIntro,
  Pill,
  Seg,
  SegChips,
  SelectField,
  StageReview,
  SubTitle,
  TextField,
  VersionField,
  fmtDate,
} from './kit'
import { HINTS, allPeople, decisionRightHolder } from './help'
import {
  ConfirmButton,
  EvidenceField,
  FinalAuthorityField,
  FindingStatementBuilder,
  MANUAL_SECTIONS,
  SECTION_GUIDANCE,
  SuggestLine,
  decisionSeed,
  derivedRunLinks,
  evidenceDerivation,
  findingComputations,
  generatedEvidence,
  generatedSection,
  refutedClaimMatches,
  sectionTemplate,
  suggestedClaimDisposition,
  suggestedQuestionDisposition,
  suggestedStrength,
} from './DeliverBlocks'

type GroupState = 'done' | 'partial' | 'empty'

/** Display text for a package section: edited text wins, else live generation. */
function sectionDisplay(campaign: TeCampaign, s: TeEvidencePackage['sections'][number]): string {
  if (s.edited) return s.content
  const gen = generatedSection(campaign, s)
  return gen !== '' ? gen : s.content
}

/** Persist live generated text into every unedited generated section. */
function persistGeneratedSections() {
  const st = useTeStore.getState()
  const c = st.campaigns.find((x) => x.id === st.activeCampaignId)
  if (!c) return
  st.patchCampaign({
    evidencePackage: {
      ...c.evidencePackage,
      sections: c.evidencePackage.sections.map((s) => {
        if (s.edited) return s
        const gen = generatedSection(c, s)
        return gen === '' ? s : { ...s, content: gen }
      }),
    },
  })
}

// L1: What did we learn?

const STRENGTH_OPTIONS = [
  { v: 'conclusive' as const, label: 'Conclusive', def: 'The evidence supports one answer.' },
  { v: 'directional' as const, label: 'Directional', def: 'The evidence leans one way, not settled.' },
  { v: 'insufficient' as const, label: 'Insufficient', def: 'Not enough valid evidence.' },
  { v: 'not-tested' as const, label: 'Not tested', def: 'No run covered this.' },
]

const LADDER_OPTIONS = [
  { v: 'observation' as const, label: 'What we saw', def: 'A recorded event, no math.' },
  { v: 'calculation' as const, label: 'What we computed', def: 'A number from the data.' },
  { v: 'interpretation' as const, label: 'What it means', def: 'Judgment about the number.' },
  { v: 'recommendation' as const, label: 'What to do', def: 'A proposed action.' },
  { v: 'decision' as const, label: 'What was decided', def: 'The recorded decision.' },
]

function FindingEditor({ campaign, f }: { campaign: TeCampaign; f: TeFinding }) {
  const { patchItem, removeItem, selectRecord, bumpRecordVersion, addItem } = useTeStore.getState()
  const [dissentOpen, setDissentOpen] = useState(false)
  const set = (patch: Partial<TeFinding>) => patchItem('findings', f.id, patch)

  /** Link writes trigger derived fills; generation fills only empty fields. */
  const linkPatch = (patch: Partial<TeFinding>) => {
    patchItem('findings', f.id, patch)
    const st = useTeStore.getState()
    const c2 = st.campaigns.find((x) => x.id === campaign.id)
    const f2 = c2?.findings.find((x) => x.id === f.id)
    if (!c2 || !f2) return
    const extra: Partial<TeFinding> = {}
    if (patch.supportingRunIds !== undefined || patch.contradictingRunIds !== undefined) {
      const d = derivedRunLinks(c2, f2)
      if (f2.threatIds.length === 0 && d.threatIds.length > 0) extra.threatIds = d.threatIds
      if (f2.conditionIds.length === 0 && d.conditionIds.length > 0)
        extra.conditionIds = d.conditionIds
    }
    const gen = generatedEvidence(c2, { ...f2, ...extra })
    const all = { ...extra, ...gen }
    if (Object.keys(all).length > 0) patchItem('findings', f.id, all)
  }

  /** Question pick fills the chained records when exactly one candidate exists. */
  const pickQuestion = (v: string | null) => {
    const patch: Partial<TeFinding> = { questionId: v ?? '' }
    if (v) {
      const hyps = campaign.hypotheses.filter((h) => h.questionId === v)
      if (hyps.length === 1 && !f.hypothesisId) patch.hypothesisId = hyps[0].id
      const claimIds = [...new Set(hyps.map((h) => h.claimId).filter((x): x is string => x !== null))]
      if (claimIds.length === 1 && !f.claimId) patch.claimId = claimIds[0]
      const ms = campaign.measures.filter((m) => m.questionId === v)
      if (ms.length === 1 && f.measureIds.length === 0) patch.measureIds = [ms[0].id]
    }
    linkPatch(patch)
  }

  /** Supporting-run pick fills configId from the runs' cards when unambiguous. */
  const pickSupportingRuns = (v: string[]) => {
    const patch: Partial<TeFinding> = { supportingRunIds: v }
    if (!f.configId) {
      const configIds = [
        ...new Set(
          v
            .map((id) => {
              const r = campaign.runs.find((x) => x.id === id)
              if (!r) return null
              return r.actualConfigId ?? campaign.cards.find((c) => c.id === r.cardId)?.configId ?? null
            })
            .filter((x): x is string => x !== null),
        ),
      ]
      if (configIds.length === 1) patch.configId = configIds[0]
    }
    linkPatch(patch)
  }

  const blockers = findingBlockers(campaign, f)
  const refuted = refutedClaimMatches(f.statement)
  const people = allPeople(campaign)
  const comps = findingComputations(campaign, f)
  const derivation = evidenceDerivation(campaign, f)
  const claims = campaign.registers.filter((r) => r.kind === 'claim')
  const assumptionRegs = campaign.registers.filter((r) => r.kind === 'assumption')
  const hyp = campaign.hypotheses.find((h) => h.id === f.hypothesisId)
  const linkedActions = campaign.actions.filter((a) => a.findingId === f.id)
  const linkedRunIds = [...new Set([...f.supportingRunIds, ...f.contradictingRunIds])]
  const nonIncludable = linkedRunIds.filter((id) => {
    const r = campaign.runs.find((x) => x.id === id)
    return r !== undefined && !runIncludable(r, 'failure-investigation')
  }).length
  const runOptions = [...campaign.runs]
    .sort((a, b) => Number(runIncludable(b, 'failure-investigation')) - Number(runIncludable(a, 'failure-investigation')))
    .map((r) => ({
      id: r.id,
      label: r.id,
      sub: runEvidenceLabel(r),
      pill: runIncludable(r, 'failure-investigation') ? undefined : ('warn' as const),
    }))
  const strengthSugg = suggestedStrength(comps)
  const findingsRight = decisionRightHolder(campaign, 'findings')
  const assumptionsPicked = f.assumptions
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  const onAssumptions = (v: string | string[] | null) => {
    const list = Array.isArray(v) ? v : v == null ? [] : [v]
    for (const s of list) {
      if (s.trim() !== '' && !assumptionRegs.some((r) => r.statement.trim() === s.trim())) {
        addItem('registers', {
          id: newId('reg'),
          kind: 'assumption',
          statement: s.trim(),
          sourceAndDate: '',
          relevance: '',
          rank: null,
          disposition: null,
          dispositionNote: '',
          notes: '',
        })
      }
    }
    set({ assumptions: list.join('; ') })
  }

  return (
    <div className="run-row">
      <SubTitle
        action={
          blockers.length === 0 ? (
            <Pill kind="good" text="releasable" />
          ) : (
            <Pill kind="bad" text={`${blockers.length} blocker(s)`} />
          )
        }
      >
        {f.id} {f.version}
      </SubTitle>
      <GateList items={blockers} kind="bad" />

      <SubTitle>Statement</SubTitle>
      <FindingStatementBuilder campaign={campaign} value={f.statement} onChange={(v) => set({ statement: v })} />
      <ExampleHint
        definition="One statement at one ladder rung. Say what the evidence shows, no more."
        example="[system] detected the [threat] beyond the required range under [condition]."
        why="A statement that mixes observation with judgment cannot be traced."
      />
      <GateList
        items={refuted.map((c) => `This wording matches a refuted claim: ${c}. Check the evidence.`)}
        kind="warn"
      />

      <SubTitle>Chain links</SubTitle>
      <div className="field-row">
        <EntityPicker
          label="Question"
          options={campaign.questions.map((q) => ({ id: q.id, label: q.id, sub: q.wording.slice(0, 48) }))}
          value={f.questionId || null}
          onChange={pickQuestion}
        />
        <EntityPicker
          label="Claim"
          options={claims.map((r) => ({ id: r.id, label: r.id, sub: r.statement.slice(0, 48) }))}
          value={f.claimId}
          onChange={(v) => linkPatch({ claimId: v })}
        />
      </div>
      <div className="field-row">
        <EntityPicker
          label="Hypothesis"
          options={campaign.hypotheses.map((h) => ({ id: h.id, label: h.id, sub: h.producesBehavior.slice(0, 48) }))}
          value={f.hypothesisId}
          onChange={(v) => linkPatch({ hypothesisId: v })}
        />
        <EntityPicker
          label="Configuration"
          options={campaign.configs.map((c) => ({ id: c.id, label: `${c.name || c.id} ${c.version}` }))}
          value={f.configId}
          onChange={(v) => linkPatch({ configId: v })}
        />
      </div>
      <EntityPicker
        label="Supporting runs"
        options={runOptions}
        multi
        values={f.supportingRunIds}
        onChangeMulti={pickSupportingRuns}
      />
      <EntityPicker
        label="Contradicting runs"
        options={runOptions}
        multi
        values={f.contradictingRunIds}
        onChangeMulti={(v) => linkPatch({ contradictingRunIds: v })}
      />
      {linkedRunIds.map(id => {
        const run = campaign.runs.find(r => r.id === id)
        return <p key={id} className="muted small">{id}: {run ? runEvidenceLabel(run) : 'missing run'}</p>
      })}
      <p className="muted small">
        Invalid or excluded runs support qualified failure investigation. Quantitative results
        include valid trials and only the named measures from conditional trials.
      </p>
      {nonIncludable > 0 && (
        <div className="field-row">
          <Pill kind="warn" text="check linked runs" />
          <div className="muted small">{nonIncludable} linked run(s) are pending adjudication.</div>
        </div>
      )}
      <div className="field-row">
        <EntityPicker
          label="Threats"
          options={campaign.threats.map((t) => ({ id: t.id, label: t.name || t.id }))}
          multi
          values={f.threatIds}
          onChangeMulti={(v) => linkPatch({ threatIds: v })}
        />
        <EntityPicker
          label="Conditions"
          options={campaign.conditions.map((c) => ({ id: c.id, label: c.name || c.id }))}
          multi
          values={f.conditionIds}
          onChangeMulti={(v) => linkPatch({ conditionIds: v })}
        />
      </div>
      <EntityPicker
        label="Measures"
        options={campaign.measures.map((m) => ({ id: m.id, label: `${m.id}: ${m.name || 'unnamed'}` }))}
        multi
        values={f.measureIds}
        onChangeMulti={(v) => linkPatch({ measureIds: v })}
      />

      <SubTitle>Evidence detail</SubTitle>
      <p className="muted small">Text below derives from the linked records. Edit any field; revert restores the derivation.</p>
      <EvidenceField label="Quantified result" rows={2} value={f.quantifiedResult} derived={derivation.quantifiedResult as string | undefined} onChange={(v) => set({ quantifiedResult: v })} />
      <EvidenceField label="Result vs required value" value={f.thresholdComparison} derived={derivation.thresholdComparison as string | undefined} onChange={(v) => set({ thresholdComparison: v })} />
      <div className="field-row">
        <EvidenceField label="How many runs count?" help="Sample and independence of the counted runs." value={f.sampleAndIndependence} derived={derivation.sampleAndIndependence as string | undefined} onChange={(v) => set({ sampleAndIndependence: v })} />
        <EvidenceField label="How sure are we?" help="Uncertainty interval on the estimate." value={f.uncertaintyNote} derived={derivation.uncertaintyNote as string | undefined} onChange={(v) => set({ uncertaintyNote: v })} />
      </div>
      <EvidenceField label="Missing and excluded data" value={f.missingAndExcludedData} derived={derivation.missingAndExcludedData as string | undefined} onChange={(v) => set({ missingAndExcludedData: v })} />
      {f.hypothesisId && (
        <EvidenceField label="Result vs prediction" value={f.comparisonWithPrediction} derived={derivation.comparisonWithPrediction as string | undefined} onChange={(v) => set({ comparisonWithPrediction: v })} />
      )}
      <TextField label="What else could explain this?" help="Confounders and alternative explanations." value={f.confoundersAndAlternatives} onChange={(v) => set({ confoundersAndAlternatives: v })} />
      {hyp && hyp.competingExplanations.trim() !== '' && f.confoundersAndAlternatives.trim() === '' && (
        <SuggestLine text={hyp.competingExplanations} source={hyp.id} onAccept={() => set({ confoundersAndAlternatives: hyp.competingExplanations })} />
      )}

      <SubTitle>Where does this finding hold?</SubTitle>
      <EvidenceField label="Applies to" help={HINTS['generalization-bounds'].definition} value={f.appliesTo} derived={derivation.appliesTo as string | undefined} onChange={(v) => set({ appliesTo: v })} />
      <EvidenceField label="Does not apply to" value={f.doesNotApplyTo} derived={derivation.doesNotApplyTo as string | undefined} onChange={(v) => set({ doesNotApplyTo: v })} />
      <SegChips
        label="Assumptions this finding rests on"
        help="Pick from the assumption register. A new entry joins the register."
        options={assumptionRegs.map((r) => ({ v: r.statement, label: r.statement.slice(0, 48) || r.id }))}
        value={assumptionsPicked}
        multi
        allowCustom
        onChange={onAssumptions}
      />

      <SubTitle>Strength and kind</SubTitle>
      <SegChips
        label="How strong is the evidence?"
        options={STRENGTH_OPTIONS}
        value={f.strength}
        onChange={(v) => {
          if (v != null && !Array.isArray(v)) set({ strength: v })
        }}
      />
      {strengthSugg !== null && strengthSugg !== f.strength && (
        <SuggestLine text={`Suggested: ${strengthSugg}`} source="computed results" onAccept={() => set({ strength: strengthSugg })} />
      )}
      <SegChips
        label="What kind of statement is this?"
        help={HINTS['ladder-level'].definition}
        options={LADDER_OPTIONS}
        value={f.ladderLevel}
        onChange={(v) => {
          if (v != null && !Array.isArray(v)) set({ ladderLevel: v })
        }}
      />

      <TextField label="How long is this result good for?" help={HINTS['evidence-life'].definition} value={f.evidenceLifeAndStaleness} onChange={(v) => set({ evidenceLifeAndStaleness: v })} />
      {f.evidenceLifeAndStaleness.trim() === '' && campaign.decision.latestAcceptedEvidenceDate.trim() !== '' && (
        <SuggestLine
          text={`Valid until ${campaign.decision.latestAcceptedEvidenceDate}`}
          source="decision record"
          onAccept={() => set({ evidenceLifeAndStaleness: `Valid until ${campaign.decision.latestAcceptedEvidenceDate}` })}
        />
      )}

      <div className="field-row">
        <VersionField label="Version" value={f.version} onBump={() => bumpRecordVersion('findings', f.id)} />
        <PersonPicker
          label="Approvers"
          value={f.approvers}
          onChange={(v) => set({ approvers: v })}
          people={people}
          prefillSource={findingsRight !== '' && f.approvers.trim() === findingsRight ? 'decision rights' : undefined}
        />
      </div>
      {dissentOpen || f.dissent.trim() !== '' ? (
        <TextField label="Disagreement on record" help={HINTS.dissent.definition} value={f.dissent} onChange={(v) => set({ dissent: v })} />
      ) : (
        <div className="inspector-actions">
          <button type="button" className="mini" onClick={() => setDissentOpen(true)}>
            Record disagreement
          </button>
        </div>
      )}
      <div className="inspector-actions">
        <ConfirmButton
          label="Remove finding"
          disabled={linkedActions.length > 0}
          title={linkedActions.length > 0 ? `In use: ${linkedActions.length} action(s)` : undefined}
          onConfirm={() => {
            removeItem('findings', f.id)
            selectRecord('findings', null)
          }}
        />
      </div>
    </div>
  )
}

function FindingsGroup({ campaign, state }: { campaign: TeCampaign; state: GroupState }) {
  const { addFinding, patchItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.findings ?? null)
  const f = campaign.findings.find((x) => x.id === selected)
  return (
    <DecisionGroup id="deliver-findings" question="What did we learn?" hint="Findings: statements traced to questions, runs, and measures." tier="required" state={state}>
      <ChipList
        items={campaign.findings.map((x) => ({ id: x.id, label: `${x.id}: ${x.statement.slice(0, 32) || 'new'}` }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('findings', id)}
        onAdd={() => {
          const id = addFinding()
          const approvers = decisionRightHolder(campaign, 'findings')
          if (approvers !== '') patchItem('findings', id, { approvers })
          selectRecord('findings', id)
        }}
        addLabel="Add finding"
      />
      {campaign.findings.length === 0 && <p className="muted small">No findings yet. Add finding.</p>}
      {f && <FindingEditor key={f.id} campaign={campaign} f={f} />}
    </DecisionGroup>
  )
}

// L2: What should the customer do?

function DecisionEffectGroup({ campaign, state }: { campaign: TeCampaign; state: GroupState }) {
  const { patchItem, selectRecord, createActionFromFinding } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.findings ?? null)
  const f = campaign.findings.find((x) => x.id === selected)
  return (
    <DecisionGroup id="deliver-effect" question="What should the customer do?" hint="Decision implication, customer effect, and recommended action per finding." tier="recommended" state={state}>
      {!f && <p className="muted small">Pick a finding above first.</p>}
      {f && (
        <div className="run-row">
          <div className="muted small">{f.id}: {f.statement.slice(0, 64) || 'no statement yet'}</div>
          <TextField label="What does this mean for the decision?" rows={2} value={f.decisionImplication} onChange={(v) => patchItem('findings', f.id, { decisionImplication: v })} />
          {f.decisionImplication.trim() === '' &&
            (() => {
              const seed = decisionSeed(campaign, findingComputations(campaign, f))
              return seed ? (
                <SuggestLine
                  text={`Result class ${seed.cls}: ${seed.text}`}
                  source="qualify action map"
                  onAccept={() => patchItem('findings', f.id, { decisionImplication: seed.text })}
                />
              ) : null
            })()}
          <div className="field-row">
            <TextField label="Effect on the customer" value={f.customerEffect} onChange={(v) => patchItem('findings', f.id, { customerEffect: v })} />
            <TextField label="Recommended action" value={f.recommendedAction} onChange={(v) => patchItem('findings', f.id, { recommendedAction: v })} />
          </div>
          <div className="inspector-actions">
            <button
              type="button"
              className="mini"
              onClick={() => {
                const id = createActionFromFinding(f.id)
                if (id) selectRecord('actions', id)
              }}
            >
              Create action from finding
            </button>
          </div>
        </div>
      )}
    </DecisionGroup>
  )
}

// L3: Who does what by when?

function ActionsGroup({ campaign, state }: { campaign: TeCampaign; state: GroupState }) {
  const { addItem, patchItem, removeItem } = useTeStore.getState()
  const people = allPeople(campaign)
  const actionRight = decisionRightHolder(campaign, 'customer action')
  return (
    <DecisionGroup id="deliver-actions" question="Who does what by when?" hint="Follow-up actions with owners, due dates, and closure evidence." tier="recommended" state={state}>
      <div className="inspector-actions">
        <button
          type="button"
          className="mini"
          onClick={() =>
            addItem('actions', {
              id: newId('act'),
              findingId: null,
              decisionOwner: actionRight,
              executionOwner: '',
              dueDate: '',
              requiredWork: '',
              evidenceForClosure: '',
              riskIfLate: '',
              status: 'open',
              communicationRequired: '',
            })
          }
        >
          Add action
        </button>
      </div>
      {campaign.actions.length === 0 && <p className="muted small">No actions yet. Add action, or create one from a finding.</p>}
      {campaign.actions.map((a) => {
        const finding = campaign.findings.find((x) => x.id === a.findingId)
        return (
          <div key={a.id} className="run-row">
            <div className="field-row">
              <EntityPicker
                label="Finding"
                options={campaign.findings.map((x) => ({ id: x.id, label: x.id, sub: x.statement.slice(0, 40) }))}
                value={a.findingId}
                onChange={(v) => patchItem('actions', a.id, { findingId: v })}
              />
              <PersonPicker
                label="Decision owner"
                value={a.decisionOwner}
                onChange={(v) => patchItem('actions', a.id, { decisionOwner: v })}
                people={people}
                prefillSource={actionRight !== '' && a.decisionOwner.trim() === actionRight ? 'decision rights' : undefined}
              />
              <PersonPicker label="Execution owner" value={a.executionOwner} onChange={(v) => patchItem('actions', a.id, { executionOwner: v })} people={people} />
              <DateField label="Due date" value={a.dueDate || null} onChange={(v) => patchItem('actions', a.id, { dueDate: v ?? '' })} />
            </div>
            <TextField label="Required work" rows={2} value={a.requiredWork} onChange={(v) => patchItem('actions', a.id, { requiredWork: v })} />
            {finding && a.requiredWork.trim() !== '' && a.requiredWork === finding.recommendedAction && (
              <div className="provenance-line">
                <span className="provenance-chip">from {finding.id}</span>
              </div>
            )}
            <TextField label="Evidence for closure" help="What proves the work is done." value={a.evidenceForClosure} onChange={(v) => patchItem('actions', a.id, { evidenceForClosure: v })} />
            <AdvancedDisclosure>
              <div className="field-row">
                <TextField label="Risk if late" value={a.riskIfLate} onChange={(v) => patchItem('actions', a.id, { riskIfLate: v })} />
                <PersonPicker label="Who must be told?" value={a.communicationRequired} onChange={(v) => patchItem('actions', a.id, { communicationRequired: v })} people={people} multi />
              </div>
            </AdvancedDisclosure>
            <div className="field-row">
              <div className="field">
                <span>Status</span>
                <Seg
                  value={a.status}
                  options={[
                    { v: 'open' as const, label: 'Open' },
                    { v: 'closed' as const, label: 'Closed' },
                    { v: 'transferred' as const, label: 'Transferred' },
                  ]}
                  onChange={(v) => patchItem('actions', a.id, { status: v })}
                />
              </div>
              <ConfirmButton label="Remove action" onConfirm={() => removeItem('actions', a.id)} />
            </div>
          </div>
        )
      })}
    </DecisionGroup>
  )
}

// L4: What did the team learn?

function DebriefsGroup({ campaign, state }: { campaign: TeCampaign; state: GroupState }) {
  const { addDebrief, patchItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.debriefs ?? null)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const d = campaign.debriefs.find((x) => x.id === selected)
  const completedRuns = campaign.runs.filter((r) => r.endAt !== null)
  const people = allPeople(campaign)
  return (
    <DecisionGroup id="deliver-debriefs" question="What did the team learn?" hint="After-action review. Prompts come from the seed bank." tier="recommended" state={state}>
      <ChipList
        items={campaign.debriefs.map((x) => ({ id: x.id, label: `${x.kind} · ${x.date}${x.runId ? ` · ${x.runId}` : ''}` }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('debriefs', id)}
        onAdd={() => {
          const id = addDebrief('aar')
          patchItem('debriefs', id, { answers: AAR_QUESTIONS.map((question) => ({ question, answer: '' })) })
          selectRecord('debriefs', id)
        }}
        addLabel="New AAR"
      />
      {campaign.debriefs.length === 0 && <p className="muted small">No debriefs yet. New AAR.</p>}
      {d && (
        <div className="run-row">
          <SubTitle>
            {d.kind} debrief {'·'} {d.date}
          </SubTitle>
          {d.answers.map((a, i) => (
            <TextField key={i} label={a.question} rows={2} value={a.answer} onChange={(v) => patchItem('debriefs', d.id, { answers: d.answers.map((x, j) => (j === i ? { ...x, answer: v } : x)) })} />
          ))}
          <SubTitle
            action={
              <button
                type="button"
                className="mini"
                onClick={() =>
                  patchItem('debriefs', d.id, {
                    improvements: [...d.improvements, { id: newId('imp'), text: '', owner: '', dueDate: '', destination: 'standard-work' as const }],
                  })
                }
              >
                Add improvement
              </button>
            }
          >
            Improvements
          </SubTitle>
          {d.improvements.map((imp) => (
            <div key={imp.id} className="field-row te-table-row">
              <TextField label="Improvement" value={imp.text} onChange={(v) => patchItem('debriefs', d.id, { improvements: d.improvements.map((x) => (x.id === imp.id ? { ...x, text: v } : x)) })} />
              <PersonPicker label="Owner" value={imp.owner} onChange={(v) => patchItem('debriefs', d.id, { improvements: d.improvements.map((x) => (x.id === imp.id ? { ...x, owner: v } : x)) })} people={people} />
              <DateField label="Due date" value={imp.dueDate || null} onChange={(v) => patchItem('debriefs', d.id, { improvements: d.improvements.map((x) => (x.id === imp.id ? { ...x, dueDate: v ?? '' } : x)) })} />
              <div className="field">
                <span>Where does it go?</span>
                <Seg
                  value={imp.destination}
                  options={[
                    { v: 'standard-work' as const, label: 'Standard work' },
                    { v: 'product-backlog' as const, label: 'Product backlog' },
                  ]}
                  onChange={(v) => patchItem('debriefs', d.id, { improvements: d.improvements.map((x) => (x.id === imp.id ? { ...x, destination: v } : x)) })}
                />
              </div>
              <ConfirmButton label="Remove" onConfirm={() => patchItem('debriefs', d.id, { improvements: d.improvements.filter((x) => x.id !== imp.id) })} />
            </div>
          ))}
          <p className="muted small">AAR within five working days. Every improvement gets an owner and a destination.</p>
        </div>
      )}
      <SubTitle>Immediate run debriefs</SubTitle>
      {completedRuns.length === 0 && <p className="muted small">No completed runs.</p>}
      {completedRuns.map((r) => (
        <div key={r.id}>
          <div className="field-row te-table-row">
            <div className="muted small">
              {r.id} {'·'} ended {fmtDate(r.endAt)}
              {r.preliminaryUse ? ` · ${r.preliminaryUse}` : ''}
            </div>
            <button type="button" className="mini" onClick={() => setExpandedRun(expandedRun === r.id ? null : r.id)}>
              {expandedRun === r.id ? 'Hide' : 'Show'}
            </button>
          </div>
          {expandedRun === r.id && (
            <div className="run-row">
              <div className="muted small">Planned and occurred: {r.debrief.plannedVsOccurred || 'not recorded'}</div>
              <div className="muted small">Differences: {r.debrief.differences || 'not recorded'}</div>
              <div className="muted small">Sources recorded: {r.debrief.sourcesRecorded || 'not recorded'}</div>
              <div className="muted small">Warnings or failures: {r.debrief.warningsOrFailures || 'not recorded'}</div>
              <div className="muted small">Unexpected result: {r.debrief.unexpectedResult || 'not recorded'}</div>
              <div className="muted small">Repeat needed: {r.debrief.repeatNeeded || 'not recorded'}</div>
            </div>
          )}
        </div>
      ))}
    </DecisionGroup>
  )
}

// L5: Is the evidence package complete?

function PackageGroup({ campaign, state }: { campaign: TeCampaign; state: GroupState }) {
  const { patchCampaign } = useTeStore.getState()
  const pkg = campaign.evidencePackage
  const people = allPeople(campaign)
  const setPkg = (patch: Partial<TeEvidencePackage>) => patchCampaign({ evidencePackage: { ...pkg, ...patch } })
  const setSection = (n: number, content: string) =>
    setPkg({ sections: pkg.sections.map((s) => (s.n === n ? { ...s, content, edited: true } : s)) })
  const revertSection = (n: number) =>
    setPkg({ sections: pkg.sections.map((s) => (s.n === n ? { ...s, content: '', edited: false } : s)) })
  const methodDefault = campaign.charter.acceptance.methodApprovalAuthority.trim()
  const evidenceDefault = campaign.charter.evidenceAcceptanceAuthority.trim()
  return (
    <DecisionGroup id="deliver-package" question="Is the evidence package complete?" hint="Decision evidence package: 20 sections. Generated text tracks the records; edits stick." tier="recommended" state={state}>
      <div className="field-row">
        {pkg.deliveredAt && <Pill kind="good" text={`delivered ${fmtDate(pkg.deliveredAt)}`} />}
        <button type="button" className="mini" onClick={() => persistGeneratedSections()}>
          Save generated text
        </button>
        <div className="muted small">Generated sections track the records live. Save writes them; edits always stick.</div>
      </div>
      {pkg.sections.map((s) => {
        const manual = MANUAL_SECTIONS.includes(s.n)
        if (manual) {
          const template = sectionTemplate(campaign, s.n)
          return (
            <div key={s.n}>
              <TextField label={`${s.n}. ${s.title}`} rows={3} value={s.content} placeholder={SECTION_GUIDANCE[s.n]} onChange={(v) => setSection(s.n, v)} />
              {s.content.trim() === '' && template !== '' && (
                <div className="provenance-line">
                  <button type="button" className="mini" onClick={() => setSection(s.n, template)}>
                    Insert template
                  </button>
                </div>
              )}
            </div>
          )
        }
        const display = sectionDisplay(campaign, s)
        return (
          <div key={s.n} className={`provenance ${s.edited ? 'edited' : 'inherited'}`}>
            <TextField label={`${s.n}. ${s.title}`} rows={3} value={display} onChange={(v) => setSection(s.n, v)} />
            <div className="provenance-line">
              {s.edited ? (
                <>
                  <span className="provenance-chip">edited</span>
                  <button type="button" className="mini" onClick={() => revertSection(s.n)}>
                    Revert
                  </button>
                </>
              ) : (
                <span className="provenance-chip">from campaign records</span>
              )}
            </div>
          </div>
        )
      })}

      <SubTitle>Acceptance</SubTitle>
      <div className="field-row">
        <PersonPicker
          label="Method acceptance"
          value={pkg.methodAcceptance}
          onChange={(v) => setPkg({ methodAcceptance: v })}
          people={people}
          prefillSource={methodDefault !== '' && pkg.methodAcceptance.trim() === methodDefault ? 'charter' : undefined}
        />
        <PersonPicker
          label="Evidence acceptance"
          value={pkg.evidenceAcceptance}
          onChange={(v) => setPkg({ evidenceAcceptance: v })}
          people={people}
          prefillSource={evidenceDefault !== '' && pkg.evidenceAcceptance.trim() === evidenceDefault ? 'charter' : undefined}
        />
      </div>
      {pkg.methodAcceptance.trim() === '' && methodDefault !== '' && (
        <SuggestLine text={methodDefault} source="charter method approval authority" onAccept={() => setPkg({ methodAcceptance: methodDefault })} />
      )}
      {pkg.evidenceAcceptance.trim() === '' && evidenceDefault !== '' && (
        <SuggestLine text={evidenceDefault} source="charter evidence acceptance authority" onAccept={() => setPkg({ evidenceAcceptance: evidenceDefault })} />
      )}
      <FinalAuthorityField value={pkg.finalAuthorityAndDate} onChange={(v) => setPkg({ finalAuthorityAndDate: v })} people={people} />
    </DecisionGroup>
  )
}

// L6: Can we close?

const QUESTION_DISPOSITIONS = [
  { v: 'answered' as const, label: 'Answered' },
  { v: 'partially-answered' as const, label: 'Partly answered' },
  { v: 'not-answered' as const, label: 'Not answered' },
]

const EVIDENCE_LEVELS = [
  { v: 'component-behavior' as const, label: 'Component' },
  { v: 'interface-behavior' as const, label: 'Interface' },
  { v: 'mission-conditions' as const, label: 'Mission conditions' },
  { v: 'end-to-end-mission-effect' as const, label: 'End-to-end effect' },
]

const CLAIM_DISPOSITIONS = [
  { v: 'supported' as const, label: 'Supported' },
  { v: 'contradicted' as const, label: 'Contradicted' },
  { v: 'directionally-supported' as const, label: 'Leans supported' },
  { v: 'inconclusive' as const, label: 'Inconclusive' },
  { v: 'untested' as const, label: 'Untested' },
  { v: 'outside-scope' as const, label: 'Out of scope' },
]

function CloseoutGroup({ campaign, state }: { campaign: TeCampaign; state: GroupState }) {
  const { patchItem, patchCampaign, markPackageDelivered } = useTeStore.getState()
  const blockers = deliveryBlockers(campaign)
  const claims = campaign.registers.filter((r) => r.kind === 'claim')
  const pkg = campaign.evidencePackage
  const openActions = campaign.actions.filter((a) => a.status === 'open')
  const disposedQ = campaign.questions.filter((q) => q.disposition !== null).length
  const disposedC = claims.filter((r) => r.disposition !== null).length
  const sectionsComplete = pkg.sections.filter((s) => sectionDisplay(campaign, s).trim() !== '').length
  const strengths = (['conclusive', 'directional', 'insufficient', 'not-tested'] as const)
    .map((s) => ({ s, n: campaign.findings.filter((f) => f.strength === s).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} ${x.s}`)
    .join(', ')
  const findingsBad = campaign.findings.filter((f) => findingBlockers(campaign, f).length > 0).length
  return (
    <DecisionGroup id="deliver-closeout" question="Can we close?" hint="Dispose every question and claim, close or transfer actions, deliver the package." tier="required" state={state}>
      <SubTitle>Question dispositions</SubTitle>
      {campaign.questions.length === 0 && <p className="muted small">No questions defined.</p>}
      {campaign.questions.map((q) => {
        const sugg = q.disposition === null ? suggestedQuestionDisposition(campaign, q.id) : null
        return (
          <div key={q.id} className="run-row">
            <div className="muted small">
              {q.id}: {q.wording || 'no wording'}
            </div>
            <div className="field-row">
              <SelectField label="Is it answered?" value={q.disposition} allowEmpty="undisposed" options={QUESTION_DISPOSITIONS} onChange={(v) => patchItem('questions', q.id, { disposition: v })} />
              <SelectField label="How close to a mission?" help="Evidence level of the answer." value={q.evidenceLevel} allowEmpty="not set" options={EVIDENCE_LEVELS} onChange={(v) => patchItem('questions', q.id, { evidenceLevel: v })} />
              {q.disposition !== null && q.disposition !== 'answered' && (
                <TextField label="Why not fully answered?" value={q.dispositionNote} onChange={(v) => patchItem('questions', q.id, { dispositionNote: v })} />
              )}
            </div>
            {sugg !== null && (
              <SuggestLine text={`Suggested: ${sugg}`} source="linked finding strengths" onAccept={() => patchItem('questions', q.id, { disposition: sugg })} />
            )}
          </div>
        )
      })}

      <SubTitle>Claim dispositions</SubTitle>
      {claims.length === 0 && <p className="muted small">No claims registered.</p>}
      {claims.map((r) => {
        const sugg = r.disposition === null ? suggestedClaimDisposition(campaign, r.id) : null
        return (
          <div key={r.id} className="field-row te-table-row">
            <div className="field">
              <span>{r.id}</span>
              <div className="muted small">{r.statement.slice(0, 80) || 'no statement'}</div>
            </div>
            <SelectField label="Did the evidence support it?" value={r.disposition} allowEmpty="undisposed" options={CLAIM_DISPOSITIONS} onChange={(v) => patchItem('registers', r.id, { disposition: v })} />
            {sugg !== null && (
              <SuggestLine text={`Suggested: ${sugg}`} source="linked findings and outcomes" onAccept={() => patchItem('registers', r.id, { disposition: sugg })} />
            )}
          </div>
        )
      })}

      <SubTitle>Open actions</SubTitle>
      {openActions.length === 0 && <p className="muted small">No open actions.</p>}
      {openActions.map((a) => (
        <div key={a.id} className="muted small">
          {a.id}: {a.requiredWork || 'no work stated'} {'·'} due {a.dueDate || 'not set'}
        </div>
      ))}

      <StageReview
        title="Deliver review"
        rows={[
          { label: 'Questions disposed', value: `${disposedQ}/${campaign.questions.length}` },
          { label: 'Claims disposed', value: `${disposedC}/${claims.length}` },
          { label: 'Findings', value: strengths || 'none' },
          { label: 'Open actions', value: String(openActions.length) },
          { label: 'Package sections', value: `${sectionsComplete}/${pkg.sections.length}` },
          { label: 'Method acceptance', value: pkg.methodAcceptance },
          { label: 'Evidence acceptance', value: pkg.evidenceAcceptance },
        ]}
        issues={[
          ...blockers.map((t) => ({ level: 'block' as const, text: t })),
          ...(findingsBad > 0 ? [{ level: 'warn' as const, text: `${findingsBad} finding(s) have open blockers.` }] : []),
        ]}
        passLabel="Mark package delivered"
        disabled={pkg.deliveredAt !== null}
        onPass={() => {
          persistGeneratedSections()
          markPackageDelivered()
        }}
      />
      <div className="inspector-actions">
        <button
          type="button"
          className="primary"
          disabled={blockers.length > 0 || campaign.phase === 'closed'}
          title={blockers.length > 0 ? 'Dispose every question and claim, and close or transfer actions.' : undefined}
          onClick={() => patchCampaign({ phase: 'closed' })}
        >
          Close campaign
        </button>
        {campaign.phase === 'closed' && <Pill kind="good" text="closed" />}
      </div>
    </DecisionGroup>
  )
}

// Panel

export function DeliverPanel({ campaign }: { campaign: TeCampaign }) {
  const pkg = campaign.evidencePackage
  const claims = campaign.registers.filter((r) => r.kind === 'claim')
  const findingsState: GroupState =
    campaign.findings.length === 0
      ? 'empty'
      : campaign.findings.every((f) => findingBlockers(campaign, f).length === 0)
        ? 'done'
        : 'partial'
  const effectState: GroupState =
    campaign.findings.length === 0
      ? 'empty'
      : campaign.findings.every((f) => f.decisionImplication.trim() !== '')
        ? 'done'
        : campaign.findings.some((f) => f.decisionImplication.trim() !== '')
          ? 'partial'
          : 'empty'
  const actionsState: GroupState =
    campaign.actions.length === 0
      ? 'empty'
      : campaign.actions.every((a) => a.status !== 'open')
        ? 'done'
        : 'partial'
  const debriefsState: GroupState = campaign.debriefs.length > 0 ? 'done' : 'empty'
  const sectionsComplete = pkg.sections.filter((s) => sectionDisplay(campaign, s).trim() !== '').length
  const packageState: GroupState =
    pkg.deliveredAt !== null
      ? 'done'
      : sectionsComplete === 0
        ? 'empty'
        : sectionsComplete === pkg.sections.length && pkg.methodAcceptance.trim() !== '' && pkg.evidenceAcceptance.trim() !== ''
          ? 'done'
          : 'partial'
  const blockers = closeoutBlockers(campaign)
  const disposedAny =
    campaign.questions.some((q) => q.disposition !== null) || claims.some((r) => r.disposition !== null)
  const closeoutState: GroupState =
    campaign.phase === 'closed' ? 'done' : blockers.length === 0 && pkg.deliveredAt !== null ? 'done' : disposedAny ? 'partial' : 'empty'

  return (
    <div className="te-panel">
      <PhaseIntro
        phase="deliver"
        gate={
          campaign.phase === 'closed'
            ? { kind: 'good', text: 'closed' }
            : pkg.deliveredAt !== null
              ? { kind: 'good', text: 'delivered' }
              : blockers.length > 0
                ? { kind: 'warn', text: `${blockers.length} closeout blocker(s)` }
                : { kind: 'neutral', text: 'in work' }
        }
      />
      <FindingsGroup campaign={campaign} state={findingsState} />
      <DecisionEffectGroup campaign={campaign} state={effectState} />
      <ActionsGroup campaign={campaign} state={actionsState} />
      <DebriefsGroup campaign={campaign} state={debriefsState} />
      <PackageGroup campaign={campaign} state={packageState} />
      <CloseoutGroup campaign={campaign} state={closeoutState} />
    </div>
  )
}

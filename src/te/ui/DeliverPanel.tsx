import { useState } from 'react'
import type { PackageSection, TeCampaign, TeEvidencePackage, TeFinding } from '../model/types'
import { newId } from '../../model/types'
import { useTeStore } from '../state/teStore'
import { closeoutBlockers, findingBlockers } from '../validate'
import { computeMeasure } from '../calc/measures'
import type { MeasureComputation } from '../calc/measures'
import { runAccounting } from '../calc/accounting'
import { nowIso } from '../model/empty'
import {
  ChipList,
  GateList,
  MultiPicker,
  Pill,
  SelectField,
  Seg,
  SubTitle,
  TextField,
  fmtDate,
} from './kit'

type Tab = 'findings' | 'actions' | 'debriefs' | 'package' | 'closeout'

const AAR_QUESTIONS: string[] = [
  'What created decision value?',
  'What produced invalid runs or delay?',
  'Which assumptions failed?',
  'Which authority or acceptance issue arrived late?',
  'Which interface or data failure repeated?',
  'Which control was too heavy or too weak?',
  'Which work depended on one person?',
  'Which task should be standardized, automated, trained, redesigned, or removed?',
  'What must change before the next campaign?',
]

function fmtNum(n: number): number {
  return Math.round(n * 1000) / 1000
}

function measureSummary(c: MeasureComputation): string {
  const estimate = c.estimate === null ? 'no estimate' : `${fmtNum(c.estimate)}${c.unit ? ` ${c.unit}` : ''}`
  const interval = c.interval ? ` [${fmtNum(c.interval.lo)}, ${fmtNum(c.interval.hi)}] (${c.interval.method})` : ''
  return `${c.measureId} ${c.name || 'unnamed'}: ${estimate}${interval}, n=${c.nIncluded}`
}

function FindingsTab({ campaign }: { campaign: TeCampaign }) {
  const { addFinding, patchItem, removeItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.findings ?? null)
  const [helperMeasureId, setHelperMeasureId] = useState('')
  const f = campaign.findings.find((x) => x.id === selected)
  const set = (patch: Partial<TeFinding>) => f && patchItem('findings', f.id, patch)
  const runOptions = campaign.runs.map((r) => ({ id: r.id, label: `${r.id} (${r.validity}${r.excluded ? ', excluded' : ''})` }))
  const claims = campaign.registers.filter((r) => r.kind === 'claim')
  const helper = helperMeasureId ? computeMeasure(campaign, helperMeasureId) : null
  const blockers = f ? findingBlockers(f) : []

  return (
    <div className="inspector-body">
      <ChipList
        items={campaign.findings.map((x) => ({ id: x.id, label: `${x.id}: ${x.statement.slice(0, 32) || 'new'}` }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('findings', id)}
        onAdd={() => { const id = addFinding(); selectRecord('findings', id) }}
        addLabel="+ finding"
      />
      {f && (
        <div className="run-row">
          <SubTitle action={blockers.length === 0 ? <Pill kind="good" text="releasable" /> : <Pill kind="bad" text={`${blockers.length} blocker(s)`} />}>
            {f.id} {f.version}
          </SubTitle>
          <GateList items={blockers} kind="bad" />
          {blockers.length > 0 && <p className="muted small">A finding with blockers is not releasable.</p>}

          <TextField label="Finding statement" rows={2} value={f.statement} onChange={(v) => set({ statement: v })} />
          <TextField label="Quantified result" rows={2} value={f.quantifiedResult} onChange={(v) => set({ quantifiedResult: v })} />
          <div className="field-row">
            <SelectField label="Quantified-result helper" value={helperMeasureId || null} allowEmpty="pick a measure" options={campaign.measures.map((m) => ({ v: m.id, label: `${m.id}: ${m.name || 'unnamed'}` }))} onChange={(v) => setHelperMeasureId(v ?? '')} />
            {helper && (
              <div className="field">
                <span>Computed</span>
                <div className="muted small">{measureSummary(helper)}</div>
              </div>
            )}
            {helper && (
              <button className="mini" onClick={() => set({ quantifiedResult: [f.quantifiedResult, measureSummary(helper)].filter((x) => x.trim()).join('\n') })}>insert</button>
            )}
          </div>

          <SubTitle>Traceability links</SubTitle>
          <div className="field-row">
            <SelectField label="Question" value={f.questionId || null} allowEmpty="none" options={campaign.questions.map((q) => ({ v: q.id, label: `${q.id}: ${q.wording.slice(0, 32)}` }))} onChange={(v) => set({ questionId: v ?? '' })} />
            <SelectField label="Claim" value={f.claimId} allowEmpty="none" options={claims.map((r) => ({ v: r.id, label: r.statement.slice(0, 40) || r.id }))} onChange={(v) => set({ claimId: v })} />
          </div>
          <div className="field-row">
            <SelectField label="Hypothesis" value={f.hypothesisId} allowEmpty="none" options={campaign.hypotheses.map((h) => ({ v: h.id, label: h.id }))} onChange={(v) => set({ hypothesisId: v })} />
            <SelectField label="Configuration" value={f.configId} allowEmpty="none" options={campaign.configs.map((c) => ({ v: c.id, label: `${c.name || c.id} ${c.version}` }))} onChange={(v) => set({ configId: v })} />
          </div>
          <MultiPicker label="Supporting runs" options={runOptions} value={f.supportingRunIds} onChange={(v) => set({ supportingRunIds: v })} />
          <MultiPicker label="Contradicting runs" options={runOptions} value={f.contradictingRunIds} onChange={(v) => set({ contradictingRunIds: v })} />
          <MultiPicker label="Threats" options={campaign.threats.map((t) => ({ id: t.id, label: t.name || t.id }))} value={f.threatIds} onChange={(v) => set({ threatIds: v })} />
          <MultiPicker label="Conditions" options={campaign.conditions.map((c) => ({ id: c.id, label: c.name || c.id }))} value={f.conditionIds} onChange={(v) => set({ conditionIds: v })} />
          <MultiPicker label="Measures" options={campaign.measures.map((m) => ({ id: m.id, label: `${m.id}: ${m.name || 'unnamed'}` }))} value={f.measureIds} onChange={(v) => set({ measureIds: v })} />

          <SubTitle>Strength and ladder</SubTitle>
          <div className="field">
            <span>Strength</span>
            <Seg value={f.strength} options={(['conclusive', 'directional', 'insufficient', 'not-tested'] as const).map((v) => ({ v, label: v }))} onChange={(v) => set({ strength: v })} />
          </div>
          <div className="field">
            <span>Ladder level</span>
            <Seg value={f.ladderLevel} options={(['observation', 'calculation', 'interpretation', 'recommendation', 'decision'] as const).map((v) => ({ v, label: v }))} onChange={(v) => set({ ladderLevel: v })} />
          </div>
          <p className="muted small">Never merge levels in one statement.</p>

          <SubTitle>Evidence detail</SubTitle>
          <TextField label="Threshold comparison" value={f.thresholdComparison} onChange={(v) => set({ thresholdComparison: v })} />
          <div className="field-row">
            <TextField label="Sample and independence" value={f.sampleAndIndependence} onChange={(v) => set({ sampleAndIndependence: v })} />
            <TextField label="Uncertainty" value={f.uncertaintyNote} onChange={(v) => set({ uncertaintyNote: v })} />
          </div>
          <div className="field-row">
            <TextField label="Missing and excluded data" value={f.missingAndExcludedData} onChange={(v) => set({ missingAndExcludedData: v })} />
            <TextField label="Confounders and alternatives" value={f.confoundersAndAlternatives} onChange={(v) => set({ confoundersAndAlternatives: v })} />
          </div>

          <SubTitle>Applicability</SubTitle>
          <div className="field-row">
            <TextField label="Applies to" value={f.appliesTo} onChange={(v) => set({ appliesTo: v })} />
            <TextField label="Does not apply to" value={f.doesNotApplyTo} onChange={(v) => set({ doesNotApplyTo: v })} />
          </div>
          <div className="field-row">
            <TextField label="Assumptions" value={f.assumptions} onChange={(v) => set({ assumptions: v })} />
            <TextField label="Evidence life and staleness" value={f.evidenceLifeAndStaleness} onChange={(v) => set({ evidenceLifeAndStaleness: v })} />
          </div>

          <SubTitle>Decision effect</SubTitle>
          <TextField label="Decision implication" rows={2} value={f.decisionImplication} onChange={(v) => set({ decisionImplication: v })} />
          <div className="field-row">
            <TextField label="Customer effect" value={f.customerEffect} onChange={(v) => set({ customerEffect: v })} />
            <TextField label="Recommended action" value={f.recommendedAction} onChange={(v) => set({ recommendedAction: v })} />
          </div>
          <TextField label="Comparison with the prediction" value={f.comparisonWithPrediction} onChange={(v) => set({ comparisonWithPrediction: v })} />
          <div className="field-row">
            <TextField label="Version" value={f.version} onChange={(v) => set({ version: v })} />
            <TextField label="Approvers" value={f.approvers} onChange={(v) => set({ approvers: v })} />
            <TextField label="Dissent" value={f.dissent} onChange={(v) => set({ dissent: v })} />
          </div>
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => { removeItem('findings', f.id); selectRecord('findings', null) }}>remove</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionsTab({ campaign }: { campaign: TeCampaign }) {
  const { addItem, patchItem, removeItem } = useTeStore.getState()
  return (
    <div className="inspector-body">
      <SubTitle
        action={
          <button
            className="mini"
            onClick={() =>
              addItem('actions', {
                id: newId('act'),
                findingId: null,
                decisionOwner: '',
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
            + action
          </button>
        }
      >
        Actions
      </SubTitle>
      {campaign.actions.length === 0 && <p className="muted small">No actions yet.</p>}
      {campaign.actions.map((a) => (
        <div key={a.id} className="run-row">
          <div className="field-row">
            <SelectField label="Finding" value={a.findingId} allowEmpty="none" options={campaign.findings.map((x) => ({ v: x.id, label: x.id }))} onChange={(v) => patchItem('actions', a.id, { findingId: v })} />
            <TextField label="Decision owner" value={a.decisionOwner} onChange={(v) => patchItem('actions', a.id, { decisionOwner: v })} />
            <TextField label="Execution owner" value={a.executionOwner} onChange={(v) => patchItem('actions', a.id, { executionOwner: v })} />
            <TextField label="Due date" value={a.dueDate} onChange={(v) => patchItem('actions', a.id, { dueDate: v })} />
          </div>
          <TextField label="Required work" rows={2} value={a.requiredWork} onChange={(v) => patchItem('actions', a.id, { requiredWork: v })} />
          <div className="field-row">
            <TextField label="Evidence for closure" value={a.evidenceForClosure} onChange={(v) => patchItem('actions', a.id, { evidenceForClosure: v })} />
            <TextField label="Risk if late" value={a.riskIfLate} onChange={(v) => patchItem('actions', a.id, { riskIfLate: v })} />
            <TextField label="Communication required" value={a.communicationRequired} onChange={(v) => patchItem('actions', a.id, { communicationRequired: v })} />
          </div>
          <div className="field">
            <span>Status</span>
            <Seg value={a.status} options={(['open', 'closed', 'transferred'] as const).map((v) => ({ v, label: v }))} onChange={(v) => patchItem('actions', a.id, { status: v })} />
          </div>
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => removeItem('actions', a.id)}>remove</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function DebriefsTab({ campaign }: { campaign: TeCampaign }) {
  const { addDebrief, patchItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.debriefs ?? null)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const d = campaign.debriefs.find((x) => x.id === selected)
  const completedRuns = campaign.runs.filter((r) => r.endAt !== null)

  return (
    <div className="inspector-body">
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
      {d && (
        <div className="run-row">
          <SubTitle>{d.kind} debrief · {d.date}</SubTitle>
          {d.answers.map((a, i) => (
            <TextField key={i} label={a.question} rows={2} value={a.answer} onChange={(v) => patchItem('debriefs', d.id, { answers: d.answers.map((x, j) => (j === i ? { ...x, answer: v } : x)) })} />
          ))}
          <SubTitle
            action={
              <button className="mini" onClick={() => patchItem('debriefs', d.id, { improvements: [...d.improvements, { id: newId('imp'), text: '', owner: '', dueDate: '', destination: 'standard-work' as const }] })}>
                + improvement
              </button>
            }
          >
            Improvements
          </SubTitle>
          {d.improvements.map((imp) => (
            <div key={imp.id} className="field-row te-table-row">
              <TextField label="Improvement" value={imp.text} onChange={(v) => patchItem('debriefs', d.id, { improvements: d.improvements.map((x) => (x.id === imp.id ? { ...x, text: v } : x)) })} />
              <TextField label="Owner" value={imp.owner} onChange={(v) => patchItem('debriefs', d.id, { improvements: d.improvements.map((x) => (x.id === imp.id ? { ...x, owner: v } : x)) })} />
              <TextField label="Due date" value={imp.dueDate} onChange={(v) => patchItem('debriefs', d.id, { improvements: d.improvements.map((x) => (x.id === imp.id ? { ...x, dueDate: v } : x)) })} />
              <div className="field">
                <span>Destination</span>
                <Seg value={imp.destination} options={(['standard-work', 'product-backlog'] as const).map((v) => ({ v, label: v }))} onChange={(v) => patchItem('debriefs', d.id, { improvements: d.improvements.map((x) => (x.id === imp.id ? { ...x, destination: v } : x)) })} />
              </div>
              <button className="mini danger" onClick={() => patchItem('debriefs', d.id, { improvements: d.improvements.filter((x) => x.id !== imp.id) })}>×</button>
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
            <div className="muted small">{r.id} · ended {fmtDate(r.endAt)}{r.preliminaryUse ? ` · ${r.preliminaryUse}` : ''}</div>
            <button className="mini" onClick={() => setExpandedRun(expandedRun === r.id ? null : r.id)}>{expandedRun === r.id ? 'hide' : 'show'}</button>
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
    </div>
  )
}

const SECTION_GUIDANCE: Record<number, string> = {
  11: 'State the architecture and mission-thread assessment.',
  14: 'State the alternatives and trade-offs, including delay and no action.',
  16: 'State the retest and evidence-refresh triggers.',
  17: 'State the raw-to-result reproduction instructions.',
  18: 'State data delivery, classification, distribution, retention, and deletion.',
}

function generatedContent(c: TeCampaign, s: PackageSection): string {
  const d = c.decision
  switch (s.n) {
    case 1:
      return [`Decision owner: ${d.authorizedDecisionOwner}`, `Bounded choice: ${d.boundedChoice}`, `Alternatives: ${d.alternatives}`, `Decision date: ${d.decisionDate}`].join('\n')
    case 2:
      return d.blockingUncertainty
    case 3: {
      const first = c.findings[0]
      if (!first) return 'Executive answer: [complete after findings review]'
      return [first.statement, first.decisionImplication].filter((x) => x.trim()).join('\n')
    }
    case 4:
      return [`Mission: ${c.charter.missionAndProtectedOutcome}`, `Configurations: ${c.configs.map((x) => x.name || x.id).join(', ')}`].join('\n')
    case 5:
      return [
        `Threats: ${c.threats.map((t) => `${t.name || t.id} (${t.representationClass})`).join(', ')}`,
        `Conditions: ${c.conditions.map((x) => x.name || x.id).join(', ')}`,
      ].join('\n')
    case 6:
      return [
        ...c.questions.map((q) => `${q.id} (${q.priority}): ${q.wording}`),
        ...c.hypotheses.map((h) => `${h.id}: predicts ${h.predictedValue || 'no prediction'}`),
        ...c.measures.map((m) => `${m.id} ${m.name}${m.threshold !== null ? `, threshold ${m.threshold}${m.unit ? ` ${m.unit}` : ''}` : ''}${m.thresholdApproved ? '' : ' (threshold not customer approved)'}`),
      ].join('\n')
    case 7: {
      const a = c.charter.acceptance
      return [`Relying organization: ${a.relyingOrganization}`, `Method approval authority: ${a.methodApprovalAuthority}`, `Required witnesses: ${a.requiredWitnesses}`, `Evidence standard: ${a.evidenceStandard}`, `Rejection conditions: ${a.rejectionConditions}`].join('\n')
    }
    case 8: {
      const acc = runAccounting(c)
      return `Planned ${acc.planned}, attempted ${acc.attempted}, valid ${acc.valid}, conditional ${acc.conditional}, invalid ${acc.invalid}, excluded ${acc.excluded}, pending ${acc.pending}.`
    }
    case 9:
      return c.findings.filter((f) => f.strength === 'conclusive' || f.strength === 'directional').map((f) => `${f.id} (${f.strength}): ${f.statement}`).join('\n')
    case 10:
      return c.findings.filter((f) => f.strength === 'insufficient' || f.strength === 'not-tested').map((f) => `${f.id} (${f.strength}): ${f.statement}`).join('\n')
    case 12:
      return c.findings
        .map((f) => [f.uncertaintyNote.trim() && `${f.id} uncertainty: ${f.uncertaintyNote}`, f.dissent.trim() && `${f.id} dissent: ${f.dissent}`].filter(Boolean).join('\n'))
        .filter((x) => x !== '')
        .join('\n')
    case 13:
      return c.registers.filter((r) => r.kind === 'claim').map((r) => `${r.statement || r.id}: ${r.disposition ?? 'undisposed'}`).join('\n')
    case 15:
      return c.findings.filter((f) => f.recommendedAction.trim()).map((f) => `${f.id}: ${f.recommendedAction}`).join('\n')
    case 19:
      return c.actions.map((a) => `${a.requiredWork || a.id} (owner ${a.executionOwner || 'unassigned'}, due ${a.dueDate || 'not set'}, ${a.status})`).join('\n')
    case 20: {
      const p = c.evidencePackage
      return [`Method acceptance: ${p.methodAcceptance}`, `Evidence acceptance: ${p.evidenceAcceptance}`, `Final authority and date: ${p.finalAuthorityAndDate}`].join('\n')
    }
    default:
      return s.content || SECTION_GUIDANCE[s.n] || ''
  }
}

function PackageTab({ campaign }: { campaign: TeCampaign }) {
  const { patchCampaign } = useTeStore.getState()
  const pkg = campaign.evidencePackage
  const setPkg = (patch: Partial<TeEvidencePackage>) => patchCampaign({ evidencePackage: { ...pkg, ...patch } })
  const setSection = (n: number, content: string) =>
    setPkg({ sections: pkg.sections.map((s) => (s.n === n ? { ...s, content, edited: true } : s)) })

  return (
    <div className="inspector-body">
      <SubTitle action={pkg.deliveredAt ? <Pill kind="good" text={`delivered ${fmtDate(pkg.deliveredAt)}`} /> : undefined}>
        Decision evidence package (20 sections)
      </SubTitle>
      <div className="inspector-actions">
        <button onClick={() => setPkg({ sections: pkg.sections.map((s) => (s.edited ? s : { ...s, content: generatedContent(campaign, s) })) })}>
          Generate from records
        </button>
      </div>
      <p className="muted small">Generation fills only sections without manual edits.</p>
      {pkg.sections.map((s) => (
        <TextField key={s.n} label={`${s.n}. ${s.title}${s.edited ? ' (edited)' : ''}`} rows={3} value={s.content} onChange={(v) => setSection(s.n, v)} />
      ))}

      <SubTitle>Acceptance</SubTitle>
      <div className="field-row">
        <TextField label="Method acceptance" value={pkg.methodAcceptance} onChange={(v) => setPkg({ methodAcceptance: v })} />
        <TextField label="Evidence acceptance" value={pkg.evidenceAcceptance} onChange={(v) => setPkg({ evidenceAcceptance: v })} />
      </div>
      <TextField label="Final approving authority and date" value={pkg.finalAuthorityAndDate} onChange={(v) => setPkg({ finalAuthorityAndDate: v })} />
      <div className="inspector-actions">
        <button className="primary" disabled={pkg.deliveredAt !== null} onClick={() => setPkg({ deliveredAt: nowIso() })}>Mark delivered</button>
      </div>
    </div>
  )
}

function CloseoutTab({ campaign }: { campaign: TeCampaign }) {
  const { patchItem, patchCampaign } = useTeStore.getState()
  const blockers = closeoutBlockers(campaign)
  const claims = campaign.registers.filter((r) => r.kind === 'claim')
  return (
    <div className="inspector-body">
      <SubTitle>Question dispositions</SubTitle>
      {campaign.questions.length === 0 && <p className="muted small">No questions defined.</p>}
      {campaign.questions.map((q) => (
        <div key={q.id} className="run-row">
          <div className="muted small">{q.id}: {q.wording || 'no wording'}</div>
          <div className="field-row">
            <SelectField label="Disposition" value={q.disposition} allowEmpty="undisposed" options={(['answered', 'partially-answered', 'not-answered'] as const).map((v) => ({ v, label: v }))} onChange={(v) => patchItem('questions', q.id, { disposition: v })} />
            <SelectField label="Evidence level" value={q.evidenceLevel} allowEmpty="not set" options={(['component-behavior', 'interface-behavior', 'mission-conditions', 'end-to-end-mission-effect'] as const).map((v) => ({ v, label: v }))} onChange={(v) => patchItem('questions', q.id, { evidenceLevel: v })} />
            <TextField label="Note" value={q.dispositionNote} onChange={(v) => patchItem('questions', q.id, { dispositionNote: v })} />
          </div>
        </div>
      ))}

      <SubTitle>Claim dispositions</SubTitle>
      {claims.length === 0 && <p className="muted small">No claims registered.</p>}
      {claims.map((r) => (
        <div key={r.id} className="field-row te-table-row">
          <div className="field">
            <span>{r.id}</span>
            <div className="muted small">{r.statement.slice(0, 80) || 'no statement'}</div>
          </div>
          <SelectField label="Disposition" value={r.disposition} allowEmpty="undisposed" options={(['supported', 'contradicted', 'directionally-supported', 'inconclusive', 'untested', 'outside-scope'] as const).map((v) => ({ v, label: v }))} onChange={(v) => patchItem('registers', r.id, { disposition: v })} />
        </div>
      ))}

      <SubTitle>Closeout gate</SubTitle>
      {blockers.length === 0 ? (
        <Pill kind="good" text={campaign.phase === 'closed' ? 'closed' : 'ready to close'} />
      ) : (
        <Pill kind="warn" text={`${blockers.length} blocker(s)`} />
      )}
      <GateList items={blockers} kind="bad" />
      <div className="inspector-actions">
        <button className="primary" disabled={blockers.length > 0 || campaign.phase === 'closed'} onClick={() => patchCampaign({ phase: 'closed' })}>
          Close campaign
        </button>
      </div>
    </div>
  )
}

const TABS: Array<{ v: Tab; label: string }> = [
  { v: 'findings', label: 'Findings' },
  { v: 'actions', label: 'Actions' },
  { v: 'debriefs', label: 'Debriefs' },
  { v: 'package', label: 'Package' },
  { v: 'closeout', label: 'Closeout' },
]

export function DeliverPanel({ campaign }: { campaign: TeCampaign }) {
  const [tab, setTab] = useState<Tab>('findings')
  return (
    <div className="te-panel">
      <Seg value={tab} options={TABS} onChange={setTab} />
      {tab === 'findings' && <FindingsTab campaign={campaign} />}
      {tab === 'actions' && <ActionsTab campaign={campaign} />}
      {tab === 'debriefs' && <DebriefsTab campaign={campaign} />}
      {tab === 'package' && <PackageTab campaign={campaign} />}
      {tab === 'closeout' && <CloseoutTab campaign={campaign} />}
    </div>
  )
}

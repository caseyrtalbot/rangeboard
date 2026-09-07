/**
 * Analyze stage: three decision groups in one column.
 * A1 results and outcomes, A2 coverage and chain health (derived views),
 * A3 daily review writing one TeChange. No stage gate here; the gate is
 * adjudication upstream in Execute.
 */

import { useState } from 'react'
import type { DeviationEffect, NextAction, ResultLabel, TeCampaign } from '../model/types'
import { useTeStore } from '../state/teStore'
import { chainHealth } from '../validate'
import { computeAllMeasures } from '../calc/measures'
import { coverage } from '../calc/matrix'
import { templateByKey } from '../seed/checklistTemplates'
import { allPeople, decisionRightHolder } from './help'
import { AccountingLine } from './AccountingLine'
import {
  AdvancedDisclosure,
  CheckField,
  DecisionGroup,
  PersonPicker,
  PhaseIntro,
  Pill,
  Seg,
  SegChips,
  SubTitle,
  TextField,
  fmtDate,
} from './kit'
import {
  ChangeBuilder,
  ComparabilityPick,
  FactorGrid,
  NEXT_ACTION_OPTIONS,
  OutcomeRow,
  PriorityCalculator,
  TextPick,
  buildGapOptions,
  buildTriggerOptions,
  comparabilityString,
  factorStrings,
  type FactorMark,
} from './AnalyzeBlocks'

const LABEL_KIND: Record<ResultLabel, 'good' | 'warn' | 'bad' | 'neutral'> = {
  pass: 'good',
  miss: 'bad',
  borderline: 'warn',
  descriptive: 'neutral',
  unavailable: 'neutral',
}

const STATE_KIND = { empty: 'bad', thin: 'warn', met: 'good', redundant: 'neutral' } as const

function fmtNum(n: number): number {
  return Math.round(n * 1000) / 1000
}

function ResultsGroup({ campaign }: { campaign: TeCampaign }) {
  const { patchItem } = useTeStore.getState()
  const [expanded, setExpanded] = useState<string[]>([])
  const results = computeAllMeasures(campaign)
  return (
    <>
      {results.length === 0 && <p className="muted small">No measures defined. Add measures under Design.</p>}
      {results.map((r) => {
        const measure = campaign.measures.find((m) => m.id === r.measureId)
        const linked = campaign.hypotheses.filter((h) => measure?.hypothesisIds.includes(h.id))
        const open = expanded.includes(r.measureId)
        return (
          <div key={r.measureId} className="run-row">
            <SubTitle action={<Pill kind={LABEL_KIND[r.label]} text={r.label} />}>
              {r.measureId}: {r.name || 'unnamed measure'}
            </SubTitle>
            <div className="muted small">
              {r.estimate === null ? 'no estimate' : `estimate ${fmtNum(r.estimate)}${r.unit ? ` ${r.unit}` : ''}`}
              {r.interval && ` · interval [${fmtNum(r.interval.lo)}, ${fmtNum(r.interval.hi)}] (${r.interval.method})`}
            </div>
            <div className="muted small">planned {r.nPlanned} · attempted {r.nAttempted} · eligible {r.nEligible} · valid {r.nValid} · included {r.nIncluded}</div>
            {r.thresholdShown && measure ? (
              <div className="muted small">threshold {measure.threshold}{measure.unit ? ` ${measure.unit}` : ''} ({measure.higherIsBetter ? 'higher is better' : 'lower is better'})</div>
            ) : (
              <div className="muted small">characterization (no approved threshold)</div>
            )}
            {r.notes.map((n, i) => (
              <div key={i} className="gate-item">{n}</div>
            ))}
            <div className="inspector-actions">
              <button className="mini" onClick={() => setExpanded(open ? expanded.filter((x) => x !== r.measureId) : [...expanded, r.measureId])}>
                {open ? 'hide runs' : `show ${r.perRun.length} run(s)`}
              </button>
            </div>
            {open && r.perRun.length === 0 && <p className="muted small">No runs carry an observation for this measure.</p>}
            {open && r.perRun.map((p) => (
              <div key={p.runId} className="muted small">
                {p.runId} · {p.status} · {p.success !== null ? (p.success ? 'success' : 'failure') : p.value !== null ? p.value : 'no value'} · {p.included ? 'included' : 'not included'}
              </div>
            ))}
            {linked.map((h) => (
              <OutcomeRow
                key={h.id}
                hyp={h}
                result={r}
                onOutcome={(v) => patchItem('hypotheses', h.id, { outcome: v })}
                onNote={(v) => patchItem('hypotheses', h.id, { outcomeNote: v })}
              />
            ))}
          </div>
        )
      })}
    </>
  )
}

function CoverageGroup({ campaign }: { campaign: TeCampaign }) {
  const ch = chainHealth(campaign)
  const rows = coverage(campaign)
  const chainItems = [
    { n: ch.questionsWithoutMeasures, text: 'question(s) without measures' },
    { n: ch.measuresWithoutTruth, text: 'measure(s) without a truth source' },
    { n: ch.cardsWithoutRuns, text: 'issued card(s) without runs' },
    { n: ch.runsPendingAdjudication, text: 'run(s) pending adjudication' },
    { n: ch.findingsWithoutRuns, text: 'finding(s) without runs' },
    { n: ch.claimsUndisposed, text: 'claim(s) not disposed' },
  ].filter((x) => x.n > 0)
  return (
    <>
      <SubTitle>Chain health</SubTitle>
      <div className="field-row">
        {chainItems.length === 0 && <Pill kind="good" text="traceability chain healthy" />}
        {chainItems.map((x) => (
          <Pill key={x.text} kind="warn" text={`${x.n} ${x.text}`} />
        ))}
      </div>

      <SubTitle>Run accounting</SubTitle>
      <AccountingLine campaign={campaign} />

      <SubTitle>Matrix coverage</SubTitle>
      {rows.length === 0 && <p className="muted small">No matrix cells defined. Add cells under Design.</p>}
      {rows.map((r) => {
        const cell = campaign.matrix.find((m) => m.id === r.cellId)
        const q = campaign.questions.find((x) => x.id === cell?.questionId)
        const threat = campaign.threats.find((t) => t.id === cell?.threatId)
        const cond = campaign.conditions.find((c) => c.id === cell?.conditionId)
        return (
          <div key={r.cellId} className="field-row te-table-row">
            <div className="field">
              <span>{r.cellId}</span>
              <div className="muted small">{q?.wording.slice(0, 60) || 'no question'} · {threat?.name || 'no threat'} · {cond?.name || 'no condition'}</div>
            </div>
            <div className="field">
              <span>evidence</span>
              <div className="muted small">planned {r.planned} · attempted {r.attempted} · valid {r.valid} of min {r.minValid}</div>
            </div>
            <Pill kind={STATE_KIND[r.state]} text={r.state} />
          </div>
        )
      })}
      <p className="muted small">Do not combine cells across different configurations, threats, or conditions into one estimate. Open items here feed the picks in the next group.</p>
    </>
  )
}

function DailyReviewGroup({ campaign }: { campaign: TeCampaign }) {
  const { startChecklist, addChange, patchItem } = useTeStore.getState()
  const [nextAction, setNextAction] = useState<NextAction | null>(null)
  const [trigger, setTrigger] = useState('')
  const [triggerNote, setTriggerNote] = useState('')
  const [gap, setGap] = useState('')
  const [selectedChange, setSelectedChange] = useState('')
  const [marks, setMarks] = useState<Record<string, FactorMark>>({})
  const [effect, setEffect] = useState<DeviationEffect | null>(null)
  const [effectNote, setEffectNote] = useState('')
  const [optionsConsidered, setOptionsConsidered] = useState('')
  const [changeKind, setChangeKind] = useState<'exploratory' | 'confirmatory'>('confirmatory')
  const defaultApprovals = decisionRightHolder(campaign, 'card change')
  const [approvals, setApprovals] = useState(defaultApprovals)
  const results = computeAllMeasures(campaign)
  const cov = coverage(campaign)
  const gapOptions = buildGapOptions(campaign, cov)
  const triggerOptions = buildTriggerOptions(campaign, results, cov)
  const factorNames = campaign.factors.map((x) => x.name)
  const changes = [...campaign.changes].sort((a, b) => b.at.localeCompare(a.at))

  const record = () => {
    if (nextAction === null) return
    const vars = factorStrings(marks)
    const id = addChange()
    patchItem('changes', id, {
      trigger: triggerNote.trim() === '' ? trigger : `${trigger}${trigger ? ': ' : ''}${triggerNote.trim()}`,
      gapToResolve: gap,
      optionsConsidered,
      selectedChangeAndReason: selectedChange,
      variablesChanged: vars.changed,
      variablesHeld: vars.held,
      comparabilityEffect: comparabilityString(effect, effectNote),
      approvals,
      nextAction,
      kind: changeKind,
    })
    setNextAction(null)
    setTrigger('')
    setTriggerNote('')
    setGap('')
    setSelectedChange('')
    setMarks({})
    setEffect(null)
    setEffectNote('')
    setOptionsConsidered('')
    setChangeKind('confirmatory')
    setApprovals(defaultApprovals)
  }

  return (
    <>
      <div className="inspector-actions">
        <button onClick={() => startChecklist(templateByKey('daily-evidence-review')!)}>Start daily evidence review checklist</button>
      </div>
      <p className="muted small">The started checklist opens under Execute, Checklists.</p>

      <SegChips<NextAction>
        label="Next move"
        help="The daily review ends in exactly one next action."
        options={NEXT_ACTION_OPTIONS}
        value={nextAction}
        onChange={(v) => setNextAction(v as NextAction | null)}
      />

      <SubTitle>What happened, and what is missing?</SubTitle>
      <div className="field-row">
        <TextPick
          label="What result caused this change?"
          help="Triggering evidence: a run, a measure result, an anomaly, or a coverage cell."
          options={triggerOptions}
          value={trigger}
          onChange={setTrigger}
        />
        <TextField label="Trigger note" value={triggerNote} onChange={setTriggerNote} />
      </div>
      <TextPick
        label="What evidence is missing?"
        help="Gap to resolve. The list derives live from chain health and coverage."
        options={gapOptions}
        value={gap}
        onChange={setGap}
      />

      <ChangeBuilder value={selectedChange} onChange={setSelectedChange} />
      <FactorGrid factorNames={factorNames} marks={marks} onMark={(name, v) => {
        setMarks((m) => {
          const next = { ...m }
          if (v === null) delete next[name]
          else next[name] = v
          return next
        })
      }} />
      <div className="field-row">
        <ComparabilityPick effect={effect} onEffect={setEffect} note={effectNote} onNote={setEffectNote} />
        <PersonPicker
          label="Approver"
          value={approvals}
          onChange={setApprovals}
          people={allPeople(campaign)}
          prefillSource={defaultApprovals !== '' && approvals === defaultApprovals ? 'decision rights: card change' : undefined}
        />
      </div>

      <AdvancedDisclosure>
        <TextField
          label="Options considered"
          help="Other changes weighed before this one."
          value={optionsConsidered}
          onChange={setOptionsConsidered}
        />
        <div className="field">
          <span>
            Change kind
            <span className="help-dot" tabIndex={0} data-help="Confirmatory changes test a stated prediction. Exploratory changes look for structure.">
              ?
            </span>
          </span>
          <Seg
            value={changeKind}
            options={[
              { v: 'confirmatory', label: 'Confirmatory' },
              { v: 'exploratory', label: 'Exploratory' },
            ]}
            onChange={setChangeKind}
          />
        </div>
        <SubTitle>Next-run priority</SubTitle>
        <PriorityCalculator />
      </AdvancedDisclosure>

      <div className="inspector-actions">
        <button
          className="primary"
          disabled={nextAction === null}
          title={nextAction === null ? 'Pick one next move first.' : undefined}
          onClick={record}
        >
          Record adaptation
        </button>
      </div>

      <SubTitle>Changes (latest first)</SubTitle>
      {changes.length === 0 && <p className="muted small">None recorded. Record adaptation adds one.</p>}
      {changes.map((c) => (
        <div key={c.id} className="run-row">
          <div className="gate-item">
            {c.id} · {fmtDate(c.at)} · {c.nextAction ?? 'no next action'} · {c.trigger.slice(0, 48) || 'no trigger'} · {c.selectedChangeAndReason.slice(0, 48) || 'no change stated'}
          </div>
          <div className="field-row">
            <TextField
              label="Result after"
              help="Fill after the change takes effect: what the next runs showed."
              value={c.resultAfter}
              onChange={(v) => patchItem('changes', c.id, { resultAfter: v })}
            />
            <CheckField
              label="Briefed"
              help="The team heard this change before the next run."
              value={c.briefed}
              onChange={(v) => patchItem('changes', c.id, { briefed: v })}
            />
          </div>
        </div>
      ))}
    </>
  )
}

export function AnalyzePanel({ campaign }: { campaign: TeCampaign }) {
  const results = computeAllMeasures(campaign)
  const linkedHyps = campaign.hypotheses.filter((h) =>
    campaign.measures.some((m) => m.hypothesisIds.includes(h.id)),
  )
  const outcomesSet = linkedHyps.filter((h) => h.outcome !== null).length
  const a1State =
    results.length === 0 || linkedHyps.length === 0
      ? 'empty'
      : outcomesSet === linkedHyps.length
        ? 'done'
        : outcomesSet > 0
          ? 'partial'
          : 'empty'
  const ch = chainHealth(campaign)
  const cov = coverage(campaign)
  const chainClean = Object.values(ch).every((n) => n === 0)
  const covClean = cov.every((c) => c.state === 'met' || c.state === 'redundant')
  const a2State =
    campaign.matrix.length === 0 && campaign.runs.length === 0
      ? 'empty'
      : chainClean && covClean
        ? 'done'
        : 'partial'
  const a3State = campaign.changes.length > 0 ? 'done' : 'empty'

  return (
    <div className="te-panel">
      <PhaseIntro phase="analyze" />
      <DecisionGroup
        id="a1-results"
        question="What do the numbers say?"
        hint="Measure computation from adjudicated runs; hypothesis outcomes vs recorded predictions."
        tier="recommended"
        state={a1State}
      >
        <ResultsGroup campaign={campaign} />
      </DecisionGroup>
      <DecisionGroup
        id="a2-coverage"
        question="Where is evidence still thin?"
        hint="Matrix coverage and traceability chain health. Derived views; nothing here is stored."
        state={a2State}
      >
        <CoverageGroup campaign={campaign} />
      </DecisionGroup>
      <DecisionGroup
        id="a3-daily"
        question="What is the one next move?"
        hint="Daily evidence review. Records one deliberate change; old records stay preserved."
        tier="recommended"
        state={a3State}
      >
        <DailyReviewGroup campaign={campaign} />
      </DecisionGroup>
    </div>
  )
}

import { useState } from 'react'
import type { NextAction, ResultLabel, TeCampaign } from '../model/types'
import { useTeStore } from '../state/teStore'
import { chainHealth } from '../validate'
import { computeAllMeasures } from '../calc/measures'
import { runAccounting, validRunRate } from '../calc/accounting'
import { coverage } from '../calc/matrix'
import { adaptivePriority } from '../calc/priority'
import { templateByKey } from '../seed/checklistTemplates'
import { Pill, SelectField, Seg, SubTitle, TextField, fmtDate } from './kit'

type Tab = 'results' | 'coverage' | 'daily'

const LABEL_KIND: Record<ResultLabel, 'good' | 'warn' | 'bad' | 'neutral'> = {
  pass: 'good',
  miss: 'bad',
  borderline: 'warn',
  descriptive: 'neutral',
  unavailable: 'neutral',
}

const STATE_KIND = { empty: 'bad', thin: 'warn', met: 'good', redundant: 'neutral' } as const

const NEXT_ACTIONS: Array<{ v: NextAction; label: string }> = [
  { v: 'execute-next-card', label: 'Execute the next planned card' },
  { v: 'repeat-for-validity', label: 'Repeat a run for validity' },
  { v: 'isolate-one-variable', label: 'Isolate one variable' },
  { v: 'repair-evidence-chain', label: 'Repair the evidence chain' },
  { v: 'revise-threat-or-condition', label: 'Revise a threat or condition' },
  { v: 'introduce-diagnostic-card', label: 'Introduce a diagnostic card' },
  { v: 'stop-low-value-line', label: 'Stop a low-value line' },
  { v: 'end-for-sufficiency', label: 'End the campaign for sufficiency' },
  { v: 'end-for-futility', label: 'End the campaign for futility' },
]

function fmtNum(n: number): number {
  return Math.round(n * 1000) / 1000
}

function AccountingLine({ campaign }: { campaign: TeCampaign }) {
  const acc = runAccounting(campaign)
  const rate = validRunRate(campaign)
  return (
    <div className="spec-summary">
      planned {acc.planned} · attempted {acc.attempted} · valid {acc.valid} · conditional {acc.conditional} · invalid {acc.invalid} · excluded {acc.excluded} · pending {acc.pending} · valid-run rate {rate === null ? 'n/a' : `${Math.round(rate * 100)}%`}
    </div>
  )
}

function ResultsTab({ campaign }: { campaign: TeCampaign }) {
  const { patchItem } = useTeStore.getState()
  const [expanded, setExpanded] = useState<string[]>([])
  const results = computeAllMeasures(campaign)
  const ch = chainHealth(campaign)
  const chainItems = [
    { n: ch.questionsWithoutMeasures, text: 'question(s) without measures' },
    { n: ch.measuresWithoutTruth, text: 'measure(s) without truth' },
    { n: ch.cardsWithoutRuns, text: 'issued card(s) without runs' },
    { n: ch.runsPendingAdjudication, text: 'run(s) pending adjudication' },
    { n: ch.findingsWithoutRuns, text: 'finding(s) without runs' },
    { n: ch.claimsUndisposed, text: 'claim(s) undisposed' },
  ].filter((x) => x.n > 0)

  return (
    <div className="inspector-body">
      <SubTitle>Chain health</SubTitle>
      <div className="field-row">
        {chainItems.length === 0 && <Pill kind="good" text="traceability chain healthy" />}
        {chainItems.map((x) => (
          <Pill key={x.text} kind="warn" text={`${x.n} ${x.text}`} />
        ))}
      </div>

      <SubTitle>Measure results</SubTitle>
      {results.length === 0 && <p className="muted small">No measures defined.</p>}
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
              <div key={h.id} className="field-row te-table-row">
                <div className="field">
                  <span>{h.id} predicted</span>
                  <div className="muted small">{h.predictedValue || 'no prediction'} ({h.predictionType})</div>
                </div>
                <SelectField label="Outcome" value={h.outcome} allowEmpty="not set" options={(['supported', 'directionally-supported', 'contradicted', 'inconclusive', 'not-tested'] as const).map((v) => ({ v, label: v }))} onChange={(v) => patchItem('hypotheses', h.id, { outcome: v })} />
                <TextField label="Outcome note" value={h.outcomeNote} onChange={(v) => patchItem('hypotheses', h.id, { outcomeNote: v })} />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function CoverageTab({ campaign }: { campaign: TeCampaign }) {
  const rows = coverage(campaign)
  return (
    <div className="inspector-body">
      <SubTitle>Run accounting</SubTitle>
      <AccountingLine campaign={campaign} />

      <SubTitle>Matrix coverage</SubTitle>
      {rows.length === 0 && <p className="muted small">No matrix cells defined.</p>}
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
      <p className="muted small">Do not combine cells across different configurations, threats, or conditions into one estimate.</p>
    </div>
  )
}

function ScoreSeg({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <Seg value={String(value) as '1' | '2' | '3'} options={(['1', '2', '3'] as const).map((v) => ({ v, label: v }))} onChange={(v) => onChange(Number(v))} />
    </div>
  )
}

function DailyReviewTab({ campaign }: { campaign: TeCampaign }) {
  const { startChecklist, addChange, patchItem } = useTeStore.getState()
  const [nextAction, setNextAction] = useState<NextAction | null>(null)
  const [trigger, setTrigger] = useState('')
  const [gap, setGap] = useState('')
  const [selectedChange, setSelectedChange] = useState('')
  const [varsChanged, setVarsChanged] = useState('')
  const [varsHeld, setVarsHeld] = useState('')
  const [comparability, setComparability] = useState('')
  const [approvals, setApprovals] = useState('')
  const [importance, setImportance] = useState(2)
  const [uncertainty, setUncertainty] = useState(2)
  const [likelihood, setLikelihood] = useState(2)
  const [burden, setBurden] = useState(2)
  const changes = [...campaign.changes].sort((a, b) => b.at.localeCompare(a.at))
  const score = adaptivePriority(importance, uncertainty, likelihood, burden)

  return (
    <div className="inspector-body">
      <div className="inspector-actions">
        <button onClick={() => startChecklist(templateByKey('daily-evidence-review')!)}>Start daily evidence review checklist</button>
      </div>
      <p className="muted small">The started checklist opens under Execute, Checklists.</p>

      <SubTitle>Record adaptation</SubTitle>
      <SelectField label="Next action (exactly one)" value={nextAction} allowEmpty="select the next action" options={NEXT_ACTIONS} onChange={setNextAction} />
      <div className="field-row">
        <TextField label="Triggering evidence" value={trigger} onChange={setTrigger} />
        <TextField label="Gap to resolve" value={gap} onChange={setGap} />
      </div>
      <TextField label="Selected change and reason" rows={2} value={selectedChange} onChange={setSelectedChange} />
      <div className="field-row">
        <TextField label="Variables changed" value={varsChanged} onChange={setVarsChanged} />
        <TextField label="Variables held" value={varsHeld} onChange={setVarsHeld} />
      </div>
      <div className="field-row">
        <TextField label="Comparability effect" value={comparability} onChange={setComparability} />
        <TextField label="Approvals" value={approvals} onChange={setApprovals} />
      </div>
      <div className="inspector-actions">
        <button
          className="primary"
          onClick={() => {
            const id = addChange()
            patchItem('changes', id, {
              trigger,
              gapToResolve: gap,
              selectedChangeAndReason: selectedChange,
              variablesChanged: varsChanged,
              variablesHeld: varsHeld,
              comparabilityEffect: comparability,
              approvals,
              nextAction,
            })
            setTrigger('')
            setGap('')
            setSelectedChange('')
            setVarsChanged('')
            setVarsHeld('')
            setComparability('')
            setApprovals('')
          }}
        >
          Record adaptation
        </button>
      </div>

      <SubTitle>Changes (latest first)</SubTitle>
      {changes.length === 0 && <p className="muted small">None recorded.</p>}
      {changes.map((c) => (
        <div key={c.id} className="gate-item">
          {c.id} · {fmtDate(c.at)} · {c.nextAction ?? 'no next action'} · {c.trigger.slice(0, 48) || 'no trigger'} · {c.selectedChangeAndReason.slice(0, 48) || 'no change stated'}
        </div>
      ))}

      <SubTitle>Adaptive priority helper</SubTitle>
      <p className="muted small">Score the next candidate runs; higher runs first.</p>
      <div className="field-row">
        <ScoreSeg label="Importance" value={importance} onChange={setImportance} />
        <ScoreSeg label="Uncertainty reduction" value={uncertainty} onChange={setUncertainty} />
        <ScoreSeg label="Likelihood" value={likelihood} onChange={setLikelihood} />
        <ScoreSeg label="Burden" value={burden} onChange={setBurden} />
      </div>
      <div className="spec-summary">priority score: {Math.round(score * 100) / 100}</div>
    </div>
  )
}

const TABS: Array<{ v: Tab; label: string }> = [
  { v: 'results', label: 'Results' },
  { v: 'coverage', label: 'Coverage' },
  { v: 'daily', label: 'Daily review' },
]

export function AnalyzePanel({ campaign }: { campaign: TeCampaign }) {
  const [tab, setTab] = useState<Tab>('results')
  return (
    <div className="te-panel">
      <Seg value={tab} options={TABS} onChange={setTab} />
      {tab === 'results' && <ResultsTab campaign={campaign} />}
      {tab === 'coverage' && <CoverageTab campaign={campaign} />}
      {tab === 'daily' && <DailyReviewTab campaign={campaign} />}
    </div>
  )
}

import { useState } from 'react'
import type {
  ChecklistInstanceItem,
  ChecklistPhase,
  GoNoGo,
  GoNoGoScope,
  MeasureObservation,
  TeCampaign,
  TeChecklist,
  TeRun,
  TeRunValidity,
} from '../model/types'
import { useTeStore } from '../state/teStore'
import { canStartRun } from '../validate'
import { runAccounting, validRunRate } from '../calc/accounting'
import { coverage } from '../calc/matrix'
import { templateByKey, templatesForPhase } from '../seed/checklistTemplates'
import { nowIso } from '../model/empty'
import {
  CheckField,
  MultiPicker,
  NumberField,
  Pill,
  SelectField,
  Seg,
  SubTitle,
  TextField,
  fmtDate,
} from './kit'

type Tab = 'day' | 'run' | 'checklists' | 'adjudication'

const GENERIC_MARKS = [
  'start recording',
  'start run',
  'mark event',
  'mark phase transition',
  'record operator action',
  'record system response',
  'add observation',
  'mark deviation',
  'mark anomaly',
  'pause',
  'stop',
  'complete run',
]

const GO_NO_GO_OPTIONS = (['go', 'conditional-go', 'hold', 'no-go'] as GoNoGo[]).map((v) => ({ v, label: v }))

function decisionKind(d: GoNoGo): 'good' | 'warn' | 'bad' {
  return d === 'go' ? 'good' : d === 'no-go' ? 'bad' : 'warn'
}

const VALIDITY_KIND: Record<TeRunValidity, 'good' | 'warn' | 'bad' | 'neutral'> = {
  pending: 'warn',
  valid: 'good',
  invalid: 'bad',
  'conditionally-valid': 'neutral',
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

function DayTab({ campaign, onOpenChecklists }: { campaign: TeCampaign; onOpenChecklists: () => void }) {
  const { recordGoNoGo, startChecklist } = useTeStore.getState()
  const [scope, setScope] = useState<GoNoGoScope>('daily')
  const [decision, setDecision] = useState<GoNoGo>('go')
  const [approvers, setApprovers] = useState('')
  const [note, setNote] = useState('')
  const cov = coverage(campaign)
  const counts = { empty: 0, thin: 0, met: 0, redundant: 0 }
  for (const c of cov) counts[c.state]++
  const nextCells = cov
    .filter((c) => c.valid < c.minValid)
    .map((c) => ({ c, cell: campaign.matrix.find((m) => m.id === c.cellId) }))
    .filter((x) => x.cell !== undefined)
    .sort((a, b) => a.cell!.priority - b.cell!.priority)
    .slice(0, 3)
  const gonogos = [...campaign.gonogos].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="inspector-body">
      <SubTitle>Day dashboard · {nowIso().slice(0, 10)}</SubTitle>
      <AccountingLine campaign={campaign} />

      <SubTitle>Coverage</SubTitle>
      <div className="field-row">
        <Pill kind="bad" text={`empty ${counts.empty}`} />
        <Pill kind="warn" text={`thin ${counts.thin}`} />
        <Pill kind="good" text={`met ${counts.met}`} />
        <Pill kind="neutral" text={`redundant ${counts.redundant}`} />
      </div>

      <SubTitle>Next priority cells</SubTitle>
      {nextCells.length === 0 && <p className="muted small">Every matrix cell meets its minimum valid evidence.</p>}
      {nextCells.map(({ c, cell }) => {
        const threat = campaign.threats.find((t) => t.id === cell!.threatId)
        const cond = campaign.conditions.find((x) => x.id === cell!.conditionId)
        return (
          <div key={c.cellId} className="gate-item">
            {c.cellId} · priority {cell!.priority} · {threat?.name || 'no threat'} · {cond?.name || 'no condition'} · valid {c.valid} of {c.minValid}
          </div>
        )
      })}

      <SubTitle>Go/no-go decisions (latest first)</SubTitle>
      {gonogos.length === 0 && <p className="muted small">None recorded.</p>}
      {gonogos.map((g) => (
        <div key={g.id} className="field-row te-table-row">
          <div className="muted small">{fmtDate(g.at)} · {g.scope} · approvers: {g.approvers || 'none'}{g.note ? ` · ${g.note}` : ''}</div>
          <Pill kind={decisionKind(g.decision)} text={g.decision} />
        </div>
      ))}

      <SubTitle>Record go/no-go</SubTitle>
      <div className="field">
        <span>Scope</span>
        <Seg value={scope} options={(['daily', 'readiness-review', 'pre-run-release'] as GoNoGoScope[]).map((v) => ({ v, label: v }))} onChange={setScope} />
      </div>
      <div className="field">
        <span>Decision</span>
        <Seg value={decision} options={GO_NO_GO_OPTIONS} onChange={setDecision} />
      </div>
      <div className="field-row">
        <TextField label="Approvers" value={approvers} onChange={setApprovers} />
        <TextField label="Note" value={note} onChange={setNote} />
      </div>
      <div className="inspector-actions">
        <button className="primary" onClick={() => { recordGoNoGo(scope, decision, approvers, note); setApprovers(''); setNote('') }}>Record</button>
        <button onClick={() => { startChecklist(templateByKey('day-start')!); onOpenChecklists() }}>Start day-start checklist</button>
      </div>
    </div>
  )
}

function ObservationRow({ campaign, run, measureId }: { campaign: TeCampaign; run: TeRun; measureId: string }) {
  const { patchItem } = useTeStore.getState()
  const measure = campaign.measures.find((m) => m.id === measureId)
  const obs: MeasureObservation = run.observations.find((o) => o.measureId === measureId) ?? {
    measureId,
    status: 'no-test',
    success: null,
    value: null,
    note: '',
  }
  const setObs = (patch: Partial<MeasureObservation>) => {
    const has = run.observations.some((o) => o.measureId === measureId)
    const next = has
      ? run.observations.map((o) => (o.measureId === measureId ? { ...o, ...patch } : o))
      : [...run.observations, { ...obs, ...patch }]
    patchItem('runs', run.id, { observations: next })
  }
  return (
    <div className="field-row te-table-row">
      <div className="field">
        <span>Measure</span>
        <div className="muted small">{measureId}: {measure?.name || 'unnamed'}</div>
      </div>
      <SelectField label="Status" value={obs.status} options={(['observed', 'missing', 'invalid', 'censored', 'unknown-outcome', 'no-test'] as const).map((v) => ({ v, label: v }))} onChange={(v) => v && setObs({ status: v })} />
      {measure?.family === 'binomial' ? (
        <div className="field">
          <span>Success</span>
          <Seg value={(obs.success === true ? 'yes' : obs.success === false ? 'no' : '') as 'yes' | 'no'} options={[{ v: 'yes', label: 'yes' }, { v: 'no', label: 'no' }]} onChange={(v) => setObs({ success: v === 'yes' })} />
        </div>
      ) : (
        <NumberField label={`Value${measure?.unit ? ` (${measure.unit})` : ''}`} value={obs.value} onChange={(v) => setObs({ value: v })} />
      )}
      <TextField label="Note" value={obs.note} onChange={(v) => setObs({ note: v })} />
    </div>
  )
}

function RunDebriefForm({ run, onClose }: { run: TeRun; onClose: () => void }) {
  const { patchItem } = useTeStore.getState()
  const set = (patch: Partial<TeRun['debrief']>) =>
    patchItem('runs', run.id, { debrief: { ...run.debrief, ...patch } })
  return (
    <div className="run-row">
      <SubTitle action={<button className="mini" onClick={onClose}>close</button>}>
        Immediate debrief · {run.id}
      </SubTitle>
      <TextField label="What was planned and what occurred in time order" rows={2} value={run.debrief.plannedVsOccurred} onChange={(v) => set({ plannedVsOccurred: v })} />
      <TextField label="What differed" rows={2} value={run.debrief.differences} onChange={(v) => set({ differences: v })} />
      <TextField label="Were all sources recorded" value={run.debrief.sourcesRecorded} onChange={(v) => set({ sourcesRecorded: v })} />
      <TextField label="Warnings or failures" value={run.debrief.warningsOrFailures} onChange={(v) => set({ warningsOrFailures: v })} />
      <TextField label="Which result was unexpected" value={run.debrief.unexpectedResult} onChange={(v) => set({ unexpectedResult: v })} />
      <TextField label="Repeat needed" value={run.debrief.repeatNeeded} onChange={(v) => set({ repeatNeeded: v })} />
      <div className="field">
        <span>Preliminary use</span>
        <Seg value={(run.preliminaryUse ?? '') as NonNullable<TeRun['preliminaryUse']>} options={(['usable', 'limited', 'repeat', 'valid-failure'] as const).map((v) => ({ v, label: v }))} onChange={(v) => patchItem('runs', run.id, { preliminaryUse: v })} />
      </div>
    </div>
  )
}

function RunConsoleTab({ campaign }: { campaign: TeCampaign }) {
  const { createRunFromCard, markRunEvent, addDeviation, addAnomaly, patchItem } = useTeStore.getState()
  const [cardId, setCardId] = useState('')
  const [debriefRunId, setDebriefRunId] = useState<string | null>(null)
  const issued = campaign.cards.filter((c) => c.status === 'issued')
  const selectedCard = issued.find((c) => c.id === cardId)
  const active = [...campaign.runs].reverse().find((r) => r.endAt === null) ?? null
  const activeCard = active ? campaign.cards.find((c) => c.id === active.cardId) : undefined
  const debriefRun = debriefRunId ? campaign.runs.find((r) => r.id === debriefRunId) : undefined
  const completed = campaign.runs
    .filter((r) => r.endAt !== null)
    .sort((a, b) => (b.endAt ?? '').localeCompare(a.endAt ?? ''))
  const marks = active ? [...new Set([...(activeCard?.eventMarks.filter((m) => m.trim() !== '') ?? []), ...GENERIC_MARKS])] : []
  const events = active ? [...active.events].sort((a, b) => a.at.localeCompare(b.at)) : []
  const runDeviations = active ? campaign.deviations.filter((d) => d.runId === active.id) : []
  const runAnomalies = active ? campaign.anomalies.filter((a) => a.runId === active?.id) : []

  const tap = (mark: string) => {
    if (!active) return
    markRunEvent(active.id, mark)
    if (mark === 'mark deviation') addDeviation(active.id)
    if (mark === 'mark anomaly') addAnomaly(active.id)
  }

  return (
    <div className="inspector-body">
      <SubTitle>Start a run</SubTitle>
      <div className="field-row">
        <SelectField label="Issued card" value={cardId || null} allowEmpty="select a card" options={issued.map((c) => ({ v: c.id, label: `${c.cardCode} ${c.version}: ${c.title || 'untitled'}` }))} onChange={(v) => setCardId(v ?? '')} />
        <div className="field">
          <span>&nbsp;</span>
          <button className="primary" disabled={!canStartRun(selectedCard)} onClick={() => { const id = createRunFromCard(cardId); if (!id) window.alert('No run started. The card must be issued.') }}>Start run</button>
        </div>
      </div>
      {issued.length === 0 && <p className="muted small">No issued cards. Issue a card before a live run.</p>}

      {active && activeCard && (
        <>
          <SubTitle action={<Pill kind="good" text="active" />}>{active.id} · {activeCard.cardCode} {active.cardVersion}</SubTitle>
          <div className="spec-summary">
            Purpose: {activeCard.purpose || 'not stated'} · Prediction: {activeCard.prediction || 'not stated'} · Changed factor: {activeCard.changedFactor || 'not stated'}
          </div>

          <SubTitle>Procedure</SubTitle>
          <ol className="muted small">
            {activeCard.procedure.map((s) => (
              <li key={s.id}>{s.action} ({s.role}) · done when: {s.observableCompletion || 'not stated'}</li>
            ))}
          </ol>

          <SubTitle>Event marks</SubTitle>
          <div className="cards-list">
            {marks.map((m) => (
              <button key={m} className="card-chip" onClick={() => tap(m)}>{m}</button>
            ))}
          </div>

          <SubTitle>Event log</SubTitle>
          {events.length === 0 && <p className="muted small">No events yet.</p>}
          {events.map((e) => (
            <div key={e.id} className="muted small">{fmtDate(e.at)} · {e.mark}{e.note ? ` · ${e.note}` : ''}</div>
          ))}

          <SubTitle>Observations per measure</SubTitle>
          {activeCard.measureIds.length === 0 && <p className="muted small">The card links no measures.</p>}
          {activeCard.measureIds.map((mid) => (
            <ObservationRow key={mid} campaign={campaign} run={active} measureId={mid} />
          ))}

          <TextField label="Operator observations" rows={3} value={active.operatorObservations} onChange={(v) => patchItem('runs', active.id, { operatorObservations: v })} />

          <SubTitle>Deviations this run</SubTitle>
          {runDeviations.length === 0 && <p className="muted small">None. Tap "mark deviation" to record one.</p>}
          {runDeviations.map((d) => (
            <div key={d.id} className="run-row">
              <div className="field-row">
                <TextField label="Planned state" value={d.plannedState} onChange={(v) => patchItem('deviations', d.id, { plannedState: v })} />
                <TextField label="Actual state" value={d.actualState} onChange={(v) => patchItem('deviations', d.id, { actualState: v })} />
              </div>
              <div className="field-row">
                <TextField label="Direct observation" value={d.directObservation} onChange={(v) => patchItem('deviations', d.id, { directObservation: v })} />
                <TextField label="Affected variable, control, measure, or rule" value={d.affected} onChange={(v) => patchItem('deviations', d.id, { affected: v })} />
              </div>
              <div className="field-row">
                <TextField label="Immediate action" value={d.immediateAction} onChange={(v) => patchItem('deviations', d.id, { immediateAction: v })} />
                <SelectField label="Effect" value={d.effect} options={(['none', 'bounded', 'material', 'unknown'] as const).map((v) => ({ v, label: v }))} onChange={(v) => v && patchItem('deviations', d.id, { effect: v })} />
                <SelectField label="Disposition" value={d.disposition} options={(['repeat', 'analyze-with-limits', 'exclude'] as const).map((v) => ({ v, label: v }))} onChange={(v) => v && patchItem('deviations', d.id, { disposition: v })} />
              </div>
            </div>
          ))}

          <SubTitle>Anomalies this run</SubTitle>
          {runAnomalies.length === 0 && <p className="muted small">None. Tap "mark anomaly" to record one.</p>}
          {runAnomalies.map((a) => (
            <div key={a.id} className="run-row">
              <TextField label="Observation (record before discussing causes)" rows={2} value={a.observation} onChange={(v) => patchItem('anomalies', a.id, { observation: v })} />
              <div className="field-row">
                <TextField label="Source" value={a.source} onChange={(v) => patchItem('anomalies', a.id, { source: v })} />
                <SelectField label="Classification" value={a.classification} options={(['system-behavior', 'test-infrastructure', 'threat-deviation', 'operator-action', 'data-artifact', 'unknown'] as const).map((v) => ({ v, label: v }))} onChange={(v) => v && patchItem('anomalies', a.id, { classification: v })} />
                <TextField label="Mission effect" value={a.missionEffect} onChange={(v) => patchItem('anomalies', a.id, { missionEffect: v })} />
              </div>
              <TextField label="Preservation action" value={a.preservationAction} onChange={(v) => patchItem('anomalies', a.id, { preservationAction: v })} />
            </div>
          ))}

          <div className="inspector-actions">
            <button className="primary" onClick={() => { patchItem('runs', active.id, { endAt: nowIso() }); setDebriefRunId(active.id) }}>Complete run</button>
          </div>
        </>
      )}
      {!active && <p className="muted small">No active run.</p>}

      {debriefRun && <RunDebriefForm run={debriefRun} onClose={() => setDebriefRunId(null)} />}

      <SubTitle>Recently completed runs</SubTitle>
      {completed.length === 0 && <p className="muted small">None yet.</p>}
      {completed.slice(0, 8).map((r) => (
        <div key={r.id} className="field-row te-table-row">
          <div className="muted small">{r.id} · {r.plannedPurpose.slice(0, 48) || 'no purpose'} · ended {fmtDate(r.endAt)}</div>
          {r.preliminaryUse && <Pill kind="neutral" text={r.preliminaryUse} />}
          <button className="mini" onClick={() => setDebriefRunId(r.id)}>debrief</button>
        </div>
      ))}
    </div>
  )
}

const CHECKLIST_PHASES: ChecklistPhase[] = [
  'before-deployment',
  'readiness',
  'day-start',
  'pre-run',
  'in-run',
  'post-run',
  'day-end',
  'analysis',
  'closeout',
]

function ChecklistsTab({ campaign }: { campaign: TeCampaign }) {
  const { startChecklist, patchItem } = useTeStore.getState()
  const open = campaign.checklists.filter((c) => c.completedAt === null)
  const done = campaign.checklists
    .filter((c) => c.completedAt !== null)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const setItem = (inst: TeChecklist, index: number, patch: Partial<ChecklistInstanceItem>) =>
    patchItem('checklists', inst.id, { items: inst.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) })

  return (
    <div className="inspector-body">
      <SubTitle>Template library</SubTitle>
      {CHECKLIST_PHASES.map((phase) => {
        const templates = templatesForPhase(phase)
        if (templates.length === 0) return null
        return (
          <div key={phase} className="subsection">
            <div className="panel-subtitle">{phase}</div>
            {templates.map((t) => (
              <div key={t.key} className="field-row te-table-row">
                <div className="muted small">{t.name} · runner: {t.runner}{t.gate ? ` · gate: ${t.gate}` : ''}</div>
                <button className="mini" onClick={() => startChecklist(t)}>Start</button>
              </div>
            ))}
          </div>
        )
      })}

      <SubTitle>Open checklists</SubTitle>
      {open.length === 0 && <p className="muted small">None open.</p>}
      {open.map((inst) => {
        const template = templateByKey(inst.templateKey)
        const holdCount = inst.items.filter((it, i) => template?.items[i]?.holdOnUnknown && it.state === 'unchecked').length
        return (
          <div key={inst.id} className="run-row">
            <SubTitle>{inst.name} · {inst.phase} · started {fmtDate(inst.startedAt)}</SubTitle>
            {holdCount > 0 && <Pill kind="warn" text={`${holdCount} unknown answer(s) hold the run`} />}
            {inst.items.map((it, i) => {
              const hold = template?.items[i]?.holdOnUnknown === true && it.state === 'unchecked'
              return (
                <div key={i}>
                  <label className="check-row">
                    <input type="checkbox" checked={it.state === 'checked'} disabled={it.state === 'na'} onChange={(e) => setItem(inst, i, e.target.checked ? { state: 'checked', at: nowIso() } : { state: 'unchecked', at: null })} />
                    <span>{it.text}</span>
                    {it.state === 'na' && <Pill kind="neutral" text="n/a" />}
                    {hold && <Pill kind="warn" text="hold" />}
                  </label>
                  <div className="field-row">
                    {it.type === 'value' && <TextField label="Value" value={it.value} onChange={(v) => setItem(inst, i, { value: v })} />}
                    <TextField label="Completer" value={it.completer} onChange={(v) => setItem(inst, i, { completer: v })} />
                    <CheckField label="n/a" value={it.state === 'na'} onChange={(v) => setItem(inst, i, v ? { state: 'na' } : { state: 'unchecked' })} />
                    {it.state === 'na' && <TextField label="n/a reason" value={it.naReason} onChange={(v) => setItem(inst, i, { naReason: v })} />}
                  </div>
                </div>
              )
            })}
            {template?.gate && (
              <>
                <div className="field">
                  <span>Gate outcome ({template.gate})</span>
                  <Seg value={(inst.outcome ?? '') as GoNoGo} options={GO_NO_GO_OPTIONS} onChange={(v) => patchItem('checklists', inst.id, { outcome: v })} />
                </div>
                <TextField label="Conditional limits" value={inst.conditionalLimits} onChange={(v) => patchItem('checklists', inst.id, { conditionalLimits: v })} />
              </>
            )}
            <div className="inspector-actions">
              <button className="primary" onClick={() => patchItem('checklists', inst.id, { completedAt: nowIso() })}>Complete</button>
            </div>
          </div>
        )
      })}

      <SubTitle>Completed checklists</SubTitle>
      {done.length === 0 && <p className="muted small">None completed.</p>}
      {done.map((c) => (
        <div key={c.id} className="gate-item">
          {c.name} · {c.dayDate} · {c.outcome ?? 'no gate outcome'}
        </div>
      ))}
    </div>
  )
}

function RunAdjudication({ campaign, run }: { campaign: TeCampaign; run: TeRun }) {
  const { adjudicateRun, patchItem } = useTeStore.getState()
  const [validity, setValidity] = useState<TeRunValidity>(run.validity)
  const [by, setBy] = useState('')
  const [reason, setReason] = useState('')
  const card = campaign.cards.find((c) => c.id === run.cardId)
  return (
    <div className="run-row">
      <SubTitle action={<Pill kind={VALIDITY_KIND[run.validity]} text={run.validity} />}>{run.id}</SubTitle>
      <div className="muted small">
        card: {card?.title || run.cardId} {run.cardVersion} · start {fmtDate(run.startAt)} · end {fmtDate(run.endAt)} · {run.events.length} event(s) · {run.deviationIds.length} deviation(s) · {run.anomalyIds.length} anomaly record(s)
      </div>
      <TextField label="Initial data quality" value={run.initialDataQuality} onChange={(v) => patchItem('runs', run.id, { initialDataQuality: v })} />
      <div className="field">
        <span>Validity</span>
        <Seg value={validity} options={(['pending', 'valid', 'conditionally-valid', 'invalid'] as TeRunValidity[]).map((v) => ({ v, label: v }))} onChange={setValidity} />
      </div>
      {validity === 'conditionally-valid' && (
        <>
          <MultiPicker label="Allowed measures" options={(card?.measureIds ?? []).map((id) => { const m = campaign.measures.find((x) => x.id === id); return { id, label: m ? `${m.id}: ${m.name || 'unnamed'}` : id } })} value={run.allowedMeasureIds} onChange={(v) => patchItem('runs', run.id, { allowedMeasureIds: v })} />
          <TextField label="Prohibited uses" value={run.prohibitedUses} onChange={(v) => patchItem('runs', run.id, { prohibitedUses: v })} />
          <TextField label="Limits" value={run.limits} onChange={(v) => patchItem('runs', run.id, { limits: v })} />
        </>
      )}
      <div className="field-row">
        <TextField label="Adjudicator" value={by} onChange={setBy} />
        <TextField label="Reason" value={reason} onChange={setReason} />
      </div>
      <div className="inspector-actions">
        <button className="primary" onClick={() => adjudicateRun(run.id, validity, by, reason)}>Record adjudication</button>
      </div>
      <CheckField label="Excluded (accounting decision, not an adjudication)" value={run.excluded} onChange={(v) => patchItem('runs', run.id, { excluded: v })} />
      {run.adjudications.length > 0 && (
        <>
          <SubTitle>Adjudication history</SubTitle>
          {run.adjudications.map((a) => (
            <div key={a.version} className="muted small">v{a.version} · {fmtDate(a.at)} · {a.by || 'unnamed'} · {a.validity} · {a.reason || 'no reason'}</div>
          ))}
        </>
      )}
    </div>
  )
}

function AdjudicationTab({ campaign }: { campaign: TeCampaign }) {
  const { selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.runs ?? null)
  const run = campaign.runs.find((r) => r.id === selected)
  return (
    <div className="inspector-body">
      <p className="muted small">No status = not available for analysis. Dependent next runs wait for validation.</p>
      {campaign.runs.length === 0 && <p className="muted small">No runs yet.</p>}
      <div className="cards-list">
        {campaign.runs.map((r) => (
          <button key={r.id} className={`card-chip ${selected === r.id ? 'active' : ''} ${r.excluded ? 'dim' : ''}`} onClick={() => selectRecord('runs', r.id)}>
            {r.id} <Pill kind={VALIDITY_KIND[r.validity]} text={r.validity} />
          </button>
        ))}
      </div>
      {run && <RunAdjudication key={run.id} campaign={campaign} run={run} />}
    </div>
  )
}

const TABS: Array<{ v: Tab; label: string }> = [
  { v: 'day', label: 'Day' },
  { v: 'run', label: 'Run console' },
  { v: 'checklists', label: 'Checklists' },
  { v: 'adjudication', label: 'Adjudication' },
]

export function ExecutePanel({ campaign }: { campaign: TeCampaign }) {
  const [tab, setTab] = useState<Tab>('day')
  return (
    <div className="te-panel">
      <Seg value={tab} options={TABS} onChange={setTab} />
      {tab === 'day' && <DayTab campaign={campaign} onOpenChecklists={() => setTab('checklists')} />}
      {tab === 'run' && <RunConsoleTab campaign={campaign} />}
      {tab === 'checklists' && <ChecklistsTab campaign={campaign} />}
      {tab === 'adjudication' && <AdjudicationTab campaign={campaign} />}
    </div>
  )
}

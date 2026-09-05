/**
 * Execute stage (SPEC groups E1 to E7). Tabs stay: Day, Run console,
 * Checklists, Adjudication. Inside each tab, ordered decision groups.
 * Gates: no issued card no run; holdOnUnknown items hold the run;
 * no validity status no analysis.
 */

import { useState } from 'react'
import type {
  ChecklistInstanceItem,
  ChecklistPhase,
  GoNoGo,
  TeCampaign,
  TeChecklist,
} from '../model/types'
import { useTeStore } from '../state/teStore'
import { runAccounting, validRunRate } from '../calc/accounting'
import { coverage } from '../calc/matrix'
import { templateByKey, templatesForPhase } from '../seed/checklistTemplates'
import { checklistBlockers } from '../validate'
import { nowIso } from '../model/empty'
import { HELP, allPeople } from './help'
import {
  CheckField,
  DecisionGroup,
  PersonPicker,
  PhaseIntro,
  Pill,
  Seg,
  SubTitle,
  TextField,
  fmtDate,
} from './kit'
import {
  ActiveRunBlock,
  AdjudicationBlock,
  AnomalyCard,
  DebriefBlock,
  DeviationCard,
  GO_NO_GO_OPTIONS,
  GoNoGoForm,
  StartRunBlock,
  VALIDITY_KIND,
  VALIDITY_LABEL,
  decisionKind,
} from './ExecuteBlocks'

type Tab = 'day' | 'run' | 'checklists' | 'adjudication'

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
  const today = nowIso().slice(0, 10)
  const decidedToday = campaign.gonogos.some((g) => g.at.slice(0, 10) === today)

  return (
    <div className="inspector-body">
      <SubTitle>Day dashboard · {today}</SubTitle>
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

      <DecisionGroup
        id="e1-day-start"
        question="Are we go today?"
        hint="Go/no-go decision. The named approver releases the day, a readiness review, or one run."
        state={decidedToday ? 'done' : gonogos.length > 0 ? 'partial' : 'empty'}
      >
        <GoNoGoForm campaign={campaign} onOpenChecklists={onOpenChecklists} />
      </DecisionGroup>

      <SubTitle>Decisions (latest first)</SubTitle>
      {gonogos.length === 0 && <p className="muted small">None recorded.</p>}
      {gonogos.map((g) => (
        <div key={g.id} className="field-row te-table-row">
          <div className="muted small">
            {fmtDate(g.at)} · {g.scope} · approvers: {g.approvers || 'none'}
            {g.note ? ` · ${g.note}` : ''}
          </div>
          <Pill kind={decisionKind(g.decision)} text={g.decision} />
        </div>
      ))}
    </div>
  )
}

function RunConsoleTab({ campaign }: { campaign: TeCampaign }) {
  const [debriefRunId, setDebriefRunId] = useState<string | null>(null)
  const active = [...campaign.runs].reverse().find((r) => r.endAt === null) ?? null
  const activeCard = active ? campaign.cards.find((c) => c.id === active.cardId) : undefined
  const debriefRun = debriefRunId ? campaign.runs.find((r) => r.id === debriefRunId) : undefined
  const debriefCard = debriefRun ? campaign.cards.find((c) => c.id === debriefRun.cardId) : undefined
  const completed = campaign.runs
    .filter((r) => r.endAt !== null)
    .sort((a, b) => (b.endAt ?? '').localeCompare(a.endAt ?? ''))
  const runDeviations = active ? campaign.deviations.filter((d) => d.runId === active.id) : []
  const runAnomalies = active ? campaign.anomalies.filter((a) => a.runId === active.id) : []

  const deviationState =
    runDeviations.length === 0
      ? 'empty'
      : runDeviations.every((d) => d.validityEffect.trim() !== '' && d.actualState.trim() !== '')
        ? 'done'
        : 'partial'
  const anomalyState =
    runAnomalies.length === 0
      ? 'empty'
      : runAnomalies.every((a) => a.observation.trim() !== '' && !a.open)
        ? 'done'
        : 'partial'
  const duringState = active
    ? active.events.length > 0 || active.observations.length > 0 || active.operatorObservations.trim() !== ''
      ? 'partial'
      : 'empty'
    : 'empty'
  const debriefState = debriefRun
    ? debriefRun.debrief.plannedVsOccurred.trim() !== '' && debriefRun.preliminaryUse !== null
      ? 'done'
      : debriefRun.debrief.plannedVsOccurred.trim() !== '' || debriefRun.preliminaryUse !== null
        ? 'partial'
        : 'empty'
    : 'empty'

  return (
    <div className="inspector-body">
      <DecisionGroup
        id="e2-start-run"
        question="Which card runs next?"
        hint={HELP['card-issue']}
        tier="required"
        state={active ? 'done' : campaign.runs.length > 0 ? 'partial' : 'empty'}
        defaultOpen={active === null}
      >
        <StartRunBlock campaign={campaign} />
      </DecisionGroup>

      {active && activeCard && (
        <>
          <DecisionGroup id="e3-during-run" question="What happened, when?" state={duringState}>
            <ActiveRunBlock
              campaign={campaign}
              run={active}
              card={activeCard}
              onComplete={() => setDebriefRunId(active.id)}
            />
          </DecisionGroup>

          <DecisionGroup
            id="e4-deviations"
            question="Something differed. Does the run still count?"
            hint={HELP.deviation}
            tier="recommended"
            state={deviationState}
            defaultOpen={runDeviations.length > 0}
          >
            {runDeviations.length === 0 && (
              <p className="muted small">None. Tap "mark deviation" in the event marks to record one.</p>
            )}
            {runDeviations.map((d) => (
              <DeviationCard key={d.id} campaign={campaign} card={activeCard} dev={d} />
            ))}
          </DecisionGroup>

          <DecisionGroup
            id="e5-anomalies"
            question="Something unexpected. Record it first"
            hint={HELP.anomaly}
            state={anomalyState}
            defaultOpen={runAnomalies.length > 0}
          >
            {runAnomalies.length === 0 && (
              <p className="muted small">None. Tap "mark anomaly" in the event marks to record one.</p>
            )}
            {runAnomalies.map((a) => (
              <AnomalyCard key={a.id} campaign={campaign} card={activeCard} anomaly={a} />
            ))}
          </DecisionGroup>
        </>
      )}
      {!active && <p className="muted small">No active run.</p>}

      {debriefRun && (
        <DecisionGroup
          id="e6-debrief"
          question="What did we get?"
          hint={HELP['immediate-debrief']}
          tier="recommended"
          state={debriefState}
        >
          <DebriefBlock
            campaign={campaign}
            run={debriefRun}
            card={debriefCard}
            onClose={() => setDebriefRunId(null)}
          />
        </DecisionGroup>
      )}

      <SubTitle>Recently completed runs</SubTitle>
      {completed.length === 0 && <p className="muted small">None yet.</p>}
      {completed.slice(0, 8).map((r) => (
        <div key={r.id} className="field-row te-table-row">
          <div className="muted small">
            {r.id} · {r.plannedPurpose.slice(0, 48) || 'no purpose'} · ended {fmtDate(r.endAt)}
          </div>
          {r.preliminaryUse && <Pill kind="neutral" text={r.preliminaryUse} />}
          <button className="mini" onClick={() => setDebriefRunId(r.id)}>
            debrief
          </button>
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

/** The most recent earlier item's completer; one person usually runs a checklist. */
function previousCompleter(inst: TeChecklist, index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const it = inst.items[i]
    if (it.state !== 'unchecked' && it.completer.trim() !== '') return it.completer
  }
  return ''
}

function ChecklistsTab({ campaign }: { campaign: TeCampaign }) {
  const { startChecklist, patchItem } = useTeStore.getState()
  const people = allPeople(campaign)
  const open = campaign.checklists.filter((c) => c.completedAt === null)
  const done = campaign.checklists
    .filter((c) => c.completedAt !== null)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const setItem = (inst: TeChecklist, index: number, patch: Partial<ChecklistInstanceItem>) =>
    patchItem('checklists', inst.id, {
      items: inst.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    })

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
                <div className="muted small">
                  {t.name} · runner: {t.runner}
                  {t.gate ? ` · gate: ${t.gate}` : ''}
                </div>
                <button className="mini" onClick={() => startChecklist(t)}>
                  Start
                </button>
              </div>
            ))}
          </div>
        )
      })}

      <SubTitle>Open checklists</SubTitle>
      {open.length === 0 && <p className="muted small">None open.</p>}
      {open.map((inst) => {
        const template = templateByKey(inst.templateKey)
        const holdCount = inst.items.filter(
          (it, i) => template?.items[i]?.holdOnUnknown && it.state === 'unchecked',
        ).length
        return (
          <div key={inst.id} className="run-row">
            <SubTitle>
              {inst.name} · {inst.phase} · started {fmtDate(inst.startedAt)}
            </SubTitle>
            {holdCount > 0 && (
              <Pill kind="warn" text={`${holdCount} unknown answer(s) hold the run`} />
            )}
            {inst.items.map((it, i) => {
              const hold = template?.items[i]?.holdOnUnknown === true && it.state === 'unchecked'
              return (
                <div key={i}>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={it.state === 'checked'}
                      disabled={it.state === 'na'}
                      onChange={(e) =>
                        setItem(
                          inst,
                          i,
                          e.target.checked
                            ? {
                                state: 'checked',
                                at: nowIso(),
                                ...(it.completer.trim() === ''
                                  ? { completer: previousCompleter(inst, i) }
                                  : {}),
                              }
                            : { state: 'unchecked', at: null },
                        )
                      }
                    />
                    <span>{it.text}</span>
                    {it.state === 'na' && <Pill kind="neutral" text="n/a" />}
                    {hold && <Pill kind="warn" text="hold" />}
                  </label>
                  <div className="field-row">
                    {it.type === 'value' && (
                      <TextField label="Value" value={it.value} onChange={(v) => setItem(inst, i, { value: v })} />
                    )}
                    <PersonPicker
                      label="Completer"
                      value={it.completer}
                      onChange={(v) => setItem(inst, i, { completer: v })}
                      people={people}
                    />
                    <CheckField
                      label="n/a"
                      value={it.state === 'na'}
                      onChange={(v) => setItem(inst, i, v ? { state: 'na' } : { state: 'unchecked' })}
                    />
                    {it.state === 'na' && (
                      <TextField
                        label="n/a reason"
                        value={it.naReason}
                        onChange={(v) => setItem(inst, i, { naReason: v })}
                      />
                    )}
                  </div>
                </div>
              )
            })}
            {template?.gate && (
              <>
                <div className="field">
                  <span>Gate outcome ({template.gate})</span>
                  <Seg
                    value={(inst.outcome ?? '') as GoNoGo}
                    options={GO_NO_GO_OPTIONS}
                    onChange={(v) => patchItem('checklists', inst.id, { outcome: v })}
                  />
                </div>
                {(inst.outcome === 'conditional-go' || inst.conditionalLimits.trim() !== '') && (
                  <TextField
                    label="Conditional limits"
                    value={inst.conditionalLimits}
                    onChange={(v) => patchItem('checklists', inst.id, { conditionalLimits: v })}
                  />
                )}
              </>
            )}
            <div className="inspector-actions">
              <button
                className="primary"
                disabled={checklistBlockers(inst).length > 0}
                title={checklistBlockers(inst).join(' ')}
                onClick={() => patchItem('checklists', inst.id, { completedAt: nowIso() })}
              >
                Complete checklist
              </button>
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

function AdjudicationTab({ campaign }: { campaign: TeCampaign }) {
  const { selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.runs ?? null)
  const run = campaign.runs.find((r) => r.id === selected)
  const pending = campaign.runs.filter((r) => r.validity === 'pending').length
  return (
    <div className="inspector-body">
      <DecisionGroup
        id="e7-adjudication"
        question="Does each run count?"
        hint={HELP['run-validity']}
        tier="required"
        state={campaign.runs.length === 0 ? 'empty' : pending === 0 ? 'done' : 'partial'}
      >
        <p className="muted small">No status = not available for analysis. Dependent next runs wait.</p>
        {campaign.runs.length === 0 && <p className="muted small">No runs yet.</p>}
        <div className="cards-list">
          {campaign.runs.map((r) => (
            <button
              key={r.id}
              className={`card-chip ${selected === r.id ? 'active' : ''} ${r.excluded ? 'dim' : ''}`}
              onClick={() => selectRecord('runs', r.id)}
            >
              {r.id} <Pill kind={VALIDITY_KIND[r.validity]} text={VALIDITY_LABEL[r.validity]} />
            </button>
          ))}
        </div>
        {run && <AdjudicationBlock key={run.id} campaign={campaign} run={run} />}
      </DecisionGroup>
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
  const pending = campaign.runs.filter((r) => r.validity === 'pending').length
  const gate = pending
    ? { kind: 'warn' as const, text: `${pending} run(s) pending adjudication` }
    : campaign.runs.length
      ? { kind: 'good' as const, text: 'runs adjudicated' }
      : { kind: 'neutral' as const, text: 'no runs yet' }
  return (
    <div className="te-panel">
      <PhaseIntro phase="execute" gate={gate} />
      <Seg value={tab} options={TABS} onChange={setTab} />
      {tab === 'day' && <DayTab campaign={campaign} onOpenChecklists={() => setTab('checklists')} />}
      {tab === 'run' && <RunConsoleTab campaign={campaign} />}
      {tab === 'checklists' && <ChecklistsTab campaign={campaign} />}
      {tab === 'adjudication' && <AdjudicationTab campaign={campaign} />}
    </div>
  )
}

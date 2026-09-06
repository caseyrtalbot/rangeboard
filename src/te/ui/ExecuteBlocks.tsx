/**
 * Execute-stage decision blocks, local to the Execute panel. Every builder and picker writes the existing schema
 * field; derived drafts only move record content already on the campaign.
 */

import { useState } from 'react'
import { GENERIC_MARKS, IMMEDIATE_ACTIONS, INITIAL_DATA_QUALITY, MISSION_EFFECTS, PRESERVATION_ACTIONS } from '../seed/constants'
import type {
  DeviationDisposition,
  DeviationEffect,
  GoNoGo,
  GoNoGoScope,
  MeasureObservation,
  TeAnomaly,
  TeCampaign,
  TeCard,
  TeDeviation,
  TeRun,
  TeRunValidity,
} from '../model/types'
import { RUN_ROLES } from '../model/types'
import { useTeStore } from '../state/teStore'
import { canStartRun } from '../validate'
import { coverage } from '../calc/matrix'
import { templateByKey } from '../seed/checklistTemplates'
import { nowIso } from '../model/empty'
import { HELP, HINTS, allPeople, decisionRightHolder } from './help'
import {
  AdvancedDisclosure,
  CheckField,
  EntityPicker,
  ExampleHint,
  MultiPicker,
  NumberField,
  PersonPicker,
  Pill,
  Provenance,
  Seg,
  SegChips,
  SelectField,
  StageReview,
  SubTitle,
  TextField,
  fmtDate,
} from './kit'

// Shared vocab labels (enum values unchanged; labels plain per copy rules)

export const GO_NO_GO_OPTIONS: Array<{ v: GoNoGo; label: string }> = [
  { v: 'go', label: 'Go' },
  { v: 'conditional-go', label: 'Conditional go' },
  { v: 'hold', label: 'Hold' },
  { v: 'no-go', label: 'No go' },
]

export function decisionKind(d: GoNoGo): 'good' | 'warn' | 'bad' {
  return d === 'go' ? 'good' : d === 'no-go' ? 'bad' : 'warn'
}

export const VALIDITY_KIND: Record<TeRunValidity, 'good' | 'warn' | 'bad' | 'neutral'> = {
  pending: 'warn',
  valid: 'good',
  invalid: 'bad',
  'conditionally-valid': 'neutral',
}

/** Primary text says void, the enum keeps its name. */
export const VALIDITY_LABEL: Record<TeRunValidity, string> = {
  pending: 'Pending',
  valid: 'Valid',
  'conditionally-valid': 'Valid with limits',
  invalid: 'Void',
}

const DISPOSITION_OPTIONS: Array<{ v: DeviationDisposition; label: string }> = [
  { v: 'repeat', label: 'Repeat' },
  { v: 'analyze-with-limits', label: 'Use with limits' },
  { v: 'exclude', label: 'Drop the run' },
]

const EFFECT_OPTIONS: Array<{ v: DeviationEffect; label: string }> = [
  { v: 'none', label: 'None' },
  { v: 'bounded', label: 'Bounded' },
  { v: 'material', label: 'Material' },
  { v: 'unknown', label: 'Unknown' },
]

const OBS_STATUS_HELP =
  'Censored: the run ended before the outcome resolved. Unknown outcome: the event ran but could not be scored.'

/** Yes/no question over a stored string; a legacy value renders as a prepended option. */
function YesNoSeg({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const base = ['yes', 'no']
  const options = (value !== '' && !base.includes(value) ? [value, ...base] : base).map((v) => ({
    v,
    label: v,
  }))
  return (
    <div className="field">
      <span>{label}</span>
      <Seg value={value} options={options} onChange={onChange} />
    </div>
  )
}

// Data-files checklist: per-file received state renders into
// the run.dataFilesNote string. Legacy prose survives as the note line.

const FILE_LINE = /^(received|missing): (.*)$/

/** Card requiredFiles is prose separated by ; or newlines. */
function splitFiles(s: string): string[] {
  return [
    ...new Set(
      s
        .split(/[;\n]/)
        .map((t) => t.trim().replace(/\.$/, ''))
        .filter((t) => t !== ''),
    ),
  ]
}

function parseDataFiles(note: string): {
  status: Map<string, 'received' | 'missing'>
  rest: string
} {
  const status = new Map<string, 'received' | 'missing'>()
  const rest: string[] = []
  for (const line of note.split('\n')) {
    const m = FILE_LINE.exec(line.trim())
    if (m) status.set(m[2], m[1] as 'received' | 'missing')
    else if (line.trim() !== '') rest.push(line)
  }
  return { status, rest: rest.join('\n') }
}

function renderDataFiles(
  status: Map<string, 'received' | 'missing'>,
  rest: string,
): string {
  const lines = [...status.entries()].map(([f, s]) => `${s}: ${f}`)
  if (rest.trim() !== '') lines.push(rest)
  return lines.join('\n')
}

/** All files received -> yes; any missing -> no; else no suggestion. */
function sourcesRecordedSuggestion(card: TeCard | undefined, run: TeRun): string | null {
  const files = card ? splitFiles(card.requiredFiles) : []
  if (files.length === 0) return null
  const { status } = parseDataFiles(run.dataFilesNote)
  if (files.every((f) => status.get(f) === 'received')) return 'yes'
  if (files.some((f) => status.get(f) === 'missing')) return 'no'
  return null
}

function filesReceived(card: TeCard | undefined, run: TeRun): { got: number; total: number } {
  const files = card ? splitFiles(card.requiredFiles) : []
  const { status } = parseDataFiles(run.dataFilesNote)
  return { got: files.filter((f) => status.get(f) === 'received').length, total: files.length }
}

function DataFilesChecklist({ card, run }: { card: TeCard | undefined; run: TeRun }) {
  const { patchItem } = useTeStore.getState()
  const files = card ? splitFiles(card.requiredFiles) : []
  const { status, rest } = parseDataFiles(run.dataFilesNote)
  const setFile = (f: string, s: 'received' | 'missing' | null) => {
    const next = new Map(status)
    if (s === null) next.delete(f)
    else next.set(f, s)
    patchItem('runs', run.id, { dataFilesNote: renderDataFiles(next, rest) })
  }
  return (
    <div className="subsection">
      <div className="panel-subtitle">
        Data files
        <span className="help-dot" tabIndex={0} data-help="Per required file: did we get it? The list comes from the card.">
          ?
        </span>
      </div>
      {files.length === 0 && <div className="muted small">The card names no required files.</div>}
      {files.map((f) => {
        const s = status.get(f) ?? null
        return (
          <div key={f} className="field-row te-table-row">
            <div className="muted small">{f}</div>
            <Seg
              value={(s ?? '') as '' | 'received' | 'missing'}
              options={[
                { v: 'received', label: 'received' },
                { v: 'missing', label: 'missing' },
              ]}
              onChange={(v) => {
                if (v === '') return
                setFile(f, s === v ? null : v)
              }}
            />
          </div>
        )
      })}
      <TextField
        label="File note"
        value={rest}
        onChange={(v) => patchItem('runs', run.id, { dataFilesNote: renderDataFiles(status, v) })}
      />
    </div>
  )
}

// E1: go/no-go record form

export function GoNoGoForm({ campaign, onOpenChecklists }: { campaign: TeCampaign; onOpenChecklists: () => void }) {
  const { recordGoNoGo, startChecklist } = useTeStore.getState()
  const [scope, setScope] = useState<GoNoGoScope>('daily')
  const [decision, setDecision] = useState<GoNoGo>('go')
  const defaultApprovers = decisionRightHolder(campaign, 'daily go/no-go')
  const [approvers, setApprovers] = useState(defaultApprovers)
  const [note, setNote] = useState('')
  const people = allPeople(campaign)
  return (
    <>
      <div className="field">
        <span>Which decision is this?</span>
        <Seg
          value={scope}
          options={[
            { v: 'daily' as GoNoGoScope, label: 'Daily' },
            { v: 'readiness-review' as GoNoGoScope, label: 'Readiness review' },
            { v: 'pre-run-release' as GoNoGoScope, label: 'Pre-run release' },
          ]}
          onChange={setScope}
        />
      </div>
      <div className="field">
        <span>Decision</span>
        <Seg value={decision} options={GO_NO_GO_OPTIONS} onChange={setDecision} />
      </div>
      <div className="field-row">
        <PersonPicker
          label="Approver"
          value={approvers}
          onChange={setApprovers}
          people={people}
          prefillSource={approvers === defaultApprovers && defaultApprovers !== '' ? 'decision rights: daily go/no-go' : undefined}
        />
        <TextField label="Note" value={note} onChange={setNote} />
      </div>
      <div className="inspector-actions">
        <button
          className="primary"
          onClick={() => {
            recordGoNoGo(scope, decision, approvers, note)
            setApprovers(defaultApprovers)
            setNote('')
          }}
        >
          Record decision
        </button>
        <button
          onClick={() => {
            const t = templateByKey('day-start')
            if (t) startChecklist(t)
            onOpenChecklists()
          }}
        >
          Start day-start checklist
        </button>
      </div>
    </>
  )
}

// E2: start a run

/** Issued card that serves the thinnest highest-priority matrix cell. */
function nextCardDefault(campaign: TeCampaign): { cardId: string; cellId: string } | null {
  const thin = coverage(campaign)
    .filter((c) => c.valid < c.minValid)
    .map((c) => ({ c, cell: campaign.matrix.find((m) => m.id === c.cellId) }))
    .filter((x) => x.cell !== undefined)
    .sort((a, b) => a.cell!.priority - b.cell!.priority)
  for (const { c } of thin) {
    const card = campaign.cards.find((x) => x.status === 'issued' && x.matrixCellId === c.cellId)
    if (card) return { cardId: card.id, cellId: c.cellId }
  }
  return null
}

export function StartRunBlock({ campaign }: { campaign: TeCampaign }) {
  const { createRunFromCard, patchItem } = useTeStore.getState()
  const [cardId, setCardId] = useState<string | null>(null)
  const issued = campaign.cards.filter((c) => c.status === 'issued')
  const selectedCard = issued.find((c) => c.id === cardId)
  const suggestion = nextCardDefault(campaign)
  const start = (id: string | null) => {
    if (!id) return
    const runId = createRunFromCard(id)
    if (!runId) return
    // Prefill roles from the last run of the same card (audit: default, not button).
    const prior = [...campaign.runs].reverse().find((r) => r.cardId === id && r.roles.length > 0)
    if (prior) patchItem('runs', runId, { roles: prior.roles.map((r) => ({ ...r })) })
  }
  return (
    <>
      <div className="field-row">
        <EntityPicker
          label="Issued card"
          help={HELP['card-issue']}
          options={issued.map((c) => ({
            id: c.id,
            label: `${c.cardCode} ${c.version}: ${c.title || 'untitled'}`,
            sub: c.purpose,
          }))}
          value={cardId}
          onChange={setCardId}
          prefill={suggestion ? { id: suggestion.cardId, source: `next priority cell ${suggestion.cellId}` } : undefined}
        />
        <div className="field">
          <span>&nbsp;</span>
          <button className="primary" disabled={!canStartRun(selectedCard)} onClick={() => start(cardId)}>
            Start run
          </button>
        </div>
      </div>
      {issued.length === 0 && <p className="muted small">No issued cards. Issue a card first.</p>}
    </>
  )
}

// E3: during the run

function ObservationRow({ campaign, run, measureId }: { campaign: TeCampaign; run: TeRun; measureId: string }) {
  const { patchItem, amendRunObservations } = useTeStore.getState()
  const [correction, setCorrection] = useState<MeasureObservation | null>(null)
  const [by, setBy] = useState('')
  const [reason, setReason] = useState('')
  const measure = campaign.measures.find((m) => m.id === measureId)
  const obs: MeasureObservation = correction ?? run.observations.find((o) => o.measureId === measureId) ?? {
    measureId,
    status: 'no-test',
    success: null,
    value: null,
    note: '',
  }
  const setObs = (patch: Partial<MeasureObservation>) => {
    if (run.adjudications.length > 0) { setCorrection({ ...obs, ...patch }); return }
    const has = run.observations.some((o) => o.measureId === measureId)
    const next = has
      ? run.observations.map((o) => (o.measureId === measureId ? { ...o, ...patch } : o))
      : [...run.observations, { ...obs, ...patch }]
    patchItem('runs', run.id, { observations: next })
  }
  return (
    <div className="te-table-row">
      <div className="field-row">
      <div className="field">
        <span>Measure</span>
        <div className="muted small">
          {measureId}: {measure?.name || 'unnamed'}
        </div>
      </div>
      <SelectField
        label="Status"
        help={OBS_STATUS_HELP}
        value={obs.status}
        options={[
          { v: 'observed' as const, label: 'Observed' },
          { v: 'missing' as const, label: 'Missing' },
          { v: 'invalid' as const, label: 'Invalid' },
          { v: 'censored' as const, label: 'Censored' },
          { v: 'unknown-outcome' as const, label: 'Unknown outcome' },
          { v: 'no-test' as const, label: 'No test' },
        ]}
        onChange={(v) => v && setObs({ status: v })}
      />
      {measure?.family === 'binomial' ? (
        <div className="field">
          <span>Success</span>
          <Seg
            value={(obs.success === true ? 'yes' : obs.success === false ? 'no' : '') as 'yes' | 'no'}
            options={[
              { v: 'yes', label: 'yes' },
              { v: 'no', label: 'no' },
            ]}
            onChange={(v) => setObs({ success: v === 'yes' })}
          />
        </div>
      ) : (
        <NumberField
          label={`Value${measure?.unit ? ` (${measure.unit})` : ''}`}
          value={obs.value}
          onChange={(v) => setObs({ value: v })}
        />
      )}
      <TextField label="Note" value={obs.note} onChange={(v) => setObs({ note: v })} />
      </div>
      {correction && <div>
        <div className="field-row">
        <TextField label="Correction by" value={by} onChange={setBy} />
        <TextField label="Correction reason" value={reason} onChange={setReason} />
        </div>
        <div className="inspector-actions">
        <button className="mini" disabled={!by.trim() || !reason.trim()} onClick={() => {
          const observations = run.observations.some(o => o.measureId === measureId)
            ? run.observations.map(o => o.measureId === measureId ? correction : o)
            : [...run.observations, correction]
          amendRunObservations(run.id, observations, by, reason)
          setCorrection(null)
        }}>Save correction for re-adjudication</button>
        <button className="mini" onClick={() => setCorrection(null)}>Cancel correction</button>
        </div>
      </div>}
      {(run.observationAmendments ?? []).filter(a =>
        JSON.stringify(a.previous.find(o => o.measureId === measureId)) !==
        JSON.stringify(a.corrected.find(o => o.measureId === measureId)),
      ).map((a, i) => {
        const previous = a.previous.find(o => o.measureId === measureId)
        const corrected = a.corrected.find(o => o.measureId === measureId)
        return <p key={i} className="muted small">
          Correction {i + 1}: {a.by}, {fmtDate(a.at)}, {a.reason}.
          Previous: {previous?.status ?? 'absent'}, {String(previous?.value ?? previous?.success ?? 'no value')}
          {' '}{measure?.unit}; {previous?.note}.
          Corrected: {corrected?.status ?? 'absent'}, {String(corrected?.value ?? corrected?.success ?? 'no value')}
          {' '}{measure?.unit}; {corrected?.note}.
        </p>
      })}
    </div>
  )
}

export function ActiveRunBlock({
  campaign,
  run,
  card,
  onComplete,
}: {
  campaign: TeCampaign
  run: TeRun
  card: TeCard
  onComplete: () => void
}) {
  const { markRunEvent, addDeviation, addAnomaly, patchItem, discardRun } = useTeStore.getState()
  const people = allPeople(campaign)
  const validityHolder = decisionRightHolder(campaign, 'run validity')
  const marks = [...new Set([...card.eventMarks.filter((m) => m.trim() !== ''), ...GENERIC_MARKS])]
  const events = [...run.events].sort((a, b) => a.at.localeCompare(b.at))
  const priorRolesRun = [...campaign.runs]
    .reverse()
    .find((r) => r.cardId === run.cardId && r.id !== run.id && r.roles.length > 0)
  const rolesInherited =
    priorRolesRun !== undefined &&
    run.roles.length > 0 &&
    JSON.stringify(run.roles) === JSON.stringify(priorRolesRun.roles)
  const noEvidence =
    run.events.length === 0 &&
    run.deviationIds.length === 0 &&
    run.anomalyIds.length === 0 &&
    run.adjudications.length === 0 &&
    run.observations.length === 0 &&
    run.operatorObservations.trim() === ''

  const tap = (mark: string) => {
    markRunEvent(run.id, mark)
    if (mark === 'mark deviation') {
      const id = addDeviation(run.id)
      if (id && validityHolder !== '') patchItem('deviations', id, { approver: validityHolder })
    }
    if (mark === 'mark anomaly') addAnomaly(run.id)
  }

  return (
    <>
      <SubTitle action={<Pill kind="good" text="active" />}>
        {run.id} · {card.cardCode} {run.cardVersion}
      </SubTitle>
      <div className="spec-summary">
        Purpose: {card.purpose || 'not stated'} · Prediction: {card.prediction || 'not stated'} · Changed factor: {card.changedFactor || 'not stated'}
      </div>

      <SubTitle
        action={
          <button
            className="mini"
            onClick={() => patchItem('runs', run.id, { roles: [...run.roles, { role: RUN_ROLES[0], person: '' }] })}
          >
            + role
          </button>
        }
      >
        Roles
      </SubTitle>
      {rolesInherited && (
        <div className="provenance-line">
          <span className="provenance-chip">from last run of this card</span>
        </div>
      )}
      {run.roles.length === 0 && <p className="muted small">No roles assigned yet.</p>}
      {run.roles.map((r, i) => (
        <div key={i} className="field-row te-table-row">
          <SelectField
            label="Role"
            value={r.role}
            options={RUN_ROLES.map((v) => ({ v, label: v }))}
            onChange={(v) =>
              v && patchItem('runs', run.id, { roles: run.roles.map((x, j) => (j === i ? { ...x, role: v } : x)) })
            }
          />
          <PersonPicker
            label="Person"
            value={r.person}
            onChange={(v) =>
              patchItem('runs', run.id, { roles: run.roles.map((x, j) => (j === i ? { ...x, person: v } : x)) })
            }
            people={people}
          />
          <button
            className="mini danger"
            onClick={() => patchItem('runs', run.id, { roles: run.roles.filter((_, j) => j !== i) })}
          >
            ×
          </button>
        </div>
      ))}

      <SubTitle>Procedure</SubTitle>
      <ol className="muted small">
        {card.procedure.map((s) => (
          <li key={s.id}>
            {s.action} ({s.role}) · done when: {s.observableCompletion || 'not stated'}
          </li>
        ))}
      </ol>

      <SubTitle>Event marks</SubTitle>
      <div className="cards-list">
        {marks.map((m) => (
          <button key={m} className="card-chip" onClick={() => tap(m)}>
            {m}
          </button>
        ))}
      </div>

      <SubTitle>Event log</SubTitle>
      {events.length === 0 && <p className="muted small">No events yet.</p>}
      {events.map((e) => (
        <div key={e.id} className="muted small">
          {fmtDate(e.at)} · {e.mark}
          {e.note ? ` · ${e.note}` : ''}
        </div>
      ))}

      <SubTitle>Observations per measure</SubTitle>
      {card.measureIds.length === 0 && <p className="muted small">The card links no measures.</p>}
      {card.measureIds.map((mid) => (
        <ObservationRow key={`${run.id}/${mid}`} campaign={campaign} run={run} measureId={mid} />
      ))}

      <TextField
        label="Operator observations"
        rows={3}
        value={run.operatorObservations}
        onChange={(v) => patchItem('runs', run.id, { operatorObservations: v })}
      />
      <ExampleHint
        definition="Raw run narrative in the operator's own words."
        example="0932 first track on scope; operator called contact before the C2 cue; track dropped twice near the tree line."
        illustrative
      />

      <div className="inspector-actions">
        <button
          className="primary"
          onClick={() => {
            patchItem('runs', run.id, { endAt: nowIso() })
            onComplete()
          }}
        >
          Complete run
        </button>
        {noEvidence && (
          <button
            className="mini danger"
            onClick={() => {
              if (window.confirm('Discard this run? It has no recorded evidence.')) discardRun(run.id)
            }}
          >
            Discard run (no evidence)
          </button>
        )}
      </div>
    </>
  )
}

// E4: deviation record with the merged validity decision.
// One decision writes effect, easierOrHarder, validityEffect, disposition,
// and generalizationLimit; every field stays individually editable.

/** Compose the validity line from the picked enum values only. */
function deviationValidityLine(d: TeDeviation): string {
  if (d.disposition == null) return ''
  const effect =
    d.effect === 'none'
      ? 'No effect on validity'
      : d.effect === 'unknown'
        ? 'Unknown effect on validity'
        : `${d.effect === 'bounded' ? 'Bounded' : 'Material'} effect on validity`
  const dir =
    d.easierOrHarder === 'easier'
      ? 'made the test easier'
      : d.easierOrHarder === 'harder'
        ? 'made the test harder'
        : 'direction unknown'
  const disp =
    d.disposition === 'repeat'
      ? 'repeat the run'
      : d.disposition === 'analyze-with-limits'
        ? 'use with limits'
        : 'drop the run'
  return `${effect}; ${dir}; ${disp}.`
}

export function DeviationCard({ campaign, card, dev }: { campaign: TeCampaign; card: TeCard | undefined; dev: TeDeviation }) {
  const { patchItem } = useTeStore.getState()
  const people = allPeople(campaign)
  const set = (patch: Partial<TeDeviation>) => patchItem('deviations', dev.id, patch)
  const plannedOptions = card
    ? [card.redInitialState, card.conditionNote, ...card.procedure.map((s) => s.action)]
        .map((t) => t.trim())
        .filter((t) => t !== '')
        .map((t) => ({ id: t, label: t }))
    : []
  const cardMeasures = new Set(card?.measureIds ?? [])
  const affectedOptions = [
    ...campaign.measures
      .filter((m) => cardMeasures.has(m.id))
      .map((m) => ({ id: m.name || m.id, label: m.name || m.id, sub: 'measure on this card' })),
    ...campaign.factors.map((f) => ({ id: f.name, label: f.name, sub: 'factor' })),
    ...campaign.measures
      .filter((m) => !cardMeasures.has(m.id))
      .map((m) => ({ id: m.name || m.id, label: m.name || m.id, sub: 'measure' })),
  ]
  const line = deviationValidityLine(dev)
  const provState =
    dev.validityEffect.trim() === '' ? 'pending' : dev.validityEffect === line ? 'inherited' : 'edited'
  return (
    <div className="run-row">
      <div className="field-row">
        <EntityPicker
          label="Planned state"
          help="Pick the card statement it deviates from. Free text stays allowed."
          options={plannedOptions}
          allowFree
          freeValue={dev.plannedState}
          onFree={(v) => set({ plannedState: v })}
          onChange={() => {}}
        />
        <TextField label="Actual state" value={dev.actualState} onChange={(v) => set({ actualState: v })} />
      </div>
      <div className="field-row">
        <TextField
          label="Direct observation"
          value={dev.directObservation}
          onChange={(v) => set({ directObservation: v })}
        />
        <EntityPicker
          label="What did this deviation touch?"
          help="The variable, control, measure, or rule it affected."
          options={affectedOptions}
          allowFree
          freeValue={dev.affected}
          onFree={(v) => set({ affected: v })}
          onChange={() => {}}
        />
      </div>
      <SegChips
        label="Immediate action"
        options={IMMEDIATE_ACTIONS.map((v) => ({ v, label: v }))}
        value={dev.immediateAction === '' ? null : dev.immediateAction}
        allowCustom
        onChange={(v) => set({ immediateAction: (v as string | null) ?? '' })}
      />
      <CheckField label="Data preserved" value={dev.dataPreserved} onChange={(v) => set({ dataPreserved: v })} />

      <div className="panel-subtitle">
        Does the run still count?
        <span className="help-dot" tabIndex={0} data-help={HELP.deviation}>
          ?
        </span>
      </div>
      <div className="field">
        <span>What happens to this run now?</span>
        <Seg value={dev.disposition} options={DISPOSITION_OPTIONS} onChange={(v) => set({ disposition: v })} />
      </div>
      <div className="field-row">
        <div className="field">
          <span>Easier or harder for the system?</span>
          <Seg
            value={(dev.easierOrHarder ?? '') as 'easier' | 'harder' | 'neutral-unknown'}
            options={[
              { v: 'easier' as const, label: 'Easier' },
              { v: 'harder' as const, label: 'Harder' },
              { v: 'neutral-unknown' as const, label: 'Unknown' },
            ]}
            onChange={(v) => set({ easierOrHarder: v })}
          />
        </div>
        <div className="field">
          <span>How big is the effect?</span>
          <Seg value={dev.effect} options={EFFECT_OPTIONS} onChange={(v) => set({ effect: v })} />
        </div>
      </div>
      <Provenance
        source="the answers above"
        state={provState}
        onConfirm={line !== '' ? () => set({ validityEffect: line }) : undefined}
        onRevert={() => set({ validityEffect: line })}
      >
        <TextField
          label="Does this change whether the run counts?"
          value={dev.validityEffect}
          onChange={(v) => set({ validityEffect: v })}
        />
        {provState === 'pending' && line !== '' && <div className="muted small">Draft: {line}</div>}
      </Provenance>
      <TextField
        label="What can this run no longer prove?"
        value={dev.generalizationLimit}
        onChange={(v) => set({ generalizationLimit: v })}
      />
      <ExampleHint
        definition="The claim this run can no longer support."
        example="This run cannot support night detection range; the deviation moved the run to daylight."
        illustrative
      />
      <PersonPicker
        label="Approver"
        value={dev.approver}
        onChange={(v) => set({ approver: v })}
        people={people}
        prefillSource={
          dev.approver !== '' && dev.approver === decisionRightHolder(campaign, 'run validity')
            ? 'decision rights: run validity'
            : undefined
        }
      />
    </div>
  )
}

// E5: anomaly record. Raw observation first, then the closure fields.

export function AnomalyCard({ campaign, card, anomaly }: { campaign: TeCampaign; card: TeCard | undefined; anomaly: TeAnomaly }) {
  const { patchItem, createDiagnosticCard, selectRecord } = useTeStore.getState()
  const people = allPeople(campaign)
  const set = (patch: Partial<TeAnomaly>) => patchItem('anomalies', anomaly.id, patch)
  const sourceOptions = [
    ...new Set(
      [
        ...campaign.measures.flatMap((m) => [m.truth.primarySource, m.truth.backupSource]),
        card?.dataSources ?? '',
      ]
        .map((t) => t.trim())
        .filter((t) => t !== ''),
    ),
  ].map((t) => ({ id: t, label: t }))
  return (
    <div className="run-row">
      <TextField
        label="What did you see? Record it before discussing causes"
        rows={2}
        value={anomaly.observation}
        onChange={(v) => set({ observation: v })}
        help={HINTS.anomaly.definition}
      />
      <div className="field-row">
        <EntityPicker
          label="Source"
          help="Which truth source or data source showed it."
          options={sourceOptions}
          allowFree
          freeValue={anomaly.source}
          onFree={(v) => set({ source: v })}
          onChange={() => {}}
        />
        <SelectField
          label="Classification"
          value={anomaly.classification}
          options={[
            { v: 'system-behavior' as const, label: 'System behavior' },
            { v: 'test-infrastructure' as const, label: 'Test infrastructure' },
            { v: 'threat-deviation' as const, label: 'Threat deviation' },
            { v: 'operator-action' as const, label: 'Operator action' },
            { v: 'data-artifact' as const, label: 'Data artifact' },
            { v: 'unknown' as const, label: 'Unknown' },
          ]}
          onChange={(v) => v && set({ classification: v })}
        />
      </div>
      <SegChips
        label="Mission effect"
        options={MISSION_EFFECTS.map((v) => ({ v, label: v }))}
        value={anomaly.missionEffect === '' ? null : anomaly.missionEffect}
        allowCustom
        onChange={(v) => set({ missionEffect: (v as string | null) ?? '' })}
      />
      <SegChips
        label="What did you do to protect the data?"
        options={PRESERVATION_ACTIONS.map((v) => ({ v, label: v }))}
        value={anomaly.preservationAction === '' ? null : anomaly.preservationAction}
        allowCustom
        onChange={(v) => set({ preservationAction: (v as string | null) ?? '' })}
      />

      <div className="panel-subtitle">
        Closure
        <span className="help-dot" tabIndex={0} data-help={HELP.anomaly}>
          ?
        </span>
      </div>
      <div className="field-row">
        <SelectField
          label="Root cause status"
          value={anomaly.rootCauseStatus}
          options={[
            { v: 'confirmed' as const, label: 'Confirmed' },
            { v: 'supported' as const, label: 'Supported' },
            { v: 'plausible' as const, label: 'Plausible' },
            { v: 'contradicted' as const, label: 'Contradicted' },
            { v: 'unknown' as const, label: 'Unknown' },
          ]}
          onChange={(v) => v && set({ rootCauseStatus: v })}
        />
        <TextField label="Candidate causes" value={anomaly.candidateCauses} onChange={(v) => set({ candidateCauses: v })} />
        <TextField label="Corrective action" value={anomaly.correctiveAction} onChange={(v) => set({ correctiveAction: v })} />
      </div>
      <div className="field-row">
        <EntityPicker
          label="Verification test"
          help="The card that will verify the fix."
          options={campaign.cards.map((c) => ({ id: c.cardCode, label: c.cardCode, sub: c.title }))}
          allowFree
          freeValue={anomaly.verificationTest}
          onFree={(v) => set({ verificationTest: v })}
          onChange={() => {}}
        />
        <div className="field">
          <span>&nbsp;</span>
          <button
            className="mini"
            onClick={() => {
              const id = createDiagnosticCard(anomaly.id)
              if (id) selectRecord('cards', id)
            }}
          >
            Create diagnostic card
          </button>
        </div>
        <PersonPicker label="Owner" value={anomaly.owner} onChange={(v) => set({ owner: v })} people={people} />
        <CheckField label="Open" value={anomaly.open} onChange={(v) => set({ open: v })} />
      </div>
      <AdvancedDisclosure label="Closure detail">
        <TextField
          label="Distinguishing evidence"
          help="What would tell the candidate causes apart."
          value={anomaly.distinguishingEvidence}
          onChange={(v) => set({ distinguishingEvidence: v })}
        />
        <TextField
          label="Diagnostic action"
          help="The step that gets that evidence."
          value={anomaly.diagnosticAction}
          onChange={(v) => set({ diagnosticAction: v })}
        />
      </AdvancedDisclosure>
    </div>
  )
}

// E6: debrief with derived drafts. Drafts only assemble record content
// (procedure, events, deviations); they write on explicit use only.

function debriefStoryDraft(card: TeCard | undefined, run: TeRun): string {
  const planned = (card?.procedure ?? [])
    .map((s, i) => `${i + 1}. ${s.action}`)
    .filter((s) => s.trim() !== '')
  const occurred = [...run.events]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => `${e.at.slice(11, 16)} ${e.mark}${e.note ? ` (${e.note})` : ''}`)
  const parts: string[] = []
  if (planned.length > 0) parts.push(`Planned: ${planned.join('; ')}`)
  if (occurred.length > 0) parts.push(`Occurred: ${occurred.join('; ')}`)
  return parts.join('\n')
}

function debriefDifferencesDraft(campaign: TeCampaign, run: TeRun): string {
  return campaign.deviations
    .filter((d) => d.runId === run.id)
    .map((d) => {
      const from = d.plannedState.trim()
      const to = d.actualState.trim()
      if (from === '' && to === '') return d.directObservation.trim()
      return `${from || 'planned state not stated'} -> ${to || 'actual state not stated'}`
    })
    .filter((t) => t !== '')
    .join('\n')
}

function warningsDraft(run: TeRun): string {
  return run.events
    .filter((e) => /fail|warn|abort|stop/i.test(e.mark))
    .map((e) => `${e.mark}${e.note ? ` (${e.note})` : ''}`)
    .join('; ')
}

/** Draft field: pending suggestion while empty; provenance while it matches. */
function DraftText({
  label,
  rows,
  value,
  draft,
  source,
  onChange,
}: {
  label: string
  rows?: number
  value: string
  draft: string
  source: string
  onChange: (v: string) => void
}) {
  const field = <TextField label={label} rows={rows} value={value} onChange={onChange} />
  if (draft.trim() === '') return field
  const state = value.trim() === '' ? 'pending' : value === draft ? 'inherited' : 'edited'
  if (state === 'edited') return field
  return (
    <Provenance source={source} state={state} onConfirm={state === 'pending' ? () => onChange(draft) : undefined}>
      {state === 'pending' ? (
        <>
          {field}
          <div className="muted small">Draft: {draft}</div>
        </>
      ) : (
        field
      )}
    </Provenance>
  )
}

export function DebriefBlock({
  campaign,
  run,
  card,
  onClose,
}: {
  campaign: TeCampaign
  run: TeRun
  card: TeCard | undefined
  onClose: () => void
}) {
  const { patchItem } = useTeStore.getState()
  const set = (patch: Partial<TeRun['debrief']>) =>
    patchItem('runs', run.id, { debrief: { ...run.debrief, ...patch } })
  const story = debriefStoryDraft(card, run)
  const differences = debriefDifferencesDraft(campaign, run)
  const warnings = warningsDraft(run)
  const sourcesSuggested = sourcesRecordedSuggestion(card, run)
  return (
    <div className="run-row">
      <SubTitle
        action={
          <button className="mini" onClick={onClose}>
            close
          </button>
        }
      >
        Debrief · {run.id}
        <span className="help-dot" tabIndex={0} data-help={HELP['immediate-debrief']}>
          ?
        </span>
      </SubTitle>
      <DraftText
        label="What was planned, what occurred, in time order"
        rows={2}
        value={run.debrief.plannedVsOccurred}
        draft={story}
        source="card procedure and event log"
        onChange={(v) => set({ plannedVsOccurred: v })}
      />
      <DraftText
        label="What differed"
        rows={2}
        value={run.debrief.differences}
        draft={differences}
        source="deviation records"
        onChange={(v) => set({ differences: v })}
      />
      <div>
        <YesNoSeg
          label="Were all sources recorded?"
          value={run.debrief.sourcesRecorded}
          onChange={(v) => set({ sourcesRecorded: v })}
        />
        {sourcesSuggested !== null && run.debrief.sourcesRecorded === '' && (
          <div className="provenance-line">
            <span className="provenance-chip">from data-files checklist</span>
            <button type="button" className="mini" onClick={() => set({ sourcesRecorded: sourcesSuggested })}>
              Use {sourcesSuggested}
            </button>
          </div>
        )}
      </div>
      <DraftText
        label="Warnings or failures"
        value={run.debrief.warningsOrFailures}
        draft={warnings}
        source="event marks"
        onChange={(v) => set({ warningsOrFailures: v })}
      />
      {card && card.prediction.trim() !== '' && (
        <div className="muted small">Prediction on the card: {card.prediction}</div>
      )}
      <TextField
        label="Which result was unexpected?"
        value={run.debrief.unexpectedResult}
        onChange={(v) => set({ unexpectedResult: v })}
      />

      <div className="field">
        <span>
          Can we use this run's data now?
          <span className="help-dot" tabIndex={0} data-help={HINTS['preliminary-use'].definition}>
            ?
          </span>
        </span>
        <Seg
          value={(run.preliminaryUse ?? '') as NonNullable<TeRun['preliminaryUse']>}
          options={[
            { v: 'usable' as const, label: 'Usable' },
            { v: 'limited' as const, label: 'Limited' },
            { v: 'repeat' as const, label: 'Repeat' },
            { v: 'valid-failure' as const, label: 'Valid failure' },
          ]}
          onChange={(v) =>
            patchItem('runs', run.id, {
              preliminaryUse: v,
              ...(v === 'repeat' && run.debrief.repeatNeeded.trim() === ''
                ? { debrief: { ...run.debrief, repeatNeeded: 'yes' } }
                : {}),
            })
          }
        />
      </div>
      <ExampleHint definition={HINTS['preliminary-use'].example} />
      <div>
        <YesNoSeg
          label="Repeat needed?"
          value={run.debrief.repeatNeeded}
          onChange={(v) => set({ repeatNeeded: v })}
        />
        {run.preliminaryUse === 'repeat' && run.debrief.repeatNeeded === 'yes' && (
          <div className="provenance-line">
            <span className="provenance-chip">from use decision: repeat</span>
          </div>
        )}
      </div>
    </div>
  )
}

// E7: adjudication. Differed-from-plan toggle, data-files checklist,
// initial data quality, one adjudication action gated on the validity pick,
// StageReview above the Record button.

export function AdjudicationBlock({ campaign, run }: { campaign: TeCampaign; run: TeRun }) {
  const { adjudicateRun, patchItem, selectRecord, setRunExcluded } = useTeStore.getState()
  const card = campaign.cards.find((c) => c.id === run.cardId)
  const people = allPeople(campaign)
  const validityHolder = decisionRightHolder(campaign, 'run validity')
  const [validity, setValidity] = useState<TeRunValidity>(run.validity)
  const [exclusionReason, setExclusionReason] = useState(run.exclusionReason ?? '')
  const [by, setBy] = useState(validityHolder)
  const [reason, setReason] = useState('')
  const hasOverride =
    run.actualConfigId !== null ||
    run.actualThreatId !== null ||
    run.actualConditionId !== null ||
    run.actualsNote.trim() !== ''
  const [differed, setDiffered] = useState(hasOverride)

  const name = (list: Array<{ id: string; name: string }>, id: string | null) =>
    id === null ? null : (list.find((x) => x.id === id)?.name ?? id)
  const plannedConfig = name(campaign.configs, card?.configId ?? null) ?? 'not set'
  const plannedThreat = name(campaign.threats, card?.threatId ?? null) ?? 'not set'
  const plannedCondition = name(campaign.conditions, card?.conditionId ?? null) ?? 'not set'
  const actualLabel = (list: Array<{ id: string; name: string }>, id: string | null, planned: string) =>
    id === null ? planned : `${name(list, id)} (differed)`

  const files = filesReceived(card, run)
  const openAnomalies = campaign.anomalies.filter((a) => a.runId === run.id && a.open).length
  const deviationCount = run.deviationIds.length

  const clearOverrides = () => {
    setDiffered(false)
    patchItem('runs', run.id, { actualConfigId: null, actualThreatId: null, actualConditionId: null })
  }

  const issues: Array<{ level: 'block' | 'warn'; text: string }> = []
  if (validity === 'pending') issues.push({ level: 'block', text: 'Pick a validity status.' })
  if (validity === 'conditionally-valid' && run.allowedMeasureIds.length === 0)
    issues.push({ level: 'block', text: 'Pick the allowed measures.' })
  if (!by.trim()) issues.push({ level: 'block', text: 'Name the adjudicator.' })
  if (reason.trim() === '') issues.push({ level: 'block', text: 'State the adjudication reason.' })
  if (files.total > 0 && files.got < files.total)
    issues.push({ level: 'warn', text: `Data files: ${files.got} of ${files.total} received.` })
  if (openAnomalies > 0) issues.push({ level: 'warn', text: `${openAnomalies} anomaly record(s) still open.` })

  return (
    <div className="run-row">
      <SubTitle action={<Pill kind={VALIDITY_KIND[run.validity]} text={VALIDITY_LABEL[run.validity]} />}>
        {run.id}
      </SubTitle>
      <div className="muted small">
        card: {card?.title || run.cardId} {run.cardVersion} · start {fmtDate(run.startAt)} · end {fmtDate(run.endAt)}
      </div>

      <div className="panel-subtitle">Did anything differ from the plan?</div>
      <div className="sr-rows">
        <div className="sr-row">
          <span className="sr-label">Configuration</span>
          <span className="sr-value">{actualLabel(campaign.configs, run.actualConfigId, plannedConfig)}</span>
          {run.actualConfigId === null && card && <span className="provenance-chip">from {card.cardCode}</span>}
        </div>
        <div className="sr-row">
          <span className="sr-label">Threat</span>
          <span className="sr-value">{actualLabel(campaign.threats, run.actualThreatId, plannedThreat)}</span>
          {run.actualThreatId === null && card && <span className="provenance-chip">from {card.cardCode}</span>}
        </div>
        <div className="sr-row">
          <span className="sr-label">Condition</span>
          <span className="sr-value">{actualLabel(campaign.conditions, run.actualConditionId, plannedCondition)}</span>
          {run.actualConditionId === null && card && <span className="provenance-chip">from {card.cardCode}</span>}
        </div>
      </div>
      <CheckField
        label="Differed from plan"
        help="Empty pickers mean the run went as the card planned."
        value={differed}
        onChange={(v) => (v ? setDiffered(true) : clearOverrides())}
      />
      {differed && (
        <>
          <div className="field-row">
            <SelectField
              label="Actual configuration"
              value={run.actualConfigId}
              allowEmpty="as planned"
              options={campaign.configs.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))}
              onChange={(v) => patchItem('runs', run.id, { actualConfigId: v })}
            />
            <SelectField
              label="Actual threat"
              value={run.actualThreatId}
              allowEmpty="as planned"
              options={campaign.threats.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))}
              onChange={(v) => patchItem('runs', run.id, { actualThreatId: v })}
            />
            <SelectField
              label="Actual condition"
              value={run.actualConditionId}
              allowEmpty="as planned"
              options={campaign.conditions.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))}
              onChange={(v) => patchItem('runs', run.id, { actualConditionId: v })}
            />
          </div>
          <TextField
            label="What actually ran, when it differed"
            value={run.actualsNote}
            onChange={(v) => patchItem('runs', run.id, { actualsNote: v })}
          />
        </>
      )}

      <DataFilesChecklist card={card} run={run} />
      <SegChips
        label="First look at the data"
        help={HINTS['initial-data-quality'].definition}
        options={INITIAL_DATA_QUALITY.map((v) => ({ v, label: v }))}
        value={run.initialDataQuality === '' ? null : run.initialDataQuality}
        allowCustom
        onChange={(v) => patchItem('runs', run.id, { initialDataQuality: (v as string | null) ?? '' })}
      />

      <div className="panel-subtitle">
        Does this run count?
        <span className="help-dot" tabIndex={0} data-help={HELP['run-validity']}>
          ?
        </span>
      </div>
      <div className="field">
        <span>Validity</span>
        <Seg
          value={validity}
          options={(['pending', 'valid', 'conditionally-valid', 'invalid'] as TeRunValidity[]).map((v) => ({
            v,
            label: VALIDITY_LABEL[v],
          }))}
          onChange={setValidity}
        />
      </div>
      {validity !== 'pending' && (
        <>
          {validity === 'conditionally-valid' && (
            <>
              <MultiPicker
                label="Allowed measures"
                help={HELP['conditionally-valid']}
                options={(card?.measureIds ?? []).map((id) => {
                  const m = campaign.measures.find((x) => x.id === id)
                  return { id, label: m ? `${m.id}: ${m.name || 'unnamed'}` : id }
                })}
                value={run.allowedMeasureIds}
                onChange={(v) => patchItem('runs', run.id, { allowedMeasureIds: v })}
              />
              <TextField
                label="What must this data never be used to claim?"
                value={run.prohibitedUses}
                onChange={(v) => patchItem('runs', run.id, { prohibitedUses: v })}
              />
              {card && card.prohibitedConclusion.trim() !== '' && run.prohibitedUses.trim() === '' && (
                <div className="provenance-line">
                  <span className="provenance-chip">from {card.cardCode}</span>
                  <button
                    type="button"
                    className="mini"
                    onClick={() => patchItem('runs', run.id, { prohibitedUses: card.prohibitedConclusion })}
                  >
                    Use card prohibited conclusion
                  </button>
                </div>
              )}
              <TextField label="Limits" value={run.limits} onChange={(v) => patchItem('runs', run.id, { limits: v })} />
            </>
          )}
          <div className="field-row">
            <PersonPicker
              label="Adjudicator"
              value={by}
              onChange={setBy}
              people={people}
              prefillSource={by !== '' && by === validityHolder ? 'decision rights: run validity' : undefined}
            />
            <TextField label="Reason" value={reason} onChange={setReason} />
          </div>
        </>
      )}

      <StageReview
        title="Run review"
        rows={[
          { label: 'Card', value: card ? `${card.cardCode} ${run.cardVersion}` : run.cardId },
          {
            label: 'Planned vs actual',
            value: hasOverride
              ? [
                  run.actualConfigId !== null ? `config: ${name(campaign.configs, run.actualConfigId)}` : null,
                  run.actualThreatId !== null ? `threat: ${name(campaign.threats, run.actualThreatId)}` : null,
                  run.actualConditionId !== null ? `condition: ${name(campaign.conditions, run.actualConditionId)}` : null,
                  run.actualsNote.trim() !== '' ? run.actualsNote : null,
                ]
                  .filter((t) => t !== null)
                  .join(' · ') || 'differed'
              : 'as planned',
          },
          {
            label: 'Records',
            value: `${run.events.length} event(s) · ${deviationCount} deviation(s) · ${openAnomalies} anomaly open`,
          },
          { label: 'Data files', value: files.total === 0 ? 'none required' : `${files.got} of ${files.total} received` },
          { label: 'Validity choice', value: VALIDITY_LABEL[validity] },
        ]}
        issues={issues}
        passLabel="Record adjudication"
        onPass={() => adjudicateRun(run.id, validity, by, reason)}
        onBack={() => selectRecord('runs', null)}
      />

      <TextField label="Exclusion reason" value={exclusionReason} onChange={setExclusionReason} />
      <CheckField
        label="Leave this run out of the counts"
        help="An accounting decision, not an adjudication."
        value={run.excluded}
        onChange={(v) => setRunExcluded(run.id, v, exclusionReason)}
        disabled={!run.excluded && !exclusionReason.trim()}
      />
      {run.adjudications.length > 0 && (
        <>
          <SubTitle>Adjudication history</SubTitle>
          {run.adjudications.map((a) => (
            <div key={a.version} className="muted small">
              v{a.version} · {fmtDate(a.at)} · {a.by || 'unnamed'} · {a.validity} · {a.reason || 'no reason'}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

/**
 * Qualify stage decision groups Q0-Q10 (strategist SPEC section 1.1).
 * Every control writes the existing schema field; builders render into the
 * stored strings and never parse legacy prose destructively. Derived fills
 * run on user triggers only; gate fields confirm before write.
 */

import { useEffect, useRef, useState } from 'react'
import type {
  AuthorityStatus,
  CampaignCharter,
  CampaignRole,
  DecisionCharter,
  EngagementType,
  EvidenceLevel,
  IntervalMethod,
  RegisterKind,
  TeCampaign,
  ThresholdSource,
  ValkrynTasking,
} from '../model/types'
import { CAMPAIGN_ROLES, DECISION_TYPES, THRESHOLD_SOURCES } from '../model/types'
import { newId } from '../../model/types'
import { useTeStore } from '../state/teStore'
import { useStore } from '../../state/store'
import { deleteImpacts, qualificationBlockers } from '../validate'
import {
  AUTHORITY_LEAD_TIMES,
  CAMPAIGN_PRESETS,
  KNOWN_LIMIT_CATEGORIES,
  SCHEDULE_MILESTONES,
  SECURITY_CLASSES,
} from '../seed/constants'
import { MEASURE_DICTIONARY } from '../seed/measureDictionary'
import { HELP, HINTS, allPeople } from './help'
import {
  AdvancedDisclosure,
  CheckField,
  DateField,
  DecisionGroup,
  EntityPicker,
  ExampleHint,
  Field,
  NumberUnitField,
  PersonPicker,
  Pill,
  Provenance,
  RegisterTable,
  Seg,
  SegChips,
  SelectField,
  SentenceBuilder,
  StageReview,
  SubTitle,
  SuggestField,
  TextField,
} from './kit'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type GroupState = 'done' | 'partial' | 'empty'

function stateOf(done: boolean, partial: boolean): GroupState {
  return done ? 'done' : partial ? 'partial' : 'empty'
}

function patchCharter(c: TeCampaign, patch: Partial<CampaignCharter>) {
  useTeStore.getState().patchCampaign({ charter: { ...c.charter, ...patch } })
}

function patchDecision(c: TeCampaign, patch: Partial<DecisionCharter>) {
  useTeStore.getState().patchCampaign({ decision: { ...c.decision, ...patch } })
}

function patchAcceptance(c: TeCampaign, patch: Partial<CampaignCharter['acceptance']>) {
  patchCharter(c, { acceptance: { ...c.charter.acceptance, ...patch } })
}

/** Distinct organization strings stored anywhere in the T&E store. */
function allOrganizations(campaigns: TeCampaign[]): string[] {
  const out = new Set<string>()
  for (const c of campaigns) {
    for (const s of [
      c.charter.requestingOrganization,
      c.charter.acceptance.relyingOrganization,
      c.charter.sponsor,
    ]) {
      if (s.trim() !== '') out.add(s.trim())
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b))
}

function lines(v: string): string[] {
  return v
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

function fmtIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function todayIso(): string {
  return fmtIsoDate(new Date())
}

function addDaysIso(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  d.setDate(d.getDate() + days)
  return fmtIsoDate(d)
}

const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

/**
 * Charter people sync one way into the roles table (existing behavior kept):
 * the first non-empty value creates the matching roles row; later typing
 * fills it while its primary tracks the charter. Roles edits never write back.
 */
function setCharterPerson(
  campaign: TeCampaign,
  field: 'customerDecisionOwner' | 'evidenceAcceptanceAuthority' | 'deploymentStrategist',
  role: CampaignRole,
  v: string,
) {
  const ch = campaign.charter
  const prev = ch[field]
  const wasEmpty = prev.trim() === ''
  const row = campaign.roles.find((r) => r.role === role)
  let roles = campaign.roles
  if (!row) {
    if (wasEmpty && v.trim() !== '')
      roles = [...roles, { id: newId('role'), role, primary: v, backup: '' }]
  } else if (row.primary.trim() === '' || row.primary === prev) {
    roles = roles.map((r) => (r.id === row.id ? { ...r, primary: v } : r))
  }
  useTeStore.getState().patchCampaign({ charter: { ...ch, [field]: v }, roles })
}

// ---------------------------------------------------------------------------
// Line-backed register: structured rows that render into one stored string,
// one row per line, columns joined with " | ". Legacy prose parses into the
// first (or last, remainder-absorbing) column untouched. Rows live in local
// state so an empty just-added row survives; the string omits empty rows.
// ---------------------------------------------------------------------------

type LineRow = { id: string } & Record<string, string>

interface LineCol {
  key: string
  label: string
  kind?: 'text' | 'select' | 'person' | 'date'
  options?: string[]
  width?: string
}

function LineRegister({
  value,
  onChange,
  columns,
  addLabel,
  empty,
  seed,
}: {
  value: string
  onChange: (v: string) => void
  columns: LineCol[]
  addLabel: string
  empty?: string
  /** Rows shown when the stored string is empty; persist on first user edit. */
  seed?: string[][]
}) {
  const counter = useRef(0)
  const mk = () => `lr${counter.current++}`
  const parseRows = (v: string): LineRow[] =>
    lines(v).map((l) => {
      const parts = l.split('|').map((p) => p.trim())
      const row: LineRow = { id: mk() }
      columns.forEach((c, j) => {
        row[c.key] = j === columns.length - 1 ? parts.slice(j).join(' | ') : (parts[j] ?? '')
      })
      return row
    })
  const [rows, setRows] = useState<LineRow[]>(() => {
    const parsed = parseRows(value)
    if (parsed.length > 0 || !seed) return parsed
    return seed.map((cells) => {
      const row: LineRow = { id: mk() }
      columns.forEach((c, j) => {
        row[c.key] = cells[j] ?? ''
      })
      return row
    })
  })
  const emitted = useRef(value)
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value
      setRows(parseRows(value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const serialize = (rs: LineRow[]): string =>
    rs
      .map((r) => columns.map((c) => (r[c.key] ?? '').trim()))
      .filter((cells) => cells.some((x) => x !== ''))
      .map((cells) => {
        let last = cells.length
        while (last > 1 && cells[last - 1] === '') last--
        return cells.slice(0, last).join(' | ')
      })
      .join('\n')
  const commit = (rs: LineRow[]) => {
    setRows(rs)
    const s = serialize(rs)
    emitted.current = s
    onChange(s)
  }
  return (
    <RegisterTable<LineRow>
      columns={columns.map((c) => ({
        key: c.key,
        label: c.label,
        kind: c.kind ?? 'text',
        options: c.options,
        width: c.width,
      }))}
      rows={rows}
      onAdd={() => {
        const row: LineRow = { id: mk() }
        columns.forEach((c) => {
          row[c.key] = ''
        })
        commit([...rows, row])
      }}
      onPatch={(id, patch) =>
        commit(rows.map((r) => (r.id === id ? ({ ...r, ...patch } as LineRow) : r)))
      }
      onRemove={(id) => commit(rows.filter((r) => r.id !== id))}
      addLabel={addLabel}
      empty={empty}
    />
  )
}

// ---------------------------------------------------------------------------
// Value-with-unit over a stored string ("25 s"). Legacy prose that does not
// parse stays a plain text field, untouched.
// ---------------------------------------------------------------------------

const BASE_UNITS = ['s', 'm', 'nm', 'ft', '%', 'count']
const DICT_UNITS = [...new Set([...BASE_UNITS, ...MEASURE_DICTIONARY.map((e) => e.unit)])].filter(
  (u) => u.trim() !== '',
)

function NumUnitString({
  label,
  value,
  onChange,
  help,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  help?: string
}) {
  const [localUnit, setLocalUnit] = useState('s')
  const m = /^(-?\d+(?:\.\d+)?)\s*(.*)$/.exec(value.trim())
  const legacy = value.trim() !== '' && m == null
  if (legacy) return <TextField label={label} value={value} onChange={onChange} help={help} />
  const num = m ? Number(m[1]) : null
  const unit = m && m[2].trim() !== '' ? m[2].trim() : localUnit
  return (
    <NumberUnitField
      label={label}
      help={help}
      value={num}
      unit={unit}
      unitOptions={DICT_UNITS}
      onUnit={(u) => {
        setLocalUnit(u)
        if (num != null) onChange(`${num} ${u}`)
      }}
      onChange={(v) => onChange(v == null ? '' : `${v} ${unit}`)}
    />
  )
}

/** Threshold string with a source suffix: "90 % (source: accepted-baseline)". */
function ThresholdWithSource({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const srcMatch = /\s*\(source:\s*([^)]*)\)\s*$/.exec(value)
  const base = srcMatch ? value.slice(0, srcMatch.index).trim() : value
  const src = srcMatch ? srcMatch[1].trim() : ''
  const write = (b: string, s: string) =>
    onChange(s.trim() !== '' ? `${b.trim()} (source: ${s.trim()})` : b.trim())
  return (
    <>
      <NumUnitString label={label} value={base} onChange={(b) => write(b, src)} />
      <SelectField
        label="Threshold source"
        value={src === '' ? null : src}
        allowEmpty="not set"
        options={(src !== '' && !THRESHOLD_SOURCES.includes(src as ThresholdSource)
          ? [src, ...THRESHOLD_SOURCES]
          : [...THRESHOLD_SOURCES]
        ).map((v) => ({ v, label: v }))}
        onChange={(v) => write(base, v ?? '')}
      />
    </>
  )
}

/** "[measure] [comparator] [value unit]" builder over the stored string. */
function ResultBuilder({
  label,
  value,
  onChange,
  hintKey,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hintKey?: string
}) {
  const measures = MEASURE_DICTIONARY.map((e) => ({ id: e.name, label: e.name }))
  const [slots, setSlots] = useState({ measure: '', cmp: '', val: '' })
  const set = (key: string, v: string | number | null) =>
    setSlots((s) => ({ ...s, [key]: v == null ? '' : String(v) }))
  const render = () =>
    slots.measure !== '' && slots.cmp !== '' && slots.val.trim() !== ''
      ? `${slots.measure} ${slots.cmp} ${slots.val.trim()}`
      : ''
  return (
    <Field label={label}>
      <SentenceBuilder
        slots={[
          { kind: 'entity', key: 'measure', options: measures, value: slots.measure },
          {
            kind: 'select',
            key: 'cmp',
            options: ['at or above', 'below', 'within', 'outside'],
            value: slots.cmp,
          },
          { kind: 'text', key: 'val', placeholder: 'value unit', value: slots.val },
        ]}
        onSlot={set}
        render={render}
        value={value}
        onChange={onChange}
      />
      {hintKey && HINTS[hintKey] && <ExampleHint {...HINTS[hintKey]} />}
    </Field>
  )
}

// ---------------------------------------------------------------------------
// Q0 Start
// ---------------------------------------------------------------------------

export function StartGroup({ campaign }: { campaign: TeCampaign }) {
  const { patchCampaign, applyPreset, startFromCampaign } = useTeStore.getState()
  const campaigns = useTeStore((s) => s.campaigns)
  const [pickSource, setPickSource] = useState(false)
  const [pendingPreset, setPendingPreset] = useState<string | null>(null)
  const seeded = campaign.presetKey != null || campaign.sourceCampaignId != null
  const preset = CAMPAIGN_PRESETS.find((p) => p.key === campaign.presetKey)
  const source = campaigns.find((c) => c.id === campaign.sourceCampaignId)
  return (
    <DecisionGroup
      id="q0"
      question="Start from"
      state={stateOf(seeded, campaign.name.trim() !== '')}
      defaultOpen={!seeded}
    >
      <div className="field-row">
        <TextField label="Campaign name" value={campaign.name} onChange={(v) => patchCampaign({ name: v })} />
        <TextField
          label="Code"
          value={campaign.code}
          onChange={(v) => patchCampaign({ code: v })}
          disabled={Object.values(campaign.seq).some(n => n > 0)}
          help="Short code used inside record identifiers. Fixed after the first record is allocated."
        />
      </div>
      {seeded ? (
        <div className="provenance-line">
          <span className="provenance-chip">
            {source ? `structure from ${source.name}` : `seeded from ${preset?.label ?? campaign.presetKey}`}
          </span>
        </div>
      ) : (
        <>
          <SegChips
            label="Seed the campaign"
            options={CAMPAIGN_PRESETS.map((p) => ({ v: p.key, label: p.label, def: p.hint }))}
            value={null}
            onChange={(v) => {
              if (v == null || Array.isArray(v)) return
              if (v === 'previous-campaign' || v === 'regression-test') {
                // Both start from a structural copy; regression-test then
                // seeds its baseline repeat on the new campaign.
                setPendingPreset(v === 'regression-test' ? v : null)
                setPickSource(true)
              } else applyPreset(v)
            }}
          />
          {pickSource && (
            <EntityPicker
              label="Copy structure from"
              help="Copies people, registers, measures, threats, and schedule into a new campaign. Evidence never copies."
              options={campaigns
                .filter((c) => c.id !== campaign.id)
                .map((c) => ({ id: c.id, label: c.name, sub: c.code }))}
              value={null}
              onChange={(id) => {
                if (id == null) return
                const created = startFromCampaign(id)
                if (created != null && pendingPreset) applyPreset(pendingPreset)
              }}
            />
          )}
        </>
      )}
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q1 Intake
// ---------------------------------------------------------------------------

export function IntakeGroup({ campaign }: { campaign: TeCampaign }) {
  const campaigns = useTeStore((s) => s.campaigns)
  const ch = campaign.charter
  const orgs = allOrganizations(campaigns)
  const people = allPeople(campaign)
  const set = (patch: Partial<CampaignCharter>) => patchCharter(campaign, patch)
  const done = ch.exactRequest.trim() !== '' && ch.requestingOrganization.trim() !== ''
  const partial =
    [ch.exactRequest, ch.requestingOrganization, ch.sponsor, ch.dateReceived].some(
      (v) => v.trim() !== '',
    )
  return (
    <DecisionGroup id="q1" question="What did the customer ask for?" state={stateOf(done, partial)}>
      <TextField
        label="Exact request, their own words"
        rows={2}
        value={ch.exactRequest}
        onChange={(v) => set({ exactRequest: v })}
      />
      <ExampleHint {...HINTS['exact-request']} />
      <div className="field-row">
        <EntityPicker
          label="Requesting organization"
          options={orgs.map((o) => ({ id: o, label: o }))}
          allowFree
          freeValue={ch.requestingOrganization}
          onFree={(v) => set({ requestingOrganization: v })}
          onChange={() => {}}
        />
        <EntityPicker
          label="Sponsor"
          options={[...new Set([...orgs, ...people])].map((o) => ({ id: o, label: o }))}
          allowFree
          freeValue={ch.sponsor}
          onFree={(v) => set({ sponsor: v })}
          onChange={() => {}}
        />
      </div>
      <div className="field-row">
        <div>
          <DateField
            label="Date received"
            value={ch.dateReceived}
            onChange={(v) => set({ dateReceived: v ?? '' })}
          />
          {ch.dateReceived.trim() === '' && (
            <div className="provenance-line">
              <button type="button" className="mini" onClick={() => set({ dateReceived: todayIso() })}>
                Use today
              </button>
            </div>
          )}
        </div>
        <EntityPicker
          label="Contract and funding owner"
          options={[...new Set([...people, ...orgs])].map((o) => ({ id: o, label: o }))}
          allowFree
          freeValue={ch.contractAndFundingOwner}
          onFree={(v) => set({ contractAndFundingOwner: v })}
          onChange={() => {}}
        />
      </div>
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q2 Determination
// ---------------------------------------------------------------------------

const DETERMINATIONS: Array<{
  v: EngagementType
  label: string
  def: string
  tasking: ValkrynTasking
}> = [
  { v: 'comparison', label: 'Compare', def: 'Which option is better, and by how much.', tasking: 'compare' },
  { v: 'characterization', label: 'Characterize', def: 'How the system performs across conditions.', tasking: 'characterize' },
  { v: 'evaluation', label: 'Verify', def: 'Does the system meet a stated threshold.', tasking: 'validate' },
  { v: 'demonstration', label: 'Demonstrate', def: 'Show the capability under set conditions.', tasking: 'support-an-authority' },
  { v: 'experiment', label: 'Explore', def: 'Learn cause and effect. No pass or fail.', tasking: 'characterize' },
]

const TASKINGS: ValkrynTasking[] = [
  'recommend',
  'characterize',
  'validate',
  'compare',
  'support-an-authority',
]

function taskingFor(t: EngagementType): ValkrynTasking {
  return DETERMINATIONS.find((d) => d.v === t)?.tasking ?? 'characterize'
}

export function DeterminationGroup({ campaign }: { campaign: TeCampaign }) {
  const ch = campaign.charter
  const derived = taskingFor(ch.engagementType)
  const edited = ch.valkrynTasking !== derived
  return (
    <DecisionGroup
      id="q2"
      question="What is the customer asking us to determine?"
      hint={HINTS['engagement-type']?.definition}
      state="done"
    >
      <SegChips
        options={DETERMINATIONS.map((d) => ({ v: d.v, label: d.label, def: d.def }))}
        value={ch.engagementType}
        onChange={(v) => {
          if (v == null || Array.isArray(v)) return
          patchCharter(campaign, { engagementType: v, valkrynTasking: taskingFor(v) })
        }}
      />
      <Provenance
        source="the determination"
        state={edited ? 'edited' : 'inherited'}
        onRevert={() => patchCharter(campaign, { valkrynTasking: derived })}
      >
        <div className="muted small">Our task: {ch.valkrynTasking}</div>
      </Provenance>
      <AdvancedDisclosure label="Change the task">
        <SelectField
          label="Task"
          value={ch.valkrynTasking}
          options={TASKINGS.map((v) => ({ v, label: v }))}
          onChange={(v) => v && patchCharter(campaign, { valkrynTasking: v })}
        />
      </AdvancedDisclosure>
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q3 Mission
// ---------------------------------------------------------------------------

export function MissionGroup({ campaign }: { campaign: TeCampaign }) {
  const ch = campaign.charter
  const assets = useStore((s) => s.scenario.entities)
    .filter((e) => e.kind === 'asset')
    .map((e) => ({ id: e.name, label: e.name }))
  const [slots, setSlots] = useState({ asset: '', effect: '' })
  const set = (key: string, v: string | number | null) =>
    setSlots((s) => ({ ...s, [key]: v == null ? '' : String(v) }))
  const render = () =>
    slots.asset.trim() !== '' && slots.effect.trim() !== ''
      ? `Protect ${slots.asset.trim()} so that ${slots.effect.trim()} continues.`
      : ''
  return (
    <DecisionGroup
      id="q3"
      question="What are we protecting, and what must keep working?"
      hint="Mission and protected outcome."
      tier="recommended"
      state={stateOf(ch.missionAndProtectedOutcome.trim() !== '', false)}
    >
      <SentenceBuilder
        slots={[
          { kind: 'literal', text: 'Protect' },
          assets.length > 0
            ? { kind: 'entity', key: 'asset', options: assets, value: slots.asset }
            : { kind: 'text', key: 'asset', placeholder: 'asset', value: slots.asset },
          { kind: 'literal', text: 'so that' },
          { kind: 'text', key: 'effect', placeholder: 'mission effect', value: slots.effect },
          { kind: 'literal', text: 'continues.' },
        ]}
        onSlot={set}
        render={render}
        value={ch.missionAndProtectedOutcome}
        onChange={(v) => patchCharter(campaign, { missionAndProtectedOutcome: v })}
      />
      {assets.length > 0 && (
        <p className="muted small">Assets come from the board scenario.</p>
      )}
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q4 Decision
// ---------------------------------------------------------------------------

export function DecisionGroupQ4({ campaign }: { campaign: TeCampaign }) {
  const ch = campaign.charter
  const d = campaign.decision
  const people = allPeople(campaign)
  const setD = (patch: Partial<DecisionCharter>) => patchDecision(campaign, patch)
  const setC = (patch: Partial<CampaignCharter>) => patchCharter(campaign, patch)
  const unknowns = campaign.registers
    .filter((r) => r.kind === 'unknown')
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  const altLines = lines(d.alternatives).map((l) => l.split('|')[0].trim())
  const [choiceSlots, setChoiceSlots] = useState({ a: '', b: '', purpose: '' })
  const setChoice = (key: string, v: string | number | null) =>
    setChoiceSlots((s) => ({ ...s, [key]: v == null ? '' : String(v) }))
  const renderChoice = () =>
    choiceSlots.a.trim() !== '' && choiceSlots.b.trim() !== ''
      ? `Choose between ${choiceSlots.a.trim()} and ${choiceSlots.b.trim()}${
          choiceSlots.purpose.trim() !== '' ? ` for ${choiceSlots.purpose.trim()}` : ''
        }.`
      : ''
  const altOpts = altLines.map((l) => ({ id: l, label: l }))
  const done =
    d.decisionDate.trim() !== '' && d.boundedChoice.trim() !== '' && d.blockingUncertainty.trim() !== ''
  const partial = [d.decisionDate, d.boundedChoice, d.blockingUncertainty, d.alternatives].some(
    (v) => v.trim() !== '',
  )
  const decisionDateMatchesRequested = d.decisionDate.trim() === ch.requestedDecisionDate.trim()
  return (
    <DecisionGroup
      id="q4"
      question="What choice must the decision owner make, and when?"
      hint={HELP['qualification-gate']}
      tier="required"
      state={stateOf(done, partial)}
    >
      <Field label="What exact choice must they make?">
        <SentenceBuilder
          slots={[
            { kind: 'literal', text: 'Choose between' },
            altOpts.length > 0
              ? { kind: 'entity', key: 'a', options: altOpts, value: choiceSlots.a }
              : { kind: 'text', key: 'a', placeholder: 'option A', value: choiceSlots.a },
            { kind: 'literal', text: 'and' },
            altOpts.length > 0
              ? { kind: 'entity', key: 'b', options: altOpts, value: choiceSlots.b }
              : { kind: 'text', key: 'b', placeholder: 'option B', value: choiceSlots.b },
            { kind: 'literal', text: 'for' },
            { kind: 'text', key: 'purpose', placeholder: 'purpose', value: choiceSlots.purpose },
          ]}
          onSlot={setChoice}
          render={renderChoice}
          value={d.boundedChoice}
          onChange={(v) => setD({ boundedChoice: v })}
        />
        <ExampleHint {...HINTS['bounded-choice']} />
      </Field>
      <Field label="What are the options?" help="Keep delay and no action on the list.">
        <LineRegister
          value={d.alternatives}
          onChange={(v) => setD({ alternatives: v })}
          columns={[{ key: 'option', label: 'Option' }]}
          addLabel="Add option"
          empty="No options yet. Add option."
          seed={[['delay'], ['no action']]}
        />
      </Field>
      {unknowns.length > 0 ? (
        <EntityPicker
          label="What unknown blocks that choice today?"
          help="Blocking uncertainty. Pick from the unknown register; top rank first."
          options={unknowns.map((u) => ({
            id: u.id,
            label: u.statement.slice(0, 64) || u.id,
            sub: u.rank != null ? `rank ${u.rank}` : undefined,
          }))}
          allowFree
          freeValue={d.blockingUncertainty}
          onFree={(v) => setD({ blockingUncertainty: v })}
          onChange={(id) => {
            const u = unknowns.find((x) => x.id === id)
            if (u) setD({ blockingUncertainty: u.statement })
          }}
        />
      ) : (
        <>
          <TextField
            label="What unknown blocks that choice today?"
            rows={2}
            value={d.blockingUncertainty}
            onChange={(v) => setD({ blockingUncertainty: v })}
            help="Blocking uncertainty."
          />
          <ExampleHint {...HINTS['blocking-uncertainty']} />
        </>
      )}
      <div className="field-row">
        <DateField
          label="When does the customer need the decision?"
          value={ch.requestedDecisionDate}
          onChange={(v) => setC({ requestedDecisionDate: v ?? '' })}
        />
        {d.decisionDate.trim() === '' && ch.requestedDecisionDate.trim() !== '' ? (
          <Provenance
            source="requested date"
            state="pending"
            onConfirm={() => setD({ decisionDate: ch.requestedDecisionDate })}
          >
            <Field label="Decision date">
              <input value={ch.requestedDecisionDate} readOnly />
            </Field>
          </Provenance>
        ) : d.decisionDate.trim() !== '' && ch.requestedDecisionDate.trim() !== '' ? (
          <Provenance
            source="requested date"
            state={decisionDateMatchesRequested ? 'inherited' : 'edited'}
            onRevert={() => setD({ decisionDate: ch.requestedDecisionDate })}
          >
            <DateField
              label="Decision date"
              value={d.decisionDate}
              onChange={(v) => setD({ decisionDate: v ?? '' })}
            />
          </Provenance>
        ) : (
          <DateField
            label="Decision date"
            value={d.decisionDate}
            onChange={(v) => {
              const next = v ?? ''
              setD({ decisionDate: next })
              if (ch.requestedDecisionDate.trim() === '' && next !== '')
                setC({ requestedDecisionDate: next })
            }}
          />
        )}
      </div>
      {isIso(d.decisionDate) && (
        <div className="field-row">
          {ch.deliverablesDate.trim() === '' ? (
            <Provenance
              source="decision date - 14 days"
              state="pending"
              onConfirm={() => setC({ deliverablesDate: addDaysIso(d.decisionDate, -14) })}
            >
              <Field label="Deliverables date">
                <input value={addDaysIso(d.decisionDate, -14)} readOnly />
              </Field>
            </Provenance>
          ) : (
            <DateField
              label="Deliverables date"
              value={ch.deliverablesDate}
              onChange={(v) => setC({ deliverablesDate: v ?? '' })}
            />
          )}
          {d.latestAcceptedEvidenceDate.trim() === '' ? (
            <Provenance
              source="decision date - 28 days"
              state="pending"
              onConfirm={() => setD({ latestAcceptedEvidenceDate: addDaysIso(d.decisionDate, -28) })}
            >
              <Field label="Latest accepted-evidence date" help="Evidence after this date cannot reach the decision.">
                <input value={addDaysIso(d.decisionDate, -28)} readOnly />
              </Field>
            </Provenance>
          ) : (
            <DateField
              label="Latest accepted-evidence date"
              value={d.latestAcceptedEvidenceDate}
              onChange={(v) => setD({ latestAcceptedEvidenceDate: v ?? '' })}
              help="Evidence after this date cannot reach the decision."
            />
          )}
        </div>
      )}
      {!isIso(d.decisionDate) && (
        <div className="field-row">
          <DateField
            label="Deliverables date"
            value={ch.deliverablesDate}
            onChange={(v) => setC({ deliverablesDate: v ?? '' })}
          />
          <DateField
            label="Latest accepted-evidence date"
            value={d.latestAcceptedEvidenceDate}
            onChange={(v) => setD({ latestAcceptedEvidenceDate: v ?? '' })}
          />
        </div>
      )}
      <div className="field-row">
        <TextField label="Action after the test" value={d.postTestAction} onChange={(v) => setD({ postTestAction: v })} />
        <PersonPicker label="Action authority" value={d.actionAuthority} onChange={(v) => setD({ actionAuthority: v })} people={people} />
      </div>
      <TextField
        label="What happens if the customer does nothing?"
        value={d.consequenceOfNoAction}
        onChange={(v) => setD({ consequenceOfNoAction: v })}
      />
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q5 People and authority
// ---------------------------------------------------------------------------

type RoleRow = { id: string; role: string; primary: string; backup: string }

export function PeopleGroup({ campaign }: { campaign: TeCampaign }) {
  const { addItem, patchItem, removeItem } = useTeStore.getState()
  const campaigns = useTeStore((s) => s.campaigns)
  const ch = campaign.charter
  const d = campaign.decision
  const people = allPeople(campaign)
  const orgs = allOrganizations(campaigns)
  const ownerMatches = d.authorizedDecisionOwner.trim() === ch.customerDecisionOwner.trim()
  const relyingMatches =
    ch.acceptance.relyingOrganization.trim() === ch.requestingOrganization.trim()
  const done =
    d.authorizedDecisionOwner.trim() !== '' && ch.acceptance.relyingOrganization.trim() !== ''
  const partial = [
    ch.customerDecisionOwner,
    ch.evidenceAcceptanceAuthority,
    ch.deploymentStrategist,
    ch.acceptance.methodApprovalAuthority,
  ].some((v) => v.trim() !== '')
  return (
    <DecisionGroup
      id="q5"
      question="Who owns the decision, and who accepts the evidence?"
      tier="required"
      state={stateOf(done, partial)}
    >
      <div className="field-row">
        <PersonPicker
          label="Decision owner"
          help={HELP['qualification-gate']}
          value={ch.customerDecisionOwner}
          onChange={(v) =>
            setCharterPerson(campaign, 'customerDecisionOwner', 'customer-decision-owner', v)
          }
          people={people}
        />
        <PersonPicker
          label="Evidence acceptance authority"
          value={ch.evidenceAcceptanceAuthority}
          onChange={(v) =>
            setCharterPerson(
              campaign,
              'evidenceAcceptanceAuthority',
              'evidence-acceptance-authority',
              v,
            )
          }
          people={people}
        />
      </div>
      {d.authorizedDecisionOwner.trim() === '' && ch.customerDecisionOwner.trim() !== '' ? (
        <Provenance
          source="decision owner"
          state="pending"
          onConfirm={() => patchDecision(campaign, { authorizedDecisionOwner: ch.customerDecisionOwner })}
        >
          <Field label="Authorized decision owner">
            <input value={ch.customerDecisionOwner} readOnly />
          </Field>
        </Provenance>
      ) : d.authorizedDecisionOwner.trim() !== '' && ch.customerDecisionOwner.trim() !== '' ? (
        <Provenance
          source="decision owner"
          state={ownerMatches ? 'inherited' : 'edited'}
          onRevert={() => patchDecision(campaign, { authorizedDecisionOwner: ch.customerDecisionOwner })}
        >
          <PersonPicker
            label="Authorized decision owner"
            value={d.authorizedDecisionOwner}
            onChange={(v) => patchDecision(campaign, { authorizedDecisionOwner: v })}
            people={people}
          />
        </Provenance>
      ) : (
        <PersonPicker
          label="Authorized decision owner"
          value={d.authorizedDecisionOwner}
          onChange={(v) => patchDecision(campaign, { authorizedDecisionOwner: v })}
          people={people}
        />
      )}
      <div className="field-row">
        <PersonPicker
          label="Deployment strategist"
          value={ch.deploymentStrategist}
          onChange={(v) =>
            setCharterPerson(campaign, 'deploymentStrategist', 'deployment-strategist', v)
          }
          people={people}
        />
        <PersonPicker
          label="Method approval authority"
          value={ch.acceptance.methodApprovalAuthority}
          onChange={(v) => patchAcceptance(campaign, { methodApprovalAuthority: v })}
          people={people}
        />
      </div>
      {ch.acceptance.relyingOrganization.trim() === '' && ch.requestingOrganization.trim() !== '' ? (
        <Provenance
          source="requesting organization"
          state="pending"
          onConfirm={() =>
            patchAcceptance(campaign, { relyingOrganization: ch.requestingOrganization })
          }
        >
          <Field label="Relying organization" help={HINTS['relying-organization']?.why}>
            <input value={ch.requestingOrganization} readOnly />
          </Field>
        </Provenance>
      ) : (
        <div>
          <EntityPicker
            label="Relying organization"
            help={HINTS['relying-organization']?.definition}
            options={orgs.map((o) => ({ id: o, label: o }))}
            allowFree
            freeValue={ch.acceptance.relyingOrganization}
            onFree={(v) => patchAcceptance(campaign, { relyingOrganization: v })}
            onChange={() => {}}
          />
          {ch.acceptance.relyingOrganization.trim() !== '' &&
            ch.requestingOrganization.trim() !== '' && (
              <div className="provenance-line">
                <span className="provenance-chip">
                  {relyingMatches ? 'from requesting organization' : 'edited'}
                </span>
              </div>
            )}
        </div>
      )}
      <PersonPicker
        label="Required witnesses and reviewers"
        value={ch.acceptance.requiredWitnesses}
        onChange={(v) => patchAcceptance(campaign, { requiredWitnesses: v })}
        people={people}
        multi
      />
      <AdvancedDisclosure label="All campaign roles">
        <p className="muted small">Names above fill their matching row. Edits here never write back.</p>
        <RegisterTable<RoleRow>
          columns={[
            { key: 'role', label: 'Role', kind: 'select', options: [...CAMPAIGN_ROLES] },
            { key: 'primary', label: 'Primary', kind: 'person', options: people },
            { key: 'backup', label: 'Backup', kind: 'person', options: people },
          ]}
          rows={campaign.roles.map((r) => ({
            id: r.id,
            role: r.role,
            primary: r.primary,
            backup: r.backup,
          }))}
          onAdd={() =>
            addItem('roles', { id: newId('role'), role: 'test-conductor', primary: '', backup: '' })
          }
          onPatch={(id, patch) => {
            const p: Partial<TeCampaign['roles'][number]> = {}
            if (patch.role !== undefined) p.role = patch.role as CampaignRole
            if (patch.primary !== undefined) p.primary = patch.primary
            if (patch.backup !== undefined) p.backup = patch.backup
            patchItem('roles', id, p)
          }}
          onRemove={(id) => removeItem('roles', id)}
          addLabel="Add role"
          empty="No roles yet. Add role."
        />
      </AdvancedDisclosure>
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q6 Sufficient evidence
// ---------------------------------------------------------------------------

const INTERVAL_METHODS: IntervalMethod[] = ['wilson', 'exact', 'bayes']
const FIDELITY_TERMS = ['live', 'live-virtual', 'hardware-in-the-loop', 'simulation']
const COMMON_ACTIONS = ['proceed', 'delay', 'no action', 'repeat the test', 'narrow the claim']

export function EvidenceGroup({ campaign }: { campaign: TeCampaign }) {
  const ch = campaign.charter
  const d = campaign.decision
  const setD = (patch: Partial<DecisionCharter>) => patchDecision(campaign, patch)
  const engagement = ch.engagementType
  const measureNames = [
    ...new Set([...campaign.measures.map((m) => m.name), ...MEASURE_DICTIONARY.map((e) => e.name)]),
  ].filter((n) => n.trim() !== '')
  const [ev, setEv] = useState<{ n: number | null; measure: string; interval: string; fidelity: string }>(
    { n: null, measure: '', interval: '', fidelity: '' },
  )
  const evidenceSentence =
    ev.n != null && ev.measure !== '' && ev.interval !== '' && ev.fidelity !== ''
      ? `${ev.n} valid repetitions of ${ev.measure} at ${ev.interval} confidence in ${ev.fidelity} fidelity.`
      : ''
  const applyEvidence = () => {
    if (evidenceSentence === '') return
    const strength = `${ev.n} valid repetitions at ${ev.interval} confidence.`
    useTeStore.getState().patchCampaign({
      charter: {
        ...ch,
        successCriteria: evidenceSentence,
        acceptance: { ...ch.acceptance, evidenceStandard: evidenceSentence },
      },
      decision: { ...d, acceptanceConditions: evidenceSentence, requiredEvidenceStrength: strength },
    })
  }
  const altSuggestions = [...lines(d.alternatives).map((l) => l.split('|')[0].trim()), ...COMMON_ACTIONS]
  const mmdField = (
    <div>
      <NumUnitString
        label="How big a change matters?"
        help={HINTS['minimum-meaningful-difference']?.definition}
        value={d.minimumMeaningfulDifference}
        onChange={(v) => setD({ minimumMeaningfulDifference: v })}
      />
      {HINTS['minimum-meaningful-difference'] && (
        <ExampleHint {...HINTS['minimum-meaningful-difference']} example="25 s warning time" illustrative />
      )}
    </div>
  )
  const thresholdField = (
    <div>
      <ThresholdWithSource
        label="What value counts as good enough?"
        value={d.acceptableThreshold}
        onChange={(v) => setD({ acceptableThreshold: v })}
      />
      {HINTS['acceptable-threshold'] && <ExampleHint {...HINTS['acceptable-threshold']} />}
    </div>
  )
  const done = d.acceptanceConditions.trim() !== ''
  const partial = [
    ch.successCriteria,
    ch.acceptance.evidenceStandard,
    d.requiredEvidenceStrength,
    d.resultThatChangesChoice,
  ].some((v) => v.trim() !== '')
  return (
    <DecisionGroup
      id="q6"
      question="What evidence ends this campaign with a usable answer?"
      hint="Success criteria, evidence standard, acceptance conditions, and evidence strength. One builder writes all four."
      tier="required"
      state={stateOf(done, partial)}
    >
      <Field label="Sufficient evidence" help={HINTS['evidence-builder']?.definition}>
        <div className="sentence-builder">
          <div className="sb-slots">
            <span className="sb-number">
              <input
                type="number"
                value={ev.n ?? ''}
                aria-label="Repetitions"
                onChange={(e) => setEv((s) => ({ ...s, n: e.target.value === '' ? null : Number(e.target.value) }))}
              />
            </span>
            <span className="sb-literal">valid repetitions of</span>
            <select
              value={ev.measure}
              aria-label="Measure"
              onChange={(e) => setEv((s) => ({ ...s, measure: e.target.value }))}
            >
              <option value="">…</option>
              {measureNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="sb-literal">at</span>
            <select
              value={ev.interval}
              aria-label="Interval method"
              onChange={(e) => setEv((s) => ({ ...s, interval: e.target.value }))}
            >
              <option value="">…</option>
              {INTERVAL_METHODS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="sb-literal">confidence in</span>
            <select
              value={ev.fidelity}
              aria-label="Fidelity"
              onChange={(e) => setEv((s) => ({ ...s, fidelity: e.target.value }))}
            >
              <option value="">…</option>
              {FIDELITY_TERMS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="sb-literal">fidelity.</span>
            <button type="button" className="mini" disabled={evidenceSentence === ''} onClick={applyEvidence}>
              Apply to all four fields
            </button>
          </div>
        </div>
      </Field>
      <ExampleHint {...HINTS['evidence-builder']} />
      <TextField
        label="What must be true before the customer trusts the evidence?"
        rows={2}
        value={d.acceptanceConditions}
        onChange={(v) => setD({ acceptanceConditions: v })}
        help="Acceptance conditions. Gate field."
      />
      {(engagement === 'comparison' || engagement === 'evaluation' || engagement === 'demonstration') && (
        <div className="field-row">{engagement === 'comparison' ? mmdField : thresholdField}</div>
      )}
      <ResultBuilder
        label="What result would change the pick?"
        value={d.resultThatChangesChoice}
        onChange={(v) => setD({ resultThatChangesChoice: v })}
      />
      <ResultBuilder
        label="What result would leave the pick unchanged?"
        value={d.resultThatDoesNot}
        onChange={(v) => setD({ resultThatDoesNot: v })}
      />
      <CheckField
        label="Customer can accept unfavorable evidence"
        value={d.canAcceptUnfavorableEvidence}
        onChange={(v) => setD({ canAcceptUnfavorableEvidence: v })}
        help="A campaign the customer can only hear good news from is a demonstration, not a test."
      />
      <TextField
        label="What would make them reject the evidence?"
        rows={2}
        value={ch.acceptance.rejectionConditions}
        onChange={(v) => patchAcceptance(campaign, { rejectionConditions: v })}
      />
      <AdvancedDisclosure label="Action map and stored fields">
        <Field label="Decision action per outcome" help={HINTS['action-map']?.definition}>
          <div className="field-row">
            <SuggestField label="If met" value={d.actionOnMeet} onChange={(v) => setD({ actionOnMeet: v })} suggestions={altSuggestions} />
            <SuggestField label="If missed" value={d.actionOnMiss} onChange={(v) => setD({ actionOnMiss: v })} suggestions={altSuggestions} />
          </div>
          <div className="field-row">
            <SuggestField label="If mixed" value={d.actionOnMixed} onChange={(v) => setD({ actionOnMixed: v })} suggestions={altSuggestions} />
            <SuggestField label="If inconclusive" value={d.actionOnInconclusive} onChange={(v) => setD({ actionOnInconclusive: v })} suggestions={altSuggestions} />
          </div>
        </Field>
        {engagement !== 'comparison' && mmdField}
        {engagement !== 'evaluation' && engagement !== 'demonstration' && thresholdField}
        <TextField
          label="Success criteria"
          rows={2}
          value={ch.successCriteria}
          onChange={(v) => patchCharter(campaign, { successCriteria: v })}
        />
        <TextField
          label="Evidence standard"
          rows={2}
          value={ch.acceptance.evidenceStandard}
          onChange={(v) => patchAcceptance(campaign, { evidenceStandard: v })}
        />
        <TextField
          label="Evidence strength"
          value={d.requiredEvidenceStrength}
          onChange={(v) => setD({ requiredEvidenceStrength: v })}
        />
      </AdvancedDisclosure>
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q7 Scope and limits
// ---------------------------------------------------------------------------

const MISSION_FUNCTIONS = ['detect', 'track', 'identify', 'defeat', 'assess']
const EVIDENCE_LEVELS: EvidenceLevel[] = [
  'component-behavior',
  'interface-behavior',
  'mission-conditions',
  'end-to-end-mission-effect',
]
const CONDITION_CLASSES = ['day', 'night', 'adverse weather', 'contested spectrum']
const SCOPE_CHIPS = [...MISSION_FUNCTIONS, ...EVIDENCE_LEVELS, ...CONDITION_CLASSES]

export function ScopeGroup({ campaign }: { campaign: TeCampaign }) {
  const { addItem } = useTeStore.getState()
  const campaigns = useTeStore((s) => s.campaigns)
  const ch = campaign.charter
  const set = (patch: Partial<CampaignCharter>) => patchCharter(campaign, patch)
  const [openCats, setOpenCats] = useState<string[]>([])

  const scopeLines = lines(ch.includedScope)
  const scopeSelected = scopeLines.filter((l) => SCOPE_CHIPS.includes(l))
  const scopeNote = scopeLines.filter((l) => !SCOPE_CHIPS.includes(l)).join('\n')
  const writeScope = (chips: string[], note: string) =>
    set({ includedScope: [...chips, ...lines(note)].join('\n') })

  const limitLines = lines(ch.knownLimits)
  const limitFor = (cat: string) =>
    limitLines.find((l) => l.toLowerCase().startsWith(`${cat.toLowerCase()}:`))
  const writeLimit = (cat: string, text: string) => {
    const rest = limitLines.filter((l) => !l.toLowerCase().startsWith(`${cat.toLowerCase()}:`))
    const next = text.trim() === '' ? rest : [...rest, `${cat}: ${text.trim()}`]
    set({ knownLimits: next.join('\n') })
  }
  const addAsFeasibility = (line: string) => {
    if (campaign.feasibility.some((f) => f.item.trim() === line.trim())) return
    addItem('feasibility', {
      id: newId('fea'),
      item: line,
      score: 'unresolved',
      owner: '',
      fallback: '',
      effectOnConclusions: '',
    })
  }
  const priorSites = [
    ...new Set(
      campaigns.map((c) => c.charter.plannedSitesAndDates.trim()).filter((s) => s !== ''),
    ),
  ]
  const securityOptions = (
    ch.dataSecurityReleaseClass && !SECURITY_CLASSES.includes(ch.dataSecurityReleaseClass)
      ? [ch.dataSecurityReleaseClass, ...SECURITY_CLASSES]
      : SECURITY_CLASSES
  ).map((v) => ({ v, label: v }))
  const done = ch.includedScope.trim() !== '' && ch.excludedScope.trim() !== ''
  const partial = [ch.includedScope, ch.excludedScope, ch.knownLimits, ch.minimumViableCampaign].some(
    (v) => v.trim() !== '',
  )
  return (
    <DecisionGroup
      id="q7"
      question="What is in, what is out, and what limits us?"
      tier="recommended"
      state={stateOf(done, partial)}
    >
      <SegChips
        label="In scope"
        options={SCOPE_CHIPS.map((v) => ({ v, label: v }))}
        value={scopeSelected}
        multi
        allowCustom
        onChange={(v) => writeScope(Array.isArray(v) ? v : v == null ? [] : [v], scopeNote)}
      />
      <TextField
        label="Scope note"
        value={scopeNote}
        onChange={(v) => writeScope(scopeSelected, v)}
      />
      <Field label="Out of scope" help="Each exclusion states what the results then cannot say.">
        <LineRegister
          value={ch.excludedScope}
          onChange={(v) => set({ excludedScope: v })}
          columns={[
            { key: 'exclusion', label: 'Exclusion' },
            { key: 'cannotSay', label: 'Results cannot say' },
          ]}
          addLabel="Add exclusion"
          empty="No exclusions yet. Add exclusion."
        />
      </Field>
      <TextField
        label="What is the smallest test that still supports the decision?"
        rows={2}
        value={ch.minimumViableCampaign}
        onChange={(v) => set({ minimumViableCampaign: v })}
        help="Minimum viable campaign. Drives drop order in Design."
      />
      <Field label="Known limits" help={HINTS['known-limits']?.definition}>
        <div className="te-chips">
          {KNOWN_LIMIT_CATEGORIES.map((cat) => {
            const filled = limitFor(cat) != null
            const open = openCats.includes(cat) || filled
            return (
              <button
                key={cat}
                type="button"
                className={`card-chip ${filled ? 'active' : ''}`}
                aria-pressed={open}
                onClick={() =>
                  setOpenCats((cs) => (cs.includes(cat) ? cs.filter((x) => x !== cat) : [...cs, cat]))
                }
              >
                {cat}
              </button>
            )
          })}
        </div>
        {KNOWN_LIMIT_CATEGORIES.filter((cat) => openCats.includes(cat) || limitFor(cat) != null).map(
          (cat) => {
            const line = limitFor(cat)
            const text = line ? line.slice(line.indexOf(':') + 1).trim() : ''
            const asFeasibility = line != null && !campaign.feasibility.some((f) => f.item.trim() === line.trim())
            return (
              <div key={cat} className="field-row">
                <TextField label={cat} value={text} onChange={(v) => writeLimit(cat, v)} />
                {asFeasibility && (
                  <button type="button" className="mini" onClick={() => addAsFeasibility(line)}>
                    Add as feasibility item
                  </button>
                )}
              </div>
            )
          },
        )}
        <ExampleHint {...HINTS['known-limits']} />
      </Field>
      <div className="field-row">
        <EntityPicker
          label="Planned sites and dates"
          options={priorSites.map((s) => ({ id: s, label: s }))}
          allowFree
          freeValue={ch.plannedSitesAndDates}
          onFree={(v) => set({ plannedSitesAndDates: v })}
          onChange={() => {}}
        />
        <div>
          <SelectField
            label="Data security release class"
            value={ch.dataSecurityReleaseClass || null}
            allowEmpty="not set"
            options={securityOptions}
            onChange={(v) => set({ dataSecurityReleaseClass: v ?? '' })}
            help={HELP['security-class']}
          />
          {ch.dataSecurityReleaseClass.trim() === '' && (
            <div className="provenance-line">
              <span className="provenance-chip">CUI is the doctrine floor</span>
              <button type="button" className="mini" onClick={() => set({ dataSecurityReleaseClass: 'CUI' })}>
                Set CUI
              </button>
            </div>
          )}
        </div>
      </div>
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q8 Registers
// ---------------------------------------------------------------------------

const REGISTER_KINDS: Array<{ v: RegisterKind; label: string }> = [
  { v: 'assumption', label: 'Assumptions' },
  { v: 'claim', label: 'Claims' },
  { v: 'unknown', label: 'Unknowns' },
  { v: 'known-fact', label: 'Known facts' },
]

const CLAIM_DISPOSITIONS = [
  'supported',
  'contradicted',
  'directionally-supported',
  'inconclusive',
  'untested',
  'outside-scope',
]

type RegisterRow = {
  id: string
  statement: string
  sourceAndDate: string
  relevance: string
  disposition: string
  notes: string
}

/**
 * The assumption register is the entry point; the charter string derives from
 * it. The derivation only overwrites the stored text once every legacy line
 * has been imported, so old prose never silently disappears.
 */
function syncAssumptionText() {
  const st = useTeStore.getState()
  const c = st.campaigns.find((x) => x.id === st.activeCampaignId)
  if (!c) return
  const statements = c.registers
    .filter((r) => r.kind === 'assumption')
    .map((r) => r.statement.trim())
    .filter((s) => s !== '')
  const stmtSet = new Set(statements)
  const unimported = lines(c.charter.majorAssumptions).filter((l) => !stmtSet.has(l))
  if (unimported.length > 0 && c.charter.majorAssumptions.trim() !== '') {
    // Legacy lines still pending import; leave the stored text alone.
    const known = lines(c.charter.majorAssumptions)
    const merged = [...known, ...statements.filter((s) => !known.includes(s))].join('\n')
    if (merged !== c.charter.majorAssumptions)
      st.patchCampaign({ charter: { ...c.charter, majorAssumptions: merged } })
    return
  }
  const derived = statements.join('\n')
  if (derived !== c.charter.majorAssumptions)
    st.patchCampaign({ charter: { ...c.charter, majorAssumptions: derived } })
}

export function RegistersGroup({ campaign }: { campaign: TeCampaign }) {
  const { addItem, patchItem, removeItem } = useTeStore.getState()
  const [kind, setKind] = useState<RegisterKind>('assumption')
  const ch = campaign.charter
  const people = allPeople(campaign)
  const sourceSuggestions = [
    ...new Set(
      [
        ...campaign.registers.map((r) => r.sourceAndDate),
        ...lines(ch.sourceDocumentsAndPriorEvidence).map((l) => l.split('|')[0].trim()),
      ]
        .map((s) => s.trim())
        .filter((s) => s !== ''),
    ),
  ]
  // Relevance selects over the blocking uncertainty and the campaign questions.
  // Unknown legacy text prepends per row inside the select (SECURITY_CLASSES pattern).
  const relevanceOptions = [
    ...new Set(
      [
        campaign.decision.blockingUncertainty.trim(),
        ...campaign.questions.map((q) => q.wording.trim()),
      ].filter((t) => t !== ''),
    ),
  ]
  const entries = campaign.registers.filter((r) => r.kind === kind)
  const ordered =
    kind === 'unknown' ? [...entries].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)) : entries
  const assumptionStmts = new Set(
    campaign.registers.filter((r) => r.kind === 'assumption').map((r) => r.statement.trim()),
  )
  const unimported = lines(ch.majorAssumptions).filter((l) => !assumptionStmts.has(l))
  const importLegacy = () => {
    for (const line of unimported) {
      addItem('registers', {
        id: newId('reg'),
        kind: 'assumption',
        statement: line,
        sourceAndDate: '',
        relevance: '',
        rank: null,
        disposition: null,
        dispositionNote: '',
        notes: '',
      })
    }
    syncAssumptionText()
  }
  const columns: Array<{
    key: keyof RegisterRow & string
    label: string
    kind: 'text' | 'select' | 'person'
    options?: string[]
  }> = [
    { key: 'statement', label: 'Statement, exact wording', kind: 'text' },
    { key: 'sourceAndDate', label: 'Source and date', kind: 'person', options: sourceSuggestions },
    { key: 'relevance', label: 'Why it matters to the decision', kind: 'select', options: relevanceOptions },
    ...(kind === 'claim'
      ? [{ key: 'disposition' as const, label: 'Disposition', kind: 'select' as const, options: CLAIM_DISPOSITIONS }]
      : []),
    { key: 'notes', label: 'Notes', kind: 'text' },
  ]
  const done = campaign.registers.length > 0
  return (
    <DecisionGroup
      id="q8"
      question="What do we assume, claim, and not know?"
      hint={HINTS.registers?.why}
      tier="recommended"
      state={stateOf(done, ch.majorRisks.trim() !== '' || ch.sourceDocumentsAndPriorEvidence.trim() !== '')}
    >
      <Seg value={kind} options={REGISTER_KINDS} onChange={setKind} />
      <p className="muted small">
        Every customer statement becomes exactly one of: claim, known fact, unknown, or assumption.
      </p>
      {kind === 'assumption' && unimported.length > 0 && (
        <div className="provenance-line">
          <span className="provenance-chip">
            {unimported.length} charter line(s) not in the register
          </span>
          <button type="button" className="mini" onClick={importLegacy}>
            Import as assumptions
          </button>
        </div>
      )}
      <RegisterTable<RegisterRow>
        columns={columns}
        rows={ordered.map((r) => ({
          id: r.id,
          statement: r.statement,
          sourceAndDate: r.sourceAndDate,
          relevance: r.relevance,
          disposition: r.disposition ?? '',
          notes: r.notes,
        }))}
        onAdd={() =>
          addItem('registers', {
            id: newId('reg'),
            kind,
            statement: '',
            sourceAndDate: '',
            relevance: '',
            rank: kind === 'unknown' ? entries.length + 1 : null,
            disposition: null,
            dispositionNote: '',
            notes: '',
          })
        }
        onPatch={(id, patch) => {
          const p: Partial<TeCampaign['registers'][number]> = {}
          if (patch.statement !== undefined) p.statement = patch.statement
          if (patch.sourceAndDate !== undefined) p.sourceAndDate = patch.sourceAndDate
          if (patch.relevance !== undefined) p.relevance = patch.relevance
          if (patch.notes !== undefined) p.notes = patch.notes
          if (patch.disposition !== undefined)
            p.disposition =
              patch.disposition === ''
                ? null
                : (patch.disposition as TeCampaign['registers'][number]['disposition'])
          patchItem('registers', id, p)
          if (kind === 'assumption') syncAssumptionText()
        }}
        onRemove={(id) => {
          removeItem('registers', id)
          if (kind === 'assumption') syncAssumptionText()
        }}
        onReorder={
          kind === 'unknown'
            ? (ids) => ids.forEach((id, i) => patchItem('registers', id, { rank: i + 1 }))
            : undefined
        }
        removeImpacts={(id) => deleteImpacts(campaign, 'registers', id)}
        addLabel={`Add ${kind === 'known-fact' ? 'known fact' : kind}`}
        empty={`No ${kind === 'known-fact' ? 'known facts' : `${kind}s`} yet.`}
      />
      {kind === 'unknown' && ordered.length > 1 && (
        <p className="muted small">Resolve order: the top row resolves first.</p>
      )}
      <ExampleHint {...HINTS.registers} />
      <Field label="Major risks">
        <LineRegister
          value={ch.majorRisks}
          onChange={(v) => patchCharter(campaign, { majorRisks: v })}
          columns={[
            { key: 'statement', label: 'Risk' },
            { key: 'owner', label: 'Owner', kind: 'person', options: people },
            { key: 'criticality', label: 'Criticality', kind: 'select', options: ['low', 'medium', 'high'] },
          ]}
          addLabel="Add risk"
          empty="No risks yet. Add risk."
        />
      </Field>
      <Field label="Source documents and prior evidence">
        <LineRegister
          value={ch.sourceDocumentsAndPriorEvidence}
          onChange={(v) => patchCharter(campaign, { sourceDocumentsAndPriorEvidence: v })}
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'date', label: 'Date', kind: 'date' },
          ]}
          addLabel="Add document"
          empty="No documents yet. Add document."
        />
      </Field>
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q9 Authorities and schedule
// ---------------------------------------------------------------------------

type AuthorityRow = {
  id: string
  authorityType: string
  owner: string
  dueDate: string
  status: string
  operatingLimits: string
  leadTimeNote: string
}

type RightRow = {
  id: string
  decisionType: string
  accountableAuthority: string
  performer: string
  escalationPath: string
}

type SchedRow = { id: string; tMinusDays: number | null; name: string; owner: string; done: string }

type CommitRow = { id: string; item: string; owner: string; dueDate: string; consequenceOfFailure: string }

export function AuthoritiesGroup({ campaign }: { campaign: TeCampaign }) {
  const { addItem, patchItem, removeItem } = useTeStore.getState()
  const ch = campaign.charter
  const people = allPeople(campaign)
  const seedTrack = () => {
    const existing = new Set(campaign.schedule.map((s) => s.name.trim()))
    SCHEDULE_MILESTONES.forEach((m) => {
      if (existing.has(m.name)) return
      addItem('schedule', {
        id: newId('sch'),
        tMinusDays: m.tMinusDays,
        name: m.name,
        owner: '',
        done: false,
        notes: '',
      })
    })
  }
  const seedRights = () => {
    const existing = new Set(campaign.decisionRights.map((d) => d.decisionType))
    for (const dt of DECISION_TYPES) {
      if (!existing.has(dt)) {
        addItem('decisionRights', {
          id: newId('dr'),
          decisionType: dt,
          accountableAuthority: '',
          performer: '',
          requiredReviewers: '',
          responseTimeLimit: '',
          escalationPath: '',
        })
      }
    }
  }
  const setCommitments = (rows: CommitRow[]) =>
    patchCharter(campaign, {
      commitments: rows.map((r) => ({
        item: r.item,
        owner: r.owner,
        dueDate: r.dueDate,
        consequenceOfFailure: r.consequenceOfFailure,
      })),
    })
  const commitRows: CommitRow[] = ch.commitments.map((cm, i) => ({
    id: `cm-${i}`,
    item: cm.item,
    owner: cm.owner,
    dueDate: cm.dueDate,
    consequenceOfFailure: cm.consequenceOfFailure,
  }))
  const done = campaign.authorities.length > 0 && campaign.schedule.length > 0
  const partial = campaign.authorities.length > 0 || campaign.schedule.length > 0 || campaign.decisionRights.length > 0
  return (
    <DecisionGroup
      id="q9"
      question="What approvals and dates gate the campaign?"
      hint={HELP['authority-lead-time']}
      tier="recommended"
      state={stateOf(done, partial)}
    >
      <SubTitle>External approvals</SubTitle>
      <RegisterTable<AuthorityRow>
        columns={[
          {
            key: 'authorityType',
            label: 'Authority',
            kind: 'select',
            options: AUTHORITY_LEAD_TIMES.map((x) => x.authorityType),
            width: '22%',
          },
          { key: 'owner', label: 'Owner', kind: 'person', options: people },
          { key: 'dueDate', label: 'Due', kind: 'date' },
          { key: 'status', label: 'Status', kind: 'select', options: ['pending', 'active', 'expired', 'denied'] },
          { key: 'operatingLimits', label: 'Operating limits, verbatim', kind: 'text' },
          { key: 'leadTimeNote', label: 'Typical lead time', kind: 'text' },
        ]}
        rows={campaign.authorities.map((a) => ({
          id: a.id,
          authorityType: a.authorityType,
          owner: a.owner,
          dueDate: a.dueDate,
          status: a.status,
          operatingLimits: a.operatingLimits,
          leadTimeNote: a.leadTimeNote,
        }))}
        onAdd={() =>
          addItem('authorities', {
            id: newId('auth'),
            authorityType: '',
            owner: '',
            dueDate: '',
            operatingLimits: '',
            evidence: '',
            status: 'pending',
            leadTimeNote: '',
          })
        }
        onPatch={(id, patch) => {
          const a = campaign.authorities.find((x) => x.id === id)
          const p: Partial<TeCampaign['authorities'][number]> = {}
          if (patch.authorityType !== undefined) {
            p.authorityType = patch.authorityType
            const entry = AUTHORITY_LEAD_TIMES.find((x) => x.authorityType === patch.authorityType)
            if (entry && a && a.leadTimeNote.trim() === '')
              p.leadTimeNote = `${entry.leadTime} (${entry.note})`
          }
          if (patch.owner !== undefined) p.owner = patch.owner
          if (patch.dueDate !== undefined) p.dueDate = patch.dueDate
          if (patch.status !== undefined && patch.status !== '')
            p.status = patch.status as AuthorityStatus
          if (patch.operatingLimits !== undefined) p.operatingLimits = patch.operatingLimits
          if (patch.leadTimeNote !== undefined) p.leadTimeNote = patch.leadTimeNote
          patchItem('authorities', id, p)
        }}
        onRemove={(id) => removeItem('authorities', id)}
        addLabel="Add approval"
        empty="No approvals yet. Add approval."
      />
      <p className="muted small">Expired or missing mandatory approvals block the readiness gate.</p>

      <SubTitle
        action={
          <button type="button" className="mini" onClick={seedRights}>
            Seed 22 decision types
          </button>
        }
      >
        Decision rights, one accountable each
      </SubTitle>
      <RegisterTable<RightRow>
        columns={[
          { key: 'decisionType', label: 'Decision', kind: 'select', options: [...DECISION_TYPES] },
          { key: 'accountableAuthority', label: 'Accountable', kind: 'person', options: people },
          { key: 'performer', label: 'Performer', kind: 'person', options: people },
          { key: 'escalationPath', label: 'Escalation', kind: 'person', options: people },
        ]}
        rows={campaign.decisionRights.map((r) => ({
          id: r.id,
          decisionType: r.decisionType,
          accountableAuthority: r.accountableAuthority,
          performer: r.performer,
          escalationPath: r.escalationPath,
        }))}
        onAdd={() =>
          addItem('decisionRights', {
            id: newId('dr'),
            decisionType: '',
            accountableAuthority: '',
            performer: '',
            requiredReviewers: '',
            responseTimeLimit: '',
            escalationPath: '',
          })
        }
        onPatch={(id, patch) => {
          const p: Partial<TeCampaign['decisionRights'][number]> = {}
          if (patch.decisionType !== undefined) p.decisionType = patch.decisionType
          if (patch.accountableAuthority !== undefined) p.accountableAuthority = patch.accountableAuthority
          if (patch.performer !== undefined) p.performer = patch.performer
          if (patch.escalationPath !== undefined) p.escalationPath = patch.escalationPath
          patchItem('decisionRights', id, p)
        }}
        onRemove={(id) => removeItem('decisionRights', id)}
        addLabel="Add decision right"
        empty="No decision rights yet. Seed the 22 standard types or add one."
      />

      <SubTitle
        action={
          <button type="button" className="mini" onClick={seedTrack}>
            Seed standard track
          </button>
        }
      >
        Countdown schedule
      </SubTitle>
      <RegisterTable<SchedRow>
        columns={[
          { key: 'tMinusDays', label: 'Working days before first run', kind: 'number', width: '18%' },
          { key: 'name', label: 'Milestone', kind: 'person', options: SCHEDULE_MILESTONES.map((m) => m.name) },
          { key: 'owner', label: 'Owner', kind: 'person', options: people },
          { key: 'done', label: 'Done', kind: 'select', options: ['done', 'open'] },
        ]}
        rows={campaign.schedule.map((s) => ({
          id: s.id,
          tMinusDays: s.tMinusDays,
          name: s.name,
          owner: s.owner,
          done: s.done ? 'done' : 'open',
        }))}
        onAdd={() =>
          addItem('schedule', { id: newId('sch'), tMinusDays: 30, name: '', owner: '', done: false, notes: '' })
        }
        onPatch={(id, patch) => {
          const p: Partial<TeCampaign['schedule'][number]> = {}
          if (patch.tMinusDays !== undefined) p.tMinusDays = patch.tMinusDays ?? 0
          if (patch.name !== undefined) p.name = patch.name
          if (patch.owner !== undefined) p.owner = patch.owner
          if (patch.done !== undefined) p.done = patch.done === 'done'
          patchItem('schedule', id, p)
        }}
        onRemove={(id) => removeItem('schedule', id)}
        addLabel="Add milestone"
        empty="No milestones yet. Seed the standard track."
      />
      <p className="muted small">
        Build backward from the accepted-evidence date. Approval lead times sit on the critical path.
        Negative days count after the first live run.
      </p>

      <AdvancedDisclosure label="Customer commitments">
        <RegisterTable<CommitRow>
          columns={[
            { key: 'item', label: 'Commitment', kind: 'text' },
            { key: 'owner', label: 'Owner', kind: 'person', options: people },
            { key: 'dueDate', label: 'Due', kind: 'date' },
            { key: 'consequenceOfFailure', label: 'If it slips', kind: 'text' },
          ]}
          rows={commitRows}
          onAdd={() =>
            setCommitments([
              ...commitRows,
              { id: `cm-${commitRows.length}`, item: '', owner: '', dueDate: '', consequenceOfFailure: '' },
            ])
          }
          onPatch={(id, patch) =>
            setCommitments(commitRows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
          }
          onRemove={(id) => setCommitments(commitRows.filter((r) => r.id !== id))}
          addLabel="Add commitment"
          empty="No commitments yet. Add commitment."
        />
      </AdvancedDisclosure>
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Q10 Gate
// ---------------------------------------------------------------------------

export function GateGroup({ campaign }: { campaign: TeCampaign }) {
  const { addItem, patchItem, removeItem, passQualificationGate } = useTeStore.getState()
  const ch = campaign.charter
  const d = campaign.decision
  const people = allPeople(campaign)
  const blockers = qualificationBlockers(campaign)
  const passed = campaign.qualificationPassedAt != null
  const unsourcedAssumptions = campaign.registers.filter(
    (r) => r.kind === 'assumption' && r.sourceAndDate.trim() === '' && r.statement.trim() !== '',
  ).length
  const inactiveAuthorities = campaign.authorities.filter((a) => a.status !== 'active').length
  const issues: Array<{ level: 'block' | 'warn'; text: string }> = [
    ...blockers.map((b) => ({ level: 'block' as const, text: b })),
    ...(unsourcedAssumptions > 0
      ? [{ level: 'warn' as const, text: `${unsourcedAssumptions} assumption(s) have no source.` }]
      : []),
    ...(inactiveAuthorities > 0
      ? [{ level: 'warn' as const, text: `${inactiveAuthorities} approval(s) not active yet.` }]
      : []),
  ]
  const determination = DETERMINATIONS.find((x) => x.v === ch.engagementType)
  const scopeSummary = lines(ch.includedScope).slice(0, 5).join(', ')
  const exclusions = lines(ch.excludedScope)
    .map((l) => l.split('|')[0].trim())
    .slice(0, 3)
    .join('; ')
  const limitSuggestions = [...KNOWN_LIMIT_CATEGORIES, ...lines(ch.knownLimits)]
  return (
    <DecisionGroup
      id="q10"
      question="Ready to qualify?"
      hint={HELP['qualification-gate']}
      tier="required"
      state={stateOf(passed, blockers.length === 0)}
    >
      <SubTitle
        action={
          <button
            type="button"
            className="mini"
            onClick={() =>
              addItem('feasibility', {
                id: newId('fea'),
                item: '',
                score: 'unresolved',
                owner: '',
                fallback: '',
                effectOnConclusions: '',
              })
            }
          >
            Add feasibility item
          </button>
        }
      >
        Can we actually run this? Score each hard limit.
      </SubTitle>
      {campaign.feasibility.length === 0 && (
        <p className="muted small">
          No feasibility items yet. Fill the known-limits chips above, or add one here.
        </p>
      )}
      {campaign.feasibility.map((f) => (
        <div key={f.id} className="run-row">
          <div className="field-row">
            <SuggestField
              label="Item"
              value={f.item}
              onChange={(v) => patchItem('feasibility', f.id, { item: v })}
              suggestions={limitSuggestions}
            />
            <Field label="Score">
              <Seg
                value={f.score}
                options={(
                  ['feasible', 'feasible-with-mitigation', 'unresolved', 'infeasible'] as const
                ).map((v) => ({ v, label: v.replace('feasible-with-mitigation', 'with mitigation') }))}
                onChange={(v) => patchItem('feasibility', f.id, { score: v })}
              />
            </Field>
          </div>
          {f.score !== 'feasible' && (
            <div className="field-row">
              <PersonPicker label="Owner" value={f.owner} onChange={(v) => patchItem('feasibility', f.id, { owner: v })} people={people} />
              <TextField label="Fallback" value={f.fallback} onChange={(v) => patchItem('feasibility', f.id, { fallback: v })} />
              <TextField
                label="If unresolved, results cannot say"
                value={f.effectOnConclusions}
                onChange={(v) => patchItem('feasibility', f.id, { effectOnConclusions: v })}
              />
            </div>
          )}
          <div className="inspector-actions">
            <button type="button" className="mini danger" onClick={() => removeItem('feasibility', f.id)}>
              Remove item
            </button>
          </div>
        </div>
      ))}
      {passed ? (
        <div className="subsection">
          <Pill kind="good" text={`passed ${campaign.qualificationPassedAt!.slice(0, 10)}`} />
        </div>
      ) : (
        <StageReview
          title="Qualification review"
          rows={[
            { label: 'Customer asks', value: lines(ch.exactRequest)[0] ?? '' },
            { label: 'Determination', value: determination ? determination.label : ch.engagementType },
            { label: 'Decision', value: d.boundedChoice },
            { label: 'Decision owner', value: d.authorizedDecisionOwner },
            { label: 'Evidence authority', value: ch.evidenceAcceptanceAuthority },
            { label: 'Decision date', value: d.decisionDate },
            { label: 'Scope', value: scopeSummary },
            { label: 'Key exclusions', value: exclusions },
          ]}
          issues={issues}
          passLabel="Pass qualification gate"
          onPass={passQualificationGate}
        />
      )}
    </DecisionGroup>
  )
}

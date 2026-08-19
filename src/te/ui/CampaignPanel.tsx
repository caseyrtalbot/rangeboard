import { useState } from 'react'
import type {
  AuthorityStatus,
  CampaignCharter,
  DecisionCharter,
  EngagementType,
  RegisterKind,
  TeCampaign,
  ValkrynTasking,
} from '../model/types'
import { CAMPAIGN_ROLES, DECISION_TYPES } from '../model/types'
import { useTeStore } from '../state/teStore'
import { newId } from '../../model/types'
import { qualificationBlockers } from '../validate'
import { nowIso } from '../model/empty'
import {
  CheckField,
  ChipList,
  Field,
  GateList,
  Pill,
  SelectField,
  Seg,
  SubTitle,
  TextField,
} from './kit'

type Tab = 'charter' | 'decision' | 'people' | 'registers' | 'schedule' | 'gate'

const ENGAGEMENT_TYPES: EngagementType[] = [
  'demonstration',
  'experiment',
  'characterization',
  'comparison',
  'evaluation',
]

const TASKINGS: ValkrynTasking[] = [
  'recommend',
  'characterize',
  'validate',
  'compare',
  'support-an-authority',
]

function CharterTab({ campaign }: { campaign: TeCampaign }) {
  const { patchCampaign } = useTeStore.getState()
  const ch = campaign.charter
  const set = (patch: Partial<CampaignCharter>) =>
    patchCampaign({ charter: { ...ch, ...patch } })
  const setAcceptance = (patch: Partial<CampaignCharter['acceptance']>) =>
    set({ acceptance: { ...ch.acceptance, ...patch } })

  return (
    <div className="inspector-body">
      <SubTitle>Request</SubTitle>
      <TextField label="Customer's exact request (their own words)" rows={2} value={ch.exactRequest} onChange={(v) => set({ exactRequest: v })} />
      <div className="field-row">
        <TextField label="Requesting organization" value={ch.requestingOrganization} onChange={(v) => set({ requestingOrganization: v })} />
        <TextField label="Sponsor" value={ch.sponsor} onChange={(v) => set({ sponsor: v })} />
      </div>
      <div className="field-row">
        <TextField label="Date received" value={ch.dateReceived} onChange={(v) => set({ dateReceived: v })} placeholder="2026-08-19" />
        <TextField label="Requested decision date" value={ch.requestedDecisionDate} onChange={(v) => set({ requestedDecisionDate: v })} />
      </div>
      <div className="field-row">
        <SelectField label="Engagement type" value={ch.engagementType} options={ENGAGEMENT_TYPES.map((v) => ({ v, label: v }))} onChange={(v) => v && set({ engagementType: v })} />
        <SelectField label="Valkryn tasking" value={ch.valkrynTasking} options={TASKINGS.map((v) => ({ v, label: v }))} onChange={(v) => v && set({ valkrynTasking: v })} />
      </div>

      <SubTitle>People</SubTitle>
      <div className="field-row">
        <TextField label="Customer decision owner" value={ch.customerDecisionOwner} onChange={(v) => set({ customerDecisionOwner: v })} />
        <TextField label="Evidence acceptance authority" value={ch.evidenceAcceptanceAuthority} onChange={(v) => set({ evidenceAcceptanceAuthority: v })} />
      </div>
      <TextField label="Deployment strategist" value={ch.deploymentStrategist} onChange={(v) => set({ deploymentStrategist: v })} />

      <SubTitle>Scope</SubTitle>
      <TextField label="Mission and protected outcome" rows={2} value={ch.missionAndProtectedOutcome} onChange={(v) => set({ missionAndProtectedOutcome: v })} />
      <TextField label="Included scope" rows={2} value={ch.includedScope} onChange={(v) => set({ includedScope: v })} />
      <TextField label="Excluded scope and its effect on conclusions" rows={2} value={ch.excludedScope} onChange={(v) => set({ excludedScope: v })} />
      <div className="field-row">
        <TextField label="Major assumptions" rows={2} value={ch.majorAssumptions} onChange={(v) => set({ majorAssumptions: v })} />
        <TextField label="Major risks" rows={2} value={ch.majorRisks} onChange={(v) => set({ majorRisks: v })} />
      </div>
      <TextField label="Minimum viable campaign" rows={2} value={ch.minimumViableCampaign} onChange={(v) => set({ minimumViableCampaign: v })} />
      <TextField label="Success criteria" rows={2} value={ch.successCriteria} onChange={(v) => set({ successCriteria: v })} />

      <SubTitle>Logistics and limits</SubTitle>
      <div className="field-row">
        <TextField label="Planned sites and dates" value={ch.plannedSitesAndDates} onChange={(v) => set({ plannedSitesAndDates: v })} />
        <TextField label="Deliverables date" value={ch.deliverablesDate} onChange={(v) => set({ deliverablesDate: v })} />
      </div>
      <div className="field-row">
        <TextField label="Data security release class" value={ch.dataSecurityReleaseClass} onChange={(v) => set({ dataSecurityReleaseClass: v })} />
        <TextField label="Contract and funding owner" value={ch.contractAndFundingOwner} onChange={(v) => set({ contractAndFundingOwner: v })} />
      </div>
      <TextField label="Known limits (contract, budget, security, data, range, schedule)" rows={2} value={ch.knownLimits} onChange={(v) => set({ knownLimits: v })} />
      <TextField label="Source documents and prior evidence" rows={2} value={ch.sourceDocumentsAndPriorEvidence} onChange={(v) => set({ sourceDocumentsAndPriorEvidence: v })} />

      <SubTitle
        action={
          <button
            className="mini"
            onClick={() =>
              set({
                commitments: [
                  ...ch.commitments,
                  { item: '', owner: '', dueDate: '', consequenceOfFailure: '' },
                ],
              })
            }
          >
            + commitment
          </button>
        }
      >
        Customer commitments
      </SubTitle>
      {ch.commitments.map((cm, i) => (
        <div key={i} className="run-row">
          <TextField label="Commitment" value={cm.item} onChange={(v) => set({ commitments: ch.commitments.map((x, j) => (j === i ? { ...x, item: v } : x)) })} />
          <div className="field-row">
            <TextField label="Owner" value={cm.owner} onChange={(v) => set({ commitments: ch.commitments.map((x, j) => (j === i ? { ...x, owner: v } : x)) })} />
            <TextField label="Due date" value={cm.dueDate} onChange={(v) => set({ commitments: ch.commitments.map((x, j) => (j === i ? { ...x, dueDate: v } : x)) })} />
          </div>
          <TextField label="Consequence of failure" value={cm.consequenceOfFailure} onChange={(v) => set({ commitments: ch.commitments.map((x, j) => (j === i ? { ...x, consequenceOfFailure: v } : x)) })} />
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => set({ commitments: ch.commitments.filter((_, j) => j !== i) })}>
              remove
            </button>
          </div>
        </div>
      ))}

      <SubTitle>Evidence acceptance path</SubTitle>
      <div className="field-row">
        <TextField label="Relying organization" value={ch.acceptance.relyingOrganization} onChange={(v) => setAcceptance({ relyingOrganization: v })} />
        <TextField label="Method approval authority" value={ch.acceptance.methodApprovalAuthority} onChange={(v) => setAcceptance({ methodApprovalAuthority: v })} />
      </div>
      <TextField label="Required witnesses and reviewers" value={ch.acceptance.requiredWitnesses} onChange={(v) => setAcceptance({ requiredWitnesses: v })} />
      <TextField label="Evidence standard (measures, repetitions, confidence, fidelity)" rows={2} value={ch.acceptance.evidenceStandard} onChange={(v) => setAcceptance({ evidenceStandard: v })} />
      <TextField label="Rejection conditions" rows={2} value={ch.acceptance.rejectionConditions} onChange={(v) => setAcceptance({ rejectionConditions: v })} />
      <p className="muted small">
        Design must not complete before the relying organization accepts the evidence standard.
      </p>
    </div>
  )
}

function DecisionTab({ campaign }: { campaign: TeCampaign }) {
  const { patchCampaign } = useTeStore.getState()
  const d = campaign.decision
  const set = (patch: Partial<DecisionCharter>) =>
    patchCampaign({ decision: { ...d, ...patch } })

  const statement =
    `By ${d.decisionDate || '[date]'}, ${d.authorizedDecisionOwner || '[decision owner]'} must decide ` +
    `${d.boundedChoice || '[bounded choice]'} among ${d.alternatives || '[alternatives, including delay or no action]'}. ` +
    `The decision is blocked or weakened by ${d.blockingUncertainty || '[uncertainty]'}. ` +
    `Evidence will matter only if ${d.acceptanceConditions || '[acceptance conditions]'} are met.`

  return (
    <div className="inspector-body">
      <div className="spec-summary">{statement}</div>
      <div className="field-row">
        <TextField label="Decision date" value={d.decisionDate} onChange={(v) => set({ decisionDate: v })} placeholder="2026-10-01" />
        <TextField label="Authorized decision owner" value={d.authorizedDecisionOwner} onChange={(v) => set({ authorizedDecisionOwner: v })} />
      </div>
      <TextField label="Bounded choice" rows={2} value={d.boundedChoice} onChange={(v) => set({ boundedChoice: v })} />
      <TextField label="Alternatives (include delay and no action)" rows={2} value={d.alternatives} onChange={(v) => set({ alternatives: v })} />
      <TextField label="Blocking uncertainty" rows={2} value={d.blockingUncertainty} onChange={(v) => set({ blockingUncertainty: v })} />
      <TextField label="Acceptance conditions" rows={2} value={d.acceptanceConditions} onChange={(v) => set({ acceptanceConditions: v })} />
      <div className="field-row">
        <TextField label="Post-test action" value={d.postTestAction} onChange={(v) => set({ postTestAction: v })} />
        <TextField label="Action authority" value={d.actionAuthority} onChange={(v) => set({ actionAuthority: v })} />
      </div>
      <TextField label="Consequence of no action" value={d.consequenceOfNoAction} onChange={(v) => set({ consequenceOfNoAction: v })} />
      <div className="field-row">
        <TextField label="Result that changes the choice" value={d.resultThatChangesChoice} onChange={(v) => set({ resultThatChangesChoice: v })} />
        <TextField label="Result that does not" value={d.resultThatDoesNot} onChange={(v) => set({ resultThatDoesNot: v })} />
      </div>
      <div className="field-row">
        <TextField label="Latest accepted-evidence date" value={d.latestAcceptedEvidenceDate} onChange={(v) => set({ latestAcceptedEvidenceDate: v })} />
        <CheckField label="Customer can accept unfavorable evidence" value={d.canAcceptUnfavorableEvidence} onChange={(v) => set({ canAcceptUnfavorableEvidence: v })} />
      </div>
      <SubTitle>Decision arithmetic</SubTitle>
      <div className="field-row">
        <TextField label="Minimum meaningful difference" value={d.minimumMeaningfulDifference} onChange={(v) => set({ minimumMeaningfulDifference: v })} placeholder="25 s warning time" />
        <TextField label="Acceptable threshold" value={d.acceptableThreshold} onChange={(v) => set({ acceptableThreshold: v })} />
      </div>
      <TextField label="Required evidence strength" value={d.requiredEvidenceStrength} onChange={(v) => set({ requiredEvidenceStrength: v })} />
      <SubTitle>Decision action map</SubTitle>
      <div className="field-row">
        <TextField label="On meet" value={d.actionOnMeet} onChange={(v) => set({ actionOnMeet: v })} />
        <TextField label="On miss" value={d.actionOnMiss} onChange={(v) => set({ actionOnMiss: v })} />
      </div>
      <div className="field-row">
        <TextField label="On mixed" value={d.actionOnMixed} onChange={(v) => set({ actionOnMixed: v })} />
        <TextField label="On inconclusive" value={d.actionOnInconclusive} onChange={(v) => set({ actionOnInconclusive: v })} />
      </div>
    </div>
  )
}

function PeopleTab({ campaign }: { campaign: TeCampaign }) {
  const { addItem, patchItem, removeItem } = useTeStore.getState()
  return (
    <div className="inspector-body">
      <SubTitle
        action={
          <button
            className="mini"
            onClick={() =>
              addItem('roles', { id: newId('role'), role: 'test-conductor', primary: '', backup: '' })
            }
          >
            + role
          </button>
        }
      >
        Campaign roles (primary and backup)
      </SubTitle>
      {campaign.roles.map((r) => (
        <div key={r.id} className="field-row te-table-row">
          <SelectField label="Role" value={r.role} options={CAMPAIGN_ROLES.map((v) => ({ v, label: v }))} onChange={(v) => v && patchItem('roles', r.id, { role: v })} />
          <TextField label="Primary" value={r.primary} onChange={(v) => patchItem('roles', r.id, { primary: v })} />
          <TextField label="Backup" value={r.backup} onChange={(v) => patchItem('roles', r.id, { backup: v })} />
          <button className="mini danger" onClick={() => removeItem('roles', r.id)}>×</button>
        </div>
      ))}

      <SubTitle
        action={
          <button
            className="mini"
            onClick={() =>
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
          >
            + authority
          </button>
        }
      >
        External authorities and approvals
      </SubTitle>
      {campaign.authorities.map((a) => (
        <div key={a.id} className="run-row">
          <div className="field-row">
            <TextField label="Authority" value={a.authorityType} onChange={(v) => patchItem('authorities', a.id, { authorityType: v })} placeholder="Airspace NOTAM" />
            <TextField label="Owner" value={a.owner} onChange={(v) => patchItem('authorities', a.id, { owner: v })} />
            <TextField label="Due" value={a.dueDate} onChange={(v) => patchItem('authorities', a.id, { dueDate: v })} />
            <SelectField label="Status" value={a.status} options={(['pending', 'active', 'expired', 'denied'] as AuthorityStatus[]).map((v) => ({ v, label: v }))} onChange={(v) => v && patchItem('authorities', a.id, { status: v })} />
          </div>
          <div className="field-row">
            <TextField label="Operating limits" value={a.operatingLimits} onChange={(v) => patchItem('authorities', a.id, { operatingLimits: v })} />
            <TextField label="Lead time note" value={a.leadTimeNote} onChange={(v) => patchItem('authorities', a.id, { leadTimeNote: v })} />
          </div>
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => removeItem('authorities', a.id)}>remove</button>
          </div>
        </div>
      ))}
      <p className="muted small">Expired or missing mandatory authorities block the readiness gate.</p>

      <SubTitle
        action={
          <button
            className="mini"
            onClick={() => {
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
            }}
          >
            seed 22 decision types
          </button>
        }
      >
        Decision rights (exactly one accountable authority each)
      </SubTitle>
      {campaign.decisionRights.map((d) => (
        <div key={d.id} className="field-row te-table-row">
          <TextField label="Decision" value={d.decisionType} onChange={(v) => patchItem('decisionRights', d.id, { decisionType: v })} />
          <TextField label="Accountable" value={d.accountableAuthority} onChange={(v) => patchItem('decisionRights', d.id, { accountableAuthority: v })} />
          <TextField label="Performer" value={d.performer} onChange={(v) => patchItem('decisionRights', d.id, { performer: v })} />
          <TextField label="Escalation" value={d.escalationPath} onChange={(v) => patchItem('decisionRights', d.id, { escalationPath: v })} />
          <button className="mini danger" onClick={() => removeItem('decisionRights', d.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

const REGISTER_KINDS: Array<{ v: RegisterKind; label: string }> = [
  { v: 'claim', label: 'Claims' },
  { v: 'known-fact', label: 'Known facts' },
  { v: 'unknown', label: 'Unknowns' },
  { v: 'assumption', label: 'Assumptions' },
]

function RegistersTab({ campaign }: { campaign: TeCampaign }) {
  const { addItem, patchItem, removeItem, selectRecord } = useTeStore.getState()
  const [kind, setKind] = useState<RegisterKind>('claim')
  const selected = useTeStore((s) => s.ui.selected.registers ?? null)
  const entries = campaign.registers.filter((r) => r.kind === kind)
  const entry = campaign.registers.find((r) => r.id === selected && r.kind === kind)

  return (
    <div className="inspector-body">
      <Seg value={kind} options={REGISTER_KINDS} onChange={setKind} />
      <p className="muted small">
        Every customer statement becomes exactly one of: claim, known fact, unknown, or assumption.
      </p>
      <ChipList
        items={entries.map((r) => ({ id: r.id, label: `${r.id.split('-').slice(2).join('-')}: ${r.statement.slice(0, 32) || 'new'}` }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('registers', id)}
        onAdd={() => {
          const id = newId('reg')
          addItem('registers', {
            id,
            kind,
            statement: '',
            sourceAndDate: '',
            relevance: '',
            rank: null,
            disposition: null,
            dispositionNote: '',
            notes: '',
          })
          selectRecord('registers', id)
        }}
        addLabel={`+ ${kind}`}
      />
      {entry && (
        <div className="run-row">
          <TextField label="Statement (exact wording)" rows={2} value={entry.statement} onChange={(v) => patchItem('registers', entry.id, { statement: v })} />
          <div className="field-row">
            <TextField label="Source and date" value={entry.sourceAndDate} onChange={(v) => patchItem('registers', entry.id, { sourceAndDate: v })} />
            <TextField label="Decision relevance" value={entry.relevance} onChange={(v) => patchItem('registers', entry.id, { relevance: v })} />
          </div>
          {kind === 'unknown' && (
            <TextField label="Rank (lower resolves first)" value={entry.rank == null ? '' : String(entry.rank)} onChange={(v) => patchItem('registers', entry.id, { rank: v === '' ? null : Number(v) })} />
          )}
          {kind === 'claim' && (
            <SelectField
              label="Disposition (required at closeout)"
              value={entry.disposition}
              allowEmpty="undisposed"
              options={(
                ['supported', 'contradicted', 'directionally-supported', 'inconclusive', 'untested', 'outside-scope'] as const
              ).map((v) => ({ v, label: v }))}
              onChange={(v) => patchItem('registers', entry.id, { disposition: v })}
            />
          )}
          <TextField label="Notes" rows={2} value={entry.notes} onChange={(v) => patchItem('registers', entry.id, { notes: v })} />
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => { removeItem('registers', entry.id); selectRecord('registers', null) }}>
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ScheduleTab({ campaign }: { campaign: TeCampaign }) {
  const { addItem, patchItem, removeItem } = useTeStore.getState()
  const items = [...campaign.schedule].sort((a, b) => b.tMinusDays - a.tMinusDays)
  return (
    <div className="inspector-body">
      <SubTitle
        action={
          <button
            className="mini"
            onClick={() =>
              addItem('schedule', { id: newId('sch'), tMinusDays: 30, name: '', owner: '', done: false, notes: '' })
            }
          >
            + item
          </button>
        }
      >
        Countdown schedule (working days before first live run)
      </SubTitle>
      {items.map((s) => (
        <div key={s.id} className="field-row te-table-row">
          <Field label="T-">
            <input type="number" value={s.tMinusDays} onChange={(e) => patchItem('schedule', s.id, { tMinusDays: Number(e.target.value) })} />
          </Field>
          <TextField label="Milestone" value={s.name} onChange={(v) => patchItem('schedule', s.id, { name: v })} />
          <TextField label="Owner" value={s.owner} onChange={(v) => patchItem('schedule', s.id, { owner: v })} />
          <CheckField label="Done" value={s.done} onChange={(v) => patchItem('schedule', s.id, { done: v })} />
          <button className="mini danger" onClick={() => removeItem('schedule', s.id)}>×</button>
        </div>
      ))}
      <p className="muted small">
        Build the schedule backward from the accepted-evidence date. Authority lead times sit on
        the critical path.
      </p>
    </div>
  )
}

function GateTab({ campaign }: { campaign: TeCampaign }) {
  const { addItem, patchItem, removeItem, patchCampaign } = useTeStore.getState()
  const blockers = qualificationBlockers(campaign)
  const passed = campaign.qualificationPassedAt != null
  return (
    <div className="inspector-body">
      <SubTitle>Qualification gate</SubTitle>
      {passed ? (
        <Pill kind="good" text={`passed ${campaign.qualificationPassedAt!.slice(0, 10)}`} />
      ) : (
        <Pill kind={blockers.length ? 'warn' : 'neutral'} text={blockers.length ? `${blockers.length} blocker(s)` : 'ready to pass'} />
      )}
      <GateList items={blockers} kind="bad" />
      <div className="inspector-actions">
        <button
          className="primary"
          disabled={blockers.length > 0 || passed}
          onClick={() => patchCampaign({ qualificationPassedAt: nowIso(), phase: 'qualified' })}
        >
          Pass qualification gate
        </button>
      </div>

      <SubTitle
        action={
          <button
            className="mini"
            onClick={() =>
              addItem('feasibility', { id: newId('fea'), item: '', score: 'unresolved', owner: '', fallback: '', effectOnConclusions: '' })
            }
          >
            + item
          </button>
        }
      >
        Feasibility screen
      </SubTitle>
      {campaign.feasibility.map((f) => (
        <div key={f.id} className="run-row">
          <div className="field-row">
            <TextField label="Item" value={f.item} onChange={(v) => patchItem('feasibility', f.id, { item: v })} />
            <SelectField
              label="Score"
              value={f.score}
              options={(['feasible', 'feasible-with-mitigation', 'unresolved', 'infeasible'] as const).map((v) => ({ v, label: v }))}
              onChange={(v) => v && patchItem('feasibility', f.id, { score: v })}
            />
          </div>
          {f.score !== 'feasible' && (
            <div className="field-row">
              <TextField label="Owner" value={f.owner} onChange={(v) => patchItem('feasibility', f.id, { owner: v })} />
              <TextField label="Fallback" value={f.fallback} onChange={(v) => patchItem('feasibility', f.id, { fallback: v })} />
              <TextField label="Effect on conclusions" value={f.effectOnConclusions} onChange={(v) => patchItem('feasibility', f.id, { effectOnConclusions: v })} />
            </div>
          )}
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => removeItem('feasibility', f.id)}>remove</button>
          </div>
        </div>
      ))}
    </div>
  )
}

const TABS: Array<{ v: Tab; label: string }> = [
  { v: 'charter', label: 'Charter' },
  { v: 'decision', label: 'Decision' },
  { v: 'people', label: 'People & authority' },
  { v: 'registers', label: 'Registers' },
  { v: 'schedule', label: 'Schedule' },
  { v: 'gate', label: 'Gate' },
]

export function CampaignPanel({ campaign }: { campaign: TeCampaign }) {
  const [tab, setTab] = useState<Tab>('charter')
  return (
    <div className="te-panel">
      <Seg value={tab} options={TABS} onChange={setTab} />
      {tab === 'charter' && <CharterTab campaign={campaign} />}
      {tab === 'decision' && <DecisionTab campaign={campaign} />}
      {tab === 'people' && <PeopleTab campaign={campaign} />}
      {tab === 'registers' && <RegistersTab campaign={campaign} />}
      {tab === 'schedule' && <ScheduleTab campaign={campaign} />}
      {tab === 'gate' && <GateTab campaign={campaign} />}
    </div>
  )
}

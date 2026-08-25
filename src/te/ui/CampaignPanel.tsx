/**
 * Qualify stage (strategist SPEC 1.1): one scrolling column of decision
 * groups Q0-Q10. Free navigation between groups; only the stage gate blocks.
 */

import type { TeCampaign } from '../model/types'
import { qualificationBlockers } from '../validate'
import { PhaseIntro } from './kit'
import {
  AuthoritiesGroup,
  DecisionGroupQ4,
  DeterminationGroup,
  EvidenceGroup,
  GateGroup,
  IntakeGroup,
  MissionGroup,
  PeopleGroup,
  RegistersGroup,
  ScopeGroup,
  StartGroup,
} from './CampaignGroups'

export function CampaignPanel({ campaign }: { campaign: TeCampaign }) {
  const blockers = qualificationBlockers(campaign)
  const passed = campaign.qualificationPassedAt != null
  const gate = passed
    ? { kind: 'good' as const, text: 'gate passed' }
    : blockers.length
      ? { kind: 'warn' as const, text: `${blockers.length} blocker(s)` }
      : { kind: 'neutral' as const, text: 'gate ready' }
  return (
    <div className="te-panel">
      <PhaseIntro phase="campaign" gate={gate} />
      <div className="inspector-body">
        <StartGroup campaign={campaign} />
        <IntakeGroup campaign={campaign} />
        <DeterminationGroup campaign={campaign} />
        <MissionGroup campaign={campaign} />
        <DecisionGroupQ4 campaign={campaign} />
        <PeopleGroup campaign={campaign} />
        <EvidenceGroup campaign={campaign} />
        <ScopeGroup campaign={campaign} />
        <RegistersGroup campaign={campaign} />
        <AuthoritiesGroup campaign={campaign} />
        <GateGroup campaign={campaign} />
      </div>
    </div>
  )
}

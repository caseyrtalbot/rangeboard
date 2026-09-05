/**
 * Campaign readiness (SPEC section 6.2). Gate completion per stage, the
 * overall percent, and the artifact list for the ReadinessRail.
 * Pure derivation from validate.ts outputs, chainHealth, and record counts.
 * Derived live, never stored.
 */

import type { TeCampaign } from '../model/types'
import {
  chainHealth,
  closeoutBlockers,
  designLint,
  findingBlockers,
  qualificationBlockers,
} from '../validate'

export type StageId = 'campaign' | 'design' | 'cards' | 'execute' | 'analyze' | 'deliver'
export type StageStatus = 'good' | 'warn' | 'neutral'
export type ArtifactState = 'done' | 'partial' | 'missing'

export type ArtifactKey =
  | 'charter'
  | 'decision'
  | 'config'
  | 'threats'
  | 'measures'
  | 'assumptions'
  | 'risks'
  | 'matrix'
  | 'cards'
  | 'runs'
  | 'findings'
  | 'package'

export interface StageReadiness {
  id: StageId
  /** Gate completion 0..100 for this stage. */
  pct: number
  /** Stepper-dot state: good = gate met, warn = open issues, neutral = not started. */
  status: StageStatus
}

export interface ReadinessArtifact {
  key: ArtifactKey
  label: string
  state: ArtifactState
  detail?: string
  /** Stage that owns the artifact; the rail navigates here on preview fallback. */
  stage: StageId
}

export interface CampaignReadiness {
  /** Weighted mean of stage gate completion, 0..100. */
  pct: number
  stages: StageReadiness[]
  artifacts: ReadinessArtifact[]
}

/** Fixed number of qualification gate checks (validate.ts, qualificationBlockers). */
const QUALIFY_CHECKS = 6

/** Stage weights for the overall percent. Gate stages weigh more than review stages. */
const STAGE_WEIGHTS: Record<StageId, number> = {
  campaign: 3,
  design: 3,
  cards: 2,
  execute: 2,
  analyze: 1,
  deliver: 3,
}

function pctOf(fraction: number): number {
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100)
}

function filled(s: string): boolean {
  return s.trim() !== ''
}

/** Cards still in play: superseded and withdrawn versions do not count. */
function activeCards(c: TeCampaign) {
  return c.cards.filter((x) => x.status !== 'superseded' && x.status !== 'withdrawn')
}

function issuedCards(c: TeCampaign) {
  return activeCards(c).filter((x) => x.status === 'issued')
}

function adjudicatedRuns(c: TeCampaign) {
  return c.runs.filter((r) => r.validity !== 'pending')
}

// ---------------------------------------------------------------------------
// Stage gate completion
// ---------------------------------------------------------------------------

export function qualifyPct(c: TeCampaign): number {
  if (c.qualificationPassedAt != null) return 100
  const blockers = qualificationBlockers(c).length
  return pctOf((QUALIFY_CHECKS - blockers) / QUALIFY_CHECKS)
}

export function designPct(c: TeCampaign): number {
  if (c.designApprovedAt != null) return 100
  const hasCore = c.questions.length > 0 && c.measures.length > 0
  const parts = [
    c.questions.length > 0,
    c.measures.length > 0,
    c.threats.length > 0,
    c.conditions.length > 0,
    c.configs.length > 0,
    c.matrix.length > 0,
    hasCore && designLint(c).length === 0,
  ]
  return pctOf(parts.filter(Boolean).length / parts.length)
}

export function cardsPct(c: TeCampaign): number {
  const active = activeCards(c)
  if (active.length === 0) return 0
  return pctOf(issuedCards(c).length / active.length)
}

export function executePct(c: TeCampaign): number {
  if (c.runs.length === 0) return 0
  return pctOf(adjudicatedRuns(c).length / c.runs.length)
}

export function analyzePct(c: TeCampaign): number {
  if (adjudicatedRuns(c).length === 0) return 0
  if (c.hypotheses.length === 0) return 100
  const settled = c.hypotheses.filter((h) => h.outcome != null).length
  return pctOf(settled / c.hypotheses.length)
}

export function deliverPct(c: TeCampaign): number {
  if (c.evidencePackage.deliveredAt != null) return 100
  const sections = c.evidencePackage.sections
  const complete = sections.filter((s) => filled(s.content)).length
  const sectionFrac = sections.length === 0 ? 0 : complete / sections.length
  const haveFindings = c.findings.length > 0
  const cleanFindings =
    haveFindings && c.findings.every((f) => findingBlockers(c, f).length === 0)
  const closeoutClean = haveFindings && closeoutBlockers(c).length === 0
  const score =
    (haveFindings ? 1 : 0) + (cleanFindings ? 1 : 0) + (closeoutClean ? 1 : 0) + sectionFrac
  return pctOf(score / 4)
}

// ---------------------------------------------------------------------------
// Stage stepper status (dots synced to the gates)
// ---------------------------------------------------------------------------

export function stageStatus(c: TeCampaign, id: StageId): StageStatus {
  switch (id) {
    case 'campaign':
      return c.qualificationPassedAt != null || qualificationBlockers(c).length === 0
        ? 'good'
        : 'neutral'
    case 'design': {
      const passed = c.qualificationPassedAt != null
      if (c.designApprovedAt != null) return 'good'
      if (
        passed &&
        c.questions.length > 0 &&
        c.measures.length > 0 &&
        designLint(c).length === 0
      )
        return 'good'
      return passed && c.questions.length > 0 ? 'warn' : 'neutral'
    }
    case 'cards':
      if (issuedCards(c).length > 0) return 'good'
      return activeCards(c).length > 0 ? 'warn' : 'neutral'
    case 'execute':
      if (c.runs.length === 0) return 'neutral'
      return adjudicatedRuns(c).length === c.runs.length ? 'good' : 'warn'
    case 'analyze': {
      const clean = Object.values(chainHealth(c)).every((n) => n === 0)
      const adjudicated = adjudicatedRuns(c).length > 0
      if (adjudicated && clean) return 'good'
      if (c.runs.length > 0 && !clean) return 'warn'
      return 'neutral'
    }
    case 'deliver':
      if (c.evidencePackage.deliveredAt != null) return 'good'
      return c.findings.length > 0 ? 'warn' : 'neutral'
  }
}

// ---------------------------------------------------------------------------
// Artifact list
// ---------------------------------------------------------------------------

function threeState(done: boolean, started: boolean): ArtifactState {
  if (done) return 'done'
  return started ? 'partial' : 'missing'
}

/** Nonempty lines of a one-item-per-line text field. */
function lineCount(s: string): number {
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x !== '').length
}

export function artifactList(c: TeCampaign): ReadinessArtifact[] {
  const charterFields = [
    c.charter.exactRequest,
    c.charter.missionAndProtectedOutcome,
    c.charter.successCriteria,
  ]
  const charterDone = charterFields.filter(filled).length

  const decisionFields = [
    c.decision.boundedChoice,
    c.decision.decisionDate,
    c.decision.authorizedDecisionOwner,
    c.decision.blockingUncertainty,
    c.decision.acceptanceConditions,
  ]
  const decisionDone = decisionFields.filter(filled).length

  const frozenConfigs = c.configs.filter((x) => x.frozen).length
  const measuresWithTruth = c.measures.filter((m) => filled(m.truth.primarySource)).length
  const assumptions = c.registers.filter((r) => r.kind === 'assumption').length
  const risks = lineCount(c.charter.majorRisks)
  const baseline = c.matrix.some((cell) => cell.method.toLowerCase().includes('baseline'))
  const active = activeCards(c).length
  const issued = issuedCards(c).length
  const adjudicated = adjudicatedRuns(c).length
  const cleanFindings = c.findings.filter((f) => findingBlockers(c, f).length === 0).length
  const sections = c.evidencePackage.sections
  const sectionsDone = sections.filter((s) => filled(s.content)).length

  return [
    {
      key: 'charter',
      label: 'Charter',
      state: threeState(charterDone === charterFields.length, charterDone > 0),
      stage: 'campaign',
    },
    {
      key: 'decision',
      label: 'Decision statement',
      state: threeState(decisionDone === decisionFields.length, decisionDone > 0),
      detail: `${decisionDone}/${decisionFields.length}`,
      stage: 'campaign',
    },
    {
      key: 'config',
      label: 'Configuration',
      state: threeState(frozenConfigs > 0, c.configs.length > 0),
      detail: c.configs.length > 0 ? `${frozenConfigs}/${c.configs.length}` : undefined,
      stage: 'design',
    },
    {
      key: 'threats',
      label: 'Threats',
      state: threeState(c.threats.length > 0, false),
      detail: c.threats.length > 0 ? `${c.threats.length}` : undefined,
      stage: 'design',
    },
    {
      key: 'measures',
      label: 'Measures',
      state: threeState(
        c.measures.length > 0 && measuresWithTruth === c.measures.length,
        c.measures.length > 0,
      ),
      detail: c.measures.length > 0 ? `${measuresWithTruth}/${c.measures.length}` : undefined,
      stage: 'design',
    },
    {
      key: 'assumptions',
      label: 'Assumptions',
      state: threeState(assumptions > 0, false),
      detail: assumptions > 0 ? `${assumptions}` : undefined,
      stage: 'campaign',
    },
    {
      key: 'risks',
      label: 'Risks',
      state: threeState(risks > 0, false),
      detail: risks > 0 ? `${risks}` : undefined,
      stage: 'campaign',
    },
    {
      key: 'matrix',
      label: 'Matrix',
      state: threeState(c.matrix.length > 0 && baseline, c.matrix.length > 0),
      detail: c.matrix.length > 0 ? `${c.matrix.length}` : undefined,
      stage: 'design',
    },
    {
      key: 'cards',
      label: 'Cards issued',
      state: threeState(active > 0 && issued === active, active > 0),
      detail: active > 0 ? `${issued}/${active}` : undefined,
      stage: 'cards',
    },
    {
      key: 'runs',
      label: 'Runs adjudicated',
      state: threeState(c.runs.length > 0 && adjudicated === c.runs.length, c.runs.length > 0),
      detail: c.runs.length > 0 ? `${adjudicated}/${c.runs.length}` : undefined,
      stage: 'execute',
    },
    {
      key: 'findings',
      label: 'Findings',
      state: threeState(
        c.findings.length > 0 && cleanFindings === c.findings.length,
        c.findings.length > 0,
      ),
      detail: c.findings.length > 0 ? `${cleanFindings}/${c.findings.length}` : undefined,
      stage: 'deliver',
    },
    {
      key: 'package',
      label: 'Package',
      state: threeState(
        sections.length > 0 && sectionsDone === sections.length,
        sectionsDone > 0,
      ),
      detail: `${sectionsDone}/${sections.length}`,
      stage: 'deliver',
    },
  ]
}

// ---------------------------------------------------------------------------
// Whole-campaign readiness
// ---------------------------------------------------------------------------

export function campaignReadiness(c: TeCampaign): CampaignReadiness {
  const stagePcts: Record<StageId, number> = {
    campaign: qualifyPct(c),
    design: designPct(c),
    cards: cardsPct(c),
    execute: executePct(c),
    analyze: analyzePct(c),
    deliver: deliverPct(c),
  }
  const stages: StageReadiness[] = (Object.keys(stagePcts) as StageId[]).map((id) => ({
    id,
    pct: stagePcts[id],
    status: stageStatus(c, id),
  }))
  let weighted = 0
  let totalWeight = 0
  for (const s of stages) {
    weighted += s.pct * STAGE_WEIGHTS[s.id]
    totalWeight += STAGE_WEIGHTS[s.id]
  }
  return {
    pct: Math.round(weighted / totalWeight),
    stages,
    artifacts: artifactList(c),
  }
}

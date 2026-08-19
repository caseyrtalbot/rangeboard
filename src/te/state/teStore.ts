/**
 * T&E Operations store. Separate from the canvas scenario store on purpose:
 * campaign records are versioned and append-only, so there is no undo here.
 * Persistence key: rangeboard.te.v1 (src/te/io/persistTe.ts).
 */

import { create } from 'zustand'
import type {
  ChecklistTemplate,
  DebriefKind,
  GoNoGo,
  GoNoGoScope,
  TeCampaign,
  TeCard,
  TeChecklist,
  TeRun,
  TeRunValidity,
  TeState,
} from '../model/types'
import type { TypeCode } from '../model/ids'
import { bumpMajor, nextId } from '../model/ids'
import {
  emptyAnomaly,
  emptyCampaign,
  emptyCard,
  emptyChange,
  emptyCondition,
  emptyConfig,
  emptyDeviation,
  emptyFactor,
  emptyFinding,
  emptyHypothesis,
  emptyMatrixCell,
  emptyMeasure,
  emptyQuestion,
  emptyRun,
  emptyThreat,
  nowIso,
} from '../model/empty'
import { newId } from '../../model/types'
import { cardIssueBlockers } from '../validate'

/** Campaign fields that are arrays of records keyed by `id`. */
export type TeListKey = {
  [K in keyof TeCampaign]: TeCampaign[K] extends Array<{ id: string }> ? K : never
}[keyof TeCampaign]

export type TePhaseTab =
  | 'campaign'
  | 'design'
  | 'cards'
  | 'execute'
  | 'analyze'
  | 'deliver'
  | 'products'

export type Workspace = 'board' | 'ops'

interface TeUi {
  workspace: Workspace
  phase: TePhaseTab
  /** Selected record id per list key, for master-detail panels. */
  selected: Partial<Record<TeListKey, string | null>>
}

export interface TeStore {
  schemaVersion: 1
  campaigns: TeCampaign[]
  activeCampaignId: string | null
  ui: TeUi

  // Workspace and navigation
  setWorkspace: (w: Workspace) => void
  setPhase: (p: TePhaseTab) => void
  selectRecord: (key: TeListKey, id: string | null) => void

  // Campaign lifecycle
  createCampaign: (name: string, code: string) => string
  deleteCampaign: (id: string) => void
  setActiveCampaign: (id: string) => void
  /** Adds an imported or seeded campaign and activates it. */
  loadCampaign: (c: TeCampaign) => void
  replaceState: (s: TeState) => void
  patchCampaign: (patch: Partial<TeCampaign>) => void

  // Generic record list operations on the active campaign
  addItem: <K extends TeListKey>(key: K, item: TeCampaign[K][number]) => void
  patchItem: <K extends TeListKey>(
    key: K,
    id: string,
    patch: Partial<TeCampaign[K][number]>,
  ) => void
  removeItem: (key: TeListKey, id: string) => void

  // Creation actions that allocate grammar identifiers
  addQuestion: () => string
  addHypothesis: (questionId: string) => string
  addMeasure: (questionId: string) => string
  addThreat: () => string
  addCondition: () => string
  addConfig: () => string
  addFactor: () => string
  addMatrixCell: () => string
  addCard: (patch?: Partial<TeCard>) => string
  addFinding: () => string
  addChange: () => string

  // Card lifecycle
  /** Issue is blocked while cardIssueBlockers returns any blocker. */
  issueCard: (cardId: string) => string[]
  /** Supersedes the issued card and creates the next draft version. */
  reviseCard: (cardId: string) => string | null

  // Execution
  createRunFromCard: (cardId: string) => string | null
  markRunEvent: (runId: string, mark: string, note?: string) => void
  adjudicateRun: (runId: string, validity: TeRunValidity, by: string, reason: string) => void
  addDeviation: (runId: string) => string | null
  addAnomaly: (runId: string | null) => string
  startChecklist: (template: ChecklistTemplate, runId?: string | null) => string
  recordGoNoGo: (
    scope: GoNoGoScope,
    decision: GoNoGo,
    approvers: string,
    note?: string,
  ) => string
  addDebrief: (kind: DebriefKind, runId?: string | null) => string
}

function requireCampaign(s: { campaigns: TeCampaign[]; activeCampaignId: string | null }) {
  return s.campaigns.find((c) => c.id === s.activeCampaignId) ?? null
}

export const useTeStore = create<TeStore>()((set, get) => {
  /** Apply a change to the active campaign. */
  function mutate(fn: (c: TeCampaign) => TeCampaign) {
    set((s) => {
      const active = requireCampaign(s)
      if (!active) return s
      const next = fn(active)
      if (next === active) return s
      return { campaigns: s.campaigns.map((c) => (c.id === active.id ? next : c)) }
    })
  }

  /** Allocate a grammar id on the active campaign and hand it to `build`. */
  function allocate(code: TypeCode, build: (c: TeCampaign, id: string) => TeCampaign): string {
    let allocated = ''
    mutate((c) => {
      const { id, seq } = nextId(c.seq, c.code, code)
      allocated = id
      return build({ ...c, seq }, id)
    })
    return allocated
  }

  function push<K extends TeListKey>(c: TeCampaign, key: K, item: TeCampaign[K][number]): TeCampaign {
    return { ...c, [key]: [...c[key], item] }
  }

  return {
    schemaVersion: 1,
    campaigns: [],
    activeCampaignId: null,
    ui: { workspace: 'board', phase: 'campaign', selected: {} },

    setWorkspace: (w) => set((s) => ({ ui: { ...s.ui, workspace: w } })),
    setPhase: (p) => set((s) => ({ ui: { ...s.ui, phase: p } })),
    selectRecord: (key, id) =>
      set((s) => ({ ui: { ...s.ui, selected: { ...s.ui.selected, [key]: id } } })),

    createCampaign: (name, code) => {
      const c = emptyCampaign(name || 'Untitled campaign', code || 'CAMP')
      set((s) => ({ campaigns: [...s.campaigns, c], activeCampaignId: c.id }))
      return c.id
    },

    deleteCampaign: (id) =>
      set((s) => ({
        campaigns: s.campaigns.filter((c) => c.id !== id),
        activeCampaignId: s.activeCampaignId === id ? null : s.activeCampaignId,
      })),

    setActiveCampaign: (id) => set({ activeCampaignId: id }),

    loadCampaign: (c) =>
      set((s) => {
        const item = s.campaigns.some((x) => x.id === c.id) ? { ...c, id: newId('tecamp') } : c
        return { campaigns: [...s.campaigns, item], activeCampaignId: item.id }
      }),

    replaceState: (st) =>
      set({ schemaVersion: 1, campaigns: st.campaigns, activeCampaignId: st.activeCampaignId }),

    patchCampaign: (patch) => mutate((c) => ({ ...c, ...patch })),

    addItem: (key, item) => mutate((c) => push(c, key, item)),

    patchItem: (key, id, patch) =>
      mutate((c) => ({
        ...c,
        [key]: c[key].map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })),

    removeItem: (key, id) =>
      mutate((c) => ({ ...c, [key]: c[key].filter((r) => r.id !== id) })),

    addQuestion: () => allocate('Q', (c, id) => push(c, 'questions', emptyQuestion(id))),

    addHypothesis: (questionId) =>
      allocate('HYP', (c, id) => push(c, 'hypotheses', emptyHypothesis(id, questionId))),

    addMeasure: (questionId) =>
      allocate('M', (c, id) => push(c, 'measures', emptyMeasure(id, questionId))),

    addThreat: () => allocate('THR', (c, id) => push(c, 'threats', emptyThreat(id))),

    addCondition: () => allocate('COND', (c, id) => push(c, 'conditions', emptyCondition(id))),

    addConfig: () => allocate('CFG', (c, id) => push(c, 'configs', emptyConfig(id))),

    addFactor: () => allocate('FAC', (c, id) => push(c, 'factors', emptyFactor(id))),

    addMatrixCell: () => allocate('MTX', (c, id) => push(c, 'matrix', emptyMatrixCell(id))),

    addCard: (patch) => {
      let internalId = ''
      allocate('TC', (c, code) => {
        internalId = newId('tec')
        const card = { ...emptyCard(internalId, code), ...patch }
        return push(c, 'cards', card)
      })
      return internalId
    },

    addFinding: () => allocate('FIND', (c, id) => push(c, 'findings', emptyFinding(id))),

    addChange: () => allocate('CHG', (c, id) => push(c, 'changes', emptyChange(id))),

    issueCard: (cardId) => {
      const c = requireCampaign(get())
      const card = c?.cards.find((x) => x.id === cardId)
      if (!c || !card) return ['Card not found.']
      const blockers = cardIssueBlockers(c, card)
      if (blockers.length > 0) return blockers
      mutate((camp) => ({
        ...camp,
        cards: camp.cards.map((x) =>
          x.id === cardId ? { ...x, status: 'issued' as const, effectiveAt: nowIso() } : x,
        ),
      }))
      return []
    },

    reviseCard: (cardId) => {
      const c = requireCampaign(get())
      const card = c?.cards.find((x) => x.id === cardId)
      if (!c || !card) return null
      const nid = newId('tec')
      const revised: TeCard = {
        ...JSON.parse(JSON.stringify(card)),
        id: nid,
        version: bumpMajor(card.version),
        status: 'draft',
        effectiveAt: null,
        coldReaderAt: null,
        dryRunAt: null,
      }
      mutate((camp) => ({
        ...camp,
        cards: [
          ...camp.cards.map((x) =>
            x.id === cardId ? { ...x, status: 'superseded' as const } : x,
          ),
          revised,
        ],
      }))
      return nid
    },

    createRunFromCard: (cardId) => {
      const c = requireCampaign(get())
      const card = c?.cards.find((x) => x.id === cardId)
      if (!c || !card || card.status !== 'issued') return null
      let runId: string | null = null
      allocate('RUN', (camp, id) => {
        runId = id
        const run: TeRun = { ...emptyRun(id, card), startAt: nowIso() }
        return push(camp, 'runs', run)
      })
      return runId
    },

    markRunEvent: (runId, mark, note = '') =>
      mutate((c) => ({
        ...c,
        runs: c.runs.map((r) =>
          r.id === runId
            ? { ...r, events: [...r.events, { id: newId('evt'), mark, at: nowIso(), note }] }
            : r,
        ),
      })),

    adjudicateRun: (runId, validity, by, reason) =>
      mutate((c) => ({
        ...c,
        runs: c.runs.map((r) =>
          r.id === runId
            ? {
                ...r,
                validity,
                adjudications: [
                  ...r.adjudications,
                  { version: r.adjudications.length + 1, at: nowIso(), by, validity, reason },
                ],
              }
            : r,
        ),
      })),

    addDeviation: (runId) => {
      const c = requireCampaign(get())
      const run = c?.runs.find((r) => r.id === runId)
      if (!c || !run) return null
      let devId: string | null = null
      allocate('DEV', (camp, id) => {
        devId = id
        const withDev = push(camp, 'deviations', emptyDeviation(id, run.id, run.cardId))
        return {
          ...withDev,
          runs: withDev.runs.map((r) =>
            r.id === runId ? { ...r, deviationIds: [...r.deviationIds, id] } : r,
          ),
        }
      })
      return devId
    },

    addAnomaly: (runId) =>
      allocate('ANOM', (camp, id) => {
        const withAnom = push(camp, 'anomalies', emptyAnomaly(id, runId))
        if (!runId) return withAnom
        return {
          ...withAnom,
          runs: withAnom.runs.map((r) =>
            r.id === runId ? { ...r, anomalyIds: [...r.anomalyIds, id] } : r,
          ),
        }
      }),

    startChecklist: (template, runId = null) =>
      allocate('CHK', (camp, id) => {
        const inst: TeChecklist = {
          id,
          templateKey: template.key,
          name: template.name,
          phase: template.phase,
          runner: template.runner,
          startedAt: nowIso(),
          completedAt: null,
          items: template.items.map((it) => ({
            text: it.text,
            type: it.type,
            state: 'unchecked',
            value: '',
            completer: '',
            at: null,
            naReason: '',
          })),
          outcome: null,
          conditionalLimits: '',
          runId,
          dayDate: nowIso().slice(0, 10),
        }
        return push(camp, 'checklists', inst)
      }),

    recordGoNoGo: (scope, decision, approvers, note = '') =>
      allocate('GNG', (camp, id) =>
        push(camp, 'gonogos', {
          id,
          scope,
          decision,
          at: nowIso(),
          approvers,
          affectedConclusions: '',
          note,
        }),
      ),

    addDebrief: (kind, runId = null) =>
      allocate('DBF', (camp, id) =>
        push(camp, 'debriefs', {
          id,
          kind,
          runId,
          date: nowIso().slice(0, 10),
          answers: [],
          improvements: [],
        }),
      ),
  }
})

/** The active campaign, or null before one exists. */
export function activeCampaign(s: {
  campaigns: TeCampaign[]
  activeCampaignId: string | null
}): TeCampaign | null {
  return requireCampaign(s)
}

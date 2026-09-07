/**
 * T&E Operations store. Separate from the canvas scenario store on purpose:
 * campaign records are versioned and append-only, so there is no undo here.
 * Persistence key: rangeboard.te.v1 (src/te/io/persistTe.ts).
 */

import { create } from 'zustand'
import { savedView, writeView } from '../../io/viewState'

import type {
  CampaignPhase,
  ChecklistTemplate,
  DebriefKind,
  GoNoGo,
  GoNoGoScope,
  MeasureObservation,
  TeAction,
  TeCampaign,
  TeCard,
  TeChecklist,
  TeRun,
  TeRunValidity,
  TeState,
} from '../model/types'
import type { TypeCode } from '../model/ids'
import { bumpMajor, bumpMinor, nextId } from '../model/ids'
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
import {
  campaignReferenceBlockers, cardIssueBlockers, checklistBlockers, deliveryBlockers, designBlockers,
  qualificationBlockers, sanitizeCardTemplatePatch,
} from '../validate'
import { MAX_IMAGE_CODE_UNITS, validateImage, validateShape } from '../../io/runtimeValidation'
import { validateCampaignShape } from '../io/validateTe'

/** Campaign fields that are arrays of records keyed by `id`. */
type TeListKey = {
  [K in keyof TeCampaign]-?: TeCampaign[K] extends Array<{ id: string }> ? K : never
}[keyof TeCampaign]

/** Admission applies only to newly supplied payloads; legacy stored values remain editable. */
function admitStoredPayload(key: TeListKey, value: object, previous?: object): void {
  if (key === 'frames' && 'pngDataUrl' in value && typeof value.pngDataUrl === 'string' &&
      (!previous || !('pngDataUrl' in previous) || value.pngDataUrl !== previous.pngDataUrl)) {
    validateImage(value.pngDataUrl, 'Frame capture', true)
  }
  if (key === 'configs' && 'scenarioSnapshot' in value && typeof value.scenarioSnapshot === 'string' &&
      (!previous || !('scenarioSnapshot' in previous) || value.scenarioSnapshot !== previous.scenarioSnapshot) &&
      value.scenarioSnapshot.length > MAX_IMAGE_CODE_UNITS) {
    throw new Error('Board snapshot exceeds the 5 MiB browser-storage budget. Reduce the scenario or its underlay image before capturing.')
  }
}

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

interface TeStore {
  schemaVersion: 1
  campaigns: TeCampaign[]
  activeCampaignId: string | null
  ui: TeUi
  /** Ephemeral autosave status. Set by persistTe after each write attempt; never persisted. */
  lastSavedAt: string | null
  saveError: string | null
  setSaveState: (lastSavedAt: string | null, saveError: string | null) => void

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
  /**
   * New campaign copying structure from an existing one.
   * Copies people, organizations, the acceptance block, roles, authorities,
   * decision rights, schedule, registers, factors, measures, threats,
   * conditions, configs, and question skeletons. Never copies evidence:
   * cards, runs, findings, freezes, dispositions, and dates stay clear.
   * All ids reallocate under the new campaign code.
   */
  startFromCampaign: (sourceId: string, name?: string, code?: string) => string | null
  /**
   * Seeds the active campaign from a preset. Presets seed
   * structure and recommended records only; text placeholders use [brackets]
   * so the card gate catches them. Facts are never fabricated.
   */
  applyPreset: (presetKey: string) => Promise<void>
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
  /** New draft card prelinked to a matrix cell, with linked-record text filled. */
  createCardFromMatrixCell: (cellId: string) => string | null
  /** New draft diagnostic card titled from the anomaly; the card code writes back to verificationTest. */
  createDiagnosticCard: (anomalyId: string) => string | null
  /** New open action linked to the finding, with requiredWork from recommendedAction. */
  createActionFromFinding: (findingId: string) => string | null
  /** Clones a config baseline's text fields, bumps the minor version, and clears the freeze. */
  duplicateConfig: (configId: string) => string | null
  /** Minor version bump on a versioned record. Frozen records stay locked. */
  bumpRecordVersion: <K extends TeListKey>(key: K, id: string) => void

  // Gate decisions
  passQualificationGate: () => void
  approveDesign: (warningsAcknowledged?: boolean) => void

  // Card lifecycle
  /** Issue is blocked while cardIssueBlockers returns any blocker. */
  issueCard: (cardId: string) => string[]
  /** Supersedes the issued card and creates the next draft version. */
  reviseCard: (cardId: string) => string | null

  // Execution
  createRunFromCard: (cardId: string) => string | null
  markRunEvent: (runId: string, mark: string, note?: string) => void
  adjudicateRun: (runId: string, validity: TeRunValidity, by: string, reason: string) => void
  /** Correct an adjudicated observation with the original values retained; re-adjudication follows. */
  amendRunObservations: (runId: string, observations: MeasureObservation[], by: string, reason: string) => void
  /** Exclusion has a recorded reason and never deletes evidence. */
  setRunExcluded: (runId: string, excluded: boolean, reason: string) => void
  /** Discard only an empty, unadjudicated attempt; never reuse its number. */
  discardRun: (runId: string) => void
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

  // Delivery
  markPackageDelivered: () => void
}

function requireCampaign(s: { campaigns: TeCampaign[]; activeCampaignId: string | null }) {
  return s.campaigns.find((c) => c.id === s.activeCampaignId) ?? null
}

const PHASE_ORDER: CampaignPhase[] = [
  'candidate',
  'qualified',
  'defined',
  'designed',
  'integrated',
  'ready',
  'executing',
  'analyzing',
  'decision-ready',
  'closed',
]

/** Forward-only phase advance; a campaign never moves backward. */
function advance(c: TeCampaign, phase: CampaignPhase): TeCampaign {
  if (PHASE_ORDER.indexOf(phase) <= PHASE_ORDER.indexOf(c.phase)) return c
  return { ...c, phase }
}

/**
 * Card text derived from the records the card links to.
 * With `all` false only empty fields fill; `all` true overwrites every
 * derived field (the explicit refill path).
 */
export function linkedRecordFill(c: TeCampaign, card: TeCard, all = false): Partial<TeCard> {
  const patch: Partial<TeCard> = {}
  const put = (key: keyof TeCard & string, current: string, next: string) => {
    if (next.trim() === '') return
    if (!all && current.trim() !== '') return
    ;(patch as Record<string, unknown>)[key] = next
  }
  const config = c.configs.find((x) => x.id === card.configId)
  if (config) {
    put(
      'systemStateNote',
      card.systemStateNote,
      [config.name && `${config.name} ${config.version}`, config.settingsAndModes]
        .filter((t) => t && t.trim() !== '')
        .join('; '),
    )
    put('trainingState', card.trainingState, config.operatorsAndTraining)
  }
  const threat = c.threats.find((x) => x.id === card.threatId)
  if (threat) {
    put('redControlled', card.redControlled, threat.redControlledVariables)
    put('redFixed', card.redFixed, threat.redFixedVariables)
    put('blinding', card.blinding, threat.blinding)
  }
  const cond = c.conditions.find((x) => x.id === card.conditionId)
  if (cond) {
    put(
      'conditionNote',
      card.conditionNote,
      [cond.name, cond.weatherAndIllumination, cond.emEnvironment]
        .filter((t) => t.trim() !== '')
        .join('; '),
    )
  }
  put(
    'operatingLimits',
    card.operatingLimits,
    c.authorities
      .filter((a) => a.status === 'active' && a.operatingLimits.trim() !== '')
      .map((a) => a.operatingLimits)
      .join('; '),
  )
  const measures = card.measureIds
    .map((id) => c.measures.find((m) => m.id === id))
    .filter((m) => m !== undefined)
  if (measures.length > 0) {
    put(
      'dataSources',
      card.dataSources,
      [
        ...new Set(
          measures.flatMap((m) => [m.truth.primarySource, m.truth.backupSource]).filter((t) => t.trim() !== ''),
        ),
      ].join('\n'),
    )
    put(
      'groundTruth',
      card.groundTruth,
      [
        ...new Set(
          measures
            .map((m) =>
              [m.truth.primarySource, m.truth.independenceFromSut].filter((t) => t.trim() !== '').join('; '),
            )
            .filter((t) => t !== ''),
        ),
      ].join('\n'),
    )
    const tolerances = measures
      .map((m) => m.truth.timeToleranceS)
      .filter((t): t is number => t !== null)
    if (tolerances.length > 0) {
      put(
        'commonTimeAndTolerance',
        card.commonTimeAndTolerance,
        `Common time base; tightest tolerance ${Math.min(...tolerances)} s`,
      )
    }
  }
  const cell = c.matrix.find((x) => x.id === card.matrixCellId)
  if (cell) put('orderAndBlocking', card.orderAndBlocking, cell.orderOrBlock)
  put(
    'resultThatCouldChangeDecision',
    card.resultThatCouldChangeDecision,
    c.decision.resultThatChangesChoice,
  )
  const q = card.questionIds.map((id) => c.questions.find((x) => x.id === id)).find((x) => x !== undefined)
  if (q) put('purpose', card.purpose, q.wording)
  const hyp = card.hypothesisIds
    .map((id) => c.hypotheses.find((h) => h.id === id))
    .find((h) => h !== undefined)
  if (hyp) {
    put(
      'prediction',
      card.prediction,
      [hyp.predictedValue, hyp.producesBehavior].filter((t) => t.trim() !== '').join('; '),
    )
  }
  return patch
}

export const useTeStore = create<TeStore>()((set, get) => {
  /** Apply a change to the active campaign. */
  function mutate(fn: (c: TeCampaign) => TeCampaign) {
    let accepted = false
    set((s) => {
      const active = requireCampaign(s)
      if (!active || active.phase === 'closed') return s
      const next = fn(active)
      if (active.evidencePackage.deliveredAt &&
          (next.phase !== 'closed' || JSON.stringify({ ...next, phase: active.phase }) !==
            JSON.stringify(active))) return s
      if (next === active || campaignReferenceBlockers(next).length > 0) return s
      try { validateCampaignShape(next) } catch { return s }
      accepted = true
      return { campaigns: s.campaigns.map((c) => (c.id === active.id ? next : c)) }
    })
    return accepted
  }

  /** Allocate a grammar id on the active campaign and hand it to `build`. */
  function allocate(code: TypeCode, build: (c: TeCampaign, id: string) => TeCampaign): string {
    let allocated = ''
    const accepted = mutate((c) => {
      const used = new Set(Object.values(c).flatMap(value => Array.isArray(value)
        ? value.flatMap(r => r && typeof r === 'object' && 'id' in r
          ? [r.id, ...('cardCode' in r ? [r.cardCode] : [])] : []) : []))
      let allocation = nextId(c.seq, c.code, code)
      while (used.has(allocation.id) && Number.isSafeInteger(allocation.seq[code]))
        allocation = nextId(allocation.seq, c.code, code)
      if (!Number.isSafeInteger(allocation.seq[code])) return c
      allocated = allocation.id
      return build({ ...c, seq: allocation.seq }, allocation.id)
    })
    return accepted ? allocated : ''
  }

  function push<K extends TeListKey>(c: TeCampaign, key: K, item: TeCampaign[K][number]): TeCampaign {
    return { ...c, [key]: [...c[key], item] }
  }

  return {
    schemaVersion: 1,
    campaigns: [],
    activeCampaignId: null,
    ui: { workspace: savedView().workspace ?? 'board', phase: 'campaign', selected: {} },
    lastSavedAt: null,
    saveError: null,

    setSaveState: (lastSavedAt, saveError) => set({ lastSavedAt, saveError }),

    setWorkspace: (w) => {
      writeView({ workspace: w })
      set((s) => ({ ui: { ...s.ui, workspace: w } }))
    },

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

    setActiveCampaign: (id) => {
      if (get().campaigns.some(c => c.id === id)) set({ activeCampaignId: id })
    },

    loadCampaign: (c) =>
      set((s) => {
        try { validateCampaignShape(c) } catch { return s }
        if (campaignReferenceBlockers(c).length > 0 ||
            (c.evidencePackage.deliveredAt && deliveryBlockers(c).length > 0)) return s
        c = structuredClone(c)
        const item = s.campaigns.some((x) => x.id === c.id) ? { ...c, id: newId('tecamp') } : c
        return { campaigns: [...s.campaigns, item], activeCampaignId: item.id }
      }),

    startFromCampaign: (sourceId, name, code) => {
      const src = get().campaigns.find((x) => x.id === sourceId)
      if (!src) return null
      const next = emptyCampaign(name ?? `${src.name} restart`, code ?? src.code)
      next.sourceCampaignId = src.id
      let seq = next.seq
      const alloc = (type: TypeCode): string => {
        const r = nextId(seq, next.code, type)
        seq = r.seq
        return r.id
      }
      // Charter: organizations, people, security class, and the acceptance
      // block copy. Every date and every campaign-specific fact stays clear.
      next.charter = {
        ...next.charter,
        sponsor: src.charter.sponsor,
        requestingOrganization: src.charter.requestingOrganization,
        customerDecisionOwner: src.charter.customerDecisionOwner,
        evidenceAcceptanceAuthority: src.charter.evidenceAcceptanceAuthority,
        deploymentStrategist: src.charter.deploymentStrategist,
        contractAndFundingOwner: src.charter.contractAndFundingOwner,
        dataSecurityReleaseClass: src.charter.dataSecurityReleaseClass,
        acceptance: { ...src.charter.acceptance },
      }
      next.roles = src.roles.map((r) => ({ ...r, id: alloc('ROLE') }))
      next.authorities = src.authorities.map((a) => ({
        ...a,
        id: alloc('AUTH'),
        status: 'pending' as const,
        dueDate: '',
        evidence: '',
      }))
      next.decisionRights = src.decisionRights.map((d) => ({ ...d, id: newId('dr') }))
      next.schedule = src.schedule.map((s) => ({ ...s, id: alloc('SCH'), done: false }))
      const regCode: Record<string, TypeCode> = {
        claim: 'CLM',
        unknown: 'UNK',
        assumption: 'ASM',
        'known-fact': 'REG',
      }
      next.registers = src.registers.map((r) => ({
        ...r,
        id: alloc(regCode[r.kind] ?? 'REG'),
        disposition: null,
        dispositionNote: '',
      }))
      next.factors = src.factors.map((f) => ({ ...f, id: alloc('FAC') }))
      const qMap = new Map<string, string>()
      next.questions = src.questions.map((q) => {
        const id = alloc('Q')
        qMap.set(q.id, id)
        return {
          ...q,
          id,
          requiredAnswerDate: '',
          frozen: false,
          disposition: null,
          evidenceLevel: null,
          dispositionNote: '',
        }
      })
      next.measures = src.measures.map((m) => ({
        ...m,
        id: alloc('M'),
        questionId: qMap.get(m.questionId) ?? '',
        hypothesisIds: [],
        frozen: false,
        thresholdApproved: false,
      }))
      next.threats = src.threats.map((t) => ({ ...t, id: alloc('THR'), version: 'v1.0' }))
      next.conditions = src.conditions.map((cd) => ({ ...cd, id: alloc('COND') }))
      next.configs = src.configs.map((cfg) => ({
        ...cfg,
        id: alloc('CFG'),
        version: 'v1.0',
        frozen: false,
        freezeTime: '',
        functionalCheckResult: '',
        releasedBy: '',
        scenarioSnapshot: null,
        driftLog: [],
      }))
      next.seq = seq
      set((s) => ({ campaigns: [...s.campaigns, next], activeCampaignId: next.id }))
      return next.id
    },

    applyPreset: async (presetKey) => {
      // The measure dictionary, the card templates and the threat vignettes are 62 KB of
      // seed data that only a preset reads. They load with the action, not at startup.
      const [{ MEASURE_DICTIONARY, measureFromDict }, { CARD_TEMPLATES }, { THREAT_VIGNETTES }] =
        await Promise.all([
          import('../seed/measureDictionary'),
          import('../seed/cardTemplates'),
          import('../seed/vignettes'),
        ])
      if (!requireCampaign(get())) return
      /** Question skeleton. Placeholder wording; the card gate catches [brackets]. */
      const seedQuestion = (
        wording: string,
        pattern: TeCampaign['questions'][number]['pattern'],
      ): string => {
        const id = get().addQuestion()
        get().patchItem('questions', id, { wording, pattern, priority: 'P1' as const })
        return id
      }
      /** Measures from the dictionary. Structure and wording only, no values. */
      const seedMeasures = (dictKeys: string[], questionId: string): Map<string, string> => {
        const byDict = new Map<string, string>()
        for (const key of dictKeys) {
          const entry = MEASURE_DICTIONARY.find((e) => e.dictKey === key)
          if (!entry) continue
          const id = get().addMeasure(questionId)
          get().patchItem('measures', id, measureFromDict(entry, id, questionId))
          byDict.set(key, id)
        }
        return byDict
      }
      const seedThreat = (vignetteKey: string | null, patch?: Partial<TeCampaign['threats'][number]>): string => {
        const id = get().addThreat()
        const v = vignetteKey ? THREAT_VIGNETTES.find((x) => x.key === vignetteKey) : undefined
        if (v) get().patchItem('threats', id, v.patch)
        if (patch) get().patchItem('threats', id, patch)
        return id
      }
      /** Card draft from a worked template, relinked to the seeded records. */
      const seedCard = (
        templateKey: string,
        questionId: string | null,
        measuresByDict: Map<string, string>,
      ): string | null => {
        const t = CARD_TEMPLATES.find((x) => x.key === templateKey)
        if (!t) return null
        const patch: Partial<TeCard> = { ...t.patch }
        if (questionId) patch.questionIds = [questionId]
        if (patch.measureIds)
          patch.measureIds = patch.measureIds.map((k) => measuresByDict.get(k) ?? k)
        return get().addCard(sanitizeCardTemplatePatch(requireCampaign(get())!, patch))
      }
      switch (presetKey) {
        case 'sensor-characterization': {
          get().patchCampaign({
            charter: {
              ...requireCampaign(get())!.charter,
              engagementType: 'characterization',
              valkrynTasking: 'characterize',
            },
          })
          const q = seedQuestion(
            'Where does the sensor detect and hold a stable track against [threat] under [conditions]?',
            'performance',
          )
          const ms = seedMeasures(
            [
              'CUAS-SEN-PD-001',
              'CUAS-SEN-FD-002',
              'CUAS-TRK-FST-003',
              'CUAS-TRK-CONT-004',
              'CUAS-TRK-ERR-005',
              'CUAS-SUR-FTR-007',
            ],
            q,
          )
          seedCard('TC-CUAS-SEN-CHAR-001', q, ms)
          break
        }
        case 'radar-comparison': {
          get().patchCampaign({
            charter: {
              ...requireCampaign(get())!.charter,
              engagementType: 'comparison',
              valkrynTasking: 'compare',
            },
          })
          const q = seedQuestion(
            'Does [radar A] or [radar B] detect and track [threat] better under [conditions]?',
            'comparison',
          )
          const ms = seedMeasures(
            ['CUAS-SEN-PD-001', 'CUAS-SEN-FD-002', 'CUAS-TRK-FST-003', 'CUAS-TRK-ERR-005'],
            q,
          )
          const cfgA = get().addConfig()
          get().patchItem('configs', cfgA, { name: '[radar A]' })
          const cfgB = get().addConfig()
          get().patchItem('configs', cfgB, { name: '[radar B]' })
          const baseline = get().addMatrixCell()
          get().patchItem('matrix', baseline, {
            questionId: q,
            configId: cfgA,
            method: 'baseline comparison',
            measureIds: [...ms.values()],
          })
          const delta = get().addMatrixCell()
          get().patchItem('matrix', delta, {
            questionId: q,
            configId: cfgB,
            method: 'comparison',
            measureIds: [...ms.values()],
          })
          break
        }
        case 'sensor-c2-integration': {
          const q = seedQuestion(
            'Does the sensor hand a decision-ready track to the C2 within [time]?',
            'capability',
          )
          const ms = seedMeasures(['CUAS-C2-HS-008', 'CUAS-C2-LAT-009', 'CUAS-MSN-UWT-010'], q)
          seedCard('TC-CUAS-C2-HANDOFF-001', q, ms)
          break
        }
        case 'c2-track-fusion': {
          get().patchCampaign({
            charter: {
              ...requireCampaign(get())!.charter,
              engagementType: 'evaluation',
              valkrynTasking: 'validate',
            },
          })
          const q = seedQuestion(
            'Does the C2 fuse multi-sensor tracks into one decision-ready picture under [conditions]?',
            'capability',
          )
          seedMeasures(
            ['CUAS-C2-HS-008', 'CUAS-C2-LAT-009', 'CUAS-TRK-CONT-004', 'CUAS-HMI-INT-018'],
            q,
          )
          seedThreat('V-08')
          seedThreat('V-09')
          break
        }
        case 'ew-resilience': {
          const q = seedQuestion(
            'Does the system keep detecting and defeating [threat] in a contested spectrum?',
            'boundary',
          )
          const ms = seedMeasures(['CUAS-EW-EFF-011', 'CUAS-EW-REC-012', 'CUAS-MSN-E2E-015'], q)
          const cond = get().addCondition()
          get().patchItem('conditions', cond, {
            name: '[contested spectrum condition]',
            emEnvironment: 'contested',
          })
          seedThreat(null, { opforMode: 'bounded-adaptive' })
          seedCard('TC-CUAS-EW-SOFTKILL-001', q, ms)
          break
        }
        case 'interceptor-evaluation': {
          get().patchCampaign({
            charter: {
              ...requireCampaign(get())!.charter,
              engagementType: 'evaluation',
              valkrynTasking: 'validate',
            },
          })
          const q = seedQuestion(
            'Does the interceptor defeat [threat] before it reaches the defended asset?',
            'performance',
          )
          const ms = seedMeasures(
            [
              'CUAS-C2-LAT-009',
              'CUAS-MSN-UWT-010',
              'CUAS-DEF-PINT-013',
              'CUAS-DEF-PDEF-014',
              'CUAS-MSN-E2E-015',
            ],
            q,
          )
          seedCard('TC-CUAS-DEF-INTERCEPT-001', q, ms)
          break
        }
        case 'detect-to-defeat': {
          const q1 = seedQuestion(
            'Where does the system first detect [threat] under [conditions]?',
            'performance',
          )
          seedQuestion('Does the track survive handoff to the effector?', 'capability')
          const q3 = seedQuestion(
            'Does the system defeat a raid of [count] before boundary crossing?',
            'mission-effect',
          )
          const ms1 = seedMeasures(
            [
              'CUAS-MSN-UWT-010',
              'CUAS-SEN-PD-001',
              'CUAS-TRK-ERR-005',
              'CUAS-TRK-CONT-004',
              'CUAS-C2-LAT-009',
              'CUAS-SUR-FTR-007',
            ],
            q1,
          )
          const ms3 = seedMeasures(
            ['CUAS-C2-HS-008', 'CUAS-SAT-LEAK-016', 'CUAS-HMI-INT-018', 'CUAS-MSN-E2E-015'],
            q3,
          )
          seedThreat('V-01')
          seedCard('TC-CUAS-SOS-EWBUF-001', q1, ms1)
          seedCard(
            'TC-CUAS-SAT-RAID-001',
            q3,
            new Map([...ms1.entries(), ...ms3.entries()]),
          )
          break
        }
        case 'regression-test': {
          // The structural copy routes through startFromCampaign first.
          get().patchCampaign({
            charter: {
              ...requireCampaign(get())!.charter,
              engagementType: 'evaluation',
              valkrynTasking: 'validate',
            },
          })
          const cell = get().addMatrixCell()
          get().patchItem('matrix', cell, {
            method: 'baseline comparison',
            notes: 'Repeat of the previous baseline.',
          })
          break
        }
        default:
          // 'blank', 'previous-campaign', unknown keys: record the pick only.
          break
      }
      get().patchCampaign({ presetKey })
    },

    replaceState: (st) => {
      try { validateShape(st, 'TeState', 'te', true) } catch { return }
      if (st.schemaVersion !== 1 || new Set(st.campaigns.map(c => c.id)).size !== st.campaigns.length ||
          (st.activeCampaignId !== null && !st.campaigns.some(c => c.id === st.activeCampaignId))) return
      for (const c of st.campaigns) {
        try { validateCampaignShape(c) } catch { return }
        if (campaignReferenceBlockers(c).length > 0 ||
            (c.evidencePackage.deliveredAt && deliveryBlockers(c).length > 0)) return
      }
      // Adoption cannot rewrite existing evidence. Imported copies use loadCampaign instead.
      for (const old of get().campaigns) {
        const incoming = st.campaigns.find(c => c.id === old.id)
        if (old.cards.some(card => card.status === 'issued' || card.status === 'superseded') ||
            old.runs.length > 0 || old.evidencePackage.deliveredAt) {
          if (JSON.stringify(old) !== JSON.stringify(incoming)) return
        }
      }
      set(structuredClone({ schemaVersion: 1 as const, campaigns: st.campaigns,
        activeCampaignId: st.activeCampaignId }))
    },

    patchCampaign: (patch) => mutate((c) => {
      if (patch.code !== undefined && Object.values(c.seq).some(n => n > 0)) return c
      if (Object.keys(patch).some(key => ['id', 'seq', 'createdAt',
        'qualificationPassedAt', 'designApprovedAt'].includes(key) ||
        Array.isArray(c[key as keyof TeCampaign]))) return c
      if (patch.phase !== undefined && (patch.phase !== 'closed' ||
          !c.evidencePackage.deliveredAt || deliveryBlockers(c).length > 0)) return c
      if (patch.evidencePackage?.deliveredAt !== c.evidencePackage.deliveredAt &&
          patch.evidencePackage?.deliveredAt !== undefined) return c
      return { ...c, ...structuredClone(patch) }
    }),

    addItem: (key, item) => mutate((c) => {
      if (key === 'runs' || key === 'cards') return c
      if (key === 'checklists' && (item as TeChecklist).completedAt &&
          checklistBlockers(item as TeChecklist).length > 0) return c
      admitStoredPayload(key, item)
      return push(c, key, structuredClone(item))
    }),

    patchItem: (key, id, patch) => mutate((c) => {
      const record = c[key].find(r => r.id === id)
      if (!record || ('id' in patch && patch.id !== id)) return c
      if (key === 'cards') {
        const card = record as TeCard
        if (['issued', 'superseded'].includes(card.status) ||
            Object.keys(patch).some(k => ['cardCode', 'version', 'effectiveAt', 'status'].includes(k))) return c
      }
      if ('frozen' in record && record.frozen) {
        // Question dispositions are post-test conclusions, not changes to the frozen question.
        const allowed = key === 'questions' ? ['disposition', 'dispositionNote', 'evidenceLevel']
          : key === 'configs' ? ['driftLog'] : []
        if (Object.keys(patch).some(k => !allowed.includes(k))) return c
        if (key === 'configs' && 'driftLog' in patch) {
          const old = (record as TeCampaign['configs'][number]).driftLog
          const next = (patch as Partial<TeCampaign['configs'][number]>).driftLog
          if (!next || next.length < old.length || old.some((entry, i) =>
            entry.time !== next[i]?.time || (entry.note !== '' && entry.note !== next[i]?.note))) return c
        }
      }
      if (key === 'checklists') {
        const checklist = record as TeChecklist
        const updated = { ...checklist, ...patch }
        if (checklist.completedAt || (updated.completedAt && checklistBlockers(updated).length > 0)) return c
      }
      if (key === 'runs') {
        const run = record as TeRun
        if (Object.keys(patch).some(k => ['cardId', 'cardVersion', 'matrixCellId',
          'plannedPurpose', 'startAt', 'events', 'validity', 'adjudications',
          'observationAmendments', 'excluded', 'exclusionReason'].includes(k))) return c
        if (run.adjudications.length > 0 && 'observations' in patch) return c
      }
      admitStoredPayload(key, patch, record)
      return { ...c, [key]: c[key].map(r => {
        if (r.id !== id) return r
        const updated = { ...r, ...structuredClone(patch) }
        if (key === 'runs' && (r as TeRun).validity !== 'pending' &&
            Object.keys(patch).some(k => ['allowedMeasureIds', 'limits', 'prohibitedUses',
              'actualConfigId', 'actualThreatId', 'actualConditionId'].includes(k))) {
          return { ...updated, validity: 'pending' }
        }
        return updated
      }) }
    }),

    removeItem: (key, id) => mutate((c) => {
      const record = c[key].find(r => r.id === id)
      if (!record || key === 'runs' ||
          (key === 'cards' && ['issued', 'superseded'].includes((record as TeCard).status)) ||
          ('frozen' in record && record.frozen) ||
          (key === 'checklists' && (record as TeChecklist).completedAt)) return c
      return { ...c, [key]: c[key].filter(r => r.id !== id) }
    }),

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
        const defaults: Partial<TeCard> = {}
        const conductor = c.roles.find((r) => r.role === 'test-conductor')
        if (conductor && conductor.primary.trim() !== '') defaults.owner = conductor.primary
        const last = c.cards[c.cards.length - 1]
        if (last) {
          if (last.storagePath.trim() !== '') defaults.storagePath = last.storagePath
          defaults.siteCalls = { ...last.siteCalls }
        }
        const card = { ...emptyCard(internalId, code), ...defaults, ...structuredClone(patch),
          id: internalId, cardCode: code, version: 'v1.0', status: 'draft' as const, effectiveAt: null }
        return push(c, 'cards', card)
      })
      return requireCampaign(get())?.cards.some(card => card.id === internalId) ? internalId : ''
    },

    createCardFromMatrixCell: (cellId) => {
      const c = requireCampaign(get())
      const cell = c?.matrix.find((x) => x.id === cellId)
      if (!c || !cell) return null
      const id = get().addCard({
        matrixCellId: cell.id,
        questionIds: cell.questionId ? [cell.questionId] : [],
        hypothesisIds: cell.hypothesisId ? [cell.hypothesisId] : [],
        configId: cell.configId || null,
        threatId: cell.threatId || null,
        conditionId: cell.conditionId || null,
        measureIds: [...cell.measureIds],
      })
      const camp = requireCampaign(get())
      const card = camp?.cards.find((x) => x.id === id)
      if (camp && card) {
        const fill = linkedRecordFill(camp, card)
        if (Object.keys(fill).length > 0) get().patchItem('cards', id, fill)
      }
      return id
    },

    createDiagnosticCard: (anomalyId) => {
      const c = requireCampaign(get())
      const anomaly = c?.anomalies.find((a) => a.id === anomalyId)
      if (!c || !anomaly) return null
      const summary = anomaly.observation.trim().slice(0, 60)
      const id = get().addCard({
        title: `Diagnostic: ${summary || anomaly.id}`,
        purpose: summary ? `Isolate the cause of: ${summary}` : `Isolate the cause of anomaly ${anomaly.id}.`,
      })
      const card = requireCampaign(get())?.cards.find((x) => x.id === id)
      if (card) get().patchItem('anomalies', anomalyId, { verificationTest: card.cardCode })
      return id
    },

    createActionFromFinding: (findingId) => {
      const c = requireCampaign(get())
      const finding = c?.findings.find((f) => f.id === findingId)
      if (!c || !finding) return null
      const decisionOwner =
        c.decisionRights.find((r) => r.decisionType === 'customer action')?.accountableAuthority ?? ''
      const action: TeAction = {
        id: newId('act'),
        findingId,
        decisionOwner,
        executionOwner: '',
        dueDate: '',
        requiredWork: finding.recommendedAction,
        evidenceForClosure: '',
        riskIfLate: '',
        status: 'open',
        communicationRequired: '',
      }
      get().addItem('actions', action)
      return action.id
    },

    addFinding: () => allocate('FIND', (c, id) => push(c, 'findings', emptyFinding(id))),

    addChange: () => allocate('CHG', (c, id) => push(c, 'changes', emptyChange(id))),

    duplicateConfig: (configId) => {
      const c = requireCampaign(get())
      const src = c?.configs.find((x) => x.id === configId)
      if (!c || !src) return null
      let cloneId: string | null = null
      allocate('CFG', (camp, id) => {
        cloneId = id
        return push(camp, 'configs', {
          ...src,
          id,
          version: bumpMinor(src.version),
          frozen: false,
          freezeTime: '',
          scenarioSnapshot: null,
          driftLog: [],
        })
      })
      return cloneId
    },

    bumpRecordVersion: (key, id) =>
      mutate((c) => ({
        ...c,
        [key]: c[key].map((r) => {
          if (r.id !== id) return r
          const rec = r as { version?: string; frozen?: boolean }
          if (typeof rec.version !== 'string' || rec.frozen ||
              (key === 'cards' && ['issued', 'superseded'].includes((r as TeCard).status))) return r
          return { ...r, version: bumpMinor(rec.version) }
        }),
      })),

    passQualificationGate: () =>
      mutate((c) => c.qualificationPassedAt || qualificationBlockers(c).length > 0
        ? c : advance({ ...c, qualificationPassedAt: nowIso() }, 'qualified')),

    approveDesign: (acknowledged = false) =>
      mutate((c) => c.designApprovedAt || designBlockers(c, acknowledged).length > 0
        ? c : advance({ ...c, designApprovedAt: nowIso() }, 'designed')),

    issueCard: (cardId) => {
      const c = requireCampaign(get())
      const card = c?.cards.find((x) => x.id === cardId)
      if (!c || !card) return ['Card not found.']
      if (c.evidencePackage.deliveredAt) return ['The delivered campaign is frozen.']
      if (['issued', 'superseded', 'withdrawn', 'closed'].includes(card.status))
        return ['Only a draft or reviewed card can be issued.']
      const blockers = cardIssueBlockers(c, card)
      if (blockers.length > 0) return blockers
      const issued = mutate((camp) =>
        advance(
          {
            ...camp,
            cards: camp.cards.map((x) =>
              x.id === cardId ? { ...x, status: 'issued' as const, effectiveAt: nowIso() } : x,
            ),
          },
          'ready',
        ),
      )
      return issued ? [] : ['Card issue rejected: campaign state or version lineage is invalid.']
    },

    reviseCard: (cardId) => {
      const c = requireCampaign(get())
      const card = c?.cards.find((x) => x.id === cardId)
      if (!c || !card || card.status !== 'issued' || c.evidencePackage.deliveredAt) return null
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
      return requireCampaign(get())?.cards.some(card => card.id === nid) ? nid : null
    },

    createRunFromCard: (cardId) => {
      const c = requireCampaign(get())
      const card = c?.cards.find((x) => x.id === cardId)
      if (!c || !card || card.status !== 'issued' || c.evidencePackage.deliveredAt ||
          campaignReferenceBlockers(c).length > 0) return null
      let runId: string | null = null
      allocate('RUN', (camp, id) => {
        runId = id
        const run: TeRun = { ...emptyRun(id, card), startAt: nowIso() }
        return advance(push(camp, 'runs', run), 'executing')
      })
      return requireCampaign(get())?.runs.some(run => run.id === runId) ? runId : null
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

    adjudicateRun: (runId, validity, by, reason) => mutate((c) => {
      const run = c.runs.find(r => r.id === runId)
      if (!run || validity === 'pending' || !by.trim() || !reason.trim() ||
          (validity === 'conditionally-valid' && run.allowedMeasureIds.length === 0)) return c
      return advance({ ...c, runs: c.runs.map(r => r.id === runId ? {
        ...r, validity,
        adjudications: [...r.adjudications, {
          version: r.adjudications.length + 1, at: nowIso(), by, validity, reason,
          observations: structuredClone(r.observations), allowedMeasureIds: [...r.allowedMeasureIds],
          limits: r.limits, prohibitedUses: r.prohibitedUses,
        }],
      } : r) }, 'analyzing')
    }),

    amendRunObservations: (runId, observations, by, reason) => mutate((c) => {
      const run = c.runs.find(r => r.id === runId)
      if (!run || !by.trim() || !reason.trim() || run.adjudications.length === 0) return c
      return { ...c, runs: c.runs.map(r => r.id === runId ? {
        ...r, observations: structuredClone(observations), validity: 'pending' as const,
        observationAmendments: [...(r.observationAmendments ?? []), {
          at: nowIso(), by, reason, previous: structuredClone(r.observations),
          corrected: structuredClone(observations),
        }],
      } : r) }
    }),

    setRunExcluded: (runId, excluded, reason) => mutate((c) => {
      if (excluded && !reason.trim()) return c
      return { ...c, runs: c.runs.map(r => r.id === runId
        ? { ...r, excluded, exclusionReason: reason } : r) }
    }),

    discardRun: (runId) => mutate((c) => {
      const r = c.runs.find(run => run.id === runId)
      if (!r || r.events.length || r.adjudications.length || r.observationAmendments?.length ||
          r.deviationIds.length || r.anomalyIds.length || r.frameIds.length ||
          r.operatorObservations.trim() || r.dataFilesNote.trim() || r.endAt ||
          r.observations.some(o => o.status !== 'no-test' || o.value !== null ||
            o.success !== null || o.note.trim())) return c
      return { ...c, runs: c.runs.filter(run => run.id !== runId) }
    }),

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
      return requireCampaign(get())?.deviations.some(dev => dev.id === devId) ? devId : null
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

    markPackageDelivered: () =>
      mutate((c) => deliveryBlockers(c).length > 0 ? c :
        advance(
          { ...c, evidencePackage: { ...c.evidencePackage, deliveredAt: nowIso() } },
          'decision-ready',
        ),
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

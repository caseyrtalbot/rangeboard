/**
 * Design stage (SPEC 1.2): ordered decision groups D1 to D9 in one scrolling
 * column. Every control writes the schema field that exists today. Only the
 * stage gate blocks; navigation between groups is free.
 */

import { useState } from 'react'
import type {
  CampaignPhase,
  EvidenceLevel,
  FactorClass,
  FidelityLevel,
  IntervalMethod,
  MeasureFamily,
  MeasureType,
  OpforMode,
  PredictionType,
  QuestionDisposition,
  QuestionPattern,
  QuestionPriority,
  RepresentationClass,
  TeCampaign,
  TeCondition,
  TeConfigBaseline,
  TeFactor,
  TeHypothesis,
  TeMatrixCell,
  TeMeasure,
  TeQuestion,
  TeThreatProfile,
  ThreatMissionKind,
  ThreatProfileClass,
} from '../model/types'
import { THRESHOLD_SOURCES } from '../model/types'
import { useTeStore } from '../state/teStore'
import { useStore } from '../../state/store'
import { deleteImpacts, designLint, type DeleteImpactKind } from '../validate'
import { nowIso } from '../model/empty'
import { MEASURE_DICTIONARY, measureFromDict } from '../seed/measureDictionary'
import { THREAT_VIGNETTES } from '../seed/vignettes'
import { QUESTION_BANKS } from '../seed/questionBanks'
import {
  AIRFRAMES,
  BLINDING_OPTIONS,
  CENSORING_RULES,
  CURRENT_EVIDENCE_STATES,
  DEGRADED_MODES,
  EMISSIONS_BANDS,
  ENVIRONMENT_PRESETS,
  EXPERIMENTAL_UNITS,
  FIDELITY_FEATURES,
  GENERIC_MARKS,
  INVALID_DATA_RULES,
  MATRIX_METHODS,
  MISSING_DATA_RULES,
  NAV_MODES,
  NETWORK_STATES,
  SPECTRUM_STATES,
  STANDARD_COVARIATE_FACTORS,
  TERRAIN_CLASSES,
  TRUTH_INDEPENDENCE,
  WORKLOAD_LEVELS,
} from '../seed/constants'
import { HELP, HINTS, allPeople } from './help'
import {
  AdvancedDisclosure,
  CheckField,
  ChipList,
  DateField,
  DecisionGroup,
  EntityPicker,
  ExampleHint,
  Field,
  GateList,
  MultiPicker,
  NumberField,
  NumberUnitField,
  PersonPicker,
  PhaseIntro,
  Pill,
  Provenance,
  RangeField,
  Seg,
  SelectField,
  StageReview,
  SubTitle,
  SuggestField,
  TextField,
  VersionField,
  fmtDate,
} from './kit'
import {
  AddCellsFlow,
  ChipsString,
  FACTOR_DEFS,
  GeneralizationFields,
  LineRows,
  PATTERN_DEFS,
  PREDICTION_DEFS,
  NULL_DEFAULTS,
  PredictionValueField,
  ProvText,
  QUESTION_TEMPLATES,
  RadioDefs,
  REPRESENTATION_DEFS,
  SampleSizeApply,
  TemplateSentence,
  boardDescribe,
  boardEnvironment,
  measureFor,
  progress,
  rankedDictionary,
  resultTrio,
  short,
  spectrumSevere,
  threatFromModel,
} from './DesignBuilders'

const PRIORITIES: QuestionPriority[] = ['P1', 'P2', 'P3']
const PATTERNS: QuestionPattern[] = [
  'capability',
  'performance',
  'comparison',
  'sensitivity',
  'boundary',
  'reliability',
  'diagnosis',
  'regression',
  'mission-effect',
]
const DISPOSITIONS: QuestionDisposition[] = ['answered', 'partially-answered', 'not-answered']
const EVIDENCE_LEVELS: EvidenceLevel[] = [
  'component-behavior',
  'interface-behavior',
  'mission-conditions',
  'end-to-end-mission-effect',
]
const PREDICTION_TYPES: PredictionType[] = [
  'single-value',
  'range',
  'min-max-bound',
  'distribution',
  'rank-order',
  'directional',
  'pass-miss',
  'no-difference',
  'failure-boundary',
]
const FAMILIES: MeasureFamily[] = ['binomial', 'latency', 'continuous', 'rate', 'count', 'margin']
const MEASURE_TYPES: MeasureType[] = [
  'continuous',
  'binary',
  'count',
  'rate',
  'category',
  'time-to-event',
  'distance',
  'position-error',
  'probability',
  'human-rating',
  'composite-mission-outcome',
]
const INTERVAL_METHODS: IntervalMethod[] = ['wilson', 'exact', 'bayes']
const MISSIONS: ThreatMissionKind[] = [
  'reconnaissance',
  'persistent-observation',
  'route-site-recon',
  'one-way-attack',
  'fpv-attack',
  'munition-delivery',
  'decoy-stimulation',
  'electronic-attack-relay',
  'saturation',
  'combined-recon-attack',
  'post-strike-assessment',
]
const UAS_GROUPS = ['1', '2', '3', '4', '5'] as const
const REPRESENTATION_CLASSES: RepresentationClass[] = [
  'actual-threat',
  'validated-surrogate',
  'generic-representation',
  'model-simulation',
  'hybrid',
]
const FIDELITY_LEVELS: FidelityLevel[] = ['faithful', 'approximated', 'omitted', 'unknown']
const PROFILE_CLASSES: ThreatProfileClass[] = ['mandatory', 'high-probability', 'high-consequence']
const OPFOR_MODES: Array<{ v: OpforMode; help: string }> = [
  { v: 'scripted', help: 'Red flies the exact scripted profile. Most repeatable, least operator realism.' },
  { v: 'bounded-adaptive', help: 'Red chooses only among the listed allowed responses to the listed triggers.' },
  { v: 'free-play', help: 'Red acts freely inside safety and range limits. Hardest to repeat; conclusions generalize least.' },
]
const FACTOR_CLASSES: FactorClass[] = [
  'independent-variable',
  'held-control',
  'recorded-covariate',
  'unobserved-nuisance',
  'bounded-red-choice',
  'prohibited-variable',
  'response',
]
const VAGUE_TERMS = ['usable', 'early enough', 'reliably', 'effective', 'good']
const PHASES: CampaignPhase[] = [
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

function phaseAtLeast(c: TeCampaign, p: CampaignPhase): boolean {
  return PHASES.indexOf(c.phase) >= PHASES.indexOf(p)
}

/** Remove button gated by deleteImpacts (SPEC 11, controlled deletion). */
function RemoveRecord({
  campaign,
  kind,
  id,
  onRemoved,
}: {
  campaign: TeCampaign
  kind: DeleteImpactKind
  id: string
  onRemoved?: () => void
}) {
  const { removeItem } = useTeStore.getState()
  const [confirm, setConfirm] = useState(false)
  const impacts = deleteImpacts(campaign, kind, id)
  const blocked = impacts.length > 0
  return (
    <div className="inspector-actions">
      <button
        className="mini danger"
        disabled={blocked}
        title={blocked ? `In use: ${impacts.join(', ')}` : undefined}
        onBlur={() => setConfirm(false)}
        onClick={() => {
          if (!confirm) {
            setConfirm(true)
            return
          }
          removeItem(kind, id)
          onRemoved?.()
        }}
      >
        {blocked ? `In use: ${impacts.join(', ')}` : confirm ? 'Confirm remove?' : 'Remove'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// D1 Questions
// ---------------------------------------------------------------------------

function QuestionsGroup({ campaign }: { campaign: TeCampaign }) {
  const { addQuestion, patchItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.questions ?? null)
  const q = campaign.questions.find((x) => x.id === selected)
  const set = (patch: Partial<TeQuestion>) => q && patchItem('questions', q.id, patch)
  const vague = q ? VAGUE_TERMS.filter((w) => q.wording.toLowerCase().includes(w)) : []
  const bankOptions = QUESTION_BANKS.flatMap((b) =>
    b.items.map((it, i) => ({ id: `${b.key}:${i}`, label: it, sub: b.key })),
  )
  const addFrom = (wording: string) => {
    const id = addQuestion()
    patchItem('questions', id, { wording })
    selectRecord('questions', id)
  }
  const inheritedDate =
    campaign.decision.decisionDate.trim() || campaign.charter.requestedDecisionDate.trim()
  const authority = campaign.charter.evidenceAcceptanceAuthority.trim()
  return (
    <DecisionGroup
      id="d1"
      question="What must this test answer?"
      hint="Test questions. One testable question with a subject, a condition, and a measurable outcome."
      tier="recommended"
      state={progress(campaign.questions.map((x) => x.wording.trim() !== ''))}
    >
      <EntityPicker
        label="Add from bank"
        help="The bank is the primary path. Pick a vetted question and edit it."
        options={bankOptions}
        value={null}
        onChange={(id) => {
          const opt = bankOptions.find((o) => o.id === id)
          if (opt) addFrom(opt.label)
        }}
        onCreate={(text) => addFrom(text)}
      />
      <ChipList
        items={campaign.questions.map((x) => ({
          id: x.id,
          label: `${short(x.id)}: ${x.wording.slice(0, 32) || 'new'}`,
        }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('questions', id)}
        onAdd={() => selectRecord('questions', addQuestion())}
        addLabel="+ blank question"
      />
      {q && (
        <div className="run-row">
          <RadioDefs
            label="What kind of answer does the customer need?"
            help="Question pattern. It sets the wording template below."
            value={q.pattern}
            options={PATTERNS.map((v) => ({ v, def: PATTERN_DEFS[v] }))}
            onChange={(v) => set({ pattern: v })}
          />
          <Field label="Question wording" help="Use numbers, not adjectives.">
            <TemplateSentence
              key={`${q.id}-${q.pattern}`}
              template={QUESTION_TEMPLATES[q.pattern]}
              value={q.wording}
              onChange={(v) => set({ wording: v })}
            />
          </Field>
          <ExampleHint
            definition={HINTS['question-wording'].definition}
            example={HINTS['question-wording'].example}
            illustrative
          />
          <GateList
            items={vague.length ? [`Vague terms: ${vague.join(', ')}. Quantify them.`] : []}
            kind="warn"
          />
          <div className="field">
            <span>
              Priority
              <span className="help-dot" tabIndex={0} data-help={HELP['question-priority']}>
                ?
              </span>
            </span>
            <Seg
              value={q.priority}
              options={PRIORITIES.map((v) => ({ v, label: v }))}
              onChange={(v) => set({ priority: v })}
            />
          </div>
          <ChipsString
            label="What evidence exists today?"
            options={CURRENT_EVIDENCE_STATES}
            value={q.currentEvidenceState}
            onChange={(v) => set({ currentEvidenceState: v })}
          />
          <TextField
            label="What happens if we do not answer this?"
            value={q.consequenceIfUnanswered}
            onChange={(v) => set({ consequenceIfUnanswered: v })}
            placeholder="The decision the customer cannot make"
          />
          <div className="field-row">
            {inheritedDate !== '' && q.requiredAnswerDate.trim() === '' ? (
              <Provenance
                source="decision date"
                state="pending"
                onConfirm={() => set({ requiredAnswerDate: inheritedDate })}
              >
                <DateField
                  label="Answer needed by"
                  value={q.requiredAnswerDate || null}
                  onChange={(v) => set({ requiredAnswerDate: v ?? '' })}
                />
              </Provenance>
            ) : (
              <DateField
                label="Answer needed by"
                value={q.requiredAnswerDate || null}
                onChange={(v) => set({ requiredAnswerDate: v ?? '' })}
              />
            )}
            {authority !== '' && q.evidenceAuthority.trim() === '' ? (
              <Provenance
                source="charter"
                state="pending"
                onConfirm={() => set({ evidenceAuthority: authority })}
              >
                <PersonPicker
                  label="Who accepts this evidence?"
                  value={q.evidenceAuthority}
                  onChange={(v) => set({ evidenceAuthority: v })}
                  people={allPeople(campaign)}
                />
              </Provenance>
            ) : (
              <PersonPicker
                label="Who accepts this evidence?"
                value={q.evidenceAuthority}
                onChange={(v) => set({ evidenceAuthority: v })}
                people={allPeople(campaign)}
                prefillSource={q.evidenceAuthority.trim() === authority ? 'charter' : undefined}
              />
            )}
          </div>
          <CheckField
            label="Frozen (locks the ranked question set)"
            value={q.frozen}
            onChange={(v) => set({ frozen: v })}
          />
          <p className="muted small">Edits to a frozen question route through a change record.</p>
          {phaseAtLeast(campaign, 'analyzing') && (
            <>
              <div className="field-row">
                <SelectField
                  label="Disposition (set at closeout)"
                  value={q.disposition}
                  allowEmpty="undisposed"
                  options={DISPOSITIONS.map((v) => ({ v, label: v }))}
                  onChange={(v) => set({ disposition: v })}
                />
                <SelectField
                  label="Evidence level reached"
                  value={q.evidenceLevel}
                  allowEmpty="not set"
                  options={EVIDENCE_LEVELS.map((v) => ({ v, label: v }))}
                  onChange={(v) => set({ evidenceLevel: v })}
                />
              </div>
              <TextField
                label="Disposition note"
                rows={2}
                value={q.dispositionNote}
                onChange={(v) => set({ dispositionNote: v })}
              />
            </>
          )}
          <RemoveRecord
            campaign={campaign}
            kind="questions"
            id={q.id}
            onRemoved={() => selectRecord('questions', null)}
          />
        </div>
      )}
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// D2 Test object (configs)
// ---------------------------------------------------------------------------

function ConfigsGroup({ campaign }: { campaign: TeCampaign }) {
  const { addConfig, patchItem, selectRecord, duplicateConfig, bumpRecordVersion } =
    useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.configs ?? null)
  const boundaries = useStore((s) => s.scenario.boundaries)
  useStore((s) => s.scenario.entities.length)
  const people = allPeople(campaign)
  const cfg = campaign.configs.find((x) => x.id === selected)
  const set = (patch: Partial<TeConfigBaseline>) => cfg && patchItem('configs', cfg.id, patch)
  const locked = cfg?.frozen ?? false
  const derived = boardDescribe()

  const add = () => {
    const id = addConfig()
    const d = boardDescribe()
    patchItem('configs', id, {
      sensorConfiguration: d.sensor,
      c2AndNetworkConfiguration: d.c2,
      effectorConfiguration: d.effector,
    })
    selectRecord('configs', id)
  }
  const duplicateLatest = () => {
    const src = campaign.configs[campaign.configs.length - 1]
    if (!src) return
    const id = duplicateConfig(src.id)
    if (id) selectRecord('configs', id)
  }
  const snapshot = () => {
    if (!cfg) return
    const sc = useStore.getState().scenario
    const snap = JSON.stringify({
      name: sc.name,
      entities: sc.entities,
      connections: sc.connections,
      boundaries: sc.boundaries,
      paths: sc.paths,
      environment: sc.environment,
    })
    set({
      scenarioSnapshot: snap,
      driftLog: [
        ...cfg.driftLog,
        { time: nowIso(), note: `Board scenario snapshot captured (${(snap.length / 1024).toFixed(1)} KB)` },
      ],
    })
  }
  const freezeGaps =
    cfg == null
      ? []
      : [
          cfg.name.trim() === '' ? 'name' : '',
          cfg.functionalCheckResult.trim() === '' ? 'functional check' : '',
          cfg.releasedBy.trim() === '' ? 'releaser' : '',
        ].filter((s) => s !== '')

  return (
    <DecisionGroup
      id="d2"
      question="What exact system are we testing?"
      hint="Configuration baseline. It freezes before card issue; changes after freeze need a new baseline."
      state={progress(campaign.configs.map((x) => x.frozen))}
    >
      {campaign.charter.engagementType === 'comparison' && campaign.configs.length < 2 && (
        <p className="muted small">A comparison needs a second baseline configuration.</p>
      )}
      <ChipList
        items={campaign.configs.map((x) => ({
          id: x.id,
          label: `${short(x.id)}: ${x.name || 'new'} ${x.version}${x.frozen ? ' (frozen)' : ''}`,
        }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('configs', id)}
        onAdd={add}
        addLabel="+ baseline"
      />
      {campaign.configs.length > 0 && (
        <div className="inspector-actions">
          <button className="mini" onClick={duplicateLatest}>
            Duplicate latest baseline
          </button>
        </div>
      )}
      {cfg && (
        <div className="run-row">
          <div className="inspector-actions">
            <button className="mini" onClick={snapshot}>
              Snapshot board scenario
            </button>
          </div>
          {cfg.scenarioSnapshot != null && (
            <p className="muted small">
              Snapshot stored: {(cfg.scenarioSnapshot.length / 1024).toFixed(1)} KB. Capture time is
              in the drift log.
            </p>
          )}
          {cfg.frozen && (
            <p className="muted small">
              Frozen {fmtDate(cfg.freezeTime)}. Identity fields are locked. Changes need a new
              baseline.
            </p>
          )}
          <div className="field-row">
            <TextField label="Name" value={cfg.name} onChange={(v) => set({ name: v })} disabled={locked} />
            <VersionField
              label="Version"
              value={cfg.version}
              onBump={() => bumpRecordVersion('configs', cfg.id)}
              disabled={locked}
            />
          </div>
          <div className="field-row">
            <EntityPicker
              label="Boundary: inside"
              options={boundaries.map((b) => ({ id: b.name, label: b.name }))}
              allowFree
              freeValue={cfg.boundaryInside}
              onFree={(v) => set({ boundaryInside: v })}
              disabled={locked}
            />
            <EntityPicker
              label="Boundary: excluded"
              options={boundaries.map((b) => ({ id: b.name, label: b.name }))}
              allowFree
              freeValue={cfg.boundaryExcluded}
              onFree={(v) => set({ boundaryExcluded: v })}
              disabled={locked}
            />
          </div>
          <LineRows
            label="Hardware and serials"
            value={cfg.hardwareAndSerials}
            onChange={(v) => set({ hardwareAndSerials: v })}
            placeholder="item, serial"
            addLabel="+ hardware row"
            disabled={locked}
          />
          <div className="field-row">
            <LineRows
              label="Software versions"
              value={cfg.softwareVersions}
              onChange={(v) => set({ softwareVersions: v })}
              placeholder="component, version"
              addLabel="+ software row"
              disabled={locked}
            />
            <LineRows
              label="Firmware versions"
              value={cfg.firmwareVersions}
              onChange={(v) => set({ firmwareVersions: v })}
              placeholder="component, version"
              addLabel="+ firmware row"
              disabled={locked}
            />
          </div>
          <TextField
            label="Settings and modes"
            rows={2}
            value={cfg.settingsAndModes}
            onChange={(v) => set({ settingsAndModes: v })}
            disabled={locked}
          />
          <ProvText
            label="Sensor configuration"
            rows={2}
            value={cfg.sensorConfiguration}
            onChange={(v) => set({ sensorConfiguration: v })}
            derived={derived.sensor}
            source="board scenario"
            disabled={locked}
          />
          <ProvText
            label="C2 and network configuration"
            rows={2}
            value={cfg.c2AndNetworkConfiguration}
            onChange={(v) => set({ c2AndNetworkConfiguration: v })}
            derived={derived.c2}
            source="board scenario"
            disabled={locked}
          />
          <ProvText
            label="Effector configuration"
            rows={2}
            value={cfg.effectorConfiguration}
            onChange={(v) => set({ effectorConfiguration: v })}
            derived={derived.effector}
            source="board scenario"
            disabled={locked}
          />
          <div className="field-row">
            <PersonPicker
              label="Operators and training"
              value={cfg.operatorsAndTraining}
              onChange={(v) => set({ operatorsAndTraining: v })}
              people={people}
              multi
              disabled={locked}
            />
            <TextField
              label="Procedure version"
              value={cfg.procedureVersion}
              onChange={(v) => set({ procedureVersion: v })}
              disabled={locked}
            />
          </div>
          <LineRows
            label="Known defects and waivers"
            value={cfg.knownDefectsAndWaivers}
            onChange={(v) => set({ knownDefectsAndWaivers: v })}
            placeholder="defect, waiver state"
            addLabel="+ defect row"
            disabled={locked}
          />
          <div className="field-row">
            <ChipsString
              label="Functional check"
              options={['pass', 'pass with notes', 'fail']}
              value={cfg.functionalCheckResult}
              onChange={(v) => set({ functionalCheckResult: v })}
              allowCustom={false}
              disabled={locked}
            />
            <PersonPicker
              label="Released by"
              value={cfg.releasedBy}
              onChange={(v) => set({ releasedBy: v })}
              people={people}
              disabled={locked}
            />
          </div>
          {!cfg.frozen && (
            <div className="subsection">
              <SubTitle>Freeze review</SubTitle>
              <p className="muted small">
                {cfg.name || 'unnamed'} {cfg.version}
                {' · '}functional check: {cfg.functionalCheckResult || 'not recorded'}
                {' · '}released by: {cfg.releasedBy || 'not named'}
                {' · '}snapshot: {cfg.scenarioSnapshot != null ? 'stored' : 'none'}
              </p>
              {freezeGaps.length > 0 && (
                <p className="muted small">Open before freeze: {freezeGaps.join(', ')}.</p>
              )}
              <button className="primary" onClick={() => set({ frozen: true, freezeTime: nowIso() })}>
                Freeze baseline
              </button>
            </div>
          )}
          <SubTitle
            action={
              <button
                className="mini"
                onClick={() => set({ driftLog: [...cfg.driftLog, { time: nowIso(), note: '' }] })}
              >
                + drift entry
              </button>
            }
          >
            Drift log
          </SubTitle>
          {cfg.driftLog.map((d, i) => (
            <div key={i} className="field-row te-table-row">
              <Field label="Time">
                <input value={fmtDate(d.time)} disabled />
              </Field>
              <TextField
                label="Note"
                value={d.note}
                onChange={(v) => set({ driftLog: cfg.driftLog.map((x, j) => (j === i ? { ...x, note: v } : x)) })}
              />
              <button className="mini danger" onClick={() => set({ driftLog: cfg.driftLog.filter((_, j) => j !== i) })}>
                {'×'}
              </button>
            </div>
          ))}
          <RemoveRecord
            campaign={campaign}
            kind="configs"
            id={cfg.id}
            onRemoved={() => selectRecord('configs', null)}
          />
        </div>
      )}
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// D3 Threats
// ---------------------------------------------------------------------------

function ThreatsGroup({ campaign }: { campaign: TeCampaign }) {
  const { addThreat, patchItem, selectRecord, bumpRecordVersion } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.threats ?? null)
  const library = useStore((s) => s.scenario.library)
  const uasModels = library.filter((m) => m.kind === 'uas')
  const t = campaign.threats.find((x) => x.id === selected)
  const set = (patch: Partial<TeThreatProfile>) => t && patchItem('threats', t.id, patch)
  const modelDerived = threatFromModel(t?.specModelId ?? null)
  const factorNames = (cls: string) =>
    campaign.factors.filter((f) => f.classification === cls).map((f) => f.name)
  const startOptions = [
    ...THREAT_VIGNETTES.map((v) => ({ id: `v:${v.key}`, label: `${v.key} ${v.name}`, sub: 'vignette' })),
    ...uasModels.map((m) => ({
      id: `m:${m.id}`,
      label: `${m.threatProfile?.designator ?? ''} ${m.name}`.trim(),
      sub: 'board model',
    })),
  ]
  const startFrom = (id: string) => {
    if (id.startsWith('v:')) {
      const v = THREAT_VIGNETTES.find((x) => x.key === id.slice(2))
      if (!v) return
      const tid = addThreat()
      patchItem('threats', tid, v.patch)
      selectRecord('threats', tid)
    } else {
      const modelId = id.slice(2)
      const model = uasModels.find((m) => m.id === modelId)
      const tid = addThreat()
      const fill = threatFromModel(modelId)
      patchItem('threats', tid, {
        name: model?.name ?? '',
        specModelId: modelId,
        ...(fill ?? {}),
      })
      selectRecord('threats', tid)
    }
  }
  const identityState = (equal: boolean) => (equal ? 'inherited' : 'edited') as 'inherited' | 'edited'
  return (
    <DecisionGroup
      id="d3"
      question="What flies against it?"
      hint="Threat profile. A vignette or board model fills the physical identity; override only the deltas."
      state={progress(campaign.threats.map((x) => x.name.trim() !== ''))}
    >
      <EntityPicker
        label="Start from"
        help="A vignette or a board model fills the profile. Blank stays available below."
        options={startOptions}
        value={null}
        onChange={(id) => id && startFrom(id)}
      />
      <ChipList
        items={campaign.threats.map((x) => ({ id: x.id, label: `${short(x.id)}: ${x.name || 'new'} ${x.version}` }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('threats', id)}
        onAdd={() => selectRecord('threats', addThreat())}
        addLabel="+ blank threat"
      />
      {t && (
        <div className="run-row">
          <div className="field-row">
            <EntityPicker
              label="Name"
              options={[
                ...THREAT_VIGNETTES.map((v) => ({ id: v.patch.name ?? v.name, label: v.patch.name ?? v.name })),
                ...uasModels.map((m) => ({ id: m.name, label: m.name })),
              ]}
              allowFree
              freeValue={t.name}
              onFree={(v) => set({ name: v })}
            />
            <VersionField label="Version" value={t.version} onBump={() => bumpRecordVersion('threats', t.id)} />
          </div>
          <MultiPicker
            label="Missions represented"
            options={MISSIONS.map((v) => ({ id: v, label: v }))}
            value={t.missions}
            onChange={(v) => set({ missions: v as ThreatMissionKind[] })}
          />
          <EntityPicker
            label="Board model"
            help="Linking a model fills group, airframe, bands, and navigation."
            options={uasModels.map((m) => ({
              id: m.id,
              label: `${m.threatProfile?.designator ?? ''} ${m.name}`.trim(),
            }))}
            value={t.specModelId}
            onChange={(v) => {
              const fill = threatFromModel(v)
              set({ specModelId: v, ...(fill ?? {}) })
            }}
          />
          {modelDerived ? (
            <Provenance
              source="linked board model"
              state={identityState(
                t.uasGroup === modelDerived.uasGroup &&
                  t.airframe === modelDerived.airframe &&
                  t.navMode === modelDerived.navMode &&
                  t.speedBandMps[0] === modelDerived.speedBandMps[0] &&
                  t.speedBandMps[1] === modelDerived.speedBandMps[1] &&
                  t.altBandFt[0] === modelDerived.altBandFt[0] &&
                  t.altBandFt[1] === modelDerived.altBandFt[1],
              )}
              onRevert={() => set({ ...modelDerived })}
            >
              <ThreatIdentity t={t} set={set} />
            </Provenance>
          ) : (
            <ThreatIdentity t={t} set={set} />
          )}
          <ChipsString
            label="Emissions"
            options={EMISSIONS_BANDS}
            value={t.emissionsSummary}
            onChange={(v) => set({ emissionsSummary: v })}
            multi
          />
          <div className="field-row">
            <NumberField label="Count" value={t.count} onChange={(v) => set({ count: v ?? 1 })} />
            {(t.count > 1 || t.raidNote.trim() !== '') && (
              <TextField label="Raid note" value={t.raidNote} onChange={(v) => set({ raidNote: v })} />
            )}
          </div>
          <TextField
            label="Who operates the threat, and at what skill level?"
            value={t.operatorStateNote}
            onChange={(v) => set({ operatorStateNote: v })}
          />
          <RadioDefs
            label="What stands in for the real threat?"
            help="Representation class. Anything short of the actual threat needs a fidelity statement."
            value={t.representationClass}
            options={REPRESENTATION_CLASSES.map((v) => ({ v, def: REPRESENTATION_DEFS[v] }))}
            onChange={(v) => set({ representationClass: v })}
          />
          {(t.representationClass !== 'actual-threat' || t.fidelity.length > 0) && (
            <>
              <SubTitle
                action={
                  <button
                    className="mini"
                    onClick={() =>
                      set({
                        fidelity: [
                          ...t.fidelity,
                          { feature: '', intendedState: '', representedState: '', level: 'unknown', likelyEffect: '' },
                        ],
                      })
                    }
                  >
                    + row
                  </button>
                }
              >
                What differs from the real threat?
              </SubTitle>
              {t.fidelity.length === 0 && (
                <p className="muted small">No fidelity rows yet. Add a row per differing feature.</p>
              )}
              {t.fidelity.map((f, i) => (
                <div key={i} className="field-row te-table-row">
                  <SuggestField
                    label="Feature"
                    value={f.feature}
                    onChange={(v) => set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, feature: v } : x)) })}
                    suggestions={FIDELITY_FEATURES}
                  />
                  <TextField
                    label="Intended"
                    value={f.intendedState}
                    onChange={(v) => set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, intendedState: v } : x)) })}
                  />
                  <TextField
                    label="Represented"
                    value={f.representedState}
                    onChange={(v) => set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, representedState: v } : x)) })}
                  />
                  <SelectField
                    label="Level"
                    value={f.level}
                    options={FIDELITY_LEVELS.map((v) => ({ v, label: v }))}
                    onChange={(v) => v && set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, level: v } : x)) })}
                  />
                  <TextField
                    label="Likely effect"
                    value={f.likelyEffect}
                    onChange={(v) => set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, likelyEffect: v } : x)) })}
                  />
                  <button className="mini danger" onClick={() => set({ fidelity: t.fidelity.filter((_, j) => j !== i) })}>
                    {'×'}
                  </button>
                </div>
              ))}
            </>
          )}
          <div className="field">
            <span>
              Why is this threat in the test?
              <span className="help-dot" tabIndex={0} data-help="Profile class: mandatory, high probability, or high consequence.">
                ?
              </span>
            </span>
            <Seg
              value={t.profileClass}
              options={PROFILE_CLASSES.map((v) => ({ v, label: v }))}
              onChange={(v) => set({ profileClass: v })}
            />
          </div>
          <div className="field">
            <span>
              How free is the red operator?
              <span className="help-dot" tabIndex={0} data-help={HINTS['opfor-mode'].why}>
                ?
              </span>
            </span>
            <Seg
              value={t.opforMode}
              options={OPFOR_MODES.map((o) => ({ v: o.v, label: o.v }))}
              onChange={(v) => set({ opforMode: v })}
            />
          </div>
          <p className="muted small">{OPFOR_MODES.find((o) => o.v === t.opforMode)?.help}</p>
          {(t.opforMode === 'bounded-adaptive' ||
            t.opforMode === 'free-play' ||
            t.adaptationRules.length > 0) && (
            <>
              <SubTitle
                action={
                  <button
                    className="mini"
                    onClick={() => set({ adaptationRules: [...t.adaptationRules, { trigger: '', allowedResponse: '' }] })}
                  >
                    + rule
                  </button>
                }
              >
                Adaptation rules
              </SubTitle>
              <p className="muted small">Write bounded responses. Never write: act realistically.</p>
              {t.adaptationRules.map((r, i) => (
                <div key={i} className="field-row te-table-row">
                  <TextField
                    label="Trigger"
                    value={r.trigger}
                    onChange={(v) => set({ adaptationRules: t.adaptationRules.map((x, j) => (j === i ? { ...x, trigger: v } : x)) })}
                  />
                  <TextField
                    label="Allowed response"
                    value={r.allowedResponse}
                    onChange={(v) => set({ adaptationRules: t.adaptationRules.map((x, j) => (j === i ? { ...x, allowedResponse: v } : x)) })}
                  />
                  <button className="mini danger" onClick={() => set({ adaptationRules: t.adaptationRules.filter((_, j) => j !== i) })}>
                    {'×'}
                  </button>
                </div>
              ))}
            </>
          )}
          <SubTitle>Red control</SubTitle>
          <p className="muted small">Chips come from the factor register, by classification.</p>
          <ChipsString
            label="Red picks during the run"
            options={factorNames('bounded-red-choice')}
            value={t.redControlledVariables}
            onChange={(v) => set({ redControlledVariables: v })}
            multi
          />
          <ChipsString
            label="Red holds fixed"
            options={factorNames('held-control')}
            value={t.redFixedVariables}
            onChange={(v) => set({ redFixedVariables: v })}
            multi
          />
          <ChipsString
            label="Red must not do"
            options={factorNames('prohibited-variable')}
            value={t.prohibitedActions}
            onChange={(v) => set({ prohibitedActions: v })}
            multi
          />
          <div className="field-row">
            <ChipsString
              label="Who is kept from knowing what?"
              help={HINTS.blinding.why}
              options={BLINDING_OPTIONS}
              value={t.blinding}
              onChange={(v) => set({ blinding: v })}
            />
            <EntityPicker
              label="Validation source"
              options={campaign.charter.sourceDocumentsAndPriorEvidence
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s !== '')
                .map((s) => ({ id: s, label: s }))}
              allowFree
              freeValue={t.validationSource}
              onFree={(v) => set({ validationSource: v })}
            />
          </div>
          <GeneralizationFields
            recordId={t.id}
            permitted={t.permittedGeneralization}
            prohibited={t.prohibitedGeneralization}
            onPermitted={(v) => set({ permittedGeneralization: v })}
            onProhibited={(v) => set({ prohibitedGeneralization: v })}
          />
          <TextField label="Notes" rows={2} value={t.notes} onChange={(v) => set({ notes: v })} />
          <RemoveRecord
            campaign={campaign}
            kind="threats"
            id={t.id}
            onRemoved={() => selectRecord('threats', null)}
          />
        </div>
      )}
    </DecisionGroup>
  )
}

/** Physical identity block: group, airframe, nav, speed and altitude bands. */
function ThreatIdentity({
  t,
  set,
}: {
  t: TeThreatProfile
  set: (patch: Partial<TeThreatProfile>) => void
}) {
  return (
    <>
      <div className="field">
        <span>
          UAS group
          <span className="help-dot" tabIndex={0} data-help="Group 1 smallest to Group 5 largest, by weight and altitude.">
            ?
          </span>
        </span>
        <Seg
          value={String(t.uasGroup) as (typeof UAS_GROUPS)[number]}
          options={UAS_GROUPS.map((v) => ({ v, label: v }))}
          onChange={(v) => set({ uasGroup: Number(v) as TeThreatProfile['uasGroup'] })}
        />
      </div>
      <div className="field-row">
        <ChipsString
          label="Airframe"
          options={AIRFRAMES}
          value={t.airframe}
          onChange={(v) => set({ airframe: v })}
        />
        <ChipsString
          label="Navigation"
          options={NAV_MODES}
          value={t.navMode}
          onChange={(v) => set({ navMode: v })}
        />
      </div>
      <div className="field-row">
        <RangeField
          label="Speed band"
          min={t.speedBandMps[0]}
          max={t.speedBandMps[1]}
          unit="m/s"
          onChange={(min, max) =>
            set({ speedBandMps: [min ?? t.speedBandMps[0], max ?? t.speedBandMps[1]] })
          }
        />
        <RangeField
          label="Altitude band"
          min={t.altBandFt[0]}
          max={t.altBandFt[1]}
          unit="ft"
          help="Recorded, not modeled. The board is plan view."
          onChange={(min, max) => set({ altBandFt: [min ?? t.altBandFt[0], max ?? t.altBandFt[1]] })}
        />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// D4 Conditions
// ---------------------------------------------------------------------------

function ConditionsGroup({ campaign }: { campaign: TeCampaign }) {
  const { addCondition, patchItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.conditions ?? null)
  useStore((s) => s.scenario.environment)
  const boardEntities = useStore((s) => s.scenario.entities)
  const c = campaign.conditions.find((x) => x.id === selected)
  const set = (patch: Partial<TeCondition>) => c && patchItem('conditions', c.id, patch)
  const board = boardEnvironment()
  const severe = spectrumSevere(campaign)

  const add = () => {
    const id = addCondition()
    patchItem('conditions', id, { weatherAndIllumination: board.weather, emEnvironment: board.em })
    selectRecord('conditions', id)
  }
  const emDrift =
    c != null && c.emEnvironment.startsWith('EM background') && c.emEnvironment !== board.em

  return (
    <DecisionGroup
      id="d4"
      question="Under what conditions?"
      hint="Test conditions: environment, spectrum, network, workload, and degraded modes."
      state={progress(campaign.conditions.map((x) => x.name.trim() !== ''))}
    >
      <ChipList
        items={campaign.conditions.map((x) => ({ id: x.id, label: `${short(x.id)}: ${x.name || 'new'}` }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('conditions', id)}
        onAdd={add}
        addLabel="+ condition"
      />
      {c && (
        <div className="run-row">
          <TextField label="Name" value={c.name} onChange={(v) => set({ name: v })} />
          <Field
            label="Environment preset"
            help="One pick fills weather, spectrum, and network. The chips below change each field."
          >
            <div className="te-chips">
              {ENVIRONMENT_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="card-chip"
                  title={p.hint}
                  onClick={() =>
                    set({
                      weatherAndIllumination: p.weatherAndIllumination,
                      emEnvironment: p.emEnvironment,
                      networkState: p.networkState,
                    })
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>
          <ProvText
            label="Weather and light"
            rows={2}
            value={c.weatherAndIllumination}
            onChange={(v) => set({ weatherAndIllumination: v })}
            derived={board.weather}
            source="board environment"
          />
          <AdvancedDisclosure label="Compose the weather line manually">
            <TemplateSentence
              key={`${c.id}-wx`}
              template="Wind [speed] from [direction] deg true; [temp] C; [precipitation]; [light] light"
              value={c.weatherAndIllumination}
              onChange={(v) => set({ weatherAndIllumination: v })}
            />
          </AdvancedDisclosure>
          <ChipsString
            label="How busy is the spectrum?"
            help="EM environment. Contested or worse promotes degraded-mode and truth-independence questions."
            options={SPECTRUM_STATES}
            value={c.emEnvironment}
            onChange={(v) => set({ emEnvironment: v })}
          />
          <p className="muted small">
            Board: {board.em}{' '}
            <button type="button" className="mini" onClick={() => set({ emEnvironment: board.em })}>
              Use board
            </button>
          </p>
          {emDrift && (
            <p className="muted small">The stored EM text differs from the current board. Use board to refresh.</p>
          )}
          <ChipsString
            label="Degraded modes in play"
            help={severe ? 'Recommended: the spectrum is contested somewhere in this campaign.' : undefined}
            options={DEGRADED_MODES}
            value={c.degradedModes}
            onChange={(v) => set({ degradedModes: v })}
            multi
          />
          <div className="field-row">
            <ChipsString
              label="Network state"
              options={NETWORK_STATES}
              value={c.networkState}
              onChange={(v) => set({ networkState: v })}
            />
            <ChipsString
              label="Operator workload"
              options={WORKLOAD_LEVELS}
              value={c.operatorWorkload}
              onChange={(v) => set({ operatorWorkload: v })}
            />
          </div>
          <ChipsString
            label="Terrain and clutter"
            options={TERRAIN_CLASSES}
            value={c.terrainAndClutter}
            onChange={(v) => set({ terrainAndClutter: v })}
            multi
          />
          <div className="field-row">
            <EntityPicker
              label="Supporting systems"
              options={[
                ...boardEntities.map((e) => ({ id: e.name, label: e.name })),
                ...campaign.configs.map((x) => ({ id: x.name || x.id, label: x.name || x.id })),
              ]}
              allowFree
              freeValue={c.supportingSystems}
              onFree={(v) => set({ supportingSystems: v })}
            />
            <TextField
              label="Background activity"
              value={c.backgroundActivity}
              onChange={(v) => set({ backgroundActivity: v })}
              placeholder="e.g. friendly UAS traffic, range clutter"
            />
          </div>
          <GeneralizationFields
            recordId={c.id}
            permitted={c.permittedGeneralization}
            prohibited={c.prohibitedGeneralization}
            onPermitted={(v) => set({ permittedGeneralization: v })}
            onProhibited={(v) => set({ prohibitedGeneralization: v })}
          />
          <RemoveRecord
            campaign={campaign}
            kind="conditions"
            id={c.id}
            onRemoved={() => selectRecord('conditions', null)}
          />
        </div>
      )}
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// D5 Measures
// ---------------------------------------------------------------------------

function MeasuresGroup({ campaign }: { campaign: TeCampaign }) {
  const { addMeasure, patchItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.measures ?? null)
  const selectedQ = useTeStore((s) => s.ui.selected.questions ?? null)
  const [qid, setQid] = useState<string | null>(null)
  const targetQ =
    campaign.questions.find((q) => q.id === qid)?.id ??
    campaign.questions.find((q) => q.id === selectedQ)?.id ??
    campaign.questions[0]?.id ??
    null
  const m = campaign.measures.find((x) => x.id === selected)
  const set = (patch: Partial<TeMeasure>) => m && patchItem('measures', m.id, patch)
  const truthSources = [
    ...new Set(
      campaign.measures
        .flatMap((x) => [x.truth.primarySource, x.truth.backupSource])
        .map((s) => s.trim())
        .filter((s) => s !== ''),
    ),
  ]
  const dict = rankedDictionary(campaign)
  const severe = spectrumSevere(campaign)

  const applyDict = (key: string) => {
    const entry = MEASURE_DICTIONARY.find((d) => d.dictKey === key)
    if (!entry || !targetQ) return
    const id = addMeasure(targetQ)
    patchItem('measures', id, measureFromDict(entry, id, targetQ))
    selectRecord('measures', id)
  }

  // Family-conditional fields stay visible when legacy content exists, so no
  // stored text ever loses its edit path.
  const binomLike =
    m != null &&
    (['binomial', 'rate'].includes(m.family) ||
      m.measureType === 'probability' ||
      m.numeratorRule.trim() !== '' ||
      m.denominatorRule.trim() !== '')
  const timeLike =
    m != null &&
    (m.family === 'latency' ||
      m.measureType === 'time-to-event' ||
      m.startEvent.trim() !== '' ||
      m.stopEvent.trim() !== '')
  const thresholdText = campaign.decision.acceptableThreshold
  const thresholdParse = thresholdText.match(/-?\d+(\.\d+)?/)
  const thresholdSuggestion =
    m != null && m.threshold == null && thresholdParse != null ? Number(thresholdParse[0]) : null

  return (
    <DecisionGroup
      id="d5"
      question="How do we measure the answer?"
      hint="Measures. The dictionary is the primary path; a pick fills twelve fields."
      tier="recommended"
      state={progress(
        campaign.measures.map((x) => x.name.trim() !== '' && x.truth.primarySource.trim() !== ''),
      )}
    >
      {campaign.questions.length === 0 && (
        <p className="muted small">Create a question first. Every measure belongs to a question.</p>
      )}
      {campaign.questions.length > 1 && (
        <EntityPicker
          label="Question for new measures"
          options={campaign.questions.map((x) => ({ id: x.id, label: x.wording.slice(0, 60) || x.id, sub: short(x.id) }))}
          value={targetQ}
          onChange={setQid}
        />
      )}
      <EntityPicker
        label="Add from dictionary"
        help="Ranked by what the board holds. Nothing is hidden."
        options={dict.map((d) => ({ id: d.dictKey, label: d.name, sub: d.dictKey }))}
        value={null}
        onChange={(id) => id && applyDict(id)}
        disabled={!targetQ}
      />
      <ChipList
        items={campaign.measures.map((x) => ({
          id: x.id,
          label: `${short(x.id)}: ${x.name.slice(0, 26) || 'new'}${x.frozen ? ' (frozen)' : ''}`,
        }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('measures', id)}
        onAdd={targetQ ? () => selectRecord('measures', addMeasure(targetQ)) : undefined}
        addLabel="+ custom measure"
      />
      {m && (
        <div className="run-row">
          <div className="field-row">
            <EntityPicker
              label="Name"
              options={MEASURE_DICTIONARY.map((d) => ({ id: d.name, label: d.name }))}
              allowFree
              freeValue={m.name}
              onFree={(v) => set({ name: v })}
            />
            <SelectField
              label="Family"
              value={m.family}
              options={FAMILIES.map((v) => ({ v, label: v }))}
              onChange={(v) => v && set({ family: v })}
            />
            <SelectField
              label="Measure type"
              value={m.measureType}
              options={MEASURE_TYPES.map((v) => ({ v, label: v }))}
              onChange={(v) => v && set({ measureType: v })}
            />
          </div>
          <div className="field-row">
            <EntityPicker
              label="Unit"
              options={[...new Set([...MEASURE_DICTIONARY.map((d) => d.unit), 's', 'm', 'nm', 'ft', '%', 'count'])].map(
                (u) => ({ id: u, label: u }),
              )}
              allowFree
              freeValue={m.unit}
              onFree={(v) => set({ unit: v })}
            />
            <ChipsString
              label="What is one trial?"
              help="Experimental unit. Sample size counts trials, so fix the unit first."
              options={EXPERIMENTAL_UNITS}
              value={m.experimentalUnit}
              onChange={(v) => set({ experimentalUnit: v })}
            />
          </div>
          <AdvancedDisclosure label="Definition and counting rules">
            <TextField
              label="Exact definition"
              rows={2}
              value={m.exactDefinition}
              onChange={(v) => set({ exactDefinition: v })}
            />
            {binomLike && (
              <>
                <TextField
                  label="What counts as a success?"
                  rows={2}
                  value={m.numeratorRule}
                  onChange={(v) => set({ numeratorRule: v })}
                  help="Numerator rule."
                />
                <TextField
                  label="What counts as a valid attempt?"
                  rows={2}
                  value={m.denominatorRule}
                  onChange={(v) => set({ denominatorRule: v })}
                  help="Denominator rule."
                />
              </>
            )}
          </AdvancedDisclosure>
          {timeLike && (
            <div className="field-row">
              <EntityPicker
                label="Start event"
                options={[...new Set([...MEASURE_DICTIONARY.map((d) => d.startEvent), ...GENERIC_MARKS])]
                  .filter((s) => s.trim() !== '')
                  .map((s) => ({ id: s, label: s }))}
                allowFree
                freeValue={m.startEvent}
                onFree={(v) => set({ startEvent: v })}
              />
              <EntityPicker
                label="Stop event"
                options={[...new Set([...MEASURE_DICTIONARY.map((d) => d.stopEvent), ...GENERIC_MARKS])]
                  .filter((s) => s.trim() !== '')
                  .map((s) => ({ id: s, label: s }))}
                allowFree
                freeValue={m.stopEvent}
                onFree={(v) => set({ stopEvent: v })}
              />
            </div>
          )}
          <SubTitle>Truth source</SubTitle>
          <div className="field-row">
            <EntityPicker
              label="Truth source"
              help={HINTS['truth-source'].why}
              options={truthSources.map((s) => ({ id: s, label: s }))}
              allowFree
              freeValue={m.truth.primarySource}
              onFree={(v) => set({ truth: { ...m.truth, primarySource: v } })}
            />
            <EntityPicker
              label="Backup truth source"
              options={truthSources.map((s) => ({ id: s, label: s }))}
              allowFree
              freeValue={m.truth.backupSource}
              onFree={(v) => set({ truth: { ...m.truth, backupSource: v } })}
            />
          </div>
          <div className="field-row">
            <ChipsString
              label="Does truth share parts with the tested system?"
              help={
                severe
                  ? 'Recommended: the spectrum is contested; instrumentation must survive it.'
                  : HINTS.independence.why
              }
              options={TRUTH_INDEPENDENCE}
              value={m.truth.independenceFromSut}
              onChange={(v) => set({ truth: { ...m.truth, independenceFromSut: v } })}
            />
            <NumberField
              label="Time tolerance (s)"
              value={m.truth.timeToleranceS}
              onChange={(v) => set({ truth: { ...m.truth, timeToleranceS: v } })}
              step={0.1}
            />
          </div>
          <SubTitle>Data rules</SubTitle>
          <ChipsString
            label="When data is missing"
            options={MISSING_DATA_RULES}
            value={m.missingDataRule}
            onChange={(v) => set({ missingDataRule: v })}
          />
          <ChipsString
            label="When data is invalid"
            options={INVALID_DATA_RULES}
            value={m.invalidDataRule}
            onChange={(v) => set({ invalidDataRule: v })}
          />
          {(timeLike || m.censoringRule.trim() !== '') && (
            <ChipsString
              label="When the event never happens"
              help="Censoring rule."
              options={CENSORING_RULES}
              value={m.censoringRule}
              onChange={(v) => set({ censoringRule: v })}
            />
          )}
          <SubTitle>Thresholds</SubTitle>
          <div className="field-row">
            <NumberUnitField
              label="Threshold"
              value={m.threshold}
              unit={m.unit}
              onChange={(v) => set({ threshold: v })}
              help={HELP.thresholds}
            />
            <NumberUnitField label="Objective" value={m.objective} unit={m.unit} onChange={(v) => set({ objective: v })} />
          </div>
          {thresholdSuggestion != null && (
            <Provenance
              source={`decision record: ${thresholdText.slice(0, 60)}`}
              state="pending"
              onConfirm={() => set({ threshold: thresholdSuggestion })}
            >
              <p className="muted small">Qualify names an acceptable threshold. Confirm to use {thresholdSuggestion}.</p>
            </Provenance>
          )}
          {(m.threshold != null || m.thresholdSource != null) && (
            <div className="field-row">
              <SelectField
                label="Threshold source"
                value={m.thresholdSource}
                allowEmpty="not set"
                options={THRESHOLD_SOURCES.map((v) => ({ v, label: v }))}
                onChange={(v) => set({ thresholdSource: v })}
              />
              <CheckField
                label="Threshold customer-approved"
                value={m.thresholdApproved}
                onChange={(v) => set({ thresholdApproved: v })}
                help={HELP.thresholds}
              />
            </div>
          )}
          <div className="field-row">
            <CheckField label="Higher is better" value={m.higherIsBetter} onChange={(v) => set({ higherIsBetter: v })} />
            <NumberField
              label="Required repetitions"
              value={m.requiredRepetitions}
              onChange={(v) => set({ requiredRepetitions: v })}
              help="Set it from the sample-size decision in the matrix group, or type an override."
            />
          </div>
          {m.family === 'binomial' && (
            <div className="field">
              <span>
                Interval method
                <span className="help-dot" tabIndex={0} data-help="How to compute the confidence interval. Wilson is the default.">
                  ?
                </span>
              </span>
              <Seg
                value={m.intervalMethod}
                options={INTERVAL_METHODS.map((v) => ({ v, label: v }))}
                onChange={(v) => set({ intervalMethod: v })}
              />
            </div>
          )}
          {m.family === 'binomial' && m.intervalMethod === 'bayes' && (
            <div className="field-row">
              <NumberField label="Prior alpha" value={m.priorAlpha} onChange={(v) => set({ priorAlpha: v ?? 1 })} step={0.5} />
              <NumberField label="Prior beta" value={m.priorBeta} onChange={(v) => set({ priorBeta: v ?? 1 })} step={0.5} />
            </div>
          )}
          <AdvancedDisclosure>
            <NumberUnitField
              label="Failure boundary"
              value={m.failureBoundary}
              unit={m.unit}
              onChange={(v) => set({ failureBoundary: v })}
              help="Below this boundary the result is a failure regardless of the interval."
            />
          </AdvancedDisclosure>
          <CheckField
            label="Frozen (required before card issue)"
            value={m.frozen}
            onChange={(v) => set({ frozen: v })}
          />
          <RemoveRecord
            campaign={campaign}
            kind="measures"
            id={m.id}
            onRemoved={() => selectRecord('measures', null)}
          />
        </div>
      )}
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// D6 Predictions (hypotheses)
// ---------------------------------------------------------------------------

function PredictionsGroup({ campaign }: { campaign: TeCampaign }) {
  const { addHypothesis, patchItem, removeItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.hypotheses ?? null)
  const selectedQ = useTeStore((s) => s.ui.selected.questions ?? null)
  const [qid, setQid] = useState<string | null>(null)
  const targetQ =
    campaign.questions.find((q) => q.id === qid)?.id ??
    campaign.questions.find((q) => q.id === selectedQ)?.id ??
    campaign.questions[0]?.id ??
    null
  const h = campaign.hypotheses.find((x) => x.id === selected)
  const set = (patch: Partial<TeHypothesis>) => h && patchItem('hypotheses', h.id, patch)
  const measure = h ? measureFor(campaign, h) : undefined
  const trio = measure ? resultTrio(measure) : null
  const nuisance = campaign.factors
    .filter((f) => f.classification === 'unobserved-nuisance')
    .map((f) => f.name)
  const assumptionStatements = campaign.registers
    .filter((r) => r.kind === 'assumption')
    .map((r) => r.statement)
    .filter((s) => s.trim() !== '')
  const sentence = h
    ? `Under ${h.underConditions || '[conditions]'}, the system produces ${h.producesBehavior || '[behavior]'}, measured by ${h.measuredBy || '[measure]'}, relative to ${h.relativeTo || '[threshold]'}.`
    : ''
  return (
    <DecisionGroup
      id="d6"
      question="What do we expect to happen?"
      hint="Hypotheses and predictions, recorded before the test. Post hoc result hunting is prohibited."
      tier="recommended"
      state={progress(
        campaign.hypotheses.map((x) => x.predictedValue.trim() !== '' && x.refutingResult.trim() !== ''),
      )}
    >
      {campaign.questions.length === 0 && (
        <p className="muted small">Create a question first. Every hypothesis belongs to a question.</p>
      )}
      {campaign.questions.length > 1 && (
        <EntityPicker
          label="Question for new hypotheses"
          help={HELP['hypothesis-question']}
          options={campaign.questions.map((x) => ({ id: x.id, label: x.wording.slice(0, 60) || x.id, sub: short(x.id) }))}
          value={targetQ}
          onChange={setQid}
        />
      )}
      <ChipList
        items={campaign.hypotheses.map((x) => ({
          id: x.id,
          label: `${short(x.id)}: ${x.producesBehavior.slice(0, 28) || 'new'}`,
        }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('hypotheses', id)}
        onAdd={targetQ ? () => selectRecord('hypotheses', addHypothesis(targetQ)) : undefined}
        addLabel="+ hypothesis"
      />
      {h && (
        <div className="run-row">
          {campaign.questions.length > 1 && (
            <EntityPicker
              label="Parent question"
              options={campaign.questions.map((x) => ({ id: x.id, label: x.wording.slice(0, 60) || x.id, sub: short(x.id) }))}
              value={h.questionId || null}
              onChange={(v) => set({ questionId: v ?? '' })}
            />
          )}
          <div className="spec-summary">{sentence}</div>
          <ChipsString
            label="When does this hold?"
            help="Pick the condition and threat names the prediction assumes."
            options={[...campaign.conditions.map((x) => x.name), ...campaign.threats.map((x) => x.name)].filter(
              (s) => s.trim() !== '',
            )}
            value={h.underConditions}
            onChange={(v) => set({ underConditions: v })}
            multi
          />
          <div className="field-row">
            <TextField
              label="What will the system do?"
              value={h.producesBehavior}
              onChange={(v) => set({ producesBehavior: v })}
              placeholder="e.g. detect before the boundary"
            />
            <EntityPicker
              label="Measured by"
              options={[
                ...campaign.measures.map((x) => ({ id: x.id, label: x.name || x.id, sub: short(x.id) })),
                ...MEASURE_DICTIONARY.map((d) => ({ id: `dict:${d.dictKey}`, label: d.name, sub: d.dictKey })),
              ]}
              allowFree
              freeValue={h.measuredBy}
              onFree={(v) => set({ measuredBy: v })}
            />
          </div>
          {measure != null && measure.threshold != null ? (
            <ProvText
              label="Compared with which limit?"
              value={h.relativeTo}
              onChange={(v) => set({ relativeTo: v })}
              derived={`threshold ${measure.threshold} ${measure.unit}`.trim()}
              source={measure.name}
            />
          ) : (
            <TextField
              label="Compared with which limit?"
              value={h.relativeTo}
              onChange={(v) => set({ relativeTo: v })}
            />
          )}
          <SubTitle>Prediction</SubTitle>
          <RadioDefs
            label="What shape is the prediction?"
            value={h.predictionType}
            options={PREDICTION_TYPES.map((v) => ({ v, def: PREDICTION_DEFS[v] }))}
            onChange={(v) => {
              const patch: Partial<TeHypothesis> = { predictionType: v }
              if (h.nullHypothesis.trim() === '') patch.nullHypothesis = NULL_DEFAULTS[v]
              set(patch)
            }}
          />
          <PredictionValueField
            key={`${h.id}-${h.predictionType}`}
            type={h.predictionType}
            unit={measure?.unit ?? ''}
            value={h.predictedValue}
            onChange={(v) => set({ predictedValue: v })}
          />
          <div className="field-row">
            <TextField
              label="How much spread do you expect between runs?"
              value={h.expectedVariability}
              onChange={(v) => set({ expectedVariability: v })}
            />
            <ProvText
              label="Which result means no effect?"
              value={h.nullHypothesis}
              onChange={(v) => set({ nullHypothesis: v })}
              derived={NULL_DEFAULTS[h.predictionType]}
              source="prediction type default"
            />
          </div>
          <SubTitle>Result mapping</SubTitle>
          {trio == null && (
            <p className="muted small">
              Link a measure with a threshold and the three results draft themselves.
            </p>
          )}
          <ProvText
            label="Result that supports"
            rows={2}
            value={h.supportingResult}
            onChange={(v) => set({ supportingResult: v })}
            derived={trio?.supporting ?? null}
            source={measure?.name ?? ''}
          />
          <ProvText
            label="Result that refutes"
            rows={2}
            value={h.refutingResult}
            onChange={(v) => set({ refutingResult: v })}
            derived={trio?.refuting ?? null}
            source={measure?.name ?? ''}
            help={HELP.hypothesis}
          />
          <ProvText
            label="Result that is inconclusive"
            rows={2}
            value={h.inconclusiveResult}
            onChange={(v) => set({ inconclusiveResult: v })}
            derived={trio?.inconclusive ?? null}
            source={measure?.name ?? ''}
          />
          <ChipsString
            label="What else could explain the result?"
            help="Competing explanations. Chips come from unobserved-nuisance factors."
            options={nuisance}
            value={h.competingExplanations}
            onChange={(v) => set({ competingExplanations: v })}
            multi
          />
          <SuggestField
            label="Assumptions"
            rows={2}
            value={h.assumptions}
            onChange={(v) => set({ assumptions: v })}
            suggestions={assumptionStatements}
            help="Click a register assumption to link it into the text."
          />
          <div className="inspector-actions">
            <button
              className="mini danger"
              onClick={() => {
                removeItem('hypotheses', h.id)
                selectRecord('hypotheses', null)
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// D7 Factors
// ---------------------------------------------------------------------------

function FactorsGroup({ campaign }: { campaign: TeCampaign }) {
  const { addFactor, patchItem, removeItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.factors ?? null)
  const campaigns = useTeStore((s) => s.campaigns)
  const f = campaign.factors.find((x) => x.id === selected)
  const set = (patch: Partial<TeFactor>) => f && patchItem('factors', f.id, patch)
  const nameOptions = [
    ...new Set([
      ...STANDARD_COVARIATE_FACTORS,
      ...campaigns.filter((c) => c.id !== campaign.id).flatMap((c) => c.factors.map((x) => x.name)),
    ]),
  ].filter((n) => n.trim() !== '')
  const seedCovariates = () => {
    const existing = new Set(campaign.factors.map((x) => x.name.trim().toLowerCase()))
    for (const name of STANDARD_COVARIATE_FACTORS) {
      if (existing.has(name.toLowerCase())) continue
      const id = addFactor()
      patchItem('factors', id, { name })
    }
  }
  const levelsShown =
    f != null &&
    (f.classification === 'independent-variable' ||
      f.classification === 'bounded-red-choice' ||
      f.plannedLevels.trim() !== '')
  return (
    <DecisionGroup
      id="d7"
      question="For each thing that can move a result: vary it, hold it, record it, or forbid it"
      hint="Factor register. An unclassified factor becomes an unexplained result."
      state={progress(campaign.factors.map((x) => x.name.trim() !== ''))}
    >
      <div className="inspector-actions">
        <button className="mini" onClick={seedCovariates}>
          Seed standard covariates
        </button>
      </div>
      <ChipList
        items={campaign.factors.map((x) => ({
          id: x.id,
          label: `${x.name || 'new'} (${x.classification})`,
        }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('factors', id)}
        onAdd={() => selectRecord('factors', addFactor())}
        addLabel="+ factor"
      />
      {f && (
        <div className="run-row">
          <EntityPicker
            label="Name"
            options={nameOptions.map((n) => ({ id: n, label: n }))}
            allowFree
            freeValue={f.name}
            onFree={(v) => set({ name: v })}
          />
          <RadioDefs
            label="What do we do with it?"
            help="Factor classification."
            value={f.classification}
            options={FACTOR_CLASSES.map((v) => ({ v, def: FACTOR_DEFS[v] }))}
            onChange={(v) => set({ classification: v })}
          />
          {levelsShown && (
            <ChipsString
              label="Planned levels"
              options={[]}
              value={f.plannedLevels}
              onChange={(v) => set({ plannedLevels: v })}
              multi
            />
          )}
          {(f.classification === 'held-control' || f.toleranceAndVerification.trim() !== '') && (
            <TextField
              label="How do we hold and verify it?"
              value={f.toleranceAndVerification}
              onChange={(v) => set({ toleranceAndVerification: v })}
              placeholder="e.g. wind under 8 m/s, verified by the range met station"
            />
          )}
          {f.classification === 'unobserved-nuisance' && (
            <>
              <TextField
                label="Risk statement"
                value={f.riskStatement}
                onChange={(v) => set({ riskStatement: v })}
              />
              <p className="muted small">
                An unobserved nuisance factor has three outs: remove it, instrument it, or state
                the risk.
              </p>
            </>
          )}
          <div className="inspector-actions">
            <button
              className="mini danger"
              onClick={() => {
                removeItem('factors', f.id)
                selectRecord('factors', null)
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// D8 Matrix
// ---------------------------------------------------------------------------

function MatrixGroup({ campaign }: { campaign: TeCampaign }) {
  const { patchItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.matrix ?? null)
  const cell = campaign.matrix.find((x) => x.id === selected)
  const set = (patch: Partial<TeMatrixCell>) => cell && patchItem('matrix', cell.id, patch)
  const totalRuns = campaign.matrix.reduce((n, x) => n + x.plannedReps, 0)
  const hyps = cell ? campaign.hypotheses.filter((x) => !cell.questionId || x.questionId === cell.questionId) : []
  const rankDropOrder = () => {
    const sorted = [...campaign.matrix].sort((a, b) => b.priority - a.priority)
    sorted.forEach((x, i) => patchItem('matrix', x.id, { dropOrder: i + 1 }))
  }
  return (
    <DecisionGroup
      id="d8"
      question="Which combinations, how many times?"
      hint="Run matrix. A comparison without a baseline row proves nothing."
      tier="recommended"
      state={progress(campaign.matrix.map((x) => x.method.trim() !== '' && x.conditionId !== ''))}
    >
      <div className="spec-summary">
        {campaign.matrix.length} cell(s); {totalRuns} planned runs.
      </div>
      <SubTitle>How many valid runs make a cell count?</SubTitle>
      <SampleSizeApply campaign={campaign} />
      <SubTitle>Add cells</SubTitle>
      <AddCellsFlow campaign={campaign} />
      <ChipList
        items={campaign.matrix.map((x) => ({ id: x.id, label: `${short(x.id)}: ${x.method.slice(0, 24) || 'cell'}` }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('matrix', id)}
      />
      {cell && (
        <div className="run-row">
          <div className="field-row">
            <EntityPicker
              label="Question"
              options={campaign.questions.map((x) => ({ id: x.id, label: x.wording.slice(0, 40) || x.id, sub: short(x.id) }))}
              value={cell.questionId || null}
              onChange={(v) => set({ questionId: v ?? '' })}
            />
            <EntityPicker
              label="Hypothesis"
              options={hyps.map((x) => ({ id: x.id, label: x.producesBehavior.slice(0, 40) || x.id, sub: short(x.id) }))}
              value={cell.hypothesisId}
              onChange={(v) => set({ hypothesisId: v })}
            />
          </div>
          <div className="field-row">
            <EntityPicker
              label="Configuration"
              options={campaign.configs.map((x) => ({ id: x.id, label: `${x.name || x.id} ${x.version}` }))}
              value={cell.configId || null}
              onChange={(v) => set({ configId: v ?? '' })}
            />
            <EntityPicker
              label="Threat"
              options={campaign.threats.map((x) => ({ id: x.id, label: x.name || x.id }))}
              value={cell.threatId || null}
              onChange={(v) => set({ threatId: v ?? '' })}
            />
            <EntityPicker
              label="Condition"
              options={campaign.conditions.map((x) => ({ id: x.id, label: x.name || x.id }))}
              value={cell.conditionId || null}
              onChange={(v) => set({ conditionId: v ?? '' })}
            />
          </div>
          <SelectField
            label="Method"
            value={cell.method || null}
            allowEmpty="pick a method"
            options={(cell.method && !MATRIX_METHODS.includes(cell.method)
              ? [cell.method, ...MATRIX_METHODS]
              : MATRIX_METHODS
            ).map((v) => ({ v, label: v }))}
            onChange={(v) => set({ method: v ?? '' })}
          />
          <MultiPicker
            label="Measures"
            options={campaign.measures.map((x) => ({ id: x.id, label: `${short(x.id)} ${x.name}` }))}
            value={cell.measureIds}
            onChange={(v) => set({ measureIds: v })}
          />
          <div className="field-row">
            <NumberField label="Planned reps" value={cell.plannedReps} onChange={(v) => set({ plannedReps: v ?? 1 })} />
            <NumberField
              label="Valid runs needed"
              value={cell.minValidEvidence}
              onChange={(v) => set({ minValidEvidence: v ?? 1 })}
              help="Minimum valid evidence for this cell to count."
            />
          </div>
          <div className="field-row">
            <Field label="Priority">
              <Seg
                value={String(Math.min(3, Math.max(1, cell.priority)))}
                options={(['1', '2', '3'] as const).map((v) => ({ v, label: `P${v}` }))}
                onChange={(v) => set({ priority: Number(v) })}
              />
            </Field>
            <NumberField
              label="Drop order"
              value={cell.dropOrder}
              onChange={(v) => set({ dropOrder: v ?? 99 })}
              help="If time runs out, which cells go first? Lower drops first."
            />
            <div className="inspector-actions">
              <button className="mini" onClick={rankDropOrder}>
                Rank drop order from priority
              </button>
            </div>
          </div>
          <ChipsString
            label="Run order"
            options={['randomized', 'blocked by day', 'fixed order']}
            value={cell.orderOrBlock}
            onChange={(v) => set({ orderOrBlock: v })}
          />
          <RemoveMatrixCell campaign={campaign} id={cell.id} />
        </div>
      )}
    </DecisionGroup>
  )
}

/** Matrix cells have no deleteImpacts kind; keep the plain confirm remove. */
function RemoveMatrixCell({ campaign, id }: { campaign: TeCampaign; id: string }) {
  const { removeItem, selectRecord } = useTeStore.getState()
  const [confirm, setConfirm] = useState(false)
  const linkedCards = campaign.cards.filter((c) => c.matrixCellId === id).length
  const blocked = linkedCards > 0
  return (
    <div className="inspector-actions">
      <button
        className="mini danger"
        disabled={blocked}
        title={blocked ? `In use: ${linkedCards} card(s)` : undefined}
        onBlur={() => setConfirm(false)}
        onClick={() => {
          if (!confirm) {
            setConfirm(true)
            return
          }
          removeItem('matrix', id)
          selectRecord('matrix', null)
        }}
      >
        {blocked ? `In use: ${linkedCards} card(s)` : confirm ? 'Confirm remove?' : 'Remove'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// D9 Gate
// ---------------------------------------------------------------------------

function GateGroup({ campaign }: { campaign: TeCampaign }) {
  const { approveDesign } = useTeStore.getState()
  const [acked, setAcked] = useState(false)
  const warnings = designLint(campaign)
  const approved = campaign.designApprovedAt != null
  const qualified = campaign.qualificationPassedAt != null
  const frozenConfigs = campaign.configs.filter((x) => x.frozen).length
  const truthCount = campaign.measures.filter((x) => x.truth.primarySource.trim() !== '').length
  const approvedThresholds = campaign.measures.filter((x) => x.thresholdApproved).length
  const withThreshold = campaign.measures.filter((x) => x.threshold != null).length
  const byPriority = PRIORITIES.map(
    (p) => `${p}: ${campaign.questions.filter((q) => q.priority === p).length}`,
  ).join(', ')
  const byClass = FACTOR_CLASSES.filter((c) => campaign.factors.some((f) => f.classification === c))
    .map((c) => `${c}: ${campaign.factors.filter((f) => f.classification === c).length}`)
    .join(', ')
  const repClasses = [...new Set(campaign.threats.map((t) => t.representationClass))].join(', ')
  const totalReps = campaign.matrix.reduce((n, x) => n + x.plannedReps, 0)
  const totalMin = campaign.matrix.reduce((n, x) => n + x.minValidEvidence, 0)
  const hasBaseline = campaign.matrix.some((x) => x.method.toLowerCase().includes('baseline'))
  const issues: Array<{ level: 'block' | 'warn'; text: string }> = [
    ...(qualified ? [] : [{ level: 'block' as const, text: 'Pass the qualification gate on the Qualify stage first.' }]),
    ...warnings.map((w) => ({ level: 'warn' as const, text: w.text })),
  ]
  return (
    <DecisionGroup
      id="d9"
      question="Design ready?"
      hint={HELP['design-gate']}
      tier="required"
      state={approved ? 'done' : warnings.length === 0 && qualified ? 'partial' : 'empty'}
    >
      {approved && <Pill kind="good" text={`approved ${campaign.designApprovedAt!.slice(0, 10)}`} />}
      <StageReview
        title="Design review"
        rows={[
          {
            label: 'Questions',
            value: `${campaign.questions.length} (${byPriority}); frozen ${campaign.questions.filter((q) => q.frozen).length}`,
          },
          {
            label: 'Measures',
            value: `${campaign.measures.length}; truth source ${truthCount}/${campaign.measures.length}; thresholds approved ${approvedThresholds}/${withThreshold}`,
          },
          {
            label: 'Threats and conditions',
            value: `${campaign.threats.length} threat(s), ${campaign.conditions.length} condition(s)${repClasses ? `; ${repClasses}` : ''}`,
          },
          { label: 'Configs', value: `frozen ${frozenConfigs}/${campaign.configs.length}` },
          { label: 'Factors', value: byClass || 'none' },
          {
            label: 'Matrix',
            value: `${campaign.matrix.length} cell(s); baseline ${hasBaseline ? 'present' : 'missing'}; ${totalReps} planned reps vs ${totalMin} min evidence`,
          },
          { label: 'Open lint warnings', value: String(warnings.length) },
        ]}
        issues={issues}
        passLabel="Approve design"
        onPass={approveDesign}
        disabled={approved || (warnings.length > 0 && !acked)}
      />
      {!approved && warnings.length > 0 && (
        <label className="check-row">
          <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
          I reviewed the {warnings.length} open warning(s) and accept them.
        </label>
      )}
    </DecisionGroup>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function DesignPanel({ campaign }: { campaign: TeCampaign }) {
  const warnings = designLint(campaign)
  const approved = campaign.designApprovedAt != null
  const gate = approved
    ? { kind: 'good' as const, text: 'design approved' }
    : warnings.length
      ? { kind: 'warn' as const, text: `${warnings.length} open warning(s)` }
      : { kind: 'neutral' as const, text: 'no open warnings' }
  return (
    <div className="te-panel">
      <PhaseIntro phase="design" gate={gate} />
      <QuestionsGroup campaign={campaign} />
      <ConfigsGroup campaign={campaign} />
      <ThreatsGroup campaign={campaign} />
      <ConditionsGroup campaign={campaign} />
      <MeasuresGroup campaign={campaign} />
      <PredictionsGroup campaign={campaign} />
      <FactorsGroup campaign={campaign} />
      <MatrixGroup campaign={campaign} />
      <GateGroup campaign={campaign} />
    </div>
  )
}

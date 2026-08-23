import { useState } from 'react'
import type {
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
  TeHypothesis,
  TeMatrixCell,
  TeMeasure,
  TeQuestion,
  TeThreatProfile,
  ThreatMissionKind,
  ThreatProfileClass,
  ThresholdSource,
} from '../model/types'
import { useTeStore } from '../state/teStore'
import { useStore } from '../../state/store'
import { formatSpeed } from '../../geometry/geo'
import { designLint } from '../validate'
import { nowIso } from '../model/empty'
import { MEASURE_DICTIONARY } from '../seed/measureDictionary'
import { THREAT_VIGNETTES } from '../seed/vignettes'
import { QUESTION_BANKS } from '../seed/questionBanks'
import { attemptInflation, sampleSizeProportion } from '../calc/stats'
import { HELP, allPeople } from './help'
import {
  CheckField,
  ChipList,
  DateField,
  Field,
  GateList,
  MultiPicker,
  NumberField,
  PersonField,
  PhaseIntro,
  Pill,
  SelectField,
  Seg,
  SubTitle,
  SuggestField,
  TextField,
  VersionField,
  fmtDate,
} from './kit'

type Tab =
  | 'questions'
  | 'hypotheses'
  | 'measures'
  | 'threats'
  | 'conditions'
  | 'configs'
  | 'factors'
  | 'matrix'
  | 'gate'

const TABS: Array<{ v: Tab; label: string }> = [
  { v: 'questions', label: 'Questions' },
  { v: 'hypotheses', label: 'Hypotheses' },
  { v: 'measures', label: 'Measures' },
  { v: 'threats', label: 'Threats' },
  { v: 'conditions', label: 'Conditions' },
  { v: 'configs', label: 'Configs' },
  { v: 'factors', label: 'Factors' },
  { v: 'matrix', label: 'Matrix' },
  { v: 'gate', label: 'Gate' },
]

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

const THRESHOLD_SOURCES: ThresholdSource[] = [
  'law-regulation-safety',
  'contract-validated-requirement',
  'mission-arithmetic',
  'accepted-baseline',
  'customer-decision-rule',
  'analyst-judgment-labeled',
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

const NAV_MODES = ['gps', 'inertial', 'rf-manual', 'optical', 'fiber', 'mixed']

const MATRIX_METHODS = [
  'baseline comparison',
  'characterization sweep',
  'comparison',
  'stress',
  'diagnostic',
]

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

function short(id: string): string {
  return id.split('-').slice(2).join('-') || id
}

function QuestionsTab({ campaign }: { campaign: TeCampaign }) {
  const { addQuestion, patchItem, removeItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.questions ?? null)
  const q = campaign.questions.find((x) => x.id === selected)
  const set = (patch: Partial<TeQuestion>) => q && patchItem('questions', q.id, patch)
  const vague = q ? VAGUE_TERMS.filter((w) => q.wording.toLowerCase().includes(w)) : []
  return (
    <div className="inspector-body">
      <ChipList
        items={campaign.questions.map((x) => ({
          id: x.id,
          label: `${short(x.id)}: ${x.wording.slice(0, 32) || 'new'}`,
        }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('questions', id)}
        onAdd={() => selectRecord('questions', addQuestion())}
        addLabel="+ question"
      />
      <Field label="+ From question bank">
        <select
          value=""
          onChange={(e) => {
            const wording = e.target.value
            if (!wording) return
            const id = addQuestion()
            patchItem('questions', id, { wording })
            selectRecord('questions', id)
          }}
        >
          <option value="">pick a question…</option>
          {QUESTION_BANKS.map((b) => (
            <optgroup key={b.key} label={`${b.key}: ${b.name}`}>
              {b.items.map((it, i) => (
                <option key={i} value={it}>
                  {it.length > 90 ? `${it.slice(0, 90)}…` : it}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {q && (
        <div className="run-row">
          <TextField label="Wording (bounded and answerable)" rows={2} value={q.wording} onChange={(v) => set({ wording: v })} />
          <GateList items={vague.length ? [`Vague terms in wording: ${vague.join(', ')}. Quantify them.`] : []} kind="warn" />
          <div className="field">
            <span>
              Priority
              <span className="help-dot" tabIndex={0} data-help={HELP['question-priority']}>
                ?
              </span>
            </span>
            <Seg value={q.priority} options={PRIORITIES.map((v) => ({ v, label: v }))} onChange={(v) => set({ priority: v })} />
          </div>
          <div className="field-row">
            <SelectField label="Pattern" value={q.pattern} options={PATTERNS.map((v) => ({ v, label: v }))} onChange={(v) => v && set({ pattern: v })} />
            <DateField label="Required answer date" value={q.requiredAnswerDate} onChange={(v) => set({ requiredAnswerDate: v ?? '' })} />
          </div>
          <TextField label="Current evidence state" rows={2} value={q.currentEvidenceState} onChange={(v) => set({ currentEvidenceState: v })} />
          <div className="field-row">
            <TextField label="Consequence if unanswered" value={q.consequenceIfUnanswered} onChange={(v) => set({ consequenceIfUnanswered: v })} />
            <SuggestField
              label="Evidence authority"
              value={q.evidenceAuthority}
              onChange={(v) => set({ evidenceAuthority: v })}
              suggestions={allPeople(campaign)}
              placeholder={campaign.charter.evidenceAcceptanceAuthority || undefined}
              onBlur={() => {
                if (q.evidenceAuthority.trim() === '' && campaign.charter.evidenceAcceptanceAuthority.trim() !== '')
                  set({ evidenceAuthority: campaign.charter.evidenceAcceptanceAuthority })
              }}
            />
          </div>
          <CheckField label="Frozen (locks the ranked question set)" value={q.frozen} onChange={(v) => set({ frozen: v })} />
          <p className="muted small">Edits to a frozen question route through a change record.</p>
          <div className="field-row">
            <SelectField label="Disposition (set at closeout)" value={q.disposition} allowEmpty="undisposed" options={DISPOSITIONS.map((v) => ({ v, label: v }))} onChange={(v) => set({ disposition: v })} />
            <SelectField label="Evidence level reached" value={q.evidenceLevel} allowEmpty="not set" options={EVIDENCE_LEVELS.map((v) => ({ v, label: v }))} onChange={(v) => set({ evidenceLevel: v })} />
          </div>
          <TextField label="Disposition note" rows={2} value={q.dispositionNote} onChange={(v) => set({ dispositionNote: v })} />
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => { removeItem('questions', q.id); selectRecord('questions', null) }}>
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function HypothesesTab({ campaign }: { campaign: TeCampaign }) {
  const { addHypothesis, patchItem, removeItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.hypotheses ?? null)
  const [qid, setQid] = useState<string | null>(campaign.questions[0]?.id ?? null)
  const targetQ = campaign.questions.some((q) => q.id === qid)
    ? qid
    : (campaign.questions[0]?.id ?? null)
  const h = campaign.hypotheses.find((x) => x.id === selected)
  const set = (patch: Partial<TeHypothesis>) => h && patchItem('hypotheses', h.id, patch)
  const sentence = h
    ? `Under ${h.underConditions || '[conditions]'}, the system produces ${h.producesBehavior || '[behavior]'}, measured by ${h.measuredBy || '[measure]'}, relative to ${h.relativeTo || '[threshold]'}.`
    : ''
  return (
    <div className="inspector-body">
      {campaign.questions.length === 0 && (
        <p className="muted small">Create a question first. Every hypothesis belongs to a question.</p>
      )}
      <SelectField
        label="Question for new hypotheses"
        value={targetQ}
        allowEmpty="pick a question"
        options={campaign.questions.map((x) => ({ v: x.id, label: `${x.id} ${x.wording.slice(0, 40)}` }))}
        onChange={setQid}
        help={HELP['hypothesis-question']}
      />
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
          <SelectField
            label="Parent question"
            value={h.questionId || null}
            allowEmpty="not set"
            options={campaign.questions.map((x) => ({ v: x.id, label: `${x.id} ${x.wording.slice(0, 40)}` }))}
            onChange={(v) => set({ questionId: v ?? '' })}
          />
          <div className="spec-summary">{sentence}</div>
          <div className="field-row">
            <SuggestField
              label="Under conditions"
              value={h.underConditions}
              onChange={(v) => set({ underConditions: v })}
              suggestions={[...campaign.conditions.map((x) => x.name), ...campaign.threats.map((x) => x.name)]}
            />
            <TextField label="Produces behavior" value={h.producesBehavior} onChange={(v) => set({ producesBehavior: v })} />
          </div>
          <div className="field-row">
            <SuggestField
              label="Measured by"
              value={h.measuredBy}
              onChange={(v) => set({ measuredBy: v })}
              suggestions={[...campaign.measures.map((x) => x.name), ...MEASURE_DICTIONARY.map((d) => d.name)]}
            />
            <SuggestField
              label="Relative to"
              value={h.relativeTo}
              onChange={(v) => set({ relativeTo: v })}
              suggestions={campaign.measures
                .filter((x) => x.threshold != null)
                .map((x) => `threshold ${x.threshold} ${x.unit}`.trim())}
            />
          </div>
          <SubTitle>Prediction</SubTitle>
          <div className="field-row">
            <TextField label="Predicted value" value={h.predictedValue} onChange={(v) => set({ predictedValue: v })} help={HELP.prediction} />
            <SelectField label="Prediction type" value={h.predictionType} options={PREDICTION_TYPES.map((v) => ({ v, label: v }))} onChange={(v) => v && set({ predictionType: v })} />
          </div>
          <TextField label="Expected variability" value={h.expectedVariability} onChange={(v) => set({ expectedVariability: v })} />
          <SubTitle>Result mapping</SubTitle>
          <TextField label="Result that supports" rows={2} value={h.supportingResult} onChange={(v) => set({ supportingResult: v })} />
          <TextField label="Result that refutes" rows={2} value={h.refutingResult} onChange={(v) => set({ refutingResult: v })} help={HELP.hypothesis} />
          <TextField label="Result that is inconclusive" rows={2} value={h.inconclusiveResult} onChange={(v) => set({ inconclusiveResult: v })} />
          <div className="field-row">
            <TextField label="Null hypothesis" value={h.nullHypothesis} onChange={(v) => set({ nullHypothesis: v })} />
            <TextField label="Competing explanations" value={h.competingExplanations} onChange={(v) => set({ competingExplanations: v })} />
          </div>
          <TextField label="Assumptions" rows={2} value={h.assumptions} onChange={(v) => set({ assumptions: v })} />
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => { removeItem('hypotheses', h.id); selectRecord('hypotheses', null) }}>
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MeasuresTab({ campaign }: { campaign: TeCampaign }) {
  const { addMeasure, patchItem, removeItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.measures ?? null)
  const [qid, setQid] = useState<string | null>(campaign.questions[0]?.id ?? null)
  const targetQ = campaign.questions.some((q) => q.id === qid)
    ? qid
    : (campaign.questions[0]?.id ?? null)
  const m = campaign.measures.find((x) => x.id === selected)
  const set = (patch: Partial<TeMeasure>) => m && patchItem('measures', m.id, patch)
  const truthSources = campaign.measures.flatMap((x) => [x.truth.primarySource, x.truth.backupSource])

  const applyDict = (key: string) => {
    const entry = MEASURE_DICTIONARY.find((d) => d.dictKey === key)
    if (!entry || !targetQ) return
    const id = addMeasure(targetQ)
    patchItem('measures', id, {
      dictKey: entry.dictKey,
      name: entry.name,
      family: entry.family,
      measureType: entry.measureType,
      unit: entry.unit,
      exactDefinition: entry.definition,
      numeratorRule: entry.numeratorRule,
      denominatorRule: entry.denominatorRule,
      startEvent: entry.startEvent,
      stopEvent: entry.stopEvent,
      experimentalUnit: entry.experimentalUnit,
      higherIsBetter: entry.higherIsBetter,
    })
    selectRecord('measures', id)
  }

  return (
    <div className="inspector-body">
      {campaign.questions.length === 0 && (
        <p className="muted small">Create a question first. Every measure belongs to a question.</p>
      )}
      <div className="field-row">
        <SelectField
          label="Question for new measures"
          value={targetQ}
          allowEmpty="pick a question"
          options={campaign.questions.map((x) => ({ v: x.id, label: `${x.id} ${x.wording.slice(0, 40)}` }))}
          onChange={setQid}
        />
        <Field label="+ From dictionary">
          <select value="" disabled={!targetQ} onChange={(e) => applyDict(e.target.value)}>
            <option value="">pick an entry…</option>
            {MEASURE_DICTIONARY.map((d) => (
              <option key={d.dictKey} value={d.dictKey}>
                {d.dictKey}: {d.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ChipList
        items={campaign.measures.map((x) => ({
          id: x.id,
          label: `${short(x.id)}: ${x.name.slice(0, 26) || 'new'}${x.frozen ? ' (frozen)' : ''}`,
        }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('measures', id)}
        onAdd={targetQ ? () => selectRecord('measures', addMeasure(targetQ)) : undefined}
        addLabel="+ measure"
      />
      {m && (
        <div className="run-row">
          <div className="field-row">
            <SuggestField label="Name" value={m.name} onChange={(v) => set({ name: v })} suggestions={MEASURE_DICTIONARY.map((d) => d.name)} />
            <SelectField label="Family" value={m.family} options={FAMILIES.map((v) => ({ v, label: v }))} onChange={(v) => v && set({ family: v })} />
            <SelectField label="Measure type" value={m.measureType} options={MEASURE_TYPES.map((v) => ({ v, label: v }))} onChange={(v) => v && set({ measureType: v })} />
          </div>
          <TextField label="Exact definition" rows={2} value={m.exactDefinition} onChange={(v) => set({ exactDefinition: v })} />
          <SuggestField label="Unit" value={m.unit} onChange={(v) => set({ unit: v })} suggestions={[...MEASURE_DICTIONARY.map((d) => d.unit), 'ft', 'nm', '%', 'count']} />
          <TextField label="Numerator rule" rows={2} value={m.numeratorRule} onChange={(v) => set({ numeratorRule: v })} />
          <TextField label="Denominator rule" rows={2} value={m.denominatorRule} onChange={(v) => set({ denominatorRule: v })} />
          <div className="field-row">
            <SuggestField label="Start event" value={m.startEvent} onChange={(v) => set({ startEvent: v })} suggestions={MEASURE_DICTIONARY.map((d) => d.startEvent)} />
            <SuggestField label="Stop event" value={m.stopEvent} onChange={(v) => set({ stopEvent: v })} suggestions={MEASURE_DICTIONARY.map((d) => d.stopEvent)} />
          </div>
          <SuggestField label="Experimental unit" value={m.experimentalUnit} onChange={(v) => set({ experimentalUnit: v })} suggestions={MEASURE_DICTIONARY.map((d) => d.experimentalUnit)} />
          <SubTitle>Truth source</SubTitle>
          <div className="field-row">
            <SuggestField label="Primary source" value={m.truth.primarySource} onChange={(v) => set({ truth: { ...m.truth, primarySource: v } })} suggestions={truthSources} />
            <SuggestField label="Backup source" value={m.truth.backupSource} onChange={(v) => set({ truth: { ...m.truth, backupSource: v } })} suggestions={truthSources} />
          </div>
          <div className="field-row">
            <TextField label="Independence from the system under test" value={m.truth.independenceFromSut} onChange={(v) => set({ truth: { ...m.truth, independenceFromSut: v } })} />
            <NumberField label="Time tolerance (s)" value={m.truth.timeToleranceS} onChange={(v) => set({ truth: { ...m.truth, timeToleranceS: v } })} step={0.1} />
          </div>
          <SubTitle>Data rules</SubTitle>
          <TextField label="Missing-data rule" value={m.missingDataRule} onChange={(v) => set({ missingDataRule: v })} />
          <TextField label="Invalid-data rule" value={m.invalidDataRule} onChange={(v) => set({ invalidDataRule: v })} />
          <TextField label="Censoring rule" value={m.censoringRule} onChange={(v) => set({ censoringRule: v })} />
          <SubTitle>Thresholds</SubTitle>
          <div className="field-row">
            <NumberField label="Threshold" value={m.threshold} onChange={(v) => set({ threshold: v })} help={HELP.thresholds} />
            <NumberField label="Objective" value={m.objective} onChange={(v) => set({ objective: v })} />
            <NumberField label="Failure boundary" value={m.failureBoundary} onChange={(v) => set({ failureBoundary: v })} />
          </div>
          <div className="field-row">
            <SelectField label="Threshold source" value={m.thresholdSource} allowEmpty="not set" options={THRESHOLD_SOURCES.map((v) => ({ v, label: v }))} onChange={(v) => set({ thresholdSource: v })} />
            <CheckField label="Threshold customer-approved" value={m.thresholdApproved} onChange={(v) => set({ thresholdApproved: v })} help={HELP.thresholds} />
          </div>
          <div className="field-row">
            <CheckField label="Higher is better" value={m.higherIsBetter} onChange={(v) => set({ higherIsBetter: v })} />
            <NumberField label="Required repetitions" value={m.requiredRepetitions} onChange={(v) => set({ requiredRepetitions: v })} />
          </div>
          <div className="field">
            <span>Interval method</span>
            <Seg value={m.intervalMethod} options={INTERVAL_METHODS.map((v) => ({ v, label: v }))} onChange={(v) => set({ intervalMethod: v })} />
          </div>
          {m.intervalMethod === 'bayes' && (
            <div className="field-row">
              <NumberField label="Prior alpha" value={m.priorAlpha} onChange={(v) => set({ priorAlpha: v ?? 1 })} step={0.5} />
              <NumberField label="Prior beta" value={m.priorBeta} onChange={(v) => set({ priorBeta: v ?? 1 })} step={0.5} />
            </div>
          )}
          <CheckField label="Frozen (required before card issue)" value={m.frozen} onChange={(v) => set({ frozen: v })} />
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => { removeItem('measures', m.id); selectRecord('measures', null) }}>
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ThreatsTab({ campaign }: { campaign: TeCampaign }) {
  const { addThreat, patchItem, removeItem, selectRecord, bumpRecordVersion } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.threats ?? null)
  const library = useStore((s) => s.scenario.library)
  const uasModels = library.filter((m) => m.kind === 'uas')
  const t = campaign.threats.find((x) => x.id === selected)
  const set = (patch: Partial<TeThreatProfile>) => t && patchItem('threats', t.id, patch)
  const navOptions = (mode: string) =>
    (mode && !NAV_MODES.includes(mode) ? [mode, ...NAV_MODES] : NAV_MODES).map((v) => ({
      v,
      label: v,
    }))
  const linkedModel = uasModels.find((m) => m.id === t?.specModelId)
  const fillFromModel = () => {
    const u = linkedModel?.uas
    if (!t || !u) return
    set({
      airframe: u.airframe,
      speedBandMps: [u.cruiseSpeedMps, Math.max(u.cruiseSpeedMps, u.maxSpeedMps)],
      altBandFt: [u.altBandFt[0], u.altBandFt[1]],
    })
  }
  const factorNames = (cls: string) =>
    campaign.factors.filter((f) => f.classification === cls).map((f) => f.name)
  const fidelityFeatures = [
    ...campaign.threats.flatMap((x) => x.fidelity.map((f) => f.feature)),
    'emissions',
    'speed',
    'payload',
    'nav',
  ]
  return (
    <div className="inspector-body">
      <ChipList
        items={campaign.threats.map((x) => ({ id: x.id, label: `${short(x.id)}: ${x.name || 'new'} ${x.version}` }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('threats', id)}
        onAdd={() => selectRecord('threats', addThreat())}
        addLabel="+ threat"
      />
      <Field label="+ From seeded vignette">
        <select
          value=""
          onChange={(e) => {
            const v = THREAT_VIGNETTES.find((x) => x.key === e.target.value)
            if (!v) return
            const id = addThreat()
            patchItem('threats', id, v.patch)
            selectRecord('threats', id)
          }}
        >
          <option value="">Pick a vignette…</option>
          {THREAT_VIGNETTES.map((v) => (
            <option key={v.key} value={v.key}>
              {v.key}: {v.name}
            </option>
          ))}
        </select>
      </Field>
      {t && (
        <div className="run-row">
          <div className="field-row">
            <SuggestField
              label="Name"
              value={t.name}
              onChange={(v) => set({ name: v })}
              suggestions={[...THREAT_VIGNETTES.map((v) => v.patch.name ?? v.name), ...uasModels.map((m) => m.name)]}
            />
            <VersionField label="Version" value={t.version} onBump={() => bumpRecordVersion('threats', t.id)} />
          </div>
          <MultiPicker
            label="Missions represented"
            options={MISSIONS.map((v) => ({ id: v, label: v }))}
            value={t.missions}
            onChange={(v) => set({ missions: v as ThreatMissionKind[] })}
          />
          <div className="field">
            <span>UAS group</span>
            <Seg
              value={String(t.uasGroup) as (typeof UAS_GROUPS)[number]}
              options={UAS_GROUPS.map((v) => ({ v, label: v }))}
              onChange={(v) => set({ uasGroup: Number(v) as TeThreatProfile['uasGroup'] })}
            />
          </div>
          <div className="field-row">
            <SuggestField
              label="Airframe"
              value={t.airframe}
              onChange={(v) => set({ airframe: v })}
              suggestions={[
                'quad',
                'fixed-wing',
                'vtol',
                'one-way-attack',
                'fpv',
                ...uasModels.map((m) => m.uas?.airframe ?? ''),
              ]}
            />
            <SelectField
              label="Board model"
              value={t.specModelId}
              allowEmpty="not linked"
              options={uasModels.map((m) => ({
                v: m.id,
                label: `${m.threatProfile?.designator ?? ''} ${m.name}`.trim(),
              }))}
              onChange={(v) => set({ specModelId: v })}
            />
            <SelectField label="Navigation mode" value={t.navMode || null} allowEmpty="not set" options={navOptions(t.navMode)} onChange={(v) => set({ navMode: v ?? '' })} />
          </div>
          {linkedModel?.uas && (
            <div className="inspector-actions">
              <button className="mini" onClick={fillFromModel}>
                Fill airframe and bands from {linkedModel.name}
              </button>
            </div>
          )}
          <div className="field-row">
            <Field label="Speed band min (m/s)">
              <input
                type="number"
                value={t.speedBandMps[0]}
                onChange={(e) => {
                  if (e.target.value === '') return
                  set({ speedBandMps: [Number(e.target.value), t.speedBandMps[1]] })
                }}
                onBlur={() => {
                  if (t.speedBandMps[0] > t.speedBandMps[1])
                    set({ speedBandMps: [t.speedBandMps[1], t.speedBandMps[1]] })
                }}
              />
            </Field>
            <Field label="Speed band max (m/s)">
              <input
                type="number"
                value={t.speedBandMps[1]}
                onChange={(e) => {
                  if (e.target.value === '') return
                  set({ speedBandMps: [t.speedBandMps[0], Number(e.target.value)] })
                }}
                onBlur={() => {
                  if (t.speedBandMps[1] < t.speedBandMps[0])
                    set({ speedBandMps: [t.speedBandMps[0], t.speedBandMps[0]] })
                }}
              />
            </Field>
            <Field label="Altitude band min (ft)">
              <input type="number" value={t.altBandFt[0]} onChange={(e) => set({ altBandFt: [Number(e.target.value), t.altBandFt[1]] })} />
            </Field>
            <Field label="Altitude band max (ft)">
              <input type="number" value={t.altBandFt[1]} onChange={(e) => set({ altBandFt: [t.altBandFt[0], Number(e.target.value)] })} />
            </Field>
          </div>
          <TextField label="Emissions summary" value={t.emissionsSummary} onChange={(v) => set({ emissionsSummary: v })} />
          <div className="field-row">
            <NumberField label="Count" value={t.count} onChange={(v) => set({ count: v ?? 1 })} />
            <TextField label="Raid note" value={t.raidNote} onChange={(v) => set({ raidNote: v })} />
          </div>
          <TextField label="Operator state note" value={t.operatorStateNote} onChange={(v) => set({ operatorStateNote: v })} />
          <div className="field-row">
            <SelectField label="Representation class" value={t.representationClass} options={REPRESENTATION_CLASSES.map((v) => ({ v, label: v }))} onChange={(v) => v && set({ representationClass: v })} />
          </div>
          <div className="field">
            <span>Profile class</span>
            <Seg value={t.profileClass} options={PROFILE_CLASSES.map((v) => ({ v, label: v }))} onChange={(v) => set({ profileClass: v })} />
          </div>
          <div className="field">
            <span>OPFOR mode</span>
            <Seg value={t.opforMode} options={OPFOR_MODES.map((o) => ({ v: o.v, label: o.v }))} onChange={(v) => set({ opforMode: v })} />
          </div>
          <p className="muted small">{OPFOR_MODES.find((o) => o.v === t.opforMode)?.help}</p>
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
            Fidelity grid
          </SubTitle>
          {t.fidelity.map((f, i) => (
            <div key={i} className="field-row te-table-row">
              <SuggestField label="Feature" value={f.feature} onChange={(v) => set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, feature: v } : x)) })} suggestions={fidelityFeatures} />
              <TextField label="Intended" value={f.intendedState} onChange={(v) => set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, intendedState: v } : x)) })} />
              <TextField label="Represented" value={f.representedState} onChange={(v) => set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, representedState: v } : x)) })} />
              <SelectField label="Level" value={f.level} options={FIDELITY_LEVELS.map((v) => ({ v, label: v }))} onChange={(v) => v && set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, level: v } : x)) })} />
              <TextField label="Likely effect" value={f.likelyEffect} onChange={(v) => set({ fidelity: t.fidelity.map((x, j) => (j === i ? { ...x, likelyEffect: v } : x)) })} />
              <button className="mini danger" onClick={() => set({ fidelity: t.fidelity.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
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
              <TextField label="Trigger" value={r.trigger} onChange={(v) => set({ adaptationRules: t.adaptationRules.map((x, j) => (j === i ? { ...x, trigger: v } : x)) })} />
              <TextField label="Allowed response" value={r.allowedResponse} onChange={(v) => set({ adaptationRules: t.adaptationRules.map((x, j) => (j === i ? { ...x, allowedResponse: v } : x)) })} />
              <button className="mini danger" onClick={() => set({ adaptationRules: t.adaptationRules.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <SubTitle>Red control</SubTitle>
          <SuggestField label="Red-controlled variables" value={t.redControlledVariables} onChange={(v) => set({ redControlledVariables: v })} suggestions={factorNames('bounded-red-choice')} />
          <SuggestField label="Red fixed variables" value={t.redFixedVariables} onChange={(v) => set({ redFixedVariables: v })} suggestions={factorNames('held-control')} />
          <SuggestField label="Prohibited actions" value={t.prohibitedActions} onChange={(v) => set({ prohibitedActions: v })} suggestions={factorNames('prohibited-variable')} />
          <div className="field-row">
            <TextField label="Blinding and information control" value={t.blinding} onChange={(v) => set({ blinding: v })} />
            <SuggestField
              label="Validation source"
              value={t.validationSource}
              onChange={(v) => set({ validationSource: v })}
              suggestions={[
                ...campaign.charter.sourceDocumentsAndPriorEvidence.split('\n'),
                ...campaign.threats.map((x) => x.validationSource),
              ]}
            />
          </div>
          <SubTitle>Generalization</SubTitle>
          <TextField label="Permitted generalization" rows={2} value={t.permittedGeneralization} onChange={(v) => set({ permittedGeneralization: v })} />
          <TextField label="Prohibited generalization" rows={2} value={t.prohibitedGeneralization} onChange={(v) => set({ prohibitedGeneralization: v })} />
          <TextField label="Notes" rows={2} value={t.notes} onChange={(v) => set({ notes: v })} />
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => { removeItem('threats', t.id); selectRecord('threats', null) }}>
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Condition text derived from the board scenario environment. */
function boardEnvironmentText(): { weather: string; em: string } | null {
  const scenario = useStore.getState().scenario
  if (!scenario) return null
  const env = scenario.environment
  return {
    weather: `Wind ${formatSpeed(env.windSpeedMps, 'aviation')} from ${env.windFromDeg} deg true; ${env.temperatureC} C; ${env.precipitation ?? 'clear'}; ${env.light ?? 'day'} light`,
    em: `EM background: ${env.emBackground ?? 'rural'}`,
  }
}

function ConditionsTab({ campaign }: { campaign: TeCampaign }) {
  const { addCondition, patchItem, removeItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.conditions ?? null)
  useStore((s) => s.scenario.environment)
  const c = campaign.conditions.find((x) => x.id === selected)
  const set = (patch: Partial<TeCondition>) => c && patchItem('conditions', c.id, patch)
  const board = boardEnvironmentText()

  const prefill = () => {
    if (!c) return
    const env = boardEnvironmentText()
    if (!env) return
    set({ weatherAndIllumination: env.weather, emEnvironment: env.em })
  }

  const add = () => {
    const id = addCondition()
    const env = boardEnvironmentText()
    if (env) patchItem('conditions', id, { weatherAndIllumination: env.weather, emEnvironment: env.em })
    selectRecord('conditions', id)
  }

  const differs =
    board != null &&
    c != null &&
    ((c.weatherAndIllumination.trim() !== '' && c.weatherAndIllumination !== board.weather) ||
      (c.emEnvironment.trim() !== '' && c.emEnvironment !== board.em))

  return (
    <div className="inspector-body">
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
          <div className="inspector-actions">
            <button className="mini" onClick={prefill}>Prefill from board environment</button>
          </div>
          <TextField label="Terrain and clutter" rows={2} value={c.terrainAndClutter} onChange={(v) => set({ terrainAndClutter: v })} />
          <TextField label="Weather and illumination" rows={2} value={c.weatherAndIllumination} onChange={(v) => set({ weatherAndIllumination: v })} />
          <TextField label="EM environment" rows={2} value={c.emEnvironment} onChange={(v) => set({ emEnvironment: v })} />
          {differs && (
            <p className="muted small">
              The text above differs from the current board environment. Use the prefill button to refresh.
            </p>
          )}
          <div className="field-row">
            <TextField label="Network state" value={c.networkState} onChange={(v) => set({ networkState: v })} />
            <TextField label="Background activity" value={c.backgroundActivity} onChange={(v) => set({ backgroundActivity: v })} />
          </div>
          <div className="field-row">
            <TextField label="Operator workload" value={c.operatorWorkload} onChange={(v) => set({ operatorWorkload: v })} />
            <TextField label="Supporting systems" value={c.supportingSystems} onChange={(v) => set({ supportingSystems: v })} />
          </div>
          <TextField label="Degraded modes" rows={2} value={c.degradedModes} onChange={(v) => set({ degradedModes: v })} />
          <TextField label="Permitted generalization" rows={2} value={c.permittedGeneralization} onChange={(v) => set({ permittedGeneralization: v })} />
          <TextField label="Prohibited generalization" rows={2} value={c.prohibitedGeneralization} onChange={(v) => set({ prohibitedGeneralization: v })} />
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => { removeItem('conditions', c.id); selectRecord('conditions', null) }}>
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigsTab({ campaign }: { campaign: TeCampaign }) {
  const { addConfig, patchItem, removeItem, selectRecord, duplicateConfig, bumpRecordVersion } =
    useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.configs ?? null)
  const boundaries = useStore((s) => s.scenario.boundaries)
  const boundaryNames = boundaries.map((b) => b.name)
  const people = allPeople(campaign)
  const cfg = campaign.configs.find((x) => x.id === selected)
  const set = (patch: Partial<TeConfigBaseline>) => cfg && patchItem('configs', cfg.id, patch)
  const locked = cfg?.frozen ?? false

  const duplicateLatest = () => {
    const src = campaign.configs[campaign.configs.length - 1]
    if (!src) return
    const id = duplicateConfig(src.id)
    if (id) selectRecord('configs', id)
  }

  const describeFromBoard = () => {
    if (!cfg) return
    const sc = useStore.getState().scenario
    const describe = (kind: 'sensor' | 'c2' | 'effector') => {
      const counts = new Map<string, number>()
      for (const e of sc.entities) {
        if (e.kind !== kind || e.enabled === false) continue
        const model = sc.library.find((m) => m.id === e.specId)
        const name = model?.name ?? e.name
        counts.set(name, (counts.get(name) ?? 0) + 1)
      }
      return [...counts.entries()].map(([n, k]) => `${k}x ${n}`).join(', ')
    }
    const patch: Partial<TeConfigBaseline> = {}
    if (cfg.sensorConfiguration.trim() === '') patch.sensorConfiguration = describe('sensor')
    if (cfg.c2AndNetworkConfiguration.trim() === '') {
      const c2 = describe('c2')
      patch.c2AndNetworkConfiguration = c2 === '' ? '' : `${c2}; ${sc.connections.length} connection(s)`
    }
    if (cfg.effectorConfiguration.trim() === '') patch.effectorConfiguration = describe('effector')
    set(patch)
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

  return (
    <div className="inspector-body">
      <ChipList
        items={campaign.configs.map((x) => ({
          id: x.id,
          label: `${short(x.id)}: ${x.name || 'new'} ${x.version}${x.frozen ? ' (frozen)' : ''}`,
        }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('configs', id)}
        onAdd={() => selectRecord('configs', addConfig())}
        addLabel="+ baseline"
      />
      {campaign.configs.length > 0 && (
        <div className="inspector-actions">
          <button className="mini" onClick={duplicateLatest}>Duplicate latest baseline</button>
        </div>
      )}
      {cfg && (
        <div className="run-row">
          <div className="inspector-actions">
            <button className="mini" onClick={snapshot}>Snapshot board scenario</button>
            <button className="mini" disabled={locked} onClick={describeFromBoard}>Describe from board</button>
            <button className="primary" disabled={cfg.frozen} onClick={() => set({ frozen: true, freezeTime: nowIso() })}>
              Freeze baseline
            </button>
          </div>
          {cfg.scenarioSnapshot != null && (
            <p className="muted small">
              Snapshot stored: {(cfg.scenarioSnapshot.length / 1024).toFixed(1)} KB. Capture time
              is in the drift log.
            </p>
          )}
          {cfg.frozen && (
            <p className="muted small">
              Frozen {fmtDate(cfg.freezeTime)}. Identity fields are locked. Changes require a new
              baseline.
            </p>
          )}
          <div className="field-row">
            <TextField label="Name" value={cfg.name} onChange={(v) => set({ name: v })} disabled={locked} />
            <VersionField label="Version" value={cfg.version} onBump={() => bumpRecordVersion('configs', cfg.id)} disabled={locked} />
          </div>
          <div className="field-row">
            <SuggestField label="Boundary: inside" value={cfg.boundaryInside} onChange={(v) => set({ boundaryInside: v })} suggestions={boundaryNames} disabled={locked} />
            <SuggestField label="Boundary: excluded" value={cfg.boundaryExcluded} onChange={(v) => set({ boundaryExcluded: v })} suggestions={boundaryNames} disabled={locked} />
          </div>
          <TextField label="Hardware and serials" rows={2} value={cfg.hardwareAndSerials} onChange={(v) => set({ hardwareAndSerials: v })} disabled={locked} />
          <div className="field-row">
            <TextField label="Software versions" value={cfg.softwareVersions} onChange={(v) => set({ softwareVersions: v })} disabled={locked} />
            <TextField label="Firmware versions" value={cfg.firmwareVersions} onChange={(v) => set({ firmwareVersions: v })} disabled={locked} />
          </div>
          <TextField label="Settings and modes" rows={2} value={cfg.settingsAndModes} onChange={(v) => set({ settingsAndModes: v })} disabled={locked} />
          <TextField label="Sensor configuration" rows={2} value={cfg.sensorConfiguration} onChange={(v) => set({ sensorConfiguration: v })} disabled={locked} />
          <TextField label="C2 and network configuration" rows={2} value={cfg.c2AndNetworkConfiguration} onChange={(v) => set({ c2AndNetworkConfiguration: v })} disabled={locked} />
          <TextField label="Effector configuration" rows={2} value={cfg.effectorConfiguration} onChange={(v) => set({ effectorConfiguration: v })} disabled={locked} />
          <div className="field-row">
            <SuggestField label="Operators and training" value={cfg.operatorsAndTraining} onChange={(v) => set({ operatorsAndTraining: v })} suggestions={people} disabled={locked} />
            <TextField label="Procedure version" value={cfg.procedureVersion} onChange={(v) => set({ procedureVersion: v })} disabled={locked} />
          </div>
          <TextField label="Known defects and waivers" rows={2} value={cfg.knownDefectsAndWaivers} onChange={(v) => set({ knownDefectsAndWaivers: v })} disabled={locked} />
          <div className="field-row">
            <SuggestField label="Functional check result" value={cfg.functionalCheckResult} onChange={(v) => set({ functionalCheckResult: v })} suggestions={['pass', 'pass with notes', 'fail']} disabled={locked} />
            <PersonField label="Released by" value={cfg.releasedBy} onChange={(v) => set({ releasedBy: v })} people={people} disabled={locked} />
          </div>
          <SubTitle
            action={
              <button className="mini" onClick={() => set({ driftLog: [...cfg.driftLog, { time: nowIso(), note: '' }] })}>
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
              <TextField label="Note" value={d.note} onChange={(v) => set({ driftLog: cfg.driftLog.map((x, j) => (j === i ? { ...x, note: v } : x)) })} />
              <button className="mini danger" onClick={() => set({ driftLog: cfg.driftLog.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => { removeItem('configs', cfg.id); selectRecord('configs', null) }}>
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Standard covariate checklist names (src/model/seedCards.ts standardCovariates, minus the live values). */
const STANDARD_COVARIATE_FACTORS = [
  'Surface wind',
  'Visibility and cloud base',
  'Air temperature and dew point',
  'Pressure QNH/QFE',
  'Illuminance',
  'EM background',
  'Acoustic background',
]

function FactorsTab({ campaign }: { campaign: TeCampaign }) {
  const { addFactor, patchItem, removeItem } = useTeStore.getState()
  const campaigns = useTeStore((s) => s.campaigns)
  const nameSuggestions = [
    ...STANDARD_COVARIATE_FACTORS,
    ...campaigns.filter((c) => c.id !== campaign.id).flatMap((c) => c.factors.map((f) => f.name)),
  ]
  const seedCovariates = () => {
    const existing = new Set(campaign.factors.map((f) => f.name.trim().toLowerCase()))
    for (const name of STANDARD_COVARIATE_FACTORS) {
      if (existing.has(name.toLowerCase())) continue
      const id = addFactor()
      patchItem('factors', id, { name })
    }
  }
  return (
    <div className="inspector-body">
      <SubTitle
        action={
          <>
            <button className="mini" onClick={seedCovariates}>Seed standard covariates</button>
            <button className="mini" onClick={() => addFactor()}>+ factor</button>
          </>
        }
      >
        Factors (classify every variable that can move a result)
      </SubTitle>
      {campaign.factors.map((f) => (
        <div key={f.id} className="run-row">
          <div className="field-row te-table-row">
            <SuggestField label="Name" value={f.name} onChange={(v) => patchItem('factors', f.id, { name: v })} suggestions={nameSuggestions} />
            <SelectField label="Classification" value={f.classification} options={FACTOR_CLASSES.map((v) => ({ v, label: v }))} onChange={(v) => v && patchItem('factors', f.id, { classification: v })} />
            <TextField label="Planned levels" value={f.plannedLevels} onChange={(v) => patchItem('factors', f.id, { plannedLevels: v })} />
            <TextField label="Tolerance and verification" value={f.toleranceAndVerification} onChange={(v) => patchItem('factors', f.id, { toleranceAndVerification: v })} />
            <button className="mini danger" onClick={() => removeItem('factors', f.id)}>×</button>
          </div>
          {f.classification === 'unobserved-nuisance' && (
            <>
              <TextField label="Risk statement" value={f.riskStatement} onChange={(v) => patchItem('factors', f.id, { riskStatement: v })} />
              <p className="muted small">
                An unobserved nuisance factor has three outs: remove it, instrument it, or state
                the risk.
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function SampleSizeHelper() {
  const [p, setP] = useState<number | null>(0.8)
  const [h, setH] = useState<number | null>(0.1)
  const [vf, setVf] = useState<number | null>(0.8)
  const n = p != null && p > 0 && p < 1 && h != null && h > 0 ? sampleSizeProportion(p, h) : null
  const attempts = n != null && vf != null && vf > 0 && vf <= 1 ? attemptInflation(n, vf) : null
  return (
    <div className="subsection">
      <SubTitle>Sample-size helper (one proportion, 95%)</SubTitle>
      <div className="field-row">
        <NumberField label="Expected proportion p" value={p} onChange={setP} step={0.05} />
        <NumberField label="Half-width h" value={h} onChange={setH} step={0.01} />
        <NumberField label="Valid fraction" value={vf} onChange={setVf} step={0.05} />
      </div>
      <p className="muted small">
        {n != null ? `Required valid n: ${n}.` : 'Enter p in (0, 1) and h greater than 0.'}
        {attempts != null ? ` Inflated attempts at that valid fraction: ${attempts}.` : ''}
      </p>
    </div>
  )
}

function MatrixTab({ campaign }: { campaign: TeCampaign }) {
  const { addMatrixCell, patchItem, removeItem, selectRecord } = useTeStore.getState()
  const selected = useTeStore((s) => s.ui.selected.matrix ?? null)
  const cell = campaign.matrix.find((x) => x.id === selected)
  const set = (patch: Partial<TeMatrixCell>) => cell && patchItem('matrix', cell.id, patch)
  const totalRuns = campaign.matrix.reduce((n, x) => n + x.plannedReps, 0)
  return (
    <div className="inspector-body">
      <div className="spec-summary">
        {campaign.matrix.length} cell(s); {totalRuns} planned runs.
      </div>
      <SampleSizeHelper />
      <ChipList
        items={campaign.matrix.map((x) => ({ id: x.id, label: `${short(x.id)}: ${x.method.slice(0, 24) || 'cell'}` }))}
        selectedId={selected}
        onSelect={(id) => selectRecord('matrix', id)}
        onAdd={() => selectRecord('matrix', addMatrixCell())}
        addLabel="+ cell"
      />
      {cell && (
        <div className="run-row">
          <div className="field-row">
            <SelectField label="Question" value={cell.questionId || null} allowEmpty="not set" options={campaign.questions.map((x) => ({ v: x.id, label: `${x.id} ${x.wording.slice(0, 30)}` }))} onChange={(v) => set({ questionId: v ?? '' })} />
            <SelectField label="Hypothesis" value={cell.hypothesisId} allowEmpty="none" options={campaign.hypotheses.map((x) => ({ v: x.id, label: `${x.id} ${x.producesBehavior.slice(0, 30)}` }))} onChange={(v) => set({ hypothesisId: v })} />
          </div>
          <div className="field-row">
            <SelectField label="Configuration" value={cell.configId || null} allowEmpty="not set" options={campaign.configs.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))} onChange={(v) => set({ configId: v ?? '' })} />
            <SelectField label="Threat" value={cell.threatId || null} allowEmpty="not set" options={campaign.threats.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))} onChange={(v) => set({ threatId: v ?? '' })} />
            <SelectField label="Condition" value={cell.conditionId || null} allowEmpty="not set" options={campaign.conditions.map((x) => ({ v: x.id, label: `${x.id} ${x.name}` }))} onChange={(v) => set({ conditionId: v ?? '' })} />
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
          <MultiPicker label="Measures" options={campaign.measures.map((m) => ({ id: m.id, label: `${m.id} ${m.name}` }))} value={cell.measureIds} onChange={(v) => set({ measureIds: v })} />
          <div className="field-row">
            <NumberField label="Planned reps" value={cell.plannedReps} onChange={(v) => set({ plannedReps: v ?? 1 })} />
            <NumberField label="Min valid evidence" value={cell.minValidEvidence} onChange={(v) => set({ minValidEvidence: v ?? 1 })} />
            <NumberField label="Priority" value={cell.priority} onChange={(v) => set({ priority: v ?? 1 })} />
            <NumberField label="Drop order" value={cell.dropOrder} onChange={(v) => set({ dropOrder: v ?? 99 })} />
          </div>
          <SuggestField
            label="Order or block"
            value={cell.orderOrBlock}
            onChange={(v) => set({ orderOrBlock: v })}
            suggestions={['randomized', 'blocked by day', 'fixed order', ...campaign.matrix.map((x) => x.orderOrBlock)]}
          />
          <div className="inspector-actions">
            <button className="mini danger" onClick={() => { removeItem('matrix', cell.id); selectRecord('matrix', null) }}>
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function GateTab({ campaign }: { campaign: TeCampaign }) {
  const { approveDesign } = useTeStore.getState()
  const warnings = designLint(campaign).map((w) => w.text)
  const approved = campaign.designApprovedAt != null
  const qualified = campaign.qualificationPassedAt != null
  return (
    <div className="inspector-body">
      <SubTitle
        action={
          <span className="help-dot" tabIndex={0} data-help={HELP['design-gate']}>
            ?
          </span>
        }
      >
        Design gate
      </SubTitle>
      {approved ? (
        <Pill kind="good" text={`approved ${campaign.designApprovedAt!.slice(0, 10)}`} />
      ) : (
        <Pill kind={warnings.length ? 'warn' : 'neutral'} text={warnings.length ? `${warnings.length} open warning(s)` : 'no open warnings'} />
      )}
      <GateList items={warnings} kind="warn" />
      {!qualified && (
        <p className="muted small">
          Pass the qualification gate on the Campaign phase before design approval.
        </p>
      )}
      <div className="inspector-actions">
        <button
          className="primary"
          disabled={!qualified || approved}
          onClick={approveDesign}
        >
          Approve design
        </button>
      </div>
    </div>
  )
}

export function DesignPanel({ campaign }: { campaign: TeCampaign }) {
  const [tab, setTab] = useState<Tab>('questions')
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
      <Seg value={tab} options={TABS} onChange={setTab} />
      {tab === 'questions' && <QuestionsTab campaign={campaign} />}
      {tab === 'hypotheses' && <HypothesesTab campaign={campaign} />}
      {tab === 'measures' && <MeasuresTab campaign={campaign} />}
      {tab === 'threats' && <ThreatsTab campaign={campaign} />}
      {tab === 'conditions' && <ConditionsTab campaign={campaign} />}
      {tab === 'configs' && <ConfigsTab campaign={campaign} />}
      {tab === 'factors' && <FactorsTab campaign={campaign} />}
      {tab === 'matrix' && <MatrixTab campaign={campaign} />}
      {tab === 'gate' && <GateTab campaign={campaign} />}
    </div>
  )
}

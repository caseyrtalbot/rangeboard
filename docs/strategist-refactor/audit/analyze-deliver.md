# Input audit: AnalyzePanel and DeliverPanel

Scope: every user input in `src/te/ui/AnalyzePanel.tsx` and `src/te/ui/DeliverPanel.tsx`.
Verdicts use the BRIEF section 2 hierarchy. GATE marks a field a validate.ts or store gate requires. No schema field is removed.

| Existing field | Proposed interaction | Data preserved | Trigger/logic | Downstream use |
|---|---|---|---|---|
| **AnalyzePanel, Results tab** | | | | |
| Outcome (`TeHypothesis.outcome`, SelectField, enum) | select (keep); suggest a value derived from the linked measure result label vs the prediction, user confirms | same enum | row renders only for hypotheses linked to the shown measure (existing); suggestion appears when the measure has an estimate | Results display; proposed feed for claim-disposition suggestion in Closeout |
| Outcome note (`TeHypothesis.outcomeNote`, TextField, free) | short-text; show only after an outcome is set | same | conditional on `outcome != null` | Results display |
| **AnalyzePanel, Daily review tab (writes one `TeChange`)** | | | | |
| Next action (exactly one) (`TeChange.nextAction`, SelectField, enum `NextAction`) | select (keep); add a one-line definition per option | same | always in the adaptation form | Changes list; doctrine adaptation record |
| Triggering evidence (`TeChange.trigger`, TextField, free) | entity-pick: a run, measure result, anomaly, or coverage cell; optional short note | stored as text (`RUN-x: note`) | pick list built from campaign records | Changes list display |
| Gap to resolve (`TeChange.gapToResolve`, TextField, free) | select from a derived gap list (`chainHealth` items, empty or thin coverage cells); short-text fallback | text | gap list derives live from validate.ts and calc/matrix | Changes list display |
| Selected change and reason (`TeChange.selectedChangeAndReason`, TextField rows 2, free) | builder: change kind (select, mirrors `NextAction`) + reason (short-text) | text | none | Changes list display |
| Variables changed (`TeChange.variablesChanged`, SuggestField, free) | chips multi-select over `campaign.factors`; free add allowed | joined text | chips exist only when factors exist | Changes list display |
| Variables held (`TeChange.variablesHeld`, SuggestField, free) | chips over `campaign.factors` | joined text | same | Changes list display |
| Comparability effect (`TeChange.comparabilityEffect`, TextField, free) | segmented none / bounded / material / unknown (reuse `DeviationEffect` vocabulary) + note | text | note field appears when segment is not none | Changes list display |
| Approvals (`TeChange.approvals`, PersonField, free) | entity-pick person; keep the existing inherited default from decision-rights row "card change" | text | default via `decisionRightHolder` (existing) | Changes list display |
| Importance (local state, Seg 1-3) | select (keep); ephemeral calculator input | not persisted | none | `adaptivePriority` (calc/priority.ts) score display |
| Uncertainty reduction (local state, Seg 1-3) | select (keep) | not persisted | none | same |
| Likelihood (local state, Seg 1-3) | select (keep) | not persisted | none | same |
| Burden (local state, Seg 1-3) | select (keep) | not persisted | none | same |
| **DeliverPanel, Findings tab (`TeFinding`)** | | | | |
| Finding statement (`statement`, TextField rows 2, free, GATE) | long-text (keep) with a sentence builder start (system + result + condition) and a Use-this-structure example; keep the refuted-claims lint | same | lint fires on `REFUTED_CLAIMS` phrase match (existing) | `findingBlockers` gate; package sections 3, 9, 10; findings CSV; chip label |
| Quantified result (`quantifiedResult`, TextField rows 2, free) | derive from linked `measureIds` via `measureSummary`; editable after | same | auto-fill when measures link and the field is empty (existing `generatedEvidence`) | finding evidence detail; helper insert |
| Quantified-result helper (local `helperMeasureId`, SelectField + insert button) | merge into the field above; remove the separate helper control | ephemeral, none | none | inserts `measureSummary` text |
| Question (`questionId`, SelectField, GATE) | entity-pick (keep); existing chain fill of hypothesis, claim, measures | same | fill when exactly one candidate exists (`pickQuestion`) | gate; CSV; traceability chain; closeout dispositions |
| Claim (`claimId`, SelectField) | entity-pick over registers kind=claim; show statement preview | same | filled by `pickQuestion` when one candidate | package section 13; closeout claim disposition |
| Hypothesis (`hypothesisId`, SelectField) | entity-pick; derived from question | same | `pickQuestion` fill | `comparisonWithPrediction` generation |
| Configuration (`configId`, SelectField, GATE) | entity-pick; derived from supporting runs (existing) | same | fill when linked runs resolve to one config (`pickSupportingRuns`) | gate; `appliesTo` generation |
| Supporting runs (`supportingRunIds`, MultiPicker, GATE with contradicting) | entity-pick multi (keep); sort includable runs first; validity shown in label (existing) | same | non-includable warning renders when linked runs are pending or excluded (existing) | gate; missing-data generation; CSV |
| Contradicting runs (`contradictingRunIds`, MultiPicker) | entity-pick multi (keep) | same | same warning | gate (either list); CSV |
| Threats (`threatIds`, MultiPicker) | derive default from linked runs' cards; confirm chips | same | fill on run link | `appliesTo` / `doesNotApplyTo` generation; package section context |
| Conditions (`conditionIds`, MultiPicker) | derive from linked runs' cards; confirm chips | same | fill on run link | same |
| Measures (`measureIds`, MultiPicker, GATE) | derive from question (existing single-candidate fill); multi-pick otherwise | same | `pickQuestion` fill | gate; every evidence-detail generation path |
| Strength (`strength`, Seg, enum `FindingStrength`) | select (keep); inline definitions; suggest from computed result labels of linked measures | same | suggestion when measures compute | package 9/10 split; CSV |
| Ladder level (`ladderLevel`, Seg, enum `LadderLevel`) | select (keep); inline definition and example per level | same | none | CSV; ladder rule display |
| Threshold comparison (`thresholdComparison`, TextField, free) | derive (existing `generatedEvidence`); generate automatically on link change; editable | same | show only when a linked measure carries a threshold; else auto-write "characterization only" | finding evidence detail |
| Sample and independence (`sampleAndIndependence`, TextField, free) | derive from computations + `experimentalUnit` (existing); editable | same | auto-fill on link change | finding evidence detail |
| Uncertainty (`uncertaintyNote`, TextField, free) | derive from intervals (existing); editable | same | auto-fill when intervals exist | package section 12 |
| Missing and excluded data (`missingAndExcludedData`, TextField, free) | derive from linked run observations (existing); editable | same | auto-fill when runs link | finding evidence detail |
| Confounders and alternatives (`confoundersAndAlternatives`, TextField, free) | short-text; inherit suggestions from `hypothesis.competingExplanations` | same | suggestion when hypothesis linked | finding evidence detail |
| Applies to (`appliesTo`, TextField, free, GATE) | derive from config, threat, condition `permittedGeneralization` (existing); confirm and edit | same | auto-fill on link change | gate; CSV |
| Does not apply to (`doesNotApplyTo`, TextField, free) | derive from `prohibitedGeneralization` (existing); confirm | same | auto-fill on link change | CSV |
| Assumptions (`assumptions`, TextField, free) | chips entity-pick over registers kind=assumption; a free add creates a register entry | joined text | none | finding applicability record |
| Evidence life and staleness (`evidenceLifeAndStaleness`, TextField, free) | valid-until date pick + short condition; default from `decision.latestAcceptedEvidenceDate` | text | default when the decision charter has a date | package section 16 input |
| Decision implication (`decisionImplication`, TextField rows 2, free) | long-text (keep); builder seeded from `decision.actionOnMeet/Miss/Mixed/Inconclusive` keyed by result label | same | seed appears when measures compute | package section 3; CSV |
| Customer effect (`customerEffect`, TextField, free) | short-text; group with decision implication | same | none | finding decision-effect record |
| Recommended action (`recommendedAction`, TextField, free) | short-text; example on demand | same | none | `createActionFromFinding` prefill; package section 15 |
| Comparison with the prediction (`comparisonWithPrediction`, TextField, free) | derive (existing `generatedEvidence`); editable | same | show only when `hypothesisId` is set | finding evidence detail |
| Version (`version`, VersionField, read-only + bump) | derive (keep); bump via `bumpRecordVersion` | same | bump disabled for frozen records (store rule) | record identity; chip header |
| Approvers (`approvers`, PersonField, free) | entity-pick person; keep the inherited default from decision-rights row "findings" | same | default set on add (existing) | releasability record |
| Dissent (`dissent`, TextField, free) | short-text behind a "Record disagreement" action; collapsed when empty | same | conditional; render only when nonempty or invoked | package section 12 |
| **DeliverPanel, Actions tab (`TeAction`)** | | | | |
| Finding (`findingId`, SelectField) | entity-pick (keep); inherited when created from a finding | same | prefilled by `createActionFromFinding` | closure traceability; CSV |
| Decision owner (`decisionOwner`, PersonField, free) | entity-pick person; keep inherited default from decision-rights "customer action" | same | default on add (existing) | CSV; ownership record |
| Execution owner (`executionOwner`, PersonField, free) | entity-pick person | same | none | package section 19; CSV |
| Due date (`dueDate`, DateField) | date pick (keep) | same | none | package section 19; CSV |
| Required work (`requiredWork`, TextField rows 2, free) | short-text; inherit from `finding.recommendedAction` (existing) | same | prefill on create-from-finding | package section 19; CSV |
| Evidence for closure (`evidenceForClosure`, TextField, free) | short-text with an example on demand | same | none | CSV; closure check |
| Risk if late (`riskIfLate`, TextField, free) | short-text; move to an advanced group | same | advanced disclosure | CSV |
| Communication required (`communicationRequired`, TextField, free) | person multi-pick (who to inform) + optional note; advanced group | joined text | advanced disclosure | CSV |
| Status (`status`, Seg, enum `ActionStatus`) | select (keep) | same | none | closeout gate counts open actions; CSV; package section 19 |
| **DeliverPanel, Debriefs tab (`TeDebrief`)** | | | | |
| AAR answers, 9 prompts (`answers[].answer`, TextField rows 2 each, free) | long-text (keep, facilitated AAR); source the prompt list from `seed/questionBanks.ts` `AAR_QUESTIONS`, not the local copy | same | prompts seeded on New AAR (existing) | DebriefPrint |
| Improvement (`improvements[].text`, TextField, free) | short-text (keep) | same | none | DebriefPrint |
| Improvement owner (`improvements[].owner`, PersonField, free) | entity-pick person | same | none | DebriefPrint; `allPeople` pool |
| Improvement due date (`improvements[].dueDate`, DateField) | date pick (keep) | same | none | DebriefPrint |
| Destination (`improvements[].destination`, Seg) | select (keep); plain labels | same | none | DebriefPrint; improvement routing |
| **DeliverPanel, Package tab (`TeEvidencePackage`)** | | | | |
| Sections 1-20 content (`sections[].content`, 20 TextField rows 3, free) | derive per `generatedContent` (keep); generate on open with the `edited` flag protecting manual text; give the 5 manual sections (11, 14, 16, 17, 18) templates; seed section 18 from `DATA_STANDARDS` | same | generation fills only unedited sections (existing) | PackagePrint; delivery |
| Method acceptance (`methodAcceptance`, SuggestField, free) | entity-pick person or org; inherit from `charter.acceptance.methodApprovalAuthority` (suggestions exist) | same | inherit as default, confirm | PackagePrint title block |
| Evidence acceptance (`evidenceAcceptance`, SuggestField, free) | entity-pick; inherit from `charter.evidenceAcceptanceAuthority` | same | inherit as default, confirm | PackagePrint title block |
| Final approving authority and date (`finalAuthorityAndDate`, SuggestField, free) | split control: person pick + date pick; store joined | same string | none | PackagePrint title block |
| **DeliverPanel, Closeout tab** | | | | |
| Question disposition (`TeQuestion.disposition`, SelectField, enum, GATE) | select (keep); suggest from the strengths of findings linked to the question | same | suggestion when linked findings exist | `closeoutBlockers` gate; chip counts |
| Question evidence level (`TeQuestion.evidenceLevel`, SelectField, enum) | select (keep); inline definitions | same | show with disposition | evidence-level record |
| Question disposition note (`TeQuestion.dispositionNote`, TextField, free) | short-text; show only when disposition is partially-answered or not-answered | same | conditional on disposition value | closeout record |
| Claim disposition (`RegisterEntry.disposition`, SelectField, enum `ClaimDisposition`, GATE) | select (keep); suggest from findings that link the claim and from hypothesis outcomes | same | suggestion when linked findings exist | `closeoutBlockers` gate; package section 13 |

## Derivable/inheritable

- Eight finding evidence fields already derive in `generatedEvidence` (DeliverPanel.tsx): quantified result, threshold comparison, sample and independence, uncertainty, missing and excluded data, applies to, does not apply to, comparison with the prediction. Change: run the generation automatically when links change, not behind a button. The empty-field guard already protects manual text.
- All 20 package sections derive in `generatedContent`; 15 have full generators. The `edited` flag already protects manual edits.
- Finding threats and conditions can derive from the linked runs' cards (new derivation, mirrors the existing `configId` fill in `pickSupportingRuns`).
- Approvals and owners inherit from `decisionRightHolder`: change approvals ("card change"), finding approvers ("findings"), action decision owner ("customer action"). All three defaults exist today.
- Package acceptance names inherit from `charter.acceptance.methodApprovalAuthority` and `charter.evidenceAcceptanceAuthority` (SuggestField suggestions exist; promote to defaults).
- Hypothesis outcome, question disposition, and claim disposition can carry derived suggestions from measure labels and finding strengths (new, confirm before write, per BRIEF section 20).
- Gap to resolve can offer the live `chainHealth` and coverage gaps as picks (new).
- Finding version is already derived (`bumpRecordVersion`).

## Selectable (vocab source)

- Next action: `NextAction` enum, `src/te/model/types.ts` (labels in AnalyzePanel `NEXT_ACTIONS`).
- Hypothesis outcome: `HypothesisOutcome` enum, types.ts.
- Finding strength: `FindingStrength`; ladder level: `LadderLevel`; action status: `ActionStatus`; question disposition: `QuestionDisposition`; evidence level: `EvidenceLevel`; claim disposition: `ClaimDisposition`; improvement destination: inline union. All in types.ts.
- Comparability effect vocabulary: reuse `DeviationEffect` (none, bounded, material, unknown), types.ts.
- Variables changed and held: `campaign.factors` names (already SuggestField source; promote to chips).
- Finding assumptions: registers kind=assumption (`RegisterKind`, types.ts).
- People picks: `allPeople` / `rolePeople`, `src/te/ui/help.ts`.
- AAR prompts: `AAR_QUESTIONS`, `src/te/seed/questionBanks.ts` (DeliverPanel holds a duplicate copy; delete the local const).
- Refuted-claims lint: `REFUTED_CLAIMS`, `src/te/seed/constants.ts` (lint, not a pick).
- Package section 18 template: `DATA_STANDARDS`, `src/te/seed/constants.ts`.
- Entity picks: campaign questions, hypotheses, claims, configs, runs, threats, conditions, measures, findings (existing record lists).

## Conditional

- Outcome note: only after an outcome is set.
- Comparability note: only when the effect segment is not "none".
- Threshold comparison: only when a linked measure carries a threshold; otherwise auto-text.
- Comparison with the prediction: only when a hypothesis is linked.
- Dissent: collapsed behind a "Record disagreement" action.
- Risk if late and communication required: advanced disclosure on the action row.
- Question disposition note: only when the disposition is not "answered".
- Non-includable-runs warning: already conditional (keep).
- Package manual-section guidance (`SECTION_GUIDANCE`): show only on the 5 sections without generators.

## Justified free text

- Finding statement: the core expert claim; lint-checked, builder-assisted, but human-owned.
- Decision implication: expert judgment linking evidence to the customer choice.
- Confounders and alternatives: analytic reasoning nothing can generate.
- Recommended action, customer effect, required work, evidence for closure: operational judgment, short.
- Dissent: verbatim disagreement must stay verbatim.
- AAR answers: facilitated team discussion.
- Change reason (builder reason slot) and outcome note: judgment notes.
- The 5 package sections without generators (11, 14, 16, 17, 18), template-assisted.
- Improvement text and question disposition note: short judgment.

## Merge candidates

- Quantified result + helper measure select + insert button: one derived, editable result block from `measureIds`.
- Threshold comparison + sample and independence + uncertainty + missing data + prediction comparison: one auto-generated "Evidence detail" review card; edit opens per-field.
- Applies to + does not apply to: one "Generalization bounds" review derived from permitted and prohibited generalization on linked threats and conditions.
- Variables changed + variables held: one factor grid with a changed/held toggle per factor.
- Decision implication + customer effect + recommended action: one "Decision effect" group; the action seeds follow-up work.
- Final approving authority and date: person pick + date pick writing one stored string.
- Triggering evidence + gap to resolve: one "What happened and what is missing" pick pair fed by the same live gap list.

## Ambiguous labels needing plain-language rewrite

- Ladder level -> "What kind of statement is this?" (what we saw / what we computed / what it means / what to do / what was decided)
- Strength -> "How strong is the evidence?"
- Comparability effect -> "Can results from before and after this change still be compared?"
- Evidence life and staleness -> "How long is this result good for?"
- Sample and independence -> "How many runs count, and are they independent?"
- Confounders and alternatives -> "What else could explain this result?"
- Dissent -> "Did anyone disagree? Record it."
- Triggering evidence -> "What result caused this change?"
- Gap to resolve -> "What evidence is missing?"
- Evidence level -> "How close is this evidence to a real mission?"
- Disposition (question) -> "Is this question answered?"
- Disposition (claim) -> "Did the evidence support this claim?"
- Applies to / Does not apply to -> "Where does this finding hold?" / "Where does it not hold?"
- Communication required -> "Who must be told?"
- Destination (improvement) -> "Where does this improvement go?" (standard work / product backlog)
- Threshold comparison -> "Result vs required value"
- Uncertainty -> "How sure are we?" (interval shown)
- Next action (exactly one) -> "What is the one next move?"

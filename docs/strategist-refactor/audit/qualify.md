# Qualify stage input audit: CampaignPanel.tsx

Scope: every user input in `src/te/ui/CampaignPanel.tsx` (tabs Charter, Decision, People & authority, Registers, Schedule, Gate).
Schema: `src/te/model/types.ts`. Gate rules: `qualificationBlockers` in `src/te/validate.ts`.
Notation in column 1: UI label, schema field, current kit control. "free" means the control accepts arbitrary typed text. "GATE" means `qualificationBlockers` requires it before the qualification gate passes. "+ex" means the proposed control carries an inline example. "+def" means it carries a definition tooltip.

| Existing field | Proposed interaction | Data preserved | Trigger/logic | Downstream use |
|---|---|---|---|---|
| **Charter tab** | | | | |
| Customer's exact request (their own words); `CampaignCharter.exactRequest`; TextField rows=2; free | Long text, keep. +ex (QB-CLAR-10, `seed/questionBanks.ts`, as clarification prompts beside it) | Verbatim string unchanged | Always visible; first field of intake | Anchor for register statements; traceability root |
| Requesting organization; `CampaignCharter.requestingOrganization`; SuggestField; free | Entity picker over an organization register; combobox with add-new | Same string; picker writes the name | Always visible | Defaults `acceptance.relyingOrganization`; feeds `allOrganizations` suggestion pool |
| Sponsor; `CampaignCharter.sponsor`; SuggestField; free | Entity picker (org or person); combobox | Same string | Always visible | `allOrganizations` pool |
| Date received; `CampaignCharter.dateReceived`; DateField | Smart default = today; date picker to change | ISO date | Prefill on campaign create | Record keeping; schedule context |
| Requested decision date; `CampaignCharter.requestedDecisionDate`; DateField | Date picker; single "decision date" decision (see merges) | ISO date | Entered once; `decision.decisionDate` inherits | Drives back-planned schedule and `deliverablesDate` default |
| Engagement type; `CampaignCharter.engagementType`; SelectField | Segmented control behind the plain question "What is the customer asking us to determine?"; maps answer onto the enum. +def | Enum `EngagementType` unchanged | One intake decision also sets tasking (see merges) | Campaign framing; templates and question banks key off it |
| Valkryn tasking; `CampaignCharter.valkrynTasking`; SelectField | Derive from the same intake decision; show as confirmable secondary line. +def | Enum `ValkrynTasking` unchanged | Derived; editable on expand | Campaign framing |
| Customer decision owner; `CampaignCharter.customerDecisionOwner`; PersonField; free | Person entity picker; one entry point shared with the roles row | Same string; roles sync stays | Entered once (see merges) | Syncs roles row; defaults `decision.authorizedDecisionOwner`; DeliverPanel acceptance suggestions; `allPeople` |
| Evidence acceptance authority; `CampaignCharter.evidenceAcceptanceAuthority`; PersonField; free | Person entity picker. +def | Same string | Entered once | Syncs roles row; defaults `TeQuestion.evidenceAuthority` (DesignPanel); DeliverPanel package section 7 suggestions; `allPeople` |
| Deployment strategist; `CampaignCharter.deploymentStrategist`; PersonField; free | Person entity picker; default = current user profile when one exists | Same string | Entered once | Syncs roles row; `allPeople` |
| Mission and protected outcome; `CampaignCharter.missionAndProtectedOutcome`; TextField rows=2; free | Sentence builder: Protect [asset] so that [mission effect] continues. Editable result. +ex | Builder renders into the same string | Always visible | DeliverPanel package section 4 (system and mission context) |
| Included scope; `CampaignCharter.includedScope`; TextField rows=2; free | Structured chips: mission functions, evidence levels (`EvidenceLevel`), condition classes; plus optional note line | Chips render as lines into the same string | Chips filtered by intake decision | Charter print; scope reasoning |
| Excluded scope and its effect on conclusions; `CampaignCharter.excludedScope`; TextField rows=2; free | Structured rows: [exclusion] + [what results then cannot say]; add-row pattern. +ex | Rows render as lines into the same string | Always visible | Charter print; generalization limits |
| Major assumptions (one per line); `CampaignCharter.majorAssumptions`; TextField rows=2; free | Register-first: "+ Add assumption" writes `RegisterEntry` kind=assumption; charter string derives from the register | Register rows carry the data; string derived, kept in schema | Replaces the one-way "Create register assumptions" button | Seeds registers today; registers feed closeout |
| Major risks; `CampaignCharter.majorRisks`; TextField rows=2; free | Structured risk rows (statement, owner, criticality), same add-row pattern | Rows render as lines into the same string | Always visible | Charter print; feasibility context |
| Minimum viable campaign; `CampaignCharter.minimumViableCampaign`; TextField rows=2; free | Short text, keep. +ex +def (rewrite below) | Same string | Always visible | Drop-order reasoning in Design |
| Success criteria; `CampaignCharter.successCriteria`; TextField rows=2; free | Evidence builder shared with acceptance conditions and evidence standard (see merges). +ex | Builder renders into the same string | One "sufficient evidence" decision | Charter print; measure threshold context |
| Planned sites and dates; `CampaignCharter.plannedSitesAndDates`; TextField; free | Site entity pick + date range picker; renders to string | Same string | Always visible | Schedule context; authority lead-time planning |
| Deliverables date; `CampaignCharter.deliverablesDate`; DateField | Derive default from decision date minus review lead (`SCHEDULE_MILESTONES`); confirmable | ISO date | Derived on decision-date entry | Schedule back-planning |
| Data security release class; `CampaignCharter.dataSecurityReleaseClass`; SelectField (local `SECURITY_CLASSES`) | Select, keep; default CUI per `DATA_STANDARDS` classification floor; move vocab to `seed/constants.ts`. +def (HELP security-class exists) | Same string; custom legacy values stay listed | Smart default on create | Data handling; export marking |
| Contract and funding owner; `CampaignCharter.contractAndFundingOwner`; SuggestField; free | Entity picker (person or org) | Same string | Always visible | `allPeople` pool |
| Known limits (contract, budget, security, data, range, schedule); `CampaignCharter.knownLimits`; TextField rows=2; free | Category chips (contract, budget, security, data, range, schedule) each opening one short line; chips seed feasibility items | Lines render into the same string | Category chip reveals its line | Feasibility screen seeding; charter print |
| Source documents and prior evidence; `CampaignCharter.sourceDocumentsAndPriorEvidence`; TextField rows=2; free | Structured list rows: title + date; add-row | Rows render as lines into the same string | Always visible | Suggestion pool for register `sourceAndDate` (this panel and DesignPanel:751) |
| Commitment; `CustomerCommitment.item`; TextField; free | Short text, keep. +ex | Same string | Row appears via "+ commitment" | Charter print; schedule risk |
| Commitment owner; `CustomerCommitment.owner`; PersonField; free | Person entity picker | Same string | Per commitment row | `allPeople` |
| Commitment due date; `CustomerCommitment.dueDate`; DateField | Date picker, keep | ISO date | Per commitment row | Schedule risk |
| Consequence of failure; `CustomerCommitment.consequenceOfFailure`; TextField; free | Short text, keep. +ex | Same string | Per commitment row | Schedule risk reasoning |
| Relying organization; `acceptance.relyingOrganization`; SuggestField; free; GATE | Inherit from requesting organization with visible provenance; confirm or override (onBlur default exists today) | Same string | Auto-fill when empty; user confirms | GATE blocker; DeliverPanel package section 7 |
| Method approval authority; `acceptance.methodApprovalAuthority`; PersonField; free | Person entity picker. +def | Same string | Always visible | Package section 7; DeliverPanel acceptance suggestions; `allPeople` |
| Required witnesses and reviewers; `acceptance.requiredWitnesses`; PersonField; free | Multi-select person chips; renders to one string | Same string (joined) | Always visible | Package section 7 |
| Evidence standard (measures, repetitions, confidence, fidelity); `acceptance.evidenceStandard`; TextField rows=2; free | Structured builder: [n] valid repetitions of [measure] at [interval method] confidence in [fidelity] (see merges). +ex +def | Builder renders into the same string | One "sufficient evidence" decision | Package section 7; Design gate context |
| Rejection conditions; `acceptance.rejectionConditions`; TextField rows=2; free | Short text list, keep. +ex | Same string | Always visible | Package section 7 |
| **Decision tab** | | | | |
| Decision statement preview (derived, read-only) | Keep; it is the model for every proposed builder | n/a | Recomputed from decision fields | Review layer |
| Decision date; `DecisionCharter.decisionDate`; DateField; GATE | Inherit from `requestedDecisionDate` with provenance; confirm | ISO date | Auto-fill when empty | GATE blocker; PackagePrint; package section 1 |
| Authorized decision owner; `DecisionCharter.authorizedDecisionOwner`; SuggestField; free; GATE | Inherit from `customerDecisionOwner` (onBlur default exists); person picker to override | Same string | Auto-fill when empty | GATE blocker; PackagePrint; package section 1 |
| Bounded choice; `DecisionCharter.boundedChoice`; TextField rows=2; free; GATE | Sentence builder: choose between [option A] and [option B] for [purpose]; editable result. +ex | Builder renders into the same string | Options list shared with Alternatives | GATE blocker; package section 1; DeliverPanel |
| Alternatives (include delay and no action); `DecisionCharter.alternatives`; TextField rows=2; free | Structured option rows; "delay" and "no action" pre-seeded as removable rows | Rows render into the same string | Prefilled rows on first open | Package section 1; action-map option source |
| Blocking uncertainty; `DecisionCharter.blockingUncertainty`; TextField rows=2; free; GATE | Entity pick from registers kind=unknown (top rank first); free override allowed. +ex | Same string; pick copies the statement | Register unknowns exist -> offer picker | GATE blocker; package section 2 verbatim |
| Acceptance conditions; `DecisionCharter.acceptanceConditions`; TextField rows=2; free; GATE | Shared "sufficient evidence" builder (see merges). +ex | Builder renders into the same string | One decision writes this and the evidence standard | GATE blocker |
| Post-test action; `DecisionCharter.postTestAction`; TextField; free | Short text, keep | Same string | Always visible | Decision narrative |
| Action authority; `DecisionCharter.actionAuthority`; PersonField; free | Person entity picker | Same string | Always visible | `allPeople` |
| Consequence of no action; `DecisionCharter.consequenceOfNoAction`; TextField; free | Short text, keep. +ex | Same string | Always visible | Decision narrative |
| Result that changes the choice; `DecisionCharter.resultThatChangesChoice`; TextField; free | Builder: [measure] [comparator] [value+unit]; measure list from campaign measures or `MEASURE_DICTIONARY`. +ex | Builder renders into the same string | Measures exist -> picker; else text | Mirrors hypothesis supporting/refuting results |
| Result that does not; `DecisionCharter.resultThatDoesNot`; TextField; free | Same builder | Builder renders into the same string | Same | Same |
| Latest accepted-evidence date; `DecisionCharter.latestAcceptedEvidenceDate`; DateField | Derive: decision date minus review lead (`SCHEDULE_MILESTONES`); confirmable. +def | ISO date | Derived on decision-date entry | Schedule builds backward from it (ScheduleTab note) |
| Customer can accept unfavorable evidence; `DecisionCharter.canAcceptUnfavorableEvidence`; CheckField | Checkbox, keep. +def ("why this matters") | Boolean | Always visible | Campaign honesty check |
| Minimum meaningful difference; `DecisionCharter.minimumMeaningfulDifference`; TextField; free | Numeric with units, linked to one measure; unit list from `MEASURE_DICTIONARY`. +ex (placeholder "25 s warning time" exists) | Value+unit render into the same string | Show for comparison engagements first | Threshold reasoning; pairs with `TeMeasure.threshold` |
| Acceptable threshold; `DecisionCharter.acceptableThreshold`; TextField; free | Numeric with units + threshold-source select (`ThresholdSource`); same measure link | Value+unit render into the same string | Show for verification engagements first | Pairs with `TeMeasure.threshold` and `thresholdSource` |
| Required evidence strength; `DecisionCharter.requiredEvidenceStrength`; TextField; free | Structured: repetitions count + interval method (`IntervalMethod`); part of the shared evidence builder | Renders into the same string | One "sufficient evidence" decision | Design repetition planning |
| On meet; `DecisionCharter.actionOnMeet`; TextField; free | One 2x2 action map; each cell selects from the alternatives list plus common actions; free override | Same four strings | Cells drawn from Alternatives rows | Decision action map narrative |
| On miss; `DecisionCharter.actionOnMiss`; TextField; free | Same map | Same string | Same | Same |
| On mixed; `DecisionCharter.actionOnMixed`; TextField; free | Same map | Same string | Same | Same |
| On inconclusive; `DecisionCharter.actionOnInconclusive`; TextField; free | Same map | Same string | Same | Same |
| **People & authority tab** | | | | |
| Role; `RoleAssignment.role`; SelectField (`CAMPAIGN_ROLES`) | Select, keep; hide roles already assigned | Enum string | Per role row | Role table is the person pool root (`rolePeople`) |
| Primary; `RoleAssignment.primary`; PersonField; free | Person entity picker; charter people keep syncing in one way | Same string | Charter fills matching row | `allPeople`; run role suggestions |
| Backup; `RoleAssignment.backup`; PersonField; free | Person entity picker | Same string | Per role row | `allPeople` |
| Authority; `AuthorityApproval.authorityType`; SelectField (`AUTHORITY_LEAD_TIMES`, `seed/constants.ts`) | Select, keep; pick auto-fills lead time (exists). +def (HELP authority-lead-time exists) | String; custom values stay listed | Pick fills `leadTimeNote` when empty | Card preconditions default and authority lines (CardsPanel:187,217); readiness checklist "Required authorities active" |
| Authority owner; `AuthorityApproval.owner`; PersonField; free | Person entity picker | Same string | Per authority row | `allPeople` |
| Authority due; `AuthorityApproval.dueDate`; DateField | Derive default: first-live-run date minus parsed lead time; confirmable | ISO date | Derived from schedule + lead time | Schedule critical path |
| Authority status; `AuthorityApproval.status`; SelectField (`AuthorityStatus`) | Segmented control (4 states) | Enum | Per authority row | Readiness gate; card preconditions text |
| Operating limits; `AuthorityApproval.operatingLimits`; TextField; free | Short text, keep (verbatim from the approval document). +ex | Same string | Per authority row | `linkedRecordFill` -> `TeCard.operatingLimits` |
| Lead time note (from the authority pick); `AuthorityApproval.leadTimeNote`; TextField, disabled until "edit"; free after unlock | Derived read-only with provenance; explicit edit unlock (exists), keep | Same string | Filled from `AUTHORITY_LEAD_TIMES` on pick | Schedule planning |
| Decision; `DecisionRightRow.decisionType`; SelectField (`DECISION_TYPES`, types.ts) | Select, keep; "seed 22" bulk action stays | String; custom values stay listed | Seed button creates missing rows | Execution decision routing |
| Accountable; `DecisionRightRow.accountableAuthority`; PersonField; free | Person entity picker; default from matching campaign role where obvious | Same string | Per row | `allPeople`; exactly-one-accountable doctrine |
| Performer; `DecisionRightRow.performer`; PersonField; free | Person entity picker | Same string | Per row | `allPeople` |
| Escalation; `DecisionRightRow.escalationPath`; PersonField; free | Person entity picker | Same string | Per row | `allPeople` |
| **Registers tab** | | | | |
| Register kind; local state via Seg (`RegisterKind`) | Segmented control, keep (view filter; also sets the kind of a new entry) | n/a (UI state) | Filters list; add uses current kind | New `RegisterEntry.kind` |
| Statement (exact wording); `RegisterEntry.statement`; TextField rows=2; free | Short text, keep (doctrine: exact wording). +def | Verbatim string | Per selected entry | Claims -> closeout blockers; package section 13; card `claimIds` |
| Source and date; `RegisterEntry.sourceAndDate`; SuggestField; free | Combobox over the source-document list (from charter rows); free override | Same string | Suggestions from `sourceDocumentsAndPriorEvidence` (exists) | Traceability of statements |
| Decision relevance; `RegisterEntry.relevance`; TextField; free | Short select: link to the blocking uncertainty or a question; optional note | Same string | Per selected entry | Prioritization of unknowns |
| Rank (lower resolves first); `RegisterEntry.rank`; raw number input | Drag-reorder of the unknown list; rank derived from order. +def (rewrite below) | Number | Only when kind=unknown (exists) | Blocking-uncertainty pick order |
| Disposition (required at closeout); `RegisterEntry.disposition`; SelectField (`ClaimDisposition`) | Select, keep | Enum or null | Only when kind=claim (exists) | `closeoutBlockers`; `chainHealth.claimsUndisposed`; package section 13 |
| Notes; `RegisterEntry.notes`; TextField rows=2; free | Long text, keep | Same string | Per selected entry | Analyst context |
| **Schedule tab** | | | | |
| T-minus days; `ScheduleItem.tMinusDays`; raw number input | Numeric with unit label "working days"; keep. +def (help text exists) | Number | Per row; negative allowed | Sort order; countdown planning |
| Milestone; `ScheduleItem.name`; SuggestField (`SCHEDULE_MILESTONES`); free | Combobox over milestone vocabulary; free override; "Seed standard track" stays the default path | Same string | Seed action fills the standard track | Countdown planning |
| Schedule owner; `ScheduleItem.owner`; PersonField; free | Person entity picker | Same string | Per row | `allPeople` |
| Done; `ScheduleItem.done`; CheckField | Checkbox, keep | Boolean | Per row | Progress display |
| **Gate tab** | | | | |
| Pass qualification gate; button | Keep; add the brief section 16 review summary above it | n/a | Disabled while blockers exist (exists) | `passQualificationGate` -> phase `qualified` |
| Feasibility item; `FeasibilityItem.item`; TextField; free | Short text with suggestion chips seeded from known-limits categories | Same string | Rows seeded from knownLimits chips | GATE: an `infeasible` item blocks the gate |
| Score; `FeasibilityItem.score`; SelectField (4 values) | Segmented control | Enum | Per row | GATE blocker on `infeasible` |
| Feasibility owner; `FeasibilityItem.owner`; PersonField; free | Person entity picker | Same string | Only when score is not `feasible` (exists) | `allPeople` |
| Fallback; `FeasibilityItem.fallback`; TextField; free | Short text, keep | Same string | Only when score is not `feasible` (exists) | Mitigation record |
| Effect on conclusions; `FeasibilityItem.effectOnConclusions`; TextField; free | Short text, keep. +ex | Same string | Only when score is not `feasible` (exists) | Generalization limits |

Schema fields with no input in this panel (record only, no change proposed): `AuthorityApproval.evidence`, `DecisionRightRow.requiredReviewers`, `DecisionRightRow.responseTimeLimit`, `RegisterEntry.dispositionNote`, `ScheduleItem.notes`.

## Derivable/inheritable

- `dateReceived`: default today on campaign create.
- `decision.decisionDate` <- `charter.requestedDecisionDate` (make the existing pattern explicit with provenance).
- `decision.authorizedDecisionOwner` <- `charter.customerDecisionOwner` (onBlur default exists; show provenance).
- `acceptance.relyingOrganization` <- `charter.requestingOrganization` (onBlur default exists; GATE field, so confirm visibly).
- `charter.deliverablesDate` and `decision.latestAcceptedEvidenceDate`: derive from decision date minus `SCHEDULE_MILESTONES` leads; confirmable.
- `AuthorityApproval.leadTimeNote`: derived from `AUTHORITY_LEAD_TIMES` on pick (exists); `dueDate` can derive from the first-live-run date minus that lead.
- `charter.valkrynTasking`: derive from the single intake decision that also sets `engagementType`.
- `charter.majorAssumptions` text: derive from assumption register rows (invert the current one-way seed button).
- Decision statement preview: already derived; extend the pattern to the proposed builders.
- Schedule: "Seed standard track" is the default path; keep.

## Selectable (vocab source)

- `engagementType`: `EngagementType` (types.ts).
- `valkrynTasking`: `ValkrynTasking` (types.ts).
- `dataSecurityReleaseClass`: `SECURITY_CLASSES` (local const today; move next to `DATA_STANDARDS` in `seed/constants.ts`; floor is CUI).
- `RoleAssignment.role`: `CAMPAIGN_ROLES` (types.ts).
- `AuthorityApproval.authorityType`: `AUTHORITY_LEAD_TIMES` (`seed/constants.ts`).
- `AuthorityApproval.status`: `AuthorityStatus` (types.ts).
- `DecisionRightRow.decisionType`: `DECISION_TYPES` (types.ts).
- `RegisterEntry.kind`: `RegisterKind`; `disposition`: `ClaimDisposition` (types.ts).
- `ScheduleItem.name`: `SCHEDULE_MILESTONES` (`seed/constants.ts`).
- `FeasibilityItem.score`: inline union (types.ts).
- Threshold and difference builders: measure names and units from `MEASURE_DICTIONARY` (`seed/measureDictionary.ts`); source basis from `ThresholdSource`; strength from `IntervalMethod` plus a repetitions count.
- People and organizations everywhere: `allPeople` / `allOrganizations` pools, upgraded from datalist to entity pickers.
- Intake examples: `QB-CLAR-10` and `QB-DISC-13` (`seed/questionBanks.ts`) as show-example content, not as controls.

## Conditional

Existing conditions to keep: register rank only for unknowns; disposition only for claims; feasibility owner/fallback/effect only when score is not `feasible`; lead-time note locked until explicit edit.

Proposed additions:
- `minimumMeaningfulDifference` surfaces first when the intake decision is comparison; `acceptableThreshold` plus `ThresholdSource` when it is evaluation or verification-shaped. Both stay reachable under an advanced disclosure for other types.
- Known-limits category chips reveal one line each; a filled chip offers "add as feasibility item".
- Blocking-uncertainty picker appears only when unknown register entries exist; otherwise plain text with an example.
- Result builders appear as builders only when measures or the dictionary provide options; otherwise plain text.
- The action map draws its cell options from the Alternatives rows; with no alternatives it degrades to text.

## Justified free text

Fields that stay typed text, with the reason:
- `exactRequest`: verbatim customer words; paraphrase would destroy the record.
- `RegisterEntry.statement`: doctrine requires exact wording.
- `RegisterEntry.notes`: analyst judgment.
- `minimumViableCampaign`: expert scoping judgment; example provided.
- `CustomerCommitment.item` and `consequenceOfFailure`: campaign-unique facts.
- `AuthorityApproval.operatingLimits`: verbatim from the approval document; flows into cards unedited.
- `FeasibilityItem.fallback` and `effectOnConclusions`: expert judgment.
- `acceptance.rejectionConditions`: customer-specific conditions.
- `postTestAction` and `consequenceOfNoAction`: campaign-unique narrative.

Everything else moves to derive, inherit, default, select, chips, entity pick, numeric-units, or a builder whose editable output writes the existing string field.

## Merge candidates

1. Engagement type + Valkryn tasking: one intake decision, "What is the customer asking us to determine?"; the answer writes both enums.
2. Requested decision date + decision date (+ derived deliverables date and latest accepted-evidence date): one date decision with derived children.
3. Customer decision owner + authorized decision owner + the customer-decision-owner roles row: one person decision with the existing sync.
4. Success criteria + acceptance conditions + evidence standard + required evidence strength: one "What is sufficient evidence?" builder that writes all four strings.
5. Minimum meaningful difference + acceptable threshold: one measure-linked threshold row (value, unit, source basis) that also offers to fill `TeMeasure.threshold` / `thresholdSource` in Design.
6. The four action-map fields: one 2x2 map presented as a single decision group.
7. Major assumptions text + assumption register: registers become the entry point; the charter string derives.
8. Known limits + feasibility screen: limits chips seed feasibility items so the same fact is not typed twice.
9. Result that changes the choice / does not + hypothesis supporting/refuting results (Design): same builder; Design offers to reuse the qualify answers.

## Ambiguous labels needing plain-language rewrite

| Current label | Rewrite |
|---|---|
| Customer's exact request (their own words) | What did the customer ask for? Paste their exact words. |
| Engagement type | What is the customer asking us to determine? |
| Valkryn tasking | What is our task in this campaign? |
| Mission and protected outcome | What are we protecting, and what must keep working? |
| Excluded scope and its effect on conclusions | What is out of scope? What can the results then not say? |
| Minimum viable campaign | What is the smallest test that still supports the decision? |
| Success criteria | What result lets the campaign end with a usable answer? |
| Bounded choice | What exact choice must the decision owner make? |
| Alternatives (include delay and no action) | What are the options? Keep delay and no action on the list. |
| Blocking uncertainty | What unknown blocks that choice today? |
| Acceptance conditions | What must be true before the customer trusts the evidence? |
| Consequence of no action | What happens if the customer does nothing? |
| Result that changes the choice | What result would change the pick? |
| Result that does not | What result would leave the pick unchanged? |
| Minimum meaningful difference | How big a change matters? Give a value and unit. |
| Acceptable threshold | What value counts as good enough? Give a value, unit, and source. |
| Required evidence strength | How many valid repetitions, and at what confidence? |
| Evidence standard (measures, repetitions, confidence, fidelity) | What evidence will the relying organization accept? |
| Rejection conditions | What would make them reject the evidence? |
| Decision relevance | Why does this statement matter to the decision? |
| Rank (lower resolves first) | Resolve order. 1 goes first. |
| Lead time note (from the authority pick) | Typical approval lead time. |
| T-minus days | Working days before the first live run. |
| Feasibility screen | Can we actually run this? Score each hard limit. |
| Effect on conclusions | If this stays unresolved, what can the results not say? |

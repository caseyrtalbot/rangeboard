# MASTER DATA MODEL — RangeBoard T&E Operations module

Synthesized from extraction files 01-13 in this directory. This document is the direct source for TypeScript types. Field lists are merged supersets across all source files; per-field source tags use `[NN§x.y]` = extraction file NN, section x.y. True conflicts are flagged `[CONFLICT: ...]`.

Type notation used below: `text`, `longtext`, `bool`, `number(<unit>)`, `int`, `date`, `datetime`, `duration(s)`, `person`, `enum(...)`, `link(TYPE)`, `link[](TYPE)`, `struct`, `struct[]`. `R` = required at the record's owning gate, `O` = optional/as-applicable. Rule from [07]: on a completed record no field is blank — every unused field is marked "not applicable" with a reason string, so every optional field carries an `naReason?: string` companion.

---

## 0. Base record: ControlledRecordHeader

Every controlled record type below embeds this header. Source: [01§1.3], [07 passim].

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| id | text (identifier per §2 grammar) | R | immutable once assigned |
| title | text | R | |
| version | `v<major>.<minor>` | R | RUN records carry no version [01§4.2] |
| status | enum(draft, in-review, approved, issued, superseded, withdrawn, closed) | R | definitions in §4.1 |
| owner | person | R | |
| approver | person | R | at approval |
| effectiveAt | datetime | R | at issue |
| supersededVersion | version ref | O | link to prior version |
| changeSummary | text | R on any reissue | |
| relatedIds | link[](CAMP, CFG, TC, RUN, FIND, ...) | R | typed cross-links [01§1.3] |

Lifecycle (all controlled records): `draft → in-review → approved → issued → (superseded | withdrawn)`, with `closed` reachable when all required actions are complete [01§1.3, 01§6.3].

---

## 1. RECORD CATALOG

### 1.1 Campaign (CAMP)

Purpose: the top-level engagement container; one customer decision effort from request intake to closeout. Sources: [07§4.1 campaign charter, 29 fields], [01§1.7 request registration], [12§1.1 seed], [13§1.2 persistent registers].

Fields (superset — 07's charter is the backbone; 01 intake fields and 12 seed fields merged in):

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| campaignId + title | id + text | R | 07§4.1 |
| version + status | header | R | 07§4.1 |
| sponsor | text/person | R | 07§4.1 |
| requestingOrganization | text | R | 01§1.7 |
| exactRequest | longtext (customer's own words) | R | 01§1.7, 12§1.2 |
| dateReceived | date | R | 01§1.7 |
| requestedDecisionDate | date | R | 01§1.7 |
| customerDecisionOwner | person | R | 07§4.1 |
| evidenceAcceptanceAuthority | person | R | 07§4.1 |
| deploymentStrategist | person | R | 07§4.1 |
| decisionAndDeadline | link(DEC) + date | R | 07§4.1 |
| alternatives | longtext (incl. delay / no action) | R | 07§4.1 |
| decisionCriticalUncertainty | longtext | R | 07§4.1 |
| engagementType | enum(demonstration, experiment, characterization, comparison, evaluation) | R | 01§1.9, 07§4.1 |
| valkrynTasking | enum(recommend, characterize, validate, compare, support-an-authority) | R | 01§1.9 — never "certify"/"authorize" without that authority |
| missionAndProtectedOutcome | longtext | R | 07§4.1 |
| evaluatedSystemBoundary | link(SystemBoundary) | R | 07§4.1 |
| includedSystemsAndConfigurations | `link[](CFG)` | R | 07§4.1 |
| includedThreatsAndConditions | link[](THR, COND) | R | 07§4.1 |
| primaryQuestions | `link[](Q)` | R | 07§4.1 |
| primaryMeasuresAndThresholds | `link[](M)` | R | 07§4.1 |
| requiredEvidenceStrength | text | R | 07§4.1 |
| plannedSitesAndDates | text + date range | R | 07§4.1 |
| contractAndFundingOwner | text | R | 07§4.1 |
| dataSecurityReleaseClass | text | R | 07§4.1 |
| deliverablesAndAcceptedEvidenceDate | text + date | R | 07§4.1 — schedule is built backward from this date [03§6.4] |
| includedScope | longtext | R | 07§4.1 |
| excludedScopeAndEffectOnConclusions | longtext | R | 07§4.1 — every exclusion states its conclusion effect [13§3.9] |
| majorAssumptions | longtext | R | 07§4.1 |
| majorRisks | longtext | R | 07§4.1 |
| minimumViableCampaign | longtext | R | 07§4.1 — must still answer a real decision question [03§6.5] |
| successCriteria | longtext | R | 07§4.1 |
| requiredApprovals | text | R | 07§4.1 |
| approversAndDates | struct[] {person, date} | R | 07§4.1 |
| proposedSystemsSitesEventsDeliverables | longtext | R | 01§1.7 intake |
| knownLimits (contract, budget, security, data, range, schedule) | longtext | R | 01§1.7 |
| sourceDocumentsAndPriorEvidence | longtext | R | 01§1.7 |
| immediateCommitmentActions | longtext | O | 01§1.7 |
| primaryTestObject / secondaryTestObjects | link(TestObject) / link[] | O | 12§1.1 |
| customerCommitments | struct[] {item, owner, dueDate, consequenceOfFailure} | R | 01§1.11 — 9 fixed commitment items |
| acceptancePath | struct (see below) | R | 01§1.10 |

acceptancePath struct [01§1.10]: relyingOrganization, methodApprovalAuthority, requiredWitnessesAndReviewers, requiredMeasuresAndThresholds, requiredRepetitionsConfidenceIndependence, requiredRangeOrThreatFidelity, requiredDataFormatClassificationDelivery, reviewPeriodsAndCorrectionCycles, rejectionConditions, methodAcceptanceRecorder (person), finalEvidenceAcceptanceRecorder (person). Gate: design must not complete before the relying organization accepts the evidence standard.

Relationships: owns all other records; holds RoleAssignments, AuthorityMatrix, registers, decision log (campaign lead) and time-ordered run log (test conductor) [01§5].

Lifecycle: campaign phase machine in §4.2 (not the 7-state header machine). Terminal state `closed` only via the closeout gate [06§3].

### 1.2 RoleAssignment

Purpose: names a primary and backup person for each fixed campaign role, and per-run execution roles. Sources: [01§1.1], [04§1.6].

Campaign roles (fixed 12-value enum) [01§1.1]: customer-decision-owner, evidence-acceptance-authority, campaign-lead/deployment-strategist, test-conductor, range-safety-authority, range-airspace-spectrum-authorities, system-owner-vendor-lead, red-threat-lead, data-lead, analysis-lead, security-data-custodian, logistics-site-lead.

Per-run roles (11-value enum) [04§1.6]: test-conductor, safety-authority, range-control-contact, system-operator, system-technical-lead, red-threat-lead, data-monitor, ground-truth-operator, run-logger, deployment-strategist, customer/evidence-authority-witness.

| Field | Type | Req |
| --- | --- | --- |
| role | enum (above) | R |
| scope | enum(campaign, run) + link(RUN) when run | R |
| primary | person | R |
| backup | person | R (campaign scope) |

Authority rules to enforce in UI [04§1.6]: only the test conductor controls the run sequence; any authorized person may call the safety stop; the data monitor may call a data hold/stop under the card; the deployment strategist controls evidence release and the next-run decision. Deployment strategist owns/may/may-not lists in [01§1.1] render as a role card.

### 1.3 AuthorityMatrixEntry (decision rights)

Purpose: one row per decision type stating who is accountable, who performs, who reviews. Sources: [01§1.2 — 9 fields, 17 decision types], [07§4.2 — 12 fields, 22 decision types], [13§1.12 QtM 05].

[CONFLICT: 01§1.2 enumerates 17 decision types; 07§4.2 enumerates 22 (finer-grained: splits "run initiation, pause, abort, and restart" into run start / pause / stop / restart, splits range/airspace/spectrum/safety/security, adds degraded operation). Use 07's 22 as the seed superset: scope, method, thresholds, configuration, safety, range, airspace, spectrum, security, daily go/no-go, run start, pause, stop, restart, degraded operation, run validity, card change, run-list change, evidence sufficiency, findings, acceptance, customer action.]

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| decisionType | enum (22 values above) + custom | R | 07§4.2 |
| trigger | text | R | 07§4.2 (01 combines trigger+responseTime) |
| accountableAuthority | person/role | R — exactly one per decision (hard validation) | 01§1.2 |
| performer | person/role | R | both |
| requiredReviewers | person[] | R | both |
| requiredNotifications | person[] | R | both |
| evidenceNeeded | text | R | both |
| responseTimeLimit | duration | R | both |
| primaryPerson / backupPerson | person / person | R | 07§4.2 (01: "backup authority") |
| escalationPath | text/role chain | R | both |
| expirationOrReviewDate | date | O | 07§4.2 only |

Constraint: no decision may have two accountable authorities; resolve overlap before execution [01§1.2]. Phase-00 gate blocks while any decision type is unassigned.

### 1.4 AuthorityApproval (external authority tracker)

Purpose: tracks each external approval/authorization (range, airspace, spectrum, safety...) to active status. Sources: [03§1.9], [13§1.23 lead times].

| Field | Type | Req |
| --- | --- | --- |
| authorityType | enum(range-access, airspace-notam, spectrum-assignment, flight-system-release, safety-approval-residual-risk, security-classification, cybersecurity-network, weapons-effectors-hazmat-transport, environmental-local-permits, photography-recording, foreign-national-export, data-collection-storage-transfer-release) | R |
| owner | person | R |
| dueDate | date | R |
| operatingLimits | longtext | R |
| evidence | text (evidence of approval) | R |
| stopAuthority | person/role | R |
| restartAuthority | person/role | R |
| status | enum(pending, active, expired, denied) | R [status field named in 03§1.9; value set inferred — source gives mechanism only] |
| leadTimeSeed | duration | O — seed constants in [13§1.23] (e.g., Part 107 waiver 1-3 months, spectrum STA 2-8 weeks, GPS-interference ≥60-90 days) |

Rule: expired or missing mandatory authorities block the readiness gate [03§8.7].

### 1.5 ChecklistInstance

Purpose: a runnable copy of a named checklist, with per-item completion state, tied to the gate it controls. Sources: [07§3 — six checklists], [04§3 — execution procedures], [13§3.1 — four Field Guide gates], [03§3.4 TRR evidence].

| Field | Type | Req |
| --- | --- | --- |
| checklistType | enum(test-readiness-review(24), day-start(22), pre-run-release(17..19), daily-evidence-review(14), decision-evidence-package(18), closeout-regression(18), pre-campaign-gate(14), post-run-gate(10), daily-closeout-gate(9), run-initiation(10), run-completion(9), data-validation(11), end-of-day(13), anomaly-response(9), safety-stop(6), data-equipment-stop(7), custom) | R |
| gate | link to the gate/phase it blocks | R |
| items | struct[] {itemText (verbatim from source), state: enum(unchecked, checked, na), completer: person, completedAt: datetime, result: text, naReason?: text} | R |
| outcome | enum(go, conditional-go, hold, no-go) where the checklist ends in a decision | O |
| conditionalLimits | longtext — written limits carried into cards and conclusion plan on conditional-go [03§6.3] | O |
| runner | person/role | R |
| startedAt / completedAt | datetime | R |

Conditional logic hooks: pre-run "if any answer is unknown, hold the run" [04§3.2]; item counts differ between [04§3.2] (19 items) and [07§3.3] (17 items) — same checklist, merged item superset; TRR/day-start likewise merged from [04§3.1] and [07§3.1-3.2]. Item text lives verbatim in the extraction files; keep both variants keyed by source.

### 1.6 ReadinessReview

Purpose: one record per gated readiness event with objective evidence and a go/no-go outcome. Sources: [03§6.2, §3.4, §3.5], [13§3.10].

| Field | Type | Req |
| --- | --- | --- |
| reviewType | enum(design-readiness, integration-readiness, range-readiness, test-readiness, daily-readiness) | R [03§6.2] |
| evidenceItems | struct[] {item, baselineOrApprovalReference, status, deficiency, owner, dueDate, waiverAuthority, supportingEvidence} | R [13§3.10 per-control fields; TRR 16-item evidence list 03§3.4] |
| outcome | enum(go, conditional-go, hold, no-go) | R [03§6.3 — definitions: go=all mandatory controls pass; conditional-go=named authority accepts defined deficiencies, limits written into cards and conclusion plan; hold=correction expected within window; no-go=cannot support useful execution] |
| approversAndTime | struct[] | R |

Readiness gate conditions (all true before live runs) [03§3.5]: mission+evidence chain passed rehearsal; mandatory authorities active; current cards and configurations issued; people can perform the procedure; fallback paths tested; every open deficiency has approved disposition with explicit effect on achievable conclusions.

### 1.7 DeficiencyWaiver

Purpose: records an authorized decision to proceed with a known unmet requirement. Source: [03§1.14].

Fields: requirementNotMet (text, R), cause (text, R), owner (person, R), correctionDate (date, R), evidenceNeededToClose (text, R), measuresOrRunsAffected (link[](M, RUN), R), safetyAndValidityEffect (text, R), waiverAuthority (person, R), expiration (date, R), retestRequirement (text, R).

Rule (verbatim): "A waiver does not make a failed control pass. It records an authorized decision to proceed with known limits."

### 1.8 HazardRecord

Purpose: one hazard with controls, abort trigger, and residual-risk acceptance. Source: [03§1.10].

Fields: hazardAndCause (text, R), exposed (people/property/mission, R), initialProbabilityAndSeverity (text, R), engineeringControl (text, R), adminProceduralControl (text, R), monitoringMethod (text, R), abortTrigger (text, R — surfaces onto test cards), emergencyAction (text, R), residualRisk (text, R), acceptingAuthority (person, R). Named hazard coverage list (14 seed types): lost link, geofence breach, flyaway, collision, nonparticipant entry, fire, battery event, RF exposure, unintended interference, weapon/effector action, severe weather, medical event, recovery, mishap reporting.

### 1.9 RangeFitAssessment

Purpose: grades each mission-required condition against site capability. Sources: [03§1.8], [13§3.9].

Fields: requiredCondition (link(COND) or text, R), dimension (enum of 14 assessment dimensions [03§1.8]: airspace-volume-altitude, ground-footprint-containment, terrain-clutter-horizon-los, weather-illumination, spectrum-em, comms-network, threat-launch-route-maneuver-recovery-termination, sensor-effector-geometry, ground-truth-coverage, safety-emergency, security-classification, personnel-vendor-access, calendar-reserve, cost-logistics), classification (enum(representative, acceptably-approximated, unsupported, requires-mitigation, requires-another-site), R) [minor conflict: 13§3.9 merges the last two values into one], gapEffectOnValidity (text, R per gap), conclusionsUnavailable (text, R per gap).

### 1.10 ContingencyRecord

Purpose: pre-planned response to loss of a critical resource; carries the minimum-viable-campaign logic. Source: [03§1.13].

Fields: lossScenario (enum(weather, airspace, spectrum, range, threat, system, operator, instrument, data-path, power, network, vendor-support, authority), R), immediateSafeAction (text, R), decisionTime (duration, R), recoveryOwner (person, R), alternateAssetOrMethod (text, R), maxRecoveryWindow (duration, R), objectivesDroppedFirst (ordered list, R), minimumEvidenceRequired (text, R), effectOnAcceptanceAndConclusions (text, R).

### 1.11 SecurityDataRights

Purpose: campaign-level definition of classification, access, and data rights. Source: [03§1.11], [13§3.8-3.9 hooks].

Fields (12 items, all R): classificationAndCuiMarking, needToKnowAccessList, accreditedSystemsStorage, removableMediaTransferProcess, encryptionKeyCustody, incidentReporting, vendorProprietaryData, comparativeResultRestrictions, governmentPurposeReuseRights, exportControls, retentionAndDeletion, publicReleaseAuthority. Hook: the strategist must know what evidence can be shown to each participant before the first shared review.

### 1.12 ScheduleWorkstream

Purpose: one workstream in the resource-loaded campaign schedule, built backward from the accepted-evidence date. Sources: [03§1.12, §6.4], [13§1.23], [12§6.5 T-countdown seed].

Fields: name (text, R), owner (person, R), backup (person, R), people (text, R), equipment (text, R), predecessor (link(ScheduleWorkstream), R), latestViableDate (date, R), contingency (text, R). Logistics item seed list in [03§1.12]. Milestone sequence seed in [03§6.4]; authority lead-time constants in [13§1.23]; JIATF T-30..T-2 countdown template in [12§6.5].

### 1.13 DecisionCharter (DEC)

Purpose: the bounded customer decision the campaign exists to support; anchor of all traceability. Sources: [01§1.8, §4.3], [10§1.1 decision math], [13§3.5].

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| decisionDate (deadline) | date | R | 01§1.8 |
| authorizedDecisionOwner | person | R | 01§1.8 |
| boundedChoice | text | R | 01§1.8 |
| alternatives (incl. delay/no action) | longtext | R | 01§1.8 |
| blockingUncertainty | longtext | R | 01§1.8 |
| acceptanceConditions | longtext | R | 01§1.8 |
| postTestAction | text | R | 01§1.8 supporting Qs |
| actionAuthority | text | R | 01§1.8 |
| consequenceOfNoAction | text | R | 01§1.8 |
| resultThatChangesChoice / resultThatDoesNot | text / text | R | 01§1.8 |
| deadlineThatMakesEvidenceUseful | date | R | 01§1.8 |
| latestAcceptedEvidenceDate | date | R | 01§1.8 |
| canAcceptUnfavorableEvidence | bool + text | R | 01§1.8 |
| minimumMeaningfulDifference | number+unit | R | 10§1.1 |
| acceptableThreshold | number+unit | R | 10§1.1 |
| requiredEvidenceStrength | text | R | 10§1.1 |
| decisionActionMap | struct {meet, miss, mixed, inconclusive → action text} | R | 10§1.1, 02§1.4 |

Charter statement template (verbatim, renders as fill-in form) [01§4.3]: "By [date], [authorized decision owner] must decide [bounded choice] among [alternatives, including delay or no action]. The decision is blocked or weakened by [uncertainty]. Evidence will matter only if [acceptance conditions] are met." Validation: reject vague statements ("see how it performs").

Relationships: 1 Campaign → 1..n DEC (typically 1 primary). DEC → Q (1..n). Pocket rule: "No decision owner, no campaign" [07§6].

### 1.14 Question (Q / OQ)

Purpose: a ranked, decision-linked operational or technical question. Sources: [02§1.1 — 9 fields], [04§1.2 pattern enum], [06 Part A disposition], [13§1.1 OQ register].

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| id + exactWording | id + longtext verbatim | R | 02§1.1 |
| decisionLinkage | link(DEC) | R | 02§1.1 |
| decisionOwner | person | R | 02§1.1 |
| priority | enum(P1, P2, P3) | R | 02§1.1 — P1: decision cannot be supported without an answer; P2: answer changes risk, configuration, or conditions of use; P3: improves understanding only. Rule: P3 work must not consume P1 range time |
| requiredAnswerDate | date | R | 02§1.1 |
| currentEvidenceState | text | R | 02§1.1 |
| consequenceIfUnanswered | text | R | 02§1.1 |
| evidenceAuthority | person | R | 02§1.1 |
| pattern | enum(capability, performance, comparison, sensitivity, boundary, reliability, diagnosis, regression, mission-effect) | R | 04§1.2 |
| vagueTermFlags | text[] | O | 04§1.2 — app flags "usable", "early enough", "reliably" and asks user to quantify |
| disposition | enum(answered-at-accepted-strength, partially-answered {namedGap: text}, not-answered {reason: text, path: text}) | R at closeout | 06 Part A |
| evidenceLevel | enum(component-behavior, interface-behavior, performance-under-tested-mission-conditions, end-to-end-mission-effect) | R at closeout | 06 Part A |
| closeoutStatus | enum(resolved, partially-resolved, unresolved) + reason | R at closeout | 13§4.4 [overlaps disposition — Field Guide 3-state view of the same fact] |

Lifecycle: draft → ranked → frozen (Step 1 freeze locks the ranked set [02§6.2]) → disposed at closeout (no question may be left without a state [06§6]).

### 1.15 Claim (CLM)

Purpose: a decision-relevant claim (vendor, contractual, operational) to be dispositioned by evidence. Sources: [01§1.15], [13§1.5], [06 Part A + Part L evidence history tree].

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| id + exactWording | id + longtext | R | 01§1.15 |
| sourceAndDate | text (enum-ish source: contractual, operational, government, vendor, promotional) + date | R | 01§1.15, 13§1.5 |
| claimedConditions | longtext | R | 01§1.15 |
| missionAndDecisionRelevance | text | R | 01§1.15 |
| existingSupportingEvidence | longtext | R | 01§1.15 |
| conflictsOrAssumptions | longtext | R | 01§1.15 |
| testabilityInCampaign | text | R | 01§1.15 |
| dispositionOwner | person | R | 01§1.15 |
| disposition | enum(supported, contradicted, directionally-supported, inconclusive, untested, outside-scope) | R at closeout | 06 Part A, 13§1.17 |
| dispositionLevels | struct — distinguish: product behavior as represented / performance under mission-relevant conditions / performance within complete architecture and mission thread | R at closeout | 13§1.17 |
| evidenceHistoryTree | struct {baselineConfiguration, originalSupportingTests, systemOrThreatChange, requiredRegressionTests, newResults, currentValidity} | R after baseline | 06§4 Part L — retained per claim, exactly this shape |

### 1.16 Unknown (UNK)

Purpose: a registered decision-relevant unknown, ranked for resolution. Sources: [01§1.16], [13§1.1, §1.5].

Fields: whatIsNotKnown (longtext, R), whyItMatters (text, R), currentBeliefAndBasis (text, R), evidenceThatCouldResolve (text, R), costOfRemainingUncertain (text, R), bestSource (enum(live-test, bench-test, simulation, analysis, prior-evidence, another-authority), R), rank (ordinal, R — ranked by decision impact, urgency, evidence cost, ability to resolve; no numeric scale defined in source [01§2.1 AMBIGUOUS] — model as manual ordinal rank plus optional per-criterion H/M/L).

### 1.17 Assumption (ASM)

Purpose: a registered assumption that must remain true for conclusions to hold. Source: [13§1.1 register series `ASM-001...`, §1.5 discovery categorization]. Fields: statement (longtext, R), basis (text, R), affectedRecords (link[], R), invalidationTrigger (text, O). Discovery rule: every customer statement becomes exactly one of Claim / Known fact / Unknown / Assumption [13§1.5].

### 1.18 Hypothesis (HYP)

Purpose: a falsifiable prediction tied to a question, measure, and threshold. Sources: [02§1.2], [04§1.4], [13§1.5].

Statement template (verbatim, 4 slots) [02§1.2]: "Under [configuration, threat, and condition], the system produces [observable behavior or mission effect], measured by [measure], relative to [threshold or comparison]." (04§1.4 variant adds the test object slot: "Under [configuration and conditions], [test object] will produce [observable result]...")

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| statement (4-5 slot template) | struct | R | 02§1.2, 04§1.4 |
| nullHypothesis | text | R | both |
| alternativeHypothesis | text | O | 04§1.4 only |
| competingExplanations | longtext | R | 02§1.2 |
| supportingEvidence / refutingEvidence / inconclusiveResult | text ×3 | R | both ("result that would support / contradict / remain inconclusive") |
| predictedValueOrRange | number/range + unit | R | 04§1.4 |
| expectedDirectionOfChange | text | R | 04§1.4 |
| expectedVariability | text | R | 04§1.4 |
| predictionType | enum(single-value, range, min-max-bound, distribution, rank-order, directional, pass-miss, no-difference, failure-boundary) | R | 04§1.4 |
| applicableLevel | enum(component, interface, operator, mission-thread) | R | 02§1.2, 13§1.5 [13 adds "operator" to 02's three] |
| assumptions | longtext | R | both |
| confidenceRequired | text | R | 04§1.4 |
| dispositionOwner | person | R | 02§1.2 |
| evaluationOutcome | enum(supported, directionally-supported, contradicted, inconclusive, not-tested) | R after analysis | 04§1.10 |
| evaluationContext | struct {supportingRuns: `link[](RUN)`, contradictingRuns: `link[](RUN)`, effectSize, variability, confidence, applicableConditions, confounders, alternativeExplanations, additionalEvidenceNeeded} | R after analysis | 04§1.10 |

Rules: prediction is stated BEFORE the test; app compares prediction with result after [04§1.4]. Use directional language only when the design supports it; no causal hypothesis when the campaign can only show association [02§1.2].

### 1.19 MeasureDefinition (M) and MeasureInstance

Purpose: MeasureDefinition = a reusable dictionary entry defining exactly how a quantity is computed; MeasureInstance = a campaign copy with every bracketed parameter replaced and frozen. Two-level model per [09§1.1] ("every campaign copies a dictionary entry into the campaign measure registry"). Sources merged: [02§1.3 — 20 ordered fields], [07§4.4 — 31 fields], [04§1.3 — 19 fields], [13§1.6], [10§1.2-1.3], [09§1.1].

MeasureDefinition fields (superset; 07§4.4's 31-field list is the largest single source — order preserved from it, extras appended):

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| measureId + name | id + text | R | all |
| decisionAndHypothesisLinkage | link(DEC), link(Q), `link[](HYP)` | R | 07§4.4, 02§1.3 |
| purpose | text | R | 07§4.4 |
| exactDefinition | longtext | R | all — reproducibility rule: two qualified analysts on the same valid data obtain the same result [02§1.3] |
| unit | text | R | all |
| numerator / denominator | text / text | R | 07§4.4, 02§1.3, 10§1.2 |
| startEvent / stopEvent | text / text | R | all |
| experimentalUnit | text | R | all — see valid-unit enum [09§1.16] |
| aggregationLevel / aggregationMethod | text | R | 07§4.4 / 04§1.3 |
| primarySourceAndFields | text | R | 07§4.4 ("source fields" 02§1.3, "required source fields" 04§1.3) |
| backupSource | text | R | 07§4.4 |
| independentGroundTruth | text/link(GroundTruthPlan) | R | all |
| updateRate | number(Hz) | R | 07§4.4 ("sampling or update rate" 02§1.3) |
| coordinateFrame | text | R | 07§4.4, 02§1.3 |
| timeSourceAndTolerance | text + duration | R | 07§4.4 |
| calculationMethod / formula | longtext | R | 07§4.4, 02§1.3, 04§1.3 |
| codeOrAnalyticalVersion | text | R | 07§4.4, 02§1.3 |
| missingDataRule | text | R | all |
| invalidDataRule | text | R | 07§4.4, 04§1.3 |
| censoringRule | text | R | 07§4.4, 02§1.3 |
| ambiguityRule | text | R | 07§4.4, 02§1.3 |
| measurementUncertainty (method) | text | R | all |
| threshold | number+unit | R | all |
| objective | number+unit | R | 07§4.4, 02§1.3, 04§1.3 ("objective value") |
| failureBoundary | number+unit | R | 07§4.4, 02§1.4 |
| thresholdRationale + thresholdSource | text + enum(law-regulation-safety, contract-validated-requirement, mission-arithmetic, accepted-baseline, customer-decision-rule, analyst-judgment-labeled) | R | 07§4.4; source precedence ordered [02§2.2, 10§1.5, 13§2.3] — use the first applicable; without a customer-approved threshold, suppress pass/fail and characterize instead [13§2.3] |
| requiredRepetitionOrConfidence | text | R | 07§4.4, 02§1.3, 04§1.3 |
| borderlineResultRule | text | R | 07§4.4, 02§1.4 |
| approverAndDate | person + date | R | 07§4.4, 02§1.3 |
| measureType | enum(continuous, binary, count, rate, category, time-to-event, distance, position-error, probability, human-rating, composite-mission-outcome) | R | 04§1.3 |
| measureClass | enum(primary, secondary, leading, lagging, descriptive, diagnostic) | R | 13§1.6 |
| measureCategory | enum(mission, performance, suitability, safety, diagnostic) | R | 02§1.3 |
| measureLevel | enum(component, interface, mission) | R | 13§1.6 |
| expectedValueOrRange | range | O | 04§1.3 |
| minimumAcceptableValue | number | O | 04§1.3 (alias of threshold) |

MeasureInstance additional fields (frozen before execution) [09§1.1]: configuration (link(CFG), R), threat (link(THR), R), conditions (`link[](COND)`, R), thresholdWithSource (number + source enum, R), eventGates (struct — spatial/temporal/identity/persistence association gates, R), uncertaintyLimits (time and coordinate tolerances; max event-time uncertainty, R), eventRule (rule text, frozen, R), denominatorRule (what counts as a valid opportunity, frozen, R), truthRule (R), missingDataRule (frozen, R), validityRule (frozen, R), uncertaintyRule (frozen, R), links (DEC, Q, HYP, missionTask, matrixCell — ALL required, R). Plus per-measure-family parameter blocks: detection rule (1 report vs K consecutive vs dwell) [09§1.2], stable-track rule [09§1.3], handoff success criteria [09§1.4], decision-ready-track definition [09§1.5], latency definition (start/stop/time source/window/censoring/clustering) [09§1.25].

Outcome taxonomies carried per measure family [09§1.6-1.13]: defeatOutcome(physical-destruction, functional-mission-kill, diversion-forced-landing, lost-guidance-navigation, temporary-suppression, unknown); ewEffect(navigation-deviation, control-link-loss, mission-abort, forced-recovery, loss-of-terminal-function, temporary-suppression); interceptOutcome(no-assignment, no-launch, launch-failure, guidance-failure, miss, intercept-unknown-effect, intercept); defeatMeasureOutcome(confirmed-defeat, probable-defeat-if-allowed, no-defeat, unknown, no-test); handoffFailure(no-transmission, rejected-message, schema-failure, identity-error, stale-data, duplicate-merge-error, unusable-quality, timeout); falseTrackCategory(false, duplicate, split, uncorrelated-real, nuisance-real); downtimeCategory(system-fault, scheduled-maintenance, test-infrastructure, operator, external-constraint, unknown); operatorIntervention(required-decision, correction, override, recovery, false-alarm-handling, unplanned-troubleshooting).

Seed library: 15-17 named C-UAS measures [02§1.3, 04§7.2]; 6 computable notional-card measures with formulas [13§2.1].

Relationships: M ← Q/HYP (required); M → EvidenceSource, MeasureToDataMap, GroundTruthPlan; M ← TC section 9; M ← MeasureResult.

Lifecycle: draft → approved (approver+date) → instantiated per campaign → frozen at execution start. Post-result threshold change creates a NEW versioned decision rule, never overwrites [02§6.4].

### 1.20 EvidenceSourceRecord

Purpose: per-measure declaration of primary/backup data sources and their independence. Sources: [02§1.5], [13§1.9].

Fields: measure (link(M), R), primarySource (text, R), backupSource (text, R), independenceFromSUT (text justification, R), accuracyAndUncertainty (text, R), coverageAndUpdateRate (text, R), calibrationRequirement (text, R), timeSyncTolerance (duration, R), dataOwnerAndAccessPath (text, R), failureEffect (enum-ish: invalidates-run, requires-repetition, reduces-analytical-richness [13§1.9], R), validationMethod/Owner (text, R). Rule: if one source can silently fail, define an independent health indicator [02§1.5].

### 1.21 MeasureToDataMap

Purpose: maps every approved measure to concrete source system fields; signed by data and analysis leads. Sources: [03§1.1], [13§1.10].

Fields: measure (link(M), R), sourceSystemAndField (text, R), state (enum(raw, processed, inferred, manually-annotated), R), unitSchemaFrameSemantics (text, R), updateRateAndLatency (text, R), identifiersCarried (subset of identifier model §1.44, R), commonTimeSource (text, R), liveOrPostProcess (enum(live, post-process), R), transformationPath (text, R), backupSource (text, R), missingnessAndValidityRule (text, R — inherited from measure registry [13§1.10]), storageAndAccessClass (text, R), dataLeadSignature + analysisLeadSignature (person+datetime, R), strategistVerification (bool, R).

### 1.22 TestObject

Purpose: the thing under test. Source: [04§1.1].

typeEnum (9): component, sensor, algorithm-model, software-release, subsystem, integrated-system, operator-procedure, human-machine-team, end-to-end-mission-thread. Fields: nameAndDescription (R), manufacturerAndModel (R), hardwareVersion (R), softwareFirmwareVersions (R), configuration (link(CFG), R), interfaces (text, R), operatorProcedure (text, R), trainingState (text, R), intendedFunction (text, R), knownLimits (text, R), priorResults (text, R), comparisonBaseline (text, R).

### 1.23 SystemBoundary

Purpose: defines what is inside/outside the evaluated boundary and what claims it can support. Source: [01§1.13], [13§3.6].

Fields: objectScope (enum(component, subsystem, platform, integrated-architecture, complete-mission-capability), R), itemsInside (list, R), supportingSystemsIncluded (list, R), operatorsProceduresTrainingIncluded (list, R), externalServicesAndDependencies (list, R), itemsExcluded (list, R), assumptionsAboutExcluded (longtext, R), interfacesControlledOrObserved (list, R), claimsSupportable / claimsNotSupportable (longtext, R), boundaryDiagram (attachment with an identifier on every interface, R).

### 1.24 MissionThread and ThreadTransition

Purpose: the C-UAS kill chain as an ordered node graph; each transition carries evidence fields. Sources: [01§1.12, §4.5], [13§1.22, §6.3], [08§6.2], [09§1.13 mission-thread package].

Default node chain (12 nodes, verbatim [01§4.5]): Threat presentation → Detection → Track initiation → Track maintenance → Classification or identification → C2 ingestion and correlation → Prioritization → Engagement decision and authority → Effector assignment → Intercept or effect → Effect assessment → Residual-threat action. [Variants: 13§6.3 10-node QtM chain; Field Guide 8-node detect→track→identify→decide→assign→engage→assess; doctrine 5-step Detect→identify→decide→disseminate→defeat [08§6.2] — keep the 12-node manual chain as canonical, others as templates.]

ThreadTransition fields (8, per arrow) [01§1.12]: sourceAndDestination (R), dataOrPhysicalEffectPassed (R), requiredAccuracyQualityLatency (R), humanOrAutomatedDecision (R), authority (R), failureMode (R), observableDiagnosticData (R), missionConsequence (R). [13§1.22 variant folds to 5 fields — superset kept.] Rule: a component-scope campaign still states mission-thread assumptions outside the test boundary [01§1.12].

MissionThread package extras [08§1.13]: missionAndProtectedOutcome struct (7 fields), friendlyPosture struct (10 fields), adversaryAction struct (8 fields), testBoundary enum(one-component, one-interface, one-transition, partial-chain, complete-active-defense-chain, passive-defense, combined-passive-active, mission-continuity-after-engagement, recovery-and-re-engagement) — rule: do not call a partial chain "end to end".

### 1.25 FailureMode

Purpose: one failure mode with its campaign treatment. Source: [01§1.17], [13§3.6].

Fields: category (enum of 10: component-function, interface-message-handling, configuration, operator-action-workload, threat-representation, environment, instrumentation-ground-truth, data-processing, test-method, authority-schedule), cause, effect, detectability, missionConsequence, recovery, diagnosticEvidence, plannedControl (all text, R), treatment (enum(prevent, monitor, induce, accept), R).

### 1.26 FeasibilityItem

Purpose: one of the 12 feasibility-screen items with score and disposition. Source: [01§1.18].

Fields: item (enum of 12 fixed items [01§1.18]), score (enum(feasible, feasible-with-mitigation, unresolved, infeasible), R), and for every `unresolved` item: owner (person, R), dueDate (date, R), fallback (text, R), effectOnConclusions (text, R). [AMBIGUOUS in source: whether `infeasible` auto-fails the qualification gate.]

### 1.27 Factor

Purpose: classification of every variable that can affect a result. Sources: [02§1.8], [04§1.5], [08§1.6 red variables], [13§1.8].

[CONFLICT: three taxonomies. 02/04 use 4 classes (independent, controlled/held, recorded covariate, unobserved nuisance). Field Guide [13§1.8] uses 5 (independent, controls, covariates, responses, confounders). Page 08 red-variable classification uses 6 (independent, held control, bounded red choice, recorded covariate, prohibited variable, unobserved nuisance). Unified superset:]

| Field | Type | Req |
| --- | --- | --- |
| name | text | R — seed lists: [04§1.5] 15 example factors; [09§1.22] C-UAS design factors; [08§1.6] 14 red variables |
| classification | enum(independent-variable, held-control, recorded-covariate, unobserved-nuisance, bounded-red-choice, prohibited-variable, response) | R — exactly one per factor |
| confounderFlag | bool | O — 13's "confounder" is an analysis property, not a fifth class |
| plannedLevelsOrderComparison | text | R when independent [08§1.6] |
| toleranceAndVerification | text | R when held-control [08§1.6] |
| envelopeAndLogging | text | R when bounded-red-choice (record choice, trigger, time, rationale) [08§1.6] |
| riskStatement | text | R when unobserved-nuisance ("remove it, instrument it, or state the risk") [08§1.6, 02§1.8] |

Mandatory covariates [02§1.8]: learning, fatigue, order, equipment heating, battery state, maintenance, time-of-day effects.

### 1.28 TestMatrixCell

Purpose: one design point = configuration × threat × condition × method × repetition. Sources: [02§1.9], [04§2.1], [08§1.8], [05§4 coverage map].

Fields [02§1.9]: questionAndHypothesis (link(Q, HYP), R), configuration (link(CFG), R), threatAndCondition (link(THR, COND), R), independentVariable (link(Factor), R), measures (`link[](M)`, R), plannedRepetitions (int, R), requiredOrderOrBlock (text, R), costAndTime (text, R), safetyAndAuthorityNeeds (text, R), minimumValidEvidence (int, R), priorityAndDropOrder (int+int, R). Coverage-state (computed): validRunCount vs minimum; flags empty/thin/redundant [05§4].

Required coverage rows [02§1.9]: baseline condition; positive control when available; negative control; comparison system/prior configuration when relevant; decision-critical threat+environment combos; expected operating center; high-risk boundary conditions; degraded modes; diagnostic isolation events. Cell-selection criteria [08§1.8]. Matrix formula [04§2.1]: Configuration × Threat × Condition × Method × Repetition = planned runs; generator also shows total runs, estimated duration, coverage by question/condition, required assets, missing controls, planned repetitions, minimum valid evidence, drop order.

### 1.29 RunListEntry

Purpose: one prioritized planned run drawn from a matrix cell. Source: [02§1.10].

Fields: cardId (link(TC), R), purpose (one sentence, R), matrixCell (link(TestMatrixCell), R), priority (int, R), dependencies (link[], R), estimatedDuration (duration, R), requiredAssets (text, R), minimumValidResult (text, R), dropOrder (int, R). Rule: the run list is never edited in place — a superseding version is issued via CHG [05§6].

### 1.30 QuantDesignRecord

Purpose: the statistical design pre-record frozen before method selection and execution. Sources: [09§1.15, 1.18, 1.19, 1.23, 1.24, 1.30], [10§1.9-1.13], [02§2.3].

Fields: decisionAndQuestion (link, R), primaryResponseMeasure (link(M), R), experimentalUnit (enum seed [09§1.16]: independently-reset-threat-presentation, complete-handoff-opportunity, engagement-opportunity, complete-raid, operating-hour-block, system-article-over-mission-period; R), configurationsCompared (`link[](CFG)`, R), factorSpace (`link[](Factor)`, R), minimumMeaningfulEffect (number, R), thresholdOrComparison (text, R), requiredUncertaintyOrRisk (text, R), expectedVariability (number, R), independenceStructure (text, R — dependence checklist [09§1.17]), maxFeasibleValidSample (int, R), sequentialPlan (struct [09§1.24]: initialSampleOrBudgetShare, interimReviewSchedule, statisticsReviewed, sufficiencyBoundary, futilityBoundary, maxSample, allowedFactorSpaceAugmentation, confirmatorySampleHeldBack, repeatedLooksTreatment; all frozen pre-execution), fallbackConclusions (text, R), thresholdDesign (struct: p0, p1, falseAcceptRisk, falseRejectRisk, exactDecisionRule, maxSample, sequentialStoppingPermitted [09§1.18]), comparisonDesign (struct [09§1.19]), regressionModelRecord (struct [09§1.23]), bayesianPrior (struct: Beta(a,b), justification, sensitivity [09§1.30]), randomizationAndBlocking (candidates [09§1.20-1.21]), sampleRationale (longtext, R — documented by analysis lead BEFORE design approval [02§2.3]).

### 1.31 ThreatProfile (THR)

Purpose: one version-controlled, operationally distinct threat presentation. Sources: [08§1.2 — the superset], [02§1.6], [07§4.6 fields 1-18], [13§1.7], [12§1.4].

| Field group | Fields | Req | Source |
| --- | --- | --- | --- |
| identity | threatId + version; platformOrPhenomenon | R | 02§1.6, 07§4.6 |
| mission | threatMission enum(reconnaissance-target-development, persistent-observation, route-site-reconnaissance, one-way-attack, fpv-attack, munition-delivery, decoy-stimulation, electronic-attack-relay, saturation-magazine-depletion, combined-recon-attack, post-strike-assessment, other-stated) — one or more; rule: never infer payload effect from airframe alone | R | 08§1.2 |
| physical/kinematic | airframeClassAndUasGroup (Groups 1-3 minimum [08§1.18]); dimensionsAndWeight; payloadState; speedBands; altitudeBands; climbDescentAccelTurn; enduranceRequired; routeAndApproachAxis; launchOrEntryPoint; standoffReleaseTerminalGeometry; terrainMaskingLosBehavior; hoverLoiterOrbitDivePopupCrossing; recoveryImpactTimeoutLostLink; formationSpacingAndTiming | R as relevant | 08§1.2 (07§4.6 compresses to: size/payload, speed/altitude, route/geometry/maneuver) |
| control/nav/autonomy | manualControl; waypointNav; gnssDependence; inertialAltNav; eoTerminalGuidance; automatedTargetRecognition; lostLinkBehavior; behaviorAfterNavDegradation; behaviorAfterLinkDegradation; humanInterventionPoints; autonomyActuallyExercised — record executed behavior, not marketing labels | R | 08§1.2; guidance-mode enum [08§1.18]: remote-control, waypoint, eo-terminal, rf-silent, fiber |
| emissions/signature | commandLink; videoLink; frequencyBand; channelWaveformDutyPower; frequencyAgility; emissionTiming; rfSilentSegments; navEmissions; radarCrossSection; eoIrAppearance; acousticSignature; visualSignature; transponderIffState; signatureAugmentation (safety beacon/tracker — record and assess effect on blue detection) | R as relevant | 08§1.2 |
| coordination/raid | aircraftCount; sameOrMixedType; simultaneousOrSequentialEntry; approachAxes; spacingTimeDistance; altitudeDeconfliction; decoyToAttackRatio; reconToAttackRelationship; cooperativeOrIndependent; retaskingLogic; responseToBlueAction; repeatedWaveTiming; raidEndCondition — rule: "swarm" is not a sufficient profile | R for multi-ship | 08§1.2 |
| adaptation | triggerResponsePairs struct[] {observableTrigger, allowedResponse}; rule: never "act realistically" undefined | R when adaptive | 08§1.2 |
| red operator | experienceWithAircraft; experienceWithScript; rangeFamiliarity; informationAvailable; abilityToObserveBlue; permittedCoaching; permittedRetries; workloadAircraftCount; fatigueOrderEffects; commsDelay; manualInterventionCount | R when human-controlled | 08§1.2 |
| representation | representationClass enum(actual-threat, validated-surrogate, generic-representation, model-simulation-constructive, hybrid) | R | 08§1.3 [CONFLICT: 02§1.6/07§4.6/13§1.7 use a 3-value enum (actual, validated-surrogate/surrogate, generic); 08§1.3 adds model/constructive and hybrid — use the 5-value superset] |
| fidelity | `link[](FidelityAssessment)` | R | 08§1.4 |
| control bounds | redControlledVariables; fixedVariables; blindedInformation; safetyAndRealismBounds | R | 02§1.6, 07§4.6 |
| validation | validationSourceAndAuthority | R | 02§1.6, 07§4.6 |
| profileClass | enum(mandatory, high-probability, high-consequence) | R | 13§1.7 |
| generalization | permittedGeneralization; prohibitedGeneralization | R | 02§1.6, 07§4.6 |

Versioning rule: any change that can alter blue-system performance creates a new profile or a recorded profile variant [08§1.2]. Value discipline: use ranges when natural variation is part of the threat; exact values when repeatability isolates a blue factor [08§1.2].

### 1.32 FidelityAssessment (surrogate-fidelity matrix row)

Purpose: per-feature comparison of intended threat vs represented state. Source: [08§1.4]; feature list also [02§1.6], [13§1.7].

Fields per feature row: feature (enum of 19 minimum [08§1.4]: mission-behavior, airframe-size-shape, payload-state, speed-altitude, maneuver-terminal, route-geometry, radar-signature, rf-emissions, eo-ir-appearance, acoustic-signature, control-method, navigation-method, autonomy, lost-link-behavior, countermeasure-resistance, coordination-raid, operator-behavior, environmental-interaction, instrumentation-created-observables), intendedThreatState (text, R), representedState (text, R), fidelity (enum(faithful, approximated, omitted, unknown), R) [minor conflict: 13§1.7 QtM lists only faithful/approximated/omitted — keep 4-value superset from 02§1.6 + 08§1.4], verificationSourceOrMeasurement (text, R), toleranceRelevantToMeasure (text, R), likelyEffectOfDifference (text, R), measuresAffected (`link[](M)`, R), permittedGeneralization (text, R), prohibitedGeneralization (text, R), followOnEvidenceNeeded (text, R). Required treatment per fidelity state per [08§1.4] table. Rule: never compute one overall fidelity score that hides a critical omission.

### 1.33 OpforExecutionMode

Purpose: declares how red executes — scripted, bounded-adaptive, or free-play — with the per-mode required definitions. Source: [08§1.5].

mode enum(scripted, bounded-adaptive, free-play). Per-mode required struct fields exactly as [08§1.5]: scripted {exactInitialState, routeOrManeuverSequence, timingSpeedTolerances, triggerPoints, allowedCorrections, abortBehavior, resetState, redInformation, invalidatingDeviations}; boundedAdaptive {redObjective, observableTriggers, permittedResponseMenu, bounds(altitude,route,emissions,timing,maneuver), redMayUse, withheldFromRed, maxAdaptations, triggerResponseLogging, exploratoryOrConfirmatoryDesignation}; freePlay {redObjective, startingResourcesState, prohibitedActions, safetyRangeBounds, timeLimit, informationAvailable, eventDecisionLog, instrumentationMinimum, endConditions}.

### 1.34 InfoLearningControls

Purpose: campaign-level blinding and learning ledger. Source: [08§1.7]. Fields (8, all R): redKnowledgeOfBlue, blueKnowledgeOfThreat, postRunLearningBothSides, feedbackWithheldUntilBlockEnd (bool), routesRandomized (bool), sameOperatorsRepeat (bool), trainedVsSurpriseResponseSought, learningEffectOnComparisons. Rule: red exploitation of a learned weakness makes later runs a changed condition, not repetitions.

### 1.35 RealismConstraint

Purpose: one record per feature that cannot be fully reproduced. Source: [08§1.11]. Fields (7, all R): threatFeatureAffected, reasonNotReproducible, substituteUsed, biasDirection, measureAffected (`link[](M)`), conclusionNarrowed, evidenceNeededToClose.

### 1.36 Condition (COND)

Purpose: one named, reproducible test-environment state. Sources: [02§1.7], [07§4.6 fields 19-29], [08§1.8 columns, §1.15, §1.16].

Fields: conditionId (R); terrainAndClutter (R); weatherAndIllumination (R); electromagneticEnvironment (R); networkState (R); backgroundActivity/Traffic (R); operatorWorkload (R); operatorState (02§1.7); supportingSystems (R); degradedModes (R); permittedGeneralization / prohibitedGeneralization (R, 07§4.6). Contested-spectrum sub-record [08§1.15] (11 fields: baselineSpectrumState, appliedEmissions, timeAndLocation, bandPowerWaveformDuty, systemsIntendedAffected, systemsMustRemainUnaffected, threatControlNavDependencies, friendlyDependencies, monitoringSource, stopLimits, actualMeasuredEnvironment — rule: "EW on" is not a reproducible condition; measure what was applied). C2-degradation sub-record [08§1.16]: degradationState enum(increased-latency, packet-loss, intermittent-link, loss-of-central-picture, loss-of-one-sensor-feed, loss-of-one-effector-connection, local-only-operation, stale-track-data, conflicting-tracks, clock-misalignment, manual-voice-fallback, partition-then-restoration) + factors {startTimePhase, duration, nodesAffected, informationRetainedLocally, fallbackProcedure, localDecisionState, operatorAwareness, recoverySequence, reconciliationAfterRestoration}.

[Note: 07§4.6 presents THR+COND as one 29-field combined form; 02 and 08 model them as separate records. MODEL AS SEPARATE THR and COND records with a combined form view — the form is a layout, not a schema.]

### 1.37 ConfigurationBaseline (CFG)

Purpose: the complete frozen identity of the system under test; precondition for every comparison. Sources: [07§4.5 — 28 fields], [01§1.4, §1.14], [13§1.4], [11§1.2 configuration truth].

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| configurationId + version | id | R | 07§4.5 |
| systemBoundary | link(SystemBoundary) | R | 07§4.5 |
| hardwareModelsAndSerials | struct[] | R | 07§4.5, 01§1.4 |
| softwareAndBuildVersions | struct[] | R | 07§4.5 |
| firmwareVersions | struct[] | R | 07§4.5 |
| algorithmsAndModels | text | R | 07§4.5 |
| missionDataFilesAndDates | struct[] | R | 07§4.5 |
| featureFlagsAndSettings | struct[] | R | 07§4.5, 01§1.4 (thresholds included) |
| sensorConfiguration | text | R | 07§4.5 |
| c2AndNetworkConfiguration | text | R | 07§4.5 |
| interceptorEffectorConfiguration | text | R | 07§4.5 |
| interfaceVersions | struct[] | R | 07§4.5 |
| securitySettings | text | R | 07§4.5 |
| calibrationState | text | R | 07§4.5 |
| operatorRolesAndNames | struct[] | R | 07§4.5 |
| procedureVersion | text | R | 07§4.5 |
| trainingState | text | R | 07§4.5 |
| knownDefects / waivers / temporaryFixes / vendorModifications | text ×4 | R | 07§4.5, 01§1.4 |
| exportOrCaptureLocation | text/attachment | R | 07§4.5 — machine-readable export where supported; photo when not [01§1.4] |
| checksumWhereRequired | text | O | 07§4.5 |
| functionalCheckResult | text | R | 07§4.5 |
| systemOwnerRelease | person+datetime | R | 07§4.5 — vendor releases the exact configuration; does not control test design [01§1.1] |
| freezeTime | datetime | R | 07§4.5, 13§1.4 |
| runsUsingBaseline | `link[](RUN)` | computed | 07§4.5 |
| supersededBaseline + changeSummary | link + text | R on reissue | 07§4.5 |
| perItemStatus | enum(confirmed-available, expected-not-verified, planned-change-before-test, customer-furnished, vendor-controlled, unavailable-unresolved) | R at initial baseline | 01§1.14 |
| changeApprovalOwner | person | R | 13§1.4 |
| driftLog | struct[] {time, observedDrift} | R | 01§3.1 |

Rules: a configuration change requires a NEW baseline when it can affect behavior, data, safety, comparability, or applicability [01§3.1]; freeze before the first dependent run; verify before EACH run (export, checksum, screen capture, or signed check); preserve all superseded baselines; planned configuration is not configuration truth — capture actual state before and after each run [11§1.2]. Pocket rule: "No configuration record, no comparison" [07§6].

### 1.38 TestCard (TC)

Purpose: the single controlling document for one run type; frozen when issued; execution follows it exactly. Sources: [04§4.1 — canonical 20 fields], [07§4.7 — 17 numbered sections], [13§4.1 — Field Guide flat template], [13§1.13 — QtM 3-block card], [04§4.5 generated-card content].

[CONFLICT: 04§4.1 mandates 20 fields "in this order"; 07§4.7 mandates 17 numbered sections; 13§4.1 gives a flat print template. The sets are reconcilable — the unified model uses 07's 17 sections as the print backbone with 04's 20 fields mapped in. The one true gap: 04 field 19 (blinding and information-control rules) has no 07 section of its own; 07 puts blinding inside section 6 (Threat state). Keep blinding as its own sub-block that renders inside section 6.]

Unified card structure (section → merged content → source of each field):

1. **Control** — cardId, title, version, status, owner, approvers, effectiveTime [07 S1 = 04 f1 + effective time].
2. **Traceability** — decisionId (DEC), questionId (Q), claimId (CLM), hypothesisId (HYP), measureIds (M), matrixCellId [07 S2 = 04 f2 + measures/matrix; 13§4.1 adds campaign + questionIds]. Typed links, all required. Rule: reference canonical records; never copy uncontrolled values [04§4.2].
3. **Purpose** — one sentence why the run exists [04 f3, 07 S3]; plus "why this run is the highest-value next event" and "result that could change the decision or plan" [13§1.13].
4. **Planned repetition** — repetitionNumber, minimumValidSample, reasonForRunPriority [07 S4 = 04 f4].
5. **System state** — systemBoundary, configurationId (CFG link), systems, interfaces, operators, procedure, trainingState [07 S5 = 04 f5 + f8].
6. **Threat state** — threatId (THR link), exactProfile, redControlVariables, redControlMode (scripted/bounded-adaptive/free-play [13§1.13]), blinding + informationControlRules [07 S6 = 04 f6 + f19].
7. **Condition** — conditionId (COND link), weather, terrain, RF, network, background, operatingLimits [07 S7 = 04 f7].
8. **Variables** — independentVariables, heldControls, recordedCovariates (Factor links) [07 S8 = 04 f9].
9. **Measures** — measureIds, thresholds, objectives, expectedEvidence [07 S9 = 04 f10].
10. **Data and truth** — sources, fields, groundTruth, calibration, commonTime, tolerances, monitoring, fallback [07 S10 = 04 f11].
11. **Preconditions** — authorities, area, system, threat, people, safety, data, communications [07 S11 = 04 f12].
12. **Procedure** — ProcedureStep[] (see sub-record) [07 S12 = 04 f13].
13. **Expected result** — nominalBehavior, knownExpectedArtifacts [07 S13 = 04 f14]; prediction block [04§4.5].
14. **Stop and restart** — safety/regulatory/equipment/data-quality/security stop triggers; safeState; restartAuthority; degradedOperationRules [07 S14 = 04 f15 + f16]; abort criteria split: immediate-abort vs pause-or-invalidate-measure [13§4.2].
15. **Validity and repeat** — requiredConditions, invalidatingFailures, conditionalUses, resetNeeds (required reset before a repeat [04§4.2]) [07 S15 = 04 f17].
16. **Outputs** — requiredFiles, runLog, observations, quickLookProduct, statusDecision, storagePath [07 S16 = 04 f18].
17. **Deviation record area** — time, actualDifference, affectedControl, validityEffect, disposition, linkedChange (embedded DEV capture + CHG links) [07 S17 = 04 f20]; runNumbers executed against this card [13§4.1]; embedded change-record block {changeId, datetime, previousValue, newValue, evidenceReason, responsibleOwner} [13§4.1].

Execution-control metadata (card-writing rules as data) [04§4.2]: siteApprovedCalls {start, stop, pause, abort words}, preEventRecordingMargin (duration), postEventRecordingMargin (duration), operatorPriorKnowledge (what operators may know before the run), redMayVary / redMustHold.

ProcedureStep sub-record [04§4.2, 07§4.7 S12]: stepNumber (int, R), actionText (ONE action, R), performingRole (enum per-run role, R), observableCompletionCriterion (text, R), canSilentlyInvalidateRun (bool flag, R), isRecorderStartStop (bool flag, R).

Relationships: one issued card controls one run type; 1 TC → 0..n RUN. Lifecycle: see §4.3. Gate: a card that fails the cold-reader test or dry run is not ready [04§4.3]. Pocket rule: "No issued card, no live run" [07§6].

### 1.39 Run (RUN)

Purpose: one execution attempt with an immutable identity; the atomic unit of evidence. Sources: [07§4.8 — 29-field run record], [04§1.7-1.8], [05§1], [13§1.14, §1.1], [06 Part B run accounting].

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| runId | id — immutable, never renumbered, never reused, versionless | R | 01§4.2, 13§1.1 |
| cardIdAndVersion | link(TC@version) | R | 07§4.8 |
| plannedPurpose | text | R | 07§4.8 |
| plannedMatrixCellAndRepetition | link + int | R | 07§4.8 |
| startAndStopTimes | datetime ×2 | R | 07§4.8 |
| roles: testConductor, safetyAuthority, operators, redLead, dataMonitor, witnesses | person[] | R | 07§4.8 (full 11-role set [04§1.6]) |
| actualConfigurationId | link(CFG) | R | 07§4.8 — planned vs actual is the core distinction [04§1.7] |
| actualThreatProfile | link(THR) + actuals | R | 07§4.8 |
| actualConditions | link(COND) + actuals (weather, route/geometry, operators, procedure, data-source status) | R | 07§4.8, 04§1.7 |
| actualProcedureSummary | text | R | 07§4.8 |
| timeOrderedEventLog | `link[](RunEvent)` | R | 07§4.8 |
| sourceAndGroundTruthStatus | text | R | 07§4.8 |
| clockAndCalibrationStatus | text | R | 07§4.8 |
| deviations | `link[](DEV)` | R | 07§4.8 |
| anomalies | `link[](ANOM)` | R | 07§4.8 |
| safetyOrRegulatoryEvents | text | R | 07§4.8 |
| directOperatorObservations | longtext — observation only, opinion labeled, no causal interpretation [04§3.10] | R | 07§4.8 |
| dataFilesAndStoragePath | text | R | 07§4.8 |
| initialDataQualityResult | text | R | 07§4.8 — produced by data lead, feeds adjudication [01§5] |
| finalStatus | enum(valid, conditionally-valid, invalid, pending) | R | see status note below |
| allowedMeasuresAndComparisons | `link[](M)` + text | R when conditionally-valid | 07§4.8, 04§1.8 |
| prohibitedUses | text | R when conditionally-valid | 07§4.8 |
| repeatRecommendation | text + urgency | R | 07§4.8, 13§1.14 |
| adjudicatorsAndTime | person[] + datetime | R | 07§4.8 |
| accountingState | enum(planned, attempted, valid, conditional, invalid, excluded) | computed | 06 Part B; daily review uses attempted/valid/conditional/invalid/pending [07§3.4] |
| immediateDebrief | struct {planned, occurredInTimeOrder, differed, sourcesRecorded, warningsFailures, operatorObservations, unexpectedResult, repeatNeeded} | R within 10 min | 04§3.10 (both page-04 and page-15 variants merged) |

Run validity status [CONFLICT — five spellings of one enum: 04§1.8 valid/conditionally-valid/invalid (no pending; "no status = not available for analysis"); 07§4.8 adds `pending`; 05 uses valid/conditional/invalid/pending; 13 Field Guide uses valid/valid-with-limitation/invalid/pending-adjudication; existing types.ts uses valid/valid-limited/invalid/pending. UNIFIED: `valid | conditionally-valid | invalid | pending` with `pending` as the initial state, plus the separate accountingState above (excluded is an accounting decision, not an adjudication outcome).]

Opportunity pipeline (per measure, finer than run status) [09§6.4, 10§6.3]: `planned → attempted → eligible → valid → event-observed-or-not → included-in-analysis`. Evidence-accounting counts preserved per measure [10§1.20]: planned, attempted, eligible, valid, conditionally-valid, invalid, missing, censored, unknown, successful, included-in-each-analysis.

Immutability: what differs from the card becomes a deviation; the team never edits the card to match what occurred [04§4.4]. An invalid run is preserved, stays in sequence, and may retain diagnostic value with labeled allowed use [01§4.2, 08§1.10].

RunEvidencePackage (stored together per run) [04§5.2]: issued card+version, run log, configuration export, threat and condition records, authority and readiness references, raw source data, ground-truth data, calibration and synchronization records, operator and observer notes, deviations and anomalies, data-quality result, run-status decision and approvers, quick-look product, checksums/custody records when required.

### 1.40 RunEvent

Purpose: one timestamped event inside a run. Sources: [11§1.8 — event record form], [04§4.7 — event controls], [04§3.4 run-logger duties].

Fields [11§1.8]: eventId (R), runId (link(RUN), R), eventType (R — UI event-control seed enum [04§4.7]: start-recording, start-run, mark-event, mark-phase-transition, record-operator-action, record-system-response, add-observation, mark-deviation, mark-anomaly, pause, stop, complete-run), eventTime (R), originalSourceTime (R — preserved always), correctedCommonTime (R), timeUncertainty (R), truthObjectId (O), sourceTrackOrMasterTrackId (O), source (R), provenance (enum(measured, inferred, commanded, manually-annotated), R), stateValue (R), units (R), qualityConfidence (R), createdBy (person or process, R), transformationVersion (R), notes (O).

### 1.41 RunAdjudication

Purpose: the versioned run-validity board decision for one run. Sources: [05 Part B], [13§1.14].

Review-input assessments (8, each assessable per run) [05]: plannedVsActualState, configurationIdentity, threatAndConditionFidelity, procedureCompliance, groundTruthAndSourceHealth, dataCompletenessAndTimeQuality, deviationsAndAnomalies, independenceAndComparisonIntegrity. Recorded outputs: finalStatus (run enum), measuresAllowed (`link[](M)`), comparisonsAllowed (text), limits (text), repeatDecision (text), dissent (text — never removed), approverAndTime, adjudicationVersion (int), priorVersionLink + reasonForChange (R on any status change — the prior decision is preserved [05§6]). Participants: deployment strategist, test conductor, data lead, analysis lead, system/range specialist as needed, safety authority when safety evidence involved. Cadence: end of each day and whenever new data changes a prior decision. Separation rule [13§6.9]: run validity is decided by the adjudication body; failure responsibility is decided by a separate scoring conference against pre-approved criteria (incident classes: system-fault, no-test-event, crew-error, other).

### 1.42 Deviation (DEV)

Purpose: any material difference between the approved plan/card and what occurred. Sources: [01§1.5], [07§4.9 — 13 fields], [08§1.10 red deviations].

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| deviationId | id | R | 07§4.9 |
| runAndCard | link(RUN), link(TC) | R | 07§4.9 — a deviation stays attached to the original card and run [13§1.1] |
| time (+ duration) | datetime | R | 07§4.9 (duration from 08§1.10) |
| plannedState / actualState | text ×2 | R | 07§4.9 |
| directObservation / directEvidence | text | R | 07§4.9, 08§1.10 |
| affectedVariableControlMeasureOrRule | link[]/text | R | 01§1.5, 07§4.9 |
| immediateAction | text | R | 07§4.9 |
| dataPreserved | bool/text | R | 07§4.9 |
| effectClassification | enum(none, bounded, material, unknown) | R | 01§1.5 — drives disposition |
| validityEffect | text | R | 07§4.9 |
| runDisposition | enum(repeat, analyze-with-limits, exclude) | R | 01§1.5, 07§4.9 |
| repeatNeed | text | R | 07§4.9 |
| approver | person | R | 07§4.9 |
| causeIfKnown | text | O | 08§1.10 |
| threatFeatureAffected / blueMeasuresAffected / comparisonsAffected | text | R for red deviations | 08§1.10 |
| easierOrHarderPresentation | enum(easier, harder, neutral/unknown) | R for red deviations | 08§1.10 |
| validForOtherPurpose | text | R | 08§1.10 |
| generalizationLimit | text | R | 08§1.10 |
| deviationType | enum seed (12 red types [08§1.10]) + free | O | 08§1.10 |

Rule: DEV, ANOM, CHG are three distinct record types; never one record for all three [01§1.6]. A deviation that becomes the intended method requires a new card version before the next execution [13§1.1].

### 1.43 Anomaly (ANOM)

Purpose: an unexpected observation requiring triage or diagnosis. Sources: [07§4.10 — 14 fields], [04§3.8], [13§4.6].

Fields: anomalyId (R), observation (recorded BEFORE discussing causes [04§3.8], R), timeAndSource (R), configurationThreatCondition (links, R), missionEffect (R), initialClassification (enum(system-behavior, test-infrastructure, threat-deviation, operator-action, data-artifact, unknown) [13§4.6], R), candidateCauses (R), evidenceForEachCause (R), evidenceThatDistinguishesCauses (R), preservationAction (R), diagnosticAction (R), rootCauseStatus (enum — see CausalDiagnosis, R), correctiveAction (R), verificationTest (R), ownerAndStatus (R). Rule: a vendor explanation does not close an anomaly without evidence [04§3.8].

### 1.44 Change / Adaptation (CHG)

Purpose: an approved revision to future work (card, run list, configuration, plan), preserving comparability and history. Sources merged: [01§1.6], [07§4.11 — 14 fields], [05 Part I adaptation record — 11 fields], [13§1.15 two variants], [09§1.28].

[Note: 05 calls this the "adaptation record", 07 the "change record", 13 carries both shapes. Same record type: one CHG with the merged superset. A CHG issues new versions of the records it touches.]

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| changeId | id | R | 07§4.11, 13§1.15 |
| triggeringEvidenceDefectOrConstraint | text | R | all |
| gapToResolve | text | R | 05 |
| optionsConsidered (incl. "no change") | longtext | R | 01§1.6, 05, 07 |
| selectedChangeAndReason | text | R | 07, 05 |
| variablesChanged / variablesHeld | text ×2 | R | all |
| recordsSuperseded / newVersions | link[] ×2 | R | 07§4.11, 05 ("prior and new card or plan versions") |
| comparabilityEffect | text | R | 07, 05, 13 |
| effectAssessment (safety, data, schedule, cost, acceptance; 01 adds comparability + conclusion) | struct | R | all |
| adaptationClass + approvalAuthority + maxChangeAllowedWithoutNewDesignReview | enum/link + person + text | R | 02§3.1 ("for every adaptation class, name the approver and maximum change"), 13§1.15 |
| requiredApprovals | person[] | R | all |
| effectiveTime | datetime | R | 07§4.11 |
| briefingCompleted | bool — brief affected people before use | R | 01§1.6, 07§4.11 |
| expectedDecisionValue | text | R | 05 |
| exploratoryOrConfirmatory | enum | R | 09§1.28 |
| questionAffected / configurationThreatImpact / testCardVersion | links | R | 13§1.15 (Field Guide variant) |
| resultAfterChange / resultAfterExecution | text | R post-hoc | 07§4.11, 05 |

Rule: "Never rewrite history. The old test card remains preserved." [13§1.15]. Adaptation triggers (any permits controlled replanning) [02§3.1]: evidence already answers a question; new P1 unknown; planned run no longer changes the decision; constraint change; variance different than expected; boundary requires controlled exploration.

### 1.45 CorrectionRecord

Purpose: every edit to a data value. Source: [05 Part C]. Fields: sourceValue (preserved, R), correctedValue (R), ruleAndReason (R), personAndTime (R), effectOnResults (R). Rule: raw data immutable; corrections create a new derived version [03§1.5, 11§1.11]; outlier exclusion cites a preapproved rule or reports with/without [05§2].

### 1.46 MeasureResult (run-level)

Purpose: one computed measure value for one run, with provenance. Sources: [05 Part D], [09§1.14], [10§1.6].

Fields: measureDefinitionRef (link(MeasureInstance)@version, R), runRef (link(RUN), R), startStopEventsApplied (R), truthAndAlignmentMethodApplied (R), rulesApplied (missing/censoring/ambiguity, R), computedValue (number+unit, R), measurementUncertainty (computed or stated, R), thresholdComparison + objectiveComparison (R), intermediateValuesRetained (struct, R), sourceRecordLinks (link[](RUN, CFG, THR, COND), R), resultLabel (enum(pass, miss, borderline, descriptive, unavailable) — assign ONLY when approved logic defines the label [05 Part D], R), observationStatus (enum(missing, invalid, conditionally-valid, censored, unknown-outcome, no-test) [09§1.14, 10§1.6], R). Censored observations record {observedTime, status: right-censored, reason: approved code} — never substitute the timeout [09§1.26].

Aggregation (computed, per measure across runs) [05 Part E]: individual valid results (always preserved — never hide the worst valid case in an average [02§2.3]); counts per accounting state; central tendency; spread and worst valid case; confidence/credible interval; measurement uncertainty; condition and configuration breakdown; sensitivity to exclusions; missingness pattern. Prohibitions (hard validation) [05 Part E]: never combine different configuration baselines without a stated model; different threat profiles as one condition; repeated samples as independent runs; valid and invalid evidence; pre-change and post-change without explicit comparison. Plus the 8 engine prohibitions of [09§6.11].

### 1.47 CausalDiagnosis

Purpose: structured root-cause investigation for a consequential failure or anomaly. Sources: [05 Part F], [13§3.11].

Fields: observationDefinition {time, configuration, condition, source} (R), candidateCauses across enum(component, interface, configuration, operator, environment, threat, instrumentation, data, method) (R), evidenceExpectedPerCause (R), evidenceThatDistinguishes (R), rootCauseClassification (enum(confirmed, supported, plausible, contradicted, unknown) [05] — [CONFLICT: 13§1.16 QtM lists only 4 (no `contradicted`); use the 5-value superset]), correctiveActionAndVerificationTest (R). Rule: never present a hypothesized root cause as a confirmed finding [13§3.11].

### 1.48 Finding (FIND)

Purpose: a bounded, traceable evidentiary conclusion. Sources merged: [07§4.12 — 26 fields], [05 Part G — 18 fields], [04§1.11 — 14 fields], [13§1.16].

| Field | Type | Req | Source |
| --- | --- | --- | --- |
| findingId + version | id | R | 07§4.12 |
| findingStatement (plain language) | text | R | 07, 04 |
| quantifiedResult | text | R | 04§1.11 |
| linkage: decision, question, claim, hypothesis | link(DEC, Q, CLM, HYP) | R | 07, 05 — pocket rule: no traceability, no finding |
| supportingRuns / contradictingRuns | `link[](RUN)` ×2 | R | all |
| configuration | link(CFG) exact | R | all |
| threatsAndConditions | link[](THR, COND) | R | all |
| operatorsAndProcedures | text | R | 07, 05 |
| methodAndAnalyticalVersion | text | R | 07, 05 |
| measuresAndResults | `link[](MeasureResult)` | R | all |
| thresholdComparison | text | R | all |
| sampleAndIndependence | text | R | 07, 05 |
| variabilityAndUncertainty (+confidence, measurement error) | text | R | all |
| missingAndExcludedData | text | R | 07, 05 |
| confoundersAndAlternativeExplanations | text | R | all |
| rootCauseStateIfApplicable | enum (CausalDiagnosis) | O | 07§4.12 |
| missionThreadEffect (component vs end-to-end) | text | R | 07, 05, 13 |
| strength | enum(conclusive, directional, insufficient, not-tested) | R | 07§4.12, 05 [minor conflict: 13§1.16 lists only 3 (no not-tested); superset kept] |
| ladderLevel | enum(observation, calculation, interpretation, recommendation, decision) | R | 05§6 findings ladder — never merge levels; evidence-language discipline observed-fact/analysis/inference/recommendation [13§4.5] |
| appliesTo / doesNotApplyTo | text ×2 | R | all ("performance boundary" 04§1.11) |
| assumptions (must remain true) | text | R | 07, 13 |
| evidenceLifeAndStalenessTrigger | text | R | 07§4.12, 05§3 |
| decisionImplication | text | R | all |
| customerEffect | text | R | 04§1.11 |
| recommendedAction + restrictions | text | R | 04§1.11, 07 |
| followOnOrRegressionNeed | text | R | 07, 05 (ACT link) |
| reviewersDissentApproval | struct | R | 07§4.12, 05 |
| comparisonWithPrediction | text | R | 04§1.11 |

Result chain each finding completes [04§5.4]: measured result → performance meaning → mission/customer effect → practical action → restriction/condition → next evidence need. Completeness rule [13§4.5]: every finding = configuration + condition + evidence + uncertainty + limitation.

### 1.49 Action (ACT)

Purpose: a tracked resulting action with owner and closure evidence. Sources: [06 Part F], [13§1.18].

Fields: actionId (R), decisionOwner (person, R), executionOwner (person, R), supportingOrganizations (R), fundingOrContractOwner (R), dueDate (date, R), requiredWork (configuration, procedure, training, restriction, fix, or test — text, R), evidenceNeededForClosure (R), riskIfLate (R), statusAndClosureAuthority (R), communicationRequired (operators, vendors, evaluators, leaders [13§1.18], R). Practical action-type seed enum (12) [04§1.11]. Lifecycle: open → closed | formally-transferred; tracked until then. Pocket rule: "No owner and due date, no action."

### 1.50 GroundTruthPlan

Purpose: one record per truth variable defining the independent truth source. Sources: [11§1.1-1.2], [03§1.4].

Fields [11§1.1]: truthVariable (R), measuresSupported (`link[](M)`, R), primarySource (R), backupSource (R), independenceFromSUT (justification, R — truth must not depend on the system under test [03§1.4]), deviceSourceId (R), coordinateFrameAndUnits (R), timeSource (R), updateRate (R), accuracyAndUncertainty (R — truth error must be small relative to the smallest decision-relevant effect [13§2.1]), coverage (R), calibrationOrValidation (R), failureIndicator (R), conflictRule (R — when two truth sources disagree, preserve both [03§1.4]), missingnessRule (R), fallback (R), measuresLostIfUnavailable (`link[](M)`, R). Truth domains (7) [03§1.4]: position-trajectory, identity-threat-state, event-time, configuration-state, operator-action, effect-outcome, environmental-state. Category-specific field blocks in [11§1.2] (position truth processingMode enum(real-time, post-processed, fused); identity provenance enum(measured, commanded, inferred, manually-adjudicated); effect truth: criterion defined before execution, "unknown outcome" preserved). Pocket rules: no independent truth, no performance verdict; no common time, no latency claim.

### 1.51 TimeSyncRecord

Purpose: campaign time-source declaration plus per-check log. Sources: [03§1.3], [11§1.3].

TimeSource fields [11§1.3]: authoritativeEpochAndScale, distributionMethod, devicesDisciplined (direct/indirect), holdoverBehavior, expectedOffsetJitterDrift, lossOfSourceIndication, checkMethod. SyncCheck fields [03§1.3]: maxOffsetAndDriftPerMeasure (tolerance links to M), offsetRecorded, method, device, timeOfCheck, correctionUncertainty. Recheck triggers (enum) [03§1.3]: before-rehearsal, day-start, after-power-or-network-change, after-suspected-drift, day-end. Gate rule: if time uncertainty exceeds a measure's tolerance, the run cannot support that measure [03§2.1]. Original timestamps always preserved; corrected time is a versioned derived field [11§1.3].

### 1.52 SpatialRegistration

Purpose: coordinate declarations for every positional source. Sources: [11§1.4], [10§1.16]. Fields: datum, coordinateFrame, origin, axisOrderAndHandedness, units, altitudeReference, orientationConvention, sensorReferencePoint, platformLeverArm, boresightAlignment, transformationSequence, transformationVersion (all R). Re-register after movement, impact, maintenance, remounting, suspected shift [11§6.2].

### 1.53 CalibrationRecord

Purpose: one calibration check on one instrument. Sources: [11§1.6], [10§1.17]. Fields: instrumentDeviceId, measuredQuantity, calibrationStandardOrReference, procedure, datetime, operator, asFoundResult, adjustment, asLeftResult, uncertainty, validRangeAndConditions, expirationOrNextCheck, measuresSupported (`link[](M)`) — all R. Cadence brackets the campaign [11§6.2]: pre-campaign → installation → day-start → pre-run → continuous → post-run-on-event → day-end → post-campaign.

### 1.54 AssociationGate

Purpose: the truth-to-source match rule per measure family. Sources: [11§1.5], [10§1.15]. Fields: maxTimeDifference, maxPositionOrAngularDifference, identityClassConstraints, kinematicConsistency, persistence, cardinalityBehavior (enum(one-to-one, one-to-many, many-to-one)), ambiguityState. Rule: never force a match when two truth objects fit; mark ambiguous and apply the measure's ambiguity rule.

### 1.55 DataHealthSpec

Purpose: per-critical-source monitored channels and thresholds. Sources: [11§1.9 — 17 fields], [03§1.6], [10§1.18].

Fields [11§1.9]: source (R), measuresSupported (`link[](M)`, R), mandatoryOrDiagnostic (enum, R), expectedUpdateRate (R), minimumAcceptableUpdateRate (R), maxAllowedGap (R), maxPacketRecordLoss (R), maxTimestampOffset (R), maxDrift (R), coverageRequirement (R), calibrationRequirement (R), identifierRequirement (R), storageBufferMargin (R), backup (R), warningThreshold (R), stopThreshold (R), recoveryCriterion (R). Gap/loss sub-spec [11§1.10]: maxTotalLoss, maxConsecutiveGap, maxCriticalPhaseLoss, interpolationPermitted (bool), maxInterpolationDuration, effectPerMeasure. Monitored channels seed (10) [03§1.6]. sourceState enum [CONFLICT: 03§1.6 defines 3 states (green, warning, stop); 10§1.18/11 define 5 (green, warning, stop, degraded, unknown) — use the 5-value superset; state-driven flow: green proceed; warning valid under written rule; stop hold (mandatory measure unrecoverable); degraded continue for named measures under approved fallback; unknown = stop for affected mandatory measures; every transition logged with time and source [11§6.3]]. One named person watches monitors during each run [03§1.6]. A campaign-wide average cannot replace a measure-specific limit [10§1.18].

### 1.56 DataLineageRecord

Purpose: provenance for every transformation/derived product. Sources: [03§1.5], [11§1.11]. Fields: inputFileIdsAndIntegrity (checksums where required), ingestionTime, sourceSystemVersion, schemaAndAdapterVersion, coordinateAndTimeTransformations, correlationMethod, calibrationAndRegistrationVersions, codeOrCalculationVersion, parameters, inclusionExclusionCorrectionInterpolationRules, outputFilesOrId, operator, reviewer, reviewStatus (all R). Rules: raw data immutable; corrections create new derived versions; quick-look files never become the authoritative analytical source [05§3].

### 1.57 FallbackPath

Purpose: tested degraded-mode path per critical interface/source. Sources: [03§1.7], [11§1.12]. Fields: failureIndicator, localBufferOrAlternatePath, backupInstrumentOrSource, manualExportProcedure, recoveryTime, dataLostDuringTransition, measuresPreserved (`link[](M)`), measuresLost (`link[](M)`), degradedModeAuthority, validityLimit, fallbackTestProcedure, testedStatus (bool — "a written but untested fallback is not ready"; untested blocks the readiness gate).

### 1.58 EventIdentityModel (campaign identifier registry)

Purpose: the campaign-level declaration that every system maps to common identifiers, plus reconciliation rules. Sources: [03§1.2], [11§1.7, §1.13].

Minimum identifier set (15) [11§1.7]: campaignId, cardIdAndVersion, runId, configurationId, threatProfileId, conditionId, truthObjectId (platform/object), sourceSystemId, sourceTrackId, correlatedMasterTrackId, eventId, operatorRoleId, instrumentId, fileDataProductId, transformationAnalysisVersion. Reconciliation rules (one per case) [11§1.13, 03§1.2]: duplicate source tracks, split tracks, merged tracks, reused vendor IDs, track handover, track drop/reacquisition, one-truth-to-many-source, many-truth-to-one-source, manual correlation/override, manual events. Rule: never discard source track identity when creating a master track.

### 1.59 AnalysisManifest

Purpose: the versioned, freezable list of evidence admitted to analysis plus full reproducibility state. Sources: [05 Part A], [09§1.29].

Fields: includedRunManifest (`link[](RUN)`, R), measureDefinitionVersions (R), inputFileHashesOrCustodyIds (R), transformationAndAdapterVersions (R), codeAndPackageVersions (R), parametersAndRandomSeeds (R), exclusionAndCensoringRules (R), modelFormula (R), outputTablesAndFigures (R), independentReviewResult (R), sensitivityAnalyses (R), analyticalEnvironment (R). Versioned; frozen at campaign completion before final findings [05 Part K]. Gate: only runs with a recorded validity status enter the pipeline.

### 1.60 ReliabilityIncident

Purpose: one reliability-relevant incident. Source: [09§1.27]. Fields: timeOrCyclesAtRisk, failureTime, failureMode, systemConfigurationState, missionConsequence, repairAction, returnToServiceTime, repeatOrRecurrence, scoringClassification (all R). Failure definitions frozen before execution.

### 1.61 ReviewRecord

Purpose: one of the four end-of-campaign reviews with dissent preserved. Source: [06 Part E], [13§3.12].

reviewType enum(configuration-fact, method, analytical, customer-decision) — fixed order; vendors confirm facts but do not control conclusions. Shared fields: reviewers, comments, corrections, dissent (append-only — "do not remove a valid dissent"), adjudication, methodAcceptanceStatus, evidenceAcceptanceStatus, conditionsAndReservations, finalApprovingAuthorityAndDate (all R).

### 1.62 DecisionOption and BoundedRecommendation

Purpose: decision analysis per viable option, then Valkryn's bounded recommendation. Source: [06 Part D], [13§3.12].

DecisionOption fields: optionType (enum(procure-or-select, field-with-restrictions, reconfigure, correct-defect, change-procedure-or-training, integrate-component, limited-regression, full-reevaluation, defer, reject) [06] — [minor conflict: 13§1.17 variants use procure/select-alternative/reconfigure/fix/restrict-employment/retest/defer/reject — 06's 10-value list kept as superset]), supportingEvidence, contradictingEvidence, assumptions, conditionsOfUse, tradeOffs, residualRisk, costConsequenceOfAction, costConsequenceOfDelay, additionalEvidenceRequired (all R).

BoundedRecommendation fields: recommendedAction, evidenceStrength, exactConditionsAndConfiguration, limitsAndProhibitedInterpretation, alternativesConsidered, residualUncertaintyAndRisk, authorityThatMustDecide, triggerForReconsideration (all R). Rule: "Valkryn recommends from evidence. The authorized organization decides."

### 1.63 DecisionEvidencePackage

Purpose: the customer-facing 20-section result document, generated from records. Source: [06 Part B — fixed section order], [13§4.9], gate checklist [07§3.5].

Sections 1-20 verbatim in [06§4]. Generated content pulls: run accounting (from RUN accountingState incl. excluded), claims disposition (CLM), findings (FIND), measures/thresholds (M), reproduction instructions (AnalysisManifest), acceptance record (ReviewRecord). Must pass the independent-reviewer test (7 questions [06§3]). Lifecycle: draft → reviewed (4 reviews) → accepted (method + evidence acceptance statuses + final authority/date) → delivered (9-step custody checklist [06§3]).

### 1.64 AfterActionImprovement

Purpose: one improvement from the standardized after-action review. Source: [06 Part I]. Fields: improvement (from the 9 AAR questions), owner (person, R), dueDate (date, R), destination (enum(standard-work, product-backlog), R). Timing: AAR within five working days of campaign end.

### 1.65 ReuseAsset

Purpose: a sanitized, versioned asset harvested into the controlled library. Sources: [06 Part J], [13§1.21].

assetType enum (12) [06]: decision-discovery-prompts, question-hypothesis-patterns, measure-definitions-calculation-code, threshold-rationales, threat-condition-profiles, test-cards, data-schemas-adapters, data-quality-rules, range-authority-patterns, checklists, analysis-modules-report-sections, failure-modes-corrective-actions. Metadata block (14 fields) [13§1.21]: assetId, version, originatingCampaign, missionContext, applicableConfigurations, threatScope, requiredInputs, method, assumptions, validityLimits, knownFailureModes, dependencies, owner, lastValidatedDateConfiguration. Harvest steps (8) [06§3]: de-identify → preserve validity limits → add purpose/instructions → add edge cases → cold-reader test → assign owner/review date → version into library → add to next-campaign start pack.

### 1.66 EvidenceBaseline (REG anchor)

Purpose: the exact frozen scope of accepted evidence; anchor for all later regression. Sources: [06 Part K], [13§1.19].

Fields: hardwareSoftwareFirmwareAlgorithmsModelsMissionData (R), interfacesAndSupportingSystems (R), threatClassesAndProfiles (`link[](THR)`, R), environmentsAndRanges (R), operatorsTrainingProcedures (R), measuresThresholdsMethodsAnalyticalVersions (R), assumptionsAndLimitations (R), validityPeriod (date range, R — evidence can expire; the campaign defines it [13§6.10]), evidenceAcceptanceStatus (R), findingsAndActionsSupported (link[](FIND, ACT), R). Pocket rule: "No evidence baseline, no controlled regression."

### 1.67 ChangeImpactAssessment + MinimumRegressionScope (REG)

Purpose: maps a post-baseline change to the least-cost evidence that restores confidence. Sources: [06 Part L], [13§1.19].

ChangeImpactAssessment fields: changedItemOrAssumption (link(CFG) or assumption, R), affectedLinks (interfaces, measures, findings, decisions — link[], R), changeMechanismClassification (text, R), priorEvidenceValidity (enum(remains-valid, narrows, fails), R), outcome (enum(no-effect-on-accepted-findings, applicability-narrows, analysis-only-review, simulation-or-bench-evidence, limited-live-regression, full-reevaluation), R) [13§1.19 variant collapses similar values — 06's 6-value enum kept], evidenceAuthorityAgreement (approval, R). Change triggers to assess (8 categories) [06]: software/firmware/model/mission-data update; hardware/sensor replacement; new C2/network/interface/interceptor/effector; changed detection/tracking/classification/prioritization/engagement logic; changed operator procedure/training; new site/environment/range; new threat profile/tactic; new requirement/threshold.

MinimumRegressionScope fields: findingsAndDependenciesAffected, failureMechanismIntroduced, evidenceNeededToDetect, conditionsThatMustRepeat, conditionsEstablishableByAnalysisOrSim, requiredLiveEvents, acceptanceAuthority, requiredTurnaroundTime (all R). Vocabulary [06§6]: retesting (did the fix work) ≠ regression testing (did the change damage another capability) ≠ recharacterization (new boundary map) ≠ continuous evaluation (recurring regression). Scope rule: cover affected interfaces and the mission thread, not only the changed component.

### 1.68 SuccessMetrics (campaign scorecard)

Purpose: per-campaign metric groups tracked across campaigns. Sources: [06 Part M], [13§2.6-2.7].

Three groups with exact fields in [06§1]: decisionImpact {decisionsSupported, acceptedEvidenceBeforeDeadline, uncertaintyReduction, actionsCaused, timeFinalValidRunToPackage}; evidenceQuality {safetyRegulatoryDeviations, validRunRate (valid/attempted [06§2 — denominator AMBIGUOUS in source]), dataCompleteness, reproductionSuccess, findingCountsByStrength, acceptanceReservations}; operatingLeverage {timeToFirstValidRun, setupIntegrationHours, customCodeManualWork, reuseCounts, founderDependency, personnelDaysPerValidEvidenceUnit, costMarginOnRepeat}.

### 1.69 GoNoGoDecision

Purpose: recorded gate decision at day-start and readiness events. Sources: [04§1.9], [07§1]. Fields: decision (enum(go, conditional-go, hold, no-go), R), time (datetime, R), approvers (person[], R), affectedMeasuresAndConclusions (text for open defects/waivers, R), scope (enum(daily, readiness-review, pre-run-release)). [AMBIGUOUS: 07's day-start item says only "Daily go/no-go recorded" (2 states); 04§1.9 records 4 states — use the 4-state enum everywhere.]

### 1.70 TestDecisionRecord (threat-design entry)

Purpose: frames what the threat representation must support before choosing red hardware. Source: [08§1.1]. Fields (10, all R): decisionRelevantQuestion, systemBoundary, missionThreadEvaluated, threatBehaviorThatCouldChangeAnswer, threatFeaturesToVary, threatFeaturesToHold, conditionsWhereConclusionMustApply, requiredEvidenceStrength, conclusionRepresentationMaySupport, conclusionRepresentationMayNotSupport.

### 1.71 EvidenceBoundaryLabel (annotation type)

Purpose: labels the epistemic basis of any input to a mission-thread design. Sources: [08§1.12], [09]. enum(doctrine, observed-practice, test-assumption, site-constraint, measured-result, inference) — six labels; page 08's three-kind variant (doctrine / observed-emergent-practice / test-specific-assumption) is a subset. Attach to any field or record as an annotation.

---

## 2. ID GRAMMAR AND IMMUTABILITY RULES

### 2.1 Identifier grammars

[CONFLICT — two grammars in the corpus:]

**Grammar A — unified manual pattern [01§4.2]:**

```text
VLK-<campaign>-<record type>-<sequence>-v<major>.<minor>
```

Examples (verbatim): `VLK-ALPHA-TC-014-v1.2`, `VLK-ALPHA-RUN-037` (no version), `VLK-ALPHA-CFG-003-v2.0`, `VLK-ALPHA-FIND-008-v1.0`.

**Grammar B — semantic Field Guide patterns [13§1.1]:**
`CAMP-CUAS-2026-04`, `OQ-CUAS-017`, `TC-CUAS-TRK-004-v1.2`, `CFG-BLUE-20260818-03`, `THR-G2-FW-LOW-02-v2`, `RUN-0047`, `DEV-###`; register series `OQ-001…`, `CLM-001…`, `UNK-001…`, `ASM-001…`. JIATF case adds `J401-EW-01`, `THR-G2-FW-01-v1.2` [12].

Resolution: implement Grammar A as the canonical machine identifier (deterministic: campaign scope + type code + per-type monotonic sequence + version) and allow a per-record human alias in Grammar B style. Both grammars agree on the invariants below.

### 2.2 Record type codes

From the brief and sources: CAMP, DEC, Q (alias OQ), CLM, UNK, ASM, HYP, M, CFG, THR, COND, TC, RUN, DEV, ANOM, CHG, FIND, ACT, REG. Extended internal types (this model) reuse the header but need codes: AUTH (authority matrix), APP (external approval), MTX (matrix cell), RLE (run-list entry), ADJ (adjudication), RES (measure result), DIAG (causal diagnosis), GT (ground truth), CAL, SYNC, DH (data health), LIN (lineage), FBK (fallback), CHK (checklist instance), RR (readiness review), WVR (waiver), HAZ, EVT (run event), MAN (analysis manifest), REV (review), PKG (evidence package), AAR, ASSET, EB (evidence baseline), CIA (change impact), MRS (regression scope).

### 2.3 Versioning rules (unified)

- **Major version** (`v2.0`): changes decision logic, variables, measures, thresholds, configurations, procedures, validity, or applicability [01§4.2]. For cards: version changes ONLY when the planned method changes [13§1.1, 13§6.9].
- **Minor version** (`v1.2`): improves clarity without changing meaning or execution [01§4.2].
- **New record vs new version:** a change that alters what the record IS (a different threat presentation that can alter blue performance [08§1.2]; a configuration change affecting behavior/data/safety/comparability/applicability [01§3.1]; two factors changing together = a NEW condition, not a repeat [02§6.4]) creates a new record. A revision of the same intent creates a new version.
- **Runs are versionless.** RUN identifiers carry no version suffix [01§4.2].
- **Threshold changes:** a post-result threshold change is a NEW decision rule and must not overwrite the original assessment [02§6.4].
- **Adjudication versions:** a changed run status creates a new adjudication version; prior decision and reason preserved [05].
- **Corrections:** raw data immutable; every correction preserves the source value and creates a derived version [05, 11§1.11].

### 2.4 Never-renumber / never-edit rules

1. A run identifier never changes; an invalid run remains in sequence (no renumbering); never reuse a run number; never overwrite a run [01§4.2, 13§1.1].
2. Issued cards are frozen until the run ends; the team never edits the card to match what occurred — differences become DEV records [04§4.4].
3. A deviation stays attached to the original card and run; if the deviation becomes the intended method, issue a new card version before the next execution [13§1.1].
4. "Never rewrite history. The old test card remains preserved." [13§1.15]. Superseded records are versioned, never overwritten [07§8].
5. The run list is never edited in place; replanning issues a superseding version linked to a CHG record [05§6].
6. Invalid data are flagged, never deleted; the authenticated data set is a flagged view of the raw data [13§3.15].
7. Dissent is append-only [06 Part E].
8. Raw files carry campaign, card, run, source, and creation time in name or metadata; the controlled campaign repository is the system of record (not chat/email) [01§4.2].
9. Freeze-before-execution list [10§6.8, 09§6]: thresholds; pass/fail and acceptance criteria; measure event/denominator/truth/missing-data/validity/uncertainty rules; classification class set and "unknown" treatment; mission-capable definition and downtime accounting; failure definitions; latency start/stop/time source/window/censoring; Bayesian priors and cutoffs; primary vs exploratory comparison labels; sequential-design boundaries and maximum sample.

---

## 3. TRACEABILITY CHAIN

### 3.1 Canonical chain (mandatory, verbatim [02§6.1])

```text
Decision (DEC)
→ Question (Q)
→ Claim or Unknown (CLM/UNK)
→ Hypothesis (HYP)
→ Measure (M)
→ Required data and ground truth (MeasureToDataMap, GroundTruthPlan)
→ Condition and Threat (COND, THR)
→ Test event (TestMatrixCell → TC)
→ Run (RUN)
→ Finding (FIND)
→ Decision implication (→ Action ACT)
```

Rule: "An activity without this chain is out of scope." Variants that agree in substance: [04§6.1] adds test object, method, prediction, and practical action; [13§4.3] evidence-chain template adds comparison method and decision threshold; [12§6.2] decision-backward planning. The 07§4.3 traceability record (17 fields) is the join table: decisionIdAndStatement, questionIdAndWording, priority, claimOrUnknownId, hypothesisId, primaryMeasureIds, diagnosticMeasureIds, requiredDataAndGroundTruth, threatAndConditionIds, plannedCardIds, actualValidRunIds, findingIds, claimDisposition, decisionImplication, remainingGap, owner, status.

### 3.2 Required links per record (enforced)

| Record | Must link to | Rule/source |
| --- | --- | --- |
| Q | DEC | 02§1.1 |
| CLM/UNK/ASM | Q or DEC | 01§1.15-1.16 |
| HYP | Q (+ CLM when disposing a claim) | 02§1.2 |
| M (instance) | DEC + Q + HYP + mission task + matrix cell — ALL required | 09§1.1 |
| TC | DEC + Q + CLM + HYP + M + matrix cell | 04§4.1 f2, 07§4.7 S2 |
| RUN | exactly one issued TC@version; ≥1 Q ("no orphan runs") | 04§4.4, 13§4.3 |
| RUN (intake) | confirmed TC, RUN, CFG, THR, COND, operator, method IDs + validity status | 05 Part A |
| MeasureResult | MeasureInstance@version + RUN + source links (CFG, THR, COND) | 05 Part D |
| FIND | DEC + Q + CLM + HYP + supporting/contradicting RUNs + exact CFG + THR/COND + method version | 05 Part G — "No traceability, no finding" |
| ACT | FIND (or package) + owner + due date | 06 Part F |
| EvidenceBaseline | FINDs + ACTs supported | 06 Part K |
| ChangeImpactAssessment | changed CFG/assumption → affected interfaces, M, FIND, DEC | 06 Part L |
| Every run | active CFG baseline (link every run to the baseline; verify before each run) | 01§3.1 |

### 3.3 Chain-health checks (renderable dashboard)

The nine-question Deployment Strategist Standard [13§3.2] and the ten continuous control questions [13§3.3] are live traceability health checks. Design lint (12 warnings) [04§3.13] includes: question without measure; measure without usable source; measure without independent truth; uncontradictable hypothesis; threshold without basis; multi-factor comparison; pseudo-replication; no baseline/control; insufficient repetitions; order bias; card missing measure data; test cannot answer the question.

---

## 4. WORKFLOW STATE MACHINE

### 4.1 Controlled-record states (all controlled records)

```text
draft → in-review → approved → issued → (superseded | withdrawn)
                                   ↓
                                 closed  (when all required actions complete)
```

Definitions [01§1.3]: draft = may change without approval; in-review = named reviewers checking; approved = accountable authority accepts; issued = released for use; superseded = newer issued version replaces; withdrawn = owner removed from use; closed = all required actions complete.

### 4.2 Campaign phase machine and gates

Phases (manual 00-06 = QtM lifecycle FRAME → DESIGN → EXECUTE & LEARN → DECIDE → INSTITUTIONALIZE):

```text
intake → 00 control → 01 qualification → 02 evidence design → 03 integration/readiness
       → 04 execution (day loop) → 05 analysis/adaptation (interleaved with 04)
       → 06 decision evidence → closeout → (follow-on / regression program)
```

Gate sequence (13§6.2, blocking transitions):

| Gate | Blocks entry to | Pass condition (source) |
| --- | --- | --- |
| Control gate | phase 01+ | every decision type has one accountable authority; every record has an owner; configuration process can reconstruct each run; stop/restart/change/escalation paths known [01§3.6] |
| Qualification gate | evidence design | gate statement completable: decision, date, accepting org+conditions, reducible uncertainty, feasibility [01§3.7, 13§3.5] |
| Definition gate | evidence design detail | mission thread explicit; boundary and baseline reconstructable; claims map to testable hypotheses; failure modes visible; conditions defined [13§3.6] |
| Design gate / design approval | implementation (03) | every P1 question has a defensible evidence path; measures reproducible; thresholds have accepted rationale; threats/conditions support conclusion; repetition supports strength; evidence authority accepts method [02§3.2, 13§3.7] |
| Technical integration gate | range execution prep | complete evidence chain passed rehearsal OR every deficiency has owner, disposition, explicit conclusion effect [13§3.8, 11§6.2] |
| Campaign plan gate | readiness review | environment supports bounded conclusions; authorities on track; scope/resources/schedule executable; gaps mitigated [13§3.9] |
| Readiness reviews (5) | live runs | design → integration → range → test → daily; outcome go/conditional-go/hold/no-go; six readiness-gate conditions [03§3.5, §6.2] |
| Execution gate (per run) | campaign analysis | run enters analysis only when adjudicated: what occurred, which controls held, which data valid, which measures may use it, which conclusions prohibited [04§6.4, 13§3.10] |
| Analysis-complete gate | findings export | every decision-relevant result reproducible; findings traceable; uncertainty/alternatives explicit; applicability bounded; every gap has stated decision effect [05§3] |
| Decision-ready gate | customer decision | decision-maker can answer the 7 decision-ready questions [13§3.12] |
| Closeout gate | campaign closed | customer has accepted evidence+limits; every action owned; custody correct; sites restored; lessons/assets owned; changes map to defensible regression [06§3] |
| Follow-on gate | new scope | next scope supports a real decision, defensible change-to-evidence logic, committed owner, strengthens leverage [13§3.14] |

### 4.3 Card lifecycle

```text
draft (from approved design)
→ reviews: test conductor → engineering/system owner → red lead → data+analysis leads
           → safety authority → range/airspace/spectrum/security/legal
→ cold-reader test (qualified non-author)   [fail → correct → repeat]
→ dry run (all people, systems, truth, recorders)  [fail → correct → repeat]
→ approvals obtained → ISSUED (execution version, frozen until the run ends)
→ superseded (only via end-of-day CHG issuance) | withdrawn
```

[04§4.3 — 13 steps.] A card failing cold-reader or dry-run is not ready. One issued card controls one run type. Editing an issued card is blocked; changes route through CHG at end-of-day [04§6.4].

### 4.4 Run states

Two orthogonal axes (do not merge):

1. **Lifecycle/accounting:** `planned → attempted → (adjudicated) → [excluded]` — accounting categories: planned, attempted, valid, conditional, invalid, excluded [06 Part B]; per-measure opportunity pipeline adds `eligible` [09§6.4].
2. **Validity adjudication (versioned):** `pending → valid | conditionally-valid | invalid` — conditionally-valid MUST list allowed and prohibited uses; no status = not available for analysis [04§1.8]. Re-adjudication creates a new version [05].

### 4.5 Day-of-test rhythm (execution-day loop)

```text
DAY START [04§3.1: site+authority → people → systems/config → instrumentation/data
           → go/no-go (4-state, recorded with time+approvers)]
  └─ per run:
     PRE-RUN RELEASE (challenge-and-response; any unknown answer = HOLD;
                      test conductor releases) [04§3.2, 07§3.3]
     → RUN INITIATION (10 ordered steps; recorder pre-event margin) [04§3.3]
     → IN-RUN CONTROL (conductor sequence; logger time-tags; data monitor watches;
                       strategist guards variables) [04§3.4]
        ├─ safety/regulatory stop [04§3.5] → restart only when named authority
        │  clears cause AND card restart criteria pass
        ├─ data-quality/equipment stop [04§3.6] → degraded-operation approval when required
        ├─ procedure deviation [04§3.7] → never edit the card; adjudicate after
        └─ anomaly response [04§3.8] → preserve → record before causes → quarantine → ANOM
     → RUN COMPLETION (post-event margin; stop recorders in written order;
                       save+lock run log) [04§3.9]
     → IMMEDIATE FACTUAL DEBRIEF (≤10 minutes; observations only; no campaign
                       conclusions) [04§3.9-3.10]
     → POST-RUN DATA VALIDATION (11 checks) → assign run status
                       [dependent next run blocked until done] [04§3.11]
     → RUN EVIDENCE PACKAGE [04§5.2]
     → quick-look + next-run recommendation (accept / repeat / continue /
       hold-for-data / add-diagnostic / stop-sufficient) — user decides [04§5.3]
END OF DAY [04§3.12: reconcile runs → statuses → calibration/clock checks →
            dual-copy backup → secure data → RUN-VALIDITY BOARD →
            DAILY EVIDENCE REVIEW (5 steps [05§3]; 14-item agenda [07§3.4]) →
            re-rank next-day run list → issue approved card/plan changes (CHG) →
            brief next-day first-run conditions → secure site]
```

Daily evidence review step 5 selects exactly one next action from 9 options [05§6]: execute next issued card; repeat for validity/stability; isolate one variable; repair evidence chain; revise threat/condition within policy; introduce diagnostic card; stop low-value line; end for sufficiency; end for futility. A plan-changing selection generates a CHG.

Battle rhythm anchors [01§6.5]: weekly campaign control review (pre-deployment); daily planning brief; formal day-start go/no-go; pre-run brief; immediate post-run debrief; end-of-day validity and evidence board; final method/finding/acceptance reviews.

### 4.6 Stop/hold/repeat/adapt triggers (day-of rules engine)

Four verbatim trigger lists from [02§3.1]: stop-immediately (8 triggers), hold-before-next-run (6), repeat (5 — run invalid), adapt (6 — controlled replanning permitted). Stop rules separated by authority [13§3.7]: safety/regulatory (safety plan), data-quality, equipment, evidence-sufficiency, futility, resource. Sufficiency stop requires ALL five conditions; futility stop requires ANY of four [05§3, 10§6.6]. Minimum rule: never stop because the current result is favorable; never continue only because range time remains [10§6.6].

### 4.7 Blocking rules index (which gates block which actions)

The 11 pocket rules [07§6] as hard validations: no decision owner → no campaign; no accepted method → no evaluation claim; no configuration record → no comparison; no independent truth → no performance verdict; no common time → no latency claim; no issued card → no live run; no data-quality decision → no analysis; no traceability → no finding; no stated limit → no defensible generalization; no owner+due date → no action; no evidence baseline → no controlled regression. Plus: unstatused run → excluded from analysis [04§1.8]; untested fallback → readiness gate blocked [03§1.7]; time uncertainty beyond measure tolerance → run cannot support that measure [03§2.1]; P1 measures must compute from rehearsal data before live execution [03§2]; undisposed CLM/Q → closeout blocked [06§8]; prediction stated before test → post-hoc result-hunting prohibited [04§6.4].

---

## 5. MAPPING TO EXISTING RANGEBOARD TYPES

Source: `/Users/caseytalbot/Projects/rangeboard/src/model/types.ts` (328 lines, read 2026-08-19).

| Unified record | Mapping | Detail |
| --- | --- | --- |
| Campaign (CAMP) | **NEW** | No campaign concept exists. `Scenario` is a map/library document, not a campaign; a Campaign should reference one or more Scenarios. |
| RoleAssignment | **NEW** | No people/role model exists. |
| AuthorityMatrixEntry / AuthorityApproval | **NEW** | — |
| ControlledRecordHeader | **NEW** (base) | `newId(prefix)` exists but is timestamp-based; the §2 grammar needs a per-campaign, per-type monotonic sequence generator — NEW, keep `newId` for non-controlled UI objects. |
| DecisionCharter, Question, Claim, Unknown, Assumption, Hypothesis | **NEW** | `TestCard.questionIds`/`customerQuestion`/`hypothesis` are free strings today; they become typed links to these records. |
| MeasureDefinition / MeasureInstance / Threshold | **NEW** | `TestCard.measures: string[]` and `thresholds: string` become `link[](MeasureInstance)`. `McdaVector`/`ScorecardSnap` stay as the map-planning scorecard — distinct from T&E measures; ALREADY COVERED for their own purpose. |
| EvidenceSource, MeasureToDataMap, GroundTruthPlan, TimeSync, SpatialRegistration, Calibration, AssociationGate, DataHealthSpec, DataLineage, FallbackPath, EventIdentityModel, AnalysisManifest | **NEW** | No instrumentation/data plane exists. |
| TestObject | **EXTENDS `SpecModel`** | `SpecModel` (id, name, kind, sensor/uas/effector specs) covers manufacturer-model identity for library items; TestObject adds hw/sw/fw versions, configuration link, training state, prior results, comparison baseline. Model TestObject as NEW record with optional `specModelId` link into the existing library. |
| ThreatProfile (THR) | **EXTENDS `ThreatProfile` + `UasSpec` + `FormationSpec`** | Existing `ThreatProfile` {designator, routeIntent, altitudeFt, speedMps, count} and `UasSpec` {group, airframe, cruise/max speed, endurance, altBand, navMode (gps/inertial/rf-manual/optical/fiber/mixed ≈ guidance-mode enum), emissionsNote, control-link/operating/combat radius, oneWay} and `FormationSpec` {count, shape, spacingM} already carry the kinematic/nav/raid core. The unified THR wraps them and adds: versioned id, threat mission enum, representation class, FidelityAssessment[], emissions/signature block, adaptation trigger-response pairs, red-operator state, control bounds, blinding, validation, generalization limits, profileClass. |
| Condition (COND) | **EXTENDS `EnvironmentSpec`** | Existing {wind, temperature, fieldElevationFt, precipitation(clear/rain/fog), light(day/night), emBackground(rural/urban), apply} covers weather/illumination/EM background. COND adds: id+version, terrain/clutter, network state, background traffic, workload, operator state, supporting systems, degraded modes, contested-spectrum sub-record, C2-degradation states, generalization bounds. |
| ConfigurationBaseline (CFG) | **NEW**, snapshots existing state | A CFG should capture a frozen snapshot of `Scenario` layout (entities+specs+connections+`SystemPreset` placements+environment) plus the 28 record fields (serials, versions, release, freeze). `SystemPreset`/`SystemComponent` are the composable architecture pieces a CFG references — ALREADY COVERED as building blocks. |
| MissionThread / ThreadTransition | **EXTENDS `Connection`** | `Connection` {fromId, toId, label} is the kill-chain edge on canvas. ThreadTransition adds the 8 evidence fields per edge; MissionThread is a NEW ordered wrapper (12-node template) that can bind to existing entity connections. |
| SystemBoundary | **NEW**; `Boundary` (geometric range/restricted/asset/corridor polygons) is a different concept — geometric boundaries feed RangeFitAssessment, not SystemBoundary. | [Not supplied in source] |
| FailureMode, FeasibilityItem, Factor, QuantDesignRecord | **NEW** | `TestCard.independentVars/controlledVars/covariates` strings become Factor links. |
| TestMatrixCell / RunListEntry | **NEW** | — |
| TestCard (TC) | **EXTENDS `TestCard`** | Existing 19 fields map to unified sections: cardId/version→S1; campaign/questionIds→S2 (typed); customerQuestion→S2/Q link; purpose→S3; hypothesis→S2 HYP link; configuration→S5 CFG link; threatProfile→S6 THR link; independentVars/controlledVars/covariates→S8; measures→S9; procedure: string[]→ProcedureStep[] (S12); thresholds→S9; abortCriteria→S14; expectedResults→S13; linkedEntityIds→keep (canvas link); runs→RUN records. ADD: status/lifecycle, owner/approvers, matrix cell, repetition, preconditions (S11), data+truth (S10), validity/repeat (S15), outputs (S16), deviation area (S17), blinding, site-approved calls, recording margins. |
| Run (RUN) | **EXTENDS `RunLogEntry`** | Existing {id, runId, validity: RunValidity('valid' \| 'valid-limited' \| 'invalid' \| 'pending'), result, deviations: string}. `RunValidity` maps 1:1 to the unified enum (`valid-limited` = `conditionally-valid`) — rename or alias; ADD the other ~24 run fields; `deviations: string` becomes `link[](DEV)`; add accountingState (with `excluded`), allowed/prohibited uses, adjudication links, immediate debrief struct. |
| RunEvent | **EXTENDS `FrameSnap`/playback concepts loosely — treat as NEW** | Timeline playback (`simTimeS`) exists for simulation; run events are real-world timestamped records. NEW. |
| RunAdjudication, Deviation, Anomaly, Change (CHG), CorrectionRecord, MeasureResult, CausalDiagnosis, ReliabilityIncident | **NEW** | — |
| Finding (FIND), Action (ACT) | **NEW** | — |
| ChecklistInstance, ReadinessReview, GoNoGoDecision, DeficiencyWaiver, HazardRecord, ContingencyRecord, SecurityDataRights, ScheduleWorkstream | **NEW** | — |
| RangeFitAssessment | **NEW**, consumes existing `Boundary`, `EnvironmentSpec`, and sensor/effector coverage analysis as evidence inputs. | [Not supplied in source] |
| ReviewRecord, DecisionOption, BoundedRecommendation, DecisionEvidencePackage, AfterActionImprovement, ReuseAsset, EvidenceBaseline, ChangeImpactAssessment, MinimumRegressionScope, SuccessMetrics | **NEW** | Reuse library naturally extends the existing `builtin` flag pattern on `SpecModel`/`SystemPreset` (library vs campaign instances). |
| OpforExecutionMode, InfoLearningControls, RealismConstraint, FidelityAssessment, TestDecisionRecord, ThreatCoverageMatrix | **NEW** | ThreatCoverageMatrix rows can seed from existing `SpecModel.uas` library entries (UasGroup 1-5 already modeled; sources require Groups 1-3 minimum). |
| Scenario | **ALREADY COVERED**, gains `campaignId?` back-link; a CFG snapshot references a Scenario state. | [Not supplied in source] |
| EnvironmentSpec, EngagePolicy, SensorSpec/EffectorSpec, FlightPath, Entity | **ALREADY COVERED** for the map/planning plane; they become evidence inputs (e.g., FlightPath → planned threat route on the card; engagement analysis → mission-arithmetic timeline seeds [02§2.1]). | [Not supplied in source] |

Schema note: `Scenario.schemaVersion: 1` must bump when campaign records join the persisted model; the T&E plane should persist as its own store keyed by campaign, referencing scenarios, not embedded inside `Scenario`.

---

## 6. OPEN CONFLICTS AND AMBIGUITIES (index)

1. [CONFLICT] Test-card structure: 20 ordered fields [04§4.1] vs 17 numbered sections [07§4.7] vs flat template [13§4.1]. Resolved by mapping (§1.38); blinding placement differs (own field vs inside Threat state).
2. [CONFLICT] Decision-type enum: 17 [01§1.2] vs 22 [07§4.2]. Superset 22 adopted.
3. [CONFLICT] Run validity enum: 5 spellings (04/07/05/13/types.ts). Unified: valid | conditionally-valid | invalid | pending; `excluded` moved to accounting.
4. [CONFLICT] Threat representation class: 3 values [02/07/13] vs 5 [08§1.3]. Superset 5 adopted.
5. [CONFLICT] Fidelity enum: 4 values [02§1.6, 08§1.4] vs 3 [13§1.7]. Superset 4 adopted.
6. [CONFLICT] Factor taxonomy: 4-class [02/04] vs 5-class [13] vs 6-class red [08§1.6]. Unified 7-value enum + confounder flag.
7. [CONFLICT] Root-cause classes: 5 [05] vs 4 [13§1.16]. Superset 5 adopted.
8. [CONFLICT] Finding strength: 4 values [07/05] vs 3 [13§1.16]. Superset 4 adopted.
9. [CONFLICT] Data-source health states: 3 [03§1.6] vs 5 [10§1.18, 11]. Superset 5 adopted.
10. [CONFLICT] ID grammar: VLK unified pattern [01§4.2] vs semantic patterns [13§1.1]. Dual-layer resolution (§2.1).
11. [CONFLICT] Range-fit classification: 5 values [03§1.8] vs 4 [13§3.9]. Superset 5 adopted.
12. [CONFLICT] Decision-option enum: 10 values [06] vs 8 [13§1.17 two variants]. Superset 10 adopted.
13. [CONFLICT] THR+COND: one combined 29-field form [07§4.6] vs separate records [02, 08]. Separate records; combined form is layout.
14. [AMBIGUOUS] Daily go/no-go: 2-state [07§3.2] vs 4-state [04§1.9]. 4-state adopted.
15. [AMBIGUOUS] Unknown-ranking scale, run-priority weighting, next-event scoring: no numeric scales defined anywhere — model as manual ordinal rank / H-M-L per criterion, never a hard-coded formula [01§2.1, 02§2.4, 05§2, 13§2.2].
16. [AMBIGUOUS] Whether feasibility score `infeasible` auto-fails the qualification gate [01§6.7].
17. [AMBIGUOUS] Valid-run-rate denominator (attempted assumed) and "valid evidence unit" definition [06§2].
18. [AMBIGUOUS] AuthorityApproval status value set — mechanism given, values inferred [03§1.9].
19. Intentional overlap: QtM lifecycle pages vs manual sections carry the same records as question sets vs procedures — merged here, not duplication error [13 endnote].

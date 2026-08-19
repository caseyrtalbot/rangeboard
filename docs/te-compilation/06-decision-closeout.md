# 06 — Decision Evidence, Closeout, Regression & Reuse

## Sources fetched

- "06 — Decision Evidence, Closeout, Regression & Reuse" — https://app.notion.com/p/e50a083593db4a8baf6a6841bfa97aec
  (No sub-pages are linked inside this page. Parent pages belong to the manual root and are out of scope.)

## 1. Input variables & fields

### Claim disposition record (Part A)
One record per registered claim (CLM). Field: **Claim state** (enum, exactly one):
- Supported
- Contradicted
- Directionally supported
- Inconclusive
- Untested
- Outside scope

### Question disposition record (Part A)
One record per registered question (Q). Field: **Question state** (enum, exactly one):
- Answered at the accepted evidence strength
- Partially answered with a named gap (requires: named gap, text)
- Not answered with a reason and path (requires: reason, text; path, text)

Each disposition must also classify the **evidence level** the finding applies to (enum):
- Component behavior
- Interface behavior
- Performance under tested mission conditions
- End-to-end mission effect

### Decision-analysis option record (Part D)
One record per viable option. Fields (all text unless noted):
- Supporting evidence
- Contradicting evidence
- Assumptions
- Conditions of use
- Technical and operational trade-offs
- Residual risk
- Cost and consequence of action
- Cost and consequence of delay or inaction
- Additional evidence required

**Option type** (enum, from the manual's option list):
- Procure or select
- Field with restrictions
- Reconfigure
- Correct a defect
- Change procedure or training
- Integrate another component
- Conduct limited regression
- Conduct full reevaluation
- Defer
- Reject

### Bounded recommendation record (Part D)
Fields:
- Recommended action
- Evidence strength
- Exact conditions and configuration
- Limits and prohibited interpretation
- Alternatives considered
- Residual uncertainty and risk
- Authority that must decide
- Trigger for reconsideration

Rule attached to this record: "Valkryn recommends from evidence. The authorized organization decides."

### Review record (Part E)
Fields recorded for the review process:
- Reviewers
- Comments
- Corrections
- Dissent
- Adjudication
- Method acceptance status
- Evidence acceptance status
- Conditions and reservations
- Final approving authority and date

Rule: "Do not remove a valid dissent to make the package appear unanimous."

### Action record (Part F)
One record per resulting action (ACT). Fields:
- Action identifier
- Decision owner
- Execution owner
- Supporting organizations
- Funding or contract owner
- Due date (date)
- Required configuration, procedure, training, restriction, fix, or test
- Evidence needed for closure
- Risk if late
- Status and closure authority

Rule: track actions until closed or formally transferred.

### After-action improvement record (Part I)
One record per improvement. Fields:
- Owner
- Due date (date)
- Destination (enum-like: standard work or product backlog)

### Reuse asset record (Part J)
One record per harvested asset. Asset **type** (enum, from the harvest list):
- Decision and discovery prompts
- Question and hypothesis patterns
- Measure definitions and calculation code
- Threshold rationales
- Threat and condition profiles
- Test cards
- Data schemas and adapters
- Data-quality rules
- Range and authority patterns
- Checklists
- Analysis modules and report sections
- Failure modes and corrective actions

Per-asset fields (implied by the harvest steps): purpose and use instructions; known edge cases; validity limits; owner; review date; version.

### Evidence baseline record (Part K)
Fields defining the exact scope of accepted evidence:
- Hardware, software, firmware, algorithms, models, and mission data
- Interfaces and supporting systems
- Threat classes and profiles
- Environments and ranges
- Operators, training, and procedures
- Measures, thresholds, methods, and analytical versions
- Assumptions and limitations
- Validity period
- Evidence-acceptance status
- Findings and actions supported

### Change-impact assessment record (Part L)
Fields:
- Changed configuration item or assumption (link to CFG or assumption)
- Affected interfaces, measures, findings, and decisions (links)
- Change mechanism classification
- Prior-evidence validity assessment (enum: remains valid / narrows / fails)
- **Change-impact outcome** (enum, exactly one):
  - No effect on accepted findings
  - Applicability narrows
  - Analysis-only review required
  - Simulation or bench evidence required
  - Limited live regression required
  - Full reevaluation required
- Evidence-authority agreement (approval field)

**Change triggers to assess at minimum** (checklist-style enum of change categories):
- Software, firmware, model, or mission-data update
- Hardware or sensor replacement
- New C2, network, interface, interceptor, or effector
- Changed detection, tracking, classification, prioritization, or engagement logic
- Changed operator procedure or training
- New site, environment, or range
- New threat profile or tactic
- New requirement or threshold

### Minimum regression scope record (Part L)
Fields:
- Findings and dependencies affected
- Failure mechanism introduced by the change
- Evidence needed to detect that mechanism
- Conditions that must repeat
- Conditions that can be established by analysis or simulation
- Required live events
- Acceptance authority
- Required turnaround time

### Follow-on success metrics (Part M)
Three metric groups, each a set of tracked fields:

Decision impact:
- Decisions supported (count)
- Accepted evidence delivered before deadline (count or rate)
- Reduction in decision uncertainty
- Actions caused by evidence (count)
- Time from final valid run to decision-ready package (duration)

Evidence quality:
- Safety and regulatory deviations (count)
- Valid-run rate (ratio)
- Data completeness
- Reproduction success
- Conclusive, directional, insufficient, and untested findings (counts per state)
- Acceptance reservations (count)

Operating leverage:
- Time to first valid run (duration)
- Setup and integration hours (hours)
- Custom code and manual data work
- Reuse of cards, adapters, schemas, measures, and reports
- Founder or expert dependency
- Personnel days per valid evidence unit
- Cost and margin on repeat work

## 2. Calculations & formulas

No explicit formulas appear in this section. The following derived quantities are required and must be computable from existing run records:

- **Run accounting** (Part B item 8): counts of runs per state — planned, attempted, valid, conditional, invalid, and excluded. Inputs: RUN records with state. Output: one count per state. Computed when the decision evidence package is built.
- **Valid-run rate** (Part M): valid runs divided by attempted runs. [AMBIGUOUS: denominator not stated; attempted is the most consistent reading given the Part B run states.]
- **Time from final valid run to decision-ready package** (Part M): timestamp of package acceptance minus timestamp of the last valid run.
- **Time to first valid run** (Part M): timestamp of the first valid run minus campaign start. [AMBIGUOUS: start point not defined in this section.]
- **Personnel days per valid evidence unit** (Part M): personnel days divided by valid evidence units. [AMBIGUOUS: "valid evidence unit" is not defined in this section.]

## 3. Checklists

### Independent-reviewer test (Part B)
An independent reviewer must be able to answer, for the decision evidence package:
- What happened?
- How was it measured?
- Which runs support it?
- Which exact conditions apply?
- How uncertain is it?
- What must not be inferred?
- What action follows?
Phase: package review, before acceptance. Run by: independent reviewer.

### Architecture and mission assessment checklist (Part C)
Assess:
- Best-performing configuration by threat and condition.
- Warning, decision, assignment, effect, and assessment time budgets.
- Coverage gaps.
- Interface and semantic failures.
- Operator workload and procedural effects.
- Single points of failure.
- Resilience and recovery.
- Trade-offs among performance, complexity, cost, safety, spectrum, sustainment, and mission risk.
- Whether one component compensates for another's weakness.
- Residual threat after the tested effect.
Rule: separate observed architecture behavior from assumed behavior outside the evaluated boundary.
Phase: post-experiment analysis. Run by: analyst / evidence team.

### Delivery and custody checklist (Part G)
Before delivery:
1. Confirm the recipient list and need to know.
2. Mark each file correctly.
3. Confirm permitted vendor and comparative-result content.
4. Confirm checksums or custody records when required.
5. Confirm delivery media and encryption.
6. Test that the recipient can open the package.
7. Record transfer and receipt.
8. Record corrections as new versions.
9. Archive the accepted version.
Phase: delivery. Run by: campaign lead / data custodian. Conditional logic: item 4 applies "when required."

### Campaign closeout checklist (Part H)
Deliverables:
- Deliver all contractual products.
- Record acceptance, reservations, and open items.
- Transfer actions to named owners.

Data and knowledge:
- Archive raw and processed data.
- Archive code, schemas, configurations, methods, cards, logs, findings, and approvals.
- Verify that analysis can be reproduced.
- Verify that the tested configuration can be reconstructed.
- Apply retention and deletion rules.
- Review permissions.

Operations and property:
- Restore sites and networks.
- Return systems, instruments, media, tools, and credentials.
- Close damage, maintenance, safety, security, and property records.
- Transfer unresolved items.

Commercial and customer:
- Confirm final invoice and contract actions.
- Record customer outcome and next decision.
- Record approved vendor feedback.
Phase: campaign closeout. Run by: campaign lead.

### After-action review question set (Part I) — the standardized debrief
Timing rule: conduct within five working days while details remain current.
Ask:
- What created decision value?
- What produced invalid runs or delay?
- Which assumptions failed?
- Which authority or acceptance issue arrived late?
- Which interface or data failure repeated?
- Which control was too heavy or too weak?
- Which work depended on one person?
- Which task should be standardized, automated, trained, redesigned, or removed?
- What must change before the next campaign?
Closure rule: assign each improvement an owner, due date, and destination in standard work or product backlog.
Phase: post-campaign. Run by: whole team, facilitated.

### Reuse-harvest steps per asset (Part J)
For each asset:
1. Remove campaign-specific identifiers.
2. Preserve validity limits.
3. Add purpose and use instructions.
4. Add known edge cases.
5. Run the cold-reader test.
6. Assign owner and review date.
7. Version it into the controlled library.
8. Add it to the next-campaign start pack.
Phase: post-campaign. Run by: asset owner / campaign lead.

### Change-impact and regression process (Part L)
When any relevant item changes:
1. Identify the changed configuration item or assumption.
2. Link it to affected interfaces, measures, findings, and decisions.
3. Classify the change mechanism.
4. Assess whether prior evidence remains valid, narrows, or fails.
5. Select the least costly evidence that restores confidence.
6. Obtain evidence-authority agreement.
7. Execute the regression plan.
8. Update the evidence baseline.
Phase: any time after baseline, triggered by change. Run by: evidence authority + analyst.

### C-UAS regression assessment checklist (Part L example)
If the prior baseline established detection, stable tracking, C2 handoff, interceptor assignment, and engagement timing, assess the changed system against:
1. Detection range.
2. False-alarm rate.
3. Track continuity.
4. Track-to-ground-truth accuracy.
5. Radar-to-C2 handoff.
6. Total engagement time.
7. Performance under RF or GPS disruption.
Rule: a component-level pass does not establish that the end-to-end mission thread remains supported. The assessment must cover the affected interfaces and mission thread, not only the changed component.

### Closeout gate (final)
The campaign is closed only when:
- The customer has the accepted evidence and limits.
- Every action has an owner.
- All data and records have the correct custody.
- Sites and property are restored.
- Lessons and assets have owners.
- Future changes map to a defensible regression decision.

## 4. Templates, forms & cards

### Decision evidence package template (Part B) — 20 ordered sections
Use this order:
1. Decision, owner, alternatives, and deadline.
2. Decision-critical uncertainty.
3. Executive answer and bounded recommendation.
4. Mission, system boundary, and configuration.
5. Threats, conditions, operators, procedures, and range representation.
6. Approved questions, hypotheses, measures, thresholds, and design.
7. Evidence-acceptance conditions.
8. Run accounting: planned, attempted, valid, conditional, invalid, and excluded.
9. Primary findings.
10. Supporting diagnostic findings.
11. Architecture and mission-thread assessment.
12. Uncertainty, limitations, dissent, and unresolved gaps.
13. Claims disposition.
14. Alternatives and trade-offs.
15. Recommended action, restrictions, and residual risk.
16. Retest and evidence-refresh triggers.
17. Raw-to-result reproduction instructions.
18. Data delivery, classification, distribution, retention, and deletion.
19. Action plan.
20. Acceptance record.

Layout intent: fixed section order; the executive answer sits at position 3, before the detailed evidence; provenance and custody sections close the document. This is the customer-facing result package.

### Four-review form set (Part E)
Four separate review forms, each with its own reviewer role and scope:
1. **Configuration-fact review** — vendors and system owners confirm factual configuration, version, and interface details. They do not control conclusions.
2. **Method review** — the evidence authority confirms that the executed method and deviations remain acceptable.
3. **Analytical review** — qualified reviewers check run inclusion, calculations, uncertainty, and finding logic.
4. **Customer decision review** — the decision owner reviews options, risks, and actions.
Shared record fields: see Review record in section 1.

### Evidence history tree (Part L)
Retained per claim, exactly:

```plain text
Claim
├── Baseline configuration
├── Original supporting tests
├── System or threat change
├── Required regression tests
├── New results
└── Current validity
```

## 5. Outputs & deliverables

- **Decision evidence package** — the 20-section document above. Contents: sections 1–20. Format: reviewed, versioned, marked document with acceptance record. Produced: after analysis, before customer decision. Must pass the independent-reviewer test.
- **Bounded recommendation** — embedded in the package (sections 3 and 15) with the eight bounded-recommendation fields. Produced with the package.
- **Action plan** — the set of action records (Part F). Produced with the package; tracked until closure or transfer.
- **Delivered data set** — raw and processed data with classification marks, checksums/custody records when required, encryption, transfer and receipt records, and versioned corrections. Produced at delivery (Part G).
- **Closeout record** — contractual product acceptance, reservations, open items, archives, property returns, invoice confirmation, customer outcome (Part H). Produced at campaign closeout.
- **After-action review output** — answers to the nine debrief questions plus improvement records with owner, due date, and destination. Produced within five working days of campaign end (Part I).
- **Reuse library additions and next-campaign start pack** — sanitized, versioned assets of the twelve harvest types (Part J). Produced post-campaign.
- **Evidence baseline** — the Part K record set. Produced at acceptance; maintained thereafter.
- **Regression assessment and plan** — change-impact record, minimum regression scope, updated evidence history tree, updated baseline (Part L). Produced whenever a relevant change occurs.
- **Follow-on success metrics** — the three Part M metric groups. Produced per campaign; tracked across campaigns.

## 6. Workflow & sequencing logic

Ordered end-of-campaign flow implied by parts A–M:
1. Dispose every claim and question (A) — no claim or question may be left without a state.
2. Build the decision evidence package in the fixed 20-section order (B); run accounting must precede findings.
3. Complete architecture and mission assessment (C) — feeds package section 11.
4. Complete decision analysis and bounded recommendation (D) — feeds sections 14–15.
5. Run the four reviews in Part E order: configuration-fact, method, analytical, customer decision. Method and evidence acceptance statuses gate the package.
6. Create the action plan (F) — every action needs an owner before closeout.
7. Deliver with the nine-step custody checklist (G) — all steps before delivery.
8. Execute the four closeout groups (H).
9. After-action review within five working days (I).
10. Reuse harvest with the eight per-asset steps (J).
11. Establish the evidence baseline (K) — the anchor for all later regression.
12. On any later change, run the eight-step change-impact process (L) before relying on prior evidence.

Gates and rules:
- **Inference gate:** do not use component success to imply mission success without evidence through the complete chain (A). Distinguish the four evidence levels.
- **Dissent gate:** valid dissent stays in the record (E).
- **Acceptance gate:** package needs method acceptance status, evidence acceptance status, and final approving authority and date (E).
- **Delivery gate:** recipient must be able to open the package; transfer and receipt recorded (G).
- **Closeout gate:** the six closeout-gate conditions (section 3 above) must all hold.
- **Regression selection rule:** select the least costly evidence that restores confidence; evidence-authority agreement required before execution (L).
- **Regression scope rule:** cover affected interfaces and the mission thread, not only the changed component (L).
- **Follow-on rule:** a follow-on must support a new or recurring decision; do not create work only to maintain activity (M).

Regression vocabulary (distinct states in the workflow):
- **Retesting** checks whether a specific fix worked.
- **Regression testing** checks whether the fix or change damaged another capability.
- **Recharacterization** maps a new performance boundary after a major change.
- **Continuous evaluation** repeats selected regression tests as systems and threats change.
Scope limit: regression testing checks whether prior capabilities and conclusions remain supported within the stated configuration and applicability limits; it does not prove they remain universally valid.

External model links (Part L): the evidence-refresh model links TestOS (baseline configuration, claims, measures, results, limits, current validity), RangeOS (recreated conditions and independent ground truth), Red Thread (repeated or adapted threat profile), and the regression assessment (affected prior findings and evidence required to keep, narrow, or withdraw them). [AMBIGUOUS: TestOS/RangeOS/Red Thread are named systems defined elsewhere in the manual.]

## 7. Worked examples & real data

- **C-UAS radar-firmware regression example (Part L):** "radar firmware may improve detection range while increasing track delay enough to close the interceptor's engagement window." Prior baseline established: detection, stable tracking, C2 handoff, interceptor assignment, and engagement timing. Required regression assessment: the seven-item checklist in section 3 (detection range, false-alarm rate, track continuity, track-to-ground-truth accuracy, radar-to-C2 handoff, total engagement time, performance under RF or GPS disruption).
- No numeric data appears in this section.

## 8. Product implications

1. **Claim/question disposition screen.** The app must force a terminal state on every CLM and Q at closeout: the six claim states and three question states as required enums, plus the four-level evidence classification. Closeout is blocked while any item is undisposed.
2. **Decision evidence package generator.** A one-click document builder that assembles the 20 sections in fixed order, auto-filling from existing records: run accounting from RUN states, claims disposition from Part A, measures/thresholds from the test design, findings from analysis. Export as the customer-facing result package (print/PDF).
3. **Run accounting rollup.** RUN records need a state field (planned, attempted, valid, conditional, invalid, excluded) and the app must compute counts per state automatically for package section 8 and the valid-run-rate metric.
4. **Guided after-action debrief.** A standardized debrief form that presents the nine Part I questions in order, with a five-working-day due date computed from campaign end, and that converts each answer into an improvement record requiring owner, due date, and destination (standard work or backlog). This is the "guided debrief that draws out learning points."
5. **Four-review workflow.** Sequential review checklists (configuration-fact, method, analytical, customer decision) each capturing reviewers, comments, corrections, dissent, adjudication, statuses, conditions, and final authority/date. Dissent entries are append-only.
6. **Action tracker.** ACT records with the ten Part F fields, visible until closed or transferred; the closeout gate checks that every action has an owner.
7. **Delivery checklist with hard gate.** The nine Part G steps as a blocking checklist before the package can be marked delivered; versioned corrections.
8. **Closeout gate dashboard.** A single view of the six gate conditions; campaign state can move to Closed only when all pass.
9. **Evidence baseline object.** A structured CFG-linked baseline record (Part K fields) created at acceptance, versioned, and referenced by every finding.
10. **Change-impact wizard.** When the user edits any baseline-relevant item (the eight change-trigger categories), the app prompts the eight-step Part L flow, records one of the six outcomes, generates a minimum-regression-scope record, and maintains the per-claim evidence history tree (baseline configuration → original tests → change → required regression tests → new results → current validity).
11. **Reuse library.** Post-campaign harvest flow for the twelve asset types with the eight sanitize-and-version steps; output feeds a "next-campaign start pack" that seeds new campaigns.
12. **Success-metric tracking.** Auto-compute the Part M decision-impact, evidence-quality, and operating-leverage metrics per campaign and show trends across campaigns.

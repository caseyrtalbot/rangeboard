You are a senior product designer, UX architect, frontend engineer, and Test & Evaluation workflow specialist working on a **production-grade Counter-UAS Test & Evaluation application**.

Your task is to redesign the existing Deployment Strategist workflow so that it remains **technically rigorous and comprehensive without presenting the user with a giant form**.

The current application contains 50+ explicit data-entry fields distributed across the campaign lifecycle. Many are free-text inputs. Some labels require substantial T&E knowledge to interpret. The data itself is important and should generally **not be removed**.

The problem is the interaction model.

## Core design principle

**Simplify the user interaction, not the underlying T&E data model.**

Do not solve this by deleting important fields, hiding required rigor, or reducing the fidelity of the resulting test artifacts.

Instead, transform the application from:

> "Fill out every field required by the data model."

into:

> "Tell the system what you are trying to test, make a series of clear operational decisions, and let the system progressively construct the required T&E structure."

The strategist should feel as though the software is **guiding them through planning a test campaign**, not asking them to populate a database.

---

# 1. Start with a field-by-field UX audit

Before modifying the interface, inventory every existing field in the Deployment Strategist workflow.

For each field determine:

- What information is actually being collected?
- Why is it needed?
- Which downstream artifact or decision consumes it?
- Is the information already available elsewhere in the application?
- Can it be derived from another answer?
- Can it be inherited from:
  - campaign metadata
  - system inventory
  - threat inventory
  - test site
  - organization
  - previous campaign
  - selected configuration
  - test card
  - existing register
- Does the user need to type it?
- Can the user **select** rather than **recall and write**?
- Can the field be conditionally hidden?
- Can several fields be represented as one higher-level decision?
- Does the user need an example before answering?
- Does the term require explanation?

Do not remove a field from the underlying schema without documenting exactly how its information will otherwise be captured.

Produce an explicit mapping:

`Existing field → Proposed interaction → Data preserved → Trigger/logic → Downstream use`

---

# 2. Apply a strict input hierarchy

Use the following hierarchy when choosing input methods.

Prefer, in order:

1. **Automatically derived**
2. **Inherited from existing records**
3. **Smart default**
4. **Single-click selection**
5. **Radio / segmented control**
6. **Checkbox**
7. **Multi-select**
8. **Searchable dropdown / combobox**
9. **Entity picker**
10. **Numeric input with units**
11. **Structured builder**
12. **Short text**
13. **Long-form free text**

Long-form prose should be the exception.

A user should never have to manually type a value that the software can reliably derive, retrieve, constrain, or present as an option.

Every remaining free-text field must have a defensible reason for remaining free text.

---

# 3. Replace ambiguous questions with operational decisions

Do not merely shorten field labels.

Rewrite ambiguous form questions into questions a Deployment Strategist can answer naturally.

For example, instead of:

**Engagement Type**

consider:

**What is the customer asking us to determine?**

`Compare configurations`  
`Characterize performance`  
`Verify a requirement`  
`Find failure conditions`  
`Validate an integration`  
`Assess operational suitability`  
`Other`

Instead of requiring the user to understand the application's internal ontology, let the software map an operational answer onto that ontology.

Where appropriate, place the formal T&E terminology underneath the plain-language question as secondary text.

Example:

**What decision will this test support?**  
_Select the decision the customer needs to make._

The database field may still be `decision_type`. The operator does not need to think in database terms.

---

# 4. Use progressive disclosure aggressively

Do not display every possible field.

Only show information that is relevant to:

- the current workflow stage;
- previous answers;
- selected system;
- selected threat;
- selected test type;
- selected authority;
- selected range;
- required deliverables.

Example:

If the user selects:

`Compare two system configurations`

then reveal:

- Configuration A
- Configuration B
- Variables intentionally changed
- Variables required to remain constant
- Comparison measures

Do not show those questions for a characterization campaign.

Likewise:

Selecting `EW / contested spectrum` should reveal applicable spectrum, interference, emissions, C2, navigation, and instrumentation questions.

Selecting `kinetic interceptor` should reveal interceptor-specific configuration and engagement questions.

The interface should adapt to the campaign.

---

# 5. Convert the workflow into guided steps

Preserve the existing lifecycle:

**Qualify → Design → Cards → Execute → Analyze → Deliver**

But within each stage, replace the long scrolling checklist with **small decision-oriented groups**.

Each group should contain approximately 3–7 closely related decisions.

Example for Qualification:

### Mission
What are we trying to protect?

### Test object
What system or configuration is being evaluated?

### Threat
What threat or threat class is relevant?

### Decision
What decision must the customer make after the test?

### Authority
Who owns the decision and who accepts the evidence?

### Constraints
What limits the campaign?

### Success
What would constitute sufficient evidence to proceed?

The application should construct the detailed charter from these inputs.

---

# 6. Maximize structured selection

Wherever a reasonably bounded vocabulary exists, use selection controls.

Examples include:

### Campaign purpose
- Characterization
- Comparative evaluation
- Verification
- Validation
- Integration
- Regression
- Adversarial stress test
- Operational assessment
- Failure reproduction

### System role
- Early warning
- Detection
- Classification
- Tracking
- C2
- Electronic attack
- Electronic protection
- Kinetic defeat
- Non-kinetic defeat
- Interceptor
- Sensor fusion
- Battle management
- Other

### Threat categories
Allow structured selection by relevant taxonomy.

### Test environments
- Laboratory
- SIL
- HIL
- Range
- Operational environment
- Mixed / progressive

### Spectrum conditions
- Benign
- Representative
- Congested
- Contested
- Denied
- Custom

### Test factors
Use selectable chips or checkboxes for factors such as:
- range
- altitude
- aspect
- speed
- target count
- track density
- weather
- spectrum condition
- terrain
- operator workload
- network latency
- communications condition
- threat behavior
- system configuration

Do not require comma-separated text for information that can be represented as structured objects.

---

# 7. Use intelligent entity selection

Where the application already contains inventories or registers, the strategist should select actual entities instead of retyping their characteristics.

Examples:

**Select test system**  
Search inventory…

`RPS-42 Radar — Configuration 24.3`

Once selected, automatically populate known:

- manufacturer
- role
- configuration
- interfaces
- frequency information where releasable
- nominal operating parameters
- integration relationships
- previous test history

Then allow the strategist to override only campaign-specific information.

Use this pattern for:

- systems
- sensors
- effectors
- interceptors
- C2 nodes
- threat systems
- configurations
- test sites
- organizations
- authorities
- personnel
- instrumentation packages

---

# 8. Provide examples without cluttering the primary UI

Any field that may be ambiguous should support an **Example** or **Show example** action.

Do not fill the page with instructional paragraphs.

Use lightweight contextual help:

`?` Definition  
`Example`  
`Why this matters`

Example:

**What decision must this campaign support?**

`Show example`

When expanded:

> Determine whether adding the selected early-warning radar provides sufficient additional warning time to justify integration into the baseline C-UAS architecture.

Where appropriate, provide a:

**Use this structure**

action that inserts the example as an editable starting template.

Examples must be realistic to defense T&E and C-UAS operations. Clearly identify illustrative data as illustrative.

---

# 9. Use structured sentence builders for complex statements

Some important T&E information cannot be reduced to one dropdown but also should not require the user to compose an entire paragraph.

Use structured builders.

Example:

### Decision statement

**Determine whether**

`[System / configuration]`

**can**

`[mission function]`

**against**

`[threat / condition]`

**while meeting**

`[measure / threshold]`

**to support**

`[customer decision]`

Render the result as a natural-language decision statement.

Allow expert users to edit the generated statement afterward.

Apply this approach where useful to:

- operational questions
- test claims
- hypotheses
- success criteria
- comparison statements
- mission outcomes
- test conditions
- evidence requirements

---

# 10. Create presets and templates

Support starting points such as:

**Start from**
- Blank campaign
- Previous campaign
- C-UAS sensor characterization
- Radar comparison
- Sensor-to-C2 integration
- C2 track fusion evaluation
- EW resilience
- Interceptor evaluation
- End-to-end detect-to-defeat
- Regression test
- Custom template

A template should populate the workflow structure and recommended fields but never fabricate factual test data.

Templates reduce setup time while retaining full editability.

---

# 11. Separate required, recommended, and advanced information

Do not visually treat every field as equally important.

Classify inputs as:

### Required
Necessary to proceed through the stage gate.

### Recommended
Improves test quality or interpretability.

### Advanced
Needed only for specialized campaigns.

A strategist should be able to see immediately:

- what blocks progress;
- what is incomplete;
- what is optional;
- why something is required.

Avoid a wall of red required-field indicators.

---

# 12. Create expert and guided interaction without separate products

The application must support both:

- a strategist who knows exactly what to enter;
- a user who needs guidance.

Do this within the same interface.

Examples:

Searchable controls should support rapid keyboard entry for experts.

Guidance, examples, and explanations should remain available on demand.

Avoid forcing experienced users through dozens of instructional modals.

---

# 13. Reuse prior answers automatically

Information entered once should propagate throughout the campaign.

For example:

If the user identifies the customer decision authority during Qualification, do not ask for it again when generating a test plan.

If Configuration A was selected during Design, test cards should reference that configuration automatically.

If a threat set was established for the campaign, the test-card builder should offer those threats first.

The system should maintain a coherent **campaign context**.

Ask the user to confirm information when necessary; do not repeatedly ask them to recreate it.

---

# 14. Make registers first-class reusable objects

Assumptions, risks, measures, systems, threats, configurations, authorities, and constraints should not be buried in text areas.

Represent them as structured records.

For example:

### Assumptions

| Assumption | Applies to | Criticality | Status |
|---|---|---|---|
| ENG-1 time-to-effect model represents engagement chain | Engagement timing | High | Unverified |

Provide:

`+ Add assumption`

rather than requiring the strategist to write multiple assumptions into one text box.

The same principle applies to:

- risks
- unknowns
- claims
- evidence gaps
- measures
- thresholds
- constraints
- dependencies

These records should be reusable downstream.

---

# 15. Show what the system is building

The user should understand that their selections are progressively constructing real T&E products.

Provide a persistent but unobtrusive representation such as:

**Campaign readiness: 72%**

**Generated from current inputs**
- Charter ✓
- Decision statement ✓
- System configuration ✓
- Threat definition ✓
- Measures 4/6
- Assumptions 3
- Risks 2
- Test matrix incomplete
- Evidence acceptance criteria incomplete

Allow the user to preview generated artifacts without leaving the workflow.

---

# 16. Add a review layer before stage completion

At the end of each stage, present a concise review instead of making the user reread the entire form.

Example:

## Qualification Review

**Customer asks:**  
Compare baseline C-UAS architecture against architecture with EW-1 radar.

**Decision:**  
Determine whether EW-1 produces operationally significant additional warning time.

**Decision owner:**  
JITAF-401 commander

**Evidence authority:**  
JITAF-401

**Test scope:**  
12 matched A/B conditions

**Key exclusions:**  
Multi-threat saturation, sustainment, contested spectrum

**Open issues:**  
2 assumptions unverified  
1 authority requires confirmation

`Back to edit`  
`Pass qualification gate`

This summary should be generated from the structured data.

---

# 17. Preserve traceability

Simplification must not weaken defensibility.

Every generated test artifact should retain traceability between:

**Customer need  
→ operational question  
→ claim / unknown  
→ evidence gap  
→ measure  
→ test condition  
→ test card  
→ observation  
→ finding  
→ conclusion  
→ decision**

The UI may abstract this complexity during data entry, but the data model must retain it.

---

# 18. Add production-grade form behavior

This is not a demo or landing page.

Implement behavior expected from serious operational software:

- autosave
- explicit saved state
- draft recovery
- validation
- deterministic data handling
- stable IDs
- keyboard navigation
- accessible controls
- search
- filtering
- undo where appropriate
- controlled deletion
- optimistic UI only where safe
- clear error recovery
- version awareness
- change history where operationally relevant
- no accidental data loss
- responsive layouts
- no horizontal overflow
- sensible focus behavior
- disabled states with explanations
- loading states
- empty states
- permission-aware controls
- provenance for inherited or derived values

Do not implement decorative UI that disguises unfinished behavior.

---

# 19. Avoid common "AI-generated SaaS" patterns

Do not turn this into:

- giant cards surrounding every field;
- excessive gradients;
- oversized headings;
- decorative iconography;
- excessive pills;
- conversational chatbot UI for routine data entry;
- multiple unnecessary confirmation dialogs;
- huge whitespace;
- one-question-per-screen onboarding;
- ambiguous "AI magic" actions;
- animations that slow expert users;
- visually attractive controls that obscure information density.

This is operational software.

Reference the interaction qualities of mature tools such as **Palantir Foundry, Anduril Lattice, high-quality engineering applications, IDEs, and mission-planning software**:

- dense but legible;
- hierarchical;
- deterministic;
- context aware;
- fast;
- keyboard friendly;
- information rich;
- low ornamentation;
- obvious system state.

---

# 20. Use AI only where it reduces genuine work

AI assistance may be used for:

- turning structured answers into draft prose;
- identifying incomplete information;
- suggesting applicable measures;
- suggesting likely assumptions;
- identifying contradictions;
- explaining terminology;
- summarizing the campaign;
- proposing test questions based on selected systems and mission;
- finding prior analogous campaigns.

AI must not silently invent:

- performance specifications;
- authorities;
- threat characteristics;
- ranges;
- configurations;
- thresholds;
- test results;
- doctrinal relationships.

Generated content must be distinguishable from verified campaign data and require user acceptance before becoming authoritative.

---

# 21. Target interaction

The finished experience should feel approximately like this:

**1. What is being evaluated?**  
`[ Select system or architecture ]`

**2. What does the customer need to determine?**  
`Compare` `Characterize` `Verify` `Stress` `Integrate`

**3. What is it being evaluated against?**  
`[ Select threat(s) ]`

**4. What mission function matters?**  
`Detect` `Track` `Identify` `C2` `Defeat` `End-to-end`

**5. Which conditions matter?**  
`Spectrum` `Weather` `Range` `Density` `Terrain` `Network` `Other`

The application then progressively constructs:

- the charter;
- decision statement;
- scope;
- assumptions;
- measures;
- factor space;
- test matrix;
- test cards;
- execution requirements;
- analysis plan;
- final evidence package.

The strategist should spend their cognitive effort on **test reasoning**, not form completion.

---

# 22. Acceptance criteria

The redesign is successful when:

1. The underlying information required for defensible T&E remains available.
2. The number of simultaneously visible write-in fields is reduced dramatically.
3. Most routine inputs are selection-based or automatically populated.
4. Long-form free text is reserved for genuine expert judgment.
5. Every ambiguous concept has contextual definition and/or examples.
6. Questions appear only when applicable.
7. Previously entered information is reused automatically.
8. The user can understand what information remains before passing a gate.
9. The software can generate coherent downstream T&E artifacts from structured inputs.
10. An expert user can complete the workflow rapidly without fighting instructional UX.
11. A less experienced user can complete the same workflow without already knowing the application's schema.
12. No information is silently invented.
13. Traceability is maintained from customer need through final finding.
14. The interface remains suitable for real field use and repeated operational campaigns.

---

# 23. Required implementation output

Do not immediately start restyling components.

First:

1. Audit the existing workflow and field schema.
2. Identify redundant, derivable, selectable, conditional, and genuinely free-form inputs.
3. Create the existing-field → proposed-interaction mapping.
4. Define the conditional logic between answers.
5. Define the reusable entity/register model.
6. Define the guided information architecture.
7. Show the proposed user flow.
8. Identify changes required to the data model, if any.
9. Identify migration or compatibility risks.
10. Then implement the redesign.

For each major UX change, explain:

**Current friction → proposed interaction → why it reduces cognitive load → how underlying data fidelity is preserved.**

Do not optimize primarily for visual novelty.

Optimize for:

**speed of entry + clarity + structured data + progressive disclosure + traceability + operational rigor.**

The final product should make a sophisticated C-UAS T&E campaign **feel substantially simpler to construct without actually making the campaign less sophisticated.**
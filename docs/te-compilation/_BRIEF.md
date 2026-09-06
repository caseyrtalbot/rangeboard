# Extraction brief: RangeBoard T&E Operations module

> Dated source document (August 2026). This folder holds the research compilation behind
> `docs/te-plan.md` and `src/te/`. `MASTER-CALCULATIONS.md` is the fixture source of the
> `src/te/calc/` tests. Source and tests decide current behaviour.

## Mission context

RangeBoard is a local-first web app for Counter-UAS (C-UAS) test-and-evaluation planning. It has an infinite meter-scaled map canvas, a sensor/effector/threat library, kill-chain links, flight paths, timeline playback, engagement analysis, and a basic test-card panel. Stack: React 19, react-konva, zustand. Single user, no backend.

We are adding a major feature: an end-to-end Test & Evaluation Operations module. A deployment strategist (for example, supporting JIATF-401) will use it to:

1. Input all known variables: administrative, tactical-administrative, mission and experiment, and test-card information.
2. Let the app run all expected calculations, setups, and design steps (pre-experiment and post-experiment).
3. Generate day-of-test cards, run profiles, dynamic checklists, and standardized debriefs.
4. Export tablet-ready or printable deliverables: test cards, experiment results, visuals/frames, telemetry summaries, and guided debriefs that draw out learning points.

Your extraction is the single source of truth for the build. Anything you do not extract will not exist in the product. Extract with high fidelity. Do not summarize away detail.

## What to extract (in priority order)

1. **Input variables and fields.** Every named field a user would fill in: name, meaning, data type, units, allowed values/enums, defaults, and which record or form it belongs to. Reproduce field lists completely.
2. **Calculations and formulas.** Every formula, statistic, sample-size rule, threshold, derate, or scoring method. Reproduce the exact math. Define every variable. State inputs, outputs, units, and when in the workflow it is computed. Never paraphrase a formula.
3. **Checklists.** Every checklist: its items verbatim, the phase it belongs to, who runs it, and any conditional logic (if X then Y). Do not compress item lists.
4. **Templates, forms, and cards.** Every template/form/card structure: sections, fields, field order, and layout intent. Reproduce fully. These become UI forms and print layouts.
5. **Outputs and deliverables.** What the customer or team receives: name, contents, format, and when it is produced.
6. **Workflow and sequencing logic.** States, gates, ordering rules, dependency rules ("do X before Y"), day-of-test rhythm, and adaptation rules between runs.
7. **Worked examples and real data.** Any example with real numbers (JIATF-401 or other). Quote the numbers exactly. These become seed data and test fixtures.

## What to de-emphasize

Governance, safety philosophy, legal authority discussion, and role advocacy prose. Capture only their operational hooks: a go/no-go checklist item, a stop rule, a required approval field on a form. One line each. Do not reproduce the prose.

## Output file format

Write one markdown file (path given in your task). Use this structure:

```text
# <Scope title>
## Sources fetched
(list every Notion page URL you fetched, with title)
## 1. Input variables & fields
## 2. Calculations & formulas
## 3. Checklists
## 4. Templates, forms & cards
## 5. Outputs & deliverables
## 6. Workflow & sequencing logic
## 7. Worked examples & real data
## 8. Product implications
(8 = your judgment: what the app must let the user DO, based on your sections 1-7; concrete feature statements)
```

Empty sections: write "None found." Mark unclear source material with `[AMBIGUOUS: reason]`. Preserve exact numbers, units, thresholds, and record identifiers (CAMP, DEC, Q, CLM, HYP, CFG, THR, COND, M, TC, RUN, DEV, ANOM, CHG, FIND, ACT, REG).

## Fetching protocol

1. Load the Notion tool first: ToolSearch with query `select:mcp__claude_ai_Notion__notion-fetch`.
2. Fetch each assigned page by URL.
3. Fetch every sub-page linked inside your assigned pages (`<page url="...">` tags). Recurse until done.
4. Do NOT fetch pages assigned to other agents. The full page map is below; anything in it that is not yours is out of scope.

## Page map (manual sections and owners)

- 00 Roles, Authority, Records & Configuration Control — agent 1
- 01 Engagement Qualification, Discovery & Mission Definition — agent 1
- 02 Evidence Planning, Measures & Test Design — agent 2
- 03 Technical Integration, Range Planning & Readiness — agent 3
- 04 Test Cards & Controlled Test Execution — agent 4
- 15 Test Card Application — agent 4
- 05 Data Validation, Analysis & Adaptive Replanning — agent 5
- 06 Decision Evidence, Closeout, Regression & Reuse — agent 6
- 07 Field Templates, Forms & Checklists — agent 7
- 08 OPFOR & Threat Representation for C-UAS T&E — agent 8
- 09 C-UAS Doctrine-to-Test Application — agent 8
- 10 C-UAS Measure Dictionary — agent 9
- 11 Quantitative Test Design & Analysis — agent 9
- 14 Quantitative Guide: Data, Calculations & Experiments — agent 10
- 12 Instrumentation & Ground Truth — agent 11
- 13 Worked C-UAS Test Cards — agent 11
- Case Study JIATF-401 C-UAS Test Workbench + JIATF-401 page — agent 12
- Field Guide + Questions to Master — agent 13

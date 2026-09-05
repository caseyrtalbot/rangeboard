# RangeBoard: inherited backlog triage

Status: PROPOSED DISPOSITIONS, 2026-09-04, against `8b528f2`.

This is a routing index for the **204 inherited rows**, not a second status register or
blanket approval of old D-rows. [outstanding.md](../data-engine/outstanding.md) retains every
original item and its status. Read literal `open`, `decided`, `done` and `note` carefully:
a decided row can still contain unfinished work, and a done row can have a residual.

The snapshot contains 76 D rows (D-58 is intentionally absent), 24 R-D, 72 F, 22 R-F
(R-F-12 moved to M-9) and 10 M. There were 74 literal-open D, 37 literal-open F, three
literal-open R-F and six literal-open M rows. These counts are a historical snapshot,
not a current completion dashboard.

The [plan](PLAN.md) defines slice IDs. A routing entry means “inspect/resolve here,” not
“every sentence in this old row was independently re-proven.” Only source-confirmed
completions/corrections receive status amendments in the register during this pass.
Routine old scope/ownership approvals do not require rebuilding accepted functionality.
Scientific assumptions and unresolved product decisions remain visible.

| Inherited IDs | Destination | Proposed disposition and relevance |
| --- | --- | --- |
| `D-1`, `D-7`, `D-25`, `D-32`, `D-47` | P0 | Reconcile historical arithmetic/text with tested implementation. Preserve old plan text and mark its status; no numerical change to satisfy an erroneous old sentence. |
| `D-2` | C2 / U1 | Correct the now-false altitude help when source edits are authorized. |
| `D-3`, `D-5`, `D-14`, `D-26`, `D-64` | R1 / E1 | Retain intentionally isolated fixtures and browser chart coverage. Distinguish fixture simplifications from published validation cases; no automatic expectation rewrite. |
| `D-4`, `D-17`, `D-18`, `D-19`, `D-20`, `D-21`, `D-23`, `D-24`, `D-29`, `D-30`, `D-33`, `D-34`, `D-35`, `D-37`, `D-38`, `D-39`, `D-40`, `D-41`, `D-42`, `D-43`, `D-44`, `D-45`, `D-46`, `D-50`, `D-51`, `D-52`, `D-53`, `D-55`, `D-57`, `D-59`, `D-76` | U1 | Existing presentation choices, not a mandate to rebuild old mockups. Retain initially; evaluate concrete usability issues against task acceptance. Empty-layout reload (D-44), shared open-state (D-41) and system-selection detail (D-46) need deliberate UX decisions. Note 2026-09-05: the locked design contract (docs/design/DESIGN_CONTRACT.md, R-D-32) supersedes "retain initially" for presentation; resolve each of these rows inside the design step that owns its panel. |
| `D-6`, `D-8`, `D-15`, `D-71`, `D-72`, `D-73`, `D-74` | E1 | Review source conditions, calibration assumptions and pedigree. Retain implemented values pending evidence; do not approve or revert scientific inputs in a documentation pass. |
| `D-9`, `D-10`, `D-16`, `D-27`, `D-31`, `D-54`, `D-68`, `D-69`, `D-70` | C2 | Use implemented shared rules and preserve time-horizon boundaries. Reconcile mixed estimators, labels, thresholds and export meaning; do not preserve D-69 mixtures merely because they were documented. |
| `D-11`, `D-36`, `D-48`, `D-62` | P0 / R1 | Superseded or completed portions are source-confirmed: scan origin changed, series builders moved, counter draws replaced the stream. Preserve history and current regression obligations. |
| `D-12`, `D-13`, `D-49`, `D-56`, `D-61` | E2 / R1 | Preserve scan/coast/ladder contracts during extraction; independently review tentative versus firm track. D-61 per-DT Pd behavior is superseded, but its cumulative-initiation question is separate. |
| `D-22`, `D-63`, `D-66`, `D-67`, `D-75` | C1 / C3 / R1 | Retain supported migrations, scenario run settings and seed-merge policy. Test complete freshness and worker guards; generic requests for old foreign-file edit approval are historical. |
| `D-28`, `D-60`, `D-65` | R1 / E3 | Preserve one time-grid definition and default policy parity. D-65 copied statistics are superseded by shared te/calc/stats imports; verify statistical meaning independently. |
| `D-77` | Archive context | Historical parallel-work process note; no product change. |
| `R-D-1`, `R-D-4`, `R-D-10`, `R-D-11`, `R-D-15`, `R-D-21`, `R-D-22`, `R-D-23` | E1 / E3 | Already recorded decisions. Carry PF, sampling, stopping and statistical-test assumptions into the model dossiers; accepted-as-built does not imply independent empirical validation. |
| `R-D-2`, `R-D-3`, `R-D-5`, `R-D-6`, `R-D-7`, `R-D-8`, `R-D-9`, `R-D-12`, `R-D-13`, `R-D-14`, `R-D-16`, `R-D-17`, `R-D-18`, `R-D-19`, `R-D-20`, `R-D-24` | R1 / archive context | Keep recorded decisions and gate/timing evidence as historical. Verify behavior in the owning slice; do not rerun old ownership disputes or treat old zero-fire timings as representative field performance. |
| `F-1`, `F-4`, `F-6`, `F-19`, `F-29`, `F-31`, `F-39`, `F-41`, `F-47`, `F-48`, `F-59`, `F-63` | R1 | Audit live consumers, shared helpers/cycles, test typing and warning sources. Remove dead exports only after checking callers; the static-markup initial-state rule remains a regression convention. |
| `F-5`, `F-15` | E2 / C2 | Distinguish geometry rejection, tentative hold and firm track; expose the reason instead of silently reinterpreting a track. |
| `F-11`, `F-16` | C3 / E2 | Validate imported calibration and M-of-N inputs. Do not silently turn malformed values into an apparently sourced model. |
| `F-7`, `F-42` | C2 / U1 | Use current terminology consistently; correct source-facing text in an authorized source slice. |
| `F-20`, `F-28` | P0 / R1 | Source-confirmed obsolete duplication: shared kineticPk and imported DT now exist. Append dated completion evidence; retain parity tests. |
| `F-22`, `F-23`, `F-25`, `F-26`, `F-33`, `F-34`, `F-46`, `F-51`, `F-53`, `F-55`, `F-64`, `F-70` | U1 / E2 | Address readable labels, dense panels, chart domains/tokens, path authoring and ring semantics. Do not change legitimate coincident/zero-radius geometry to imitate a mockup. F-33 retains a tick-presentation residual despite its done status. |
| `F-35` | R1 | Historical chart bundle increase is completed evidence. Current bundle/performance work uses measured workloads, not the old claim that charts are tree-shaken away. |
| `F-49` | R1 / E1 | Replace stale COAST recipe with a current reproducible case; state purpose and expected scan/hold timing. |
| `F-61`, `F-62`, `F-65`, `F-66`, `F-68` | E1 | Descriptions, unresolved RCS, unpublished calibration assumptions and source access/conflicts require a source reconciliation. Missing evidence remains explicit. |
| `F-71` | U1 / C3 | Whole-model reset is implemented behavior. Evaluate preview/per-field reset if it materially reduces loss of intentional edits; no hidden seed overwrite. |
| `F-2`, `F-3`, `F-8`, `F-9`, `F-10`, `F-12`, `F-13`, `F-14`, `F-17`, `F-18`, `F-21`, `F-24`, `F-27`, `F-30`, `F-32`, `F-36`, `F-37`, `F-38`, `F-40`, `F-43`, `F-44`, `F-45`, `F-50`, `F-52`, `F-54`, `F-56`, `F-57`, `F-58`, `F-60`, `F-67`, `F-69`, `F-72` | Retain / regression | Completed fixes and explicit notes remain historical evidence. Preserve their geometry, expenditure, provenance, chart and undo invariants; no new feature is justified by these rows alone. |
| `R-F-1`, `R-F-5`, `R-F-8`, `R-F-10`, `R-F-13`, `R-F-17` | Retain / regression | Implemented spread flags, sources, quantity wording, scan display and elevation tolerance remain tested behavior. Do not reopen without new evidence. |
| `R-F-2` | E1 / E2 / E3 | Partial: 0.7 speed factor is implemented in attrition.ts; the stated spread follow-up is absent. Qualify the approximation and decide coverage with evidence. |
| `R-F-3`, `R-F-4`, `R-F-6`, `R-F-16` | E1 | Relevant source/seed follow-ups remain unfinished despite some decided statuses. A derived Matrice 600 RCS cannot independently validate the calibration source that produced it. |
| `R-F-7` | E2 | Window cap is implemented, but its physical-feasibility limit requires independent assessment. Do not mix a new kinematic model into R1. |
| `R-F-9` | R1 / E2 | Carried-hold cue rule is implemented; preserve it in refactoring and the scan/coast comparison suite. |
| `R-F-11`, `R-F-18`, `R-F-19`, `R-F-23` | Retain / regression | Export/string and fidelity-tag notes, endpoint sampling and intentionally changed kill keys are context. Investigate only where current acceptance exposes an issue. |
| `R-F-14` | P0 / E1 | Correct the universal valid-is-unreachable claim with the recorded sensor-only counterexample. Preserve current validity policy; no new exemption is implied. |
| `R-F-15` | E3 | Kill key now counts per effector/threat/ship. Admitted member order remains a distinct CRN-quality issue; keep both parts visible. |
| `R-F-20` | C2 / R1 / E1 | Browser firing portion is reproduced and saved; blocked-route explanation remains open. The saved probe starts inside detection range, so add a separately valid detection fixture. |
| `R-F-21`, `R-F-22` | U1 | Sources/Sensitivity text clipping remains relevant. Provide complete readable information at 320 px; do not close solely on no horizontal overflow. |
| `M-1`, `M-3`, `M-5`, `M-6`, `M-7`, `M-8` | P0 / historical reference | Propose retiring old mockup numbers as acceptance targets. Preserve the four user-owned files and label future references illustrative; do not regenerate obsolete numerical artwork by default. |
| `M-2`, `M-4`, `M-9` | P0 / historical reference | Old process and browser recipe notes. Carry useful current commands into the handoff; do not recreate absent HANDOFF.md or old session links. |
| `M-10` | P0 | Current documentation corrections, verified ownership transfer and preserved firing evidence close this documentation pass; source-copy residuals continue in M-11. |


New onboarding findings R-F-24 through R-F-29 and M-11 are outside the inherited count.
They route to C1, C2, C3, C4, E3 and the owning documentation/source slices. R-D-25 records
the planning scope and the absence of an independent trial dataset. None is an implemented
fix. Retire a row only through a dated status amendment that cites evidence or a Casey
decision; retain its original wording and identifier.

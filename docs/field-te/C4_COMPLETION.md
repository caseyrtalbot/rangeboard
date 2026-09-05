# C4: authoritative T&E record transitions

Verification record, 2026-09-05. R-F-27/R-F-28. Implementation is in the working tree
on `analysis-hardening`, based on `1b919e5`. Casey subsequently authorized commit and push.
The [register](../data-engine/outstanding.md) is the status authority.

## Record rules

- Generic actions cannot alter/remove issued or superseded cards, rewrite identity,
  replace record lists, forge gate stamps, or bypass run creation/adjudication.
  Qualification requires its existing blockers to clear. Design requires qualification
  and explicit acknowledgement of existing lint warnings. Issue requires design approval
  and all card links to resolve. No new trial threshold is introduced.
- Revision supersedes the issued version and creates one new draft with a new internal ID,
  the same card code and the next major version. Only the currently issued card can be
  revised. Old runs retain their original card ID/version. Drafts remain editable.
- Frozen configuration/measure definitions stay locked. Configuration drift notes can be
  appended, and an empty new drift note can be completed; existing nonempty notes cannot
  be rewritten. Question dispositions remain editable after question freeze. The baseline
  capture now serializes the complete Board scenario, fixing a partial snapshot that the
  C3 loader rejected. Existing source snapshots are not rewritten.
- Observation entry before the first adjudication is draft recording. After adjudication,
  correction requires a named recorder and reason, preserves previous and corrected
  observations, and returns the run to pending for re-adjudication. New adjudications
  snapshot their observations, allowed measures and limits. Prior decisions are retained.
  Old saves have no invented historical snapshots; optional fields remain absent.
- Card supersession changes the planned method. An observation correction changes the
  recorded evidence for the same attempt. These are separate actions; runs never renumber.
  Only an empty, unreferenced, unadjudicated attempt can be discarded. Allocation skips
  existing IDs when an imported sequence counter is stale and preserves discarded numbers.
- Findings are drafts until package delivery. Approver names can be prefilled and do not
  imply finalization. Delivery checks every finding's complete traceability, adjudicated
  evidence and qualified limits; claim/question dispositions, open actions, acceptance
  fields and completed package sections also gate delivery. Delivery freezes campaign
  evidence. The only subsequent campaign mutation is closure; further work starts a
  follow-on campaign. Explicit whole-campaign deletion remains the existing user operation.
- Completed checklists require answered controls, values/signatures, N/A reasons and the
  applicable gate outcome/conditional limits; completed records stay locked.
- Every internal mutation checks campaign-local references and runtime record shapes.
  Adoption also rejects duplicate identities/versions, incomplete issued-card links,
  executed runs on draft cards, broken adjudication/correction lineage and invalid delivered
  records. Import adds a separate campaign and cannot overwrite existing issued history.

## Evidence policy

One `runIncludable` policy has two explicit purposes. Quantitative inclusion permits valid,
non-excluded trials and only the named measures from conditionally valid trials. The
existing observation-payload/attempt rules then determine estimate inclusion. Invalid runs
never enter valid-trial denominators. Failure investigation retains adjudicated invalid or
excluded evidence, with validity, decision reason, limits and exclusion reason displayed.
Pending evidence blocks finalization. Findings with restricted linked evidence must state
its limitations in the existing missing/excluded-data field. This does not infer a finding's
truth or accept a quantitative claim from free text.

Finding computations now use only supporting/contradicting linked runs. Evidence labels are
shown independently of edited narrative in the finding UI and printed package. Matrix
coverage reuses the quantitative policy while retaining its existing full-valid-run scope.

## Acceptance evidence

[Manifest](evidence/c4-2026-09-05/manifest.json) identifies the sources, results and captures.
The existing C3 legacy/recovery suite remains in the full gate. A task-created scratch test
also parsed the native browser export and its autosave form exactly with the final source;
that one test passed and was removed before completion.

| Check | Result |
| --- | --- |
| Direct store regressions | 28 C4 cases cover generic rejection, gates, references, lineage, draft editing, inclusion, corrections, exclusion, delivery, checklist completion, adoption and reload |
| Initial reproduction | 13 failed and 1 passed before implementation |
| Type-check | Pass: `npx tsc --noEmit -p tsconfig.app.json` |
| Full Vitest | Pass: 1,355 tests in 77 files |
| Lint | Pass: 74 existing warnings, zero errors |
| Build | Pass with the existing chunk-size warning |
| Generated schema | Regenerated for optional evidence history; schema version/storage keys unchanged; final drift check passes |
| Isolated browser | UI baseline capture, issue, observation correction, revision and delivery; real store rejection and evidence inclusion; native JSON export/import and exact reload |
| Browser numbers | 10 s and 20 s yield 15 s with n=2; invalid 999 s excluded. After correcting 20 to 30 and excluding the 10 s duplicate, estimate is 30 s with n=1 and no interval |
| Browser lineage | Runs 0001-0003 retain v1.0; v1.0 superseded and v2.0 issued; discarded 0004/0005 leave sequence 5 |
| Visual inspection | Finding labels, corrected observation row, delivery and reimport captures inspected. No horizontal overflow in the verified view; observation input 227 px; minimum visible text 10 px |
| Browser errors | No page exceptions in final verification. Initial favicon request returned 404. CLI retained a stale file-chooser flag after scripted import; a separate verification confirmed both campaigns exactly match the exported bytes apart from the copied campaign ID |
| Preservation | Six unowned files match their incoming SHA-256 hashes. Original research, seeds, model equations and prior captured evidence untouched |

Final review also verified that a rejected card issue reports blockers rather than success
when another version is already issued. The initial correction-row layout crowded the inputs; the final inspected capture replaces
that failed visual state. The records are illustrative software acceptance evidence, not
trial validation. No independent agent review or model numerical-parity run is claimed:
this slice changes T&E record behavior, not Board model physics or randomness.

## Stop

C4 ends after final gates, this evidence record and the subsequently authorized publication.
No R1, E2/E3, T1 or U1 implementation is selected. Next recommendation: the R1 store/worker dependency boundary,
starting with the current value-import graph and a bounded leaf-module extraction.

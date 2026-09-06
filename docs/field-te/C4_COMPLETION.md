# C4: authoritative T&E record transitions

Dated record, verified 2026-09-05, implementation `7f10c92`. Source and tests decide
current behaviour.

## Record rules

- Generic actions cannot alter or remove issued or superseded cards, rewrite identity,
  replace record lists, forge gate stamps, or bypass run creation and adjudication.
  Qualification requires its blockers to clear. Design requires qualification and explicit
  acknowledgement of lint warnings. Issue requires design approval and all card links to
  resolve.
- Revision supersedes the issued version and creates one new draft with a new internal id,
  the same card code and the next major version. Only the currently issued card can be
  revised. Old runs keep their original card id and version. Drafts stay editable.
- Frozen configuration and measure definitions stay locked. Configuration drift notes can
  be appended and an empty new drift note completed; a nonempty note cannot be rewritten.
  Question dispositions stay editable after question freeze. The baseline capture
  serializes the complete Board scenario.
- Observation entry before the first adjudication is draft recording. After adjudication,
  a correction requires a named recorder and reason, preserves both observations, and
  returns the run to pending for re-adjudication. New adjudications snapshot their
  observations, allowed measures and limits. Prior decisions are retained. Old saves get
  no invented historical snapshots.
- Card supersession changes the planned method. An observation correction changes the
  recorded evidence for the same attempt. Runs never renumber. Only an empty,
  unreferenced, unadjudicated attempt can be discarded. Allocation skips existing ids when
  an imported sequence counter is stale and preserves discarded numbers.
- Findings are drafts until package delivery. Approver names can be prefilled and do not
  imply finalization. Delivery checks every finding's traceability, adjudicated evidence
  and qualified limits; claim and question dispositions, open actions, acceptance fields
  and completed package sections also gate delivery. Delivery freezes campaign evidence.
  The only later campaign mutation is closure; further work starts a follow-on campaign.
- Completed checklists require answered controls, values or signatures, N/A reasons and
  the applicable gate outcome; completed records stay locked.
- Every internal mutation checks campaign-local references and runtime record shapes.
  Adoption rejects duplicate identities or versions, incomplete issued-card links,
  executed runs on draft cards, broken adjudication or correction lineage and invalid
  delivered records. Import adds a separate campaign and cannot overwrite issued history.

## Evidence policy

One `runIncludable` policy has two purposes. Quantitative inclusion permits valid,
non-excluded trials and only the named measures from conditionally valid trials. Invalid
runs never enter valid-trial denominators. Failure investigation retains adjudicated
invalid or excluded evidence with validity, decision reason, limits and exclusion reason
displayed. Pending evidence blocks finalization. A finding with restricted linked evidence
must state its limits in the missing or excluded data field.

Finding computations use only supporting and contradicting linked runs. Evidence labels
are shown independently of edited narrative in the finding UI and the printed package.
Matrix coverage reuses the quantitative policy with its full-valid-run scope.

## Acceptance evidence

[Manifest](evidence/c4-2026-09-05/manifest.json) identifies the sources, results and
captures.

| Check | Result |
| --- | --- |
| Direct store regressions | 28 C4 cases: generic rejection, gates, references, lineage, draft editing, inclusion, corrections, exclusion, delivery, checklist completion, adoption and reload |
| Initial reproduction | 13 failed and 1 passed before implementation |
| Type-check | Pass |
| Full Vitest | Pass: 1,355 tests in 77 files |
| Lint | Pass: 74 existing warnings, zero errors |
| Build | Pass with the existing chunk-size warning |
| Generated schema | Regenerated for optional evidence history; schema version and storage keys unchanged; drift check passes |
| Isolated browser | UI baseline capture, issue, observation correction, revision and delivery; real store rejection and evidence inclusion; native JSON export, import and exact reload |
| Browser numbers | 10 s and 20 s yield 15 s with n=2; invalid 999 s excluded. After correcting 20 to 30 and excluding the 10 s duplicate, estimate 30 s with n=1 and no interval |
| Browser lineage | Runs 0001-0003 keep v1.0; v1.0 superseded and v2.0 issued; discarded 0004/0005 leave sequence 5 |
| Visual inspection | Finding labels, corrected observation row, delivery and reimport captures inspected. No horizontal overflow; observation input 227 px; minimum visible text 10 px |
| Browser errors | No page exceptions in final verification |

A rejected card issue reports blockers, not success, when another version is already
issued. The records are software acceptance evidence, not trial validation. This slice
changed T&E record behavior only, not Board model physics or randomness.

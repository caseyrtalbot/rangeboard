# E1 source and description reconciliation

Dated reconciliation record, 2026-09-05, of current code against repository evidence. Source and tests decide current behaviour. Proposed changes only at that date; no seeds, descriptions, provenance, physics or tests modified. Current source links point to the unchanged seed module; the literal evidence snapshot is [seed-inventory.json](seed-inventory.json). Freshly opened originals are enumerated in [sources.md](sources.md); all other provenance below is historical, not re-fetched.

## Inherited register audit

| Register | Current observation and disposition |
| --- | --- |
| F-61 / RPS-42 | [Seed line 21](../../../src/model/seedLibrary.ts#L21): description leads with 3.5/8 km and says 8 km lacks source; actual detect value is 5 km Group 1 with a sponsored-reference row. Rewrite description around current modeled target/quantity in later cleanup, keeping the sponsor/reference pedigree. |
| F-61 / RPS-62 | [Line 84](../../../src/model/seedLibrary.ts#L84): description says no published range and larger MHR; detect row is 3 km nano-UAV, source says aCHR. Old name/class/description need reconciliation; classify 8 km has no accompanying sourced row. |
| F-61 / EchoShield | [Line 158](../../../src/model/seedLibrary.ts#L158): inherited prose differs from the current tracking-range provenance. Fresh source qualifications are centralized in [radar dossier](radar.md), including use of a tracking quantity as detection calibration. |
| F-61 / R8SS | [Line 344](../../../src/model/seedLibrary.ts#L344): description 2–3 km/120° versus 1.2 km MicroUAS/90° fields. Preserve source class distinctions (Micro/Mini/Small UAS); track-output/scan wording needs exact mode evidence before any rate edit. |
| F-61 / Long Range Sentry | [Line 1061](../../../src/model/seedLibrary.ts#L1061): broad 15 km Group 1–3 prose versus 2 km Group 1 lower-bound row. Tower is a composite sensor represented by one radar spec; qualify both class and abstraction. |
| F-61 / Spyglass | [Line 1340](../../../src/model/seedLibrary.ts#L1340): older >3.5 km prose versus 6 km Group 1 field/row; this can reflect variant/date rather than a mathematically contradictory lower bound. Cleanup must retain source/version context. |
| R-F-3 / Coyote | [Line 1673](../../../src/model/seedLibrary.ts#L1673): about-15-km description versus selected 10 km lower bound from 10–15 km reference. Phrase description to identify which bound is modeled. |
| R-F-3 / EnforceAir | [Line 2084](../../../src/model/seedLibrary.ts#L2084): description ~3.5 km versus modeled 1.2 km lower bound; cyber takeover represented by jammer response lacks mechanism-specific evidence. |
| R-F-3 / SMASH | [Line 1874](../../../src/model/seedLibrary.ts#L1874): 250 m description versus 200 m day-mode small-UAS row. Preserve mode, sight variant and firearm/ammunition applicability. |
| R-F-3 / EAGLS, Skyranger 30 | [EAGLS line 2398](../../../src/model/seedLibrary.ts#L2398), [Skyranger line 2445](../../../src/model/seedLibrary.ts#L2445): current descriptions do not state a competing max-range/magazine number. Do not blindly claim those prose conflicts remain reproduced. Fields retain 10 km and 252 rounds. Expenditure round/burst semantics remain a separate R-F-4 question. |
| R-F-3 / Geran-4 | [Line 3591](../../../src/model/seedLibrary.ts#L3591): prose cruise 89 m/s versus 97 m/s field/source lower bound; rangeNote ceiling 4000 m versus altitude-band upper 5000 m. Span is already 3 m; no competing prose span was found. Same named aircraft family does not prove same production configuration. |
| R-F-3 / TB2 | [Line 3682](../../../src/model/seedLibrary.ts#L3682): prose 20+ h versus field 1080 min (18 h lower bound from 18+); altitude band 16000–20000 ft distinguishes operational altitude from ceiling. Current prose has no conflicting 20000-ft claim to fix. |
| R-F-2 | Six stated flyout speeds remain maximum/burnout/muzzle quantities. Factor 0.7 exists in attrition.ts; its promised spread is absent. No primary source establishes 0.7 as a measured average speed. |
| R-F-4 | Existing comments preserve unlike quantities/targets: Wisp unclassified UAS range, Spynel human range, Vampire variant endurance, Lancet payload versus warhead, Shahed alternative warhead, DB4 successor range, gun per-round versus burst quantities, MEROPS ambiguous minimum and Stinger inconsistent minimum. No E1 number is applied. MEROPS [line 1769](../../../src/model/seedLibrary.ts#L1769) still uses 20 km from a 5–20 km statement; whether that denotes a min/max envelope or range band must be resolved before applying the lower-bound rule. |
| R-F-6 | Targeted fresh RTX manufacturer text supplies demonstration context but no Coyote numeric range/speed replacement. Merops/Stinger/EAGLS max-range and named threat reference rows remain historical reference evidence. This row is qualified, not closed as primary-source reconciliation. |
| R-F-7 | Existing capped receding test is physically infeasible under the same speed model; exact independent residual calculation is in [motion dossier](motion-effect-timing.md). Original approved cap remains implemented, not newly fixed. |
| R-F-16 | Fresh source and test reconciliation in [radar dossier](radar.md) establishes lower-bound/proxy/calibration limits. A derived M600 seed would not become independent comparison evidence. No RCS adjustment occurred. |
| R-F-29 | [Crosswalk](uncertainty-crosswalk.md) confirms exact sampled fields, unused size/evasion entries, missing flyout spread, fixed model/environment assumptions and unproven stop-rule coverage. Dossiers satisfy the evidence inventory; E3 analytical work remains open. |
| M-11 | Acoustic fidelity note says no absorption despite alpha term; draw-policy fidelity note says stream despite counter keys. Historical inventory notes on night/acoustic signatures are obsolete. Source/UI cleanup is deferred; no accuracy grade is upgraded. |

## Proposed append-only register entries for parent integration

These are lane-local proposal labels, not allocated register IDs. Existing findings above should be supplemented rather than duplicated or overwritten.

| Proposal | Evidence-backed finding | Routing / stop |
| --- | --- | --- |
| E1-P1 | Radar calibration applicability: Blighter range/elevation configuration mixture, EchoShield tracking quantity adopted as detection, EchoGuard lower-bound proxy residual and derived-RCS dependence. [radar.md](radar.md) and captured primary PDFs. | E2/source cleanup; choose matched quantity/configuration before seed or accuracy-label changes. Supplement R-F-16/F-61; preserve original statuses. |
| E1-P2 | Jam range convention differs within an engagement: slant envelope gate, horizontal assessJam factor/minimum range. [effect-ew.md](effect-ew.md), attrition.ts:984 and ewPhysics.ts:156. | E2 bounded geometry/response reconciliation, no physics edit in E1. |
| E1-P3 | Vendor-count beta spreads are calibrations with limited/clustered evidence, not independent full-domain Pk validation; total draws change the mean as well as width. [effect-ew.md](effect-ew.md), uncertainty.ts:138, seedLibrary.ts:1987/2388. | E3; clarify opportunity/variant/condition applicability and dependence before any new uncertainty claim. |
| E1-P4 | Fidelity acoustic note contradicts implemented constant absorption; broader standards list does not establish current physical-method implementation. [eoir-acoustic-rf.md](eoir-acoustic-rf.md), fidelity.ts:78 and sensorEnv.ts:305. | Supplement M-11 in later owning cleanup; preserve original inventory research. |
| E1-P5 | E1 inherited-copy audit partially refutes the blanket R-F-3 description list: current EAGLS/Skyranger descriptions contain no competing stated range/magazine, and Geran/TB2 require specific remaining fields rather than a wholesale rewrite. | Record this reconciliation as evidence qualification, not silent alteration/closure of the historical row. |

No independent trial dataset was available. This limits empirical validation, not completion of the evidence dossiers. No new acceptance threshold, distribution, trial claim or primary-source status is invented.

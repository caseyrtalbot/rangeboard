# C-UAS inventory evidence

Provenance for the RangeBoard selectable inventory: what each number means,
where it came from, and what the public record does not establish.

The library itself is `src/model/seedLibrary.ts` (models),
`src/model/integrationData.ts` (integration profiles) and
`src/model/seedSystems.ts` (system presets). This directory is the evidence
behind them, because `SpecModel` carries no source field.

| File | What it holds |
| --- | --- |
| `provenance.md` | Per-field evidence for every model added in the August 2026 expansion: value, range type, condition, grade, layer, source, date. |
| `integration-matrix.csv` | Machine-readable integration edges: source, target, relationship, interface, status, confidence, source, date. |
| `gaps.md` | What is not publicly established, why, how the app treats it, and every system researched then excluded. |
| `changelog.md` | Every add, change and exclusion, with the justification. |
| `doctrine.md` | Terminology audit against US and NATO doctrine, including findings the inventory work did not act on. |

## The three layers

The board must draw a ring, so it needs a number. The public record often has
none. These layers are kept separate and are never blurred.

**L1, observed.** The published value, carried with its condition. A range that
was published against a Group 1 target at a stated condition stays attached to
that condition.

**L2, representative.** No public value exists, but the role is documented. The
entry carries a planning figure and says so in the description a user reads on
the board. `SENSOR_ROLE_DEFAULT_RANGE_M` in `src/model/types.ts` is the usual
basis. A representative figure is not measured performance and must never be
cited as such in a test product.

**L3, user-defined.** The field is `null`. The app draws nothing and the user
decides. `null` always means unknown. `0` never does.

## Evidence grades

`VERIFIED` authoritative documentation · `CORROBORATED` two or more credible
independent sources · `REPORTED` credible single reporting ·
`MANUFACTURER_CLAIM` OEM datasheet or product page · `INFERRED` reasonable but
undocumented · `UNKNOWN` no public evidence.

An OEM claim is labelled as a claim, never as demonstrated performance.

## Range types are not interchangeable

Sources blur these constantly and the inventory does not:

- instrumented range, surveillance range, detection range, track range,
  classification range
- effective C-UAS engagement range, weapon maximum range, maximum RF output
- detection range, identification range, effect range

A weapon's maximum range against an aircraft is not its C-UAS engagement range.
A radar's instrumented range is not its detection range against a Group 1 UAS.

## Integration is not compatibility

An integration edge states one of: `DOCUMENTED_COMPATIBILITY`,
`PUBLICLY_DEMONSTRATED`, `FORMALLY_INTEGRATED`, `OPERATIONALLY_FIELDED`,
`DOCTRINALLY_ASSOCIATED`, `REPORTED`, `INFERRED`, `UNKNOWN`. Two systems that
each support a protocol are not integrated with each other.

In the app this maps to `IntegrationPair.confidence`: `documented` requires a
source that explicitly establishes the pairing, `probable` and `inferred` do
not. `evaluateIntegration` also falls back to a shared open standard and rates
that `probable`, with a note saying no pairing is published.

## Method

Nine domain research agents worked to a shared evidence standard, then three
independent red-team reviewers that did no original research tried to break
every record against twenty tests. A gap-fill pass filled component ids the
system presets needed. Records that failed review were cut, not softened. The
raw research and review artifacts are not committed; this directory is the
distilled result.

Two proposed corrections to shipped data were refuted during review and not
applied. Both are recorded in `changelog.md`, because a wrong correction to
shipped data is worse than no correction.

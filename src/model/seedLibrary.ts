/**
 * Seed spec library, researched from open sources (government documents,
 * manufacturer releases, DoD public statements, defense trade press).
 *
 * Values are planning figures, not authoritative performance data. Where the
 * public record gives no figure the field is null or the description says the
 * ring is a planning figure; a number is never invented to fill a blank.
 * Per-field lineage lives in the JSON data package under `data/library/`, and
 * in docs/inventory/, which also records what is unknown and why.
 *
 * The models themselves are compiled from that data package by
 * `scripts/build-library.mjs` (`npm run library:build`). This module only
 * re-exports them, so every import path in the app stays as it was.
 */

export { SEED_LIBRARY } from './seedLibrary.generated'

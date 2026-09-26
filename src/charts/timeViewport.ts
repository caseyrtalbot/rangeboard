/**
 * Run timeline viewport: the visible window `[t0S, t0S + winS]` of the time
 * axis. Pure: no React, no DOM. The contract is docs/timeline/SPEC.md
 * section 2.3.
 */

export interface TimeViewport {
  t0S: number
  winS: number
}

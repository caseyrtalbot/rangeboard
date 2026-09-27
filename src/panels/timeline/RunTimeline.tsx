/**
 * Run timeline strip (docs/timeline/SPEC.md section 1). App mounts it lazily inside
 * `.runtl-dock`, which holds the height. Contract stub: Phase 2 lane 2A builds the strip.
 */
export function RunTimeline() {
  return <div id="run-timeline" className="runtl" role="group" aria-label="Run timeline" />
}

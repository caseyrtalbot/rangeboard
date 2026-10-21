import type { CapOrbit, FlightPath } from '../model/types'
import { phaseLineLabel, phaseLines } from '../model/phaseLine'
import { useStore } from '../state/store'
import { Seg } from '../ui/kit'

type Then = 'stop' | 'egress'

/** The Then control of an ISR CAP: stop on the orbit, or egress across a phase line. */
export function CapExitField({ path, cap }: { path: FlightPath; cap: CapOrbit }) {
  const boundaries = useStore((s) => s.scenario.boundaries)
  const { updateCap } = useStore.getState()
  const lines = phaseLines(boundaries)
  const exit = cap.exit ?? null
  const mode: Then = exit ? 'egress' : 'stop'
  // A deleted or retyped line keeps the exit until the user picks again.
  const missing = exit != null && !lines.some((b) => b.id === exit.boundaryId)
  return (
    // A div frame, as the speed field: a wrapping label would press Stop on a label click.
    <div className="field">
      <span>Then</span>
      <Seg<Then>
        label="After the orbit"
        value={mode}
        // Seg disables as a whole; with no line and no exit, Stop is already set.
        disabled={lines.length === 0 && !exit}
        options={[
          { v: 'stop', label: 'Stop' },
          { v: 'egress', label: 'Egress' },
        ]}
        onChange={(v) => {
          if (v === 'stop') {
            if (exit) updateCap(path.id, { exit: null })
          } else if (!exit && lines.length > 0) {
            updateCap(path.id, { exit: { kind: 'egress', boundaryId: lines[0].id } })
          }
        }}
      />
      {exit && (
        <select
          aria-label="Egress line"
          value={exit.boundaryId}
          onChange={(e) =>
            updateCap(path.id, { exit: { kind: 'egress', boundaryId: e.target.value } })
          }
        >
          {missing && <option value={exit.boundaryId}>missing</option>}
          {lines.map((b) => (
            <option key={b.id} value={b.id}>
              {phaseLineLabel(b)}
            </option>
          ))}
        </select>
      )}
      {lines.length === 0 && (
        <p className="muted small">Draw a phase line first (Boundary tool).</p>
      )}
    </div>
  )
}

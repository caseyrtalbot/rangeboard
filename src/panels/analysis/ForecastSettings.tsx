/**
 * The Run section body on Prepare, Inputs: the run mode, the replicate count and
 * the seed on the panel grid (D5). The top bar holds the Run control; the stop
 * rule, what varies and the sensitivity depth stay in Settings, Run.
 */

import type { RunMode } from '../../model/types'
import { runSettings } from '../../model/types'
import { useStore } from '../../state/store'
import { Field, Seg } from '../../ui/kit'
import { IntInput } from '../settings/inputs'

/** The Run tab's bounds (`RunTab.tsx`): the seed is a 32-bit unsigned integer. */
const MIN_REPLICATES = 1
const MAX_REPLICATES = 10000
const MIN_SEED = 0
const MAX_SEED = 4294967295

const MODE_OPTIONS: Array<{ v: RunMode; label: string }> = [
  { v: 'monte-carlo', label: 'Monte Carlo' },
  { v: 'deterministic', label: 'Deterministic' },
]

/** Mode over two columns; Runs and Seed one column each, or the one-pass note. */
export function ForecastSettings() {
  const scenario = useStore((s) => s.scenario)
  const patchScenario = useStore((s) => s.patchScenario)
  const showHelp = useStore((s) => s.ui.showFieldHelp)
  const run = runSettings(scenario)
  return (
    <>
      <div className="pgrid">
        <div className="pg-2">
          <div className="field">
            <span>Mode</span>
            <Seg
              label="Run mode"
              value={run.runMode}
              options={MODE_OPTIONS}
              onChange={(runMode) => patchScenario({ runMode })}
            />
          </div>
        </div>
        {run.runMode === 'monte-carlo' ? (
          <>
            <div className="pg-1">
              <Field label="Runs">
                <IntInput
                  value={run.replicates}
                  min={MIN_REPLICATES}
                  max={MAX_REPLICATES}
                  onCommit={(replicates) => patchScenario({ replicates })}
                />
              </Field>
            </div>
            <div className="pg-1">
              <Field label="Seed">
                <IntInput
                  value={run.seed}
                  min={MIN_SEED}
                  max={MAX_SEED}
                  onCommit={(seed) => patchScenario({ seed })}
                />
              </Field>
            </div>
          </>
        ) : (
          <p className="pg-2 prep-run-note">
            One expected-value pass. Fragility and Placement need Monte Carlo.
          </p>
        )}
      </div>
      {showHelp && (
        <p className="field-help">
          Stop rule, what varies and sensitivity depth stay in Settings, Run.
        </p>
      )}
    </>
  )
}

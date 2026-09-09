import type { RunValidityFinding } from '../../analysis/runValidity'
import type { Entity, RunValidity } from '../../model/types'
import { useStore } from '../../state/store'
import type { StateTone } from '../../ui/kit'

/** The state word, the one-line reading and the state tone of each run validity. */
export const VALIDITY_TEXT: Record<RunValidity, { pill: string; line: string; tone: StateTone }> = {
  valid: {
    pill: 'VALID',
    line: 'No finding limits this run.',
    tone: 'nominal',
  },
  'valid-limited': {
    pill: 'VALID, LIMITED',
    line: 'The results stand, with the caveats below.',
    tone: 'warning',
  },
  invalid: {
    pill: 'INVALID',
    line: 'A gate below is not scored: the run never made that measurement.',
    tone: 'critical',
  },
  pending: {
    pill: 'PENDING',
    line: 'No track was assessed, so nothing has been measured yet.',
    tone: 'inactive',
  },
}

/** The state word and tone of each finding severity. */
export const SEVERITY_PILL: Record<RunValidityFinding['severity'], { text: string; tone: StateTone }> = {
  invalidating: { text: 'INVALIDATES', tone: 'critical' },
  limiting: { text: 'LIMITS', tone: 'warning' },
}

/** Selection exposes the existing threat editor without changing the laydown. */
// oxlint-disable-next-line react/only-export-components -- The validity words and this action share one module.
export function FindingThreatActions({ finding, entities }: {
  finding: RunValidityFinding
  entities: Entity[]
}) {
  if (finding.id !== 'spawn-in-ring') return null
  return (
    <div>
      {finding.uasIds.map((id) => (
        <button
          className="mini"
          type="button"
          key={id}
          onClick={() => {
            const store = useStore.getState()
            store.select({ entityIds: [id] })
            store.setRightTab('inspect')
          }}
        >
          Select {entities.find((entity) => entity.id === id)?.name ?? id}
        </button>
      ))}
    </div>
  )
}

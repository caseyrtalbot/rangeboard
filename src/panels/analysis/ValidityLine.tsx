import type { RunValidityAssessment } from '../../analysis/runValidity'
import type { Entity } from '../../model/types'
import type { BoardPhase } from '../../state/runState'
import { useStore } from '../../state/store'
import { IconChevronDown, IconChevronRight } from '../../ui/icons'
import { State } from '../../ui/kit'
import { FindingThreatActions, SEVERITY_PILL, VALIDITY_TEXT } from './runValidityText'

/** A finding that names every requirement gate is scenario-wide. */
const ALL_GATE_COUNT = 6

export interface ValidityLineProps {
  phase: BoardPhase
  /** Null before a completed trial in Analyze: the line reads PENDING. */
  assessment: RunValidityAssessment | null
  /** What the assessment read: the forecast picture or the completed trial. */
  source: 'forecast' | 'trial'
  entities: Entity[]
}

/**
 * D1: the one place in the panel where validity findings render. It shows the
 * state word, the count and a chevron, and opens in place. Execute shows it only
 * while the status bar holds it open (D10).
 */
export function ValidityLine({ phase, assessment, source, entities }: ValidityLineProps) {
  const open = useStore((s) => s.ui.validityOpen)
  if (phase === 'execute' && !open) return null
  const label = source === 'trial' ? 'Trial validity' : 'Forecast validity'
  if (assessment == null)
    return (
      <div className="vline vline-pending" id="validity-line">
        <span className="vline-label">{label}</span>
        <State tone={VALIDITY_TEXT.pending.tone} hollow>
          {VALIDITY_TEXT.pending.pill}
        </State>
        <span className="vline-count">No completed trial</span>
      </div>
    )
  const text = VALIDITY_TEXT[assessment.validity]
  // Setup findings that cost a measurement come first; general model caveats follow.
  const findings = [...assessment.findings].sort(
    (a, b) => Number(b.severity === 'invalidating') - Number(a.severity === 'invalidating'),
  )
  const count = `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}`
  return (
    <div className="vline-wrap">
      <button
        type="button"
        className="vline"
        id="validity-line"
        aria-expanded={open}
        aria-controls="validity-findings"
        title={text.line}
        onClick={() => useStore.getState().setValidityOpen(!open)}
      >
        <span className="vline-label">{label}</span>
        <State tone={text.tone}>{text.pill}</State>
        <span className="vline-count">{count}</span>
        <span className="vline-chev" aria-hidden="true">
          {open ? <IconChevronDown /> : <IconChevronRight />}
        </span>
      </button>
      <div className="vline-body" id="validity-findings" hidden={!open}>
        {open &&
          (findings.length === 0 ? (
            <p className="muted small">{text.line}</p>
          ) : (
            findings.map((finding) => {
              const severity = SEVERITY_PILL[finding.severity]
              const gates =
                finding.gates.length >= ALL_GATE_COUNT
                  ? 'Scenario-wide'
                  : finding.gates.length > 0
                    ? `Gates: ${finding.gates.map((gate) => gate.toUpperCase()).join(' · ')}`
                    : null
              return (
                <article className="vline-finding" key={finding.id}>
                  <State tone={severity.tone} title={severity.text}>
                    <span className="vline-sev">{severity.text}</span>
                  </State>
                  <span className="vline-msg">{finding.message}</span>
                  {gates && <span className="vline-gates">{gates}</span>}
                  {finding.id === 'no-defended-asset' && (
                    <span className="vline-act">
                      <button
                        type="button"
                        className="mini"
                        onClick={() => useStore.getState().openLibrary('asset')}
                      >
                        Place asset
                      </button>
                    </span>
                  )}
                  {finding.id === 'spawn-in-ring' && (
                    <span className="vline-select">
                      <FindingThreatActions finding={finding} entities={entities} />
                    </span>
                  )}
                </article>
              )
            })
          ))}
      </div>
    </div>
  )
}

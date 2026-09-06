import { useMemo } from 'react'
import { modelsUsed } from '../../../analysis/fidelity'
import type { RunValidityFinding } from '../../../analysis/runValidity'
import { assessRunValidity } from '../../../analysis/runValidity'
import type { RunValidity } from '../../../model/types'
import { useStore } from '../../../state/store'
import { useEngagement } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'
import { State } from '../../../ui/kit'
import type { StateTone } from '../../../ui/kit'

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

function metaOf(findings: RunValidityFinding[]): string {
  const invalidating = findings.filter((f) => f.severity === 'invalidating').length
  const limiting = findings.filter((f) => f.severity === 'limiting').length
  const parts = [
    invalidating > 0 ? `${invalidating} invalidating` : null,
    limiting > 0 ? `${limiting} limiting` : null,
  ].filter((p): p is string => p != null)
  return parts.length > 0 ? parts.join(' · ') : 'no findings'
}

/** Run validity: the status pill, its reading, and every finding with its severity. */
export function RunValidityWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  void params
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const { assessments } = useEngagement(scenario, runId)
  const validity = useMemo(() => assessRunValidity(scenario, assessments), [scenario, assessments])
  const tags = useMemo(() => modelsUsed(scenario), [scenario])
  const text = VALIDITY_TEXT[validity.validity]

  return (
    <WidgetFrame
      id={id}
      type="run-validity"
      title="Run validity"
      meta={metaOf(validity.findings)}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      <div className="valid">
        <State tone={text.tone}>{text.pill}</State>
        <span>{text.line}</span>
      </div>
      <div className="fid-tags">
        {tags.map((tag) => (
          <span
            className="fid-tag"
            key={tag.id}
            data-tier={tag.tier}
            data-validation={tag.validation}
            title={tag.note}
          >
            {tag.label} · {tag.tier} · {tag.validation}
          </span>
        ))}
      </div>
      {validity.findings.map((finding) => (
        <div className="validity-finding" key={finding.id}>
          <State tone={SEVERITY_PILL[finding.severity].tone}>
            {SEVERITY_PILL[finding.severity].text}
          </State>
          <span>{finding.message}</span>
        </div>
      ))}
    </WidgetFrame>
  )
}

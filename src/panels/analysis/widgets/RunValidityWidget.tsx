import { useMemo } from 'react'
import { modelsUsed } from '../../../analysis/fidelity'
import type { RunValidityFinding } from '../../../analysis/runValidity'
import { assessRunValidity } from '../../../analysis/runValidity'
import type { RunValidity } from '../../../model/types'
import { useStore } from '../../../state/store'
import { useEngagement } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

/** The pill, the one-line reading and the status class of each run validity. */
export const VALIDITY_TEXT: Record<RunValidity, { pill: string; line: string; cls: string }> = {
  valid: {
    pill: 'VALID',
    line: 'No finding limits this run.',
    cls: 'good',
  },
  'valid-limited': {
    pill: 'VALID, LIMITED',
    line: 'The results stand, with the caveats below.',
    cls: 'warn',
  },
  invalid: {
    pill: 'INVALID',
    line: 'A gate below is not scored: the run never made that measurement.',
    cls: 'bad',
  },
  pending: {
    pill: 'PENDING',
    line: 'No track was assessed, so nothing has been measured yet.',
    cls: 'neutral',
  },
}

/** The pill text and status class of each finding severity. */
export const SEVERITY_PILL: Record<RunValidityFinding['severity'], { text: string; cls: string }> = {
  invalidating: { text: 'INVALIDATES', cls: 'bad' },
  limiting: { text: 'LIMITS', cls: 'warn' },
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
        <span className={`status ${text.cls}`}>{text.pill}</span>
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
          <span className={`status ${SEVERITY_PILL[finding.severity].cls}`}>
            {SEVERITY_PILL[finding.severity].text}
          </span>
          <span>{finding.message}</span>
        </div>
      ))}
    </WidgetFrame>
  )
}

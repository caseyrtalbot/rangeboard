import { FULL_RUN, reached, type ExecutionHorizon } from '../../../analysis/horizon'
import { useState } from 'react'
import { formatTime } from '../../../geometry/geo'
import type { Scenario } from '../../../model/types'
import type { AttritionReport } from '../../../playback/attritionReport'
import { CHANNEL_LABEL, CHANNEL_SHORT } from '../../headlines'
import { useTrialResult, trialStateText } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

const EVENT_PAGE = 20

/**
 * The engagement event ledger, paged. With `upToS` only the events assigned
 * at or before that time are listed (the live view); without it every event
 * is listed (the completed record).
 */
export function EventLedgerList({
  scenario,
  report,
  upToS,
  horizon = FULL_RUN,
  basis = 'forecast',
}: {
  scenario: Scenario
  report: AttritionReport
  upToS?: number
  horizon?: ExecutionHorizon
  basis?: 'forecast' | 'trial'
}) {
  const [visible, setVisible] = useState(EVENT_PAGE)
  const name = (id: string) => scenario.entities.find((entity) => entity.id === id)?.name ?? id
  const events = report.events.filter((event) =>
    (upToS == null || event.tS <= upToS) && (!horizon.scoped || reached(event.tS, horizon)),
  )
  if (events.length === 0) {
    return (
      <p className="muted small">
        {upToS == null && !horizon.scoped ? 'No engagement events recorded.' : 'No engagement events yet.'}
      </p>
    )
  }
  return (
    <div className="event-ledger">
      {events.slice(0, visible).map((event, index) => (
        <div className="event-row" key={`${event.effectorId}:${event.uasId}:${event.tS}:${index}`}>
          <span className="event-time">
            {formatTime(event.tS)} → {horizon.scoped && !reached(event.tEffectS, horizon) ? '—' : formatTime(event.tEffectS)}
          </span>
          <span className="event-route">
            <strong>{name(event.effectorId)}</strong>
            <small>
              {name(event.uasId)} · ship {event.shipIdx + 1} ·{' '}
              <span title={`${CHANNEL_LABEL[event.channelClass]} expenditure`}>
                {CHANNEL_SHORT[event.channelClass]}
              </span>
            </small>
          </span>
          <span className="event-effect">
            P {horizon.scoped && !reached(event.tEffectS, horizon) ? '—' : `${(event.pk * 100).toFixed(1)}%`}
            <small>{basis === 'trial' ? 'Removed' : 'ΔE[k]'} {horizon.scoped && !reached(event.tEffectS, horizon) ? '—' : basis === 'trial' ? event.killDelta.toFixed(0) : event.killDelta.toFixed(3)}</small>
          </span>
        </div>
      ))}
      {visible < events.length && (
        <button className="load-more" onClick={() => setVisible((count) => count + EVENT_PAGE)}>
          Show next {Math.min(EVENT_PAGE, events.length - visible)} · {events.length - visible} remaining
        </button>
      )}
    </div>
  )
}

/** Events assigned by the cursor time. Nothing before the first play. */
export function EventLedgerWidget({ id, params, collapsed, customize, index, count, horizon }: WidgetProps) {
  void params
  const trial = useTrialResult()
  const { selection, snapshot } = trial
  const stateText = trialStateText(selection, snapshot?.observedThroughS)
  const report = selection.status === 'ready' && snapshot ? selection.result.report : null
  const shown = report?.events.filter((event) => event.tS <= trial.horizon).length ?? 0
  const trialHorizon = { scoped: true, horizonS: trial.horizon }

  return (
    <WidgetFrame
      id={id}
      horizon={horizon}
      type="event-ledger"
      title="Trial event ledger"
      meta={report ? `${stateText} · ${shown} events` : stateText}
      metaWithinHorizon
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {report && selection.status === 'ready' ? (
        <EventLedgerList scenario={selection.scenario} report={report} horizon={trialHorizon} basis="trial" />
      ) : <p className="muted small">{stateText}</p>}
    </WidgetFrame>
  )
}

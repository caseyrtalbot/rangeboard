import { useState } from 'react'
import { formatTime } from '../../../geometry/geo'
import type { Scenario } from '../../../model/types'
import type { AttritionReport } from '../../../playback/attrition'
import { useStore } from '../../../state/store'
import { CHANNEL_LABEL, CHANNEL_SHORT } from '../../headlines'
import { useEngagement, useRunCursor } from './controls'
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
}: {
  scenario: Scenario
  report: AttritionReport
  upToS?: number
}) {
  const [visible, setVisible] = useState(EVENT_PAGE)
  const name = (id: string) => scenario.entities.find((entity) => entity.id === id)?.name ?? id
  const events = upToS == null ? report.events : report.events.filter((event) => event.tS <= upToS)
  if (events.length === 0) {
    return (
      <p className="muted small">
        {upToS == null ? 'No engagement events recorded.' : 'No engagement events yet.'}
      </p>
    )
  }
  return (
    <div className="event-ledger">
      {events.slice(0, visible).map((event, index) => (
        <div className="event-row" key={`${event.effectorId}:${event.uasId}:${event.tS}:${index}`}>
          <span className="event-time">
            {formatTime(event.tS)} → {formatTime(event.tEffectS)}
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
            P {`${(event.pk * 100).toFixed(1)}%`}
            <small>ΔE[k] {event.killDelta.toFixed(3)}</small>
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
export function EventLedgerWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  void params
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const { assessments, report } = useEngagement(scenario, runId)
  const { t, untouched } = useRunCursor(scenario)
  const upToS = untouched ? -1 : t
  const shown = report.events.filter((event) => event.tS <= upToS).length
  const threats = assessments.filter((a) => a.status !== 'no-path').length

  return (
    <WidgetFrame
      id={id}
      type="event-ledger"
      title="Event ledger"
      meta={`planning envelope · ${shown} of ${report.events.length}`}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {threats === 0 ? (
        <p className="muted small">No threats with flight paths.</p>
      ) : (
        <EventLedgerList scenario={scenario} report={report} upToS={upToS} />
      )}
    </WidgetFrame>
  )
}

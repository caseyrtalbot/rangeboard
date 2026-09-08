import { useMemo } from 'react'
import { trialThreatPictureAt } from '../../../analysis/threatAggregation'
import { selectEffectiveLayers } from '../../../state/selectors'
import { useStore } from '../../../state/store'
import { ThreatPicture } from '../ThreatPicture'
import { useTrialResult, trialViewOf, trialStateText } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

function WezCheck() {
  const threatWez = useStore((s) => selectEffectiveLayers(s).threatWez)
  const setLayer = useStore((s) => s.setLayer)
  return (
    <label className="adv-toggle" title="Draw threat weapon engagement zones on the canvas">
      <input
        type="checkbox"
        checked={threatWez}
        onChange={(event) => setLayer('threatWez', event.target.checked)}
      />
      WEZ
    </label>
  )
}

/** The live threat picture at the cursor: one chip ladder per group, members on demand. */
export function ThreatPictureWidget({ id, params, collapsed, customize, index, count, horizon }: WidgetProps) {
  const trial = useTrialResult()
  const view = trialViewOf(trial)
  const groups = useMemo(() => view ? trialThreatPictureAt(view, trial.horizon) : [], [view, trial.horizon])
  const tracks = groups.reduce((sum, group) => sum + group.tracks, 0)
  const detected = groups.reduce((sum, group) => sum + group.detected, 0)
  const stateText = trialStateText(trial.selection, trial.snapshot?.observedThroughS)

  return (
    <WidgetFrame
      id={id}
      horizon={horizon}
      type="threat-picture"
      title="Trial threat picture"
      metaWithinHorizon
      meta={view ? `${stateText} · ${detected}/${tracks} detected` : stateText}
      headerExtra={<WezCheck />}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {!view ? <p className="muted small">{stateText}</p> : <ThreatPicture groups={groups} mode="live" membersOpen={params.expanded === true} />}
    </WidgetFrame>
  )
}

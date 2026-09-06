import { memo, useMemo, useState } from 'react'
import { buildAarSummary } from '../analysis/aar'
import { engagementPicture } from '../analysis/impact'
import type { WidgetType } from '../state/analysisLayout'
import { BUILTIN_LENSES, WIDGET_TYPES } from '../state/analysisLayout'
import { useStore } from '../state/store'
import { selectDurationS, selectRunComplete } from '../state/selectors'
import { DebriefRecord } from './analysis/DebriefRecord'
import { DetailPane, hasDetailPane } from './analysis/detail'
import { LiveStrip } from './analysis/LiveStrip'
import { WIDGETS } from './analysis/widgets/registry'
import type { WidgetProps } from './analysis/widgets/registry'

/**
 * Every widget subscribes to the store on its own, so a panel render must not
 * cascade into the stack. The props the panel passes are stable between
 * layout edits, so `memo` holds each widget until its own selectors move.
 */
const MEMO_WIDGETS = {} as Record<WidgetType, React.ComponentType<WidgetProps>>
for (const type of WIDGET_TYPES) MEMO_WIDGETS[type] = memo(WIDGETS[type].component)

/** Lens bar: the built-in lenses, the user presets, then the customize toggle. */
function LensBar() {
  const presetId = useStore((state) => state.ui.analysis.layout.presetId)
  const userPresets = useStore((state) => state.ui.analysis.userPresets)
  const customize = useStore((state) => state.ui.analysisCustomize)
  const applyLens = useStore((state) => state.applyLens)
  const setCustomize = useStore((state) => state.setAnalysisCustomize)
  const deletePreset = useStore((state) => state.deleteAnalysisPreset)
  return (
    <div className="lens" role="tablist" aria-label="Analysis lenses">
      {BUILTIN_LENSES.map((preset) => (
        <button
          key={preset.id}
          className={`lens-b${preset.id === presetId ? ' on' : ''}`}
          role="tab"
          aria-selected={preset.id === presetId}
          onClick={() => applyLens(preset.id)}
        >
          {preset.label}
        </button>
      ))}
      {userPresets.length > 0 ? <span className="lens-sp" /> : null}
      {userPresets.map((preset) => (
        <button
          key={preset.id}
          className={`lens-b user${preset.id === presetId ? ' on' : ''}`}
          role="tab"
          aria-selected={preset.id === presetId}
          onClick={() => applyLens(preset.id)}
        >
          {preset.label}
          {customize ? (
            <span
              className="lens-x"
              aria-label="Delete preset"
              onClick={(event) => {
                event.stopPropagation()
                deletePreset(preset.id)
              }}
            >
              ×
            </span>
          ) : null}
        </button>
      ))}
      <button
        className={`lens-b cust${customize ? ' on' : ''}`}
        aria-pressed={customize}
        onClick={() => setCustomize(!customize)}
      >
        {customize ? 'Done' : 'Customize'}
      </button>
    </div>
  )
}

/** Customize row: one button per catalog widget type, appended to the stack. */
function AddWidgetRow() {
  const addWidget = useStore((state) => state.addAnalysisWidget)
  return (
    <div className="add">
      <span className="wg-t">Add widget</span>
      <div className="cat">
        {WIDGET_TYPES.map((type) => (
          <button key={type} className="mini" onClick={() => addWidget(type)}>
            {`+ ${WIDGETS[type].label}`}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Customize row: name the live stack and keep it as a user lens. */
function SavePresetRow() {
  const savePreset = useStore((state) => state.saveAnalysisPreset)
  const [label, setLabel] = useState('')
  const trimmed = label.trim()
  return (
    <div className="save">
      <input
        aria-label="Preset name"
        placeholder="Preset name"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <button
        className="mini"
        disabled={trimmed === ''}
        onClick={() => {
          savePreset(trimmed)
          setLabel('')
        }}
      >
        Save as preset
      </button>
    </div>
  )
}

/**
 * Run header, lens bar, then the widget stack the active lens defines. Each
 * widget computes what it shows, so this panel holds no analysis of its own.
 * One selected entity with a pane replaces the stack with its detail. The
 * selection is view state, so it never writes the lens or the preset id.
 */
export function AnalysisPanel() {
  const scenario = useStore((state) => state.scenario)
  const entityIds = useStore((state) => state.selection.entityIds)
  const runId = useStore((state) => state.playback.runId)
  const complete = useStore(selectRunComplete)
  const widgets = useStore((state) => state.ui.analysis.layout.widgets)
  const customize = useStore((state) => state.ui.analysisCustomize)
  const durationS = useStore(selectDurationS)
  const { assessments, report, impacts } = useMemo(() => {
    void runId
    return engagementPicture(scenario)
  }, [scenario, runId])
  // The AAR summary feeds the debrief record alone, so it is built only once
  // the run completes.
  const aar = useMemo(
    () => (complete ? buildAarSummary(scenario, assessments, report, impacts) : null),
    [complete, scenario, assessments, report, impacts],
  )
  const threats = assessments.filter((assessment) => assessment.status !== 'no-path')
  const noPath = assessments.length - threats.length

  // Every hook above runs on each render. The branch stays after them.
  const selected =
    entityIds.length === 1 ? scenario.entities.find((e) => e.id === entityIds[0]) : undefined
  const detailId = selected && hasDetailPane(selected.kind) ? selected.id : null

  if (detailId) {
    return (
      <div className="inspector-body analysis-panel">
        <LiveStrip />
        <DetailPane entityId={detailId} />
      </div>
    )
  }

  return (
    <div className="inspector-body analysis-panel">
      <LiveStrip />

      <LensBar />

      {entityIds.length >= 2 && (
        <p className="muted analysis-empty">
          {entityIds.length} entities selected. Select one for its detail.
        </p>
      )}

      {assessments.length === 0 && (
        <p className="muted analysis-empty">Place a UAS threat on the canvas to analyze it.</p>
      )}
      {noPath > 0 && (
        <p className="muted analysis-empty">
          {noPath} UAS without a flight path. Draw a path to include it in run data.
        </p>
      )}

      {complete && aar && (
        <DebriefRecord
          scenario={scenario}
          assessments={assessments}
          report={report}
          aar={aar}
          durationS={durationS}
        />
      )}

      {widgets.map((instance, index) => {
        const Widget = MEMO_WIDGETS[instance.type]
        return (
          <Widget
            key={instance.id}
            id={instance.id}
            params={instance.params}
            collapsed={instance.collapsed}
            customize={customize}
            index={index}
            count={widgets.length}
          />
        )
      })}

      {customize && <AddWidgetRow />}
      {customize && <SavePresetRow />}
    </div>
  )
}

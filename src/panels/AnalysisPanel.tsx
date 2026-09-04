import { useMemo, useState } from 'react'
import { buildAarSummary } from '../analysis/aar'
import { engagementPicture } from '../analysis/impact'
import { BUILTIN_LENSES, WIDGET_TYPES } from '../state/analysisLayout'
import { scenarioDurationS, useStore } from '../state/store'
import { AnalysisSection } from './analysis/AnalysisSection'
import { DebriefRecord } from './analysis/DebriefRecord'
import { LiveStrip } from './analysis/LiveStrip'
import { AboutProjection } from './analysis/widgets/ProjectionWidget'
import { WIDGETS } from './analysis/widgets/registry'

/**
 * Explicit boundary around conditional full-run output. Live and completed
 * evidence remain separate so a future event never reads as observed data.
 */
export function FullRunProjection({ children }: { children: React.ReactNode }) {
  return (
    <AnalysisSection
      title="Full-run projection"
      headline="not live · conditional"
      headerExtra={<AboutProjection />}
    >
      {children}
    </AnalysisSection>
  )
}

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
 */
export function AnalysisPanel() {
  const scenario = useStore((state) => state.scenario)
  const runId = useStore((state) => state.playback.runId)
  const completedAtMs = useStore((state) => state.playback.completedAtMs)
  const observedThroughS = useStore((state) => state.playback.observedThroughS)
  const widgets = useStore((state) => state.ui.analysis.layout.widgets)
  const customize = useStore((state) => state.ui.analysisCustomize)
  const durationS = useMemo(() => scenarioDurationS(scenario), [scenario])
  const { assessments, report, impacts } = useMemo(() => {
    void runId
    return engagementPicture(scenario)
  }, [scenario, runId])
  const aar = useMemo(
    () => buildAarSummary(scenario, assessments, report, impacts),
    [scenario, assessments, report, impacts],
  )
  const threats = assessments.filter((assessment) => assessment.status !== 'no-path')
  const noPath = assessments.length - threats.length
  const complete = completedAtMs != null && durationS > 0 && observedThroughS >= durationS

  return (
    <div className="inspector-body analysis-panel">
      <LiveStrip />

      <LensBar />

      {assessments.length === 0 && (
        <p className="muted analysis-empty">Place a UAS threat on the canvas to analyze it.</p>
      )}
      {noPath > 0 && (
        <p className="muted analysis-empty">
          {noPath} UAS without a flight path. Draw a path to include it in run data.
        </p>
      )}

      {complete && (
        <DebriefRecord
          scenario={scenario}
          assessments={assessments}
          report={report}
          aar={aar}
          durationS={durationS}
        />
      )}

      {widgets.map((instance, index) => {
        const Widget = WIDGETS[instance.type].component
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

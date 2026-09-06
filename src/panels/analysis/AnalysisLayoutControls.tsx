import { useEffect, useRef, useState } from 'react'
import { WIDGET_TYPES } from '../../state/analysisLayout'
import { useStore } from '../../state/store'
import { WIDGETS } from './widgets/registry'

export interface AnalysisLayoutControlsProps {
  id: string
  triggerId?: string
  onClose: (restoreFocus?: boolean) => void
  onNavigate?: () => void
}

/** Non-modal layout surface for presets, widget editing and saved layouts. */
export function AnalysisLayoutControls({
  id,
  triggerId,
  onClose,
  onNavigate,
}: AnalysisLayoutControlsProps) {
  const userPresets = useStore((state) => state.ui.analysis.userPresets)
  const presetId = useStore((state) => state.ui.analysis.layout.presetId)
  const customize = useStore((state) => state.ui.analysisCustomize)
  const applyLens = useStore((state) => state.applyLens)
  const deletePreset = useStore((state) => state.deleteAnalysisPreset)
  const addWidget = useStore((state) => state.addAnalysisWidget)
  const savePreset = useStore((state) => state.saveAnalysisPreset)
  const setCustomize = useStore((state) => state.setAnalysisCustomize)
  const [label, setLabel] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const trimmed = label.trim()

  useEffect(() => {
    rootRef.current?.focus()
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      const trigger = triggerId ? document.getElementById(triggerId) : null
      if (!rootRef.current?.contains(target) && !trigger?.contains(target)) onClose(false)
    }
    const dismissWithEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('pointerdown', dismissOutside, true)
    document.addEventListener('keydown', dismissWithEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true)
      document.removeEventListener('keydown', dismissWithEscape)
    }
  }, [onClose, triggerId])

  return (
    <div
      ref={rootRef}
      className="analysis-layout-popover"
      id={id}
      role="dialog"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
    >
      <div className="analysis-layout-head">
        <h3 id={`${id}-title`}>Analysis layout</h3>
        <button
          className="analysis-layout-close"
          type="button"
          aria-label="Close analysis layout"
          onClick={() => onClose()}
        >
          ×
        </button>
      </div>

      <section className="analysis-layout-section" aria-labelledby={`${id}-presets-title`}>
        <h4 id={`${id}-presets-title`}>Saved layouts</h4>
        <div className="analysis-layout-presets">
          {userPresets.length === 0 ? (
            <p className="muted small">No saved layouts.</p>
          ) : (
            userPresets.map((preset) => (
              <div className="analysis-layout-preset" key={preset.id}>
                <button
                  className="analysis-layout-preset-apply"
                  type="button"
                  aria-pressed={preset.id === presetId}
                  onClick={() => {
                    applyLens(preset.id)
                    onNavigate?.()
                    onClose()
                  }}
                >
                  {preset.label}
                </button>
                <button
                  className="analysis-layout-preset-delete"
                  type="button"
                  aria-label={`Delete ${preset.label} layout`}
                  onClick={() => deletePreset(preset.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="analysis-layout-section" aria-labelledby={`${id}-widgets-title`}>
        <h4 id={`${id}-widgets-title`}>Widgets</h4>
        <button
          className="analysis-layout-customize"
          type="button"
          aria-pressed={customize}
          onClick={() => {
            setCustomize(!customize)
            if (!customize) onNavigate?.()
            onClose()
          }}
        >
          {customize ? 'Finish widget editing' : 'Edit widget layout'}
        </button>
        <div className="analysis-layout-catalog" role="group" aria-label="Add analysis widget">
          {WIDGET_TYPES.map((type) => (
            <button
              key={type}
              className="mini"
              type="button"
              onClick={() => {
                addWidget(type)
                if (!customize) setCustomize(true)
                onNavigate?.()
                onClose()
              }}
            >
              {`+ ${WIDGETS[type].label}`}
            </button>
          ))}
        </div>
      </section>

      <form
        className="analysis-layout-save"
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed === '') return
          savePreset(trimmed)
          setLabel('')
        }}
      >
        <label htmlFor={`${id}-name`}>Save current layout</label>
        <div>
          <input
            id={`${id}-name`}
            placeholder="Layout name"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <button className="mini" type="submit" disabled={trimmed === ''}>
            Save
          </button>
        </div>
      </form>
    </div>
  )
}

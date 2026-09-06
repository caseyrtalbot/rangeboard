import { useCallback, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { BUILTIN_LENSES } from '../../state/analysisLayout'
import { useStore } from '../../state/store'
import { AnalysisLayoutControls } from './AnalysisLayoutControls'

interface AnalysisNavigationProps {
  onNavigate?: () => void
}

/** Persistent analysis view navigation and the user-owned lens controls. */
export function AnalysisNavigation({ onNavigate }: AnalysisNavigationProps) {
  const presetId = useStore((state) => state.ui.analysis.layout.presetId)
  const customize = useStore((state) => state.ui.analysisCustomize)
  const applyLens = useStore((state) => state.applyLens)
  const selectedBuiltin = BUILTIN_LENSES.findIndex((preset) => preset.id === presetId)
  const [rovingIndex, setRovingIndex] = useState(() => Math.max(selectedBuiltin, 0))
  const [layoutOpen, setLayoutOpen] = useState(false)
  const layoutButtonRef = useRef<HTMLButtonElement>(null)
  const layoutId = `${useId()}-analysis-layout`
  const layoutTriggerId = `${layoutId}-trigger`
  const tabbableIndex = selectedBuiltin >= 0 ? selectedBuiltin : rovingIndex

  const navigate = (id: string) => {
    applyLens(id)
    onNavigate?.()
  }

  const closeLayout = useCallback((restoreFocus = true) => {
    setLayoutOpen(false)
    if (restoreFocus) setTimeout(() => layoutButtonRef.current?.focus(), 0)
  }, [])

  const handleBuiltinKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % BUILTIN_LENSES.length
    else if (event.key === 'ArrowLeft') {
      next = (index - 1 + BUILTIN_LENSES.length) % BUILTIN_LENSES.length
    } else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = BUILTIN_LENSES.length - 1
    else return

    event.preventDefault()
    setRovingIndex(next)
    navigate(BUILTIN_LENSES[next].id)
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus()
  }

  return (
    <nav className="lens" aria-label="Analysis navigation">
      <div className="lens-builtins" role="tablist" aria-label="Analysis lenses">
        {BUILTIN_LENSES.map((preset, index) => (
          <button
            key={preset.id}
            className={`lens-b${preset.id === presetId ? ' on' : ''}`}
            type="button"
            role="tab"
            aria-selected={preset.id === presetId}
            tabIndex={index === tabbableIndex ? 0 : -1}
            onClick={() => navigate(preset.id)}
            onKeyDown={(event) => handleBuiltinKeyDown(event, index)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="lens-layout">
        <button
          ref={layoutButtonRef}
          className={`lens-b lens-layout-trigger${layoutOpen || customize ? ' on' : ''}`}
          id={layoutTriggerId}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={layoutOpen}
          aria-controls={layoutId}
          onClick={() => setLayoutOpen((open) => !open)}
        >
          {customize ? 'Layout · editing' : 'Layout'}
        </button>
        {layoutOpen ? (
          <AnalysisLayoutControls
            id={layoutId}
            triggerId={layoutTriggerId}
            onClose={closeLayout}
            onNavigate={onNavigate}
          />
        ) : null}
      </div>
    </nav>
  )
}

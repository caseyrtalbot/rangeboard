import { memo, useCallback, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { BUILTIN_LENSES } from '../../state/analysisLayout'
import { useStore } from '../../state/store'
import { nextTabIndex } from '../../ui/rovingTabs'
import { AnalysisLayoutControls } from './AnalysisLayoutControls'

interface AnalysisNavigationProps {
  onNavigate?: () => void
}

/**
 * Persistent analysis view navigation and the user-owned lens controls. The lens
 * buttons stay rendered in every phase, so they are a toggle group with
 * `aria-pressed`, never a tablist. Memoized: `App` passes one stable
 * `onNavigate`, so its selection renders stop here.
 */
export const AnalysisNavigation = memo(function AnalysisNavigation({ onNavigate }: AnalysisNavigationProps) {
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
    const next = nextTabIndex(event.key, index, BUILTIN_LENSES.length)
    if (next < 0) return

    event.preventDefault()
    setRovingIndex(next)
    navigate(BUILTIN_LENSES[next].id)
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('button')
      [next]?.focus()
  }

  return (
    <nav className="lens" aria-label="Analysis navigation">
      <div className="lens-builtins" role="group" aria-label="Analysis lenses">
        {BUILTIN_LENSES.map((preset, index) => (
          <button
            key={preset.id}
            className={`lens-b${preset.id === presetId ? ' on' : ''}`}
            type="button"
            aria-pressed={preset.id === presetId}
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
})

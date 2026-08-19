import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import type { RightTab } from './state/store'
import { CanvasStage } from './canvas/CanvasStage'
import { Toolbar } from './panels/Toolbar'
import { Palette } from './panels/Palette'
import { Inspector } from './panels/Inspector'
import { LibraryEditor } from './panels/LibraryEditor'
import { TestCardsPanel } from './panels/TestCardsPanel'
import { AnalysisPanel } from './panels/AnalysisPanel'
import { TimelineBar } from './panels/TimelineBar'

const TABS: { id: RightTab; label: string }[] = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'cards', label: 'Test cards' },
  { id: 'library', label: 'Model' },
  { id: 'analysis', label: 'Analysis' },
]

function isTypingTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  )
}

/** Modal shown when both calibration points are placed. */
function CalibrateDialog() {
  const a = useStore((s) => s.ui.calibrateA)
  const b = useStore((s) => s.ui.calibrateB)
  const { applyCalibration, cancelDraft, setTool } = useStore.getState()
  const [value, setValue] = useState('')

  useEffect(() => {
    if (a && b) setValue('')
  }, [a, b])

  if (!a || !b) return null
  return (
    <div className="dialog">
      <div className="dialog-title">Calibrate image scale</div>
      <label className="field">
        <span>True distance between A and B (meters)</span>
        <input
          autoFocus
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && Number(value) > 0) applyCalibration(Number(value))
          }}
        />
      </label>
      <div className="inspector-actions">
        <button
          onClick={() => {
            cancelDraft()
            setTool('select')
          }}
        >
          Cancel
        </button>
        <button
          className="primary"
          disabled={!(Number(value) > 0)}
          onClick={() => applyCalibration(Number(value))}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const rightTab = useStore((s) => s.ui.rightTab)
  const setRightTab = useStore((s) => s.setRightTab)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const st = useStore.getState()
      if (isTypingTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        st.deleteSelection()
        return
      }
      if (e.key === 'Escape') {
        st.cancelDraft()
        st.setTool('select')
        st.clearSelection()
        return
      }
      if (e.key === 'Enter') {
        if (st.ui.tool === 'boundary') st.finishBoundary(true)
        if (st.ui.tool === 'path') st.finishPath()
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        st.setPlaying(!st.playback.playing)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <Palette />
        <div className="center">
          <CanvasStage />
          <TimelineBar />
        </div>
        <aside className="right-panel">
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={rightTab === t.id ? 'active' : ''}
                onClick={() => setRightTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {rightTab === 'inspect' && <Inspector />}
          {rightTab === 'cards' && <TestCardsPanel />}
          {rightTab === 'library' && <LibraryEditor />}
          {rightTab === 'analysis' && <AnalysisPanel />}
        </aside>
      </div>
      <CalibrateDialog />
    </div>
  )
}

import { useRef } from 'react'
import { importUnderlayImage } from '../io/persist'
import { usePopover } from '../ui/usePopover'
import { useStore } from '../state/store'

/** Scenario-scoped range geometry and calibrated-image controls. */
export function RangeSetupMenu({ onSelectTool }: { onSelectTool?: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = usePopover(wrapRef, buttonRef)

  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`tb-menu ${open ? 'active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="range-setup-menu-panel"
        title="Scenario-scoped range geometry and image calibration"
        onClick={toggle}
      >
        Range setup <span className="tb-caret">▾</span>
      </button>
      {open && (
        <RangeSetupMenuPanel onRequestClose={() => setOpen(false)} onSelectTool={onSelectTool} />
      )}
    </div>
  )
}

export function RangeSetupMenuPanel({
  onRequestClose,
  onSelectTool,
}: {
  onRequestClose: () => void
  onSelectTool?: () => void
}) {
  const moveUnderlay = useStore((s) => s.ui.moveUnderlay)
  const opacity = useStore((s) => s.scenario.underlay.opacity)
  const { setLocationDialogOpen, setMoveUnderlay, setTool, updateUnderlay } = useStore.getState()

  return (
    <div
      id="range-setup-menu-panel"
      className="tb-menu-panel range-setup-menu-panel"
      role="dialog"
      aria-label="Range setup"
    >
      <div className="tb-menu-head">Range geometry</div>
      <div className="tb-menu-scope">Scenario scope</div>
      <button
        type="button"
        className="tb-menu-item"
        onClick={() => {
          onRequestClose()
          setLocationDialogOpen(true)
        }}
      >
        Location…
      </button>
      <button
        type="button"
        className="tb-menu-item"
        onClick={() => {
          onRequestClose()
          importUnderlayImage()
        }}
      >
        Image…
      </button>
      <button
        type="button"
        className="tb-menu-item"
        onClick={() => {
          onSelectTool?.()
          setTool('calibrate')
          onRequestClose()
        }}
      >
        Calibrate scale
      </button>
      <label className="tb-menu-item tb-menu-row">
        <input
          type="checkbox"
          checked={moveUnderlay}
          onChange={(e) => setMoveUnderlay(e.target.checked)}
        />
        Move image
      </label>
      <label className="tb-menu-item tb-menu-row">
        Opacity
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          aria-label="Image opacity"
          onChange={(e) => updateUnderlay({ opacity: Number(e.target.value) })}
        />
      </label>
    </div>
  )
}

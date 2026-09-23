import { useContext, useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { RequirementSettings } from './analysis/RequirementSettings'
import { ThemeSettings, UnitsSettings, BasemapSettings, LayerSettings } from './ViewMenu'
import { RunTab } from './settings/RunTab'
import { OpenInputsContext } from './settings/openInputs'
import { SystemsTab } from './settings/SystemsTab'
import { PhysicsTab } from './settings/PhysicsTab'

export type SettingsSection = 'scenario' | 'run' | 'systems' | 'physics' | 'view'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'scenario', label: 'Scenario' },
  { id: 'run', label: 'Forecast and analysis' },
  { id: 'systems', label: 'Systems' },
  { id: 'physics', label: 'Physics' },
  { id: 'view', label: 'View' },
]

/** Mounted per opening; navigation is local and never enters scenario history. */
export function SettingsPanel({
  initialSection = 'scenario',
  onRequestClose,
}: {
  initialSection?: SettingsSection
  onRequestClose: () => void
}) {
  const [section, setSection] = useState(initialSection)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const setBoardPhase = useStore((state) => state.setBoardPhase)
  const setRightTab = useStore((state) => state.setRightTab)
  const openPreparation = useContext(OpenInputsContext)

  // Prepare > Inputs is the one editor for Fire doctrine and Environment.
  function openInputs() {
    onRequestClose()
    if (openPreparation) return openPreparation()
    setBoardPhase('prepare')
    setRightTab('analysis')
  }

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    return () => {
      dialog?.close()
      opener?.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      id="settings-panel"
      className="tb-menu-panel surface-float settings-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault()
        onRequestClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onRequestClose()
      }}
    >
      <header className="settings-header">
        <h2 id="settings-title">Settings</h2>
        <button type="button" onClick={onRequestClose} aria-label="Close Settings">
          Close
        </button>
      </header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={section === item.id}
              aria-controls="settings-body"
              className={section === item.id ? 'active' : ''}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div id="settings-body" className="settings-body" key={section}>
          {section === 'scenario' && (
            <>
              <section
                className="settings-block prepare-setting-body"
                aria-label="Fire doctrine and Environment"
              >
                <h3>Fire doctrine and Environment</h3>
                <p>Edit ROE, doctrine and conditions in Prepare &gt; Inputs.</p>
                <div className="prepare-setting-controls">
                  <button type="button" onClick={openInputs}>
                    Open Prepare &gt; Inputs
                  </button>
                </div>
              </section>
              <section
                className="settings-block prepare-setting-body"
                aria-label="Requirement inputs"
              >
                <h3>Requirement inputs</h3>
                <p>Set test thresholds; unspecified inputs remain unspecified.</p>
                <RequirementSettings />
              </section>
            </>
          )}
          {section === 'run' && (
            <section
              className="settings-block prepare-setting-body"
              aria-label="Forecast and analysis"
            >
              <h3>Forecast and analysis</h3>
              <p>
                Every setting a replicate run reads, with its default beside it. The Run button
                itself sits on Prepare and on Analyze.
              </p>
              <RunTab />
            </section>
          )}
          {section === 'systems' && (
            <section className="settings-block prepare-setting-body" aria-label="Systems">
              <h3>Systems</h3>
              <p>
                Every library field the placed systems use, with its grade, layer, source and
                spread. An override replaces a value on this board only and records why.
              </p>
              <SystemsTab />
            </section>
          )}
          {section === 'physics' && (
            <section className="settings-block prepare-setting-body" aria-label="Physics">
              <h3>Physics</h3>
              <p>
                Checked switches select fallbacks and lower the next run record to fallback. Reset
                clears all switches.
              </p>
              <PhysicsTab />
            </section>
          )}
          {section === 'view' && (
            <section className="settings-view" aria-label="View settings">
              <ThemeSettings />
              <UnitsSettings />
              <BasemapSettings />
              <LayerSettings />
            </section>
          )}
        </div>
      </div>
    </dialog>
  )
}

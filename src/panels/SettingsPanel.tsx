import { useEffect, useRef, useState } from 'react'
import { ForecastSettings } from './analysis/ForecastSettings'
import { FireDoctrineSettings } from './analysis/FireDoctrineSettings'
import { EnvironmentSettings } from './analysis/EnvironmentSettings'
import { RequirementSettings } from './analysis/RequirementSettings'
import { ThemeSettings, UnitsSettings, BasemapSettings, LayerSettings } from './ViewMenu'

export type SettingsSection = 'scenario' | 'run' | 'view'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'scenario', label: 'Scenario' },
  { id: 'run', label: 'Forecast and analysis' },
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
    <dialog ref={dialogRef} id="settings-panel" className="tb-menu-panel settings-panel"
      role="dialog" aria-modal="true" aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault()
        onRequestClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) onRequestClose()
      }}>
      <header className="settings-header">
        <h2 id="settings-title">Settings</h2>
        <button type="button" onClick={onRequestClose} aria-label="Close Settings">Close</button>
      </header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" aria-pressed={section === item.id}
              aria-controls="settings-body" className={section === item.id ? 'active' : ''}
              onClick={() => setSection(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div id="settings-body" className="settings-body" key={section}>
          {section === 'scenario' && (
            <>
              <section className="settings-block prepare-setting-body" aria-label="Fire doctrine">
                <h3>Fire doctrine</h3>
                <p>ROE and doctrine govern modeled engagement eligibility and timing.</p>
                <FireDoctrineSettings />
              </section>
              <section className="settings-block prepare-setting-body" aria-label="Environment">
                <h3>Environment</h3>
                <p>Conditions affect modeled performance when effects are enabled.</p>
                <EnvironmentSettings />
              </section>
              <section className="settings-block prepare-setting-body" aria-label="Requirement inputs">
                <h3>Requirement inputs</h3>
                <p>Set test thresholds; unspecified inputs remain unspecified.</p>
                <RequirementSettings />
              </section>
            </>
          )}
          {section === 'run' && (
            <section className="settings-block prepare-setting-body" aria-label="Forecast and analysis">
              <h3>Forecast and analysis</h3>
              <ForecastSettings />
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

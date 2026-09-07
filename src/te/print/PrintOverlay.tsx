/**
 * Print overlay: shows a light-themed paper preview of one artifact and calls
 * window.print(). @media print CSS in index.css hides the app shell and keeps
 * only .print-root. Artifacts render tablet-first and print-equivalent.
 */

import { createPortal } from 'react-dom'
import { ErrorBoundary } from '../../ui/ErrorBoundary'

export function PrintOverlay({
  title,
  onClose,
  onExport,
  children,
}: {
  title: string
  onClose: () => void
  onExport: () => void
  children: React.ReactNode
}) {
  // Portal to body: @media print hides .app, so the overlay must live outside it.
  return createPortal(
    <div className="print-overlay">
      <div className="print-toolbar">
        <strong>{title}</strong>
        <div className="spacer" />
        <button className="primary" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="print-root">
        <ErrorBoundary label={title} onExport={onExport}>{children}</ErrorBoundary>
      </div>
    </div>,
    document.body,
  )
}

/** Labeled value row inside a print section. */
export function PRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="p-row">
      <div className="p-label">{label}</div>
      <div className="p-value">{value}</div>
    </div>
  )
}

/** Numbered print section with a heading bar. */
export function PSection({
  n,
  title,
  children,
}: {
  n?: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="p-section">
      <h3>
        {n != null ? `${n}. ` : ''}
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Fill-in line for handwritten field entries on paper. */
export function PBlank({ label }: { label: string }) {
  return (
    <div className="p-row">
      <div className="p-label">{label}</div>
      <div className="p-value p-blank" />
    </div>
  )
}

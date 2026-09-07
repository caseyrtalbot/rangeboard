import { Component } from 'react'
import type { ReactNode } from 'react'
import { State } from './kit'

interface ErrorBoundaryProps {
  label: string
  onExport: () => void
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
  exportError: string | null
}

/** A failed view never resets its record; export reads the current owning store. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, exportError: null }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true }
  }

  private exportRecord = () => {
    try {
      this.props.onExport()
      this.setState({ exportError: null })
    } catch (error) {
      this.setState({
        exportError: error instanceof Error ? error.message : 'The export could not be created.',
      })
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="inspector-body" aria-label={`${this.props.label} error`}>
        <State tone="critical" role="alert">{this.props.label} could not be displayed.</State>
        <p className="muted small">Your records are still available. Export a copy before reloading.</p>
        <div className="inspector-actions">
          <button type="button" onClick={this.exportRecord}>Export</button>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </div>
        {this.state.exportError && <State tone="critical" role="alert">{this.state.exportError}</State>}
      </section>
    )
  }
}

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

/**
 * Export reads the current owning store, and a retry re-renders the children
 * against it: the record lives outside React, so nothing is lost either way.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false, exportError: null }

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

  private retry = () => {
    this.setState({ failed: false, exportError: null })
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="inspector-body" aria-label={`${this.props.label} error`}>
        <State tone="critical" role="alert">
          {this.props.label} could not be displayed.
        </State>
        <p className="muted small">
          Your records are still available. Try again, or export a copy before reloading.
        </p>
        <div className="inspector-actions">
          <button type="button" onClick={this.retry}>
            Try again
          </button>
          <button type="button" onClick={this.exportRecord}>
            Export
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
        {this.state.exportError && (
          <State tone="critical" role="alert">
            {this.state.exportError}
          </State>
        )}
      </section>
    )
  }
}

import { Component } from 'react'
import type { ReactNode } from 'react'

interface SceneErrorBoundaryProps {
  onError: (error: Error) => void
  children: ReactNode
}

interface SceneErrorBoundaryState {
  failed: boolean
}

/**
 * Error boundary for the react-konva tree. The app boundary wraps the DOM
 * tree only; a throw inside a Konva layer is swallowed by the Konva reconciler
 * and leaves a blank stage. This one renders nothing on failure and reports
 * upward, so the host can show a DOM notice. Remount with a new `key` to retry.
 */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  override state: SceneErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}

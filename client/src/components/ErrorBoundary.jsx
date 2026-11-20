import { Component } from 'react'

/** Keeps a render crash from white-screening the app — a red-pinned notice instead. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="notice max-w-md p-5 pt-6" style={{ '--tilt': 0.4 }}>
          <span className="pin bg-pin-red" aria-hidden="true" />
          <div className="mb-2 inline-block bg-pin-red px-2.5 py-1 font-display text-[11px] font-semibold tracking-[0.16em] text-paper">
            PIN FAILED
          </div>
          <h1 className="text-lg font-bold">Something fell off the board</h1>
          <p className="mt-1 text-sm leading-relaxed">
            {this.state.error.message || 'An unexpected error occurred while rendering.'}
          </p>
          <button className="btn mt-4" onClick={() => window.location.reload()}>
            Reload the board
          </button>
        </div>
      </div>
    )
  }
}

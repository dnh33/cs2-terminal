import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error) {
    if (typeof console !== 'undefined') console.error('[ErrorBoundary]', error)
  }
  reset = () => this.setState({ error: null })
  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div role="alert" className="m-6 p-5 border border-state-err bg-state-err/5 text-[12px]">
          <div className="t-label text-state-err mb-2">SOMETHING WENT WRONG</div>
          <div className="text-ink-1 mb-3">{this.state.error.message}</div>
          <button
            type="button"
            onClick={this.reset}
            className="t-label px-3 py-1 border border-line hover:border-ink-2 text-ink-1 hover:text-ink-0"
          >
            ↻ TRY AGAIN
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

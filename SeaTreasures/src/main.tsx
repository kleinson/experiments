import { StrictMode, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './theme.css'
import './styles.css'

class ExperienceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The shell experience could not render.', error, info)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error" role="alert">
          <p className="eyebrow">SeaTreasures</p>
          <h1>The specimen could not be opened.</h1>
          <p>
            Something went wrong loading the experience. Please reload to try
            again. Your saved specimen is kept on this device.
          </p>
          <button onClick={() => location.reload()}>Reload experience</button>
        </main>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('The shell experience is missing its root element.')
createRoot(root).render(
  <StrictMode>
    <ExperienceBoundary>
      <App />
    </ExperienceBoundary>
  </StrictMode>,
)

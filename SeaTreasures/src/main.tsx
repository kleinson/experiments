import { StrictMode, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulator } from './sim/Simulator.tsx'
import './theme.css'
import './styles.css'
import './sim/sim.css'

class ExperienceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The simulator could not render.', error, info)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error" role="alert">
          <p className="eyebrow">SeaTreasures</p>
          <h1>The simulator could not be opened.</h1>
          <p>
            Something went wrong loading the simulator. Please reload to try
            again. Your shelf is kept on this device.
          </p>
          <button onClick={() => location.reload()}>Reload</button>
        </main>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('The simulator is missing its root element.')
createRoot(root).render(
  <StrictMode>
    <ExperienceBoundary>
      <Simulator />
    </ExperienceBoundary>
  </StrictMode>,
)

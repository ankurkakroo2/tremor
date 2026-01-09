import { useState } from 'react'
import Waveform from './components/Waveform'
import './index.css'

function App() {
  const [isSimulating, setIsSimulating] = useState(false)
  const [started, setStarted] = useState(false)

  const handleStartMic = () => {
    setIsSimulating(false)
    setStarted(true)
  }

  const handleSimulate = () => {
    setIsSimulating(true)
    setStarted(true)
  }

  return (
    <>
      {!started ? (
        <div className="landing-overlay">
          <div className="content">
            <h1>Sonic Waveform</h1>
            <p className="subtitle">Interactive Audio Visualization</p>

            <div className="controls">
              <button onClick={handleStartMic} className="btn-primary">
                Start Microphone
              </button>
              <button onClick={handleSimulate} className="btn-secondary">
                Simulate Audio
              </button>
            </div>
            <p className="hint">
              Microphone access is required for real-time visualization.
              <br />Use simulation to test without audio input.
            </p>
          </div>
        </div>
      ) : (
        <>
          <Waveform isSimulating={isSimulating} />

          <div className="active-controls">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className="btn-glass"
            >
              Switch to {isSimulating ? 'Microphone' : 'Simulation'}
            </button>
          </div>
        </>
      )}
    </>
  )
}

export default App

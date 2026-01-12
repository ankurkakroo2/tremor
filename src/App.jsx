import { useState, useEffect, useRef } from 'react'
// import Waveform from './components/Waveform' // Canvas 2D version
import WaveformGL from './components/WaveformGL' // WebGL version
import './index.css'

function usePerformanceMonitor() {
  const fpsRef = useRef(null)
  const frameTimesRef = useRef([])
  const animationFrameRef = useRef(null)
  const lastTimeRef = useRef(performance.now())

  useEffect(() => {
    const updateFPS = () => {
      const now = performance.now()
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      frameTimesRef.current.push(delta)
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift()
      }

      const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
      const fps = avgDelta > 0 ? Math.round(1000 / avgDelta) : 0

      if (fpsRef.current) {
        fpsRef.current.textContent = `${fps} fps`
      }

      animationFrameRef.current = requestAnimationFrame(updateFPS)
    }

    animationFrameRef.current = requestAnimationFrame(updateFPS)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return fpsRef
}

function App() {
  const [isSimulating, setIsSimulating] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const fpsRef = usePerformanceMonitor()

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
      <div ref={fpsRef} className="fps-counter" />
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
          <Waveform isSimulating={isSimulating} isMuted={isMuted} />

          <div className="active-controls" style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className="btn-glass"
            >
              Switch to {isSimulating ? 'Microphone' : 'Simulation'}
            </button>
            {!isSimulating && (
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="btn-glass"
                style={{ background: isMuted ? 'rgba(255, 50, 50, 0.3)' : undefined }}
              >
                {isMuted ? 'Unmute Mic' : 'Mute Mic'}
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

export default App

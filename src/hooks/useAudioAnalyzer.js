import { useCallback, useEffect, useRef, useState } from 'react';

export function useAudioAnalyzer(options = { fftSize: 2048, simulation: false }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const analyzerRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const simulationTimeRef = useRef(0);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    dataArrayRef.current = new Uint8Array(options.fftSize);
    let isMounted = true;

    const init = async () => {
      if (!isMounted) return;
      setIsReady(false);
      setError(null);

      try {
        // 1. Create AudioContext if it doesn't exist or is closed
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContext();
          // IMPORTANT: If we create a new context, we MUST invalidate the old analyzer
          // because AudioNodes are tied to a specific AudioContext.
          analyzerRef.current = null;
        }

        const ctx = audioContextRef.current;

        // Ensure Analyser exists
        if (!analyzerRef.current) {
          analyzerRef.current = ctx.createAnalyser();
          analyzerRef.current.fftSize = options.fftSize;
        } else {
          // Update fftSize if it changed
          analyzerRef.current.fftSize = options.fftSize;
        }

        // Disconnect previous source if it exists
        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }
        // Stop previous stream if it exists
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        if (options.simulation) {
           // Simulation mode
           if (isMounted) setIsReady(true);
        } else {
          // Microphone mode
          // Resume if suspended (browser requirements)
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

          if (!isMounted) {
            // Component unmounted while waiting for mic
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          if (ctx.state === 'closed') {
             // Context got closed externally or by cleanup
             stream.getTracks().forEach(t => t.stop());
             return;
          }

          streamRef.current = stream;
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyzerRef.current);
          sourceRef.current = source;

          if (isMounted) setIsReady(true);
        }
      } catch (err) {
        console.error('Error initializing audio:', err);
        if (isMounted) setError(err);
      }
    };

    init();

    return () => {
      isMounted = false;
      // When options change (sim vs mic) or unmount, we cleanup properly
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      // Note: We generally don't CLOSE the audio context on re-renders
      // to avoid overhead, but in this specific app structure (one visualizer),
      // it's cleaner to close it if we completely unmount.
      // However, to fix the specific StrictMode race where Close happens before Async finishes:
      // We rely on the `isMounted` and `ctx.state` checks above.
      // For this app, let's close it on unmount to be clean.
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
         audioContextRef.current.close().catch(e => console.error("Error closing context", e));
         audioContextRef.current = null;
      }
    };
  }, [options.fftSize, options.simulation]);

  const getWaveformData = useCallback(() => {
    if (!analyzerRef.current && !options.simulation) return dataArrayRef.current || new Uint8Array(options.fftSize);

    const dataArray = dataArrayRef.current;

    if (options.simulation) {
      simulationTimeRef.current += 0.05;
      const t = simulationTimeRef.current;
      const fftSize = options.fftSize;
      const data = dataArray;

      for (let i = 0; i < fftSize; i++) {
        const x = (i / fftSize) * Math.PI * 8;
        const val = 128 +
          Math.sin(x + t) * 40 +
          Math.sin(x * 3 + t * 2) * 15 +
          (Math.random() - 0.5) * 2;
        data[i] = Math.max(0, Math.min(255, val));
      }
    } else if (analyzerRef.current) {
      analyzerRef.current.getByteTimeDomainData(dataArray);
    }

    return dataArray;
  }, [options.simulation, options.fftSize]);

  // Expose initAudio as dummy if needed, but logic is now in useEffect
  const initAudio = useCallback(async () => {
     // Main logic moved to useEffect to handle lifecycle better
     // This function is now a no-op as initialization is handled by useEffect.
     // You might remove it from the returned object if it's no longer needed externally.
  }, []);

  return { initAudio, getWaveformData, isReady, error };
}

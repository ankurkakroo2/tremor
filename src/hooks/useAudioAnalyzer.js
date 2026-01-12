import { useCallback, useEffect, useRef, useState } from 'react';

export function useAudioAnalyzer(options = { fftSize: 2048, simulation: false }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const analyzerRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const simulationTimeRef = useRef(0);

  useEffect(() => {
    let isMounted = true;
    setIsReady(false); // Reset ready state on options change or mount
    setError(null); // Clear previous errors

    const init = async () => {
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

  const toggleSimulation = useCallback((enabled) => {
    // This hook assumes efficient toggling might be needed,
    // but simplified: consumer just changes key to re-init or we handle it here.
    // For now, we rely on the `simulation` prop triggering re-init logic if handled in useEffect,
    // but to avoid full re-mount, we can just switch data source logic.
    // However, for this MVP, re-initialization is safer.
  }, []);

  // Function to get current waveform data
  const getWaveformData = useCallback(() => {
    if (!analyzerRef.current && !options.simulation) return new Uint8Array(options.fftSize);

    const dataArray = new Uint8Array(options.fftSize);

    if (options.simulation) {
      // Simulation Physics: Random/Unpredictable Pattern
      simulationTimeRef.current += 0.05;
      const t = simulationTimeRef.current;

      for (let i = 0; i < options.fftSize; i++) {
        // Base noise layer
        const scale = i / options.fftSize;

        let val = 128; // Center line

        // 1. Slow drifting random waves (mimics wind/water)
        val += Math.sin(scale * 10 + t * 0.5) * 20 * Math.sin(t * 0.2);
        val += Math.cos(scale * 20 - t * 0.8) * 15;

        // 2. Sporadic "Spikes" or "Drops" (mimics sudden sound events)
        if (Math.random() > 0.98) {
          val += (Math.random() - 0.5) * 150;
        }

        // 3. High frequency jitter
        val += (Math.random() - 0.5) * 10;

        dataArray[i] = Math.max(0, Math.min(255, val));
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

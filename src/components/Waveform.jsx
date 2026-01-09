import { useEffect, useRef, useState } from 'react';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';

const TOOLS_INFO = {
    sensitivity: "Multiplies the audio input strength. Higher = Taller waves.",
    gravity: "Downward pull on particles. Higher = Particles fall faster.",
    attack: "How fast particles react to new audio. Higher = Snappier response.",
    decay: "Wave energy retention. 0.99 = Waves go forever. Lower = Waves die out quickly.",
    elasticity: "Connection strength. Higher = Solid sheet. Lower = Loose liquid.",
    smoothing: "Spreads audio input to neighbors. Higher = Smooth hills. 0 = Spiky needles.",
    camHeight: "Vertical camera position. Lower = Horizon view.",
    camZ: "Camera zoom/distance. Negative is further back."
};

const DEFAULT_PARAMS = {
    sensitivity: 1.5,
    gravity: 0.5,
    attack: 0.25,
    decay: 0.98,
    elasticity: 0.9,
    smoothing: 2, // Default small blur radius
    camHeight: 200,
    camZ: -200
};

export default function Waveform({ isSimulating }) {
    const canvasRef = useRef(null);
    const { initAudio, getWaveformData, isReady, error } = useAudioAnalyzer({
        fftSize: 2048,
        simulation: isSimulating
    });
    const requestRef = useRef();
    const gridRef = useRef([]);
    const timeRef = useRef(0);

    // UI State
    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [showControls, setShowControls] = useState(true);

    // Refs for Animation Loop (Avoids stale closures / re-renders)
    const paramsRef = useRef(DEFAULT_PARAMS);

    const updateParam = (key, value) => {
        const newParams = { ...params, [key]: parseFloat(value) };
        setParams(newParams);
        paramsRef.current = newParams;
    };

    const resetParams = () => {
        setParams(DEFAULT_PARAMS);
        paramsRef.current = DEFAULT_PARAMS;
    };

    const GRID_ROWS = 100;

    useEffect(() => {
        initAudio();
    }, [initAudio, isSimulating]);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = getWaveformData();

        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        const { width, height } = canvas;
        const centerX = width / 2;

        // Read current params from Ref
        const P = paramsRef.current;

        const centerY = height * 0.85;

        // Clear background with gradient
        const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height));
        bgGradient.addColorStop(0, '#0a0a12');
        bgGradient.addColorStop(0.5, '#050508');
        bgGradient.addColorStop(1, '#000000');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Config
        const totalCols = 400;
        const step = Math.floor(data.length / totalCols) || 1;

        // 3D Constants
        const FOCAL_LENGTH = 300;
        const Z_SPACING = 20;
        const X_SPACING = 7.5;

        // Camera Params
        const CAMERA_HEIGHT = P.camHeight;
        const CAMERA_Z_OFFSET = P.camZ;
        const TILT_ANGLE = Math.PI / 9;

        const cosTilt = Math.cos(TILT_ANGLE);
        const sinTilt = Math.sin(TILT_ANGLE);

        // Physics Params
        const GRAVITY = P.gravity;
        const ATTACK_FACTOR = P.attack;
        const PROPAGATION_DECAY = P.decay;
        const ELASTICITY = P.elasticity;

        timeRef.current += 0.05;
        const t = timeRef.current;

        // Initialize Grid
        if (gridRef.current.length === 0 || gridRef.current[0].length !== totalCols) {
            gridRef.current = Array(GRID_ROWS).fill(null).map(() =>
                Array(totalCols).fill(null).map(() => ({ y: 0, velocity: 0 }))
            );
        }

        const centerRow = Math.floor(GRID_ROWS / 2);

        // 1. UPDATE CENTER ROW

        // Step 1: Calculate Raw Targets from Audio
        const rawTargets = new Float32Array(totalCols);

        for (let c = 0; c < totalCols; c++) {
            const dataIndex = c * step;
            let rawVal = 0;
            let count = 0;
            // Frequency Smoothing (Bin Averaging)
            for (let i = 0; i < 3; i++) {
                if (dataIndex + i < data.length) {
                    rawVal += data[dataIndex + i];
                    count++;
                }
            }
            const val = count > 0 ? rawVal / count : 128;

            let normalized = (val - 128) / 128.0;
            if (normalized < 0) normalized = 0;

            rawTargets[c] = normalized * (height * P.sensitivity);
        }

        // Step 2: Apply Spatial Smoothing (Blur)
        // This spreads the influence of a single spike to its neighbors
        const smoothedTargets = new Float32Array(totalCols);
        const radius = Math.round(P.smoothing);

        if (radius > 0) {
            for (let c = 0; c < totalCols; c++) {
                let sum = 0;
                let totalWeight = 0;

                for (let offset = -radius; offset <= radius; offset++) {
                    const neighborC = c + offset;
                    if (neighborC >= 0 && neighborC < totalCols) {
                        // Linear fallout weight: Center = 1, Edge = small
                        const dist = Math.abs(offset);
                        // Optional: Gaussian-ish curve or simple linear triangle
                        const weight = 1.0 / (dist + 1);

                        sum += rawTargets[neighborC] * weight;
                        totalWeight += weight;
                    }
                }
                smoothedTargets[c] = sum / (totalWeight || 1);
            }
        } else {
            // No smoothing
            smoothedTargets.set(rawTargets);
        }


        // Step 3: Apply Physics to Center Row
        for (let c = 0; c < totalCols; c++) {
            const targetAudioY = smoothedTargets[c];
            const particle = gridRef.current[centerRow][c];

            if (targetAudioY > particle.y) {
                particle.y += (targetAudioY - particle.y) * ATTACK_FACTOR;
                particle.velocity = 0;
            } else {
                particle.velocity -= GRAVITY;
                particle.y += particle.velocity;
                if (particle.y < 0) { particle.y = 0; particle.velocity = 0; }
            }
        }

        // 2. ELASTIC PROPAGATION
        const propagate = (startR, endR, stepR, lookBackR) => {
            for (let r = startR; r !== endR; r += stepR) {
                for (let c = 0; c < totalCols; c++) {
                    const p = gridRef.current[r][c];
                    const sourceP = gridRef.current[r + lookBackR][c];
                    const waveTargetY = sourceP.y * PROPAGATION_DECAY;

                    let neighborSum = 0;
                    let count = 0;
                    if (c > 0) { neighborSum += gridRef.current[r][c - 1].y; count++; }
                    if (c < totalCols - 1) { neighborSum += gridRef.current[r][c + 1].y; count++; }

                    let finalTarget = waveTargetY;
                    if (count > 0) {
                        finalTarget = (finalTarget * 0.4) + ((neighborSum / count) * 0.6);
                    }

                    p.velocity += (finalTarget - p.y) * ELASTICITY;
                    p.velocity -= p.y * 0.1;
                    p.y += p.velocity * 0.5;
                    p.velocity *= 0.6;
                    if (p.y < 0) p.y = 0;
                }
            }
        }

        propagate(centerRow + 1, GRID_ROWS, 1, -1);
        propagate(centerRow - 1, -1, -1, 1);


        // 3. RENDER LOOP
        const project = (r, c, worldY, particleHeight) => {
            const wx = (c - totalCols / 2) * X_SPACING;
            const wz = r * Z_SPACING;

            const cx = wx;
            const cy = worldY - CAMERA_HEIGHT;
            const cz = wz - CAMERA_Z_OFFSET;

            const ry = cy * cosTilt + cz * sinTilt;
            const rz = -cy * sinTilt + cz * cosTilt;

            if (rz <= 0) return null;

            const scale = FOCAL_LENGTH / rz;
            const sx = centerX + cx * scale;
            const sy = centerY - (ry * scale);

            const alpha = Math.max(0, 1.0 - (Math.abs(r - centerRow) / (GRID_ROWS / 2)));
            // Intensity based on particle height (0-1, clamped), with NaN protection
            const rawIntensity = particleHeight / (height * 0.3);
            const intensity = Math.max(0, Math.min(1, isNaN(rawIntensity) ? 0 : rawIntensity));
            return { x: sx, y: sy, scale, alpha, intensity, depth: rz };
        };

        const finalPoints = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            finalPoints[r] = [];
            for (let c = 0; c < totalCols; c++) {
                let audioY = gridRef.current[r][c].y;
                const totalY = Math.max(0, audioY + 5);
                finalPoints[r][c] = project(r, c, totalY, audioY);
            }
        }

        // Helper: Get color based on intensity (green spectrum)
        const getColor = (intensity, alpha) => {
            // Hue: 150 (teal-green) -> 90 (lime) based on intensity
            const hue = 150 - intensity * 60;
            const saturation = 70 + intensity * 30;
            const lightness = 45 + intensity * 25;
            return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
        };

        // Horizontal Lines with glow and dynamic thickness
        // Note: shadowBlur is expensive - disable if performance issues
        const enableGlow = false;
        if (enableGlow) ctx.shadowColor = 'rgba(100, 255, 100, 0.8)';

        for (let r = 0; r < GRID_ROWS; r++) {
            // Calculate average intensity for this row
            let rowIntensity = 0;
            let validPoints = 0;
            for (let c = 0; c < totalCols; c++) {
                const p = finalPoints[r][c];
                if (p) { rowIntensity += p.intensity; validPoints++; }
            }
            rowIntensity = validPoints > 0 ? rowIntensity / validPoints : 0;

            // Dynamic line thickness based on proximity to center and intensity
            const proximityFactor = 1.0 - (Math.abs(r - centerRow) / (GRID_ROWS / 2));
            const baseThickness = 0.5 + proximityFactor * 1.5 + rowIntensity * 2;
            ctx.lineWidth = Math.max(0.5, baseThickness);

            // Glow intensity based on row activity
            if (enableGlow) ctx.shadowBlur = 8 + rowIntensity * 15;

            ctx.beginPath();
            let started = false;
            for (let c = 0; c < totalCols; c++) {
                const p = finalPoints[r][c];
                if (!p) continue;
                if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                else { ctx.lineTo(p.x, p.y); }
            }
            const rowAlpha = Math.max(0, 1.0 - (Math.abs(r - centerRow) / (GRID_ROWS / 2.5))) * 0.6;
            if (rowAlpha > 0) {
                ctx.strokeStyle = getColor(rowIntensity, rowAlpha);
                ctx.stroke();
            }
        }

        // Vertical Lines with subtle glow
        if (enableGlow) {
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(100, 220, 100, 0.5)';
        }
        ctx.lineWidth = 0.5;

        for (let c = 0; c < totalCols; c++) {
            // Calculate average intensity for this column
            let colIntensity = 0;
            let validPoints = 0;
            for (let r = 0; r < GRID_ROWS; r++) {
                const p = finalPoints[r][c];
                if (p) { colIntensity += p.intensity; validPoints++; }
            }
            colIntensity = validPoints > 0 ? colIntensity / validPoints : 0;

            ctx.beginPath();
            let started = false;
            for (let r = 0; r < GRID_ROWS; r++) {
                const p = finalPoints[r][c];
                if (!p) continue;
                if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                else { ctx.lineTo(p.x, p.y); }
            }
            const alpha = 0.1 + colIntensity * 0.15;
            ctx.strokeStyle = getColor(colIntensity * 0.5, alpha);
            ctx.stroke();
        }

        // Dots with glow based on intensity
        if (enableGlow) ctx.shadowColor = 'rgba(180, 255, 180, 0.9)';

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < totalCols; c++) {
                const p = finalPoints[r][c];
                if (!p || p.alpha < 0.05) continue;

                // Dynamic size: base + intensity bonus
                const size = (1.2 + p.intensity * 1.5) * p.scale;

                // Glow based on intensity
                if (enableGlow) ctx.shadowBlur = 3 + p.intensity * 12;

                // Color shifts within green spectrum based on intensity
                const hue = 150 - p.intensity * 60;
                ctx.fillStyle = `hsla(${hue}, 100%, ${60 + p.intensity * 30}%, ${p.alpha * (0.6 + p.intensity * 0.4)})`;

                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, size), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Reset shadow for next frame
        if (enableGlow) ctx.shadowBlur = 0;

        requestRef.current = requestAnimationFrame(draw);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(requestRef.current);
    }, [getWaveformData]);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, background: '#000' }}>
            <canvas ref={canvasRef} />

            {/* Control Panel */}
            {showControls && (
                <div style={{
                    position: 'absolute', top: 10, left: 10, right: 10,
                    background: 'rgba(0, 0, 0, 0.8)', padding: '15px 20px', borderRadius: '8px',
                    display: 'flex', flexWrap: 'wrap', gap: '25px', alignItems: 'center', zIndex: 20
                }}>
                    <div style={{ color: '#0ff', fontWeight: 'bold', marginRight: '10px' }}>CONTROLS</div>

                    {/* Controls Generator */}
                    {Object.keys(DEFAULT_PARAMS).map((key) => {
                        let min, max, step;
                        if (key === 'camHeight') { min = 10; max = 500; step = 10; }
                        else if (key === 'camZ') { min = -500; max = 0; step = 10; }
                        else if (key === 'gravity') { min = 0.01; max = 1.0; step = 0.01; }
                        else if (key === 'attack') { min = 0.01; max = 1.0; step = 0.01; }
                        else if (key === 'decay') { min = 0.1; max = 0.9999; step = 0.0001; } // Extended range for longer-lasting waves
                        else if (key === 'elasticity') { min = 0.1; max = 0.99; step = 0.01; }
                        else if (key === 'smoothing') { min = 0; max = 20; step = 1; } // Radius 0-20
                        else { min = 0.1; max = 3.0; step = 0.1; } // Sensitivity

                        return (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', minWidth: '160px' }}
                                title={TOOLS_INFO[key]}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ color: '#fff', fontSize: '12px', marginRight: '6px', textTransform: 'uppercase', fontWeight: 600 }}>
                                        {key}
                                    </span>
                                    <span style={{
                                        color: '#0ff', fontSize: '10px', border: '1px solid #0ff', borderRadius: '50%',
                                        width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'help'
                                    }}>?</span>
                                </div>
                                <input
                                    type="range" min={min} max={max} step={step}
                                    value={params[key]}
                                    onChange={(e) => updateParam(key, e.target.value)}
                                    style={{ width: '100%', cursor: 'pointer' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#666', fontSize: '9px' }}>{min}</span>
                                    <span style={{ color: '#aaa', fontSize: '10px' }}>{params[key]}</span>
                                    <span style={{ color: '#666', fontSize: '9px' }}>{max}</span>
                                </div>
                            </div>
                        );
                    })}

                    <button
                        onClick={resetParams}
                        style={{
                            marginLeft: 'auto', padding: '8px 20px', background: '#333', color: '#fff',
                            border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
                            fontWeight: 'bold'
                        }}
                    >
                        RESET
                    </button>
                    {error && <div style={{ color: 'red', marginLeft: '10px' }}>{error.message}</div>}
                </div>
            )}
        </div>
    );
}

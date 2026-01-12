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
    camZ: "Camera zoom/distance. Negative is further back.",
    oceanAmp: "Base wave height when silent. 0 = Flat.",
    oceanSpeed: "How fast the ocean waves move.",
    density: "Particle density (spacing). Higher = Closer dots.",
    showLines: "Toggle connection lines. 0 = Off, 1 = On."
};

const DEFAULT_PARAMS = {
    sensitivity: 1.5,
    gravity: 0.5,
    attack: 0.25,
    decay: 0.98,
    elasticity: 0.9,
    smoothing: 2, // Default small blur radius
    camHeight: 80,
    camZ: -200,
    oceanAmp: 4,
    oceanSpeed: 0.2,
    density: 1.0,
    showLines: 0
};

const CONTROL_GROUPS = {
    "Physics": ["gravity", "elasticity", "decay", "attack"],
    "Audio Response": ["sensitivity", "smoothing"],
    "Appearance": ["density", "showLines", "oceanAmp", "oceanSpeed"],
    "Camera": ["camHeight", "camZ"]
};

// Helper for sleek sliders
const ControlSlider = ({ label, value, min, max, step, onChange, info }) => (
    <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
            <span style={{ color: '#aaa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                {label}
            </span>
            <span style={{ color: '#0ff', fontSize: '11px', fontFamily: 'monospace' }}>{value}</span>
        </div>
        <input
            type="range" min={min} max={max} step={step}
            value={value}
            onChange={onChange}
            title={info}
            style={{
                width: '100%', cursor: 'pointer', accentColor: '#0ff',
                height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', appearance: 'auto'
            }}
        />
    </div>
);

export default function Waveform({ isSimulating }) {
    const canvasRef = useRef(null);
    const { initAudio, getWaveformData, isReady, error } = useAudioAnalyzer({
        fftSize: 2048,
        simulation: isSimulating
    });
    // ... (rest of hook logic same as before, no changes needed to logic)
    const requestRef = useRef();
    const gridRef = useRef([]);
    const timeRef = useRef(0);
    const lineOpacityRef = useRef(0);

    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [showControls, setShowControls] = useState(true);
    const paramsRef = useRef(DEFAULT_PARAMS);

    const updateParam = (key, value) => {
        const newParams = { ...params, [key]: parseFloat(value) };
        setParams(newParams);
        paramsRef.current = newParams;
    };

    useEffect(() => {
        updateParam('showLines', isSimulating ? 1 : 0);
    }, [isSimulating]);

    const resetParams = () => {
        setParams(DEFAULT_PARAMS);
        paramsRef.current = DEFAULT_PARAMS;
    };

    const GRID_ROWS = 100;

    useEffect(() => {
        initAudio();
    }, [initAudio, isSimulating]);

    const draw = () => {
        // ... (draw function logic remains 100% identical, omitted for brevity in this specific replacement block if I could, but I must provide valid file struct)
        // actually I need to preserve the draw function content. To avoid re-pasting 300 lines of unchanged code, 
        // I will target the Return statement specifically or simpler, replace the whole component because the logic is small relative to the complexity of a partial replace of the return block.
        // Wait, the draw function is huge. I should try to target just the return block if possible.
        // BUT the user asked to "Organize controls".
        // Use replace_file_content on the RETURN statement area.

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
        const P = paramsRef.current;
        const centerY = height * 0.95;

        // Clear background with gradient
        const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height));
        bgGradient.addColorStop(0, '#0a0a12');
        bgGradient.addColorStop(0.5, '#050508');
        bgGradient.addColorStop(1, '#000000');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Config
        const totalCols = 450;
        const step = Math.floor(data.length / totalCols) || 1;

        // 3D Constants
        const FOCAL_LENGTH = 300;
        const densityFactor = Math.max(0.5, P.density);
        const Z_SPACING = 20 / densityFactor;
        const X_SPACING = 15 / densityFactor;

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

        // Ocean Params
        const OCEAN_AMP = P.oceanAmp;
        const OCEAN_SPEED = P.oceanSpeed;

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
        const rawTargets = new Float32Array(totalCols);
        for (let c = 0; c < totalCols; c++) {
            const dataIndex = c * step;
            let rawVal = 0;
            let count = 0;
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

        const smoothedTargets = new Float32Array(totalCols);
        const radius = Math.round(P.smoothing);

        if (radius > 0) {
            for (let c = 0; c < totalCols; c++) {
                let sum = 0;
                let totalWeight = 0;
                for (let offset = -radius; offset <= radius; offset++) {
                    const neighborC = c + offset;
                    if (neighborC >= 0 && neighborC < totalCols) {
                        const dist = Math.abs(offset);
                        const weight = 1.0 / (dist + 1);
                        sum += rawTargets[neighborC] * weight;
                        totalWeight += weight;
                    }
                }
                smoothedTargets[c] = sum / (totalWeight || 1);
            }
        } else {
            smoothedTargets.set(rawTargets);
        }


        // Step 3: Apply Physics + Ocean to Center Row
        for (let c = 0; c < totalCols; c++) {
            let targetAudioY = smoothedTargets[c];
            const oceanOffset =
                Math.sin(c * 0.05 + t * OCEAN_SPEED) * OCEAN_AMP +
                Math.sin(c * 0.1 + t * OCEAN_SPEED * 1.5) * (OCEAN_AMP * 0.5);
            const combinedTarget = targetAudioY + Math.max(0, oceanOffset + OCEAN_AMP);
            const particle = gridRef.current[centerRow][c];

            if (combinedTarget > particle.y) {
                particle.y += (combinedTarget - particle.y) * ATTACK_FACTOR;
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
            let sy = centerY - (ry * scale);

            // Horizon Arc / Curvature Effect
            // We bend 'y' down based on how far 'x' is from center.
            // Reduced factor = Larger sphere diameter = Flatter/Wider arc
            const distFromCenter = (sx - centerX);
            const curve = (distFromCenter * distFromCenter) * 0.00015;
            sy += curve;

            const alpha = Math.max(0, 1.0 - (Math.abs(r - centerRow) / (GRID_ROWS / 2)));
            // Intensity based on particle height (0-1, clamped), with NaN protection
            const rawIntensity = particleHeight / (height * 0.3);
            const intensity = Math.max(0, Math.min(1, isNaN(rawIntensity) ? 0 : rawIntensity));
            return { x: sx, y: sy, scale, alpha, intensity, depth: rz };
        };

        // Compression function - keeps lines closer at high amplitudes (stretchy feel)
        const compress = (y) => {
            if (y <= 0) return 0;
            // Soft compression: fast rise initially, then compresses
            return P.maxStretch * (1 - Math.exp(-y / P.maxStretch));
        };

        const finalPoints = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            finalPoints[r] = [];
            for (let c = 0; c < totalCols; c++) {
                let audioY = gridRef.current[r][c].y;
                const compressedY = compress(audioY);
                const totalY = Math.max(0, compressedY + 5);
                finalPoints[r][c] = project(r, c, totalY, compressedY);
            }
        }

        // Horizontal Lines
        const targetOpacity = P.showLines > 0.5 ? 1.0 : 0.0;
        lineOpacityRef.current += (targetOpacity - lineOpacityRef.current) * 0.05;

        if (lineOpacityRef.current > 0.01) {
            for (let r = 0; r < GRID_ROWS; r++) {
                ctx.beginPath();
                let started = false;
                for (let c = 0; c < totalCols; c++) {
                    const p = finalPoints[r][c];
                    if (!p) continue;
                    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                    else { ctx.lineTo(p.x, p.y); }
                }
                const rowAlpha = Math.max(0, 1.0 - (Math.abs(r - centerRow) / (GRID_ROWS / 2.5))) * 0.5 * lineOpacityRef.current;
                if (rowAlpha > 0) {
                    ctx.strokeStyle = `rgba(0, 255, 255, ${rowAlpha})`;
                    ctx.stroke();
                }
            }

            for (let c = 0; c < totalCols; c++) {
                ctx.beginPath();
                let started = false;
                for (let r = 0; r < GRID_ROWS; r++) {
                    const p = finalPoints[r][c];
                    if (!p) continue;
                    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                    else { ctx.lineTo(p.x, p.y); }
                }
                ctx.strokeStyle = `rgba(0, 200, 255, ${0.15 * lineOpacityRef.current})`;
                ctx.stroke();
            }
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
                if (enableGlow) ctx.shadowBlur = 10 + p.intensity * 20;

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
            <canvas ref={canvasRef} style={{ filter: `blur(${params.blur}px)` }} />

            {/* Modern Control Panel */}
            {showControls && (
                <div style={{
                    position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                    width: '90%', maxWidth: '1000px',
                    background: 'rgba(10, 10, 20, 0.65)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '20px',
                    zIndex: 20,
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', background: '#0ff', borderRadius: '50%', boxShadow: '0 0 10px #0ff' }}></div>
                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>SYSTEM CONTROLS</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={resetParams} style={{
                                background: 'transparent', color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)',
                                borderRadius: '4px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}>
                                RESET DEFAULTS
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                        {Object.entries(CONTROL_GROUPS).map(([groupName, keys]) => (
                            <div key={groupName} style={{ flex: '1 1 200px', minWidth: '180px' }}>
                                <h3 style={{
                                    color: 'rgba(255,255,255,0.5)', fontSize: '10px',
                                    textTransform: 'uppercase', marginBottom: '15px',
                                    borderLeft: '2px solid #0ff', paddingLeft: '8px'
                                }}>
                                    {groupName}
                                </h3>
                                <div>
                                    {keys.map(key => {
                                        let min, max, step;
                                        if (key === 'camHeight') { min = 10; max = 200; step = 5; }
                                        else if (key === 'camZ') { min = -500; max = 0; step = 10; }
                                        else if (key === 'gravity') { min = 0.01; max = 1.0; step = 0.01; }
                                        else if (key === 'attack') { min = 0.01; max = 1.0; step = 0.01; }
                                        else if (key === 'decay') { min = 0.1; max = 0.999; step = 0.001; }
                                        else if (key === 'elasticity') { min = 0.1; max = 0.99; step = 0.01; }
                                        else if (key === 'smoothing') { min = 0; max = 20; step = 1; }
                                        else if (key === 'oceanAmp') { min = 0; max = 20; step = 0.5; }
                                        else if (key === 'oceanSpeed') { min = 0; max = 2.0; step = 0.1; }
                                        else if (key === 'density') { min = 0.5; max = 3.0; step = 0.1; }
                                        else if (key === 'showLines') { min = 0; max = 1; step = 1; }
                                        else { min = 0.1; max = 3.0; step = 0.1; }

                                        return (
                                            <ControlSlider
                                                key={key}
                                                label={key}
                                                value={params[key]}
                                                min={min} max={max} step={step}
                                                onChange={(e) => updateParam(key, e.target.value)}
                                                info={TOOLS_INFO[key]}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    {error && <div style={{ color: '#ff4444', marginTop: '10px', fontSize: '12px' }}>⚠️ {error.message}</div>}
                </div>
            )}
        </div>
    );
}

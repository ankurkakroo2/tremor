import { useEffect, useRef, useState, useCallback } from 'react';
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
    maxStretch: "Maximum wave height. Lower = More compression, stretchy feel.",
    blur: "Visual blur amount. Higher = Softer, dreamier look.",
    terrainHeight: "Height of hills/mountains. Higher = Taller terrain.",
    terrainScale: "Size of hills. Higher = Larger, rolling hills. Lower = More frequent bumps."
};

const DEFAULT_PARAMS = {
    sensitivity: 5.0,
    gravity: 0.5,
    attack: 0.25,
    decay: 0.98,
    elasticity: 0.9,
    smoothing: 2,
    camHeight: 400,
    camZ: -160,
    maxStretch: 200,
    blur: 0,
    terrainHeight: 1.0,
    terrainScale: 1.0
};

// Vertex shader - transforms grid points to screen space
const VERTEX_SHADER = `
    attribute vec2 a_gridPos;    // row, col
    attribute float a_height;    // particle height (y)
    attribute float a_intensity; // for color

    uniform vec2 u_resolution;
    uniform float u_camHeight;
    uniform float u_camZ;
    uniform float u_focalLength;
    uniform float u_zSpacing;
    uniform float u_xSpacing;
    uniform float u_totalCols;
    uniform float u_gridRows;
    uniform float u_pointSize;
    uniform float u_centerRow;

    varying float v_intensity;
    varying float v_alpha;
    varying float v_depth;

    void main() {
        float row = a_gridPos.x;
        float col = a_gridPos.y;
        float centerRow = u_centerRow;

        // World position
        float wx = (col - u_totalCols / 2.0) * u_xSpacing;
        float wz = row * u_zSpacing;
        float wy = a_height;

        // Camera transform
        float cx = wx;
        float cy = wy - u_camHeight;
        float cz = wz - u_camZ;

        // Tilt rotation (20 degrees)
        float tiltAngle = 3.14159 / 9.0;
        float cosTilt = cos(tiltAngle);
        float sinTilt = sin(tiltAngle);

        float ry = cy * cosTilt + cz * sinTilt;
        float rz = -cy * sinTilt + cz * cosTilt;

        // Perspective projection
        if (rz <= 0.0) {
            gl_Position = vec4(2.0, 2.0, 0.0, 1.0); // Off screen
            v_alpha = 0.0;
            return;
        }

        float scale = u_focalLength / rz;
        float sx = cx * scale;
        float sy = ry * scale;

        // Convert to clip space (-1 to 1)
        vec2 centerScreen = vec2(0.0, -0.6); // Position so waveform covers bottom ~20% of screen
        gl_Position = vec4(
            (sx / (u_resolution.x * 0.5)) + centerScreen.x,
            (sy / (u_resolution.y * 0.5)) + centerScreen.y,
            0.0,
            1.0
        );

        // Calculate alpha - brighter at front, fades toward back
        float distFromFront = row / u_gridRows;
        v_alpha = max(0.0, 1.0 - distFromFront * 0.7);
        v_intensity = a_intensity;
        v_depth = rz;

        // Point size based on scale and intensity
        gl_PointSize = max(1.0, (1.2 + a_intensity * 1.5) * scale * u_pointSize);
    }
`;

// Fragment shader - colors pixels with green spectrum
const FRAGMENT_SHADER = `
    precision mediump float;

    varying float v_intensity;
    varying float v_alpha;
    varying float v_depth;

    uniform float u_lineMode; // 0 = points, 1 = horizontal lines, 2 = vertical lines

    vec3 hsl2rgb(float h, float s, float l) {
        float c = (1.0 - abs(2.0 * l - 1.0)) * s;
        float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
        float m = l - c / 2.0;
        vec3 rgb;
        if (h < 60.0) rgb = vec3(c, x, 0.0);
        else if (h < 120.0) rgb = vec3(x, c, 0.0);
        else if (h < 180.0) rgb = vec3(0.0, c, x);
        else if (h < 240.0) rgb = vec3(0.0, x, c);
        else if (h < 300.0) rgb = vec3(x, 0.0, c);
        else rgb = vec3(c, 0.0, x);
        return rgb + m;
    }

    void main() {
        // Green spectrum: hue 150 (teal) -> 90 (lime)
        float hue = 150.0 - v_intensity * 60.0;
        float sat = 0.7 + v_intensity * 0.3;
        float light = 0.45 + v_intensity * 0.25;

        vec3 color = hsl2rgb(hue, sat, light);

        float alpha = v_alpha;

        // Adjust alpha based on mode
        if (u_lineMode == 1.0) {
            // Horizontal lines
            alpha *= 0.6;
        } else if (u_lineMode == 2.0) {
            // Vertical lines - more subtle
            alpha *= 0.15 + v_intensity * 0.1;
        } else {
            // Points
            alpha *= (0.6 + v_intensity * 0.4);

            // Circular point shape
            vec2 coord = gl_PointCoord - vec2(0.5);
            if (length(coord) > 0.5) discard;
        }

        gl_FragColor = vec4(color, alpha);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

export default function WaveformGL({ isSimulating }) {
    const canvasRef = useRef(null);
    const glRef = useRef(null);
    const programRef = useRef(null);
    const buffersRef = useRef({});
    const locationsRef = useRef({});

    const { initAudio, getWaveformData, isReady, error } = useAudioAnalyzer({
        fftSize: 2048,
        simulation: isSimulating
    });
    const requestRef = useRef();
    const gridRef = useRef([]);
    const timeRef = useRef(0);

    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [showControls, setShowControls] = useState(true);
    const paramsRef = useRef(DEFAULT_PARAMS);

    const GRID_ROWS = 100;
    const TOTAL_COLS = 400;

    // Generate terrain heightmap (hills/mountains)
    const terrainRef = useRef(null);
    const lastTerrainParamsRef = useRef({ height: 1.0, scale: 1.0 });

    const generateTerrain = useCallback((heightMult = 1.0, scaleMult = 1.0) => {
        const terrain = [];
        const freq = 1.0 / scaleMult; // Lower scale = higher frequency = more bumps

        for (let r = 0; r < GRID_ROWS; r++) {
            terrain[r] = [];
            for (let c = 0; c < TOTAL_COLS; c++) {
                // Normalized coordinates
                const nx = c / TOTAL_COLS;
                const nz = r / GRID_ROWS;

                // Multiple octaves of sine waves for organic hills
                let height = 0;

                // Large rolling hills
                height += Math.sin(nx * Math.PI * 4 * freq) * 60;
                height += Math.sin(nz * Math.PI * 3 * freq) * 50;

                // Medium bumps
                height += Math.sin(nx * Math.PI * 8 * freq + 1.5) * Math.cos(nz * Math.PI * 6 * freq) * 30;

                // Small details
                height += Math.sin(nx * Math.PI * 16 * freq + nz * Math.PI * 12 * freq) * 15;
                height += Math.cos(nx * Math.PI * 20 * freq - nz * Math.PI * 8 * freq) * 10;

                // Add some variation based on position
                height += Math.sin((nx + nz) * Math.PI * 10 * freq) * 20;

                // Apply height multiplier and ensure positive
                terrain[r][c] = Math.max(10, (height * heightMult) + 80);
            }
        }
        return terrain;
    }, []);

    const updateParam = (key, value) => {
        const newParams = { ...params, [key]: parseFloat(value) };
        setParams(newParams);
        paramsRef.current = newParams;
    };

    const resetParams = () => {
        setParams(DEFAULT_PARAMS);
        paramsRef.current = DEFAULT_PARAMS;
    };

    // Initialize WebGL
    const initGL = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return false;

        const gl = canvas.getContext('webgl', {
            antialias: true,
            alpha: false
        });
        if (!gl) {
            console.error('WebGL not supported');
            return false;
        }

        glRef.current = gl;

        // Create shaders and program
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        if (!vertexShader || !fragmentShader) return false;

        const program = createProgram(gl, vertexShader, fragmentShader);
        if (!program) return false;

        programRef.current = program;

        // Get attribute and uniform locations
        locationsRef.current = {
            a_gridPos: gl.getAttribLocation(program, 'a_gridPos'),
            a_height: gl.getAttribLocation(program, 'a_height'),
            a_intensity: gl.getAttribLocation(program, 'a_intensity'),
            u_resolution: gl.getUniformLocation(program, 'u_resolution'),
            u_camHeight: gl.getUniformLocation(program, 'u_camHeight'),
            u_camZ: gl.getUniformLocation(program, 'u_camZ'),
            u_focalLength: gl.getUniformLocation(program, 'u_focalLength'),
            u_zSpacing: gl.getUniformLocation(program, 'u_zSpacing'),
            u_xSpacing: gl.getUniformLocation(program, 'u_xSpacing'),
            u_totalCols: gl.getUniformLocation(program, 'u_totalCols'),
            u_gridRows: gl.getUniformLocation(program, 'u_gridRows'),
            u_pointSize: gl.getUniformLocation(program, 'u_pointSize'),
            u_centerRow: gl.getUniformLocation(program, 'u_centerRow'),
            u_lineMode: gl.getUniformLocation(program, 'u_lineMode'),
        };

        // Create buffers
        buffersRef.current = {
            gridPos: gl.createBuffer(),
            height: gl.createBuffer(),
            intensity: gl.createBuffer(),
            horizontalIndices: gl.createBuffer(),
            verticalIndices: gl.createBuffer(),
        };

        // Initialize grid position buffer (static)
        const gridPosData = new Float32Array(GRID_ROWS * TOTAL_COLS * 2);
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < TOTAL_COLS; c++) {
                const idx = (r * TOTAL_COLS + c) * 2;
                gridPosData[idx] = r;     // row
                gridPosData[idx + 1] = c; // col
            }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.gridPos);
        gl.bufferData(gl.ARRAY_BUFFER, gridPosData, gl.STATIC_DRAW);

        // Create index buffers for lines
        // Horizontal lines - connect points in same row
        const hIndices = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < TOTAL_COLS - 1; c++) {
                hIndices.push(r * TOTAL_COLS + c);
                hIndices.push(r * TOTAL_COLS + c + 1);
            }
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.horizontalIndices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(hIndices), gl.STATIC_DRAW);
        buffersRef.current.hIndexCount = hIndices.length;

        // Vertical lines - connect points in same column
        const vIndices = [];
        for (let c = 0; c < TOTAL_COLS; c++) {
            for (let r = 0; r < GRID_ROWS - 1; r++) {
                vIndices.push(r * TOTAL_COLS + c);
                vIndices.push((r + 1) * TOTAL_COLS + c);
            }
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.verticalIndices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(vIndices), gl.STATIC_DRAW);
        buffersRef.current.vIndexCount = vIndices.length;

        // Enable extensions for uint32 indices
        gl.getExtension('OES_element_index_uint');

        // Enable blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        return true;
    }, []);

    useEffect(() => {
        initAudio();
    }, [initAudio, isSimulating]);

    useEffect(() => {
        initGL();
    }, [initGL]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const gl = glRef.current;
        const program = programRef.current;

        if (!canvas || !gl || !program) {
            requestRef.current = requestAnimationFrame(draw);
            return;
        }

        const data = getWaveformData();

        // Resize canvas if needed
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        const { width, height } = canvas;
        const P = paramsRef.current;

        // Check if terrain params changed - regenerate if needed
        const terrainParamsChanged =
            lastTerrainParamsRef.current.height !== P.terrainHeight ||
            lastTerrainParamsRef.current.scale !== P.terrainScale;

        if (!terrainRef.current || terrainParamsChanged) {
            terrainRef.current = generateTerrain(P.terrainHeight, P.terrainScale);
            lastTerrainParamsRef.current = { height: P.terrainHeight, scale: P.terrainScale };

            // Update existing grid particles to new terrain heights
            if (gridRef.current.length > 0) {
                for (let r = 0; r < GRID_ROWS; r++) {
                    for (let c = 0; c < TOTAL_COLS; c++) {
                        const newBaseY = terrainRef.current[r][c];
                        const particle = gridRef.current[r][c];
                        const displacement = particle.y - particle.baseY;
                        particle.baseY = newBaseY;
                        particle.y = newBaseY + Math.max(0, displacement);
                    }
                }
            }
        }
        const terrain = terrainRef.current;

        // Initialize grid if needed - particles start at terrain height
        if (gridRef.current.length === 0 || gridRef.current[0].length !== TOTAL_COLS) {
            gridRef.current = Array(GRID_ROWS).fill(null).map((_, r) =>
                Array(TOTAL_COLS).fill(null).map((_, c) => ({
                    y: terrain[r][c],  // Start at terrain height
                    velocity: 0,
                    baseY: terrain[r][c]  // Remember terrain height
                }))
            );
        }

        const centerRow = Math.floor(GRID_ROWS * 0.85); // Origin near the back/horizon
        const step = Math.floor(data.length / TOTAL_COLS) || 1;

        // Physics simulation (same as Canvas version)
        const rawTargets = new Float32Array(TOTAL_COLS);
        for (let c = 0; c < TOTAL_COLS; c++) {
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

        // Spatial smoothing
        const smoothedTargets = new Float32Array(TOTAL_COLS);
        const radius = Math.round(P.smoothing);
        if (radius > 0) {
            for (let c = 0; c < TOTAL_COLS; c++) {
                let sum = 0;
                let totalWeight = 0;
                for (let offset = -radius; offset <= radius; offset++) {
                    const neighborC = c + offset;
                    if (neighborC >= 0 && neighborC < TOTAL_COLS) {
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

        // Apply physics to center row - audio lifts above terrain
        for (let c = 0; c < TOTAL_COLS; c++) {
            const particle = gridRef.current[centerRow][c];
            const terrainHeight = particle.baseY;
            const targetY = terrainHeight + smoothedTargets[c]; // Terrain + audio displacement

            if (targetY > particle.y) {
                particle.y += (targetY - particle.y) * P.attack;
                particle.velocity = 0;
            } else {
                particle.velocity -= P.gravity;
                particle.y += particle.velocity;
                // Settle back to terrain height, not 0
                if (particle.y < terrainHeight) {
                    particle.y = terrainHeight;
                    particle.velocity = 0;
                }
            }
        }

        // Elastic propagation - waves settle to terrain, affected by slopes
        const propagate = (startR, endR, stepR, lookBackR) => {
            for (let r = startR; r !== endR; r += stepR) {
                for (let c = 0; c < TOTAL_COLS; c++) {
                    const p = gridRef.current[r][c];
                    const terrainHeight = p.baseY;
                    const sourceP = gridRef.current[r + lookBackR][c];

                    // Wave displacement from source (how far above its terrain)
                    const sourceDisplacement = sourceP.y - sourceP.baseY;

                    // Terrain slope affects how much wave transfers
                    const slope = terrainHeight - sourceP.baseY;
                    // Uphill: reduce transfer, Downhill: slightly more transfer
                    const slopeFactor = slope > 0
                        ? Math.max(0.3, 1.0 - slope / 150)  // Uphill: lose energy
                        : Math.min(1.1, 1.0 - slope / 300); // Downhill: slight boost, capped

                    const waveTargetY = terrainHeight + sourceDisplacement * P.decay * slopeFactor;

                    // Neighbor influence
                    let neighborSum = 0;
                    let count = 0;
                    if (c > 0) { neighborSum += gridRef.current[r][c - 1].y; count++; }
                    if (c < TOTAL_COLS - 1) { neighborSum += gridRef.current[r][c + 1].y; count++; }

                    let finalTarget = waveTargetY;
                    if (count > 0) {
                        finalTarget = (finalTarget * 0.4) + ((neighborSum / count) * 0.6);
                    }

                    p.velocity += (finalTarget - p.y) * P.elasticity;
                    p.velocity -= (p.y - terrainHeight) * 0.05; // Gentle pull toward terrain
                    p.y += p.velocity * 0.3;
                    p.velocity *= 0.62; // Balance: travel to bottom but not beyond

                    // Don't go below terrain
                    if (p.y < terrainHeight) p.y = terrainHeight;
                }
            }
        };

        propagate(centerRow + 1, GRID_ROWS, 1, -1);
        propagate(centerRow - 1, -1, -1, 1);

        // Compression function
        const compress = (y) => {
            if (y <= 0) return 0;
            return P.maxStretch * (1 - Math.exp(-y / P.maxStretch));
        };

        // Prepare height and intensity data for GPU
        const heightData = new Float32Array(GRID_ROWS * TOTAL_COLS);
        const intensityData = new Float32Array(GRID_ROWS * TOTAL_COLS);

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < TOTAL_COLS; c++) {
                const idx = r * TOTAL_COLS + c;
                const particle = gridRef.current[r][c];
                const displacement = particle.y - particle.baseY; // Height above terrain
                const compressedY = compress(particle.y);
                heightData[idx] = compressedY + 5;

                // Intensity based on displacement above terrain
                const rawIntensity = displacement / (height * 0.15);
                intensityData[idx] = Math.max(0, Math.min(1, isNaN(rawIntensity) ? 0 : rawIntensity));
            }
        }

        // Upload data to GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.height);
        gl.bufferData(gl.ARRAY_BUFFER, heightData, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.intensity);
        gl.bufferData(gl.ARRAY_BUFFER, intensityData, gl.DYNAMIC_DRAW);

        // Clear with dark gradient-like color
        gl.clearColor(0.02, 0.02, 0.04, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use program
        gl.useProgram(program);

        // Set uniforms
        const loc = locationsRef.current;
        gl.uniform2f(loc.u_resolution, width, height);
        gl.uniform1f(loc.u_camHeight, P.camHeight);
        gl.uniform1f(loc.u_camZ, P.camZ);
        gl.uniform1f(loc.u_focalLength, 300);
        gl.uniform1f(loc.u_zSpacing, 20);
        gl.uniform1f(loc.u_xSpacing, 15);
        gl.uniform1f(loc.u_totalCols, TOTAL_COLS);
        gl.uniform1f(loc.u_gridRows, GRID_ROWS);
        gl.uniform1f(loc.u_centerRow, centerRow);
        gl.uniform1f(loc.u_pointSize, 1.0);

        // Setup attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.gridPos);
        gl.enableVertexAttribArray(loc.a_gridPos);
        gl.vertexAttribPointer(loc.a_gridPos, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.height);
        gl.enableVertexAttribArray(loc.a_height);
        gl.vertexAttribPointer(loc.a_height, 1, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.intensity);
        gl.enableVertexAttribArray(loc.a_intensity);
        gl.vertexAttribPointer(loc.a_intensity, 1, gl.FLOAT, false, 0, 0);

        // Draw horizontal lines
        gl.uniform1f(loc.u_lineMode, 1.0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.horizontalIndices);
        gl.drawElements(gl.LINES, buffersRef.current.hIndexCount, gl.UNSIGNED_INT, 0);

        // Draw vertical lines
        gl.uniform1f(loc.u_lineMode, 2.0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.verticalIndices);
        gl.drawElements(gl.LINES, buffersRef.current.vIndexCount, gl.UNSIGNED_INT, 0);

        // Draw points
        gl.uniform1f(loc.u_lineMode, 0.0);
        gl.drawArrays(gl.POINTS, 0, GRID_ROWS * TOTAL_COLS);

        requestRef.current = requestAnimationFrame(draw);
    }, [getWaveformData]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(requestRef.current);
    }, [draw]);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, background: '#000' }}>
            <canvas ref={canvasRef} style={{ filter: `blur(${params.blur}px)` }} />

            {/* Control Panel */}
            {showControls && (
                <div style={{
                    position: 'absolute', top: 10, left: 10, right: 10,
                    background: 'rgba(0, 0, 0, 0.8)', padding: '15px 20px', borderRadius: '8px',
                    display: 'flex', flexWrap: 'wrap', gap: '25px', alignItems: 'center', zIndex: 20
                }}>
                    <div style={{ color: '#0f0', fontWeight: 'bold', marginRight: '10px' }}>WEBGL</div>

                    {Object.keys(DEFAULT_PARAMS).map((key) => {
                        let min, max, step;
                        if (key === 'camHeight') { min = 10; max = 500; step = 10; }
                        else if (key === 'camZ') { min = -500; max = 0; step = 10; }
                        else if (key === 'gravity') { min = 0.01; max = 1.0; step = 0.01; }
                        else if (key === 'attack') { min = 0.01; max = 1.0; step = 0.01; }
                        else if (key === 'decay') { min = 0.1; max = 0.9999; step = 0.0001; }
                        else if (key === 'elasticity') { min = 0.1; max = 0.99; step = 0.01; }
                        else if (key === 'smoothing') { min = 0; max = 20; step = 1; }
                        else if (key === 'maxStretch') { min = 50; max = 500; step = 10; }
                        else if (key === 'blur') { min = 0; max = 5; step = 0.5; }
                        else if (key === 'terrainHeight') { min = 0; max = 3; step = 0.1; }
                        else if (key === 'terrainScale') { min = 0.3; max = 3; step = 0.1; }
                        else { min = 0.1; max = 10.0; step = 0.1; } // Sensitivity

                        return (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', minWidth: '160px' }}
                                title={TOOLS_INFO[key]}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ color: '#fff', fontSize: '12px', marginRight: '6px', textTransform: 'uppercase', fontWeight: 600 }}>
                                        {key}
                                    </span>
                                    <span style={{
                                        color: '#0f0', fontSize: '10px', border: '1px solid #0f0', borderRadius: '50%',
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

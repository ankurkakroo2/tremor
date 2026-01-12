import { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';
import ControlPanel from './ControlPanel';

const DEFAULT_PARAMS = {
    // Audio Response
    sensitivity: 5.0,
    attack: 0.25,
    smoothing: 2,
    // Wave Physics
    gravity: 0.5,
    decay: 0.98,
    elasticity: 0.9,
    waveSpeed: 0.25,
    waveEnergy: 0.55,
    terrainPull: 0.06,
    // Visual
    maxStretch: 200,
    blur: 0,
    // Camera
    camHeight: 400,
    camZ: -160,
    // Terrain
    terrainHeight: 1.0,
    terrainScale: 1.0
};

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

    const { initAudio, getWaveformData, error } = useAudioAnalyzer({
        fftSize: 2048,
        simulation: isSimulating
    });

    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [showControls] = useState(true);
    const paramsRef = useRef(DEFAULT_PARAMS);

    const GRID_ROWS = 100;
    const TOTAL_COLS = 400;
    const PARTICLE_COUNT = GRID_ROWS * TOTAL_COLS;

    const terrainRef = useRef(null);
    const lastTerrainParamsRef = useRef({ height: 1.0, scale: 1.0 });

    const particleHeightsRef = useRef(new Float32Array(PARTICLE_COUNT));
    const particleVelocitiesRef = useRef(new Float32Array(PARTICLE_COUNT));
    const particleBaseHeightsRef = useRef(new Float32Array(PARTICLE_COUNT));

    const rawTargetsRef = useRef(new Float32Array(TOTAL_COLS));
    const smoothedTargetsRef = useRef(new Float32Array(TOTAL_COLS));
    const heightDataRef = useRef(new Float32Array(PARTICLE_COUNT));
    const intensityDataRef = useRef(new Float32Array(PARTICLE_COUNT));
    const prefixSumRef = useRef(new Float32Array(TOTAL_COLS + 1));

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
        const gridPosData = new Float32Array(PARTICLE_COUNT * 2);
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < TOTAL_COLS; c++) {
                const idx = (r * TOTAL_COLS + c) * 2;
                gridPosData[idx] = r;
                gridPosData[idx + 1] = c;
            }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.gridPos);
        gl.bufferData(gl.ARRAY_BUFFER, gridPosData, gl.STATIC_DRAW);

        // Allocate height and intensity buffers (reused every frame)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.height);
        gl.bufferData(gl.ARRAY_BUFFER, PARTICLE_COUNT * 4, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.intensity);
        gl.bufferData(gl.ARRAY_BUFFER, PARTICLE_COUNT * 4, gl.DYNAMIC_DRAW);

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

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = glRef.current;
        if (!gl) return;

        const program = programRef.current;
        if (!program) return;

        let animationId;

        const render = () => {
            if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                gl.viewport(0, 0, canvas.width, canvas.height);
            }

            const { width, height } = canvas;
            const P = paramsRef.current;

            const data = getWaveformData();

            const terrainParamsChanged =
                lastTerrainParamsRef.current.height !== P.terrainHeight ||
                lastTerrainParamsRef.current.scale !== P.terrainScale;

            if (!terrainRef.current || terrainParamsChanged) {
                terrainRef.current = generateTerrain(P.terrainHeight, P.terrainScale);
                lastTerrainParamsRef.current = { height: P.terrainHeight, scale: P.terrainScale };

                const terrain = terrainRef.current;
                const particleHeights = particleHeightsRef.current;
                const particleBaseHeights = particleBaseHeightsRef.current;

                for (let r = 0; r < GRID_ROWS; r++) {
                    for (let c = 0; c < TOTAL_COLS; c++) {
                        const idx = r * TOTAL_COLS + c;
                        const newBaseY = terrain[r][c];
                        const displacement = particleHeights[idx] - particleBaseHeights[idx];
                        particleBaseHeights[idx] = newBaseY;
                        particleHeights[idx] = newBaseY + Math.max(0, displacement);
                    }
                }
            }
            const terrain = terrainRef.current;

            if (particleBaseHeightsRef.current[0] === 0) {
                for (let r = 0; r < GRID_ROWS; r++) {
                    for (let c = 0; c < TOTAL_COLS; c++) {
                        const idx = r * TOTAL_COLS + c;
                        particleBaseHeightsRef.current[idx] = terrain[r][c];
                        particleHeightsRef.current[idx] = terrain[r][c];
                        particleVelocitiesRef.current[idx] = 0;
                    }
                }
            }

            const centerRow = Math.floor(GRID_ROWS * 0.85);
            const step = Math.floor(data.length / TOTAL_COLS) || 1;

            const rawTargets = rawTargetsRef.current;
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

            const smoothedTargets = smoothedTargetsRef.current;
            const radius = Math.round(P.smoothing);
            if (radius > 0) {
                const prefixSum = prefixSumRef.current;
                prefixSum[0] = 0;
                for (let i = 0; i < TOTAL_COLS; i++) {
                    prefixSum[i + 1] = prefixSum[i] + rawTargets[i];
                }
                for (let c = 0; c < TOTAL_COLS; c++) {
                    const left = Math.max(0, c - radius);
                    const right = Math.min(TOTAL_COLS - 1, c + radius);
                    const actualWindow = right - left + 1;
                    smoothedTargets[c] = (prefixSum[right + 1] - prefixSum[left]) / actualWindow;
                }
            } else {
                smoothedTargets.set(rawTargets);
            }

            const particleHeights = particleHeightsRef.current;
            const particleVelocities = particleVelocitiesRef.current;
            const particleBaseHeights = particleBaseHeightsRef.current;

            for (let c = 0; c < TOTAL_COLS; c++) {
                const idx = centerRow * TOTAL_COLS + c;
                const terrainHeight = particleBaseHeights[idx];
                const targetY = terrainHeight + smoothedTargets[c];

                if (targetY > particleHeights[idx]) {
                    particleHeights[idx] += (targetY - particleHeights[idx]) * P.attack;
                    particleVelocities[idx] = 0;
                } else {
                    particleVelocities[idx] -= P.gravity;
                    particleHeights[idx] += particleVelocities[idx];
                    if (particleHeights[idx] < terrainHeight) {
                        particleHeights[idx] = terrainHeight;
                        particleVelocities[idx] = 0;
                    }
                }
            }

            const propagate = (startR, endR, stepR, lookBackR) => {
                for (let r = startR; r !== endR; r += stepR) {
                    for (let c = 0; c < TOTAL_COLS; c++) {
                        const idx = r * TOTAL_COLS + c;
                        const sourceIdx = (r + lookBackR) * TOTAL_COLS + c;
                        const terrainHeight = particleBaseHeights[idx];
                        const sourceDisplacement = particleHeights[sourceIdx] - particleBaseHeights[sourceIdx];
                        const slope = terrainHeight - particleBaseHeights[sourceIdx];
                        const slopeFactor = slope > 0
                            ? Math.max(0.3, 1.0 - slope / 150)
                            : Math.min(1.1, 1.0 - slope / 300);
                        const waveDisplacement = sourceDisplacement * P.decay * slopeFactor;

                        let neighborDispSum = 0;
                        let count = 0;
                        if (c > 0) {
                            const leftIdx = r * TOTAL_COLS + (c - 1);
                            neighborDispSum += (particleHeights[leftIdx] - particleBaseHeights[leftIdx]);
                            count++;
                        }
                        if (c < TOTAL_COLS - 1) {
                            const rightIdx = r * TOTAL_COLS + (c + 1);
                            neighborDispSum += (particleHeights[rightIdx] - particleBaseHeights[rightIdx]);
                            count++;
                        }

                        let finalDisplacement = waveDisplacement;
                        if (count > 0) {
                            const avgNeighborDisp = neighborDispSum / count;
                            finalDisplacement = (waveDisplacement * 0.6) + (avgNeighborDisp * 0.4);
                        }
                        const finalTarget = terrainHeight + finalDisplacement;

                        particleVelocities[idx] += (finalTarget - particleHeights[idx]) * P.elasticity;
                        particleVelocities[idx] -= (particleHeights[idx] - terrainHeight) * P.terrainPull;
                        particleHeights[idx] += particleVelocities[idx] * P.waveSpeed;
                        particleVelocities[idx] *= P.waveEnergy;

                        if (particleHeights[idx] < terrainHeight) particleHeights[idx] = terrainHeight;
                    }
                }
            };

            propagate(centerRow + 1, GRID_ROWS, 1, -1);
            propagate(centerRow - 1, -1, -1, 1);

            const compress = (y) => {
                if (y <= 0) return 0;
                return P.maxStretch * (1 - Math.exp(-y / P.maxStretch));
            };

            const heightData = heightDataRef.current;
            const intensityData = intensityDataRef.current;

            for (let r = 0; r < GRID_ROWS; r++) {
                const rowOffset = r * TOTAL_COLS;
                for (let c = 0; c < TOTAL_COLS; c++) {
                    const idx = rowOffset + c;
                    const displacement = particleHeights[idx] - particleBaseHeights[idx];
                    const compressedY = compress(particleHeights[idx]);
                    heightData[idx] = compressedY + 5;
                    const rawIntensity = displacement / (height * 0.15);
                    intensityData[idx] = Math.max(0, Math.min(1, isNaN(rawIntensity) ? 0 : rawIntensity));
                }
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.height);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, heightData);

            gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.intensity);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, intensityData);

            gl.clearColor(0.02, 0.02, 0.04, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(program);

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

            gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.gridPos);
            gl.enableVertexAttribArray(loc.a_gridPos);
            gl.vertexAttribPointer(loc.a_gridPos, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.height);
            gl.enableVertexAttribArray(loc.a_height);
            gl.vertexAttribPointer(loc.a_height, 1, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.intensity);
            gl.enableVertexAttribArray(loc.a_intensity);
            gl.vertexAttribPointer(loc.a_intensity, 1, gl.FLOAT, false, 0, 0);

            gl.uniform1f(loc.u_lineMode, 1.0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.horizontalIndices);
            gl.drawElements(gl.LINES, buffersRef.current.hIndexCount, gl.UNSIGNED_INT, 0);

            gl.uniform1f(loc.u_lineMode, 2.0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.verticalIndices);
            gl.drawElements(gl.LINES, buffersRef.current.vIndexCount, gl.UNSIGNED_INT, 0);

            gl.uniform1f(loc.u_lineMode, 0.0);
            gl.drawArrays(gl.POINTS, 0, GRID_ROWS * TOTAL_COLS);

            animationId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationId);
    }, [initAudio, getWaveformData, generateTerrain]);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, background: '#000' }}>
            <canvas ref={canvasRef} style={{ filter: `blur(${params.blur}px)` }} />
            <ControlPanel
                params={params}
                onUpdate={updateParam}
                onReset={resetParams}
                showControls={showControls}
                error={error}
            />
        </div>
    );
}

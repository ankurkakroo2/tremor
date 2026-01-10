# Tremor

A high-performance, interactive 3D audio terrain visualization built with React, Vite, and WebGL. Audio input creates rolling waves across a procedurally generated hilly landscape.

## Features

-   **WebGL Rendering**: GPU-accelerated visualization with custom shaders for smooth 60fps performance.
-   **Procedural Terrain**: Dynamic hilly landscape with adjustable height and scale.
-   **Audio Reactivity**: Real-time microphone input drives waves across the terrain.
-   **Slope-Aware Physics**: Waves interact naturally with terrain - losing energy uphill, gaining momentum downhill.
-   **Interactive Control Panel**: Real-time tuning organized by category:
    -   **Audio**: Sensitivity, attack, smoothing
    -   **Wave Physics**: Gravity, decay, elasticity, wave speed, energy, terrain pull
    -   **Visual**: Max stretch, blur
    -   **Camera**: Height, zoom
    -   **Terrain**: Height, scale
-   **High Density Grid**: 40,000 particles (400x100 grid) running at 60fps.

## Tech Stack

-   **Frontend**: React
-   **Build Tool**: Vite
-   **Rendering**: WebGL with custom GLSL shaders
-   **Audio**: Web Audio API (`AnalyserNode`)

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```

3.  **Open in Browser**:
    Navigate to `http://localhost:5173`.
    *Note: Microphone permission is required for audio visualization.*

## Controls

*   **Simulate Audio**: Generates artificial audio data for testing without a microphone.
*   **Reset**: Restores default physics parameters.
*   **Hover Tooltips**: Hover over `?` icons in the control panel for parameter explanations.

## License

MIT

# Particle Waveform Visualization

A high-performance, interactive 3D particle waveform simulation built with React, Vite, and HTML5 Canvas. This project visualizes audio input as a dynamic, elastic mesh of particles.

<img width="3104" height="2092" alt="image" src="https://github.com/user-attachments/assets/ad5af115-2c45-4c67-8b74-57f0c71ab407" />

## Features

-   **3D Elastic Physics**: Particles behave like a connected fabric with elasticity, gravity, and wave propagation.
-   **Audio Reactivity**: Real-time microphone input drives the waveform, with adjustable sensitivity and smoothing.
-   **Interactive Control Panel**: Real-time tuning of simulation parameters:
    -   **Sensitivity**: Adjust audio impact.
    -   **Gravity & Attack**: Control particle physics.
    -   **Decay & Elasticity**: Modify wave propagation and mesh rigidity.
    -   **Smoothing**: Apply Gaussian blur to smooth out audio spikes.
    -   **Camera**: Adjust height and zoom.
-   **High Density Grid**: Optimized for ~20,000+ particles (200x100 grid) running at 60fps.
-   **Visuals**: "Cyber/Synthwave" aesthetic with horizon-based perspective, depth fog, and cyan color palette.

## Tech Stack

-   **Frontend**: React
-   **Build Tool**: Vite
-   **Rendering**: HTML5 Canvas (2D Context)
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

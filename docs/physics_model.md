# Waveform Physics and Algorithm Model

## Core Concept
The waveform visualization is a direct mapping of the **time-domain** audio signal to a 2D Cartesian coordinate system. Unlike frequency visualizers (bars), this renders the raw air pressure changes over time.

## 1. Data Source: Pulse Code Modulation (PCM)
The `AnalyserNode.getByteTimeDomainData` method provides an array of 8-bit integers (0-255).
- **128**: Silence (Zero amplitude)
- **0**: Maximum negative amplitude
- **255**: Maximum positive amplitude

## 2. The Physics of Particles
The waveform is visualized as a set of discrete, independent particles (dots).

### Sampling and Spacing
Instead of drawing every data point (which would create a crowded line), we downsample the 2048-point buffer to approximately 60 distinct "slots" across the screen.
- **Independence**: Each dot represents a specific frequency/time-bin's amplitude.
- **Visual Gaps**: Clear spacing is maintained to emphasize the "individual" nature of each particle.

### Coordinate Mapping
For each particle $p$ at index $i$:
- **X-axis (Position)**: Evenly distributed across the screen width.
  $$x = i \times \text{Spacing} + \text{Offset}$$
### Physics (Attack & Decay)
We apply different physics rules based on the particle's direction relative to the audio target:
1.  **Attack (Upward)**: "Ease-Out" / Linear Interpolation.
    -   When `TargetY < CurrentY` (Audio pushing up), the particle moves towards the target with a damping factor (`0.15`).
    -   This creates a "fast start, slow stop" motion as it reaches the peak.
2.  **Decay (Downward)**: Gravity.
    -   When `TargetY > CurrentY` (Audio retreating), the particle falls under constant gravity (`0.25`).
    -   Velocity increases over time ($v = v + g$), creating a "slow start, fast end" drop until it hits the floor.

3.  **Elastic Propagation (Mesh Physics)**:
    -   Instead of simple history shifting, we simulate an **elastic fabric**.
    -   **Vertical Pull**: Each particle is pulled by the particle in front of it (`Row r-1`), simulating a wave travelling backward.
        -   The signal decays by ~30% per hop (`0.7` factor), causing the ripple to fade out over ~6 rows.
    -   **Horizontal Smoothing**: Particles are also influenced by their left/right neighbors (20% weight), creating the "sheet" integrity.
    -   This creates a fluid, organic "reaction" that spreads through the mesh.

### 3D Coordinate System
We visualize a "Space-Time Continuum" sheet:
- **Wireframe**: Lines connect all particles, visualizing the tension and curvature of the elastic plane.
- **X-axis**: Frequency bins.
- **Y-axis**: Height (Amplitude).
- **Z-axis**: Depth (rows into the screen).

### Perspective Projection
- **Camera**: Positioned above and behind the grid.
- **Tilt**: Rotated 45 degrees around the X-axis for an angled view.
- **Projection**: Standard perspective divide ($x' = x/z$) creates depth, where distant rows appear smaller and converge.
- **Fog**: Alpha attenuation is applied based on Z-depth, fading out distant particles.

### Coordinate Mapping
- **X-axis**: Evenly distributed.
- **Y-axis**: Stateful position updated frame-by-frame.
- **Floor**: Hard constraint at `CenterY`.

### Normalization & Clamping
We only visualize positive pressure relative to the baseline (128):
$$\text{NormalizedValue} = \max(0, \frac{v - 128}{128.0})$$

### Simulation Physics
In simulation mode, we synthesize a signal that mimics the complex harmonics of human voice or music using:
$$v(t) = \sin(t) + 0.5\sin(2t) + \text{Noise}$$
This creates a composite wave that looks organic rather than a perfect mathematical sine wave.

## 3. Performance Considerations
- **requestAnimationFrame**: The rendering loop runs at the display's native refresh rate (usually 60Hz or 120Hz).
- **Canvas 2D API**: We use `ctx.lineTo` which is hardware accelerated in modern browsers and highly performant for thousands of points.
- **Typed Arrays**: `UInt8Array` allows for allocation-free updates of audio data.

## 4. Future Complex Shapes (Six Parts)
To evolve this into a 6-part complex shape:
1.  **Segmentation**: Divide the buffer into 6 chunks.
2.  **Polar Coordinates**: Instead of `x`, map `i` to an angle $\theta$ (0 to $2\pi$).
    $$x = \cos(\theta) \times (R + \text{Amplitude})$$
    $$y = \sin(\theta) \times (R + \text{Amplitude})$$
3.  **Spring Physics**: Apply a spring force to each vertex to make the shape "bounce" rather than instantly snap to the audio data.

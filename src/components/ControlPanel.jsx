import { memo } from 'react';

const TOOLS_INFO = {
    sensitivity: "Multiplies the audio input strength. Higher = Taller waves.",
    attack: "How fast particles react to new audio. Higher = Snappier response.",
    smoothing: "Spreads audio input to neighbors. Higher = Smooth hills. 0 = Spiky needles.",
    gravity: "Downward pull on particles. Higher = Particles fall faster.",
    decay: "Wave energy passed to next row. Higher = Waves travel further.",
    elasticity: "Connection strength. Higher = Solid sheet. Lower = Loose liquid.",
    waveSpeed: "How fast waves move per frame. Lower = Calmer motion.",
    waveEnergy: "Energy retained per frame. Higher = Waves travel further.",
    terrainPull: "How fast waves settle back to terrain. Higher = Quicker settling.",
    maxStretch: "Maximum wave height. Lower = More compression, stretchy feel.",
    blur: "Visual blur amount. Higher = Softer, dreamier look.",
    camHeight: "Vertical camera position. Lower = Horizon view.",
    camZ: "Camera zoom/distance. Negative is further back.",
    terrainHeight: "Height of hills/mountains. Higher = Taller terrain.",
    terrainScale: "Size of hills. Higher = Larger, rolling hills. Lower = More frequent bumps."
};

const PARAM_CATEGORIES = {
    'Audio': ['sensitivity', 'attack', 'smoothing'],
    'Wave Physics': ['gravity', 'decay', 'elasticity', 'waveSpeed', 'waveEnergy', 'terrainPull'],
    'Visual': ['maxStretch', 'blur'],
    'Camera': ['camHeight', 'camZ'],
    'Terrain': ['terrainHeight', 'terrainScale']
};

const DEFAULT_CONFIG = {
    sensitivity: { min: 0.1, max: 10.0, step: 0.1 },
    attack: { min: 0.01, max: 1.0, step: 0.01 },
    smoothing: { min: 0, max: 20, step: 1 },
    gravity: { min: 0.01, max: 1.0, step: 0.01 },
    decay: { min: 0.1, max: 0.9999, step: 0.0001 },
    elasticity: { min: 0.1, max: 0.99, step: 0.01 },
    waveSpeed: { min: 0.05, max: 0.5, step: 0.01 },
    waveEnergy: { min: 0.3, max: 0.9, step: 0.01 },
    terrainPull: { min: 0.01, max: 0.2, step: 0.01 },
    maxStretch: { min: 50, max: 500, step: 10 },
    blur: { min: 0, max: 5, step: 0.5 },
    camHeight: { min: 10, max: 500, step: 10 },
    camZ: { min: -500, max: 0, step: 10 },
    terrainHeight: { min: 0, max: 3, step: 0.1 },
    terrainScale: { min: 0.3, max: 3, step: 0.1 }
};

const CATEGORY_COLORS = {
    'Audio': '#4fc3f7',
    'Wave Physics': '#81c784',
    'Visual': '#ffb74d',
    'Camera': '#ba68c8',
    'Terrain': '#a1887f'
};

const SliderControl = memo(function SliderControl({ param, value, config, color, onChange }) {
    return (
        <div
            style={{ display: 'flex', flexDirection: 'column', minWidth: '140px', flex: '1 1 140px', maxWidth: '180px' }}
            title={TOOLS_INFO[param]}
        >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ color: '#ccc', fontSize: '10px', marginRight: '4px', textTransform: 'uppercase', fontWeight: 500 }}>
                    {param.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span style={{
                    color: color, fontSize: '8px', border: `1px solid ${color}`, borderRadius: '50%',
                    width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'help'
                }}>?</span>
            </div>
            <input
                type="range" min={config.min} max={config.max} step={config.step}
                value={value}
                onChange={(e) => onChange(param, parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', height: '4px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#555', fontSize: '8px' }}>{config.min}</span>
                <span style={{ color: '#aaa', fontSize: '9px', fontWeight: 'bold' }}>{value.toFixed(config.step < 0.1 ? 2 : 1)}</span>
                <span style={{ color: '#555', fontSize: '8px' }}>{config.max}</span>
            </div>
        </div>
    );
});

const CategorySection = memo(function CategorySection({ category, params, keys, onUpdate }) {
    const color = CATEGORY_COLORS[category] || '#fff';
    return (
        <div style={{ marginBottom: '15px' }}>
            <div style={{
                color: color, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                marginBottom: '8px', borderBottom: `1px solid ${color}`, paddingBottom: '4px'
            }}>
                {category}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                {keys.map((key) => (
                    <SliderControl
                        key={key}
                        param={key}
                        value={params[key]}
                        config={DEFAULT_CONFIG[key]}
                        color={color}
                        onChange={onUpdate}
                    />
                ))}
            </div>
        </div>
    );
});

const ControlPanel = memo(function ControlPanel({ params, onUpdate, onReset, showControls, error }) {
    if (!showControls) return null;

    return (
        <div style={{
            position: 'absolute', top: 10, left: 10, right: 10,
            background: 'rgba(0, 0, 0, 0.9)', padding: '15px 20px', borderRadius: '8px',
            zIndex: 20, maxHeight: '40vh', overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ color: '#0f0', fontWeight: 'bold', fontSize: '14px' }}>WEBGL CONTROLS</div>
                <button
                    onClick={onReset}
                    style={{
                        padding: '6px 16px', background: '#333', color: '#fff',
                        border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
                        fontWeight: 'bold'
                    }}
                >
                    RESET ALL
                </button>
            </div>

            {Object.entries(PARAM_CATEGORIES).map(([category, keys]) => (
                <CategorySection
                    key={category}
                    category={category}
                    params={params}
                    keys={keys}
                    onUpdate={onUpdate}
                />
            ))}

            {error && <div style={{ color: 'red', marginTop: '10px' }}>{error.message}</div>}
        </div>
    );
});

export default ControlPanel;

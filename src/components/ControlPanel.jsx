import { memo, useState } from 'react';

const CONFIG = {
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

const CATEGORIES = {
    'Audio': { color: '#00ff88', params: ['sensitivity', 'attack', 'smoothing'] },
    'Wave Physics': { color: '#00d4ff', params: ['gravity', 'decay', 'elasticity', 'waveSpeed', 'waveEnergy', 'terrainPull'] },
    'Visual': { color: '#ffaa00', params: ['maxStretch', 'blur'] },
    'Camera': { color: '#aa66ff', params: ['camHeight', 'camZ'] },
    'Terrain': { color: '#ff6644', params: ['terrainHeight', 'terrainScale'] }
};

const formatValue = (key, value) => {
    const step = CONFIG[key].step;
    return step < 0.1 ? value.toFixed(2) : Math.round(value);
};

const formatLabel = (key) => key.replace(/([A-Z])/g, ' $1').trim();

const Slider = memo(function Slider({ param, value, color, onChange }) {
    const cfg = CONFIG[param];
    return (
        <div className="slider">
            <div className="slider-header">
                <span className="slider-label">{formatLabel(param)}</span>
                <span className="slider-value" style={{ color }}>{formatValue(param, value)}</span>
            </div>
            <input
                type="range"
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={value}
                onChange={(e) => onChange(param, parseFloat(e.target.value))}
                style={{ accentColor: color }}
            />
        </div>
    );
});

const CategoryGroup = memo(function CategoryGroup({ category, data, color, params, onUpdate }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="category">
            <button className="category-toggle" onClick={() => setIsOpen(!isOpen)}>
                <span className="category-name" style={{ color }}>{category}</span>
                <span className="toggle-icon" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
            </button>
            {isOpen && (
                <div className="category-content">
                    {data.map((param) => (
                        <Slider
                            key={param}
                            param={param}
                            value={params[param]}
                            color={color}
                            onChange={onUpdate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

function ControlPanel({ params, onUpdate, onReset, showControls, error }) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!showControls) return null;

    return (
        <div className={`control-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
            <style>{`
                .control-panel {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    background: rgba(0, 8, 16, 0.92);
                    border: 1px solid rgba(0, 255, 136, 0.3);
                    border-radius: 8px;
                    z-index: 100;
                    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
                    font-size: 11px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5), 0 0 1px rgba(0, 255, 136, 0.1);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    max-height: calc(100vh - 100px);
                    overflow: hidden;
                }
                .control-panel.collapsed {
                    width: auto;
                }
                .control-panel.expanded {
                    width: 380px;
                }
                .panel-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 14px;
                    border-bottom: 1px solid rgba(0, 255, 136, 0.2);
                    background: linear-gradient(180deg, rgba(0, 255, 136, 0.08) 0%, rgba(0, 255, 136, 0.02) 100%);
                }
                .toggle-panel {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                }
                .panel-title {
                    font-weight: 600;
                    font-size: 12px;
                    color: #00ff88;
                    letter-spacing: 2px;
                }
                .toggle-icon {
                    color: #00ff88;
                    font-size: 12px;
                    transition: transform 0.2s ease;
                }
                .panel-actions {
                    display: flex;
                    gap: 8px;
                }
                .btn-reset {
                    background: rgba(255, 60, 60, 0.1);
                    border: 1px solid rgba(255, 60, 60, 0.4);
                    color: #ff3c3c;
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    letter-spacing: 1px;
                    font-family: inherit;
                }
                .btn-reset:hover {
                    background: rgba(255, 60, 60, 0.2);
                    border-color: rgba(255, 60, 60, 0.7);
                }
                .panel-content {
                    padding: 6px 0;
                    max-height: calc(100vh - 160px);
                    overflow-y: auto;
                }
                .panel-content::-webkit-scrollbar {
                    width: 5px;
                }
                .panel-content::-webkit-scrollbar-track {
                    background: transparent;
                }
                .panel-content::-webkit-scrollbar-thumb {
                    background: rgba(0, 255, 136, 0.3);
                    border-radius: 3px;
                }
                .category {
                    margin-bottom: 2px;
                }
                .category-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 14px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    transition: background 0.2s;
                    font-family: inherit;
                }
                .category-toggle:hover {
                    background: rgba(255, 255, 255, 0.04);
                }
                .category-name {
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                }
                .category-content {
                    padding: 4px 14px 8px 28px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                .slider {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .slider-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .slider-label {
                    color: rgba(255, 255, 255, 0.45);
                    font-size: 9px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .slider-value {
                    font-size: 10px;
                    font-weight: 600;
                    min-width: 32px;
                    text-align: right;
                }
                .slider input[type="range"] {
                    width: 100%;
                    height: 3px;
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 2px;
                    appearance: none;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .slider input[type="range"]:hover {
                    background: rgba(255, 255, 255, 0.12);
                }
                .slider input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 10px;
                    height: 10px;
                    background: currentColor;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: transform 0.15s, box-shadow 0.15s;
                    box-shadow: 0 0 8px currentColor;
                }
                .slider input[type="range"]::-webkit-slider-thumb:hover {
                    transform: scale(1.25);
                    box-shadow: 0 0 12px currentColor;
                }
                .error {
                    color: #ff3c3c;
                    padding: 8px 14px;
                    font-size: 10px;
                }
            `}</style>

            <div className="panel-header">
                <button className="toggle-panel" onClick={() => setIsExpanded(!isExpanded)}>
                    <span className="panel-title">CONTROLS</span>
                    <span className="toggle-icon">{isExpanded ? '−' : '+'}</span>
                </button>
                {isExpanded && (
                    <div className="panel-actions">
                        <button className="btn-reset" onClick={onReset}>RESET</button>
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="panel-content">
                    {Object.entries(CATEGORIES).map(([category, { color, params: categoryParams }]) => (
                        <CategoryGroup
                            key={category}
                            category={category}
                            data={categoryParams}
                            color={color}
                            params={params}
                            onUpdate={onUpdate}
                        />
                    ))}

                    {error && <div className="error">{error.message}</div>}
                </div>
            )}
        </div>
    );
}

export default memo(ControlPanel);

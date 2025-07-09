import React, { useRef, useEffect, useState } from 'react';
import { TerrainProvider, useTerrain } from '../../context/terrain-gen/TerrainContext.jsx';
import { useTerrainMap } from '../../hooks/terrain-gen/useTerrainMap.js';
import { useSettings } from '../../hooks/terrain-gen/useSettings.js';
import CanvasInteractions from './CanvasInteractions.jsx';
import '../../../terrain-gen/dashboard.css';

// CSS override for terrain dashboard to fix scrolling
const terrainDashboardStyles = `
  body {
    display: block !important;
    place-items: unset !important;
    min-height: unset !important;
    overflow: auto !important;
  }
  
  #app {
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    text-align: left !important;
  }
  
  .container button {
    color: #ffffff !important;
    background-color: #00ff88 !important;
    border: none !important;
    padding: 12px 20px !important;
    border-radius: 5px !important;
    font-weight: bold !important;
    font-size: 14px !important;
  }
`;

// Inject styles when component mounts
const injectStyles = () => {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = terrainDashboardStyles;
  document.head.appendChild(styleSheet);
  return styleSheet;
};

const removeStyles = (styleSheet) => {
  if (styleSheet && styleSheet.parentNode) {
    styleSheet.parentNode.removeChild(styleSheet);
  }
};

const TerrainCanvas = () => {
  const canvasRef = useRef(null);
  const { generateTerrain } = useTerrainMap(canvasRef);
  const { map } = useTerrain();
  const [showInteractions, setShowInteractions] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 800;
      canvas.height = 600;
      
      // Set up canvas context with dark theme background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add text indicating canvas is ready
      ctx.fillStyle = '#00ff88';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Terrain Canvas Ready - Click Generate to Start', canvas.width / 2, canvas.height / 2);
    }
  }, []);
  
  useEffect(() => {
    // Show interactions once map is generated
    setShowInteractions(!!map?.voronoiGenerator?.delaunatorWrapper?.voronoiCells);
  }, [map]);

  return (
    <div className="canvas-container">
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas 
          ref={canvasRef}
          id="voronoiCanvas"
        />
        {showInteractions && <CanvasInteractions canvasRef={canvasRef} />}
      </div>
      <div className="button-group">
        <button onClick={generateTerrain}>
          Generate Terrain
        </button>
      </div>
    </div>
  );
};

const SettingsPanel = () => {
  const { getSettingValue, setSettingValue } = useSettings();

  return (
    <div className="controls">
      <div className="control-section">
        <h3>1. Voronoi Diagram</h3>
        <div className="settings">
          <div className="setting-item">
            <label>Number of Sites</label>
            <input 
              type="number" 
              min="10" 
              max="200" 
              value={getSettingValue('voronoi', 'numSites')}
              onChange={(e) => setSettingValue('voronoi', 'numSites', parseInt(e.target.value))}
            />
          </div>
          <div className="setting-item">
            <label>Poisson Radius</label>
            <input 
              type="number" 
              min="10" 
              max="50" 
              value={getSettingValue('voronoi', 'poissonRadius')}
              onChange={(e) => setSettingValue('voronoi', 'poissonRadius', parseInt(e.target.value))}
            />
          </div>
          <div className="setting-item">
            <label>Seed</label>
            <input 
              type="number" 
              value={getSettingValue('voronoi', 'seed')}
              onChange={(e) => setSettingValue('voronoi', 'seed', parseInt(e.target.value))}
            />
          </div>
          <div className="setting-item">
            <label>Distribution</label>
            <select 
              value={getSettingValue('voronoi', 'distribution')}
              onChange={(e) => setSettingValue('voronoi', 'distribution', e.target.value)}
            >
              <option value="poisson">Poisson</option>
              <option value="random">Random</option>
              <option value="grid">Grid</option>
              <option value="hexagonal">Hexagonal</option>
            </select>
          </div>
        </div>
      </div>

      <div className="control-section">
        <h3>4. Water Features</h3>
        <div className="settings">
          <div className="setting-item">
            <label>Number of Rivers</label>
            <input 
              type="number" 
              min="1" 
              max="4" 
              value={getSettingValue('rivers', 'count')}
              onChange={(e) => setSettingValue('rivers', 'count', parseInt(e.target.value))}
            />
          </div>
          <div className="setting-item">
            <label>Tributary Depth</label>
            <input 
              type="number" 
              min="1" 
              max="5" 
              value={getSettingValue('tributaries', 'depth')}
              onChange={(e) => setSettingValue('tributaries', 'depth', parseInt(e.target.value))}
            />
          </div>
          <div className="setting-item">
            <label>Branch Probability</label>
            <input 
              type="number" 
              min="0.1" 
              max="1.0" 
              step="0.1"
              value={getSettingValue('tributaries', 'branchProbability')}
              onChange={(e) => setSettingValue('tributaries', 'branchProbability', parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
      
      <div className="control-section">
        <h3>7. Visualization Options</h3>
        <div className="settings">
          <div className="setting-item">
            <label>Highlight Vertex ID</label>
            <input 
              type="number" 
              min="0" 
              value={getSettingValue('visualization', 'highlightVertexId') || ''}
              onChange={(e) => setSettingValue('visualization', 'highlightVertexId', parseInt(e.target.value) || 0)}
              placeholder="Enter vertex ID"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusAndLogs = () => {
  const { status, logs } = useTerrain();
  
  return (
    <div className="status">
      <h4>Status: {status}</h4>
      <div className="log">
        {logs.map((log, index) => (
          <div key={index}>
            [{log.timestamp}] {log.message}
          </div>
        ))}
      </div>
    </div>
  );
};

const TerrainDashboard = () => {
  const styleSheetRef = useRef(null);
  
  useEffect(() => {
    // Inject CSS overrides when component mounts
    styleSheetRef.current = injectStyles();
    
    // Clean up styles when component unmounts
    return () => {
      removeStyles(styleSheetRef.current);
    };
  }, []);
  
  return (
    <TerrainProvider>
      <div className="container">
        <div className="header">
          <h1>Terrain Generation Dashboard</h1>
          <p>Generate and visualize Voronoi-based terrain features</p>
        </div>
        
        <SettingsPanel />
        <TerrainCanvas />
        <StatusAndLogs />
      </div>
    </TerrainProvider>
  );
};

export default TerrainDashboard;
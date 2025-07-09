# Current Changes Plan: React Migration and Input Field Functionality

*Planning Date: 2025-01-05*  
*Focus: Making input fields functional and transitioning to React*

---

## 🎯 Overview

This document outlines the plan to transition the terrain generation dashboard from vanilla JavaScript to React while making all input fields functional and ensuring they derive their values from the Map object.

---

## 📊 Current State Analysis

### Functional Input Fields (6/18)
✅ **Working:**
- `numSites` - Controls Voronoi site generation
- `poissonRadius` - Controls Poisson disk sampling radius  
- `seed` - Controls random number generation
- `riversCount` - Controls number of rivers generated
- `distribution` - Read but only "poisson" implemented
- `highlightVertexId` - Controls vertex highlighting

### Non-Functional Input Fields (12/18)
❌ **Needs Implementation:**
- `jsonFilePathInput` - Import functionality missing
- `coastDirection`, `coastBudget` - No coastline generator
- `hillsBudget`, `hillsOrigins`, `hillsGradient` - No hills generator
- `lakesBudget`, `lakesOrigins` - No lakes generator
- `tributaryDepth`, `branchProbability`, `minTributaryDistance`, `maxTributaryDistance`, `branchingSeparation` - Hardcoded values

---

## 🚀 Phase 1: React Foundation Setup

### 1.1 Project Structure Refactor
```
terrain-gen/
├── src/
│   ├── components/           # React components
│   │   ├── Dashboard.jsx
│   │   ├── ControlPanel.jsx
│   │   ├── TerrainCanvas.jsx
│   │   ├── sections/
│   │   │   ├── VoronoiSection.jsx
│   │   │   ├── RiversSection.jsx
│   │   │   ├── CoastlineSection.jsx
│   │   │   ├── HillsSection.jsx
│   │   │   ├── LakesSection.jsx
│   │   │   ├── MarshesSection.jsx
│   │   │   └── VisualizationSection.jsx
│   │   └── ui/
│   │       ├── InputField.jsx
│   │       ├── ButtonGroup.jsx
│   │       ├── StatusDisplay.jsx
│   │       └── LogOutput.jsx
│   ├── hooks/               # React hooks
│   │   ├── useTerrainMap.js
│   │   ├── useSettings.js
│   │   └── useCanvasInteraction.js
│   ├── context/             # React context
│   │   ├── TerrainContext.jsx
│   │   └── SettingsContext.jsx
│   ├── core/               # Existing terrain logic
│   └── utils/              # Shared utilities
└── public/
    └── index.html
```

### 1.2 Settings Schema Definition
```javascript
// src/config/SettingsSchema.js
export const TERRAIN_SETTINGS_SCHEMA = {
  voronoi: {
    numSites: { 
      type: 'number', 
      min: 10, 
      max: 200, 
      default: 50,
      label: 'Number of Sites',
      description: 'Number of Voronoi sites to generate'
    },
    distribution: {
      type: 'select',
      options: ['poisson', 'random', 'grid', 'hexagonal'],
      default: 'poisson',
      label: 'Distribution',
      description: 'Site distribution pattern'
    },
    poissonRadius: {
      type: 'number',
      min: 10,
      max: 50,
      default: 25,
      label: 'Poisson Radius',
      description: 'Minimum distance between Poisson disk samples'
    },
    seed: {
      type: 'number',
      default: 12345,
      label: 'Seed',
      description: 'Random seed for deterministic generation'
    }
  },
  coastlines: {
    enabled: { type: 'boolean', default: false },
    direction: {
      type: 'select',
      options: ['N', 'S', 'E', 'W'],
      default: 'N',
      label: 'Coast Direction'
    },
    budget: {
      type: 'number',
      min: 10,
      max: 500,
      step: 10,
      default: 50,
      label: 'Coast Budget'
    }
  },
  hills: {
    enabled: { type: 'boolean', default: false },
    budget: {
      type: 'number',
      min: 20,
      max: 500,
      step: 10,
      default: 100,
      label: 'Hills Budget'
    },
    origins: {
      type: 'number',
      min: 1,
      max: 10,
      default: 3,
      label: 'Number of Origins'
    },
    gradient: {
      type: 'boolean',
      default: true,
      label: 'Gradient Enabled'
    }
  },
  lakes: {
    enabled: { type: 'boolean', default: false },
    budget: {
      type: 'number',
      min: 10,
      max: 200,
      step: 5,
      default: 30,
      label: 'Lakes Budget'
    },
    origins: {
      type: 'number',
      min: 1,
      max: 5,
      default: 2,
      label: 'Number of Lakes'
    }
  },
  rivers: {
    enabled: { type: 'boolean', default: true },
    count: {
      type: 'number',
      min: 1,
      max: 4,
      default: 2,
      label: 'Number of Rivers'
    }
  },
  tributaries: {
    enabled: { type: 'boolean', default: true },
    depth: {
      type: 'number',
      min: 1,
      max: 5,
      default: 3,
      label: 'Tributary Depth'
    },
    branchProbability: {
      type: 'number',
      min: 0.1,
      max: 1.0,
      step: 0.1,
      default: 0.7,
      label: 'Branch Probability'
    },
    minDistance: {
      type: 'number',
      min: 5,
      max: 50,
      default: 15,
      label: 'Min Tributary Distance'
    },
    maxDistance: {
      type: 'number',
      min: 20,
      max: 200,
      default: 80,
      label: 'Max Tributary Distance'
    },
    branchingSeparation: {
      type: 'number',
      min: 2,
      max: 15,
      default: 5,
      label: 'Branching Separation'
    }
  },
  marshes: {
    enabled: { type: 'boolean', default: false }
  },
  visualization: {
    showTriangulation: { type: 'boolean', default: true },
    showVoronoiEdges: { type: 'boolean', default: true },
    showSites: { type: 'boolean', default: true },
    showVertices: { type: 'boolean', default: false },
    showHeightGradient: { type: 'boolean', default: true },
    showLakes: { type: 'boolean', default: true },
    showMarshes: { type: 'boolean', default: true },
    showRivers: { type: 'boolean', default: true }
  }
};
```

---

## 🔧 Phase 2: React Context and State Management

### 2.1 Terrain Context Implementation
```jsx
// src/context/TerrainContext.jsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { TERRAIN_SETTINGS_SCHEMA } from '../config/SettingsSchema.js';

const TerrainContext = createContext();

const terrainReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_SETTING':
      return {
        ...state,
        settings: {
          ...state.settings,
          [action.category]: {
            ...state.settings[action.category],
            [action.key]: action.value
          }
        }
      };
    case 'UPDATE_MAP':
      return {
        ...state,
        map: action.map,
        lastGenerated: Date.now()
      };
    case 'SET_STATUS':
      return {
        ...state,
        status: action.status
      };
    case 'ADD_LOG':
      return {
        ...state,
        logs: [...state.logs, { 
          timestamp: new Date().toLocaleTimeString(), 
          message: action.message 
        }]
      };
    default:
      return state;
  }
};

export const TerrainProvider = ({ children }) => {
  const [state, dispatch] = useReducer(terrainReducer, {
    settings: getDefaultSettings(),
    map: null,
    status: 'Ready to generate terrain features',
    logs: [],
    lastGenerated: null
  });

  const updateSetting = useCallback((category, key, value) => {
    dispatch({ type: 'UPDATE_SETTING', category, key, value });
  }, []);

  const updateMap = useCallback((map) => {
    dispatch({ type: 'UPDATE_MAP', map });
  }, []);

  const setStatus = useCallback((status) => {
    dispatch({ type: 'SET_STATUS', status });
  }, []);

  const addLog = useCallback((message) => {
    dispatch({ type: 'ADD_LOG', message });
  }, []);

  return (
    <TerrainContext.Provider value={{
      ...state,
      updateSetting,
      updateMap,
      setStatus,
      addLog
    }}>
      {children}
    </TerrainContext.Provider>
  );
};

export const useTerrain = () => {
  const context = useContext(TerrainContext);
  if (!context) {
    throw new Error('useTerrain must be used within TerrainProvider');
  }
  return context;
};

function getDefaultSettings() {
  const settings = {};
  Object.keys(TERRAIN_SETTINGS_SCHEMA).forEach(category => {
    settings[category] = {};
    Object.keys(TERRAIN_SETTINGS_SCHEMA[category]).forEach(key => {
      settings[category][key] = TERRAIN_SETTINGS_SCHEMA[category][key].default;
    });
  });
  return settings;
}
```

### 2.2 Custom Hooks
```jsx
// src/hooks/useTerrainMap.js
import { useEffect, useCallback } from 'react';
import { useTerrain } from '../context/TerrainContext.jsx';
import { Map } from '../core/Map.js';
import { FeatureDrawer } from '../core/drawer/FeatureDrawer.js';

export const useTerrainMap = (canvasRef) => {
  const { settings, updateMap, setStatus, addLog } = useTerrain();

  const generateTerrain = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      setStatus('Generating terrain...');
      addLog('Starting terrain generation');

      const featureDrawer = new FeatureDrawer(canvasRef.current, settings);
      const map = new Map(featureDrawer, settings);
      
      await map.generateVoronoi();
      
      if (settings.rivers.enabled) {
        await map.generateRivers();
      }
      
      if (settings.tributaries.enabled) {
        await map.generateTributaries();
      }

      updateMap(map);
      setStatus('Terrain generated successfully');
      addLog(`Generated terrain with ${map.getCellCount()} cells`);
      
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      addLog(`Error generating terrain: ${error.message}`);
    }
  }, [settings, canvasRef, updateMap, setStatus, addLog]);

  const regenerateIfNeeded = useCallback(() => {
    // Auto-regenerate when critical settings change
    const criticalSettings = ['voronoi.numSites', 'voronoi.seed', 'rivers.count'];
    // Implementation for checking if regeneration is needed
  }, [settings]);

  return {
    generateTerrain,
    regenerateIfNeeded
  };
};

// src/hooks/useSettings.js
import { useCallback } from 'react';
import { useTerrain } from '../context/TerrainContext.jsx';
import { TERRAIN_SETTINGS_SCHEMA } from '../config/SettingsSchema.js';

export const useSettings = () => {
  const { settings, updateSetting } = useTerrain();

  const getSettingValue = useCallback((category, key) => {
    return settings[category]?.[key] ?? TERRAIN_SETTINGS_SCHEMA[category]?.[key]?.default;
  }, [settings]);

  const setSettingValue = useCallback((category, key, value) => {
    const schema = TERRAIN_SETTINGS_SCHEMA[category]?.[key];
    if (schema) {
      // Validate value against schema
      const validatedValue = validateValue(value, schema);
      updateSetting(category, key, validatedValue);
    }
  }, [updateSetting]);

  const getSettingSchema = useCallback((category, key) => {
    return TERRAIN_SETTINGS_SCHEMA[category]?.[key];
  }, []);

  return {
    getSettingValue,
    setSettingValue,
    getSettingSchema
  };
};

function validateValue(value, schema) {
  switch (schema.type) {
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) return schema.default;
      if (schema.min !== undefined && num < schema.min) return schema.min;
      if (schema.max !== undefined && num > schema.max) return schema.max;
      return num;
    case 'boolean':
      return Boolean(value);
    case 'select':
      return schema.options.includes(value) ? value : schema.default;
    default:
      return value;
  }
}
```

---

## 🎨 Phase 3: React Component Implementation

### 3.1 Main Dashboard Component
```jsx
// src/components/Dashboard.jsx
import React, { useRef } from 'react';
import { TerrainProvider } from '../context/TerrainContext.jsx';
import ControlPanel from './ControlPanel.jsx';
import TerrainCanvas from './TerrainCanvas.jsx';
import StatusDisplay from './ui/StatusDisplay.jsx';
import LogOutput from './ui/LogOutput.jsx';

const Dashboard = () => {
  return (
    <TerrainProvider>
      <div className="container">
        <div className="header">
          <h1>Terrain Generation Dashboard</h1>
          <p>Generate and visualize Voronoi-based terrain features</p>
        </div>
        
        <div className="main-content">
          <ControlPanel />
          <div className="visualization-area">
            <TerrainCanvas />
            <StatusDisplay />
            <LogOutput />
          </div>
        </div>
      </div>
    </TerrainProvider>
  );
};

export default Dashboard;
```

### 3.2 Dynamic Input Field Component
```jsx
// src/components/ui/InputField.jsx
import React from 'react';
import { useSettings } from '../../hooks/useSettings.js';

const InputField = ({ category, settingKey, label, description }) => {
  const { getSettingValue, setSettingValue, getSettingSchema } = useSettings();
  
  const value = getSettingValue(category, settingKey);
  const schema = getSettingSchema(category, settingKey);
  
  const handleChange = (e) => {
    const newValue = schema.type === 'number' ? 
      parseFloat(e.target.value) : e.target.value;
    setSettingValue(category, settingKey, newValue);
  };

  const renderInput = () => {
    switch (schema.type) {
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={handleChange}
            min={schema.min}
            max={schema.max}
            step={schema.step || 1}
          />
        );
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => setSettingValue(category, settingKey, e.target.checked)}
          />
        );
      case 'select':
        return (
          <select value={value} onChange={handleChange}>
            {schema.options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={handleChange}
          />
        );
    }
  };

  return (
    <div className="setting-item">
      <label>
        {label || schema.label}
        {description && <span className="description">{description}</span>}
      </label>
      {renderInput()}
    </div>
  );
};

export default InputField;
```

### 3.3 Section Components
```jsx
// src/components/sections/VoronoiSection.jsx
import React from 'react';
import InputField from '../ui/InputField.jsx';
import ButtonGroup from '../ui/ButtonGroup.jsx';

const VoronoiSection = () => {
  return (
    <div className="control-section">
      <h3>1. Voronoi Diagram</h3>
      
      <ButtonGroup>
        <button id="generateVoronoiBtn">Generate Voronoi Diagram</button>
        <button id="importDataBtn">Import Data JSON</button>
        <button id="clearAllBtn">Clear All</button>
      </ButtonGroup>

      <div className="settings">
        <InputField 
          category="voronoi" 
          settingKey="numSites" 
        />
        <InputField 
          category="voronoi" 
          settingKey="distribution" 
        />
        <InputField 
          category="voronoi" 
          settingKey="poissonRadius" 
        />
        <InputField 
          category="voronoi" 
          settingKey="seed" 
        />
      </div>
    </div>
  );
};

export default VoronoiSection;

// src/components/sections/RiversSection.jsx
import React from 'react';
import InputField from '../ui/InputField.jsx';
import ButtonGroup from '../ui/ButtonGroup.jsx';

const RiversSection = () => {
  return (
    <div className="control-section">
      <h3>4. Water Features</h3>
      
      <ButtonGroup>
        <button id="generateRiversBtn">Generate Rivers</button>
        <button id="generateTributariesBtn">Generate Tributaries</button>
        <button id="clearRiversBtn">Clear Rivers</button>
      </ButtonGroup>

      <div className="settings">
        <InputField category="rivers" settingKey="count" />
        <InputField category="tributaries" settingKey="depth" />
        <InputField category="tributaries" settingKey="branchProbability" />
        <InputField category="tributaries" settingKey="minDistance" />
        <InputField category="tributaries" settingKey="maxDistance" />
        <InputField category="tributaries" settingKey="branchingSeparation" />
      </div>
    </div>
  );
};

export default RiversSection;
```

---

## ⚙️ Phase 4: Missing Feature Implementation

### 4.1 Coastline Generator Implementation
```javascript
// src/core/coastlines/CoastlineGenerator.js
export class CoastlineGenerator {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.coastalCells = new Set();
  }

  generateCoastline(direction, budget) {
    const cells = this.voronoiGenerator.getCells();
    const edgeCells = this.findEdgeCells(cells, direction);
    
    let remainingBudget = budget;
    const coastalCells = [];

    for (const cell of edgeCells) {
      if (remainingBudget <= 0) break;
      
      this.markAsCoastal(cell);
      coastalCells.push(cell);
      remainingBudget--;
    }

    this.coastalCells = new Set(coastalCells);
    return coastalCells;
  }

  findEdgeCells(cells, direction) {
    const gridSize = this.settings.gridSize;
    const margin = this.settings.margin;
    
    return Array.from(cells.values()).filter(cell => {
      switch (direction) {
        case 'N': return cell.site.z < margin;
        case 'S': return cell.site.z > gridSize - margin;
        case 'E': return cell.site.x > gridSize - margin;
        case 'W': return cell.site.x < margin;
        default: return false;
      }
    });
  }

  markAsCoastal(cell) {
    cell.setMetadata('isCoastal', true);
    cell.setMetadata('coastalDepth', 0);
  }

  getCoastalCells() {
    return Array.from(this.coastalCells);
  }

  clearCoastline() {
    this.coastalCells.forEach(cell => {
      cell.setMetadata('isCoastal', false);
      cell.setMetadata('coastalDepth', null);
    });
    this.coastalCells.clear();
  }
}
```

### 4.2 Hills Generator Implementation
```javascript
// src/core/hills/HillsGenerator.js
export class HillsGenerator {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.hillCells = new Set();
    this.heights = new Map();
  }

  generateHills(budget, numOrigins, gradientEnabled) {
    const cells = this.voronoiGenerator.getCells();
    const origins = this.selectHillOrigins(cells, numOrigins);
    
    let remainingBudget = budget;
    const hillCells = [];

    for (const origin of origins) {
      const hillCluster = this.generateHillCluster(origin, remainingBudget / numOrigins);
      hillCells.push(...hillCluster);
      remainingBudget -= hillCluster.length;
    }

    if (gradientEnabled) {
      this.applyHeightGradient(hillCells, origins);
    }

    this.hillCells = new Set(hillCells);
    return hillCells;
  }

  selectHillOrigins(cells, numOrigins) {
    const cellArray = Array.from(cells.values());
    const origins = [];
    
    for (let i = 0; i < numOrigins; i++) {
      const randomIndex = Math.floor(Math.random() * cellArray.length);
      origins.push(cellArray[randomIndex]);
    }
    
    return origins;
  }

  generateHillCluster(origin, budget) {
    const cluster = [origin];
    const visited = new Set([origin.id]);
    let remainingBudget = budget - 1;

    const queue = [origin];
    
    while (queue.length > 0 && remainingBudget > 0) {
      const current = queue.shift();
      
      for (const neighborId of current.neighbors) {
        if (visited.has(neighborId) || remainingBudget <= 0) continue;
        
        const neighbor = this.voronoiGenerator.getCells().get(neighborId);
        if (neighbor && Math.random() < 0.6) { // 60% chance to include neighbor
          cluster.push(neighbor);
          visited.add(neighborId);
          queue.push(neighbor);
          remainingBudget--;
        }
      }
    }

    return cluster;
  }

  applyHeightGradient(hillCells, origins) {
    hillCells.forEach(cell => {
      const minDistance = Math.min(...origins.map(origin => 
        this.calculateDistance(cell.site, origin.site)
      ));
      
      const maxDistance = 100; // Base distance for height calculation
      const height = Math.max(0, (maxDistance - minDistance) / maxDistance * 100);
      
      cell.setMetadata('height', height);
      this.heights.set(cell.id, height);
    });
  }

  calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getHillCells() {
    return Array.from(this.hillCells);
  }

  getHeightStats() {
    const heights = Array.from(this.heights.values());
    return {
      maxHeight: Math.max(...heights),
      minHeight: Math.min(...heights),
      averageHeight: heights.reduce((a, b) => a + b, 0) / heights.length
    };
  }

  clearHills() {
    this.hillCells.forEach(cell => {
      cell.setMetadata('height', null);
    });
    this.hillCells.clear();
    this.heights.clear();
  }
}
```

### 4.3 Lakes Generator Implementation
```javascript
// src/core/lakes/LakesGenerator.js
export class LakesGenerator {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.lakeCells = new Set();
    this.depths = new Map();
  }

  generateLakes(budget, numOrigins) {
    const cells = this.voronoiGenerator.getCells();
    const origins = this.selectLakeOrigins(cells, numOrigins);
    
    let remainingBudget = budget;
    const lakeCells = [];

    for (const origin of origins) {
      const lakeCluster = this.generateLakeCluster(origin, remainingBudget / numOrigins);
      lakeCells.push(...lakeCluster);
      remainingBudget -= lakeCluster.length;
    }

    this.applyDepthGradient(lakeCells, origins);
    this.lakeCells = new Set(lakeCells);
    return lakeCells;
  }

  selectLakeOrigins(cells, numOrigins) {
    // Select origins away from hills and coasts
    const availableCells = Array.from(cells.values()).filter(cell => 
      !cell.getMetadata('isCoastal') && !cell.getMetadata('height')
    );
    
    const origins = [];
    for (let i = 0; i < numOrigins; i++) {
      const randomIndex = Math.floor(Math.random() * availableCells.length);
      origins.push(availableCells[randomIndex]);
    }
    
    return origins;
  }

  generateLakeCluster(origin, budget) {
    const cluster = [origin];
    const visited = new Set([origin.id]);
    let remainingBudget = budget - 1;

    const queue = [origin];
    
    while (queue.length > 0 && remainingBudget > 0) {
      const current = queue.shift();
      
      for (const neighborId of current.neighbors) {
        if (visited.has(neighborId) || remainingBudget <= 0) continue;
        
        const neighbor = this.voronoiGenerator.getCells().get(neighborId);
        if (neighbor && !neighbor.getMetadata('isCoastal') && Math.random() < 0.7) {
          cluster.push(neighbor);
          visited.add(neighborId);
          queue.push(neighbor);
          remainingBudget--;
        }
      }
    }

    return cluster;
  }

  applyDepthGradient(lakeCells, origins) {
    lakeCells.forEach(cell => {
      const minDistance = Math.min(...origins.map(origin => 
        this.calculateDistance(cell.site, origin.site)
      ));
      
      const maxDistance = 50;
      const depth = Math.max(5, (maxDistance - minDistance) / maxDistance * 45 + 5);
      
      cell.setMetadata('depth', depth);
      cell.setMetadata('isLake', true);
      this.depths.set(cell.id, depth);
    });
  }

  calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getLakeCells() {
    return Array.from(this.lakeCells);
  }

  getDepthStats() {
    const depths = Array.from(this.depths.values());
    return {
      maxDepth: Math.max(...depths),
      minDepth: Math.min(...depths),
      averageDepth: depths.reduce((a, b) => a + b, 0) / depths.length
    };
  }

  clearLakes() {
    this.lakeCells.forEach(cell => {
      cell.setMetadata('depth', null);
      cell.setMetadata('isLake', false);
    });
    this.lakeCells.clear();
    this.depths.clear();
  }
}
```

---

## 🔧 Phase 5: Map Object Integration

### 5.1 Enhanced Map Class
```javascript
// src/core/Map.js (Enhanced)
import { CoastlineGenerator } from './coastlines/CoastlineGenerator.js';
import { HillsGenerator } from './hills/HillsGenerator.js';
import { LakesGenerator } from './lakes/LakesGenerator.js';
import { MarshGenerator } from './marshes/MarshGenerator.js';

export class Map {
  constructor(featureDrawer, settings) {
    this.featureDrawer = featureDrawer;
    this.settings = settings;
    this.seededRandom = new Math.seedrandom(settings.voronoi.seed);
    
    // Initialize all generators
    this.initializeGenerators();
    
    // Bind settings changes
    this.bindSettingsUpdates();
  }

  initializeGenerators() {
    this.voronoiGenerator = new VoronoiGenerator(this.graphState, this.settings, this.seededRandom);
    this.coastlineGenerator = new CoastlineGenerator(this.voronoiGenerator, this.settings);
    this.hillsGenerator = new HillsGenerator(this.voronoiGenerator, this.settings);
    this.lakesGenerator = new LakesGenerator(this.voronoiGenerator, this.settings);
    this.marshGenerator = new MarshGenerator(this.voronoiGenerator, this.settings);
    this.riversGenerator = new RiversGenerator(this.voronoiGenerator, this.settings);
    this.tributariesGenerator = new TributariesGenerator(this.voronoiGenerator, this.settings);
  }

  // Generate methods for each feature type
  async generateCoastlines() {
    if (!this.settings.coastlines.enabled) return;
    
    const coastalCells = this.coastlineGenerator.generateCoastline(
      this.settings.coastlines.direction,
      this.settings.coastlines.budget
    );
    
    this.drawDiagram();
    return coastalCells;
  }

  async generateHills() {
    if (!this.settings.hills.enabled) return;
    
    const hillCells = this.hillsGenerator.generateHills(
      this.settings.hills.budget,
      this.settings.hills.origins,
      this.settings.hills.gradient
    );
    
    this.drawDiagram();
    return hillCells;
  }

  async generateLakes() {
    if (!this.settings.lakes.enabled) return;
    
    const lakeCells = this.lakesGenerator.generateLakes(
      this.settings.lakes.budget,
      this.settings.lakes.origins
    );
    
    this.drawDiagram();
    return lakeCells;
  }

  // Settings synchronization
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // Update all generators with new settings
    Object.values(this.getAllGenerators()).forEach(generator => {
      if (generator && typeof generator.updateSettings === 'function') {
        generator.updateSettings(this.settings);
      }
    });
  }

  getAllGenerators() {
    return {
      voronoi: this.voronoiGenerator,
      coastlines: this.coastlineGenerator,
      hills: this.hillsGenerator,
      lakes: this.lakesGenerator,
      marshes: this.marshGenerator,
      rivers: this.riversGenerator,
      tributaries: this.tributariesGenerator
    };
  }

  // Derive settings from current map state
  deriveSettingsFromState() {
    const derivedSettings = {};
    
    // Extract current counts and values from generators
    if (this.riversGenerator) {
      derivedSettings.rivers = {
        count: this.riversGenerator.getRiverPaths().length,
        enabled: this.riversGenerator.getRiverPaths().length > 0
      };
    }
    
    if (this.hillsGenerator) {
      derivedSettings.hills = {
        budget: this.hillsGenerator.getHillCells().length,
        enabled: this.hillsGenerator.getHillCells().length > 0
      };
    }
    
    if (this.lakesGenerator) {
      derivedSettings.lakes = {
        budget: this.lakesGenerator.getLakeCells().length,
        enabled: this.lakesGenerator.getLakeCells().length > 0
      };
    }
    
    return derivedSettings;
  }

  bindSettingsUpdates() {
    // Listen for settings changes and auto-update
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('settings-changed', (event) => {
        this.updateSettings(event.detail);
      });
    }
  }
}
```

---

## 📋 Implementation Timeline

### Week 1: Foundation
- [ ] Set up React project structure
- [ ] Implement settings schema
- [ ] Create TerrainContext and basic hooks
- [ ] Migrate first 2 sections (Voronoi, Rivers)

### Week 2: Component Development  
- [ ] Build remaining section components
- [ ] Implement InputField component with validation
- [ ] Create status and logging components
- [ ] Test React dashboard functionality

### Week 3: Feature Implementation
- [ ] Implement CoastlineGenerator
- [ ] Implement HillsGenerator  
- [ ] Implement LakesGenerator
- [ ] Connect all generators to UI

### Week 4: Integration & Polish
- [ ] Implement Map settings derivation
- [ ] Add real-time updates
- [ ] Performance optimization
- [ ] Testing and bug fixes

---

## 🎯 Success Criteria

### Input Field Functionality
- [ ] All 18 input fields are functional
- [ ] Settings validation and error handling
- [ ] Real-time visual updates
- [ ] Settings persistence

### React Migration
- [ ] Complete vanilla JS to React conversion
- [ ] Maintains all existing functionality
- [ ] Improved developer experience
- [ ] Better state management

### Map Integration
- [ ] Settings derivable from Map object
- [ ] Bidirectional synchronization
- [ ] Auto-regeneration on critical changes
- [ ] Clean separation of concerns

---

## 🔄 Migration Strategy

### Gradual Rollout
1. **Phase-by-phase migration** of sections
2. **Feature flags** for new vs old components
3. **A/B testing** for user experience
4. **Rollback procedures** for each phase

### Risk Mitigation
- [ ] Maintain existing functionality during migration
- [ ] Comprehensive testing at each phase
- [ ] Performance monitoring
- [ ] User feedback collection

---

*This plan provides a comprehensive roadmap for transitioning to React while making all input fields functional and ensuring they integrate properly with the Map object architecture.*
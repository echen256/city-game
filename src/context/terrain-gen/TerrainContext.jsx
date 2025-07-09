import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { TERRAIN_SETTINGS_SCHEMA } from '../../config/terrain-gen/SettingsSchema.js';

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
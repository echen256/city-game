import { useCallback } from 'react';
import { useTerrain } from '../../context/terrain-gen/TerrainContext.jsx';

export const useTerrainMap = (canvasRef) => {
  const { settings, updateMap, setStatus, addLog } = useTerrain();

  const generateTerrain = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      setStatus('Generating terrain...');
      addLog('Starting terrain generation');

      // Import the existing Map and FeatureDrawer classes from terrain-gen
      const { Map } = await import('../../../terrain-gen/Map.js');
      const { FeatureDrawer } = await import('../../../terrain-gen/drawer/FeatureDrawer.js');
      
      // Convert React settings to format expected by existing code
      const terrainSettings = {
        seed: settings.voronoi.seed,
        numSites: settings.voronoi.numSites,
        poissonRadius: settings.voronoi.poissonRadius,
        distribution: settings.voronoi.distribution,
        gridSize: 600, // Default grid size
        // Voronoi settings structured as expected
        voronoi: {
          enabled: true,
          numSites: settings.voronoi.numSites,
          poissonRadius: settings.voronoi.poissonRadius,
          minDistance: settings.voronoi.poissonRadius, // Use poissonRadius as minDistance
          seed: settings.voronoi.seed,
          distribution: settings.voronoi.distribution
        },
        // Rivers settings - need to match what RiversGenerator expects
        rivers: {
          numRivers: settings.rivers.count
        },
        // Tributaries settings
        tributaries: {
          numTributaries: 3, // Default number of tributaries per river
          maxTributaryLength: 3, // Default max length
          enabled: settings.tributaries.enabled
        },
        tributaryDepth: settings.tributaries.depth,
        branchProbability: settings.tributaries.branchProbability,
        minTributaryDistance: settings.tributaries.minDistance,
        maxTributaryDistance: settings.tributaries.maxDistance,
        branchingSeparation: settings.tributaries.branchingSeparation
      };
      
      console.log('Terrain settings:', terrainSettings);
      
      const featureDrawer = new FeatureDrawer(canvasRef.current, terrainSettings);
      const map = new Map(featureDrawer, terrainSettings);
      
      // Generate terrain features
      map.generateVoronoi();
      
      if (settings.rivers.enabled) {
        map.generateRivers();
      }
      
      if (settings.tributaries.enabled) {
        map.generateTributaries();
      }

      updateMap(map);
      setStatus('Terrain generated successfully');
      addLog('Generated terrain with Voronoi diagram');
      
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      addLog(`Error generating terrain: ${error.message}`);
      console.error('Terrain generation error:', error);
    }
  }, [settings, canvasRef, updateMap, setStatus, addLog]);

  const regenerateIfNeeded = useCallback(() => {
    // Auto-regenerate when critical settings change
    const criticalSettings = ['voronoi.numSites', 'voronoi.seed', 'rivers.count'];
    // Implementation for checking if regeneration is needed
    // This would need to track previous settings to detect changes
  }, [settings]);

  return {
    generateTerrain,
    regenerateIfNeeded
  };
};
import { BaseTerrainGenerator } from './terrain/BaseTerrainGenerator.js';
import { RiversGenerator } from './rivers/RiversGenerator.js';

export class TerrainGenerator extends BaseTerrainGenerator {
  constructor(settings) {
    super(settings);
    this.riverGenerator = new RiversGenerator(this.terrainData, this.settings);
  }

  generateTerrain() {
    // Generate base terrain
    super.generateTerrain();
    
    // Generate rivers if enabled
    if (this.settings.riverGeneration && this.settings.riverGeneration.enabled) {
      this.riverGenerator.generateRivers();
    }
    
    // Apply erosion if enabled
    if (this.settings.erosion && this.settings.erosion.enabled) {
      this.applyErosion();
    }
    
    // Final buildable tile determination
    this.determineBuildableTiles();
  }

  applyErosion() {
    const { cycles, probability } = this.settings.erosion;
    const { minNeighbors, maxNeighbors, minProbability, maxProbability, sigmoidSteepness, sigmoidMidpoint } = probability;
    
    for (let cycle = 0; cycle < cycles; cycle++) {
      const tilesToErode = [];
      
      // Find all land tiles adjacent to water
      for (const tile of this.tileGrid.tiles.values()) {
        if (tile.tileType === 'ground') {
          const neighbors = tile.getAllNeighbors();
          const waterNeighborCount = neighbors.filter(neighbor => neighbor.tileType === 'water').length;
          
          if (waterNeighborCount > 0) {
            // Calculate erosion probability using sigmoid function
            const erosionProbability = this.calculateErosionProbability(
              waterNeighborCount, 
              minProbability, 
              maxProbability, 
              sigmoidSteepness, 
              sigmoidMidpoint
            );
            
            // Random chance to erode based on calculated probability
            if (Math.random() < erosionProbability) {
              tilesToErode.push(tile);
            }
          }
        }
      }
      
      // Apply erosion to selected tiles
      const erosionFeature = this.terrainData.createFeature('erosion');
      erosionFeature.setMetadata('cycle', cycle);
      erosionFeature.setMetadata('tilesEroded', tilesToErode.length);
      
      const erodedTiles = [];
      for (const tile of tilesToErode) {
        tile.setTileType('water');
        tile.setBuildable(false);
        
        // Lower the height slightly below water level
        const { waterLevel } = this.settings;
        tile.setHeight(Math.min(tile.height, waterLevel));
        
        erodedTiles.push({ x: tile.x, z: tile.z });
      }
      
      erosionFeature.addAffectedTiles(erodedTiles);
      erosionFeature.calculateCentroidFromTiles();
    }
  }

  calculateErosionProbability(waterNeighborCount, minProb, maxProb, steepness, midpoint) {
    // Sigmoid function: P(x) = minProb + (maxProb - minProb) / (1 + e^(-steepness * (x - midpoint)))
    const exponent = -steepness * (waterNeighborCount - midpoint);
    const sigmoidValue = 1 / (1 + Math.exp(exponent));
    return minProb + (maxProb - minProb) * sigmoidValue;
  }

  // Expose terrain data for external access
  getTerrainData() {
    return this.terrainData;
  }

  getFeatures() {
    return this.terrainData.getAllFeatures();
  }

  getFeaturesByType(type) {
    return this.terrainData.getFeaturesByType(type);
  }
}
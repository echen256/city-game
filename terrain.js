import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { TileGrid, Tile } from './tile.js';

export class TerrainGenerator {
  constructor(settings) {
    this.settings = settings.terrain;
    this.citySettings = settings.city;
    this.noise = createNoise2D();
    this.tileGrid = new TileGrid(this.settings.gridSize);
  }

  generateTerrain() {
    const { gridSize, minHeight, maxHeight, smoothness, hillGeneration, noise } = this.settings;
    
    // Initialize base terrain with noise
    this.generateBaseTerrain(gridSize, minHeight, maxHeight, noise);
    
    // Generate hills
    this.generateHills(gridSize, hillGeneration);
    
    // Apply smoothing if configured
    if (smoothness > 0) {
      this.smoothTerrain(gridSize, smoothness);
    }
    
    // Mark street tiles
    this.markStreetTiles();
    
    // Calculate slopes and update buildable status
    this.tileGrid.calculateSlopes();
    
    // Apply additional buildable logic
    this.determineBuildableTiles();
  }

  generateBaseTerrain(gridSize, minHeight, maxHeight, noiseSettings) {
    const { scale, octaves, persistence, lacunarity } = noiseSettings;
    
    for (let tileX = 0; tileX < gridSize; tileX++) {
      for (let tileZ = 0; tileZ < gridSize; tileZ++) {
        let amplitude = 1;
        let frequency = scale;
        let noiseHeight = 0;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
          const sampleX = (tileX - gridSize / 2) * frequency;
          const sampleZ = (tileZ - gridSize / 2) * frequency;
          
          const noiseValue = this.noise(sampleX, sampleZ);
          noiseHeight += noiseValue * amplitude;
          
          maxValue += amplitude;
          amplitude *= persistence;
          frequency *= lacunarity;
        }
        
        noiseHeight /= maxValue;
        const height = THREE.MathUtils.lerp(minHeight, maxHeight, (noiseHeight + 1) / 2);
        
        const tile = this.tileGrid.getTile(tileX, tileZ);
        if (tile) {
          tile.setHeight(height);
          
          // Set initial tile type based on height
          if (height < minHeight + 2) {
            tile.setTileType('water');
          } else if (height > maxHeight - 3) {
            tile.setTileType('rock');
          } else {
            tile.setTileType('ground');
          }
        }
      }
    }
  }

  generateHills(gridSize, hillSettings) {
    const { minHills, maxHills, hillRadius, hillIntensity } = hillSettings;
    const numHills = Math.floor(Math.random() * (maxHills - minHills + 1)) + minHills;
    
    for (let h = 0; h < numHills; h++) {
      // Random hill center
      const centerX = Math.random() * gridSize;
      const centerZ = Math.random() * gridSize;
      
      // Apply hill effect to surrounding tiles
      for (let tileX = 0; tileX < gridSize; tileX++) {
        for (let tileZ = 0; tileZ < gridSize; tileZ++) {
          const distance = Math.sqrt(
            Math.pow(tileX - centerX, 2) + Math.pow(tileZ - centerZ, 2)
          );
          
          if (distance <= hillRadius) {
            const falloff = 1 - (distance / hillRadius);
            const hillEffect = Math.pow(falloff, 2) * hillIntensity;
            
            const tile = this.tileGrid.getTile(tileX, tileZ);
            if (tile) {
              tile.setHeight(tile.height + hillEffect);
            }
          }
        }
      }
    }
  }

  smoothTerrain(gridSize, smoothness) {
    const tempHeights = new Map();
    const radius = Math.ceil(smoothness * 3);
    
    for (let tileX = 0; tileX < gridSize; tileX++) {
      for (let tileZ = 0; tileZ < gridSize; tileZ++) {
        let totalHeight = 0;
        let totalWeight = 0;
        
        for (let offsetX = -radius; offsetX <= radius; offsetX++) {
          for (let offsetZ = -radius; offsetZ <= radius; offsetZ++) {
            const sampleX = tileX + offsetX;
            const sampleZ = tileZ + offsetZ;
            
            if (sampleX >= 0 && sampleX < gridSize && sampleZ >= 0 && sampleZ < gridSize) {
              const distance = Math.sqrt(offsetX * offsetX + offsetZ * offsetZ);
              const weight = Math.exp(-distance * distance / (2 * smoothness * smoothness));
              
              const tile = this.tileGrid.getTile(sampleX, sampleZ);
              if (tile) {
                totalHeight += tile.height * weight;
                totalWeight += weight;
              }
            }
          }
        }
        
        tempHeights.set(`${tileX},${tileZ}`, totalHeight / totalWeight);
      }
    }
    
    // Apply smoothed heights back to tiles
    for (let tileX = 0; tileX < gridSize; tileX++) {
      for (let tileZ = 0; tileZ < gridSize; tileZ++) {
        const tile = this.tileGrid.getTile(tileX, tileZ);
        if (tile) {
          const smoothedHeight = tempHeights.get(`${tileX},${tileZ}`);
          tile.setHeight(smoothedHeight);
        }
      }
    }
  }

  markStreetTiles() {
    const { streetWidth, blockSize } = this.citySettings;
    this.tileGrid.markStreets(streetWidth, blockSize);
  }

  determineBuildableTiles() {
    // Additional logic to determine buildability beyond what's in Tile.updateBuildableStatus()
    for (const tile of this.tileGrid.tiles.values()) {
      // Don't build too close to water
      if (tile.tileType === 'ground') {
        const neighbors = this.tileGrid.getAllNeighbors(tile.x, tile.z);
        const hasWaterNeighbor = neighbors.some(neighbor => neighbor.tileType === 'water');
        
        if (hasWaterNeighbor) {
          tile.setMetadata('nearWater', true);
          // Optionally make these unbuildable or less suitable
        }
      }
      
      // Update final buildable status
      tile.updateBuildableStatus();
    }
  }

  getHeightAt(x, z) {
    const tile = this.tileGrid.getTileAtWorldPosition(x, z, this.settings.tileSize);
    return tile ? tile.height : 0;
  }

  getTileHeight(tileX, tileZ) {
    const tile = this.tileGrid.getTile(tileX, tileZ);
    return tile ? tile.height : 0;
  }

  getTile(tileX, tileZ) {
    return this.tileGrid.getTile(tileX, tileZ);
  }

  getTileAtWorldPosition(worldX, worldZ) {
    return this.tileGrid.getTileAtWorldPosition(worldX, worldZ, this.settings.tileSize);
  }

  getBuildableTiles() {
    return this.tileGrid.getBuildableTiles();
  }

  createTerrainMesh() {
    const { gridSize, tileSize } = this.settings;
    
    // Create tile-based terrain mesh
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const normals = [];
    
    // Create vertices for each tile corner
    for (let tileZ = 0; tileZ <= gridSize; tileZ++) {
      for (let tileX = 0; tileX <= gridSize; tileX++) {
        const worldX = (tileX - gridSize / 2) * tileSize;
        const worldZ = (tileZ - gridSize / 2) * tileSize;
        
        // Get height from the nearest tile center
        const nearestTileX = Math.min(Math.max(0, tileX === gridSize ? tileX - 1 : tileX), gridSize - 1);
        const nearestTileZ = Math.min(Math.max(0, tileZ === gridSize ? tileZ - 1 : tileZ), gridSize - 1);
        const height = this.getTileHeight(nearestTileX, nearestTileZ);
        
        vertices.push(worldX, height, worldZ);
        normals.push(0, 1, 0); // Simple upward normal
      }
    }
    
    // Create indices for triangles
    for (let tileZ = 0; tileZ < gridSize; tileZ++) {
      for (let tileX = 0; tileX < gridSize; tileX++) {
        const a = tileZ * (gridSize + 1) + tileX;
        const b = tileZ * (gridSize + 1) + tileX + 1;
        const c = (tileZ + 1) * (gridSize + 1) + tileX;
        const d = (tileZ + 1) * (gridSize + 1) + tileX + 1;
        
        // Two triangles per tile
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    
    const material = new THREE.MeshBasicMaterial({
      color: 0x333333,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    });
    
    const terrain = new THREE.Mesh(geometry, material);
    
    return terrain;
  }

  createGridHelper() {
    const { gridSize, tileSize } = this.settings;
    
    // Create tile-based grid geometry with tile type and buildability color coding
    const points = [];
    const colors = [];
    const green = new THREE.Color(0x00ff00);  // Buildable ground tiles
    const white = new THREE.Color(0xffffff);  // Non-buildable ground tiles
    const blue = new THREE.Color(0x0088ff);   // Water tiles
    const gray = new THREE.Color(0x888888);   // Rock tiles
    
    // Helper function to get line color based on tile type and buildability
    const getLineColor = (tileX, tileZ) => {
      const tile = this.getTile(tileX, tileZ);
      if (!tile) return white;
      
      // Color by tile type first
      if (tile.tileType === 'water') {
        return blue;
      } else if (tile.tileType === 'rock') {
        return gray;
      } else {
        // For ground tiles, use buildability coloring
        return tile.buildable ? green : white;
      }
    };
    
    // Create horizontal lines (tile boundaries)
    for (let tileZ = 0; tileZ <= gridSize; tileZ++) {
      for (let tileX = 0; tileX < gridSize; tileX++) {
        const worldX1 = (tileX - gridSize / 2) * tileSize;
        const worldZ1 = (tileZ - gridSize / 2) * tileSize;
        const worldX2 = ((tileX + 1) - gridSize / 2) * tileSize;
        const worldZ2 = (tileZ - gridSize / 2) * tileSize;
        
        // Get tile heights for grid lines
        const height1 = tileZ === 0 ? this.getTileHeight(tileX, 0) : 
                      tileZ === gridSize ? this.getTileHeight(tileX, gridSize - 1) :
                      (this.getTileHeight(tileX, tileZ - 1) + this.getTileHeight(tileX, tileZ)) / 2;
        
        const height2 = tileZ === 0 ? this.getTileHeight(Math.min(tileX + 1, gridSize - 1), 0) : 
                      tileZ === gridSize ? this.getTileHeight(Math.min(tileX + 1, gridSize - 1), gridSize - 1) :
                      (this.getTileHeight(Math.min(tileX + 1, gridSize - 1), tileZ - 1) + 
                       this.getTileHeight(Math.min(tileX + 1, gridSize - 1), Math.min(tileZ, gridSize - 1))) / 2;
        
        // Determine color based on adjacent tiles' buildability
        const leftTile = tileZ > 0 ? Math.min(tileZ - 1, gridSize - 1) : 0;
        const rightTile = tileZ < gridSize ? Math.min(tileZ, gridSize - 1) : gridSize - 1;
        const color1 = getLineColor(tileX, leftTile);
        const color2 = getLineColor(Math.min(tileX + 1, gridSize - 1), rightTile);
        
        points.push(new THREE.Vector3(worldX1, height1 + 0.05, worldZ1));
        points.push(new THREE.Vector3(worldX2, height2 + 0.05, worldZ2));
        colors.push(color1, color2);
      }
    }
    
    // Create vertical lines (tile boundaries)
    for (let tileX = 0; tileX <= gridSize; tileX++) {
      for (let tileZ = 0; tileZ < gridSize; tileZ++) {
        const worldX1 = (tileX - gridSize / 2) * tileSize;
        const worldZ1 = (tileZ - gridSize / 2) * tileSize;
        const worldX2 = (tileX - gridSize / 2) * tileSize;
        const worldZ2 = ((tileZ + 1) - gridSize / 2) * tileSize;
        
        // Get tile heights for grid lines
        const height1 = tileX === 0 ? this.getTileHeight(0, tileZ) : 
                      tileX === gridSize ? this.getTileHeight(gridSize - 1, tileZ) :
                      (this.getTileHeight(tileX - 1, tileZ) + this.getTileHeight(tileX, tileZ)) / 2;
        
        const height2 = tileX === 0 ? this.getTileHeight(0, Math.min(tileZ + 1, gridSize - 1)) : 
                      tileX === gridSize ? this.getTileHeight(gridSize - 1, Math.min(tileZ + 1, gridSize - 1)) :
                      (this.getTileHeight(tileX - 1, Math.min(tileZ + 1, gridSize - 1)) + 
                       this.getTileHeight(Math.min(tileX, gridSize - 1), Math.min(tileZ + 1, gridSize - 1))) / 2;
        
        // Determine color based on adjacent tiles' buildability
        const topTile = tileX > 0 ? Math.min(tileX - 1, gridSize - 1) : 0;
        const bottomTile = tileX < gridSize ? Math.min(tileX, gridSize - 1) : gridSize - 1;
        const color1 = getLineColor(topTile, tileZ);
        const color2 = getLineColor(bottomTile, Math.min(tileZ + 1, gridSize - 1));
        
        points.push(new THREE.Vector3(worldX1, height1 + 0.05, worldZ1));
        points.push(new THREE.Vector3(worldX2, height2 + 0.05, worldZ2));
        colors.push(color1, color2);
      }
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors.flatMap(c => [c.r, c.g, c.b]), 3));
    
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6
    });
    
    return new THREE.LineSegments(geometry, material);
  }
}
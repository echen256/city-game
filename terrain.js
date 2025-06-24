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
    
    // Generate rivers if enabled
    if (this.settings.riverGeneration && this.settings.riverGeneration.enabled) {
      this.generateRiver();
    }
    
    // Apply additional buildable logic
    this.determineBuildableTiles();
  }

  generateBaseTerrain(gridSize, minHeight, maxHeight, noiseSettings) {
    const { scale, octaves, persistence, lacunarity } = noiseSettings;
    const { waterLevel } = this.settings;
    
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
          
          // Set initial tile type based on height relative to water level
          if (height <= waterLevel) {
            tile.setTileType('water');
          } else if (height > maxHeight - 1) {
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

  generateRiver() {
    const { gridSize } = this.settings;
    const { minControlPoints, maxControlPoints, randomOffset, minWidth, maxWidth, curveResolution, candidateCount, topPercentage } = this.settings.riverGeneration;
    
    // Step 1: Generate multiple river candidates and select the best by length
    const bestRiver = this.selectBestRiverCandidate(gridSize, candidateCount, topPercentage, minControlPoints, maxControlPoints, randomOffset, curveResolution);
    
    // Step 2: Apply river width to create river tiles
    this.applyRiverToTiles(bestRiver.path, minWidth, maxWidth);
  }

  selectBestRiverCandidate(gridSize, candidateCount, topPercentage, minControlPoints, maxControlPoints, randomOffset, curveResolution) {
    const candidates = [];
    
    // Generate multiple river candidates
    for (let i = 0; i < candidateCount; i++) {
      const { startPoint, endPoint } = this.generateRiverEndpoints(gridSize);
      const numControlPoints = Math.floor(Math.random() * (maxControlPoints - minControlPoints + 1)) + minControlPoints;
      const controlPoints = this.generateRiverControlPoints(startPoint, endPoint, numControlPoints, randomOffset, gridSize);
      const riverPath = this.generateBezierCurve([startPoint, ...controlPoints, endPoint], curveResolution);
      const length = this.calculateRiverLength(riverPath);
      
      candidates.push({
        startPoint,
        endPoint,
        controlPoints,
        path: riverPath,
        length: length
      });
    }
    
    // Sort by length (longest first)
    candidates.sort((a, b) => b.length - a.length);
    
    // Select randomly from top percentage
    const topCount = Math.max(1, Math.ceil(candidates.length * (topPercentage / 100)));
    const topCandidates = candidates.slice(0, topCount);
    const selectedIndex = Math.floor(Math.random() * topCandidates.length);
    
    return topCandidates[selectedIndex];
  }

  calculateRiverLength(riverPath) {
    let totalLength = 0;
    
    for (let i = 1; i < riverPath.length; i++) {
      const prev = riverPath[i - 1];
      const curr = riverPath[i];
      const segmentLength = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.z - prev.z, 2)
      );
      totalLength += segmentLength;
    }
    
    return totalLength;
  }

  generateRiverEndpoints(gridSize) {
    // Choose two different edges randomly
    const edges = ['north', 'south', 'east', 'west'];
    const startEdge = edges[Math.floor(Math.random() * edges.length)];
    let endEdge;
    do {
      endEdge = edges[Math.floor(Math.random() * edges.length)];
    } while (endEdge === startEdge);
    
    const getPointOnEdge = (edge) => {
      switch (edge) {
        case 'north':
          return { x: Math.random() * gridSize, z: 0 };
        case 'south':
          return { x: Math.random() * gridSize, z: gridSize - 1 };
        case 'east':
          return { x: gridSize - 1, z: Math.random() * gridSize };
        case 'west':
          return { x: 0, z: Math.random() * gridSize };
      }
    };
    
    return {
      startPoint: getPointOnEdge(startEdge),
      endPoint: getPointOnEdge(endEdge)
    };
  }

  generateRiverControlPoints(startPoint, endPoint, numControlPoints, maxOffset, gridSize) {
    const controlPoints = [];
    
    for (let i = 1; i <= numControlPoints; i++) {
      const t = i / (numControlPoints + 1);
      
      // Linear interpolation between start and end
      const baseX = startPoint.x + (endPoint.x - startPoint.x) * t;
      const baseZ = startPoint.z + (endPoint.z - startPoint.z) * t;
      
      // Apply random offset
      const offsetX = (Math.random() - 0.5) * maxOffset * 2;
      const offsetZ = (Math.random() - 0.5) * maxOffset * 2;
      
      // Clamp to grid bounds
      const x = Math.max(0, Math.min(gridSize - 1, baseX + offsetX));
      const z = Math.max(0, Math.min(gridSize - 1, baseZ + offsetZ));
      
      controlPoints.push({ x, z });
    }
    
    return controlPoints;
  }

  generateBezierCurve(controlPoints, resolution) {
    const curvePoints = [];
    
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      const point = this.calculateBezierPoint(controlPoints, t);
      curvePoints.push(point);
    }
    
    return curvePoints;
  }

  calculateBezierPoint(controlPoints, t) {
    const n = controlPoints.length - 1;
    let x = 0;
    let z = 0;
    
    for (let i = 0; i <= n; i++) {
      const binomial = this.binomialCoefficient(n, i);
      const factor = binomial * Math.pow(1 - t, n - i) * Math.pow(t, i);
      x += factor * controlPoints[i].x;
      z += factor * controlPoints[i].z;
    }
    
    return { x, z };
  }

  binomialCoefficient(n, k) {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 0; i < k; i++) {
      result *= (n - i) / (i + 1);
    }
    return result;
  }

  applyRiverToTiles(riverPath, minWidth, maxWidth) {
    for (let i = 0; i < riverPath.length; i++) {
      const point = riverPath[i];
      
      // Vary width along the river (wider in middle, narrower at ends)
      const widthProgress = Math.sin((i / riverPath.length) * Math.PI);
      const currentWidth = minWidth + (maxWidth - minWidth) * widthProgress;
      
      // Apply river tiles in a circle around each point
      const radius = Math.ceil(currentWidth / 2);
      
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const distance = Math.sqrt(dx * dx + dz * dz);
          
          if (distance <= radius) {
            const tileX = Math.floor(point.x + dx);
            const tileZ = Math.floor(point.z + dz);
            
            const tile = this.tileGrid.getTile(tileX, tileZ);
            if (tile) {
              tile.setTileType('water');
              tile.setBuildable(false);
              
              // Set river tiles to slightly below water level
              const { waterLevel } = this.settings;
              tile.setHeight(Math.min(tile.height, waterLevel - 0.5));
            }
          }
        }
      }
    }
  }

  determineBuildableTiles() {
    // Additional logic to determine buildability beyond what's in Tile.updateBuildableStatus()
    for (const tile of this.tileGrid.tiles.values()) {
      // Don't build too close to water
      if (tile.tileType === 'ground') {
        const neighbors = tile.getAllNeighbors();
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
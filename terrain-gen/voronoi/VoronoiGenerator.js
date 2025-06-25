export class VoronoiCell {
  constructor(site, id) {
    this.site = site; // {x, z} coordinates of the seed point
    this.id = id;
    this.vertices = []; // Polygon vertices defining the cell boundary
    this.neighbors = []; // Adjacent cell IDs
    this.area = 0;
    this.perimeter = 0;
    this.affectedTiles = []; // Tiles that belong to this cell
    this.metadata = {};
  }

  addVertex(vertex) {
    this.vertices.push(vertex);
    return this;
  }

  addNeighbor(cellId) {
    if (!this.neighbors.includes(cellId)) {
      this.neighbors.push(cellId);
    }
    return this;
  }

  calculateArea() {
    if (this.vertices.length < 3) {
      this.area = 0;
      return this.area;
    }

    // Shoelace formula for polygon area
    let area = 0;
    for (let i = 0; i < this.vertices.length; i++) {
      const j = (i + 1) % this.vertices.length;
      area += this.vertices[i].x * this.vertices[j].z;
      area -= this.vertices[j].x * this.vertices[i].z;
    }
    this.area = Math.abs(area) / 2;
    return this.area;
  }

  calculatePerimeter() {
    if (this.vertices.length < 2) {
      this.perimeter = 0;
      return this.perimeter;
    }

    let perimeter = 0;
    for (let i = 0; i < this.vertices.length; i++) {
      const j = (i + 1) % this.vertices.length;
      const dx = this.vertices[j].x - this.vertices[i].x;
      const dz = this.vertices[j].z - this.vertices[i].z;
      perimeter += Math.sqrt(dx * dx + dz * dz);
    }
    this.perimeter = perimeter;
    return this.perimeter;
  }

  isPointInside(x, z) {
    // Ray casting algorithm for point-in-polygon test
    let inside = false;
    for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
      const xi = this.vertices[i].x;
      const zi = this.vertices[i].z;
      const xj = this.vertices[j].x;
      const zj = this.vertices[j].z;

      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  setMetadata(key, value) {
    this.metadata[key] = value;
    return this;
  }

  getMetadata(key) {
    return this.metadata[key];
  }
}

import { DelaunatorWrapper } from './DelaunatorWrapper.js';

export class VoronoiGenerator {
  constructor(terrainData, settings) {
    this.terrainData = terrainData;
    this.settings = settings;
    this.cells = new Map();
    this.sites = [];
    this.delaunatorWrapper = null;
    this.bounds = { 
      minX: 0, 
      maxX: settings.gridSize, 
      minZ: 0, 
      maxZ: settings.gridSize 
    };
  }

  generateVoronoi() {
    const voronoiSettings = this.settings.voronoi;
    if (!voronoiSettings || !voronoiSettings.enabled) {
      return;
    }

    // Step 1: Generate seed points
    this.generateSeedPoints(voronoiSettings);

    // Step 2: Calculate Voronoi diagram using Fortune's algorithm (simplified)
    this.calculateVoronoiDiagram();

    // Step 3: Create terrain features for each cell
    this.createCellFeatures();

    // Step 4: Assign tiles to cells
    this.assignTilesToCells();

    return this.cells;
  }

  generateSeedPoints(settings) {
    const { 
      numSites, 
      distribution, 
      minDistance, 
      seed,
      poissonRadius,
      gridSpacing 
    } = settings;

    this.sites = [];
    
    // Set random seed if provided
    if (seed !== undefined) {
      this.seedRandom(seed);
    }

    switch (distribution) {
      case 'random':
        this.generateRandomSites(numSites, minDistance);
        break;
      case 'poisson':
        this.generatePoissonSites(poissonRadius);
        break;
      case 'grid':
        this.generateGridSites(gridSpacing);
        break;
      case 'hexagonal':
        this.generateHexagonalSites(gridSpacing);
        break;
      default:
        this.generateRandomSites(numSites, minDistance);
    }
  }

  seedRandom(seed) {
    // Simple seeded random number generator
    this._seed = seed;
  }

  random() {
    if (this._seed !== undefined) {
      this._seed = (this._seed * 9301 + 49297) % 233280;
      return this._seed / 233280;
    }
    return Math.random();
  }

  generateRandomSites(numSites, minDistance) {
    const { gridSize } = this.settings;
    const maxAttempts = numSites * 10;
    let attempts = 0;

    while (this.sites.length < numSites && attempts < maxAttempts) {
      const candidate = {
        x: this.random() * gridSize,
        z: this.random() * gridSize
      };

      // Check minimum distance constraint
      let validSite = true;
      for (const site of this.sites) {
        const distance = Math.sqrt(
          Math.pow(candidate.x - site.x, 2) + Math.pow(candidate.z - site.z, 2)
        );
        if (distance < minDistance) {
          validSite = false;
          break;
        }
      }

      if (validSite) {
        this.sites.push(candidate);
      }
      attempts++;
    }
  }

  generatePoissonSites(radius) {
    // Bridson's Poisson disk sampling algorithm
    const { gridSize } = this.settings;
    const cellSize = radius / Math.sqrt(2);
    const gridWidth = Math.ceil(gridSize / cellSize);
    const gridHeight = Math.ceil(gridSize / cellSize);
    const grid = new Array(gridWidth * gridHeight).fill(null);
    const activeList = [];

    // Helper function to get grid index
    const getGridIndex = (x, z) => {
      const i = Math.floor(x / cellSize);
      const j = Math.floor(z / cellSize);
      return j * gridWidth + i;
    };

    // Start with random point
    const firstPoint = {
      x: this.random() * gridSize,
      z: this.random() * gridSize
    };
    
    this.sites.push(firstPoint);
    activeList.push(firstPoint);
    grid[getGridIndex(firstPoint.x, firstPoint.z)] = firstPoint;

    while (activeList.length > 0) {
      const randomIndex = Math.floor(this.random() * activeList.length);
      const point = activeList[randomIndex];
      let found = false;

      // Try to place new points around this point
      for (let attempts = 0; attempts < 30; attempts++) {
        const angle = this.random() * 2 * Math.PI;
        const distance = radius + this.random() * radius;
        const newPoint = {
          x: point.x + Math.cos(angle) * distance,
          z: point.z + Math.sin(angle) * distance
        };

        // Check bounds
        if (newPoint.x < 0 || newPoint.x >= gridSize || newPoint.z < 0 || newPoint.z >= gridSize) {
          continue;
        }

        // Check distance to existing points
        const gridIndex = getGridIndex(newPoint.x, newPoint.z);
        let valid = true;

        // Check surrounding grid cells
        const gridX = Math.floor(newPoint.x / cellSize);
        const gridZ = Math.floor(newPoint.z / cellSize);

        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            const neighborX = gridX + dx;
            const neighborZ = gridZ + dz;
            
            if (neighborX >= 0 && neighborX < gridWidth && neighborZ >= 0 && neighborZ < gridHeight) {
              const neighborIndex = neighborZ * gridWidth + neighborX;
              const neighbor = grid[neighborIndex];
              
              if (neighbor) {
                const dist = Math.sqrt(
                  Math.pow(newPoint.x - neighbor.x, 2) + Math.pow(newPoint.z - neighbor.z, 2)
                );
                if (dist < radius) {
                  valid = false;
                  break;
                }
              }
            }
          }
          if (!valid) break;
        }

        if (valid) {
          this.sites.push(newPoint);
          activeList.push(newPoint);
          grid[gridIndex] = newPoint;
          found = true;
          break;
        }
      }

      if (!found) {
        activeList.splice(randomIndex, 1);
      }
    }
  }

  generateGridSites(spacing) {
    const { gridSize } = this.settings;
    
    for (let x = spacing / 2; x < gridSize; x += spacing) {
      for (let z = spacing / 2; z < gridSize; z += spacing) {
        // Add slight random offset
        const offsetX = (this.random() - 0.5) * spacing * 0.2;
        const offsetZ = (this.random() - 0.5) * spacing * 0.2;
        
        this.sites.push({
          x: Math.max(0, Math.min(gridSize - 1, x + offsetX)),
          z: Math.max(0, Math.min(gridSize - 1, z + offsetZ))
        });
      }
    }
  }

  generateHexagonalSites(spacing) {
    const { gridSize } = this.settings;
    const hexHeight = spacing * Math.sqrt(3) / 2;
    
    let row = 0;
    for (let z = hexHeight / 2; z < gridSize; z += hexHeight) {
      const offset = (row % 2) * spacing / 2;
      
      for (let x = spacing / 2 + offset; x < gridSize; x += spacing) {
        // Add slight random offset
        const offsetX = (this.random() - 0.5) * spacing * 0.1;
        const offsetZ = (this.random() - 0.5) * spacing * 0.1;
        
        this.sites.push({
          x: Math.max(0, Math.min(gridSize - 1, x + offsetX)),
          z: Math.max(0, Math.min(gridSize - 1, z + offsetZ))
        });
      }
      row++;
    }
  }

  calculateVoronoiDiagram() {
    // Use delaunator for proper Delaunay triangulation and Voronoi generation
    console.log(this.sites)
    this.delaunatorWrapper = new DelaunatorWrapper(this.sites);
    const result = this.delaunatorWrapper.triangulate();
    
    // Convert delaunator results to our VoronoiCell format
    this.cells.clear();
    result.voronoiCells.forEach((cell, index) => {
      const voronoiCell = new VoronoiCell(cell.site, index);
      
      // Add vertices from delaunator Voronoi calculation
      cell.vertices.forEach(vertex => voronoiCell.addVertex(vertex));
      
      // Add neighbors
      cell.neighbors.forEach(neighborIndex => {
        voronoiCell.addNeighbor(neighborIndex);
      });
      
      // Calculate area and perimeter
      voronoiCell.calculateArea();
      voronoiCell.calculatePerimeter();
      
      this.cells.set(index, voronoiCell);
    });
  }

  findClosestSite(x, z) {
    let minDistance = Infinity;
    let closestIndex = 0;

    this.sites.forEach((site, index) => {
      const distance = Math.sqrt(
        Math.pow(x - site.x, 2) + Math.pow(z - site.z, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  calculateConvexHull(points) {
    if (points.length < 3) return points;

    // Graham scan algorithm for convex hull
    const sortedPoints = [...points].sort((a, b) => {
      if (a.x === b.x) return a.z - b.z;
      return a.x - b.x;
    });

    const cross = (o, a, b) => {
      return (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
    };

    // Build lower hull
    const lower = [];
    for (const point of sortedPoints) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
        lower.pop();
      }
      lower.push(point);
    }

    // Build upper hull
    const upper = [];
    for (let i = sortedPoints.length - 1; i >= 0; i--) {
      const point = sortedPoints[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
        upper.pop();
      }
      upper.push(point);
    }

    // Remove last point of each half because it's repeated
    lower.pop();
    upper.pop();

    return lower.concat(upper);
  }

  // These methods are no longer needed with delaunator
  // Neighbors are handled automatically in calculateVoronoiDiagram

  createCellFeatures() {
    this.cells.forEach((cell, cellId) => {
      const feature = this.terrainData.createFeature('voronoi_cell');
      
      // Set centroid to site location
      feature.setCentroid(cell.site.x, cell.site.z);
      
      // Add cell boundary as point distribution
      if (cell.vertices.length > 0) {
        feature.addPointDistribution(cell.vertices);
      }
      
      // Store cell metadata
      feature.setMetadata('cellId', cellId);
      feature.setMetadata('area', cell.area);
      feature.setMetadata('perimeter', cell.perimeter);
      feature.setMetadata('neighbors', cell.neighbors);
      feature.setMetadata('site', cell.site);
      feature.setMetadata('vertexCount', cell.vertices.length);
    });
  }

  assignTilesToCells() {
    const { gridSize } = this.settings;
    
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const closestCellId = this.findClosestSite(x, z);
        const cell = this.cells.get(closestCellId);
        
        if (cell) {
          cell.affectedTiles.push({ x, z });
          
          // Update the corresponding terrain feature
          const features = this.terrainData.getFeaturesByType('voronoi_cell');
          const cellFeature = features.find(f => f.getMetadata('cellId') === closestCellId);
          if (cellFeature) {
            cellFeature.addAffectedTile(x, z);
          }
        }
      }
    }
  }

  getCells() {
    return this.cells;
  }

  getCell(id) {
    return this.cells.get(id);
  }

  getCellAt(x, z) {
    const closestCellId = this.findClosestSite(x, z);
    return this.cells.get(closestCellId);
  }

  getTriangulation() {
    return this.delaunatorWrapper;
  }

  getVoronoiDiagram() {
    return this.delaunatorWrapper;
  }

  getDelaunator() {
    return this.delaunatorWrapper ? this.delaunatorWrapper.getDelaunator() : null;
  }
}
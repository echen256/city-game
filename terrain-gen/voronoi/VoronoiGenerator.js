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

    // Step 2: Clean and validate points before triangulation
    this.cleanAndValidatePoints();

    // Step 3: Calculate Voronoi diagram using Fortune's algorithm (simplified)
    this.calculateVoronoiDiagram();

    // Step 4: Create terrain features for each cell
    this.createCellFeatures();

    // Step 5: Assign tiles to cells
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
        this.generatePoissonSites(poissonRadius || minDistance);
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

  // Helper function to check if a point is a duplicate (within epsilon distance)
  isDuplicatePoint(newPoint, epsilon = 0.1) {
    for (const site of this.sites) {
      const distance = Math.sqrt(
        Math.pow(newPoint.x - site.x, 2) + Math.pow(newPoint.z - site.z, 2)
      );
      if (distance < epsilon) {
        return true;
      }
    }
    return false;
  }

  generatePoissonSites(radius) {
    // Bridson's Poisson disk sampling algorithm with improved duplicate checking
    const { gridSize } = this.settings;
    const cellSize = radius / Math.sqrt(2);
    const gridWidth = Math.ceil(gridSize / cellSize);
    const gridHeight = Math.ceil(gridSize / cellSize);
    const grid = new Array(gridWidth * gridHeight).fill(null);
    const activeList = [];
    
    // Increase minimum distance slightly to avoid numerical issues
    const minDistance = radius * 1.01;
    
    // Helper function to get grid index
    const getGridIndex = (x, z) => {
      const i = Math.floor(x / cellSize);
      const j = Math.floor(z / cellSize);
      return j * gridWidth + i;
    };

    // Start with random point, but ensure it's not too close to edges
    const margin = radius;
    const firstPoint = {
      x: margin + this.random() * (gridSize - 2 * margin),
      z: margin + this.random() * (gridSize - 2 * margin)
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
        const distance = minDistance + this.random() * minDistance;
        const newPoint = {
          x: point.x + Math.cos(angle) * distance,
          z: point.z + Math.sin(angle) * distance
        };

        // Check bounds with margin
        if (newPoint.x < margin || newPoint.x >= gridSize - margin || 
            newPoint.z < margin || newPoint.z >= gridSize - margin) {
          continue;
        }

        // Check distance to existing points
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
                if (dist < minDistance) {
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
          grid[getGridIndex(newPoint.x, newPoint.z)] = newPoint;
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

  cleanAndValidatePoints() {
    // Remove duplicate points and ensure minimum separation
    const epsilon = 0.001; // Very small epsilon for exact duplicates
    const minSeparation = 0.1; // Minimum separation to avoid degenerate triangles
    
    const cleanedSites = [];
    
    for (const site of this.sites) {
      let isValid = true;
      
      // Check against already added clean sites
      for (const cleanSite of cleanedSites) {
        const distance = Math.sqrt(
          Math.pow(site.x - cleanSite.x, 2) + Math.pow(site.z - cleanSite.z, 2)
        );
        
        if (distance < minSeparation) {
          isValid = false;
          break;
        }
      }
      
      if (isValid) {
        // Round to avoid floating point precision issues
        cleanedSites.push({
          x: Math.round(site.x * 1000) / 1000,
          z: Math.round(site.z * 1000) / 1000
        });
      }
    }
    
    this.sites = cleanedSites;
    
    // Add boundary points if needed to ensure proper triangulation
    if (this.settings.voronoi.addBoundaryPoints !== false) {
      this.addBoundaryPoints();
    }
  }

  addBoundaryPoints() {
    const { gridSize } = this.settings;
    const margin = gridSize * 0.1;
    
    // Add points outside the boundary to ensure proper Voronoi cells at edges
    const boundaryPoints = [
      { x: -margin, z: -margin },
      { x: gridSize / 2, z: -margin },
      { x: gridSize + margin, z: -margin },
      { x: -margin, z: gridSize / 2 },
      { x: gridSize + margin, z: gridSize / 2 },
      { x: -margin, z: gridSize + margin },
      { x: gridSize / 2, z: gridSize + margin },
      { x: gridSize + margin, z: gridSize + margin }
    ];
    
    // Mark these as boundary points
    boundaryPoints.forEach(point => {
      point.isBoundary = true;
    });
    
    this.sites.push(...boundaryPoints);
  }

  calculateVoronoiDiagram() {
    try {
      // Use delaunator for proper Delaunay triangulation and Voronoi generation
      console.log(`Triangulating ${this.sites.length} sites...`);
      this.delaunatorWrapper = new DelaunatorWrapper(this.sites);
      const result = this.delaunatorWrapper.triangulate();
      
      if (!result || !result.voronoiCells) {
        console.error('Triangulation failed or returned invalid results');
        return;
      }
      
      console.log(`Generated ${result.voronoiCells.length} Voronoi cells`);
      
      // First pass: identify which cells are valid (non-boundary)
      const validCellIndices = new Set();
      const indexMapping = new Map(); // Maps original index to new index
      let newIndex = 0;
      
      result.voronoiCells.forEach((cell, originalIndex) => {
        if (!cell.site || !cell.site.isBoundary) {
          validCellIndices.add(originalIndex);
          indexMapping.set(originalIndex, newIndex++);
        }
      });
      
      // Second pass: create cells with corrected neighbor relationships
      this.cells.clear();
      result.voronoiCells.forEach((cell, originalIndex) => {
        // Skip boundary cells
        if (cell.site && cell.site.isBoundary) {
          return;
        }
        
        const newCellIndex = indexMapping.get(originalIndex);
        const voronoiCell = new VoronoiCell(cell.site, newCellIndex);
        
        // Add vertices from delaunator Voronoi calculation
        if (cell.vertices && cell.vertices.length > 0) {
          cell.vertices.forEach(vertex => {
            // Clip vertices to bounds
            const clippedVertex = {
              x: Math.max(0, Math.min(this.settings.gridSize, vertex.x)),
              z: Math.max(0, Math.min(this.settings.gridSize, vertex.z))
            };
            voronoiCell.addVertex(clippedVertex);
          });
        }
        
        // Add neighbors with corrected indices
        if (cell.neighbors) {
          cell.neighbors.forEach(neighborOriginalIndex => {
            // Only add neighbors that are valid cells (not boundary)
            if (validCellIndices.has(neighborOriginalIndex)) {
              const neighborNewIndex = indexMapping.get(neighborOriginalIndex);
              voronoiCell.addNeighbor(neighborNewIndex);
            }
          });
        }
        
        // Calculate area and perimeter
        voronoiCell.calculateArea();
        voronoiCell.calculatePerimeter();
        
        this.cells.set(newCellIndex, voronoiCell);
      });
      
      // Update sites array to exclude boundary points
      this.sites = this.sites.filter(site => !site.isBoundary);
      
      // Store mapping for DelaunatorWrapper edge filtering
      this.delaunatorWrapper.validCellIndices = validCellIndices;
      this.delaunatorWrapper.indexMapping = indexMapping;
 
      
    } catch (error) {
      console.error('Error during triangulation:', error);
      // Fallback to simple nearest-neighbor assignment if triangulation fails
      this.fallbackToCentroidalVoronoi();
    }
  }

  fallbackToCentroidalVoronoi() {
    console.warn('Falling back to simple centroidal Voronoi');
    this.cells.clear();
    
    // Create a simple cell for each site
    this.sites.forEach((site, index) => {
      if (!site.isBoundary) {
        const cell = new VoronoiCell(site, index);
        // For fallback, just create a square around each site
        const radius = this.settings.gridSize / Math.sqrt(this.sites.length) / 2;
        cell.addVertex({ x: site.x - radius, z: site.z - radius });
        cell.addVertex({ x: site.x + radius, z: site.z - radius });
        cell.addVertex({ x: site.x + radius, z: site.z + radius });
        cell.addVertex({ x: site.x - radius, z: site.z + radius });
        
        cell.calculateArea();
        cell.calculatePerimeter();
        this.cells.set(index, cell);
      }
    });
  }

  findClosestSite(x, z) {
    let minDistance = Infinity;
    let closestIndex = -1;

    // Only search through non-boundary sites with proper indices
    this.cells.forEach((cell, index) => {
      const site = cell.site;
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
        
        if (closestCellId >= 0) {
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
import { DelaunatorWrapper } from './DelaunatorWrapper.js';
import { VoronoiCell ,BoundaryType} from '../GeometryTypes.js';

/**
 * Simplified Voronoi diagram generator
 */
export class VoronoiGenerator {
  constructor(terrainData, settings) {
    this.terrainData = terrainData;
    this.settings = settings;
    this.cells = new Map();
    this.sites = [];
    this.delaunatorWrapper = null;
    this._seed = undefined;
  }

  /**
   * Generate complete Voronoi diagram
   */
  generateVoronoi() {
    const voronoiSettings = this.settings.voronoi;
    if (!voronoiSettings?.enabled) return;

    // Generate seed points
    this.generateSeedPoints(voronoiSettings);

    // Triangulate and create Voronoi cells
    this.createVoronoiDiagram();

    // Create terrain features
   // this.createCellFeatures();

    // Assign tiles to cells
   // this.assignTilesToCells();

    return this.cells;
  }

  /**
   * Generate seed points based on distribution settings
   */
  generateSeedPoints(settings) {
    const { distribution, numSites, minDistance, seed, poissonRadius, gridSpacing } = settings;

    this.sites = [];
    if (seed !== undefined) this.seedRandom(seed);

    switch (distribution) {
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

    // Add boundary points if needed
    if (settings.addBoundaryPoints !== false) {
      this.addBoundaryPoints();
    }
  }

  /**
   * Simplified random number generator with optional seed
   */
  seedRandom(seed) {
    this._seed = seed;
  }

  /**
   * Set the seeded random number generator
   * @param {Function} seededRandom - Seeded random function from seedrandom library
   */
  setSeededRandom(seededRandom) {
    this._seededRandom = seededRandom;
  }

  random() {
    if (this._seededRandom) {
      return this._seededRandom();
    }
    if (this._seed !== undefined) {
      this._seed = (this._seed * 9301 + 49297) % 233280;
      return this._seed / 233280;
    }
    return Math.random();
  }

  /**
   * Simplified Poisson disk sampling
   */
  generatePoissonSites(radius) {
    const { gridSize } = this.settings;
    const cellSize = radius / Math.sqrt(2);
    const gridWidth = Math.ceil(gridSize / cellSize);
    const grid = new Array(gridWidth * gridWidth).fill(null);
    const activeList = [];
    
    // Start with a random point
    const firstPoint = {
      x: radius + this.random() * (gridSize - 2 * radius),
      z: radius + this.random() * (gridSize - 2 * radius)
    };
    
    this.sites.push(firstPoint);
    activeList.push(firstPoint);
    const gridIndex = Math.floor(firstPoint.x / cellSize) + Math.floor(firstPoint.z / cellSize) * gridWidth;
    grid[gridIndex] = firstPoint;

    while (activeList.length > 0) {
      const randomIndex = Math.floor(this.random() * activeList.length);
      const point = activeList[randomIndex];
      let found = false;

      for (let i = 0; i < 30; i++) {
        const angle = this.random() * 2 * Math.PI;
        const distance = radius + this.random() * radius;
        const newPoint = {
          x: point.x + Math.cos(angle) * distance,
          z: point.z + Math.sin(angle) * distance
        };

        if (newPoint.x < radius || newPoint.x >= gridSize - radius || 
            newPoint.z < radius || newPoint.z >= gridSize - radius) {
          continue;
        }

        // Check nearby grid cells
        const gridX = Math.floor(newPoint.x / cellSize);
        const gridZ = Math.floor(newPoint.z / cellSize);
        let valid = true;

        for (let dx = -2; dx <= 2 && valid; dx++) {
          for (let dz = -2; dz <= 2 && valid; dz++) {
            const nx = gridX + dx;
            const nz = gridZ + dz;
            if (nx >= 0 && nx < gridWidth && nz >= 0 && nz < gridWidth) {
              const neighbor = grid[nx + nz * gridWidth];
              if (neighbor) {
                const d = Math.sqrt(
                  Math.pow(newPoint.x - neighbor.x, 2) + 
                  Math.pow(newPoint.z - neighbor.z, 2)
                );
                if (d < radius) valid = false;
              }
            }
          }
        }

        if (valid) {
          this.sites.push(newPoint);
          activeList.push(newPoint);
          grid[gridX + gridZ * gridWidth] = newPoint;
          found = true;
          break;
        }
      }

      if (!found) activeList.splice(randomIndex, 1);
    }
  }

  addBoundaryPoints() {
    const { gridSize } = this.settings;
    const margin = gridSize * 0.1;
    
    const boundaryPoints = [
      { x: -margin, z: -margin, isBoundary: true },
      { x: gridSize / 2, z: -margin, isBoundary: true },
      { x: gridSize + margin, z: -margin, isBoundary: true },
      { x: -margin, z: gridSize / 2, isBoundary: true },
      { x: gridSize + margin, z: gridSize / 2, isBoundary: true },
      { x: -margin, z: gridSize + margin, isBoundary: true },
      { x: gridSize / 2, z: gridSize + margin, isBoundary: true },
      { x: gridSize + margin, z: gridSize + margin, isBoundary: true }
    ];
    
    this.sites.push(...boundaryPoints);
  }

  /**
   * Create Voronoi diagram using simplified wrapper
   */
  createVoronoiDiagram() {
    try {
      this.delaunatorWrapper = new DelaunatorWrapper(this.sites, this.settings);
      const result = this.delaunatorWrapper.triangulate();
      
      if (!result?.voronoiCells) {
        console.error('Triangulation failed');
        return;
      }
      
      // Create VoronoiCell instances from wrapper results
      this.cells.clear();
      let cellId = 0;
      
      result.voronoiCells.forEach((cellData, index) => {
        // Skip boundary cells
        if (cellData.site?.isBoundary) return;
        
        const cell = new VoronoiCell(cellData.site, cellId);
        
        // Track if any vertex extends beyond boundaries
 
        
        // Add vertices (clip to bounds)
        cellData.vertices.forEach(v => {
          // Check original coordinates for boundary detection
          
 
          // Add clipped vertex to cell
          cell.addVertex({
            x: Math.max(0, Math.min(this.settings.gridSize, v.x)),
            z: Math.max(0, Math.min(this.settings.gridSize, v.z)),
          });
        });
        
        // Set boundary type based on which boundaries the cell touches
   
        // Add neighbors (excluding boundary cells)
        cellData.neighbors.forEach(neighborIndex => {
          const neighbor = result.voronoiCells.get(neighborIndex);
          if (neighbor && !neighbor.site?.isBoundary) {
            cell.addNeighbor(neighborIndex);
            
          } 
        });
        
        cell.calculateArea();
        cell.calculatePerimeter();
        
        this.cells.set(cellId++, cell);
      });
      
      // Remove boundary sites from sites array
      this.sites = this.sites.filter(site => !site.isBoundary);
      
      console.log(`Generated ${this.cells.size} Voronoi cells`);
      
    } catch (error) {
      console.error('Error during triangulation:', error);
    }
  }

  /**
   * Create terrain features for cells
   */
  // createCellFeatures() {
  //   this.cells.forEach((cell, cellId) => {
  //     const feature = this.terrainData.createFeature('voronoi_cell');
      
  //     feature.setCentroid(cell.site.x, cell.site.z);
      
  //     if (cell.vertices.length > 0) {
  //       feature.addPointDistribution(cell.vertices);
  //     }
      
  //     feature.setMetadata('cellId', cellId);
  //     feature.setMetadata('area', cell.area);
  //     feature.setMetadata('perimeter', cell.perimeter);
  //     feature.setMetadata('neighbors', cell.neighbors);
  //   });
  // }

  /**
   * Public API methods
   */
  getCells() {
    return this.cells;
  }

  getCell(id) {
    return this.cells.get(id);
  }

  getCellAt(x, z) {
    let minDist = Infinity;
    let closestCell = null;
    
    this.cells.forEach(cell => {
      const dx = x - cell.site.x;
      const dz = z - cell.site.z;
      const dist = dx * dx + dz * dz;
      
      if (dist < minDist) {
        minDist = dist;
        closestCell = cell;
      }
    });
    
    return closestCell;
  }

  getDelaunator() {
    return this.delaunatorWrapper?.delaunay;
  }

  /**
   * Get triangulation data (for compatibility with dashboard/exporter)
   * @returns {Object} Triangulation data object
   */
  getTriangulation() {
    return this.delaunatorWrapper;
  }

  /**
   * Get Voronoi diagram data (for compatibility with exporter)
   * @returns {Object} DelaunatorWrapper instance
   */
  getVoronoiDiagram() {
    return this.delaunatorWrapper;
  }

  /**
   * Find connected vertices for a given vertex (for dashboard compatibility)
   * @param {number} vertexIndex - Vertex index
   * @returns {Array<number>} Array of connected vertex indices
   */
  findConnectedVertices(vertexIndex) {
    if (!this.delaunatorWrapper || !this.delaunatorWrapper.delaunay) {
      return [];
    }

    const { halfedges } = this.delaunatorWrapper.delaunay;
    const connected = new Set();
    
    // Find all halfedges that share circumcenters with this vertex
    for (let e = 0; e < halfedges.length; e++) {
      const triangleIndex = Math.floor(e / 3);
      if (triangleIndex === vertexIndex) {
        // Find adjacent triangles through halfedges
        const opposite = halfedges[e];
        if (opposite !== -1) {
          const oppositeTriangle = Math.floor(opposite / 3);
          connected.add(oppositeTriangle);
        }
      }
    }
    
    return Array.from(connected);
  }
}
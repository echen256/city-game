import { DelaunatorWrapper } from './DelaunatorWrapper.js';
import { VoronoiCell} from '../GeometryTypes.js';

/**
 * Simplified Voronoi diagram generator
 */
export class VoronoiGenerator {
  constructor(graphState,settings,seededRandom) { 
    this.graphState = graphState;
    this.settings = settings;
    this.sites = [];
    this.delaunatorWrapper = null;
    this.seededRandom = seededRandom;
  }

  /**
   * Generate complete Voronoi diagram
   */
  generateVoronoi(map) {
    const voronoiSettings = map.settings.voronoi;
    if (!voronoiSettings?.enabled) return;
    this.generateSeedPoints(voronoiSettings);
    this.createVoronoiDiagram();
    this.applyBoundaryWeighting();
    this.graphState.reset();
    this.graphState.initialize(this.delaunatorWrapper, this.settings);  
  }

  /**
   * Generate seed points based on distribution settings
   */
  generateSeedPoints(settings) {
    const {  minDistance, seed, poissonRadius } = settings;

    this.sites = [];
    // Seed is already used in the seededRandom function passed in constructor
    // if (seed !== undefined) this.seedRandom(seed);

    this.generatePoissonSites(poissonRadius || minDistance);
 
    this.addBoundaryPoints();
    

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
      x: radius + this.seededRandom() * (gridSize - 2 * radius),
      z: radius + this.seededRandom() * (gridSize - 2 * radius)
    };
    
    this.sites.push(firstPoint);
    activeList.push(firstPoint);
    const gridIndex = Math.floor(firstPoint.x / cellSize) + Math.floor(firstPoint.z / cellSize) * gridWidth;
    grid[gridIndex] = firstPoint;

    while (activeList.length > 0) {
      const randomIndex = Math.floor(this.seededRandom() * activeList.length);
      const point = activeList[randomIndex];
      let found = false;

      for (let i = 0; i < 30; i++) {
        const angle = this.seededRandom() * 2 * Math.PI;
        const distance = radius + this.seededRandom() * radius;
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

  applyBoundaryWeighting() {
    const gridSize = this.settings.gridSize;
    const boundaryTolerance = 30; // Distance from boundary to consider "boundary edge"
    const boundaryWeight = 1000; // Very high weight to discourage boundary usage
    let boundaryEdgeCount = 0;


    // Check if a vertex is near any boundary
    const isNearBoundary = (pos) => {
      if (!pos) return false;
      return pos.x <= boundaryTolerance ||                    // Near left edge
        pos.x >= (gridSize - boundaryTolerance) ||       // Near right edge
        pos.z <= boundaryTolerance ||                    // Near top edge
        pos.z >= (gridSize - boundaryTolerance);         // Near bottom edge
    };

    // Apply high weights to boundary edges
    for (const [edgeKey, edge] of this.delaunatorWrapper.voronoiEdges.entries()) {
      const [vertex1, vertex2] = edgeKey.split('-').map(Number);
      const pos1 = this.delaunatorWrapper.circumcenters[vertex1];
      const pos2 = this.delaunatorWrapper.circumcenters[vertex2];

      if (isNearBoundary(pos1) || isNearBoundary(pos2)) {
        edge.weight = boundaryWeight;
        boundaryEdgeCount++;
      }
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
 
  createVoronoiDiagram() {
    try {
      this.delaunatorWrapper = new DelaunatorWrapper(this.sites, this.settings);
      const result = this.delaunatorWrapper.triangulate();
      
      if (!result?.voronoiCells) {
        console.error('Triangulation failed');
        return;
      }
      
      // Create VoronoiCell instances from wrapper results 
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
         
      }); 
      
    } catch (error) {
      console.error('Error during triangulation:', error);
    }
  }
 
}
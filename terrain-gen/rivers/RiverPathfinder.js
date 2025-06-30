import { Point, Edge, Triangle, HalfEdge, VoronoiEdge, GeometryUtils } from '../voronoi/GeometryTypes.js';

/**
 * @typedef {Object} PathfindingSettings
 * @property {number} gridSize - Size of the grid
 * @property {Object} [hillsGenerator] - Hills generator for elevation data
 */

/**
 * @typedef {Object} EdgeInfo
 * @property {string} edgeId - Unique edge identifier
 * @property {number} edgeHeight - Height at the edge
 * @property {number} neighborHeight - Height of the neighboring cell
 * @property {VoronoiEdge} voronoiEdge - Voronoi edge object
 */

/**
 * @typedef {Object} VoronoiEdgeData
 * @property {Point} edgeStart - Start point of the edge
 * @property {Point} edgeEnd - End point of the edge
 * @property {number} cellA - First cell ID
 * @property {number} cellB - Second cell ID
 * @property {string} edgeId - Unique edge identifier
 */

/**
 * A* pathfinding for rivers using Voronoi edges
 */
export class RiverPathfinder {
  /**
   * @param {Object} voronoiGenerator - Voronoi diagram generator
   * @param {PathfindingSettings} settings - Pathfinding settings
   */
  constructor(voronoiGenerator, settings) {
    /** @type {Object} */
    this.voronoiGenerator = voronoiGenerator;
    /** @type {PathfindingSettings} */
    this.settings = settings;
    /** @type {Object|null} */
    this.coastlineGenerator = null;
    /** @type {Object|null} */
    this.lakesGenerator = null;
    /** @type {Object|null} */
    this.marshGenerator = null;
    /** @type {Object|null} */
    this.hillsGenerator = null;
    /** @type {Set<number>} */
    this.riverCells = new Set();
    /** @type {Map<number, Map<number, EdgeInfo>>|null} */
    this.voronoiEdgeGraph = null;
    /** @type {Map<string, number>} */
    this.edgeHeights = new Map();
  }

  /**
   * Set coastline generator reference
   * @param {Object} coastlineGenerator - Coastline generator
   */
  setCoastlineGenerator(coastlineGenerator) {
    this.coastlineGenerator = coastlineGenerator;
  }

  /**
   * Set lakes generator reference
   * @param {Object} lakesGenerator - Lakes generator
   */
  setLakesGenerator(lakesGenerator) {
    this.lakesGenerator = lakesGenerator;
  }

  /**
   * Set marsh generator reference
   * @param {Object} marshGenerator - Marsh generator
   */
  setMarshGenerator(marshGenerator) {
    this.marshGenerator = marshGenerator;
  }

  /**
   * Set hills generator reference
   * @param {Object} hillsGenerator - Hills generator
   */
  setHillsGenerator(hillsGenerator) {
    this.hillsGenerator = hillsGenerator;
  }

  /**
   * Set river cells reference
   * @param {Set<number>} riverCells - Set of river cell IDs
   */
  setRiverCells(riverCells) {
    this.riverCells = riverCells;
  }

  /**
   * Build Voronoi edge graph for pathfinding using typed edges
   */
  buildVoronoiPointGraph() {
    console.log('Building Voronoi point graph for pathfinding...');
    
    const voronoiDiagram = this.voronoiGenerator.getVoronoiDiagram();
    if (!voronoiDiagram || !voronoiDiagram.getVoronoiEdgesWithCells) {
      console.error('Cannot get Voronoi edges with cell information');
      return;
    }

    const voronoiEdges = voronoiDiagram.getVoronoiEdgesWithCells();
    
    // Build adjacency list representation using VoronoiEdge objects
    this.voronoiEdgeGraph = new Map();
    this.edgeHeights.clear();
    
    // Initialize adjacency lists for all cells
    this.voronoiGenerator.cells.forEach((cell, cellId) => {
      this.voronoiEdgeGraph.set(cellId, new Map());
    });
    
    // Add edges and calculate edge heights using VoronoiEdge class
    voronoiEdges.forEach(edgeData => {
      const voronoiEdge = new VoronoiEdge(
        edgeData.edgeStart,
        edgeData.edgeEnd,
        edgeData.cellA,
        edgeData.cellB,
        edgeData.edgeId
      );
      
      // Get heights of both cells
      const heightA = this.getCellElevation(voronoiEdge.cellA);
      const heightB = this.getCellElevation(voronoiEdge.cellB);
      
      // Edge height is minimum of bordering cell heights
      const edgeHeight = Math.min(heightA, heightB);
      this.edgeHeights.set(voronoiEdge.edgeId, edgeHeight);
      
      // Add bidirectional edges in adjacency list
      if (this.voronoiEdgeGraph.has(voronoiEdge.cellA)) {
        this.voronoiEdgeGraph.get(voronoiEdge.cellA).set(voronoiEdge.cellB, {
          edgeId: voronoiEdge.edgeId,
          edgeHeight: edgeHeight,
          neighborHeight: heightB,
          voronoiEdge: voronoiEdge
        });
      }
      
      if (this.voronoiEdgeGraph.has(voronoiEdge.cellB)) {
        this.voronoiEdgeGraph.get(voronoiEdge.cellB).set(voronoiEdge.cellA, {
          edgeId: voronoiEdge.edgeId,
          edgeHeight: edgeHeight,
          neighborHeight: heightA,
          voronoiEdge: voronoiEdge
        });
      }
    });
    
    console.log(`Built Voronoi edge graph with ${voronoiEdges.length} edges`);
  }

  /**
   * Find path to water targets using A* algorithm
   * @param {number} startCellId - Starting cell ID
   * @param {Array<number>} targetCells - Target cell IDs
   * @returns {Array<number>} Path as array of cell IDs
   */
  findPathToWater(startCellId, targetCells) {
    console.log('A* pathfinding with typed geometry classes...');
    
    // Validate start cell
    const startCell = this.voronoiGenerator.cells.get(startCellId);
    if (!startCell) {
      console.log(`ERROR: Start cell ${startCellId} not found in Voronoi cells!`);
      return [];
    }
    
    // A* pathfinding algorithm
    const openSet = new Set([startCellId]);
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(startCellId, 0);
    fScore.set(startCellId, this.heuristic(startCellId, targetCells));

    let iterationCount = 0;
    const maxIterations = 1000;

    while (openSet.size > 0 && iterationCount < maxIterations) {
      iterationCount++;
      
      // Get cell with lowest fScore
      let current = null;
      let lowestF = Infinity;
      
      for (const cellId of openSet) {
        const f = fScore.get(cellId) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = cellId;
        }
      }

      if (current === null) {
        console.log('ERROR: No valid current cell found!');
        break;
      }

      // Check if we reached a target
      if (targetCells.includes(current)) {
        console.log(`SUCCESS: Reached target cell ${current}!`);
        return this.reconstructPath(cameFrom, current);
      }

      openSet.delete(current);
      
      // Check neighbors using Voronoi edge graph
      if (!this.voronoiEdgeGraph.has(current)) {
        console.log(`ERROR: Current cell ${current} not found in Voronoi edge graph!`);
        continue;
      }

      const neighbors = this.voronoiEdgeGraph.get(current);
      for (const [neighborId, edgeInfo] of neighbors) {
        // Skip if neighbor is already a river
        if (this.isObstacle(neighborId)) {
          continue;
        }

        const movementCost = this.getEdgeMovementCost(current, neighborId, edgeInfo);
        const currentG = gScore.get(current) || 0;
        const tentativeG = currentG + movementCost;
        const existingG = gScore.get(neighborId);

        // Check if this is a better path OR if neighbor hasn't been visited yet
        if (existingG === undefined || tentativeG < existingG) {
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeG);
          const heuristic = this.heuristic(neighborId, targetCells);
          fScore.set(neighborId, tentativeG + heuristic);
          
          if (!openSet.has(neighborId)) {
            openSet.add(neighborId);
          }
        }
      }
    }

    console.log('ERROR: No path found - open set exhausted');
    return [];
  }

  /**
   * Calculate heuristic distance to targets
   * @param {number} cellId - Current cell ID
   * @param {Array<number>} targetCells - Target cell IDs
   * @returns {number} Heuristic cost
   */
  heuristic(cellId, targetCells) {
    const cell = this.voronoiGenerator.cells.get(cellId);
    if (!cell || !cell.site) {
      return Infinity;
    }

    const currentElevation = this.getCellElevation(cellId);
    let minCost = Infinity;
    
    if (targetCells.length === 0) {
      return 0;
    }
    
    for (const targetId of targetCells) {
      const targetCell = this.voronoiGenerator.cells.get(targetId);
      if (targetCell && targetCell.site) {
        // Calculate straight-line distance using Point methods if available
        let distance;
        if (cell.site.distanceTo && targetCell.site.distanceTo) {
          distance = cell.site.distanceTo(targetCell.site);
        } else {
          // Fallback calculation
          const dx = cell.site.x - targetCell.site.x;
          const dy = (cell.site.z || cell.site.y || 0) - (targetCell.site.z || targetCell.site.y || 0);
          distance = Math.sqrt(dx * dx + dy * dy);
        }
        
        // Factor in elevation difference
        const targetElevation = this.getCellElevation(targetId);
        const elevationDiff = currentElevation - targetElevation;
        
        let elevationCost = 0;
        if (elevationDiff < 0) {
          elevationCost = Math.abs(elevationDiff) * 0.1;
        } else {
          elevationCost = -elevationDiff * 0.3;
        }
        
        const totalCost = distance + elevationCost;
        minCost = Math.min(minCost, totalCost);
      }
    }

    return minCost === Infinity ? 100 : minCost;
  }

  /**
   * Get edge-based movement cost using VoronoiEdge information
   * @param {number} fromCellId - Source cell ID
   * @param {number} toCellId - Target cell ID
   * @param {EdgeInfo} edgeInfo - Edge information with VoronoiEdge
   * @returns {number} Movement cost
   */
  getEdgeMovementCost(fromCellId, toCellId, edgeInfo) {
    const fromHeight = this.getCellElevation(fromCellId);
    const toHeight = this.getCellElevation(toCellId);
    const edgeHeight = edgeInfo.edgeHeight;
    
    // Base cost
    let cost = 1;
    
    // Calculate elevation change: water flows from edge height
    const elevationChange = toHeight - edgeHeight;
    
    // Strongly prefer flowing downhill from the edge
    if (elevationChange <= 0) {
      const downhillBonus = Math.abs(elevationChange) * 0.3;
      cost = Math.max(0.01, 1 - downhillBonus);
    } else {
      const uphillPenalty = elevationChange * 0.8;
      cost = 1 + uphillPenalty;
    }
    
    // Additional terrain modifiers
    if (this.marshGenerator && this.marshGenerator.isMarshCell(toCellId)) {
      cost *= 0.3;
    }
    
    if (edgeHeight < 20) {
      cost *= 0.5;
    }
    
    return Math.max(0.01, cost);
  }

  /**
   * Get cell elevation from various sources
   * @param {number} cellId - Cell ID
   * @returns {number} Cell elevation
   */
  getCellElevation(cellId) {
    // Try hills generator first
    if (this.hillsGenerator) {
      const height = this.hillsGenerator.getCellHeight(cellId);
      if (height > 0) {
        return height;
      }
    }

    // Try cell metadata
    const cell = this.voronoiGenerator.cells.get(cellId);
    if (cell) {
      const gradientHeight = cell.getMetadata('height');
      if (gradientHeight !== undefined && gradientHeight !== null) {
        return gradientHeight;
      }
    }

    // Default elevation based on distance from center
    const site = cell?.site;
    if (site) {
      const gridSize = this.settings.gridSize;
      const centerX = gridSize / 2;
      const centerY = gridSize / 2;
      const x = site.x;
      const y = site.z || site.y || 0;
      
      const distFromCenter = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      const maxDist = Math.sqrt(2) * gridSize / 2;
      return (distFromCenter / maxDist) * 30;
    }

    return 0;
  }

  /**
   * Check if a cell is an obstacle for pathfinding
   * @param {number} cellId - Cell ID to check
   * @returns {boolean} True if cell is an obstacle
   */
  isObstacle(cellId) {
    // Rivers can't flow through existing rivers
    if (this.riverCells.has(cellId)) {
      return true;
    }
    
    // Lakes and marshes are passable
    if (this.lakesGenerator && this.lakesGenerator.isLakeCell(cellId)) {
      return false;
    }
    
    if (this.marshGenerator && this.marshGenerator.isMarshCell(cellId)) {
      return false;
    }

    // Only block impossibly high elevations
    const elevation = this.getCellElevation(cellId);
    return elevation > 150;
  }

  /**
   * Reconstruct path from A* search
   * @param {Map<number, number>} cameFrom - Parent map from A* search
   * @param {number} current - Current cell ID
   * @returns {Array<number>} Path as array of cell IDs
   */
  reconstructPath(cameFrom, current) {
    const path = [current];
    
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }
    
    return path;
  }
}
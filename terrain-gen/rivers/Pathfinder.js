import { Point, Edge, Triangle, HalfEdge, VoronoiEdge, GeometryUtils } from '../geometry/GeometryTypes.js';

/**
 * @typedef {Object} PathfindingSettings
 * @property {number} gridSize - Size of the grid
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
export class PathFinder {
  /**
   * @param {Object} voronoiGenerator - Voronoi diagram generator
   * @param {PathfindingSettings} settings - Pathfinding settings
   */
  constructor(voronoiGenerator, settings) {
    /** @type {Object} */
    this.voronoiGenerator = voronoiGenerator;
    /** @type {PathfindingSettings} */
    this.settings = settings; 
    /** @type {Set<number>} */
    this.riverCells = new Set();
    /** @type {Map<number, Map<number, EdgeInfo>>|null} */
    this.voronoiEdgeGraph = null; 
  }

  /**
   * Find path to water targets using A* algorithm
   * @param {number} startCellId - Starting cell ID
   * @param {Array<number>} targetCells - Target cell IDs
   * @returns {Array<number>} Path as array of cell IDs
   */
  findPath(startCellId, targetCells, delaunatorWrapper) {
    console.log('A* pathfinding with typed geometry classes...');

    const graph = delaunatorWrapper.voronoiAdjacentCells;
    const circumcenters = delaunatorWrapper.delaunayCircumcenters;

    if (!Object.keys(graph).includes(startCellId)) {
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
      if (!graph[current]) {
        console.log(`ERROR: Current cell ${current} not found in Voronoi edge graph!`);
        continue;
      }

      const neighbors = graph[current];
      for (const neighborId of neighbors) {

        const movementCost = this.getEdgeMovementCost(current, neighborId);
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
   * Get edge-based movement cost
   * @param {number} fromCellId - Source cell ID
   * @param {number} toCellId - Target cell ID
   * @returns {number} Movement cost
   */
  getEdgeMovementCost(fromCellId, toCellId) {
    const fromHeight = this.getCellElevation(fromCellId);
    const toHeight = this.getCellElevation(toCellId);
    
    // Base cost
    let cost = 1;
    
    // Calculate elevation change
    const elevationChange = toHeight - fromHeight;
    
    // Prefer flowing downhill
    if (elevationChange <= 0) {
      const downhillBonus = Math.abs(elevationChange) * 0.3;
      cost = Math.max(0.01, 1 - downhillBonus);
    } else {
      const uphillPenalty = elevationChange * 0.8;
      cost = 1 + uphillPenalty;
    }
    
    return Math.max(0.01, cost);
  }

  /**
   * Get cell elevation from various sources
   * @param {number} cellId - Cell ID
   * @returns {number} Cell elevation
   */
  getCellElevation(cellId) {
    // Try to get gradient height from cell metadata
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
   * Set river cells reference
   * @param {Set<number>} riverCells - Set of river cell IDs
   */
  setRiverCells(riverCells) {
    this.riverCells = riverCells;
  }

  /**
   * Build Voronoi edge graph for pathfinding
   */
  buildVoronoiPointGraph() {
    // Implementation can be added if needed
    console.log('Building Voronoi point graph...');
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
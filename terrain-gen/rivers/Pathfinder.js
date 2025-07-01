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
  constructor(delaunatorWrapper ) {
    /** @type {DelaunatorWrapper} */
    this.delaunatorWrapper = delaunatorWrapper; 
    /** @type {Set<number>} */
    this.riverCells = new Set();
  }

  /**
   * Find path to water targets using A* algorithm
   * @param {number} startCellId - Starting cell ID
   * @param {Array<number>} targetCells - Target cell IDs
   * @returns {Array<number>} Path as array of cell IDs
   */
  findPath(startPointIndex, endPointIndex, vertexMap, edgeMap, realCoordinates) {
    console.log('A* pathfinding with typed geometry classes...');

    console.log(vertexMap);
    console.log(edgeMap);
    console.log(startPointIndex);
    console.log(endPointIndex);
    
    
    // A* pathfinding algorithm
    const openSet = new Set([startPointIndex]);
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(startPointIndex, 0);
    fScore.set(startPointIndex, this.heuristic(startPointIndex, endPointIndex, realCoordinates));

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
      if (endPointIndex === current) {
        console.log(`SUCCESS: Reached target cell ${current}!`);
        return this.reconstructPath(cameFrom, current);
      }

      openSet.delete(current);
      
      // Check neighbors using Voronoi edge graph
      if (!vertexMap[current]) {
        console.log(`ERROR: Current cell ${current} not found in Voronoi edge graph!`);
        continue;
      }

      const neighbors = vertexMap[current];
      console.log(current);
      console.log(neighbors);
      for (const neighbor of neighbors) {
        const edgeId = `${current}-${neighbor}`;
        console.log(edgeId);
        const edge = edgeMap.get(edgeId);
        if (!edge) {
          console.log(`ERROR: Edge ${edgeId} not found in edge map!`);
          continue;
        } 
        const edgeWeight  = edge.weight;
        const neighborId = neighbor;

        const currentG = gScore.get(current) || 0;
        const tentativeG = currentG + edgeWeight;
        const existingG = gScore.get(neighborId);

        // Check if this is a better path OR if neighbor hasn't been visited yet
        if (existingG === undefined || tentativeG < existingG) {
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeG);
          const heuristic = this.heuristic(neighborId, endPointIndex, realCoordinates);
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
   * @param {number} circumcenterId - Current circumcenter ID
   * @param {Array<number>} targetCircumcenters - Target circumcenters
   * @returns {number} Heuristic cost
   */
  heuristic(circumcenterId, endPointIndex, realCoordinates) {
    const circumcenter = realCoordinates[circumcenterId];
    const endPoint = realCoordinates[endPointIndex];
    if (!circumcenter) {
      return Infinity;
    }
    let minCost = Infinity;
    
    if (endPoint === undefined) {
      return 0;
    }

        // Calculate straight-line distance using Point methods if available
        const dx = circumcenter.x - endPoint.x;
        const dy = (circumcenter.z || circumcenter.y || 0) - (endPoint.z || endPoint.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        minCost = Math.min(minCost, distance);
      


    return minCost === Infinity ? 100 : minCost;
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
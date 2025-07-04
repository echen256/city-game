import { Point, Edge, Triangle, HalfEdge, VoronoiEdge, GeometryUtils } from '../geometry/GeometryTypes.js';
import { PathFinder } from './Pathfinder.js';
import { GraphUtils } from '../geometry/graph/GraphUtils.js';

/**
 * @typedef {Object} RiverSettings
 * @property {number} [minSeparationDistance=50] - Minimum separation between river start/end points
 */

/**
 * @typedef {Object} RiverStats
 * @property {number} totalRiverCells - Total number of cells occupied by rivers
 * @property {number} numberOfRivers - Number of river paths generated
 * @property {number} averageRiverLength - Average length of river paths
 * @property {number} longestRiver - Length of the longest river path
 */

/**
 * @typedef {Object} RiverFeature
 * @property {string} id - Feature ID
 * @property {string} type - Feature type
 * @property {Object} centroid - Feature centroid coordinates
 * @property {Array<Object>} bezierCurves - Bezier curves defining the feature
 * @property {Array<Array<Object>>} pointDistributions - Point distributions
 * @property {Array<Object>} affectedTiles - Affected tiles
 * @property {Object} metadata - Feature metadata
 */

/**
 * Rivers generator using typed geometry and pathfinding
 */
export class RiversGenerator {
  /**
   * @param {Object} voronoiGenerator - Voronoi diagram generator
   * @param {RiverSettings} settings - Generator settings
   */
  constructor(voronoiGenerator, settings) {
    /** @type {Object} */
    this.voronoiGenerator = voronoiGenerator;
    /** @type {RiverSettings} */
    this.settings = settings;
    /** @type {Set<number>} */
    this.riverCells = new Set();
    /** @type {Array<Array<number>>} */
    this.riverPaths = [];
    /** @type {Set<number>} */
    this.usedStartPoints = new Set();
    /** @type {Set<number>} */
    this.usedEndPoints = new Set();
    /** @type {number} */
    this.minSeparationDistance = 50;
    /** @type {number} */
    this._seed = undefined;

    // Initialize seed if provided
    if (this.settings.seed !== undefined) {
      this.seedRandom(this.settings.seed);
    }

    /** @type {PathFinder} */
    this.pathfinder = new PathFinder(voronoiGenerator.delaunatorWrapper);
    console.log('RiversGenerator constructor');
    console.log(voronoiGenerator.delaunatorWrapper);
  }

  /**
   * Generate a single river path
   * @param {number} riverIndex - Index of the river to generate
   * @param {Object} graphData - Graph data containing vertices, edges, and circumcenters
   * @returns {Array<number>} River path as array of vertex indices
   */
  generateSingleRiver(riverIndex, graphData) {
    console.log(`\n=== GENERATING SINGLE RIVER ${riverIndex + 1} ===`);

    // Apply boundary weighting to discourage river paths along map edges
    this.applyBoundaryWeighting(graphData);

    // Step 1: Select random start point on north edge
    let startPoint = this.selectNorthEdgePoint(graphData);
    if (startPoint === null) {
      console.log(`FAILURE: No valid start point found for river ${riverIndex + 1}`);
      return [];
    }

    // Step 2: Select random end point on south edge
    let endPoint = this.selectSouthEdgePoint(graphData);
    if (endPoint === null) {
      console.log(`FAILURE: No valid end point found for river ${riverIndex + 1}`);
      return [];
    }

    console.log(`Selected start point: ${startPoint} (north edge)`);
    console.log(`Selected end point: ${endPoint} (south edge)`);

    // Step 3: Use A* pathfinding to find path from north to south edge
    console.log(`Starting A* pathfinding from ${startPoint} to ${endPoint}...`);
    console.log(`Pathfinder data check:`);
    console.log(`- Start vertex in vertexMap: ${!!graphData.voronoiVertexVertexMap[startPoint]}`);
    console.log(`- End vertex in vertexMap: ${!!graphData.voronoiVertexVertexMap[endPoint]}`);
    console.log(`- Start vertex connections: ${graphData.voronoiVertexVertexMap[startPoint] ? graphData.voronoiVertexVertexMap[startPoint].length : 'N/A'}`);
    console.log(`- End vertex connections: ${graphData.voronoiVertexVertexMap[endPoint] ? graphData.voronoiVertexVertexMap[endPoint].length : 'N/A'}`);

    const path = this.pathfinder.findPath(startPoint, endPoint,
      graphData.voronoiVertexVertexMap,
      graphData.voronoiEdges,
      graphData.circumcenters);
    console.log(`A* pathfinding result: ${path.length > 0 ? 'SUCCESS' : 'FAILED'}`);

    if (path.length > 0) {
      console.log(`SUCCESS: River ${riverIndex + 1} generated with ${path.length} cells`);
    } else {
      console.log(`FAILURE: No path found from start point ${startPoint} to end point ${endPoint}`);
    }

    console.log(`=== SINGLE RIVER ${riverIndex + 1} COMPLETE ===\n`);
    return path;
  }

  /**
   * Get cell elevation from various sources
   * @param {number} cellId - Cell ID
   * @returns {number} Cell elevation
   */
  getCellElevation(cellId) {
    // Try to get gradient height from cell metadata
    const cell = this.voronoiGenerator.delaunatorWrapper.voronoiCells.get(cellId);
    if (cell) {
      const gradientHeight = cell.getMetadata('height');
      if (gradientHeight !== undefined && gradientHeight !== null) {
        return gradientHeight;
      }
    }

    // Default elevation based on distance from center (simple fallback)
    const site = cell?.site;
    if (site) {
      const gridSize = this.settings.gridSize;
      const centerX = gridSize / 2;
      const centerY = gridSize / 2;
      const x = site.x;
      const y = site.z || site.y || 0;

      // Distance from center normalized to 0-50 range
      const distFromCenter = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      const maxDist = Math.sqrt(2) * gridSize / 2;
      return (distFromCenter / maxDist) * 30; // 0-30 elevation range
    }

    return 0;
  }

  /**
   * Check if a cell is part of a river
   * @param {number} cellId - Cell ID to check
   * @returns {boolean} True if cell is part of a river
   */
  isRiverCell(cellId) {
    return this.riverCells.has(cellId);
  }

  /**
   * Get all river cell IDs
   * @returns {Array<number>} Array of river cell IDs
   */
  getRiverCells() {
    return Array.from(this.riverCells);
  }

  /**
   * Get all river paths
   * @returns {Array<Array<number>>} Array of river paths
   */
  getRiverPaths() {
    return [...this.riverPaths];
  }

  /**
   * Get river generation statistics
   * @returns {RiverStats} River statistics
   */
  getRiverStats() {
    return {
      totalRiverCells: this.riverCells.size,
      numberOfRivers: this.riverPaths.length,
      averageRiverLength: this.riverPaths.length > 0 ?
        this.riverPaths.reduce((sum, path) => sum + path.length, 0) / this.riverPaths.length : 0,
      longestRiver: this.riverPaths.length > 0 ?
        Math.max(...this.riverPaths.map(path => path.length)) : 0
    };
  }

  /**
   * Select parallel edge targets for rivers
   * @param {number} startCell - Starting cell ID
   * @returns {Array<number>} Array of target cell IDs
   */
  selectParallelEdgeTargets(startCell) {
    const gridSize = this.settings.gridSize;
    const edgeTolerance = 100; // Distance from edge to consider "edge cell"
    const startSite = this.voronoiGenerator.delaunatorWrapper.voronoiCells.get(startCell)?.site;

    if (!startSite) {
      console.log('No start site found for parallel edge targeting');
      return [];
    }

    const startX = startSite.x;
    const startY = startSite.z || startSite.y || 0;

    // Determine which edge the start cell is on
    let startEdge = null;
    if (startX <= edgeTolerance) {
      startEdge = 'W'; // West edge
    } else if (startX >= (gridSize - edgeTolerance)) {
      startEdge = 'E'; // East edge
    } else if (startY <= edgeTolerance) {
      startEdge = 'N'; // North edge
    } else if (startY >= (gridSize - edgeTolerance)) {
      startEdge = 'S'; // South edge
    }

    if (!startEdge) {
      console.log('Start cell is not on any edge');
      return [];
    }

    // Determine parallel/opposite edge
    let targetEdge = null;
    switch (startEdge) {
      case 'N': targetEdge = 'S'; break; // North -> South
      case 'S': targetEdge = 'N'; break; // South -> North
      case 'E': targetEdge = 'W'; break; // East -> West
      case 'W': targetEdge = 'E'; break; // West -> East
    }

    console.log(`Start edge: ${startEdge}, Target edge: ${targetEdge}`);

    // Find cells on the target edge
    const targetCells = [];
    this.voronoiGenerator.delaunatorWrapper.voronoiCells.forEach((cell, cellId) => {
      const site = cell.site;
      if (!site) return;

      const x = site.x;
      const y = site.z || site.y || 0;

      let isOnTargetEdge = false;
      switch (targetEdge) {
        case 'N': // North edge (top)
          isOnTargetEdge = y <= edgeTolerance;
          break;
        case 'S': // South edge (bottom)
          isOnTargetEdge = y >= (gridSize - edgeTolerance);
          break;
        case 'E': // East edge (right)
          isOnTargetEdge = x >= (gridSize - edgeTolerance);
          break;
        case 'W': // West edge (left)
          isOnTargetEdge = x <= edgeTolerance;
          break;
      }

      if (isOnTargetEdge) {
        targetCells.push(cellId);
      }
    });

    console.log(`Found ${targetCells.length} target cells on ${targetEdge} edge`);
    return targetCells;
  }

  /**
   * Calculate distance between two cells
   * @param {number} cellId1 - First cell ID
   * @param {number} cellId2 - Second cell ID
   * @returns {number} Distance between cells
   */
  getDistanceBetweenCells(cellId1, cellId2) {
    const cell1 = this.voronoiGenerator.delaunatorWrapper.voronoiCells.get(cellId1);
    const cell2 = this.voronoiGenerator.delaunatorWrapper.voronoiCells.get(cellId2);

    if (!cell1 || !cell2 || !cell1.site || !cell2.site) {
      return Infinity;
    }

    const dx = cell1.site.x - cell2.site.x;
    const dy = (cell1.site.z || cell1.site.y || 0) - (cell2.site.z || cell2.site.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if a cell is too close to any used points
   * @param {number} cellId - Cell ID to check
   * @param {Set<number>} usedPoints - Set of used point IDs
   * @returns {boolean} True if cell is too close to used points
   */
  isTooCloseToUsedPoints(cellId, usedPoints) {
    for (const usedCellId of usedPoints) {
      if (this.getDistanceBetweenCells(cellId, usedCellId) < this.minSeparationDistance) {
        return true;
      }
    }
    return false;
  }

  /**
   * Set random seed for reproducibility
   * @param {number} seed - Random seed
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

  /**
   * Generate random number (seeded if available)
   * @returns {number} Random number between 0 and 1
   */
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
   * Create terrain features for rivers
   * @param {Object} terrainData - Terrain data manager
   * @returns {RiverFeature} Overall rivers feature
   */
  createRiverFeatures(terrainData) {
    this.riverPaths.forEach((path, index) => {
      const riverFeature = terrainData.createFeature(`river_${index}`);

      // Add river path as point distribution
      const riverSites = path.map(cellId => {
        const cell = this.voronoiGenerator.delaunatorWrapper.voronoiCells.get(cellId);
        return cell ? cell.site : null;
      }).filter(site => site !== null);

      riverFeature.addPointDistribution(riverSites);

      // Calculate centroid
      if (riverSites.length > 0) {
        const avgX = riverSites.reduce((sum, site) => sum + site.x, 0) / riverSites.length;
        const avgZ = riverSites.reduce((sum, site) => sum + (site.z || site.y || 0), 0) / riverSites.length;
        riverFeature.setCentroid(avgX, avgZ);
      }

      // Add metadata
      riverFeature.setMetadata('riverIndex', index);
      riverFeature.setMetadata('pathLength', path.length);
      riverFeature.setMetadata('startCell', path[0]);
      riverFeature.setMetadata('endCell', path[path.length - 1]);
    });

    // Create overall rivers feature
    const riversFeature = terrainData.createFeature('rivers');
    riversFeature.setMetadata('riverCount', this.riverPaths.length);
    riversFeature.setMetadata('stats', this.getRiverStats());

    return riversFeature;
  }


  /**
   * Select a random vertex point on the north edge of the map
   * @param {Object} graphData - Graph data to search
   * @returns {number|null} Vertex index on north edge or null if none found
   */
  selectNorthEdgePoint(graphData) {
    console.log('=== SELECTING NORTH EDGE START POINT ===');
    const gridSize = this.voronoiGenerator.settings.gridSize;
    const edgeTolerance = 30; // Distance from edge to consider "edge vertex"
    const northEdgeVertices = [];

    console.log(`Graph data has ${graphData.circumcenters.length} total circumcenters`);
    console.log(`Graph data has ${Object.keys(graphData.voronoiVertexVertexMap).length} vertex mappings`);

    // Check circumcenters (Voronoi vertices) for those near the north edge
    graphData.circumcenters.forEach((vertex, index) => {
      if (!vertex) return;

      const x = vertex.x;
      const z = vertex.z || vertex.y || 0;

      // Check if vertex is near north edge (z coordinate close to 0) and available in graph
      if (z < edgeTolerance && z >= 0 && x >= 0 && x <= (gridSize) &&
        graphData.voronoiVertexVertexMap[index]) {
        northEdgeVertices.push(index);
        console.log(`Found north edge vertex ${index} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      }
    });

    if (northEdgeVertices.length === 0) {
      console.log('FAILURE: No vertices found on north edge');
      return null;
    }

    // Select random vertex from north edge
    const selectedIndex = Math.floor(this.random() * northEdgeVertices.length);
    const selectedVertex = northEdgeVertices[selectedIndex];

    console.log(`SUCCESS: Selected north edge vertex ${selectedVertex} (${selectedIndex + 1}/${northEdgeVertices.length})`);
    return selectedVertex;
  }

  /**
   * Select a random vertex point on the south edge of the map
   * @param {Object} graphData - Graph data to search
   * @returns {number|null} Vertex index on south edge or null if none found
   */
  selectSouthEdgePoint(graphData) {
    console.log('=== SELECTING SOUTH EDGE END POINT ===');
    const gridSize = this.voronoiGenerator.settings.gridSize;
    const edgeTolerance = 10; // Distance from edge to consider "edge vertex"
    const southEdgeVertices = [];

    console.log(`Graph data has ${graphData.circumcenters.length} total circumcenters`);
    console.log(`Graph data has ${Object.keys(graphData.voronoiVertexVertexMap).length} vertex mappings`);

    // Check circumcenters (Voronoi vertices) for those near the south edge
    graphData.circumcenters.forEach((vertex, index) => {
      if (!vertex) return;

      const x = vertex.x;
      const z = vertex.z || vertex.y || 0;

      // Check if vertex is near south edge (z coordinate close to gridSize) and available in graph
      if (z <= gridSize && z >= (gridSize - edgeTolerance) && x >= 0 && x <= (gridSize) &&
        graphData.voronoiVertexVertexMap[index]) {
        southEdgeVertices.push(index);
        console.log(`Found south edge vertex ${index} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      }
    });

    if (southEdgeVertices.length === 0) {
      console.log('FAILURE: No vertices found on south edge');
      return null;
    }

    // Select random vertex from south edge
    const selectedIndex = Math.floor(this.random() * southEdgeVertices.length);
    const selectedVertex = southEdgeVertices[selectedIndex];

    console.log(`SUCCESS: Selected south edge vertex ${selectedVertex} (${selectedIndex + 1}/${southEdgeVertices.length})`);
    return selectedVertex;
  }


  applyBoundaryWeighting(graphData) {
    const gridSize = this.voronoiGenerator.settings.gridSize;
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
    for (const [edgeKey, edge] of graphData.voronoiEdges.entries()) {
      const [vertex1, vertex2] = edgeKey.split('-').map(Number);
      const pos1 = graphData.circumcenters[vertex1];
      const pos2 = graphData.circumcenters[vertex2];

      if (isNearBoundary(pos1) || isNearBoundary(pos2)) {
        edge.weight = boundaryWeight;
        boundaryEdgeCount++;
      }
    }
  }

  generateRivers(map, graphState, numRivers) {
    console.log(`Generating ${numRivers} rivers using GraphState workflow...`);

    const riverPaths = [];

    for (let i = 0; i < numRivers; i++) {
      // Get the largest available partition from GraphState
      const largestPartition = graphState.getLargestPartition();
      if (!largestPartition) {
        console.log(`No more available partitions for river ${i + 1}. Stopping generation.`);
        break;
      }

      console.log(`River ${i + 1}: Using partition ${largestPartition.id} with ${largestPartition.graph.circumcenters.filter(v => v !== null).length} vertices`);

      // Generate river path on the selected partition
      const river = this.generateSingleRiver(i, largestPartition.graph);
      if (river.length > 0) {
        riverPaths.push(river);
        console.log(`Generated river ${i + 1} with ${river.length} vertices`);

        // Split the partition using GraphState
        const splitMetadata = {
          featureType: 'river',
          featureIndex: i,
          description: `River ${i + 1}`,
          additionalData: {
            riverLength: river.length,
            startVertex: river[0],
            endVertex: river[river.length - 1]
          }
        };

        const newPartitions = graphState.splitGraphByPath(largestPartition.id, river, splitMetadata);

        console.log(`After river ${i + 1}: Split into ${newPartitions.length} new partitions`);
        newPartitions.forEach((partition, idx) => {
          console.log(`  Partition ${partition.id}: ${partition.graph.circumcenters.filter(v => v !== null).length} vertices`);
        });
      }
    }
    this.riverPaths = riverPaths;
    return riverPaths
  }
}
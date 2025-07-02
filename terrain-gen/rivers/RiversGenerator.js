import { Point, Edge, Triangle, HalfEdge, VoronoiEdge, GeometryUtils } from '../geometry/GeometryTypes.js';
import { PathFinder } from './Pathfinder.js';

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
    
    /** @type {PathFinder} */
    this.pathfinder = new PathFinder(voronoiGenerator.delaunatorWrapper);
    console.log('RiversGenerator constructor');
    console.log(voronoiGenerator.delaunatorWrapper);
  }

  /**
   * Generate rivers using pathfinding
   * @param {number} [numRivers=2] - Number of rivers to generate
   * @returns {Array<Array<number>>} Array of river paths
   */
  generateRivers(numRivers = 2) {
    if (!this.voronoiGenerator || !this.voronoiGenerator.cells || this.voronoiGenerator.cells.size === 0) {
      console.error('RiversGenerator: No Voronoi diagram available');
      return [];
    }
    this.clearRivers();
    console.log(`Generating ${numRivers} rivers...`);

    // Create initial deep copy of the graph data structures
    let availableGraphs = [this.createDeepCopyOfGraph()];
    console.log(`Starting with 1 connected graph containing ${availableGraphs[0].circumcenters.length} vertices`);

    for (let i = 0; i < numRivers; i++) {
      if (availableGraphs.length === 0) {
        console.log(`No more available graphs for river ${i + 1}. Stopping generation.`);
        break;
      }

      // Find the largest available graph for this river
      const largestGraphIndex = this.findLargestGraph(availableGraphs);
      const selectedGraph = availableGraphs[largestGraphIndex];
      
      console.log(`River ${i + 1}: Using graph ${largestGraphIndex} with ${selectedGraph.circumcenters.length} vertices`);

      const river = this.generateSingleRiver(i, selectedGraph);
      if (river.length > 0) {
        this.riverPaths.push(river);
        console.log(`Generated river ${i + 1} with ${river.length} vertices`);

        // Remove used vertices from the graph
        this.removeUsedVerticesFromGraph(selectedGraph, river);
        
        // Find connected subgraphs in the remaining graph
        const newSubgraphs = this.findConnectedSubgraphs(selectedGraph);
        
        // Replace the used graph with its partitioned subgraphs
        availableGraphs.splice(largestGraphIndex, 1, ...newSubgraphs);
        
        console.log(`After river ${i + 1}: Split into ${newSubgraphs.length} subgraphs`);
        newSubgraphs.forEach((subgraph, idx) => {
          console.log(`  Subgraph ${idx}: ${subgraph.circumcenters.length} vertices`);
        });
      }
    }

    console.log(`Rivers generation complete. Total paths: ${this.riverPaths.length}, total cells: ${this.riverCells.size}`);
    return this.riverPaths;
  }
  /**
   * Generate a single river path
   * @param {number} riverIndex - Index of the river to generate
   * @param {Object} graphData - Graph data containing vertices, edges, and circumcenters
   * @returns {Array<number>} River path as array of vertex indices
   */
  generateSingleRiver(riverIndex, graphData) {
    console.log(`\n=== GENERATING SINGLE RIVER ${riverIndex + 1} ===`);
    
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
    const cell = this.voronoiGenerator.cells.get(cellId);
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
   * Clear all river data
   */
  clearRivers() {
    // Remove river metadata from all cells
    this.voronoiGenerator.cells.forEach((cell) => {
      cell.setMetadata('river', false);
      cell.setMetadata('riverIndex', null);
      cell.setMetadata('riverPosition', null);
      cell.setMetadata('riverStartPoint', false);
      cell.setMetadata('riverEndPoint', false);
    });
    
    this.riverCells.clear();
    this.riverPaths = [];
    this.usedStartPoints.clear();
    this.usedEndPoints.clear();
  }


  /**
   * Select parallel edge targets for rivers
   * @param {number} startCell - Starting cell ID
   * @returns {Array<number>} Array of target cell IDs
   */
  selectParallelEdgeTargets(startCell) {
    const gridSize = this.settings.gridSize;
    const edgeTolerance = 100; // Distance from edge to consider "edge cell"
    const startSite = this.voronoiGenerator.cells.get(startCell)?.site;
    
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
    this.voronoiGenerator.cells.forEach((cell, cellId) => {
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
    const cell1 = this.voronoiGenerator.cells.get(cellId1);
    const cell2 = this.voronoiGenerator.cells.get(cellId2);
    
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
   * Generate random number (seeded if available)
   * @returns {number} Random number between 0 and 1
   */
  random() {
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
        const cell = this.voronoiGenerator.cells.get(cellId);
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
   * Create a deep copy of the graph data structures for pathfinding
   * @returns {Object} Deep copy containing circumcenters, voronoiVertexVertexMap, and voronoiEdges
   */
  createDeepCopyOfGraph() {
    const originalWrapper = this.voronoiGenerator.delaunatorWrapper;
    
    // Deep copy circumcenters array
    const circumcenters = originalWrapper.circumcenters.map(vertex => 
      vertex ? { x: vertex.x, z: vertex.z || vertex.y || 0 } : null
    );
    
    // Deep copy voronoiVertexVertexMap
    const voronoiVertexVertexMap = {};
    for (const [vertexIndex, connectedVertices] of Object.entries(originalWrapper.voronoiVertexVertexMap)) {
      voronoiVertexVertexMap[vertexIndex] = [...connectedVertices];
    }
    
    // Deep copy voronoiEdges map
    const voronoiEdges = new Map();
    for (const [edgeKey, edge] of originalWrapper.voronoiEdges.entries()) {
      voronoiEdges.set(edgeKey, {
        a: { x: edge.a.x, z: edge.a.z || edge.a.y || 0 },
        b: { x: edge.b.x, z: edge.b.z || edge.b.y || 0 },
        id: edge.id,
        weight: edge.weight
      });
    }
    
    console.log(`Created deep copy: ${circumcenters.length} vertices, ${Object.keys(voronoiVertexVertexMap).length} vertex mappings, ${voronoiEdges.size} edges`);
    
    return {
      circumcenters,
      voronoiVertexVertexMap,
      voronoiEdges
    };
  }

  /**
   * Find the largest available graph from the list
   * @param {Array<Object>} graphs - Array of graph objects
   * @returns {number} Index of the largest graph
   */
  findLargestGraph(graphs) {
    let largestIndex = 0;
    let largestSize = graphs[0].circumcenters.length;
    
    for (let i = 1; i < graphs.length; i++) {
      if (graphs[i].circumcenters.length > largestSize) {
        largestSize = graphs[i].circumcenters.length;
        largestIndex = i;
      }
    }
    
    return largestIndex;
  }

  /**
   * Remove used vertices from the graph data structure
   * @param {Object} graphData - Graph data to modify
   * @param {Array<number>} usedVertices - Array of vertex indices to remove
   */
  removeUsedVerticesFromGraph(graphData, usedVertices) {
    console.log(`Removing ${usedVertices.length} used vertices from graph`);
    
    const usedSet = new Set(usedVertices);
    
    // Remove from circumcenters (set to null to maintain indices)
    usedVertices.forEach(vertexIndex => {
      if (graphData.circumcenters[vertexIndex]) {
        graphData.circumcenters[vertexIndex] = null;
      }
    });
    
    // Remove from vertex mapping and clean up connections
    usedVertices.forEach(vertexIndex => {
      // Remove this vertex's connections
      delete graphData.voronoiVertexVertexMap[vertexIndex];
      
      // Remove references to this vertex from other vertices
      for (const [otherVertex, connections] of Object.entries(graphData.voronoiVertexVertexMap)) {
        graphData.voronoiVertexVertexMap[otherVertex] = connections.filter(connectedVertex => 
          !usedSet.has(connectedVertex)
        );
      }
    });
    
    // Remove edges that involve used vertices
    const edgesToRemove = [];
    for (const [edgeKey, edge] of graphData.voronoiEdges.entries()) {
      const [vertex1, vertex2] = edgeKey.split('-').map(Number);
      if (usedSet.has(vertex1) || usedSet.has(vertex2)) {
        edgesToRemove.push(edgeKey);
      }
    }
    
    edgesToRemove.forEach(edgeKey => {
      graphData.voronoiEdges.delete(edgeKey);
    });
    
    console.log(`Removed ${edgesToRemove.length} edges involving used vertices`);
  }

  /**
   * Find connected subgraphs using flood fill algorithm
   * @param {Object} graphData - Graph data to partition
   * @returns {Array<Object>} Array of connected subgraph objects
   */
  findConnectedSubgraphs(graphData) {
    console.log('Finding connected subgraphs using flood fill...');
    
    const visited = new Set();
    const subgraphs = [];
    
    // Get all valid (non-null) vertex indices
    const validVertices = [];
    graphData.circumcenters.forEach((vertex, index) => {
      if (vertex !== null && graphData.voronoiVertexVertexMap[index]) {
        validVertices.push(index);
      }
    });
    
    console.log(`Starting flood fill on ${validVertices.length} valid vertices`);
    
    // Flood fill from each unvisited vertex
    for (const startVertex of validVertices) {
      if (!visited.has(startVertex)) {
        const subgraph = this.floodFillSubgraph(graphData, startVertex, visited);
        if (subgraph.circumcenters.filter(v => v !== null).length > 0) {
          subgraphs.push(subgraph);
        }
      }
    }
    
    console.log(`Found ${subgraphs.length} connected subgraphs`);
    return subgraphs;
  }

  /**
   * Perform flood fill to find a single connected subgraph
   * @param {Object} graphData - Original graph data
   * @param {number} startVertex - Starting vertex for flood fill
   * @param {Set<number>} visited - Global visited set
   * @returns {Object} Subgraph object
   */
  floodFillSubgraph(graphData, startVertex, visited) {
    const subgraphVertices = new Set();
    const queue = [startVertex];
    
    // Flood fill to find all connected vertices
    while (queue.length > 0) {
      const currentVertex = queue.shift();
      
      if (visited.has(currentVertex)) continue;
      
      visited.add(currentVertex);
      subgraphVertices.add(currentVertex);
      
      // Add connected vertices to queue
      const connections = graphData.voronoiVertexVertexMap[currentVertex] || [];
      for (const connectedVertex of connections) {
        if (!visited.has(connectedVertex) && graphData.circumcenters[connectedVertex] !== null) {
          queue.push(connectedVertex);
        }
      }
    }
    
    // Create new subgraph with only the connected vertices
    const newCircumcenters = new Array(graphData.circumcenters.length).fill(null);
    const newVertexMap = {};
    const newEdges = new Map();
    
    // Copy circumcenters for vertices in this subgraph
    for (const vertexIndex of subgraphVertices) {
      newCircumcenters[vertexIndex] = { ...graphData.circumcenters[vertexIndex] };
    }
    
    // Copy vertex mappings for vertices in this subgraph
    for (const vertexIndex of subgraphVertices) {
      const connections = graphData.voronoiVertexVertexMap[vertexIndex] || [];
      newVertexMap[vertexIndex] = connections.filter(connectedVertex => 
        subgraphVertices.has(connectedVertex)
      );
    }
    
    // Copy edges that connect vertices within this subgraph
    for (const [edgeKey, edge] of graphData.voronoiEdges.entries()) {
      const [vertex1, vertex2] = edgeKey.split('-').map(Number);
      if (subgraphVertices.has(vertex1) && subgraphVertices.has(vertex2)) {
        newEdges.set(edgeKey, {
          a: { ...edge.a },
          b: { ...edge.b },
          id: edge.id,
          weight: edge.weight
        });
      }
    }
    
    console.log(`Subgraph: ${subgraphVertices.size} vertices, ${Object.keys(newVertexMap).length} mappings, ${newEdges.size} edges`);
    
    return {
      circumcenters: newCircumcenters,
      voronoiVertexVertexMap: newVertexMap,
      voronoiEdges: newEdges
    };
  }

  /**
   * Select a random vertex point on the north edge of the map
   * @param {Object} graphData - Graph data to search
   * @returns {number|null} Vertex index on north edge or null if none found
   */
  selectNorthEdgePoint(graphData) {
    console.log('=== SELECTING NORTH EDGE START POINT ===');
    const gridSize = this.voronoiGenerator.settings.gridSize;
    const edgeTolerance = 50; // Distance from edge to consider "edge vertex"
    const northEdgeVertices = [];

    console.log(`Graph data has ${graphData.circumcenters.length} total circumcenters`);
    console.log(`Graph data has ${Object.keys(graphData.voronoiVertexVertexMap).length} vertex mappings`);

    // Check circumcenters (Voronoi vertices) for those near the north edge
    graphData.circumcenters.forEach((vertex, index) => {
      if (!vertex) return;
      
      const x = vertex.x;
      const z = vertex.z || vertex.y || 0;
      
      // Check if vertex is near north edge (z coordinate close to 0) and available in graph
      if (z <= edgeTolerance && x >= edgeTolerance && x <= (gridSize - edgeTolerance) && 
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
    const edgeTolerance = 50; // Distance from edge to consider "edge vertex"
    const southEdgeVertices = [];

    console.log(`Graph data has ${graphData.circumcenters.length} total circumcenters`);
    console.log(`Graph data has ${Object.keys(graphData.voronoiVertexVertexMap).length} vertex mappings`);

    // Check circumcenters (Voronoi vertices) for those near the south edge
    graphData.circumcenters.forEach((vertex, index) => {
      if (!vertex) return;
      
      const x = vertex.x;
      const z = vertex.z || vertex.y || 0;
      
      // Check if vertex is near south edge (z coordinate close to gridSize) and available in graph
      if (z >= (gridSize - edgeTolerance) && x >= edgeTolerance && x <= (gridSize - edgeTolerance) && 
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
}
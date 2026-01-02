import { PathFinder } from './Pathfinder.js';
import { isVertexOutOfBounds } from '../utils/edgeDetection.js';

/**
 * Rivers generator using pathfinding
 */
export class RiversGenerator {
  /**
   * @param {Object} voronoiGenerator - Voronoi diagram generator
   * @param {Object} settings - Generator settings
   * @param {Function} seededRandom - Seeded random function
   */
  constructor(voronoiGenerator, settings, seededRandom) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.riverCells = new Set();
    this.riverPaths = [];
    this.pathfinder = new PathFinder(voronoiGenerator.delaunatorWrapper);
    this.seededRandom = seededRandom;
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
    const path = this.pathfinder.findPath(startPoint, endPoint,
      graphData.voronoiVertexVertexMap,
      graphData.voronoiEdges,
      graphData.circumcenters);

    if (path.length > 0) {
      console.log(`SUCCESS: River ${riverIndex + 1} generated with ${path.length} cells`);
    } else {
      console.log(`FAILURE: No path found from start point ${startPoint} to end point ${endPoint}`);
    }

    console.log(`=== SINGLE RIVER ${riverIndex + 1} COMPLETE ===\n`);
    return path;
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
   * Get all river paths
   * @returns {Array<Array<number>>} Array of river paths
   */
  getRiverPaths() {
    return [...this.riverPaths];
  }

  /**
   * Get river generation statistics
   * @returns {Object} River statistics
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
   * Select a random vertex point on the north edge of the map
   * @param {Object} graphData - Graph data to search
   * @returns {number|null} Vertex index on north edge or null if none found
   */
  selectNorthEdgePoint(graphData) {
    console.log('=== SELECTING NORTH EDGE START POINT ===');
    const gridSize = this.voronoiGenerator.settings.gridSize;
    const northEdgeVertices = [];

    console.log(`Graph data has ${graphData.circumcenters.length} total circumcenters`);

    // Check circumcenters (Voronoi vertices) for those near the north edge
    graphData.circumcenters.forEach((vertex, index) => {
      if (!vertex || !graphData.voronoiVertexVertexMap[index]) return;

      const z = vertex.z ?? vertex.y ?? 0;
      const outsideNorth = isVertexOutOfBounds(vertex, gridSize) && z < 0;

      if (outsideNorth && this.hasInBoundsConnection(index, graphData, gridSize)) {
        northEdgeVertices.push(index);
        console.log(`Found north edge vertex ${index} at (${vertex.x.toFixed(1)}, ${z.toFixed(1)})`);
      }
    });

    if (northEdgeVertices.length === 0) {
      console.log('FAILURE: No vertices found on north edge');
      return null;
    }

    // Select random vertex from north edge
    const selectedIndex = Math.floor(this.seededRandom() * northEdgeVertices.length);
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
    const southEdgeVertices = [];

    console.log(`Graph data has ${graphData.circumcenters.length} total circumcenters`);

    // Check circumcenters (Voronoi vertices) for those near the south edge
    graphData.circumcenters.forEach((vertex, index) => {
      if (!vertex || !graphData.voronoiVertexVertexMap[index]) return;

      const z = vertex.z ?? vertex.y ?? 0;
      const outsideSouth = isVertexOutOfBounds(vertex, gridSize) && z > gridSize;

      if (outsideSouth && this.hasInBoundsConnection(index, graphData, gridSize)) {
        southEdgeVertices.push(index);
        console.log(`Found south edge vertex ${index} at (${vertex.x.toFixed(1)}, ${z.toFixed(1)})`);
      }
    });

    if (southEdgeVertices.length === 0) {
      console.log('FAILURE: No vertices found on south edge');
      return null;
    }

    // Select random vertex from south edge 
    const selectedIndex = Math.floor(this.seededRandom() * southEdgeVertices.length);
    const selectedVertex = southEdgeVertices[selectedIndex];

    console.log(`SUCCESS: Selected south edge vertex ${selectedVertex} (${selectedIndex + 1}/${southEdgeVertices.length})`);
    return selectedVertex;
  }

  /**
   * Apply boundary weighting to discourage river paths along map edges
   * @param {Object} graphData - Graph data to modify
   */
  applyBoundaryWeighting(graphData) {
    const gridSize = this.voronoiGenerator.settings.gridSize;
    const boundaryWeight = 1000; // Very high weight to discourage boundary usage

    // Apply high weights to boundary edges
    for (const [edgeKey, edge] of graphData.voronoiEdges.entries()) {
      const [vertex1, vertex2] = edgeKey.split('-').map(Number);
      const pos1 = graphData.circumcenters[vertex1];
      const pos2 = graphData.circumcenters[vertex2];

      if (isVertexOutOfBounds(pos1, gridSize) || isVertexOutOfBounds(pos2, gridSize)) {
        edge.weight = boundaryWeight;
      }
    }
  }

  /**
   * Generate rivers using GraphState workflow
   * @param {Object} map - Map instance
   * @param {Object} graphState - Graph state manager
   * @param {number} numRivers - Number of rivers to generate
   * @returns {Array<Array<number>>} Array of river paths
   */
  generateRivers(map) {
    const numRivers = map.settings.rivers.numRivers;
    const graphState = map.graphState;
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
    return riverPaths;
  }
  hasInBoundsConnection(vertexIndex, graphData, gridSize) {
    const neighbors = graphData.voronoiVertexVertexMap[vertexIndex] || [];
    return neighbors.some((neighborIndex) => {
      const neighbor = graphData.circumcenters[neighborIndex];
      return neighbor && !isVertexOutOfBounds(neighbor, gridSize);
    });
  }

}

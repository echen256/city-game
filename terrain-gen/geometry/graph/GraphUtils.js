/**
 * GraphUtils.js - Utility functions for graph manipulation and analysis
 * 
 * Contains reusable functions for working with Voronoi graph data structures,
 * including deep copying, partitioning, and connectivity analysis.
 */

/**
 * Graph utility class for Voronoi diagram manipulation
 */
export class GraphUtils {
  /**
   * Create a deep copy of Voronoi graph data structures
   * @param {Object} delaunatorWrapper - DelaunatorWrapper instance
   * @returns {Object} Deep copy containing circumcenters, voronoiVertexVertexMap, and voronoiEdges
   */
  static createDeepCopyOfGraph(delaunatorWrapper) {
    // Deep copy circumcenters array
    const circumcenters = delaunatorWrapper.circumcenters.map(vertex => 
      vertex ? { x: vertex.x, z: vertex.z || vertex.y || 0 } : null
    );
    
    // Deep copy voronoiVertexVertexMap
    const voronoiVertexVertexMap = {};
    for (const [vertexIndex, connectedVertices] of Object.entries(delaunatorWrapper.voronoiVertexVertexMap)) {
      voronoiVertexVertexMap[vertexIndex] = [...connectedVertices];
    }
    
    // Deep copy voronoiEdges map
    const voronoiEdges = new Map();
    for (const [edgeKey, edge] of delaunatorWrapper.voronoiEdges.entries()) {
      voronoiEdges.set(edgeKey, {
        a: { x: edge.a.x, z: edge.a.z || edge.a.y || 0 },
        b: { x: edge.b.x, z: edge.b.z || edge.b.y || 0 },
        id: edge.id,
        weight: edge.weight
      });
    }
    
    console.log(`GraphUtils: Created deep copy: ${circumcenters.length} vertices, ${Object.keys(voronoiVertexVertexMap).length} vertex mappings, ${voronoiEdges.size} edges`);
    
    return {
      circumcenters,
      voronoiVertexVertexMap,
      voronoiEdges
    };
  }

  /**
   * Find the largest available graph from a list of graphs
   * @param {Array<Object>} graphs - Array of graph objects
   * @returns {number} Index of the largest graph
   */
  static findLargestGraph(graphs) {
    if (!graphs || graphs.length === 0) {
      throw new Error('GraphUtils: No graphs provided to findLargestGraph');
    }

    let largestIndex = 0;
    let largestSize = graphs[0].circumcenters.filter(v => v !== null).length;
    
    for (let i = 1; i < graphs.length; i++) {
      const currentSize = graphs[i].circumcenters.filter(v => v !== null).length;
      if (currentSize > largestSize) {
        largestSize = currentSize;
        largestIndex = i;
      }
    }
    
    console.log(`GraphUtils: Selected graph ${largestIndex} with ${largestSize} vertices`);
    return largestIndex;
  }

  /**
   * Remove used vertices from a graph data structure
   * @param {Object} graphData - Graph data to modify
   * @param {Array<number>} usedVertices - Array of vertex indices to remove
   */
  static removeUsedVerticesFromGraph(graphData, usedVertices) {
    console.log(`GraphUtils: Removing ${usedVertices.length} used vertices from graph`);
    
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
    
    console.log(`GraphUtils: Removed ${edgesToRemove.length} edges involving used vertices`);
  }

  /**
   * Find connected subgraphs using flood fill algorithm
   * @param {Object} graphData - Graph data to partition
   * @returns {Array<Object>} Array of connected subgraph objects
   */
  static findConnectedSubgraphs(graphData) {
    console.log('GraphUtils: Finding connected subgraphs using flood fill...');
    
    const visited = new Set();
    const subgraphs = [];
    
    // Get all valid (non-null) vertex indices
    const validVertices = [];
    graphData.circumcenters.forEach((vertex, index) => {
      if (vertex !== null && graphData.voronoiVertexVertexMap[index]) {
        validVertices.push(index);
      }
    });
    
    console.log(`GraphUtils: Starting flood fill on ${validVertices.length} valid vertices`);
    
    // Flood fill from each unvisited vertex
    for (const startVertex of validVertices) {
      if (!visited.has(startVertex)) {
        const subgraph = GraphUtils.floodFillSubgraph(graphData, startVertex, visited);
        if (subgraph.circumcenters.filter(v => v !== null).length > 0) {
          subgraphs.push(subgraph);
        }
      }
    }
    
    console.log(`GraphUtils: Found ${subgraphs.length} connected subgraphs`);
    return subgraphs;
  }

  /**
   * Perform flood fill to find a single connected subgraph
   * @param {Object} graphData - Original graph data
   * @param {number} startVertex - Starting vertex for flood fill
   * @param {Set<number>} visited - Global visited set
   * @returns {Object} Subgraph object
   */
  static floodFillSubgraph(graphData, startVertex, visited) {
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
    
    const validVertexCount = newCircumcenters.filter(v => v !== null).length;
    console.log(`GraphUtils: Subgraph: ${validVertexCount} vertices, ${Object.keys(newVertexMap).length} mappings, ${newEdges.size} edges`);
    
    return {
      circumcenters: newCircumcenters,
      voronoiVertexVertexMap: newVertexMap,
      voronoiEdges: newEdges
    };
  }

  /**
   * Determine the most central point (centroid) of a Delaunay triangulation
   * @param {Object} graphData - Graph data containing circumcenters
   * @param {string} [method='geometric'] - Method to use: 'geometric', 'weighted', or 'medoid'
   * @returns {Object} Centroid information with coordinates and method used
   */
  static determineCentroid(graphData, method = 'geometric') {
    const validVertices = graphData.circumcenters.filter(vertex => vertex !== null);
    
    if (validVertices.length === 0) {
      console.warn('GraphUtils: No valid vertices found for centroid calculation');
      return null;
    }

    let centroid = { x: 0, z: 0 };
    
    switch (method) {
      case 'geometric':
        // Simple arithmetic mean of all vertex positions
        centroid = GraphUtils._calculateGeometricCentroid(validVertices);
        break;
        
      case 'weighted':
        // Centroid weighted by vertex connectivity (more connected = more weight)
        centroid = GraphUtils._calculateWeightedCentroid(validVertices, graphData);
        break;
        
      case 'medoid':
        // Find the actual vertex that minimizes distance to all other vertices
        centroid = GraphUtils._calculateMedoidCentroid(validVertices);
        break;
        
      default:
        console.warn(`GraphUtils: Unknown centroid method '${method}', using geometric`);
        centroid = GraphUtils._calculateGeometricCentroid(validVertices);
    }

    console.log(`GraphUtils: Calculated ${method} centroid at (${centroid.x.toFixed(2)}, ${centroid.z.toFixed(2)}) from ${validVertices.length} vertices`);
    
    return {
      ...centroid,
      method,
      vertexCount: validVertices.length,
      isActualVertex: method === 'medoid'
    };
  }

  /**
   * Calculate geometric centroid (arithmetic mean)
   * @private
   */
  static _calculateGeometricCentroid(vertices) {
    const sum = vertices.reduce((acc, vertex) => ({
      x: acc.x + vertex.x,
      z: acc.z + (vertex.z || vertex.y || 0)
    }), { x: 0, z: 0 });

    return {
      x: sum.x / vertices.length,
      z: sum.z / vertices.length
    };
  }

  /**
   * Calculate weighted centroid based on vertex connectivity
   * @private
   */
  static _calculateWeightedCentroid(vertices, graphData) {
    let totalWeight = 0;
    const weightedSum = { x: 0, z: 0 };

    // Find vertex indices for weighting
    const vertexIndices = new Map();
    graphData.circumcenters.forEach((vertex, index) => {
      if (vertex !== null) {
        vertexIndices.set(vertex, index);
      }
    });

    vertices.forEach(vertex => {
      const index = vertexIndices.get(vertex);
      const connections = graphData.voronoiVertexVertexMap[index] || [];
      const weight = Math.max(1, connections.length); // More connections = higher weight

      weightedSum.x += vertex.x * weight;
      weightedSum.z += (vertex.z || vertex.y || 0) * weight;
      totalWeight += weight;
    });

    return {
      x: weightedSum.x / totalWeight,
      z: weightedSum.z / totalWeight
    };
  }

  /**
   * Calculate medoid (actual vertex closest to all others)
   * @private
   */
  static _calculateMedoidCentroid(vertices) {
    let bestVertex = vertices[0];
    let minTotalDistance = Infinity;

    vertices.forEach(candidate => {
      const totalDistance = vertices.reduce((sum, other) => {
        const dx = candidate.x - other.x;
        const dz = (candidate.z || candidate.y || 0) - (other.z || other.y || 0);
        return sum + Math.sqrt(dx * dx + dz * dz);
      }, 0);

      if (totalDistance < minTotalDistance) {
        minTotalDistance = totalDistance;
        bestVertex = candidate;
      }
    });

    return {
      x: bestVertex.x,
      z: bestVertex.z || bestVertex.y || 0,
      totalDistance: minTotalDistance
    };
  }

  /**
   * Validate graph data structure integrity
   * @param {Object} graphData - Graph data to validate
   * @returns {Object} Validation results with statistics and any issues found
   */
  static validateGraphData(graphData) {
    const issues = [];
    const stats = {
      totalVertices: 0,
      validVertices: 0,
      nullVertices: 0,
      totalEdges: graphData.voronoiEdges.size,
      vertexMappings: Object.keys(graphData.voronoiVertexVertexMap).length,
      orphanedVertices: 0,
      invalidEdges: 0
    };

    // Check circumcenters
    graphData.circumcenters.forEach((vertex, index) => {
      stats.totalVertices++;
      if (vertex === null) {
        stats.nullVertices++;
      } else {
        stats.validVertices++;
        
        // Check if vertex has mapping
        if (!graphData.voronoiVertexVertexMap[index]) {
          stats.orphanedVertices++;
          issues.push(`Vertex ${index} has no connectivity mapping`);
        }
      }
    });

    // Check edges
    for (const [edgeKey, edge] of graphData.voronoiEdges.entries()) {
      if (!edge.a || !edge.b || typeof edge.weight !== 'number') {
        stats.invalidEdges++;
        issues.push(`Invalid edge structure: ${edgeKey}`);
      }
    }

    console.log('GraphUtils: Graph validation results:', stats);
    if (issues.length > 0) {
      console.warn('GraphUtils: Graph validation issues:', issues);
    }

    return { stats, issues, isValid: issues.length === 0 };
  }
}
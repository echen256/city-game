import Delaunator from 'delaunator';
import { Point, Edge, Triangle, HalfEdge, VoronoiEdge, GeometryUtils } from './GeometryTypes.js';

/**
 * @typedef {Object} TriangulationResult
 * @property {Array<Triangle>} triangles - Array of triangles
 * @property {Array<Edge>} edges - Array of edges
 * @property {Map<number, Object>} voronoiCells - Map of Voronoi cells
 * @property {Object} delaunay - Raw Delaunator instance
 */

/**
 * @typedef {Object} VoronoiCellData
 * @property {Point|Object} site - Cell site point
 * @property {number} siteIndex - Site index
 * @property {Array<Object>} vertices - Cell vertices
 * @property {Set<number>} neighbors - Neighbor cell indices
 */

/**
 * @typedef {Object} VoronoiEdgeResult
 * @property {Point} a - Start point of edge
 * @property {Point} b - End point of edge
 */

/**
 * @typedef {Object} VoronoiEdgeWithCells
 * @property {Point} edgeStart - Start point of edge
 * @property {Point} edgeEnd - End point of edge
 * @property {number} cellA - First cell ID
 * @property {number} cellB - Second cell ID
 * @property {string} edgeId - Unique edge identifier
 */

/**
 * Wrapper around Delaunator library with geometry type integration
 */
export class DelaunatorWrapper {
  /**
   * @param {Array<Point|Object>} points - Array of points for triangulation
   */
  constructor(points) {
    /** @type {Array<Point|Object>} */
    this.points = points;
    /** @type {Delaunator|null} */
    this.delaunay = null;
    /** @type {Array<Edge>} */
    this.edges = [];
    /** @type {Map<number, VoronoiCellData>} */
    this.voronoiCells = new Map();
    /** @type {Set<number>|null} */
    this.validCellIndices = null;
    /** @type {Map<number, number>|null} */
    this.indexMapping = null;

    /** @type {Map<string, Edge>} */
    this.voronoiVertextEdges = new Map()
    /** @type {Array<Point>} */
    this.delaunayCircumcenters = [];
    /** @type {Map<number, Set<number>>} */
    this.voronoiAdjacentCells = new Map();
    /** @type {Array<Triangle>} */
    this.triangles = [];
  }

  restoreFromJson(json){
    this.points = json.points;
    this.triangulate()
    this.edges = json.edges;
    this.voronoiCells = json.voronoiCells;
    this.validCellIndices = json.validCellIndices;
    this.indexMapping = json.indexMapping;
    this.voronoiAdjacentCells = json.voronoiAdjacentCells;
    this.delaunayCircumcenters = json.delaunayCircumcenters;
    this.voronoiCells = json.voronoiCells;
    this.voronoiVertextEdges = json.voronoiVertextEdges;
  }

  constructVoronoiEdgeGraph(){
    for (const vertext of this.voronoiAdjacentCells){
      for (const neighbor of vertext){
        
        const circumcenterA = this.getCircumcenter(this.triangles[vertext]);
        const circumcenterB = this.getCircumcenter(this.triangles[neighbor]);

        const distance = circumcenterA.distance(circumcenterB);

        const e1 = new Edge(vertext, neighbor, null, distance);
        const e2 = new Edge(neighbor, vertext, null, distance);
        this.voronoiVertextEdges.set(e1.key, e1);
        this.voronoiVertextEdges.set(e2.key, e2);
      }
    }
  }

  /**
   * Perform Delaunay triangulation on the points
   * @returns {TriangulationResult} Triangulation results with triangles, edges, and Voronoi cells
   */
  triangulate() {
    if (this.points.length < 3) {
      console.warn('DelaunatorWrapper: Not enough points for triangulation (need at least 3)');
      return { triangles: [], edges: [], voronoiCells: new Map() };
    }

    // Convert points to flat array format expected by delaunator
    const coords = []; 
    for (const point of this.points) { 
      // Ensure we have valid coordinates
      const x = point.x;
      const y = point.z || point.y || 0;
      
      if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
        console.error('DelaunatorWrapper: Invalid point coordinates:', point);
        continue;
      }
      
      coords.push(x, y); 
    }

    // Check if we have enough valid points
    if (coords.length < 6) { // Need at least 3 points (6 coordinates)
      console.warn('DelaunatorWrapper: Not enough valid points for triangulation');
      return { triangles: [], edges: [], voronoiCells: new Map() };
    }
    
    // Create delaunator triangulation
    try {
      this.delaunay = new Delaunator(coords);
      // console.log('DelaunatorWrapper: Delaunay triangles array:', this.delaunay.triangles);
      // console.log('DelaunatorWrapper: Number of triangles:', this.delaunay.triangles.length / 3);
    } catch (error) {
      console.error('DelaunatorWrapper: Error creating triangulation:', error);
      return { triangles: [], edges: [], voronoiCells: new Map() };
    }
    
    // Extract triangles
    this.extractTriangles();
    
    // Extract edges
    this.extractEdges();
    
    // Generate Voronoi cells
    this.generateVoronoiCells();
    // console.log('DelaunatorWrapper: Final edges count:', this.edges.length);
    
    return {
      triangles: this.triangles,
      edges: this.edges,
      voronoiCells: this.voronoiCells,
      delaunay: this.delaunay
    };
  }

  /**
   * Extract triangles from Delaunator result using Triangle class
   */
  extractTriangles() {
    this.triangles = [];
    const triangleIndices = this.delaunay.triangles;
    
    for (let i = 0; i < triangleIndices.length; i += 3) {
      const aIndex = triangleIndices[i];
      const bIndex = triangleIndices[i + 1];
      const cIndex = triangleIndices[i + 2];
      
      // Validate indices
      if (aIndex >= this.points.length || bIndex >= this.points.length || cIndex >= this.points.length) {
        console.error('DelaunatorWrapper: Invalid triangle indices:', { aIndex, bIndex, cIndex, pointsLength: this.points.length });
        continue;
      }
      
      const pointA = this.points[aIndex];
      const pointB = this.points[bIndex];
      const pointC = this.points[cIndex];
      
      const triangle = new Triangle(pointA, pointB, pointC, [aIndex, bIndex, cIndex]);
      this.triangles.push(triangle);
    }
  }

  /**
   * Extract edges from triangles using Edge class
   */
  extractEdges() {
    this.edges = [];
    const edgeSet = new Set();
    
    // Extract unique edges from triangles
    for (const triangle of this.triangles) {
      const edgeIndices = [
        [triangle.indices[0], triangle.indices[1]],
        [triangle.indices[1], triangle.indices[2]],
        [triangle.indices[2], triangle.indices[0]]
      ];
      
      for (const [a, b] of edgeIndices) {
        const [minIndex, maxIndex] = [Math.min(a, b), Math.max(a, b)];
        const key = `${minIndex}-${maxIndex}`;
        
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          const pointA = this.points[minIndex];
          const pointB = this.points[maxIndex];
          const edge = new Edge(pointA, pointB, key);
          this.edges.push(edge);
        }
      }
    }
  }

  /**
   * Generate Voronoi cells from triangulation
   */
  generateVoronoiCells() {
    this.voronoiCells.clear();
    
    // Initialize cells for each point
    for (let i = 0; i < this.points.length; i++) {
      this.voronoiCells.set(i, {
        site: this.points[i],
        siteIndex: i,
        vertices: [],
        neighbors: new Set()
      });
    }

    // Generate Voronoi vertices (circumcenters of triangles)
    this.delaunayCircumcenters = [];
    
    // Track unique circumcenters per cell using Maps
    const cellCircumcenters = new Map(); // cellIndex -> Map of circumcenter keys
    
    for (let i = 0; i < this.triangles.length; i++) {
      const triangle = this.triangles[i];
      const circumcenter = triangle.getCircumcenter();
      this.delaunayCircumcenters.push(circumcenter);
      
      // Add circumcenter as vertex to each triangle vertex's Voronoi cell
      for (const pointIndex of triangle.indices) {
        const cell = this.voronoiCells.get(pointIndex);
        if (cell && circumcenter) {
          // Create a unique key for this circumcenter
          const circumcenterKey = `${circumcenter.x.toFixed(6)}_${circumcenter.z.toFixed(6)}`;
          
          // Initialize the cell's circumcenter tracking if needed
          if (!cellCircumcenters.has(pointIndex)) {
            cellCircumcenters.set(pointIndex, new Map());
          }
          
          const cellCircumcenterMap = cellCircumcenters.get(pointIndex);
          
          // Only add if we haven't seen this circumcenter before
          if (!cellCircumcenterMap.has(circumcenterKey)) {
            cellCircumcenterMap.set(circumcenterKey, i);
            cell.vertices.push({
              x: circumcenter.x,
              z: circumcenter.z,
              triangleIndex: i,
              circumcenter: this.delaunayCircumcenters.length - 1
            });
          }
        }
      }
    }

    // Order vertices counterclockwise for each cell
    for (const [pointIndex, cell] of this.voronoiCells) {
      if (cell.vertices.length > 0) {
        cell.vertices = GeometryUtils.sortCounterclockwise(cell.site, cell.vertices);
      }
      
      // Find neighbors using delaunator's halfedge structure
      this.findCellNeighbors(pointIndex, cell);
    }
    this.getVoronoiEdges()
    this.constructVoronoiEdgeGraph();
  }

  /**
   * Get circumcenter of triangle (delegated to Triangle class)
   * @param {Triangle} triangle - Triangle to get circumcenter for
   * @returns {Point|null} Circumcenter point or null if degenerate
   */
  getCircumcenter(triangle) {
    return triangle ? triangle.getCircumcenter() : null;
  }

  /**
   * Order vertices counterclockwise (delegated to GeometryUtils)
   * @param {Point|Object} center - Center point
   * @param {Array} vertices - Vertices to sort
   * @returns {Array} Sorted vertices
   */
  orderVerticesCounterclockwise(center, vertices) {
    return GeometryUtils.sortCounterclockwise(center, vertices);
  }

  /**
   * Find neighbors for a Voronoi cell
   * @param {number} pointIndex - Point index
   * @param {VoronoiCellData} cell - Cell data
   */
  findCellNeighbors(pointIndex, cell) {
    // Build edge list from triangulation to find direct neighbors
    const triangles = this.delaunay.triangles;
    const edgeSet = new Set();
    
    // Extract all edges from triangles
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i];
      const b = triangles[i + 1];
      const c = triangles[i + 2];
      
      // Add edges (ensuring consistent ordering for deduplication)
      edgeSet.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
      edgeSet.add(`${Math.min(b, c)}-${Math.max(b, c)}`);
      edgeSet.add(`${Math.min(c, a)}-${Math.max(c, a)}`);
    }
    
    // Find edges that include our point
    for (const edge of edgeSet) {
      const [v1, v2] = edge.split('-').map(Number);
      
      if (v1 === pointIndex) {
        cell.neighbors.add(v2);
      } else if (v2 === pointIndex) {
        cell.neighbors.add(v1);
      }
    }
  }

  /**
   * Generate Voronoi edges by connecting adjacent circumcenters
   * @returns {Array<VoronoiEdgeResult>} Array of Voronoi edges
   */
  getVoronoiEdges() {
    const voronoiEdges = [];
    const halfedges = this.delaunay.halfedges;
    const triangles = this.delaunay.triangles;
    
    for (let e = 0; e < halfedges.length; e++) {
      const opposite = halfedges[e];
      if (opposite < 0 || opposite <= e) continue; // Skip boundary edges and avoid duplicates
      
      // If we have valid cell filtering, skip edges involving boundary cells
      if (this.validCellIndices && this.indexMapping) {
        const cellA = triangles[e];
        const cellB = triangles[opposite];
        
        if (!this.validCellIndices.has(cellA) || !this.validCellIndices.has(cellB)) {
          continue; // Skip edges involving boundary cells
        }
      }
      
      const triangleA = Math.floor(e / 3);
      const triangleB = Math.floor(opposite / 3);
      
      const circumcenterA = this.getCircumcenter(this.triangles[triangleA]);
      const circumcenterB = this.getCircumcenter(this.triangles[triangleB]);
      
      if (circumcenterA && circumcenterB) {
        voronoiEdges.push({
          a: circumcenterA,
          b: circumcenterB
        });

        if (!this.voronoiAdjacentCells[triangleA]) {
          this.voronoiAdjacentCells[triangleA] = new Set()
        }

        if (!this.voronoiAdjacentCells[triangleB]) {
          this.voronoiAdjacentCells[triangleB] = new Set()
        }

        this.voronoiAdjacentCells[triangleA].add(triangleB);
        this.voronoiAdjacentCells[triangleB].add(triangleA);

      }
    }
    
    return voronoiEdges;
  }

  /**
   * Get the delaunator instance for advanced operations
   * @returns {Delaunator|null} Delaunator instance or null
   */
  getDelaunator() {
    return this.delaunay;
  }

  /**
   * Helper method to get point by index
   * @param {number} index - Point index
   * @returns {Point|Object|undefined} Point at index or undefined
   */
  getPoint(index) {
    return this.points[index];
  }

  /**
   * Helper method to get triangle containing a point
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {number|null} Triangle index or null if not found
   */
  getTriangleContainingPoint(x, y) {
    if (!this.delaunay) return null;
    
    // Convert coordinates to flat format
    const coords = [];
    for (const point of this.points) {
      coords.push(point.x, point.z || point.y || 0);
    }
    
    // Use delaunator's built-in point location (if available)
    // For now, use simple approach
    for (let i = 0; i < this.triangles.length; i++) {
      const triangle = this.triangles[i];
      if (this.isPointInTriangle(x, y, triangle)) {
        return i;
      }
    }
    
    return null;
  }

  /**
   * Check if a point is inside a triangle
   * @param {number} px - Point X coordinate
   * @param {number} py - Point Y coordinate
   * @param {Triangle} triangle - Triangle to check
   * @returns {boolean} True if point is inside triangle
   */
  isPointInTriangle(px, py, triangle) {
    const ax = triangle.a.x;
    const ay = triangle.a.z || triangle.a.y || 0;
    const bx = triangle.b.x;
    const by = triangle.b.z || triangle.b.y || 0;
    const cx = triangle.c.x;
    const cy = triangle.c.z || triangle.c.y || 0;

    const v0x = cx - ax;
    const v0y = cy - ay;
    const v1x = bx - ax;
    const v1y = by - ay;
    const v2x = px - ax;
    const v2y = py - ay;

    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;

    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return (u >= 0) && (v >= 0) && (u + v <= 1);
  }
}
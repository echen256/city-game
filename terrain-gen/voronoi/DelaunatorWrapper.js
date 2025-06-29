import Delaunator from 'delaunator';

export class DelaunatorWrapper {
  constructor(points) {
    this.points = points;
    this.delaunay = null;
    this.triangles = [];
    this.edges = [];
    this.voronoiCells = new Map();
  }

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
    
    // console.log('DelaunatorWrapper: Input coordinates:', coords);
    // console.log('DelaunatorWrapper: Number of points:', this.points.length);
    
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

  extractTriangles() {
    this.triangles = [];
    const triangleIndices = this.delaunay.triangles;
    
    // console.log('DelaunatorWrapper: Extracting triangles from indices:', triangleIndices);
    
    for (let i = 0; i < triangleIndices.length; i += 3) {
      const aIndex = triangleIndices[i];
      const bIndex = triangleIndices[i + 1];
      const cIndex = triangleIndices[i + 2];
      
      // Validate indices
      if (aIndex >= this.points.length || bIndex >= this.points.length || cIndex >= this.points.length) {
        console.error('DelaunatorWrapper: Invalid triangle indices:', { aIndex, bIndex, cIndex, pointsLength: this.points.length });
        continue;
      }
      
      const triangle = {
        a: this.points[aIndex],
        b: this.points[bIndex],
        c: this.points[cIndex],
        indices: [aIndex, bIndex, cIndex]
      };
      
      this.triangles.push(triangle);
    }
    
    //  console.log('DelaunatorWrapper: Extracted triangles:', this.triangles.length);
  }

  extractEdges() {
    this.edges = [];
    const edgeSet = new Set();
    
    // Extract unique edges from triangles
    for (const triangle of this.triangles) {
      const edges = [
        [triangle.indices[0], triangle.indices[1]],
        [triangle.indices[1], triangle.indices[2]],
        [triangle.indices[2], triangle.indices[0]]
      ];
      
      for (const edge of edges) {
        const [a, b] = edge.sort((x, y) => x - y); // Ensure consistent ordering
        const key = `${a}-${b}`;
        
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          this.edges.push({
            a: this.points[a],
            b: this.points[b],
            indices: [a, b]
          });
        }
      }
    }
  }

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
    const circumcenters = [];
    for (let i = 0; i < this.triangles.length; i++) {
      const triangle = this.triangles[i];
      const circumcenter = this.getCircumcenter(triangle);
      circumcenters.push(circumcenter);
      
      // Add circumcenter as vertex to each triangle vertex's Voronoi cell
      for (const pointIndex of triangle.indices) {
        const cell = this.voronoiCells.get(pointIndex);
        if (cell && circumcenter) {
          cell.vertices.push({
            x: circumcenter.x,
            z: circumcenter.z,
            triangleIndex: i
          });
        }
      }
    }

    // Order vertices counterclockwise for each cell
    for (const [pointIndex, cell] of this.voronoiCells) {
      if (cell.vertices.length > 0) {
        cell.vertices = this.orderVerticesCounterclockwise(cell.site, cell.vertices);
      }
      
      // Find neighbors using delaunator's halfedge structure
      this.findCellNeighbors(pointIndex, cell);
    }
  }

  getCircumcenter(triangle) {
    if (!triangle) {
      return null;
    }
    const ax = triangle.a.x;
    const ay = triangle.a.z || triangle.a.y || 0;
    const bx = triangle.b.x;
    const by = triangle.b.z || triangle.b.y || 0;
    const cx = triangle.c.x;
    const cy = triangle.c.z || triangle.c.y || 0;

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    
    if (Math.abs(d) < 1e-10) {
      console.warn('DelaunatorWrapper: Degenerate triangle detected:', triangle);
      return null; // Degenerate triangle
    }

    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

    return { x: ux, z: uy }; // Keep consistent with z coordinate system
  }

  orderVerticesCounterclockwise(center, vertices) {
    if (vertices.length <= 2) return vertices;

    const cx = center.x;
    const cy = center.z || center.y || 0;

    // Calculate angles from center to each vertex
    const verticesWithAngles = vertices.map(vertex => ({
      vertex,
      angle: Math.atan2(vertex.z - cy, vertex.x - cx)
    }));

    // Sort by angle
    verticesWithAngles.sort((a, b) => a.angle - b.angle);

    return verticesWithAngles.map(item => item.vertex);
  }

  findCellNeighbors(pointIndex, cell) {
    // Use delaunator's halfedge structure to find neighbors
    const halfedges = this.delaunay.halfedges;
    const triangles = this.delaunay.triangles;
    
    // Find all halfedges that start from this point
    for (let e = 0; e < halfedges.length; e++) {
      if (triangles[e] === pointIndex) {
        // Get the endpoint of this halfedge
        const neighborIndex = triangles[e % 3 === 2 ? e - 2 : e + 1];
        cell.neighbors.add(neighborIndex);
      }
    }
  }

  // Generate Voronoi edges by connecting adjacent circumcenters
  getVoronoiEdges() {
    const voronoiEdges = [];
    const halfedges = this.delaunay.halfedges;
    
    for (let e = 0; e < halfedges.length; e++) {
      const opposite = halfedges[e];
      if (opposite > e) continue; // Avoid duplicates
      
      const triangleA = Math.floor(e / 3);
      const triangleB = Math.floor(opposite / 3);
      
      const circumcenterA = this.getCircumcenter(this.triangles[triangleA]);
      const circumcenterB = this.getCircumcenter(this.triangles[triangleB]);
      
      if (circumcenterA && circumcenterB) {
        voronoiEdges.push({
          a: circumcenterA,
          b: circumcenterB
        });
      }
    }
    
    return voronoiEdges;
  }

  // Get the delaunator instance for advanced operations
  getDelaunator() {
    return this.delaunay;
  }

  // Helper method to get point by index
  getPoint(index) {
    return this.points[index];
  }

  // Helper method to get triangle containing a point
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
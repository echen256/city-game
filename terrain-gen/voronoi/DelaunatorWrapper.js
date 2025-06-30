import Delaunator from 'delaunator';

export class DelaunatorWrapper {
  constructor(points) {
    this.points = points;
    this.delaunay = null;
    this.triangles = [];
    this.edges = [];
    this.voronoiCells = new Map();
    this.voronoiAdjacentCells = new Map();
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
    this.delaunayCircumcenters = [];
    
    // Track unique circumcenters per cell using Maps
    const cellCircumcenters = new Map(); // cellIndex -> Map of circumcenter keys
    
    for (let i = 0; i < this.triangles.length; i++) {
      const triangle = this.triangles[i];
      const circumcenter = this.getCircumcenter(triangle);
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

  // Generate Voronoi edges by connecting adjacent circumcenters
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

  // Generate Voronoi edges with adjacent cell information for pathfinding
  // getVoronoiEdgesWithCells(validCellIndices = null, indexMapping = null) {
  //   const voronoiEdges = [];
  //   const halfedges = this.delaunay.halfedges;
  //   const triangles = this.delaunay.triangles;
    
  //   // Use stored mapping if available and no explicit parameters provided
  //   const useValidCells = validCellIndices || this.validCellIndices;
  //   const useMapping = indexMapping || this.indexMapping;
    
  //   for (let e = 0; e < halfedges.length; e++) {
  //     const opposite = halfedges[e];
  //     if (opposite < 0 || opposite <= e) continue; // Skip boundary edges and avoid duplicates
      
  //     // Get the two cells that share this edge
  //     const cellA = triangles[e];
  //     const cellB = triangles[opposite];
      
  //     // If we have valid cell filtering, skip edges that involve boundary cells
  //     if (useValidCells && useMapping) {
  //       if (!useValidCells.has(cellA) || !useValidCells.has(cellB)) {
  //         continue; // Skip edges involving boundary cells
  //       }
        
  //       // Map to new indices
  //       const newCellA = useMapping.get(cellA);
  //       const newCellB = useMapping.get(cellB);
        
  //       const triangleA = Math.floor(e / 3);
  //       const triangleB = Math.floor(opposite / 3);
        
  //       const circumcenterA = this.getCircumcenter(this.triangles[triangleA]);
  //       const circumcenterB = this.getCircumcenter(this.triangles[triangleB]);
        
  //       if (circumcenterA && circumcenterB && newCellA !== newCellB) {
  //         voronoiEdges.push({
  //           edgeStart: circumcenterA,
  //           edgeEnd: circumcenterB,
  //           cellA: newCellA,
  //           cellB: newCellB,
  //           edgeId: `${Math.min(newCellA, newCellB)}-${Math.max(newCellA, newCellB)}`
  //         });
  //       }
  //     } else {
  //       // Original behavior for backward compatibility
  //       const triangleA = Math.floor(e / 3);
  //       const triangleB = Math.floor(opposite / 3);
        
  //       const circumcenterA = this.getCircumcenter(this.triangles[triangleA]);
  //       const circumcenterB = this.getCircumcenter(this.triangles[triangleB]);
        
  //       if (circumcenterA && circumcenterB && cellA !== cellB) {
  //         voronoiEdges.push({
  //           edgeStart: circumcenterA,
  //           edgeEnd: circumcenterB,
  //           cellA: cellA,
  //           cellB: cellB,
  //           edgeId: `${Math.min(cellA, cellB)}-${Math.max(cellA, cellB)}`
  //         });
  //       }
  //     }
  //   }
    
  //   return voronoiEdges;
  // }

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
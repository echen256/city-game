export class DelaunayTriangulation {
  constructor(points) {
    this.points = points;
    this.triangles = [];
    this.edges = [];
    this.circumcenters = [];
  }

  triangulate() {
    if (this.points.length < 3) {
      return { triangles: [], edges: [] };
    }

    // Bowyer-Watson algorithm
    const supertriangle = this.createSupertriangle();
    this.triangles = [supertriangle];

    for (const point of this.points) {
      this.addPoint(point);
    }

    // Remove triangles that contain supertriangle vertices
    this.triangles = this.triangles.filter(triangle => 
      !this.containsSupertriVertices(triangle, supertriangle)
    );

    this.extractEdges();
    this.calculateCircumcenters();
    console.log(this.triangles);
    console.log(this.edges);
    return {
      triangles: this.triangles,
      edges: this.edges,
      circumcenters: this.circumcenters
    };
  }

  createSupertriangle() {
    // Find bounding box of all points
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const point of this.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.z || point.y || 0);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.z || point.y || 0);
    }

    const dx = maxX - minX;
    const dy = maxY - minY;
    const deltaMax = Math.max(dx, dy);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    // Create supertriangle vertices
    const p1 = { x: midX - 20 * deltaMax, z: midY - deltaMax, id: 'super1' };
    const p2 = { x: midX, z: midY + 20 * deltaMax, id: 'super2' };
    const p3 = { x: midX + 20 * deltaMax, z: midY - deltaMax, id: 'super3' };

    return { a: p1, b: p2, c: p3 };
  }

  addPoint(point) {
    const badTriangles = [];
    
    // Find triangles whose circumcircle contains the point
    for (const triangle of this.triangles) {
      if (this.isPointInCircumcircle(point, triangle)) {
        badTriangles.push(triangle);
      }
    }

    // Find the boundary of the polygonal hole
    const polygon = [];
    for (const triangle of badTriangles) {
      const edges = [
        { a: triangle.a, b: triangle.b },
        { a: triangle.b, b: triangle.c },
        { a: triangle.c, b: triangle.a }
      ];

      for (const edge of edges) {
        let isShared = false;
        for (const otherTriangle of badTriangles) {
          if (otherTriangle === triangle) continue;
          if (this.triangleContainsEdge(otherTriangle, edge)) {
            isShared = true;
            break;
          }
        }
        if (!isShared) {
          polygon.push(edge);
        }
      }
    }

    // Remove bad triangles
    this.triangles = this.triangles.filter(triangle => 
      !badTriangles.includes(triangle)
    );

    // Create new triangles from the point to each edge of the polygon
    for (const edge of polygon) {
      const newTriangle = { a: edge.a, b: edge.b, c: point };
      this.triangles.push(newTriangle);
    }
  }

  isPointInCircumcircle(point, triangle) {
    const { a, b, c } = triangle;
    const ax = a.x, ay = a.z || a.y || 0;
    const bx = b.x, by = b.z || b.y || 0;
    const cx = c.x, cy = c.z || c.y || 0;
    const px = point.x, py = point.z || point.y || 0;

    const ax2 = ax * ax, ay2 = ay * ay;
    const bx2 = bx * bx, by2 = by * by;
    const cx2 = cx * cx, cy2 = cy * cy;
    const px2 = px * px, py2 = py * py;

    const det = 
      (ax2 + ay2) * ((by - cy) * px - (bx - cx) * py + bx * cy - by * cx) -
      (bx2 + by2) * ((ay - cy) * px - (ax - cx) * py + ax * cy - ay * cx) +
      (cx2 + cy2) * ((ay - by) * px - (ax - bx) * py + ax * by - ay * bx) -
      (px2 + py2) * ((ay - by) * cx - (ax - bx) * cy + ax * by - ay * bx);

    return det > 0;
  }

  triangleContainsEdge(triangle, edge) {
    const vertices = [triangle.a, triangle.b, triangle.c];
    const edgeVertices = [edge.a, edge.b];
    
    let matches = 0;
    for (const vertex of vertices) {
      for (const edgeVertex of edgeVertices) {
        if (this.pointsEqual(vertex, edgeVertex)) {
          matches++;
          break;
        }
      }
    }
    return matches === 2;
  }

  pointsEqual(p1, p2) {
    const eps = 1e-5;
    const x1 = p1.x, y1 = p1.z || p1.y || 0;
    const x2 = p2.x, y2 = p2.z || p2.y || 0;
    return Math.abs(x1 - x2) < eps && Math.abs(y1 - y2) < eps;
  }

  containsSupertriVertices(triangle, supertriangle) {
    const superVertices = [supertriangle.a, supertriangle.b, supertriangle.c];
    const triangleVertices = [triangle.a, triangle.b, triangle.c];
    
    for (const superVertex of superVertices) {
      for (const vertex of triangleVertices) {
        if (this.pointsEqual(vertex, superVertex)) {
          return true;
        }
      }
    }
    return false;
  }

  extractEdges() {
    this.edges = [];
    const edgeSet = new Set();

    for (const triangle of this.triangles) {
      const edges = [
        { a: triangle.a, b: triangle.b },
        { a: triangle.b, b: triangle.c },
        { a: triangle.c, b: triangle.a }
      ];

      for (const edge of edges) {
        const key = this.getEdgeKey(edge);
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          this.edges.push(edge);
        }
      }
    }
  }

  getEdgeKey(edge) {
    const a = edge.a, b = edge.b;
    const x1 = a.x, y1 = a.z || a.y || 0;
    const x2 = b.x, y2 = b.z || b.y || 0;
    
    // Ensure consistent ordering
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return `${x1},${y1}-${x2},${y2}`;
    } else {
      return `${x2},${y2}-${x1},${y1}`;
    }
  }

  calculateCircumcenters() {
    this.circumcenters = [];
    
    for (const triangle of this.triangles) {
      const circumcenter = this.getCircumcenter(triangle);
      if (circumcenter) {
        this.circumcenters.push(circumcenter);
      }
    }
  }

  getCircumcenter(triangle) {
    const { a, b, c } = triangle;
    const ax = a.x, ay = a.z || a.y || 0;
    const bx = b.x, by = b.z || b.y || 0;
    const cx = c.x, cy = c.z || c.y || 0;

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    
    if (Math.abs(d) < 1e-10) {
      return null; // Degenerate triangle
    }

    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

    return { x: ux, z: uy };
  }
}

export class VoronoiDiagram {
  constructor(triangulation) {
    this.triangulation = triangulation;
    this.cells = new Map();
    this.voronoiEdges = [];
  }

  generateVoronoiCells() {
    const { triangles, circumcenters } = this.triangulation;
    
    // Initialize cells for each original point
    for (const point of this.triangulation.points) {
      this.cells.set(point.id || point, {
        site: point,
        vertices: [],
        neighbors: []
      });
    }

    // For each triangle, connect its circumcenter to adjacent circumcenters
    for (let i = 0; i < triangles.length; i++) {
      const triangle = triangles[i];
      const circumcenter = circumcenters[i];
      
      if (!circumcenter) continue;

      // Add circumcenter as vertex to each of the triangle's vertices' Voronoi cells
      const vertices = [triangle.a, triangle.b, triangle.c];
      for (const vertex of vertices) {
        const cellId = vertex.id || vertex;
        const cell = this.cells.get(cellId);
        if (cell) {
          cell.vertices.push(circumcenter);
        }
      }
    }

    // Order vertices of each cell counterclockwise
    for (const [cellId, cell] of this.cells) {
      if (cell.vertices.length > 0) {
        cell.vertices = this.orderVerticesCounterclockwise(cell.site, cell.vertices);
      }
    }

    // Generate Voronoi edges by connecting adjacent circumcenters
    this.generateVoronoiEdges();

    return this.cells;
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

  generateVoronoiEdges() {
    this.voronoiEdges = [];
    const { triangles, circumcenters } = this.triangulation;

    for (let i = 0; i < triangles.length; i++) {
      const triangle1 = triangles[i];
      const center1 = circumcenters[i];
      
      if (!center1) continue;

      for (let j = i + 1; j < triangles.length; j++) {
        const triangle2 = triangles[j];
        const center2 = circumcenters[j];
        
        if (!center2) continue;

        // Check if triangles share an edge
        if (this.trianglesShareEdge(triangle1, triangle2)) {
          this.voronoiEdges.push({ a: center1, b: center2 });
        }
      }
    }
  }

  trianglesShareEdge(tri1, tri2) {
    const vertices1 = [tri1.a, tri1.b, tri1.c];
    const vertices2 = [tri2.a, tri2.b, tri2.c];
    
    let sharedVertices = 0;
    for (const v1 of vertices1) {
      for (const v2 of vertices2) {
        if (this.pointsEqual(v1, v2)) {
          sharedVertices++;
          break;
        }
      }
    }
    
    return sharedVertices === 2;
  }

  pointsEqual(p1, p2) {
    const eps = 1e-10;
    const x1 = p1.x, y1 = p1.z || p1.y || 0;
    const x2 = p2.x, y2 = p2.z || p2.y || 0;
    return Math.abs(x1 - x2) < eps && Math.abs(y1 - y2) < eps;
  }

  getVoronoiEdges() {
    return this.voronoiEdges;
  }

  getCells() {
    return this.cells;
  }
}
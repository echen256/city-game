import Delaunator from 'delaunator';
import { Edge, Point, GeometryUtils } from '../GeometryTypes.js';

export class DelaunatorWrapper {
  constructor(points, settings) {
    this.points = points;
    this.settings = settings;
    this.delaunay = null;
    this.circumcenters = [];
    this.voronoiCells = new Map();
    this.voronoiEdges = new Map();
    this.voronoiCellVertexMap = new Map();
    // Map of vertex index to array of connected vertex indices
    this.voronoiVertexVertexMap = new Map();
    // Map of vertex index to array of connected edges
    this.voronoiVertexEdgeMap = new Map();
  }

  triangulate() {
    if (this.points.length < 3) {
      console.warn('Not enough points for triangulation');
      return { voronoiCells: new Map() };
    }

    // Convert to flat array for Delaunator
    const coords = [];
    for (const point of this.points) {
      coords.push(point.x, point.z || point.y || 0);
    }

    try {
      this.delaunay = new Delaunator(coords);
    } catch (error) {
      console.error('Triangulation error:', error);
      return { voronoiCells: new Map() };
    }

    // Calculate circumcenters (Delaunator doesn't provide these)
        this.calculateCircumcenters();
    
    // Clamp out-of-bounds circumcenters to grid bounds before generating edges
    this.clampVerticesToBounds();
    
    // Generate Voronoi cells
    this.generateVoronoiCells();

    this.getVoronoiEdges();
    this.findCellsConnectedToVertex();
    this.findConnectedVertices();
    
    return {
      voronoiCells: this.voronoiCells,
      delaunay: this.delaunay
    };
  }

  calculateCircumcenters() {
    const {triangles, coords} = this.delaunay;
    this.circumcenters = [];

    for (let t = 0; t < triangles.length; t += 3) {
      const i = triangles[t] * 2;
      const j = triangles[t + 1] * 2;
      const k = triangles[t + 2] * 2;

      const ax = coords[i];
      const ay = coords[i + 1];
      const bx = coords[j];
      const by = coords[j + 1];
      const cx = coords[k];
      const cy = coords[k + 1];

      const dx = ax - cx;
      const dy = ay - cy;
      const ex = bx - cx;
      const ey = by - cy;

      const bl = dx * dx + dy * dy;
      const cl = ex * ex + ey * ey;
      const d = 0.5 / (dx * ey - dy * ex);

      const x = cx + (ey * bl - dy * cl) * d;
      const y = cy + (dx * cl - ex * bl) * d;

      this.circumcenters.push(new Point(x, y));
    }
  }

  isBoundaryPoint(vertex, tolerance = 0.01) {
    const gridSize = this.settings.gridSize;
    return vertex.x <= tolerance || vertex.x >= gridSize - tolerance || 
           vertex.z <= tolerance || vertex.z >= gridSize - tolerance;
  }

  clampVerticesToBounds() {
    // Use the true grid size from settings instead of calculating from points
    const gridSize = this.settings.gridSize;
    
    // Define bounds as the actual grid boundaries (0 to gridSize)
    const bounds = {
      minX: 0,
      maxX: gridSize,
      minZ: 0,
      maxZ: gridSize
    };

    console.log(`Clamping vertices to true grid bounds: x[${bounds.minX}, ${bounds.maxX}], z[${bounds.minZ}, ${bounds.maxZ}]`);

    // Count vertices before clamping
    const originalCount = this.circumcenters.filter(v => v !== null).length;
    let clampedCount = 0;

    // Clamp circumcenters to true grid bounds
    for (let i = 0; i < this.circumcenters.length; i++) {
      const vertex = this.circumcenters[i];
      if (!vertex) continue;
      
      let wasClamped = false;
      
      // Clamp x coordinate to grid bounds
      if (vertex.x < bounds.minX) {
        vertex.x = bounds.minX;
        wasClamped = true;
      } else if (vertex.x > bounds.maxX) {
        vertex.x = bounds.maxX;
        wasClamped = true;
      }
      
      // Clamp z coordinate to grid bounds
      if (vertex.z < bounds.minZ) {
        vertex.z = bounds.minZ;
        wasClamped = true;
      } else if (vertex.z > bounds.maxZ) {
        vertex.z = bounds.maxZ;
        wasClamped = true;
      }
      
      if (wasClamped) {
        clampedCount++;
      }
    }

    console.log(`Clamped ${clampedCount} out-of-bounds vertices to true grid bounds (${originalCount} total vertices)`);
  }

  generateVoronoiCells() {
    const {triangles, halfedges} = this.delaunay;
    
    // Initialize cells
    for (let i = 0; i < this.points.length; i++) {
      this.voronoiCells.set(i, {
        site: this.points[i],
        siteIndex: i,
        vertices: [],
        neighbors: new Set()
      });
    }

    // For each point, find surrounding triangles to get Voronoi vertices
    for (let p = 0; p < this.points.length; p++) {
      const circum = this.getVoronoiCellVertices(p);
      const cell = this.voronoiCells.get(p);
      
      if (circum.length > 0) {
        cell.vertices = this.orderVerticesCyclically(circum);
      }
      
      // Find neighbors using edges
      this.findNeighborsForPoint(p, cell);
    }
  }

  getVoronoiCellVertices(pointIndex) {
    const {triangles, halfedges} = this.delaunay;
    const vertices = [];
    const seen = new Set();

    // Find a triangle that has this point
    let incoming = -1;
    for (let e = 0; e < triangles.length; e++) {
      if (triangles[e] === pointIndex) {
        incoming = e;
        break;
      }
    }

    if (incoming === -1) return vertices;

    // Walk around the point to find all triangles
    const start = incoming;
    do {
      const t = Math.floor(incoming / 3);
      if (!seen.has(t)) {
        seen.add(t);
        vertices.push(this.circumcenters[t]);
      }

      const outgoing = incoming % 3 === 2 ? incoming - 2 : incoming + 1;
      incoming = halfedges[outgoing];
    } while (incoming !== -1 && incoming !== start);

    return vertices;
  }

  findNeighborsForPoint(pointIndex, cell) {
    const {triangles, halfedges} = this.delaunay;
    
    // Find all edges connected to this point
    for (let e = 0; e < triangles.length; e++) {
      if (triangles[e] === pointIndex) {
        // Check the other two vertices of the triangle
        const t = Math.floor(e / 3) * 3;
        for (let i = 0; i < 3; i++) {
          const neighbor = triangles[t + i];
          const circumcenter = this.circumcenters[neighbor];
  
          if (neighbor === 505) {
            console.log('--------------------------------');
            console.log(circumcenter);
          }
          if (circumcenter.x < 0 || circumcenter.x > this.gridSize || circumcenter.z < 0 || circumcenter.z > this.gridSize) {
            console.log(circumcenter);
            continue;
          }
          if (neighbor !== pointIndex) {
            cell.neighbors.add(neighbor);
          }
        }
      }
    }
  }

  orderVerticesCyclically(vertices) {
    if (!vertices || vertices.length <= 2) {
      return vertices || [];
    }

    const centroid = vertices.reduce((acc, vertex) => {
      const vz = vertex.z !== undefined ? vertex.z : (vertex.y || 0);
      acc.x += vertex.x;
      acc.z += vz;
      return acc;
    }, { x: 0, z: 0 });

    centroid.x /= vertices.length;
    centroid.z /= vertices.length;

    return vertices
      .slice()
      .sort((a, b) => {
        const az = a.z !== undefined ? a.z : (a.y || 0);
        const bz = b.z !== undefined ? b.z : (b.y || 0);
        const angleA = Math.atan2(az - centroid.z, a.x - centroid.x);
        const angleB = Math.atan2(bz - centroid.z, b.x - centroid.x);
        return angleA - angleB;
      });
  }

  // Get Voronoi edges more efficiently using halfedges
  getVoronoiEdges() {
    const {halfedges} = this.delaunay;
    const edges = new Map();
    
    for (let e = 0; e < halfedges.length; e++) {
      const opposite = halfedges[e];
      if (opposite < e) continue; // Avoid duplicates
      
      const t1 = Math.floor(e / 3);
      const t2 = Math.floor(opposite / 3);
      const p1 = this.circumcenters[t1];
      const p2 = this.circumcenters[t2];
      
      // Skip edges involving pruned (null) vertices
      if (!p1 || !p2 || t2 === -1) {
        continue;
      }
      
      const isBoundary1 = this.isBoundaryPoint(p1);
      const isBoundary2 = this.isBoundaryPoint(p2);
      
      // Skip edge if both vertices are boundary points
      if (isBoundary1 && isBoundary2) {
        continue;
      }
      
      const d = p1.distanceTo(p2);
      const edgeKey1 = `${t1}-${t2}`;
      const edgeKey2 = `${t2}-${t1}`;
      
      const e1 = new Edge(
        p1,
        p2,
        edgeKey1,
        d
      );
      const e2 = new Edge(
        p2,
        p1,
        edgeKey2,
        d
      );

      edges.set(edgeKey1, e1); 
      edges.set(edgeKey2, e2);
      
      // Populate voronoiVertexEdgeMap
      if (!this.voronoiVertexEdgeMap.has(t1)) {
        this.voronoiVertexEdgeMap.set(t1, []);
      }
      if (!this.voronoiVertexEdgeMap.has(t2)) {
        this.voronoiVertexEdgeMap.set(t2, []);
      }
      
      this.voronoiVertexEdgeMap.get(t1).push(edgeKey1);
      this.voronoiVertexEdgeMap.get(t2).push(edgeKey2);
    }

    this.voronoiEdges = edges;
  }

  findCellsConnectedToVertex() {  
    for (let i = 0; i < this.circumcenters.length; i++) {
      // Skip pruned (null) vertices
      if (!this.circumcenters[i]) {
        continue;
      }
      
      const connectedCells = new Set();
      const { triangles } = this.delaunay;

      // Find triangles that use this circumcenter
      for (let t = 0; t < triangles.length; t += 3) {
          const triangleIndex = Math.floor(t / 3);
          if (triangleIndex === i) {
              // This triangle corresponds to our vertex
              connectedCells.add(triangles[t]);
              connectedCells.add(triangles[t + 1]);
              connectedCells.add(triangles[t + 2]);
          }
      }
    
      // Only store mapping if there are connected cells
      if (connectedCells.size > 0) {
        this.voronoiCellVertexMap[i] = Array.from(connectedCells).sort((a, b) => a - b);
      }
    }
  }

  findConnectedVertices() {
    for (let vertexIndex = 0; vertexIndex < this.circumcenters.length; vertexIndex++) {
      // Skip pruned (null) vertices
      if (!this.circumcenters[vertexIndex]) {
        continue;
      }
      
      const currentVertex = this.circumcenters[vertexIndex];
      const isCurrentBoundary = this.isBoundaryPoint(currentVertex);
      
      const { halfedges } = this.delaunay;
      const connected = new Set();
      
      // Find all halfedges that share circumcenters with this vertex
      for (let e = 0; e < halfedges.length; e++) {
        const triangleIndex = Math.floor(e / 3);
        if (triangleIndex === vertexIndex) {
          // Find adjacent triangles through halfedges
          const opposite = halfedges[e];
          if (opposite !== -1) {
            const oppositeTriangle = Math.floor(opposite / 3);
            // Only add connection if the connected vertex is also valid
            const circumcenter = this.circumcenters[oppositeTriangle];
            if (circumcenter.x < 0 || circumcenter.x > this.settings.gridSize || circumcenter.z < 0 || circumcenter.z > this.settings.gridSize) {
              continue;
            }
            
            if (this.circumcenters[oppositeTriangle]) {
              const isNeighborBoundary = this.isBoundaryPoint(circumcenter);
              
              // Skip connection if both vertices are boundary points
              if (isCurrentBoundary && isNeighborBoundary) {
                continue;
              }
              
              connected.add(oppositeTriangle);
            }
          }
        }
      }
      
      // Only store mapping if there are valid connections
      if (connected.size > 0) {
        this.voronoiVertexVertexMap[vertexIndex] = Array.from(connected);
      } else {
        delete this.voronoiVertexVertexMap[vertexIndex];
      }
 
    }
  

  }
}

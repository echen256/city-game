import Delaunator from 'delaunator';
import { Edge, Point, GeometryUtils } from '../GeometryTypes.js';

export class DelaunatorWrapper {
  constructor(points) {
    this.points = points;
    this.delaunay = null;
    this.circumcenters = [];
    this.voronoiCells = new Map();
    this.voronoiEdges = new Map();
    this.voronoiCellVertexMap = new Map();
    this.voronoiVertexVertexMap = new Map();
    this.voronoiVertextEdges = new Map();
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
        // Sort vertices counterclockwise
        cell.vertices = this.sortCounterclockwise(cell.site, circum);
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
          if (neighbor !== pointIndex) {
            cell.neighbors.add(neighbor);
          }
        }
      }
    }
  }

  sortCounterclockwise(center, vertices) {
    return vertices.sort((a, b) => {
      const angleA = Math.atan2(a.z - center.z, a.x - center.x);
      const angleB = Math.atan2(b.z - center.z, b.x - center.x);
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
      const d = p1.distanceTo(p2);
      if (t2 !== -1) { 
        const e1 = new Edge(
          p1,
          p2,
          `${t1}-${t2}`,
          d
        );
        const e2 = new Edge(
          p2,
          p1,
          `${t2}-${t1}`,
          d
        );

        edges.set(`${t1}-${t2}`, e1); 
        edges.set(`${t2}-${t1}`, e2);
      }
    }

    this.voronoiEdges = edges;
  }

  findCellsConnectedToVertex() {  
    for (let i = 0; i < this.circumcenters.length; i++) {
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
    
      this.voronoiCellVertexMap[i] = Array.from(connectedCells).sort((a, b) => a - b);
    }
  }

  findConnectedVertices() {
    for (let vertexIndex = 0; vertexIndex < this.circumcenters.length; vertexIndex++) {
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
            connected.add(oppositeTriangle);
          }
        }
      }
      this.voronoiVertexVertexMap[vertexIndex] = Array.from(connected);
    }
  

  }
}
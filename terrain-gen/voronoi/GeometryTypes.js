/**
 * Common geometry types and classes for Voronoi diagram generation
 */

/**
 * Represents a 2D point in space
 * @typedef {Object} IPoint
 * @property {number} x - X coordinate
 * @property {number} z - Z coordinate (using z instead of y for 3D consistency)
 * @property {boolean} [isBoundary] - Whether this point is a boundary point
 */

/**
 * Point class with basic 2D operations
 */
export class Point {
  /**
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {boolean} [isBoundary=false] - Whether this is a boundary point
   */
  constructor(x, z, isBoundary = false) {
    /** @type {number} */
    this.x = x;
    /** @type {number} */
    this.z = z;
    /** @type {boolean} */
    this.isBoundary = isBoundary;
  }

  /**
   * Calculate distance to another point
   * @param {Point|IPoint} other - The other point
   * @returns {number} Distance between points
   */
  distanceTo(other) {
    const dx = this.x - other.x;
    const dz = this.z - (other.z || other.y || 0);
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Create a copy of this point
   * @returns {Point} New point with same coordinates
   */
  clone() {
    return new Point(this.x, this.z, this.isBoundary);
  }

  /**
   * Convert to string representation
   * @returns {string} String representation
   */
  toString() {
    return `Point(${this.x.toFixed(2)}, ${this.z.toFixed(2)})`;
  }
}

/**
 * Represents an edge between two points
 */
export class Edge {
  /**
   * @param {Point|IPoint} pointA - First point
   * @param {Point|IPoint} pointB - Second point
   * @param {string} [id] - Optional edge identifier
   */
  constructor(pointA, pointB, id = null) {
    /** @type {Point|IPoint} */
    this.a = pointA;
    /** @type {Point|IPoint} */
    this.b = pointB;
    /** @type {string|null} */
    this.id = id || `${Math.min(pointA.x, pointB.x)}-${Math.min(pointA.z || pointA.y || 0, pointB.z || pointB.y || 0)}`;
  }

  /**
   * Calculate length of the edge
   * @returns {number} Edge length
   */
  length() {
    const dx = this.b.x - this.a.x;
    const dz = (this.b.z || this.b.y || 0) - (this.a.z || this.a.y || 0);
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Get midpoint of the edge
   * @returns {Point} Midpoint of the edge
   */
  midpoint() {
    const x = (this.a.x + this.b.x) / 2;
    const z = ((this.a.z || this.a.y || 0) + (this.b.z || this.b.y || 0)) / 2;
    return new Point(x, z);
  }

  /**
   * Convert to string representation
   * @returns {string} String representation
   */
  toString() {
    return `Edge(${this.a.toString()} -> ${this.b.toString()})`;
  }
}

/**
 * Represents a triangle with three vertices
 */
export class Triangle {
  /**
   * @param {Point|IPoint} pointA - First vertex
   * @param {Point|IPoint} pointB - Second vertex
   * @param {Point|IPoint} pointC - Third vertex
   * @param {number[]} [indices] - Original point indices
   */
  constructor(pointA, pointB, pointC, indices = []) {
    /** @type {Point|IPoint} */
    this.a = pointA;
    /** @type {Point|IPoint} */
    this.b = pointB;
    /** @type {Point|IPoint} */
    this.c = pointC;
    /** @type {number[]} */
    this.indices = indices;
  }

  /**
   * Calculate the circumcenter of the triangle
   * @returns {Point|null} Circumcenter point or null if degenerate
   */
  getCircumcenter() {
    const ax = this.a.x;
    const ay = this.a.z || this.a.y || 0;
    const bx = this.b.x;
    const by = this.b.z || this.b.y || 0;
    const cx = this.c.x;
    const cy = this.c.z || this.c.y || 0;

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    
    if (Math.abs(d) < 1e-10) {
      console.warn('Triangle: Degenerate triangle detected');
      return null;
    }

    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

    return new Point(ux, uy);
  }

  /**
   * Calculate the area of the triangle
   * @returns {number} Triangle area
   */
  getArea() {
    const ax = this.a.x;
    const ay = this.a.z || this.a.y || 0;
    const bx = this.b.x;
    const by = this.b.z || this.b.y || 0;
    const cx = this.c.x;
    const cy = this.c.z || this.c.y || 0;

    return Math.abs((ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) / 2);
  }

  /**
   * Check if a point is inside the triangle
   * @param {number} px - Point X coordinate
   * @param {number} py - Point Y/Z coordinate
   * @returns {boolean} True if point is inside triangle
   */
  containsPoint(px, py) {
    const ax = this.a.x;
    const ay = this.a.z || this.a.y || 0;
    const bx = this.b.x;
    const by = this.b.z || this.b.y || 0;
    const cx = this.c.x;
    const cy = this.c.z || this.c.y || 0;

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

  /**
   * Convert to string representation
   * @returns {string} String representation
   */
  toString() {
    return `Triangle(${this.a.toString()}, ${this.b.toString()}, ${this.c.toString()})`;
  }
}

/**
 * Represents a half-edge in the triangulation
 */
export class HalfEdge {
  /**
   * @param {number} startVertexIndex - Index of start vertex
   * @param {number} endVertexIndex - Index of end vertex
   * @param {number} triangleIndex - Index of triangle this edge belongs to
   * @param {number} [oppositeIndex] - Index of opposite half-edge
   */
  constructor(startVertexIndex, endVertexIndex, triangleIndex, oppositeIndex = -1) {
    /** @type {number} */
    this.startVertex = startVertexIndex;
    /** @type {number} */
    this.endVertex = endVertexIndex;
    /** @type {number} */
    this.triangle = triangleIndex;
    /** @type {number} */
    this.opposite = oppositeIndex;
  }

  /**
   * Check if this is a boundary edge
   * @returns {boolean} True if boundary edge
   */
  isBoundary() {
    return this.opposite < 0;
  }

  /**
   * Convert to string representation
   * @returns {string} String representation
   */
  toString() {
    return `HalfEdge(${this.startVertex} -> ${this.endVertex}, triangle: ${this.triangle}, opposite: ${this.opposite})`;
  }
}

/**
 * Represents a Voronoi edge between two circumcenters
 */
export class VoronoiEdge {
  /**
   * @param {Point|IPoint} edgeStart - Start point (circumcenter)
   * @param {Point|IPoint} edgeEnd - End point (circumcenter)
   * @param {number} cellA - Index of first adjacent cell
   * @param {number} cellB - Index of second adjacent cell
   * @param {string} [edgeId] - Edge identifier
   */
  constructor(edgeStart, edgeEnd, cellA, cellB, edgeId = null) {
    /** @type {Point|IPoint} */
    this.edgeStart = edgeStart;
    /** @type {Point|IPoint} */
    this.edgeEnd = edgeEnd;
    /** @type {number} */
    this.cellA = cellA;
    /** @type {number} */
    this.cellB = cellB;
    /** @type {string} */
    this.edgeId = edgeId || `${Math.min(cellA, cellB)}-${Math.max(cellA, cellB)}`;
  }

  /**
   * Get the other cell adjacent to this edge
   * @param {number} cellId - Known cell ID
   * @returns {number} Other cell ID
   */
  getOtherCell(cellId) {
    return cellId === this.cellA ? this.cellB : this.cellA;
  }

  /**
   * Calculate edge length
   * @returns {number} Edge length
   */
  length() {
    const dx = this.edgeEnd.x - this.edgeStart.x;
    const dz = (this.edgeEnd.z || this.edgeEnd.y || 0) - (this.edgeStart.z || this.edgeStart.y || 0);
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Convert to string representation
   * @returns {string} String representation
   */
  toString() {
    return `VoronoiEdge(${this.edgeStart.toString()} -> ${this.edgeEnd.toString()}, cells: ${this.cellA}-${this.cellB})`;
  }
}

/**
 * Utility functions for geometry operations
 */
export class GeometryUtils {
  /**
   * Check if two points are approximately equal within epsilon
   * @param {Point|IPoint} a - First point
   * @param {Point|IPoint} b - Second point
   * @param {number} [epsilon=1e-6] - Tolerance
   * @returns {boolean} True if points are approximately equal
   */
  static pointsEqual(a, b, epsilon = 1e-6) {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs((a.z || a.y || 0) - (b.z || b.y || 0));
    return dx < epsilon && dz < epsilon;
  }

  /**
   * Calculate angle between two vectors from origin
   * @param {Point|IPoint} a - First point
   * @param {Point|IPoint} b - Second point
   * @returns {number} Angle in radians
   */
  static angleBetween(a, b) {
    return Math.atan2((b.z || b.y || 0), b.x) - Math.atan2((a.z || a.y || 0), a.x);
  }

  /**
   * Sort points counterclockwise around a center point
   * @param {Point|IPoint} center - Center point
   * @param {Array<Point|IPoint>} points - Points to sort
   * @returns {Array<Point|IPoint>} Sorted points
   */
  static sortCounterclockwise(center, points) {
    const cx = center.x;
    const cy = center.z || center.y || 0;

    const pointsWithAngles = points.map(point => ({
      point,
      angle: Math.atan2((point.z || point.y || 0) - cy, point.x - cx)
    }));

    pointsWithAngles.sort((a, b) => a.angle - b.angle);
    return pointsWithAngles.map(item => item.point);
  }

  /**
   * Create a point from coordinates, handling both y and z conventions
   * @param {number} x - X coordinate
   * @param {number} yz - Y or Z coordinate
   * @param {boolean} [isBoundary=false] - Whether this is a boundary point
   * @returns {Point} New point
   */
  static createPoint(x, yz, isBoundary = false) {
    return new Point(x, yz, isBoundary);
  }
}
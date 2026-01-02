/**
 * Shared helpers for determining when Voronoi geometry touches the map boundary.
 */

/**
 * Determine if a Voronoi vertex (circumcenter) extends outside the map bounds.
 * @param {{x: number, z?: number, y?: number}|null} vertex
 * @param {number} gridSize
 * @returns {boolean}
 */
export function isVertexOutOfBounds(vertex, gridSize) {
  if (!vertex || !Number.isFinite(gridSize)) {
    return false;
  }

  const x = vertex.x;
  const z = vertex.z !== undefined && vertex.z !== null ? vertex.z : (vertex.y ?? 0);

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return true;
  }

  return x < 0 || x > gridSize || z < 0 || z > gridSize;
}

/**
 * Determine if a Voronoi cell should be considered an edge cell.
 * Definition: at least one of its vertices lies outside the map bounds.
 * @param {{vertices?: Array<{x: number, z?: number, y?: number}>}|null} cell
 * @param {number} gridSize
 * @returns {boolean}
 */
export function isEdgeCell(cell, gridSize) {
  if (!cell || !Array.isArray(cell.vertices) || cell.vertices.length === 0) {
    return false;
  }

  return cell.vertices.some((vertex) => isVertexOutOfBounds(vertex, gridSize));
}

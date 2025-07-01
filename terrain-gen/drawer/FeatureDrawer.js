/**
 * FeatureDrawer.js - Draws terrain features on the map canvas
 */
export class FeatureDrawer {
  constructor(canvas, gridSize = 600) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gridSize = gridSize;
  }

  /**
   * Draw a path of coordinates with configurable line style
   * @param {Array<{x: number, z: number}>} path - Array of coordinate points
   * @param {Object} options - Drawing options
   * @param {string} options.color - Line color (default: 'blue')
   * @param {number} options.width - Line width in pixels (default: 3)
   * @param {string} options.lineCap - Line cap style (default: 'round')
   * @param {string} options.lineJoin - Line join style (default: 'round')
   */
  drawPath(path, options = {}) {
    if (!path || path.length < 2) {
      console.warn('Path must contain at least 2 points');
      return;
    }

    const {
      color = 'blue',
      width = 3,
      lineCap = 'round',
      lineJoin = 'round'
    } = options;

    console.log('FeatureDrawer: Drawing path with', path.length, 'points');
    console.log('FeatureDrawer: First point:', path[0]);
    console.log('FeatureDrawer: Last point:', path[path.length - 1]);

    this.ctx.save();
    
    // Set drawing style
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = lineCap;
    this.ctx.lineJoin = lineJoin;

    // Begin drawing the path
    this.ctx.beginPath();
    
    // Move to first point
    const firstPoint = this.worldToCanvas(path[0]);
    console.log('FeatureDrawer: First canvas point:', firstPoint);
    this.ctx.moveTo(firstPoint.x, firstPoint.y);
    
    // Draw lines to subsequent points
    for (let i = 1; i < path.length; i++) {
      const point = this.worldToCanvas(path[i]);
      this.ctx.lineTo(point.x, point.y);
    }
    
    const lastPoint = this.worldToCanvas(path[path.length - 1]);
    console.log('FeatureDrawer: Last canvas point:', lastPoint);
    
    this.ctx.stroke();
    this.ctx.restore();
    
    console.log('FeatureDrawer: Path drawing completed');
  }

  /**
   * Draw multiple paths with the same style
   * @param {Array<Array<{x: number, z: number}>>} paths - Array of path arrays
   * @param {Object} options - Drawing options (same as drawPath)
   */
  drawPaths(paths, options = {}) {
    if (!paths || paths.length === 0) {
      console.warn('No paths provided');
      return;
    }

    paths.forEach(path => {
      this.drawPath(path, options);
    });
  }

  /**
   * Convert world coordinates to canvas coordinates
   * @param {Object} worldPoint - Point with x, z coordinates
   * @returns {Object} Canvas coordinates {x, y}
   */
  worldToCanvas(worldPoint) {
    // Scale world coordinates (0-gridSize) to canvas coordinates (0-canvas.width/height)
    const scaleX = this.canvas.width / this.gridSize;
    const scaleY = this.canvas.height / this.gridSize;
    
    const canvasX = worldPoint.x * scaleX;
    const canvasY = worldPoint.z * scaleY;
    
    return { x: canvasX, y: canvasY };
  }

  /**
   * Clear the entire canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw a single point as a circle
   * @param {Object} point - Point with x, z coordinates
   * @param {Object} options - Drawing options
   * @param {string} options.color - Fill color (default: 'red')
   * @param {number} options.radius - Circle radius (default: 2)
   */
  drawPoint(point, options = {}) {
    const {
      color = 'red',
      radius = 2
    } = options;

    const canvasPoint = this.worldToCanvas(point);

    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(canvasPoint.x, canvasPoint.y, radius, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.restore();
  }

  /**
   * Draw multiple points
   * @param {Array<{x: number, z: number}>} points - Array of points
   * @param {Object} options - Drawing options (same as drawPoint)
   */
  drawPoints(points, options = {}) {
    if (!points || points.length === 0) {
      console.warn('No points provided');
      return;
    }

    points.forEach(point => {
      this.drawPoint(point, options);
    });
  }

  /**
   * Test function to draw a simple diagonal line for debugging
   */
  drawTestLine() {
    console.log('Drawing test line from top-left to bottom-right');
    const testPath = [
      { x: 50, z: 50 },
      { x: 550, z: 550 }
    ];
    this.drawPath(testPath, { color: 'red', width: 5 });
  }
}
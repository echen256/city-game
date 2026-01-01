/**
 * FeatureDrawer.js - Draws terrain features on the map canvas
 */
export class FeatureDrawer {
  constructor(canvas, settings) {
    this.settings = settings;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gridSize = settings.gridSize || 600;
    
    // Event system
    this.eventListeners = new Map();
  }

  /**
   * Add event listener
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to call when event occurs
   */
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to remove
   */
  off(eventName, callback) {
    if (this.eventListeners.has(eventName)) {
      const listeners = this.eventListeners.get(eventName);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   * @param {string} eventName - Name of the event
   * @param {*} data - Data to pass to listeners
   */
  emit(eventName, data) {
    if (this.eventListeners.has(eventName)) {
      const listeners = this.eventListeners.get(eventName);
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error);
        }
      });
    }
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
   * Draw Voronoi cell edges using the superior approach from dashboard
   * @param {Object} options - Drawing options
   * @param {string} options.color - Edge color (default: '#00ff88')
   * @param {number} options.width - Line width (default: 1)
   */
  drawVoronoiEdges( voronoiEdges, options = {}) { 

    const {
      color = '#00ff88',
      width = 1
    } = options;

    if (!voronoiEdges || voronoiEdges.length === 0) {
      console.warn('No Voronoi edges available to draw');
      return;
    }

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;

    const scaleX = this.canvas.width / this.gridSize;
    const scaleZ = this.canvas.height / this.gridSize;

    voronoiEdges.forEach((edge, index) => {
      const startX = edge.a.x * scaleX;
      const startY = edge.a.z * scaleZ;
      const endX = edge.b.x * scaleX;
      const endY = edge.b.z * scaleZ;

      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    });

    this.ctx.restore();
    console.log(`Drew ${voronoiEdges.length} Voronoi edges`);
  }

  /**
   * Draw Voronoi cells with fill colors
   * @param {Map} cells - Voronoi cells
   * @param {Object} options - Drawing options
   */
  drawVoronoiCells(cells, options = {}) {
    if (!cells || cells.size === 0) {
      console.warn('No cells provided to draw');
      return;
    }

    const {
      fillColors = ['#1a1a1a', '#2a2a2a', '#3a3a3a', '#4a4a4a'],
      strokeColor = '#ffffff',
      showIds = false,
      alpha = '40'
    } = options;

    const scaleX = this.canvas.width / this.gridSize;
    const scaleZ = this.canvas.height / this.gridSize;

    this.ctx.save();

    cells.forEach((cell, cellId) => {
      if (cell.vertices.length > 2) {
        // Fill cell
        this.ctx.beginPath();
        this.ctx.moveTo(cell.vertices[0].x * scaleX, cell.vertices[0].z * scaleZ);

        for (let i = 1; i < cell.vertices.length; i++) {
          this.ctx.lineTo(cell.vertices[i].x * scaleX, cell.vertices[i].z * scaleZ);
        }
        this.ctx.closePath();

        // Set fill color with alpha
        const colorIndex = cellId % fillColors.length;
        this.ctx.fillStyle = fillColors[colorIndex] + alpha;
        this.ctx.fill();

        // Draw cell ID if requested
        if (showIds) {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = '10px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(
            cellId.toString(),
            cell.site.x * scaleX,
            (cell.site.z || cell.site.y || 0) * scaleZ
          );
        }
      }
    });

    this.ctx.restore();
    console.log(`Drew ${cells.size} Voronoi cells`);
  }

  /**
   * Draw triangulation edges
   * @param {Object} triangulationData - Triangulation data
   * @param {Object} options - Drawing options
   */
  drawTriangulation(triangulationData, options = {}) {
    if (!triangulationData || !triangulationData.delaunay) {
      console.warn('No triangulation data available');
      return;
    }

    const {
      color = '#888888',
      width = 0.5,
      dashed = true
    } = options;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;

    if (dashed) {
      this.ctx.setLineDash([2, 2]);
    }

    const scaleX = this.canvas.width / this.gridSize;
    const scaleZ = this.canvas.height / this.gridSize;

    const { triangles, coords } = triangulationData.delaunay;

    for (let i = 0; i < triangles.length; i += 3) {
      const aIndex = triangles[i] * 2;
      const bIndex = triangles[i + 1] * 2;
      const cIndex = triangles[i + 2] * 2;

      this.ctx.beginPath();
      this.ctx.moveTo(coords[aIndex] * scaleX, coords[aIndex + 1] * scaleZ);
      this.ctx.lineTo(coords[bIndex] * scaleX, coords[bIndex + 1] * scaleZ);
      this.ctx.lineTo(coords[cIndex] * scaleX, coords[cIndex + 1] * scaleZ);
      this.ctx.closePath();
      this.ctx.stroke();
    }

    this.ctx.setLineDash([]);
    this.ctx.restore();
    console.log(`Drew triangulation with ${triangles.length / 3} triangles`);
  }

  /**
   * Draw site points
   * @param {Array} sites - Array of site points
   * @param {Object} options - Drawing options
   */
  drawSites(sites, options = {}) {
    if (!sites || sites.length === 0) {
      console.warn('No sites provided to draw');
      return;
    }

    const {
      color = '#ff0000',
      radius = 3
    } = options;

    this.ctx.save();
    this.ctx.fillStyle = color;

    const scaleX = this.canvas.width / this.gridSize;
    const scaleZ = this.canvas.height / this.gridSize;

    sites.forEach(site => {
      this.ctx.beginPath();
      this.ctx.arc(
        site.x * scaleX,
        (site.z || site.y || 0) * scaleZ,
        radius,
        0,
        2 * Math.PI
      );
      this.ctx.fill();
    });

    this.ctx.restore();
    console.log(`Drew ${sites.length} site points`);
  }

  /**
   * Draw Voronoi vertices (circumcenters)
   * @param {Array} circumcenters - Array of circumcenter points
   * @param {Object} options - Drawing options
   */
  drawVertices(circumcenters, options = {}) {
    if (!circumcenters || circumcenters.length === 0) {
      console.warn('No vertices provided to draw');
      return;
    }

    const {
      color = '#ff0000',
      radius = 1
    } = options;

    this.ctx.save();
    this.ctx.fillStyle = color;

    const scaleX = this.canvas.width / this.gridSize;
    const scaleZ = this.canvas.height / this.gridSize;

    let drawnCount = 0;
    circumcenters.forEach(circumcenter => {
      if (circumcenter &&
        circumcenter.x >= 0 && circumcenter.z >= 0 &&
        circumcenter.x <= this.gridSize && circumcenter.z <= this.gridSize) {
        this.ctx.beginPath();
        this.ctx.arc(
          circumcenter.x * scaleX,
          circumcenter.z * scaleZ,
          radius,
          0,
          2 * Math.PI
        );
        this.ctx.fill();
        drawnCount++;
      }
    });

    this.ctx.restore();
    console.log(`Drew ${drawnCount} vertices`);
  }

  /**
   * Draw complete Voronoi diagram with all elements
   * @param {Object} map - Map object containing voronoiGenerator
   * @param {Object} options - Drawing options
   */
  drawCompleteDiagram(map, options = {
    backgroundColor: '#0a0a0a',
    showTriangulation: this.settings.showTriangulation,
    showVoronoiEdges: this.settings.showVoronoi,
    showCells: this.settings.showCells,
    showSites: this.settings.showSites,
    showVertices: this.settings.showVertices,
    triangulationColor: '#888888',
    voronoiColor: '#00ff88',
    siteColor: '#ffff00',
    vertexColor: '#ff0000'
  }) {
    const triangulationData = map.voronoiGenerator.delaunatorWrapper;
    // Prepare data for the complete diagram drawing
    const data = {
      cells: map.voronoiGenerator.delaunatorWrapper.voronoiCells,
      sites: map.voronoiGenerator.delaunatorWrapper.points,
      triangulationData: triangulationData
    };
    const {
      backgroundColor = '#0a0a0a',
      showTriangulation = true,
      showVoronoiEdges = true,
      showCells = true,
      showSites = true,
      showVertices = false,
      triangulationColor = '#888888',
      voronoiColor = '#00ff88',
      siteColor = '#ffff00',
      vertexColor = '#ff0000'
    } = options;

    // Clear with background
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw triangulation first (background layer)
    if (showTriangulation && data.triangulationData) {
      this.drawTriangulation(data.triangulationData, {
        color: triangulationColor,
        width: 0.5,
        dashed: true
      });
    }

    // Draw Voronoi edges
    if (showVoronoiEdges) {
      this.drawVoronoiEdges(map.voronoiGenerator.delaunatorWrapper.voronoiEdges, {
        color: voronoiColor,
        width: 1
      });
    }

    // Draw cells
    if (showCells && data.cells) {
      this.drawVoronoiCells(data.cells, {
        fillColors: ['#1a3a1a', '#2a4a2a', '#3a5a3a', '#4a6a4a'],
        alpha: '40'
      });
    }

    // Draw sites
    if (showSites && data.sites) {
      this.drawSites(data.sites, {
        color: siteColor,
        radius: 3
      });
    }

    // Draw vertices last (top layer)
    if (showVertices && data.triangulationData && data.triangulationData.circumcenters) {
      this.drawVertices(data.triangulationData.circumcenters, {
        color: vertexColor,
        radius: 1
      });
    }
  }

  drawCoastlines(map) {
    const showCoastlines = this.settings?.coastlines?.showCoastlines !== false;
    if (!showCoastlines) {
      return;
    }

    const coastlineGenerator = map?.coastlineGenerator;
    const voronoiCells = map?.voronoiGenerator?.delaunatorWrapper?.voronoiCells;
    if (!coastlineGenerator || !voronoiCells) {
      return;
    }

    const coastlines = coastlineGenerator.getCoastlines();
    if (!coastlines || coastlines.length === 0) {
      return;
    }

    const {
      fillColor = 'rgba(0, 136, 255, 0.35)',
      strokeColor = '#0088ff',
      strokeWidth = 1
    } = this.settings.coastlines.graphics || {};

    const scaleX = this.canvas.width / this.gridSize;
    const scaleZ = this.canvas.height / this.gridSize;

    this.ctx.save();
    this.ctx.lineWidth = strokeWidth;

    coastlines.forEach((coastline) => {
      coastline.cells.forEach((cellId) => {
        const cell = voronoiCells.get(cellId);
        if (!cell || !cell.vertices || cell.vertices.length < 3) {
          return;
        }

        this.ctx.beginPath();
        const firstVertex = cell.vertices[0];
        this.ctx.moveTo(firstVertex.x * scaleX, (firstVertex.z || firstVertex.y || 0) * scaleZ);

        for (let i = 1; i < cell.vertices.length; i++) {
          const vertex = cell.vertices[i];
          this.ctx.lineTo(vertex.x * scaleX, (vertex.z || vertex.y || 0) * scaleZ);
        }

        this.ctx.closePath();
        this.ctx.fillStyle = fillColor;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.fill();
        this.ctx.stroke();
      });
    });

    this.ctx.restore();
  }

  drawLakes(map) {
    const showLakes = this.settings?.lakes?.showLakes !== false;
    if (!showLakes) {
      return;
    }

    const lakesGenerator = map?.lakesGenerator;
    const voronoiCells = map?.voronoiGenerator?.delaunatorWrapper?.voronoiCells;
    if (!lakesGenerator || !voronoiCells) {
      return;
    }

    const lakes = lakesGenerator.getLakes();
    if (!lakes || lakes.length === 0) {
      return;
    }

    const {
      fillColor = 'rgba(77, 166, 255, 0.45)',
      strokeColor = '#4da6ff',
      strokeWidth = 1.5
    } = this.settings.lakes.graphics || {};

    const scaleX = this.canvas.width / this.gridSize;
    const scaleZ = this.canvas.height / this.gridSize;

    this.ctx.save();
    this.ctx.lineWidth = strokeWidth;

    lakes.forEach((lake) => {
      lake.cells.forEach((cellId) => {
        const cell = voronoiCells.get(cellId);
        if (!cell || !cell.vertices || cell.vertices.length < 3) {
          return;
        }

        this.ctx.beginPath();
        const firstVertex = cell.vertices[0];
        this.ctx.moveTo(firstVertex.x * scaleX, (firstVertex.z || firstVertex.y || 0) * scaleZ);

        for (let i = 1; i < cell.vertices.length; i++) {
          const vertex = cell.vertices[i];
          this.ctx.lineTo(vertex.x * scaleX, (vertex.z || vertex.y || 0) * scaleZ);
        }

        this.ctx.closePath();
        this.ctx.fillStyle = fillColor;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.fill();
        this.ctx.stroke();
      });
    });

    this.ctx.restore();
  }

  drawRivers(map) {
    if (map.riversGenerator && this.settings.rivers.showRivers) {
      const riverPaths = map.riversGenerator.getRiverPaths();
      if (riverPaths && riverPaths.length > 0) {
        riverPaths.forEach((path, index) => {
          if (path && path.length > 1) {
            // Convert vertex indices to coordinates
            const coordinates = path.map(vertexIndex => {
              const vertex = map.voronoiGenerator.delaunatorWrapper.circumcenters[vertexIndex];
              return vertex ? { x: vertex.x, z: vertex.z || vertex.y || 0 } : null;
            }).filter(coord => coord !== null);

            if (coordinates.length > 1) {
              this.drawPath(coordinates, {
                color: 'blue',
                width: 3
              });
            }
          }
        });
      }
    }
  }


  drawTributaries(map) {
    if (map?.tributariesGenerator && this.settings?.tributaries?.showTributaries) {
      const tributaryPaths = map.tributariesGenerator.getTributaryPaths();
      tributaryPaths.forEach((path, index) => {
        if (path && path.length > 1) {
          const coordinates = path.map(vertexIndex => {
            const vertex = map.voronoiGenerator.delaunatorWrapper.circumcenters[vertexIndex];
            return vertex ? { x: vertex.x, z: vertex.z || vertex.y || 0 } : null;
          }).filter(coord => coord !== null);
          console.log(coordinates);
          if (coordinates.length > 1) {
            this.drawPath(coordinates, {
              color: '#00BFFF', // Bright deep sky blue for tributaries
              width: 2
            });
          }
        }
      });
    }
  }

  drawDiagram(map) {
    console.log('FeatureDrawer: Drawing diagram');
    try {
      // Get triangulation data once

      // Draw complete diagram using FeatureDrawer
      this.drawCompleteDiagram(map);
      this.drawCoastlines(map);
      this.drawLakes(map);
      this.drawRivers(map);
      this.drawTributaries(map);
      
      // Emit 'draw' event after diagram is drawn
      this.emit('draw', { map, timestamp: Date.now() });
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * @typedef {Object} VoronoiImageOptions
 * @property {number} [width=800] - Canvas width
 * @property {number} [height=800] - Canvas height
 * @property {string} [backgroundColor='#000000'] - Background color
 * @property {string[]} [cellFillColors=['#1a1a1a', '#2a2a2a', '#3a3a3a', '#4a4a4a']] - Cell fill colors
 * @property {string} [cellStrokeColor='#ffffff'] - Cell stroke color
 * @property {string} [siteColor='#ff0000'] - Site point color
 * @property {string} [triangulationColor='#888888'] - Triangulation line color
 * @property {string} [voronoiColor='#00ff88'] - Voronoi edge color
 * @property {string} [coastalColor='#0088ff'] - Coastal cell color
 * @property {string} [marshColor='#2d5016'] - Marsh cell color
 * @property {string} [riverColor='#4da6ff'] - River cell color
 * @property {boolean} [showSites=true] - Whether to show site points
 * @property {boolean} [showCellBorders=true] - Whether to show cell borders
 * @property {boolean} [showCellIds=false] - Whether to show cell IDs
 * @property {boolean} [showTriangulation=true] - Whether to show triangulation
 * @property {boolean} [showVoronoiEdges=true] - Whether to show Voronoi edges
 * @property {boolean} [showVertices=false] - Whether to show Voronoi vertices
 * @property {boolean} [showCoastalCells=true] - Whether to show coastal cells
 * @property {boolean} [showHeightGradient=true] - Whether to show height gradient
 * @property {boolean} [showLakes=true] - Whether to show lakes
 * @property {boolean} [showMarshes=true] - Whether to show marshes
 * @property {boolean} [showRivers=true] - Whether to show rivers
 * @property {number} [lineWidth=1] - Line width for edges
 * @property {number} [siteRadius=3] - Radius for site points
 */

/**
 * @typedef {Object} TriangulationData
 * @property {Array<Object>} triangles - Array of triangle objects
 * @property {Array<Object>} delaunayCircumcenters - Array of circumcenter points
 * @property {Array<Object>} edges - Array of edge objects
 * @property {Map<number, Object>} voronoiCells - Map of Voronoi cells
 */

/**
 * @typedef {Object} VoronoiCell
 * @property {Object} site - Cell site point {x, z}
 * @property {number} id - Cell ID
 * @property {Array<Object>} vertices - Cell vertices
 * @property {Array<number>} neighbors - Neighbor cell IDs
 * @property {number} area - Cell area
 * @property {number} perimeter - Cell perimeter
 * @property {Array<Object>} affectedTiles - Affected tiles
 * @property {Object} metadata - Cell metadata
 */

/**
 * @typedef {Object} VoronoiSite
 * @property {number} x - X coordinate
 * @property {number} z - Z coordinate
 * @property {number} [y] - Y coordinate (alternative)
 */

/**
 * Exports Voronoi diagrams as images with various visualization options
 */
export class VoronoiImageExporter {
  /**
   * @param {Object} voronoiGenerator - The Voronoi generator instance
   * @param {Object} settings - Generator settings
   */
  constructor(voronoiGenerator, settings) {
    /** @type {Object} */
    this.voronoiGenerator = voronoiGenerator;
    /** @type {Object} */
    this.settings = settings;
    /** @type {HTMLCanvasElement|null} */
    this.canvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this.ctx = null;
    /** @type {Object|null} */
    this.coastlineGenerator = null;
    /** @type {Object|null} */
    this.hillsGenerator = null;
    /** @type {Object|null} */
    this.lakesGenerator = null;
    /** @type {Object|null} */
    this.marshGenerator = null;
    /** @type {Object|null} */
    this.riversGenerator = null;
  }

  /**
   * @param {Object} coastlineGenerator - Coastline generator instance
   */
  setCoastlineGenerator(coastlineGenerator) {
    this.coastlineGenerator = coastlineGenerator;
  }

  /**
   * @param {Object} hillsGenerator - Hills generator instance
   */
  setHillsGenerator(hillsGenerator) {
    this.hillsGenerator = hillsGenerator;
  }

  /**
   * @param {Object} lakesGenerator - Lakes generator instance
   */
  setLakesGenerator(lakesGenerator) {
    this.lakesGenerator = lakesGenerator;
  }

  /**
   * @param {Object} marshGenerator - Marsh generator instance
   */
  setMarshGenerator(marshGenerator) {
    this.marshGenerator = marshGenerator;
  }

  /**
   * @param {Object} riversGenerator - Rivers generator instance
   */
  setRiversGenerator(riversGenerator) {
    this.riversGenerator = riversGenerator;
  }

  /**
   * Get coastal color with depth variation
   * @param {string} baseColor - Base hex color
   * @param {number} depth - Coastal depth
   * @returns {string} Color with depth variation
   */
  getCoastalColorByDepth(baseColor, depth) {
    // Parse hex color (e.g., "#0088ff")
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate lightness factor based on depth
    // Depth 0 (edge): full saturation (opacity 80)
    // Depth 1+: progressively lighter (higher opacity, lighter color)
    const maxDepth = 5; // Max depth for color scaling
    const normalizedDepth = Math.min(depth, maxDepth) / maxDepth;
    
    // Lighten the color for higher depths
    const lightnessFactor = 1 + (normalizedDepth * 0.4); // Up to 40% lighter
    const newR = Math.min(255, Math.floor(r * lightnessFactor));
    const newG = Math.min(255, Math.floor(g * lightnessFactor));
    const newB = Math.min(255, Math.floor(b * lightnessFactor));
    
    // Vary opacity: depth 0 = 80 (0x50), higher depths = 60 (0x3C)
    const opacity = depth === 0 ? '80' : '60';
    
    // Convert back to hex
    const newHex = '#' + 
      newR.toString(16).padStart(2, '0') +
      newG.toString(16).padStart(2, '0') +
      newB.toString(16).padStart(2, '0') +
      opacity;
    
    return newHex;
  }

  /**
   * Get height-based color
   * @param {number} height - Height value (0-100)
   * @returns {string} Grayscale color with transparency
   */
  getHeightColor(height) {
    // Convert height (0-100) to grayscale color
    // Height 0 = dark gray (#2a2a2a)
    // Height 100 = light gray (#d0d0d0)
    const maxHeight = 100;
    const normalizedHeight = Math.min(height, maxHeight) / maxHeight;
    
    // Map to gray range: 42 (dark) to 208 (light)
    const minGray = 42;   // #2a2a2a
    const maxGray = 208;  // #d0d0d0
    const grayValue = Math.floor(minGray + (normalizedHeight * (maxGray - minGray)));
    
    // Add transparency based on height (higher = more opaque)
    const opacity = Math.floor(128 + (normalizedHeight * 96)); // 80-E0 range
    
    // Convert to hex
    const grayHex = grayValue.toString(16).padStart(2, '0');
    const opacityHex = opacity.toString(16).padStart(2, '0');
    
    return `#${grayHex}${grayHex}${grayHex}${opacityHex}`;
  }

  /**
   * Get lake color with depth variation
   * @param {number} depth - Lake depth (5-50)
   * @returns {string} Blue color with depth variation
   */
  getLakeColor(depth) {
    // Convert depth (5-50) to blue color
    // Depth 5 = light blue (#4da6ff)
    // Depth 50 = dark blue (#003366)
    const maxDepth = 50;
    const minDepth = 5;
    const normalizedDepth = Math.min(Math.max(depth, minDepth), maxDepth);
    const depthFactor = (normalizedDepth - minDepth) / (maxDepth - minDepth);
    
    // Interpolate between light blue and dark blue
    const lightBlue = { r: 77, g: 166, b: 255 };  // #4da6ff
    const darkBlue = { r: 0, g: 51, b: 102 };     // #003366
    
    const r = Math.floor(lightBlue.r + (darkBlue.r - lightBlue.r) * depthFactor);
    const g = Math.floor(lightBlue.g + (darkBlue.g - lightBlue.g) * depthFactor);
    const b = Math.floor(lightBlue.b + (darkBlue.b - lightBlue.b) * depthFactor);
    
    // Add transparency based on depth (deeper = more opaque)
    const opacity = Math.floor(160 + (depthFactor * 64)); // A0-E0 range
    
    // Convert to hex
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');
    const opacityHex = opacity.toString(16).padStart(2, '0');
    
    return `#${rHex}${gHex}${bHex}${opacityHex}`;
  }

  /**
   * Get marsh color with transparency
   * @param {string} baseColor - Base marsh color
   * @returns {string} Marsh color with transparency
   */
  getMarshColor(baseColor) {
    // Parse the base marsh color and add transparency
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Add transparency for marshes
    const opacity = 'C0'; // 75% opacity
    
    return `#${hex}${opacity}`;
  }

  /**
   * Get river color with transparency
   * @param {string} baseColor - Base river color
   * @returns {string} River color with transparency
   */
  getRiverColor(baseColor) {
    // Parse the base river color and add transparency
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Add transparency for rivers (more opaque than marshes)
    const opacity = 'D0'; // 82% opacity
    
    return `#${hex}${opacity}`;
  }

  /**
   * Create canvas element for image generation
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {HTMLCanvasElement} Created canvas element
   */
  createCanvas(width, height) {
    // Create canvas element for image generation
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    return this.canvas;
  }

  /**
   * Generate diagram image with all visualization options
   * @param {Map<number, VoronoiCell>} cells - Voronoi cells
   * @param {Array<VoronoiSite>} sites - Voronoi sites
   * @param {TriangulationData|null} triangulationData - Triangulation data
   * @param {VoronoiImageOptions} options - Rendering options
   * @returns {HTMLCanvasElement} Generated canvas
   */
  generateDiagramImage(cells, sites, triangulationData = null, options = {}) {
    const {
      width = 800,
      height = 800,
      backgroundColor = '#000000',
      cellFillColors = ['#1a1a1a', '#2a2a2a', '#3a3a3a', '#4a4a4a'],
      cellStrokeColor = '#ffffff',
      siteColor = '#ff0000',
      triangulationColor = '#888888',
      voronoiColor = '#00ff88',
      coastalColor = '#0088ff',
      marshColor = '#2d5016',
      riverColor = '#4da6ff',
      showSites = true,
      showCellBorders = true,
      showCellIds = false,
      showTriangulation = true,
      showVoronoiEdges = true,
      showVertices = false,
      showCoastalCells = true,
      showHeightGradient = true,
      showLakes = true,
      showMarshes = true,
      showRivers = true,
      lineWidth = 1,
      siteRadius = 3
    } = options;

    this.createCanvas(width, height);
    
    // Clear canvas with background color
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    const scaleX = width / this.settings.gridSize;
    const scaleZ = height / this.settings.gridSize;

    // Draw triangulation first (if enabled)
    if (showTriangulation && triangulationData) {
      this.ctx.strokeStyle = triangulationColor;
      this.ctx.lineWidth = lineWidth * 0.5;
      this.ctx.setLineDash([2, 2]); // Dashed lines for triangulation
      
      if (triangulationData.triangles) {
        triangulationData.triangles.forEach(triangle => {
          this.ctx.beginPath();
          this.ctx.moveTo(triangle.a.x * scaleX, (triangle.a.z || triangle.a.y || 0) * scaleZ);
          this.ctx.lineTo(triangle.b.x * scaleX, (triangle.b.z || triangle.b.y || 0) * scaleZ);
          this.ctx.lineTo(triangle.c.x * scaleX, (triangle.c.z || triangle.c.y || 0) * scaleZ);
          this.ctx.closePath();
          this.ctx.stroke();
        });
      }
      
      this.ctx.setLineDash([]); // Reset line dash
    }

    // Draw Voronoi edges (if enabled)
    if (showVoronoiEdges && this.voronoiGenerator.getVoronoiDiagram()) {
      const delaunatorWrapper = this.voronoiGenerator.getVoronoiDiagram();
      const voronoiEdges = delaunatorWrapper.getVoronoiEdges();
      
      this.ctx.strokeStyle = voronoiColor;
      this.ctx.lineWidth = lineWidth;
      
      voronoiEdges.forEach((edge, index) => {
        const startX = edge.a.x * scaleX;
        const startY = edge.a.z * scaleZ;
        const endX = edge.b.x * scaleX;
        const endY = edge.b.z * scaleZ;
        
        // // Debug logging for zero or negative coordinates
        // if (startX <= 0 || startY <= 0 || endX <= 0 || endY <= 0) {
        //   console.warn(`VoronoiImageExporter: Edge ${index} has zero/negative coordinates:`);
        //   console.warn(`  Start: (${edge.a.x}, ${edge.a.z}) -> Scaled: (${startX}, ${startY})`);
        //   console.warn(`  End: (${edge.b.x}, ${edge.b.z}) -> Scaled: (${endX}, ${endY})`);
        //   console.warn(`  Scale factors: scaleX=${scaleX}, scaleZ=${scaleZ}`);
        // }
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
      });
    }

    // Draw cells
    cells.forEach((cell, cellId) => {
      if (cell.vertices.length > 2) {
        // Fill cell with transparency
        this.ctx.beginPath();
        this.ctx.moveTo(cell.vertices[0].x * scaleX, cell.vertices[0].z * scaleZ);
        
        for (let i = 1; i < cell.vertices.length; i++) {
          this.ctx.lineTo(cell.vertices[i].x * scaleX, cell.vertices[i].z * scaleZ);
        }
        this.ctx.closePath();

        // Determine cell color based on features (priority order: lakes > rivers > coastal > marshes > height > default)
        const isLake = this.lakesGenerator && this.lakesGenerator.isLakeCell(cellId);
        const isRiver = this.riversGenerator && this.riversGenerator.isRiverCell(cellId);
        const isCoastal = this.coastlineGenerator && this.coastlineGenerator.isCoastal(cellId);
        const isMarsh = this.marshGenerator && this.marshGenerator.isMarshCell(cellId);
        const hasHeight = this.hillsGenerator && this.hillsGenerator.getCellHeight(cellId) > 0;
        
        if (isLake && showLakes) {
          // Lake cells - blue with depth variation (highest priority)
          const depth = this.lakesGenerator.getLakeDepth(cellId);
          const lakeColor = this.getLakeColor(depth);
          this.ctx.fillStyle = lakeColor;
        } else if (isRiver && showRivers) {
          // River cells - light blue (second priority)
          const riverColorWithAlpha = this.getRiverColor(riverColor);
          this.ctx.fillStyle = riverColorWithAlpha;
        } else if (isCoastal && showCoastalCells) {
          // Coastal cells - blue with depth variation
          const depth = this.coastlineGenerator.getCoastalDepth(cellId);
          const coastalColorWithDepth = this.getCoastalColorByDepth(coastalColor, depth);
          this.ctx.fillStyle = coastalColorWithDepth;
        } else if (isMarsh && showMarshes) {
          // Marsh cells - dark green
          const marshColorWithAlpha = this.getMarshColor(marshColor);
          this.ctx.fillStyle = marshColorWithAlpha;
        } else if (hasHeight && showHeightGradient) {
          // Height-based cells - gray gradient
          const height = this.hillsGenerator.getCellHeight(cellId);
          const heightColor = this.getHeightColor(height);
          this.ctx.fillStyle = heightColor;
        } else {
          // Default cells - use standard color scheme
          const colorIndex = cellId % cellFillColors.length;
          this.ctx.fillStyle = cellFillColors[colorIndex] + '40'; // Add alpha
        }
        this.ctx.fill();

        // Draw cell ID
        if (showCellIds) {
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

    // Draw sites
    if (showSites) {
      this.ctx.fillStyle = siteColor;
      sites.forEach(site => {
        this.ctx.beginPath();
        this.ctx.arc(
          site.x * scaleX,
          (site.z || site.y || 0) * scaleZ,
          siteRadius,
          0,
          2 * Math.PI
        );
        this.ctx.fill();
      });
    }

    // Draw Voronoi vertices (circumcenters) as red dots
    if (showVertices && triangulationData) {
      if (triangulationData.delaunayCircumcenters) {
        this.ctx.fillStyle = '#ff0000'; // Red color for vertices
        const vertexRadius = 1; // 5px radius for 10px diameter
        
        triangulationData.delaunayCircumcenters.forEach(circumcenter => {
          if (circumcenter) {
            this.ctx.beginPath();
            this.ctx.arc(
              circumcenter.x * scaleX,
              circumcenter.z * scaleZ,
              vertexRadius,
              0,
              2 * Math.PI
            );
            this.ctx.fill();
          }
        });
      }
    }

    // Draw river start and end points as small red dots
    if (showRivers) {
      const riverStartEndRadius = 10; // Small radius for start/end points
      
      // Draw all marked start and end points
      cells.forEach((cell, cellId) => {
        const isStartPoint = cell.getMetadata('riverStartPoint');
        const isEndPoint = cell.getMetadata('riverEndPoint');
        
        if ((isStartPoint || isEndPoint) && cell.site) {
          this.ctx.fillStyle = '#ff0000'; // Red color
          this.ctx.beginPath();
          this.ctx.arc(
            cell.site.x * scaleX,
            (cell.site.z || cell.site.y || 0) * scaleZ,
            riverStartEndRadius,
            0,
            2 * Math.PI
          );
          this.ctx.fill();
          
          // Add white border for better visibility
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 4;
          this.ctx.stroke();
          
          // Add text label to distinguish start vs end
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = 'bold 8px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          const label = isStartPoint ? 'S' : 'E';
          this.ctx.fillText(
            label,
            cell.site.x * scaleX,
            (cell.site.z || cell.site.y || 0) * scaleZ
          );
        }
      });
    }

    return this.canvas;
  }

  /**
   * Export canvas as data URL
   * @param {string} [format='image/png'] - Image format
   * @returns {string} Data URL
   * @throws {Error} If no canvas is created
   */
  exportAsDataURL(format = 'image/png') {
    if (!this.canvas) {
      throw new Error('No canvas created. Call generateDiagramImage first.');
    }
    return this.canvas.toDataURL(format);
  }

  /**
   * Export canvas as blob
   * @param {string} [format='image/png'] - Image format
   * @returns {Promise<Blob>} Promise resolving to blob
   * @throws {Error} If no canvas is created
   */
  async exportAsBlob(format = 'image/png') {
    if (!this.canvas) {
      throw new Error('No canvas created. Call generateDiagramImage first.');
    }
    
    return new Promise((resolve) => {
      this.canvas.toBlob(resolve, format);
    });
  }

  /**
   * Save canvas to file
   * @param {string} filename - Output filename
   * @param {string} [format='image/png'] - Image format
   * @returns {Promise<void>}
   */
  async saveToFile(filename, format = 'image/png') {
    const blob = await this.exportAsBlob(format);
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  }

  /**
   * Generate variation images with different settings
   * @param {Object} baseSettings - Base settings for generation
   * @param {string} [outputPath='terrain-gen/voronoi/output/'] - Output path
   * @returns {Array<Object>} Array of variation results
   */
  generateVariationImages(baseSettings, outputPath = 'terrain-gen/voronoi/output/') {
    /** @type {Array<Object>} */
    const variations = [
      {
        name: 'seed_001',
        settings: {
          ...baseSettings,
          seed: 12345
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#1a3a1a', '#2a4a2a', '#3a5a3a', '#4a6a4a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#ffff00',
          triangulationColor: '#666666',
          voronoiColor: '#00ff88',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      },
      {
        name: 'seed_002',
        settings: {
          ...baseSettings,
          seed: 23456
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#3a1a1a', '#4a2a2a', '#5a3a3a', '#6a4a4a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#ff6666',
          triangulationColor: '#666666',
          voronoiColor: '#ff0088',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      },
      {
        name: 'seed_003',
        settings: {
          ...baseSettings,
          seed: 34567
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#1a1a3a', '#2a2a4a', '#3a3a5a', '#4a4a6a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#6666ff',
          triangulationColor: '#666666',
          voronoiColor: '#0088ff',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      },
      {
        name: 'seed_004',
        settings: {
          ...baseSettings,
          seed: 45678
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#2a1a2a', '#3a2a3a', '#4a3a4a', '#5a4a5a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#ff66ff',
          triangulationColor: '#666666',
          voronoiColor: '#ff00ff',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      },
      {
        name: 'seed_005',
        settings: {
          ...baseSettings,
          seed: 56789
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#1a2a1a', '#2a3a2a', '#3a4a3a', '#4a5a4a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#66ff66',
          triangulationColor: '#666666',
          voronoiColor: '#00ff00',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      },
      {
        name: 'seed_006',
        settings: {
          ...baseSettings,
          seed: 67890
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#2a2a1a', '#3a3a2a', '#4a4a3a', '#5a5a4a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#ffff66',
          triangulationColor: '#666666',
          voronoiColor: '#ffff00',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      },
      {
        name: 'seed_007',
        settings: {
          ...baseSettings,
          seed: 78901
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#1a2a2a', '#2a3a3a', '#3a4a4a', '#4a5a5a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#66ffff',
          triangulationColor: '#666666',
          voronoiColor: '#00ffff',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      },
      {
        name: 'seed_008',
        settings: {
          ...baseSettings,
          seed: 89012
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#2a1a1a', '#3a2a2a', '#4a3a3a', '#5a4a4a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#ff8866',
          triangulationColor: '#666666',
          voronoiColor: '#ff4400',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      },
      {
        name: 'seed_009',
        settings: {
          ...baseSettings,
          seed: 90123
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#1a1a2a', '#2a2a3a', '#3a3a4a', '#4a4a5a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#8866ff',
          triangulationColor: '#666666',
          voronoiColor: '#4400ff',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      },
      {
        name: 'seed_010',
        settings: {
          ...baseSettings,
          seed: 10234
        },
        colors: {
          backgroundColor: '#0a0a0a',
          cellFillColors: ['#1a2a1a', '#2a3a2a', '#3a4a3a', '#4a5a4a'],
          cellStrokeColor: '#ffffff',
          siteColor: '#88ff66',
          triangulationColor: '#666666',
          voronoiColor: '#44ff00',
          showTriangulation: true,
          showVoronoiEdges: true
        }
      }
    ];

    /** @type {Array<Object>} */
    const results = [];

    variations.forEach((variation, index) => {
      console.log(`Generating variation ${index + 1}/10: ${variation.name}`);
      
      // Create new voronoi generator with variation settings
      const tempSettings = { ...this.settings, voronoi: variation.settings };
      const tempGenerator = new (this.voronoiGenerator.constructor)(null, tempSettings);
      
      // Generate voronoi diagram
      tempGenerator.generateSeedPoints(variation.settings);
      tempGenerator.calculateVoronoiDiagram();
      
      // Store reference to generator for triangulation access
      this.voronoiGenerator = tempGenerator;
      
      // Generate image
      const canvas = this.generateDiagramImage(
        tempGenerator.getCells(),
        tempGenerator.sites,
        tempGenerator.getTriangulation(),
        {
          width: 800,
          height: 800,
          showSites: true,
          showCellBorders: true,
          showCellIds: false,
          lineWidth: 1,
          siteRadius: 3,
          ...variation.colors
        }
      );

      results.push({
        name: variation.name,
        canvas: canvas,
        dataURL: this.exportAsDataURL(),
        settings: variation.settings,
        stats: {
          numCells: tempGenerator.getCells().size,
          numSites: tempGenerator.sites.length
        }
      });
    });

    return results;
  }
}
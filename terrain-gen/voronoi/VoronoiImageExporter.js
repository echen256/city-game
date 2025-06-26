export class VoronoiImageExporter {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.canvas = null;
    this.ctx = null;
    this.coastlineGenerator = null;
  }

  setCoastlineGenerator(coastlineGenerator) {
    this.coastlineGenerator = coastlineGenerator;
  }

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

  createCanvas(width, height) {
    // Create canvas element for image generation
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    return this.canvas;
  }

  generateDiagramImage(cells, sites, options = {}) {
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
      showSites = true,
      showCellBorders = true,
      showCellIds = false,
      showTriangulation = true,
      showVoronoiEdges = true,
      showCoastalCells = true,
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
    if (showTriangulation && this.voronoiGenerator.getTriangulation()) {
      const delaunatorWrapper = this.voronoiGenerator.getTriangulation();
      this.ctx.strokeStyle = triangulationColor;
      this.ctx.lineWidth = lineWidth * 0.5;
      this.ctx.setLineDash([2, 2]); // Dashed lines for triangulation
      
      if (delaunatorWrapper.triangles) {
        delaunatorWrapper.triangles.forEach(triangle => {
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
      
      voronoiEdges.forEach(edge => {
        this.ctx.beginPath();
        this.ctx.moveTo(edge.a.x * scaleX, edge.a.z * scaleZ);
        this.ctx.lineTo(edge.b.x * scaleX, edge.b.z * scaleZ);
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

        // Check if cell is coastal and use appropriate color
        const isCoastal = this.coastlineGenerator && this.coastlineGenerator.isCoastal(cellId);
        
        if (isCoastal && showCoastalCells) {
          // Get coastal depth for color variation
          const depth = this.coastlineGenerator.getCoastalDepth(cellId);
          const coastalColorWithDepth = this.getCoastalColorByDepth(coastalColor, depth);
          this.ctx.fillStyle = coastalColorWithDepth;
        } else {
          // Choose fill color based on cell ID with transparency
          const colorIndex = cellId % cellFillColors.length;
          this.ctx.fillStyle = cellFillColors[colorIndex] + '40'; // Add alpha
        }
        this.ctx.fill();

        // Draw cell border
        if (showCellBorders) {
          this.ctx.strokeStyle = cellStrokeColor;
          this.ctx.lineWidth = lineWidth * 0.8;
          this.ctx.stroke();
        }

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

    return this.canvas;
  }

  exportAsDataURL(format = 'image/png') {
    if (!this.canvas) {
      throw new Error('No canvas created. Call generateDiagramImage first.');
    }
    return this.canvas.toDataURL(format);
  }

  async exportAsBlob(format = 'image/png') {
    if (!this.canvas) {
      throw new Error('No canvas created. Call generateDiagramImage first.');
    }
    
    return new Promise((resolve) => {
      this.canvas.toBlob(resolve, format);
    });
  }

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

  generateVariationImages(baseSettings, outputPath = 'terrain-gen/voronoi/output/') {
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
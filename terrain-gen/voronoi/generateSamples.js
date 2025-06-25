import { VoronoiGenerator } from './VoronoiGenerator.js';
import { VoronoiImageExporter } from './VoronoiImageExporter.js';

// Sample generation script for creating 10 voronoi diagrams
export function generateVoronoiSamples() {
  console.log('Starting Voronoi sample generation...');

  // Base settings for voronoi generation
  const baseSettings = {
    gridSize: 300,
    voronoi: {
      enabled: true,
      numSites: 50,
      distribution: 'poisson',
      minDistance: 10,
      poissonRadius: 20,
      gridSpacing: 30,
      seed: 12345
    }
  };

  // Create a mock terrain data object for the generator
  const mockTerrainData = {
    features: new Map(),
    featureCounter: 0,
    createFeature: function(type) {
      const id = `${type}_${++this.featureCounter}`;
      const feature = {
        id,
        type,
        centroid: { x: 0, z: 0 },
        bezierCurves: [],
        pointDistributions: [],
        affectedTiles: [],
        metadata: {},
        setCentroid: function(x, z) { this.centroid = { x, z }; return this; },
        addBezierCurve: function(curve) { this.bezierCurves.push(curve); return this; },
        addPointDistribution: function(points) { this.pointDistributions.push(points); return this; },
        addAffectedTile: function(x, z) { this.affectedTiles.push({ x, z }); return this; },
        setMetadata: function(key, value) { this.metadata[key] = value; return this; },
        getMetadata: function(key) { return this.metadata[key]; }
      };
      this.features.set(id, feature);
      return feature;
    },
    getFeaturesByType: function(type) {
      return Array.from(this.features.values()).filter(f => f.type === type);
    }
  };

  // Create voronoi generator and image exporter
  const voronoiGenerator = new VoronoiGenerator(mockTerrainData, baseSettings);
  const imageExporter = new VoronoiImageExporter(voronoiGenerator, baseSettings);

  // Generate all variations
  const results = imageExporter.generateVariationImages(baseSettings.voronoi);

  // Create HTML page to display results
  const htmlContent = generateResultsHTML(results);
  
  return {
    results,
    htmlContent,
    totalGenerated: results.length
  };
}

function generateResultsHTML(results) {
  const resultCards = results.map((result, index) => `
    <div class="result-card">
      <h3>${result.name.replace(/_/g, ' ').toUpperCase()}</h3>
      <div class="image-container">
        <img src="${result.dataURL}" alt="${result.name}" />
      </div>
      <div class="stats">
        <p><strong>Cells:</strong> ${result.stats.numCells}</p>
        <p><strong>Sites:</strong> ${result.stats.numSites}</p>
        <p><strong>Distribution:</strong> ${result.settings.distribution}</p>
        ${result.settings.numSites ? `<p><strong>Target Sites:</strong> ${result.settings.numSites}</p>` : ''}
        ${result.settings.poissonRadius ? `<p><strong>Poisson Radius:</strong> ${result.settings.poissonRadius}</p>` : ''}
        ${result.settings.gridSpacing ? `<p><strong>Grid Spacing:</strong> ${result.settings.gridSpacing}</p>` : ''}
        <p><strong>Seed:</strong> ${result.settings.seed}</p>
      </div>
      <div class="download-section">
        <button onclick="downloadImage('${result.dataURL}', '${result.name}.png')">
          Download PNG
        </button>
      </div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voronoi Diagram Samples</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #1a1a1a;
            color: #ffffff;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .header h1 {
            color: #00ff88;
            margin-bottom: 10px;
        }
        
        .header p {
            color: #cccccc;
            font-size: 18px;
        }
        
        .results-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .result-card {
            background-color: #2a2a2a;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            border: 1px solid #444;
        }
        
        .result-card h3 {
            color: #00ff88;
            margin-top: 0;
            margin-bottom: 15px;
            text-align: center;
            font-size: 16px;
            letter-spacing: 1px;
        }
        
        .image-container {
            text-align: center;
            margin-bottom: 15px;
        }
        
        .image-container img {
            max-width: 100%;
            height: auto;
            border-radius: 5px;
            border: 1px solid #555;
        }
        
        .stats {
            background-color: #1a1a1a;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 15px;
        }
        
        .stats p {
            margin: 5px 0;
            font-size: 14px;
            color: #cccccc;
        }
        
        .stats strong {
            color: #ffffff;
        }
        
        .download-section {
            text-align: center;
        }
        
        button {
            background-color: #00ff88;
            color: #000000;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            transition: background-color 0.3s;
        }
        
        button:hover {
            background-color: #00cc66;
        }
        
        .summary {
            background-color: #2a2a2a;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
            border: 1px solid #444;
        }
        
        .variation-types {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .variation-type {
            background-color: #1a1a1a;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
        }
        
        .variation-type h4 {
            color: #00ff88;
            margin: 0 0 5px 0;
            font-size: 14px;
        }
        
        .variation-type p {
            margin: 0;
            font-size: 12px;
            color: #cccccc;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Voronoi Diagram Sample Gallery</h1>
        <p>10 different variations showcasing various distribution algorithms and parameters</p>
    </div>
    
    <div class="summary">
        <h2>Algorithm Variations</h2>
        <div class="variation-types">
            <div class="variation-type">
                <h4>Random Distribution</h4>
                <p>Pure random placement with distance constraints</p>
            </div>
            <div class="variation-type">
                <h4>Poisson Disk</h4>
                <p>Bridson's algorithm for uniform distribution</p>
            </div>
            <div class="variation-type">
                <h4>Grid Based</h4>
                <p>Regular grid with random offsets</p>
            </div>
            <div class="variation-type">
                <h4>Hexagonal</h4>
                <p>Hexagonal pattern with perturbation</p>
            </div>
        </div>
    </div>

    <div class="results-grid">
        ${resultCards}
    </div>

    <script>
        function downloadImage(dataURL, filename) {
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        console.log('Voronoi samples loaded successfully!');
        console.log('Generated ${results.length} variations');
        
        // Log statistics
        const stats = {
            totalCells: ${results.reduce((sum, r) => sum + r.stats.numCells, 0)},
            totalSites: ${results.reduce((sum, r) => sum + r.stats.numSites, 0)},
            avgCells: ${(results.reduce((sum, r) => sum + r.stats.numCells, 0) / results.length).toFixed(1)},
            avgSites: ${(results.reduce((sum, r) => sum + r.stats.numSites, 0) / results.length).toFixed(1)}
        };
        
        console.log('Statistics:', stats);
    </script>
</body>
</html>`;
}

// Auto-run sample generation if this script is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - can run immediately
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Voronoi sample generator loaded');
    // Expose function globally for manual execution
    window.generateVoronoiSamples = generateVoronoiSamples;
  });
}
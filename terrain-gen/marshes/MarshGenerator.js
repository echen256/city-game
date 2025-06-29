export class MarshGenerator {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.marshCells = new Set();
    this.coastlineGenerator = null;
    this.lakesGenerator = null;
  }

  generateMarshes() {
    if (!this.voronoiGenerator || !this.voronoiGenerator.cells || this.voronoiGenerator.cells.size === 0) {
      console.error('MarshGenerator: No Voronoi diagram available');
      return [];
    }

    if (!this.coastlineGenerator || !this.lakesGenerator) {
      console.error('MarshGenerator: Coastline and Lakes generators required');
      return [];
    }

    this.clearMarshes();
    
    console.log('Generating marshes between lakes and coastlines...');

    // Get all coastal and lake cells
    const coastalCells = new Set(this.coastlineGenerator.getCoastalCells());
    const lakeCells = new Set(this.lakesGenerator.getLakeCells());
    
    if (coastalCells.size === 0 || lakeCells.size === 0) {
      console.log('No marshes generated - need both coastal and lake cells');
      return [];
    }

    // Find cells within 2 steps of both coasts and lakes
    const marshCandidates = new Set();
    
    this.voronoiGenerator.cells.forEach((cell, cellId) => {
      // Skip if already a coast or lake cell
      if (coastalCells.has(cellId) || lakeCells.has(cellId)) {
        return;
      }
      
      // Check if within 2 cells of both coasts and lakes
      const distToCoast = this.getMinDistanceToSet(cellId, coastalCells);
      const distToLake = this.getMinDistanceToSet(cellId, lakeCells);
      
      if (distToCoast <= 2 && distToLake <= 2) {
        marshCandidates.add(cellId);
      }
    });

    // Mark all valid candidates as marsh cells
    marshCandidates.forEach(cellId => {
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell) {
        this.marshCells.add(cellId);
        cell.setMetadata('marsh', true);
        cell.setMetadata('distToCoast', this.getMinDistanceToSet(cellId, coastalCells));
        cell.setMetadata('distToLake', this.getMinDistanceToSet(cellId, lakeCells));
      }
    });

    console.log(`Generated ${this.marshCells.size} marsh cells`);
    return Array.from(this.marshCells);
  }

  getMinDistanceToSet(startCellId, targetSet) {
    if (targetSet.has(startCellId)) {
      return 0;
    }

    // BFS to find minimum distance
    const queue = [{ cellId: startCellId, distance: 0 }];
    const visited = new Set([startCellId]);
    
    while (queue.length > 0) {
      const { cellId, distance } = queue.shift();
      
      // Check neighbors
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell && cell.neighbors) {
        for (const neighborId of cell.neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            
            if (targetSet.has(neighborId)) {
              return distance + 1;
            }
            
            // Only search up to distance 3 for efficiency
            if (distance < 3) {
              queue.push({ cellId: neighborId, distance: distance + 1 });
            }
          }
        }
      }
    }
    
    return Infinity; // Not reachable within search limit
  }

  isMarshCell(cellId) {
    return this.marshCells.has(cellId);
  }

  getMarshCells() {
    return Array.from(this.marshCells);
  }

  getMarshStats() {
    const marshArray = Array.from(this.marshCells);
    const stats = {
      totalMarshCells: this.marshCells.size,
      coastDistribution: {},
      lakeDistribution: {}
    };

    // Analyze distance distributions
    marshArray.forEach(cellId => {
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell) {
        const coastDist = cell.getMetadata('distToCoast');
        const lakeDist = cell.getMetadata('distToLake');
        
        stats.coastDistribution[coastDist] = (stats.coastDistribution[coastDist] || 0) + 1;
        stats.lakeDistribution[lakeDist] = (stats.lakeDistribution[lakeDist] || 0) + 1;
      }
    });

    return stats;
  }

  clearMarshes() {
    // Remove marsh metadata from all cells
    this.voronoiGenerator.cells.forEach((cell) => {
      cell.setMetadata('marsh', false);
      cell.setMetadata('distToCoast', null);
      cell.setMetadata('distToLake', null);
    });
    
    this.marshCells.clear();
  }

  // Set references to other generators
  setCoastlineGenerator(coastlineGenerator) {
    this.coastlineGenerator = coastlineGenerator;
  }

  setLakesGenerator(lakesGenerator) {
    this.lakesGenerator = lakesGenerator;
  }

  // Create terrain features for marshes
  createMarshFeatures(terrainData) {
    const marshFeature = terrainData.createFeature('marshes');
    
    // Add all marsh cell sites as point distribution
    const marshSites = [];
    this.marshCells.forEach(cellId => {
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell && cell.site) {
        marshSites.push({
          ...cell.site,
          distToCoast: cell.getMetadata('distToCoast'),
          distToLake: cell.getMetadata('distToLake')
        });
      }
    });
    
    marshFeature.addPointDistribution(marshSites);
    
    // Calculate centroid of marshes
    if (marshSites.length > 0) {
      const avgX = marshSites.reduce((sum, site) => sum + site.x, 0) / marshSites.length;
      const avgZ = marshSites.reduce((sum, site) => sum + (site.z || site.y || 0), 0) / marshSites.length;
      marshFeature.setCentroid(avgX, avgZ);
    }
    
    // Add metadata
    marshFeature.setMetadata('marshCellCount', this.marshCells.size);
    marshFeature.setMetadata('stats', this.getMarshStats());
    
    return marshFeature;
  }
}
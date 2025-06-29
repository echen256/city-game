export class LakesGenerator {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.lakeCells = new Set();
    this.lakeDepths = new Map(); // Track depth of lake cells (higher depth = deeper water)
    this.lakeOrigins = new Set(); // Track origin cells
    this.maxDepth = 50; // Maximum lake depth
  }

  generateLakes(budget = 30, numOrigins = 2) {
    if (!this.voronoiGenerator || !this.voronoiGenerator.cells || this.voronoiGenerator.cells.size === 0) {
      console.error('LakesGenerator: No Voronoi diagram available');
      return [];
    }

    this.clearLakes();
    
    console.log(`Generating lakes with budget ${budget}, ${numOrigins} origins`);

    // Step 1: Select random origin cells (avoid coastal areas if present)
    const origins = this.selectRandomOrigins(numOrigins);
    console.log(`Selected ${origins.length} lake origins`);

    // Step 2: Mark initial lake cells and consume budget
    let budgetUsed = 0;
    for (const cellId of origins) {
      if (budgetUsed >= budget) break;
      
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell) {
        this.lakeCells.add(cellId);
        this.lakeOrigins.add(cellId);
        this.lakeDepths.set(cellId, this.maxDepth); // Origins start at max depth
        cell.setMetadata('lake', true);
        cell.setMetadata('lakeOrigin', true);
        cell.setMetadata('depth', this.maxDepth);
        budgetUsed++;
      }
    }

    console.log(`Used ${budgetUsed} budget for initial lake origins`);

    // Step 3: Expand lakes with remaining budget using random iteration
    const remainingBudget = budget - budgetUsed;
    if (remainingBudget > 0) {
      this.expandLakesWithBudget(remainingBudget);
    }

    console.log(`Lakes generation complete. Total cells: ${this.lakeCells.size}`);
    return Array.from(this.lakeCells);
  }

  selectRandomOrigins(numOrigins) {
    // Get available cells (avoid coastal cells if coastline generator is present)
    let availableCells = Array.from(this.voronoiGenerator.cells.keys());
    
    // Filter out coastal cells if coastline exists
    if (this.settings.coastlineGenerator) {
      availableCells = availableCells.filter(cellId => 
        !this.settings.coastlineGenerator.isCoastal(cellId)
      );
    }
    
    // Filter out hill cells if hills generator exists
    if (this.settings.hillsGenerator) {
      availableCells = availableCells.filter(cellId => 
        !this.settings.hillsGenerator.isHillCell(cellId)
      );
    }

    const origins = [];
    
    // Use settings seed for reproducibility if available
    const seed = this.settings.voronoi?.seed || Date.now();
    this.seedRandom(seed + 1000); // Offset seed for lakes

    for (let i = 0; i < numOrigins && availableCells.length > 0; i++) {
      const randomIndex = Math.floor(this.random() * availableCells.length);
      const cellId = availableCells[randomIndex];
      
      origins.push(cellId);
      availableCells.splice(randomIndex, 1); // Remove to avoid duplicates
    }

    return origins;
  }

  expandLakesWithBudget(remainingBudget) {
    let budgetUsed = 0;
    let iteration = 0;
    
    while (budgetUsed < remainingBudget && this.lakeCells.size > 0) {
      // Get all current lake cells
      const currentLakeCells = Array.from(this.lakeCells);
      
      if (currentLakeCells.length === 0) {
        console.log('No lake cells available for expansion');
        break;
      }

      // Randomly select one of the current lake cells for expansion
      const randomIndex = Math.floor(this.random() * currentLakeCells.length);
      const selectedCellId = currentLakeCells[randomIndex];
      
      // Find non-lake neighbors of the selected cell
      const neighbors = this.getNonLakeNeighbors(selectedCellId);
      
      if (neighbors.length === 0) {
        // If this cell has no more neighbors, try a different approach
        // Find all possible neighbors from all lake cells
        const allNeighbors = new Set();
        for (const lakeCellId of this.lakeCells) {
          const cellNeighbors = this.getNonLakeNeighbors(lakeCellId);
          cellNeighbors.forEach(n => allNeighbors.add(n));
        }
        
        if (allNeighbors.size === 0) {
          console.log('No more neighbors available for lake expansion');
          break;
        }
        
        // Select random neighbor from all available
        const allNeighborsArray = Array.from(allNeighbors);
        const randomNeighborIndex = Math.floor(this.random() * allNeighborsArray.length);
        const newCellId = allNeighborsArray[randomNeighborIndex];
        
        this.addLakeCell(newCellId, selectedCellId);
        budgetUsed++;
      } else {
        // Randomly select one neighbor to add
        const randomNeighborIndex = Math.floor(this.random() * neighbors.length);
        const newCellId = neighbors[randomNeighborIndex];
        
        this.addLakeCell(newCellId, selectedCellId);
        budgetUsed++;
      }
      
      iteration++;
      
      if (iteration % 5 === 0) {
        console.log(`Lake expansion iteration ${iteration}, budget used: ${budgetUsed}/${remainingBudget}`);
      }

      // Safety check to prevent infinite loops
      if (iteration > remainingBudget * 2) {
        console.warn('Maximum lake expansion iterations reached');
        break;
      }
    }
    
    console.log(`Lake expansion complete. Used ${budgetUsed} additional budget in ${iteration} iterations`);
  }

  getNonLakeNeighbors(cellId) {
    const cell = this.voronoiGenerator.cells.get(cellId);
    if (!cell || !cell.neighbors) return [];
    
    return cell.neighbors.filter(neighborId => {
      // Exclude lake cells
      if (this.lakeCells.has(neighborId)) return false;
      
      // Exclude coastal cells if coastline generator exists
      if (this.settings.coastlineGenerator && this.settings.coastlineGenerator.isCoastal(neighborId)) {
        return false;
      }
      
      return true;
    });
  }

  addLakeCell(cellId, parentCellId) {
    const cell = this.voronoiGenerator.cells.get(cellId);
    const parentCell = this.voronoiGenerator.cells.get(parentCellId);
    
    if (cell && parentCell) {
      this.lakeCells.add(cellId);
      
      // Calculate depth based on parent (slightly shallower)
      const parentDepth = this.lakeDepths.get(parentCellId) || this.maxDepth;
      const depthReduction = 3 + this.random() * 7; // Reduce by 3-10
      const newDepth = Math.max(5, parentDepth - depthReduction); // Minimum depth of 5
      
      this.lakeDepths.set(cellId, newDepth);
      cell.setMetadata('lake', true);
      cell.setMetadata('depth', newDepth);
      cell.setMetadata('parentLake', parentCellId);
    }
  }

  getLakeDepth(cellId) {
    return this.lakeDepths.get(cellId) || 0;
  }

  isLakeCell(cellId) {
    return this.lakeCells.has(cellId);
  }

  getLakeCells() {
    return Array.from(this.lakeCells);
  }

  getLakeOrigins() {
    return Array.from(this.lakeOrigins);
  }

  getDepthStats() {
    const depths = Array.from(this.lakeDepths.values());
    return {
      minDepth: depths.length > 0 ? Math.min(...depths) : 0,
      maxDepth: depths.length > 0 ? Math.max(...depths) : 0,
      avgDepth: depths.length > 0 ? depths.reduce((sum, d) => sum + d, 0) / depths.length : 0,
      totalCells: this.lakeDepths.size,
      lakeCells: this.lakeCells.size,
      origins: this.lakeOrigins.size
    };
  }

  clearLakes() {
    // Remove lake metadata from all cells
    this.voronoiGenerator.cells.forEach((cell) => {
      cell.setMetadata('lake', false);
      cell.setMetadata('lakeOrigin', false);
      cell.setMetadata('depth', 0);
      cell.setMetadata('parentLake', null);
    });
    
    this.lakeCells.clear();
    this.lakeDepths.clear();
    this.lakeOrigins.clear();
  }

  // Seeded random number generator (same as other generators)
  seedRandom(seed) {
    this._seed = seed;
  }

  random() {
    if (this._seed !== undefined) {
      this._seed = (this._seed * 9301 + 49297) % 233280;
      return this._seed / 233280;
    }
    return Math.random();
  }

  // Create terrain features for lakes
  createLakeFeatures(terrainData) {
    const lakeFeature = terrainData.createFeature('lakes');
    
    // Add all lake cell sites as point distribution
    const lakeSites = [];
    this.lakeCells.forEach(cellId => {
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell && cell.site) {
        lakeSites.push({
          ...cell.site,
          depth: this.getLakeDepth(cellId)
        });
      }
    });
    
    lakeFeature.addPointDistribution(lakeSites);
    
    // Calculate centroid of lakes
    if (lakeSites.length > 0) {
      const avgX = lakeSites.reduce((sum, site) => sum + site.x, 0) / lakeSites.length;
      const avgZ = lakeSites.reduce((sum, site) => sum + (site.z || site.y || 0), 0) / lakeSites.length;
      lakeFeature.setCentroid(avgX, avgZ);
    }
    
    // Add metadata
    lakeFeature.setMetadata('lakeCellCount', this.lakeCells.size);
    lakeFeature.setMetadata('stats', this.getDepthStats());
    lakeFeature.setMetadata('origins', this.getLakeOrigins());
    
    return lakeFeature;
  }

  // Set references to other generators to avoid overlapping features
  setCoastlineGenerator(coastlineGenerator) {
    this.settings.coastlineGenerator = coastlineGenerator;
  }

  setHillsGenerator(hillsGenerator) {
    this.settings.hillsGenerator = hillsGenerator;
  }
}
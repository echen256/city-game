export class HillsGenerator {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.hillCells = new Set();
    this.cellHeights = new Map(); // Track height of each cell
    this.hillOrigins = new Set(); // Track origin cells
    this.gradientEdges = []; // Track selected gradient edges
    this.maxHeight = 100; // Maximum hill height
  }

  generateHills(budget = 100, numOrigins = 3, gradientEnabled = true) {
    if (!this.voronoiGenerator || !this.voronoiGenerator.cells || this.voronoiGenerator.cells.size === 0) {
      console.error('HillsGenerator: No Voronoi diagram available');
      return [];
    }

    this.clearHills();
    
    console.log(`Generating hills with budget ${budget}, ${numOrigins} origins, gradient: ${gradientEnabled}`);

    // Step 1: Select random origin cells
    const origins = this.selectRandomOrigins(numOrigins);
    console.log(`Selected ${origins.length} hill origins`);

    // Step 2: Mark initial hill cells and consume budget
    let budgetUsed = 0;
    for (const cellId of origins) {
      if (budgetUsed >= budget) break;
      
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell) {
        this.hillCells.add(cellId);
        this.hillOrigins.add(cellId);
        this.cellHeights.set(cellId, this.maxHeight); // Origins start at max height
        cell.setMetadata('hill', true);
        cell.setMetadata('hillOrigin', true);
        cell.setMetadata('height', this.maxHeight);
        budgetUsed++;
      }
    }

    console.log(`Used ${budgetUsed} budget for initial hill origins`);

    // Step 3: Expand hills with remaining budget using random iteration
    const remainingBudget = budget - budgetUsed;
    if (remainingBudget > 0) {
      this.expandHillsWithBudget(remainingBudget);
    }

    // Step 4: Apply gradient if enabled
    if (gradientEnabled) {
      this.applyGradientHeights();
    }

    console.log(`Hills generation complete. Total cells: ${this.hillCells.size}`);
    return Array.from(this.hillCells);
  }

  selectRandomOrigins(numOrigins) {
    const availableCells = Array.from(this.voronoiGenerator.cells.keys());
    const origins = [];
    
    // Use settings seed for reproducibility if available
    const seed = this.settings.voronoi?.seed || Date.now();
    this.seedRandom(seed);

    for (let i = 0; i < numOrigins && availableCells.length > 0; i++) {
      const randomIndex = Math.floor(this.random() * availableCells.length);
      const cellId = availableCells[randomIndex];
      
      origins.push(cellId);
      availableCells.splice(randomIndex, 1); // Remove to avoid duplicates
    }

    return origins;
  }

  expandHillsWithBudget(remainingBudget) {
    let budgetUsed = 0;
    let iteration = 0;
    
    while (budgetUsed < remainingBudget && this.hillCells.size > 0) {
      // Get all current hill cells
      const currentHillCells = Array.from(this.hillCells);
      
      if (currentHillCells.length === 0) {
        console.log('No hill cells available for expansion');
        break;
      }

      // Randomly select one of the current hill cells for expansion
      const randomIndex = Math.floor(this.random() * currentHillCells.length);
      const selectedCellId = currentHillCells[randomIndex];
      
      // Find non-hill neighbors of the selected cell
      const neighbors = this.getNonHillNeighbors(selectedCellId);
      
      if (neighbors.length === 0) {
        // If this cell has no more neighbors, try a different approach
        // Find all possible neighbors from all hill cells
        const allNeighbors = new Set();
        for (const hillCellId of this.hillCells) {
          const cellNeighbors = this.getNonHillNeighbors(hillCellId);
          cellNeighbors.forEach(n => allNeighbors.add(n));
        }
        
        if (allNeighbors.size === 0) {
          console.log('No more neighbors available for hill expansion');
          break;
        }
        
        // Select random neighbor from all available
        const allNeighborsArray = Array.from(allNeighbors);
        const randomNeighborIndex = Math.floor(this.random() * allNeighborsArray.length);
        const newCellId = allNeighborsArray[randomNeighborIndex];
        
        this.addHillCell(newCellId, selectedCellId);
        budgetUsed++;
      } else {
        // Randomly select one neighbor to add
        const randomNeighborIndex = Math.floor(this.random() * neighbors.length);
        const newCellId = neighbors[randomNeighborIndex];
        
        this.addHillCell(newCellId, selectedCellId);
        budgetUsed++;
      }
      
      iteration++;
      
      if (iteration % 10 === 0) {
        console.log(`Hill expansion iteration ${iteration}, budget used: ${budgetUsed}/${remainingBudget}`);
      }

      // Safety check to prevent infinite loops
      if (iteration > remainingBudget * 2) {
        console.warn('Maximum hill expansion iterations reached');
        break;
      }
    }
    
    console.log(`Hill expansion complete. Used ${budgetUsed} additional budget in ${iteration} iterations`);
  }

  getNonHillNeighbors(cellId) {
    const cell = this.voronoiGenerator.cells.get(cellId);
    if (!cell || !cell.neighbors) return [];
    
    return cell.neighbors.filter(neighborId => !this.hillCells.has(neighborId));
  }

  addHillCell(cellId, parentCellId) {
    const cell = this.voronoiGenerator.cells.get(cellId);
    const parentCell = this.voronoiGenerator.cells.get(parentCellId);
    
    if (cell && parentCell) {
      this.hillCells.add(cellId);
      
      // Calculate height based on parent (slightly lower)
      const parentHeight = this.cellHeights.get(parentCellId) || this.maxHeight;
      const newHeight = Math.max(10, parentHeight - (5 + this.random() * 10)); // Reduce by 5-15
      
      this.cellHeights.set(cellId, newHeight);
      cell.setMetadata('hill', true);
      cell.setMetadata('height', newHeight);
      cell.setMetadata('parentHill', parentCellId);
    }
  }

  applyGradientHeights() {
    const gridSize = this.settings.gridSize;
    
    // Step 1: Select 1-2 random edges for high elevation
    const edges = ['N', 'S', 'E', 'W'];
    const numGradientEdges = 1 + Math.floor(this.random() * 2); // 1 or 2 edges
    this.gradientEdges = [];
    
    for (let i = 0; i < numGradientEdges; i++) {
      const randomEdgeIndex = Math.floor(this.random() * edges.length);
      this.gradientEdges.push(edges[randomEdgeIndex]);
      edges.splice(randomEdgeIndex, 1); // Remove to avoid duplicates
    }
    
    console.log(`Selected gradient edges: ${this.gradientEdges.join(', ')}`);
    
    // Step 2: Calculate gradient heights for all Voronoi cells
    this.voronoiGenerator.cells.forEach((cell, cellId) => {
      const site = cell.site;
      if (!site) return;
      
      const x = site.x;
      const y = site.z || site.y || 0;
      
      // Calculate distance to gradient edges (closer = higher elevation)
      let maxElevationFactor = 0;
      
      for (const edge of this.gradientEdges) {
        let distanceToEdge;
        
        switch (edge) {
          case 'N': // North edge (top)
            distanceToEdge = y;
            break;
          case 'S': // South edge (bottom)
            distanceToEdge = gridSize - y;
            break;
          case 'E': // East edge (right)
            distanceToEdge = gridSize - x;
            break;
          case 'W': // West edge (left)
            distanceToEdge = x;
            break;
          default:
            distanceToEdge = gridSize;
        }
        
        // Normalize distance to 0-1 range (1 = at edge, 0 = far from edge)
        const normalizedDistance = Math.max(0, 1 - (distanceToEdge / gridSize));
        maxElevationFactor = Math.max(maxElevationFactor, normalizedDistance);
      }
      
      // Calculate gradient height (0-100 range)
      const gradientHeight = maxElevationFactor * this.maxHeight;
      
      // If this cell is a hill cell, combine gradient with hill height
      if (this.hillCells.has(cellId)) {
        const hillHeight = this.cellHeights.get(cellId) || 0;
        // Blend hill height with gradient (hill height gets priority)
        const combinedHeight = Math.max(hillHeight, gradientHeight + (hillHeight * 0.3));
        this.cellHeights.set(cellId, combinedHeight);
        cell.setMetadata('height', combinedHeight);
      } else {
        // Non-hill cells get gradient height
        this.cellHeights.set(cellId, gradientHeight);
        cell.setMetadata('height', gradientHeight);
        cell.setMetadata('gradient', true);
      }
    });
  }

  getCellHeight(cellId) {
    return this.cellHeights.get(cellId) || 0;
  }

  isHillCell(cellId) {
    return this.hillCells.has(cellId);
  }

  getHillCells() {
    return Array.from(this.hillCells);
  }

  getHillOrigins() {
    return Array.from(this.hillOrigins);
  }

  getGradientEdges() {
    return [...this.gradientEdges];
  }

  getHeightStats() {
    const heights = Array.from(this.cellHeights.values());
    return {
      minHeight: Math.min(...heights),
      maxHeight: Math.max(...heights),
      avgHeight: heights.reduce((sum, h) => sum + h, 0) / heights.length,
      totalCells: this.cellHeights.size,
      hillCells: this.hillCells.size,
      gradientEdges: this.gradientEdges
    };
  }

  clearHills() {
    // Remove hill metadata from all cells
    this.voronoiGenerator.cells.forEach((cell) => {
      cell.setMetadata('hill', false);
      cell.setMetadata('hillOrigin', false);
      cell.setMetadata('height', 0);
      cell.setMetadata('parentHill', null);
      cell.setMetadata('gradient', false);
    });
    
    this.hillCells.clear();
    this.cellHeights.clear();
    this.hillOrigins.clear();
    this.gradientEdges = [];
  }

  // Seeded random number generator (same as VoronoiGenerator)
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

  // Create terrain features for hills
  createHillFeatures(terrainData) {
    const hillFeature = terrainData.createFeature('hills');
    
    // Add all hill cell sites as point distribution
    const hillSites = [];
    this.hillCells.forEach(cellId => {
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell && cell.site) {
        hillSites.push({
          ...cell.site,
          height: this.getCellHeight(cellId)
        });
      }
    });
    
    hillFeature.addPointDistribution(hillSites);
    
    // Calculate centroid of hills
    if (hillSites.length > 0) {
      const avgX = hillSites.reduce((sum, site) => sum + site.x, 0) / hillSites.length;
      const avgZ = hillSites.reduce((sum, site) => sum + (site.z || site.y || 0), 0) / hillSites.length;
      hillFeature.setCentroid(avgX, avgZ);
    }
    
    // Add metadata
    hillFeature.setMetadata('hillCellCount', this.hillCells.size);
    hillFeature.setMetadata('stats', this.getHeightStats());
    hillFeature.setMetadata('origins', this.getHillOrigins());
    hillFeature.setMetadata('gradientEdges', this.getGradientEdges());
    
    return hillFeature;
  }
}
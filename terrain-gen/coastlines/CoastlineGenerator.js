export class CoastlineGenerator {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.coastalCells = new Set();
    this.coastalDepth = new Map(); // Track depth of coastal cells (0 = edge, 1+ = expanded)
    this.coastBudget = 0;
  }

  generateCoastline(direction, budget = 50) {
    if (!this.voronoiGenerator || !this.voronoiGenerator.cells || this.voronoiGenerator.cells.size === 0) {
      console.error('CoastlineGenerator: No Voronoi diagram available');
      return [];
    }

    this.coastalCells.clear();
    this.coastalDepth.clear();
    this.coastBudget = budget;
    
    const gridSize = this.settings.gridSize;
    
    // Step 1: Find cells in bounding box (10% width from edge)
    const boundingBoxCells = this.findBoundingBoxCells(direction, gridSize);
    
    console.log(`Found ${boundingBoxCells.length} cells in bounding box for ${direction} edge`);
    
    // Step 2: Mark initial coastal cells (depth 0) and consume budget
    let budgetUsed = 0;
    for (const cellId of boundingBoxCells) {
      if (budgetUsed >= budget) break;
      
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell) {
        this.coastalCells.add(cellId);
        this.coastalDepth.set(cellId, 0); // Initial coastal cells have depth 0
        cell.setMetadata('coastal', true);
        cell.setMetadata('coastDirection', direction);
        cell.setMetadata('coastDepth', 0);
        cell.setMetadata('height',0 )
        budgetUsed++;
      }
    }
    
    console.log(`Used ${budgetUsed} budget for initial coastal cells`);
    
    // Step 3: Expand with remaining budget using nearest neighbor
    const remainingBudget = budget - budgetUsed;
    if (remainingBudget > 0) {
      this.expandCoastlineWithBudget(remainingBudget);
    }

    return Array.from(this.coastalCells);
  }

  findEdgeCells(direction, gridSize) {
    const edgeCells = [];
    const tolerance = 10; // Distance from edge to consider "touching"
    
    this.voronoiGenerator.cells.forEach((cell, cellId) => {
      if (this.isCellNearEdge(cell, direction, gridSize, tolerance)) {
        edgeCells.push(cellId);
      }
    });

    return edgeCells;
  }

  isCellNearEdge(cell, direction, gridSize, tolerance) {
    const site = cell.site;
    if (!site) return false;

    const x = site.x;
    const y = site.z || site.y || 0;

    switch (direction) {
      case 'N': // North edge (top)
        return y <= tolerance;
      case 'S': // South edge (bottom)
        return y >= (gridSize - tolerance);
      case 'E': // East edge (right)
        return x >= (gridSize - tolerance);
      case 'W': // West edge (left)
        return x <= tolerance;
      default:
        console.warn(`Unknown direction: ${direction}`);
        return false;
    }
  }

  // Alternative method using Voronoi cell vertices to check edge intersection
  isCellIntersectingEdge(cell, direction, gridSize) {
    if (!cell.vertices || cell.vertices.length === 0) {
      // Fallback to site-based detection
      return this.isCellNearEdge(cell, direction, gridSize, 5);
    }

    for (const vertex of cell.vertices) {
      const x = vertex.x;
      const y = vertex.z || vertex.y || 0;

      // Check if any vertex is on or beyond the specified edge
      switch (direction) {
        case 'N':
          if (y <= 0) return true;
          break;
        case 'S':
          if (y >= gridSize) return true;
          break;
        case 'E':
          if (x >= gridSize) return true;
          break;
        case 'W':
          if (x <= 0) return true;
          break;
      }
    }

    return false;
  }

  getCoastalCells() {
    return Array.from(this.coastalCells);
  }

  isCoastal(cellId) {
    return this.coastalCells.has(cellId);
  }

  findBoundingBoxCells(direction, gridSize) {
    const boundingBoxCells = [];
    const boundingBoxWidth = gridSize * 0.1; // 10% of grid size
    
    this.voronoiGenerator.cells.forEach((cell, cellId) => {
      if (this.isCellInBoundingBox(cell, direction, gridSize, boundingBoxWidth)) {
        boundingBoxCells.push(cellId);
      }
    });

    return boundingBoxCells;
  }

  isCellInBoundingBox(cell, direction, gridSize, boundingBoxWidth) {
    const site = cell.site;
    if (!site) return false;

    const x = site.x;
    const y = site.z || site.y || 0;

    switch (direction) {
      case 'N': // North edge (top) - bounding box extends down from top
        return y <= boundingBoxWidth;
      case 'S': // South edge (bottom) - bounding box extends up from bottom
        return y >= (gridSize - boundingBoxWidth);
      case 'E': // East edge (right) - bounding box extends left from right
        return x >= (gridSize - boundingBoxWidth);
      case 'W': // West edge (left) - bounding box extends right from left
        return x <= boundingBoxWidth;
      default:
        console.warn(`Unknown direction: ${direction}`);
        return false;
    }
  }

  expandCoastlineWithBudget(remainingBudget) {
    let budgetUsed = 0;
    let currentDepth = 0;
    
    while (budgetUsed < remainingBudget) {
      // Find all non-coastal neighbors of current coastal cells at this depth
      const candidates = new Set();
      
      this.coastalCells.forEach(cellId => {
        const cellDepth = this.coastalDepth.get(cellId);
        if (cellDepth === currentDepth) {
          // Get neighbors of this coastal cell
          const cell = this.voronoiGenerator.cells.get(cellId);
          if (cell && cell.neighbors) {
            cell.neighbors.forEach(neighborId => {
              // Only add non-coastal neighbors as candidates
              if (!this.coastalCells.has(neighborId)) {
                candidates.add(neighborId);
              }
            });
          }
        }
      });
      
      if (candidates.size === 0) {
        console.log('No more neighbors to expand to');
        break;
      }
      
      // Convert candidates to array and add them to coast within budget
      const candidateArray = Array.from(candidates);
      const nextDepth = currentDepth + 1;
      
      for (const cellId of candidateArray) {
        if (budgetUsed >= remainingBudget) break;
        
        const cell = this.voronoiGenerator.cells.get(cellId);
        if (cell) {
          this.coastalCells.add(cellId);
          this.coastalDepth.set(cellId, nextDepth);
          cell.setMetadata('coastal', true);
          cell.setMetadata('coastDepth', nextDepth);
          budgetUsed++;
        }
      }
      
      console.log(`Expanded ${candidateArray.length} cells at depth ${nextDepth}, used ${budgetUsed} total budget`);
      currentDepth++;
      
      // Safety check to prevent infinite loops
      if (currentDepth > 10) {
        console.warn('Maximum expansion depth reached');
        break;
      }
    }
    
    console.log(`Expansion complete. Total budget used: ${budgetUsed}`);
  }

  getCoastalDepth(cellId) {
    return this.coastalDepth.get(cellId) || 0;
  }

  clearCoastline() {
    // Remove coastal metadata from all cells
    this.voronoiGenerator.cells.forEach((cell) => {
      cell.setMetadata('coastal', false);
      cell.setMetadata('coastDirection', null);
      cell.setMetadata('coastDepth', null);
    });
    this.coastalCells.clear();
    this.coastalDepth.clear();
  }

  // Generate coastlines for multiple directions
  generateMultipleCoastlines(directions) {
    const results = {};
    
    for (const direction of directions) {
      results[direction] = this.generateCoastline(direction);
    }
    
    return results;
  }

  // Get coastline statistics
  getCoastlineStats() {
    const stats = {
      totalCoastalCells: this.coastalCells.size,
      directionBreakdown: {}
    };

    this.voronoiGenerator.cells.forEach((cell) => {
      const isCoastal = cell.getMetadata('coastal');
      const direction = cell.getMetadata('coastDirection');
      
      if (isCoastal && direction) {
        if (!stats.directionBreakdown[direction]) {
          stats.directionBreakdown[direction] = 0;
        }
        stats.directionBreakdown[direction]++;
      }
    });

    return stats;
  }

  // Create terrain features for coastlines
  createCoastlineFeatures(terrainData) {
    const coastlineFeature = terrainData.createFeature('coastline');
    
    // Add all coastal cell sites as point distribution
    const coastalSites = [];
    this.coastalCells.forEach(cellId => {
      const cell = this.voronoiGenerator.cells.get(cellId);
      if (cell && cell.site) {
        coastalSites.push(cell.site);
      }
    });
    
    coastlineFeature.addPointDistribution(coastalSites);
    
    // Calculate centroid of coastline
    if (coastalSites.length > 0) {
      const avgX = coastalSites.reduce((sum, site) => sum + site.x, 0) / coastalSites.length;
      const avgZ = coastalSites.reduce((sum, site) => sum + (site.z || site.y || 0), 0) / coastalSites.length;
      coastlineFeature.setCentroid(avgX, avgZ);
    }
    
    // Add metadata
    coastlineFeature.setMetadata('coastalCellCount', this.coastalCells.size);
    coastlineFeature.setMetadata('stats', this.getCoastlineStats());
    
    return coastlineFeature;
  }
}
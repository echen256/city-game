export class RiversGenerator {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.riverCells = new Set();
    this.riverPaths = []; // Array of river path arrays
    this.coastlineGenerator = null;
    this.lakesGenerator = null;
    this.marshGenerator = null;
  }

  generateRivers(numRivers = 2) {
    if (!this.voronoiGenerator || !this.voronoiGenerator.cells || this.voronoiGenerator.cells.size === 0) {
      console.error('RiversGenerator: No Voronoi diagram available');
      return [];
    }

    this.clearRivers();
    
    console.log(`Generating ${numRivers} rivers...`);

    for (let i = 0; i < numRivers; i++) {
      const river = this.generateSingleRiver(i);
      if (river.length > 0) {
        this.riverPaths.push(river);
        console.log(`Generated river ${i + 1} with ${river.length} cells`);
      }
    }

    console.log(`Rivers generation complete. Total paths: ${this.riverPaths.length}, total cells: ${this.riverCells.size}`);
    return this.riverPaths;
  }

  generateSingleRiver(riverIndex) {
    // Step 1: Select a random edge as starting point (non-coastal edge)
    const startCell = this.selectEdgeStartPoint();
    if (!startCell) {
      console.log(`No valid start point found for river ${riverIndex + 1}`);
      return [];
    }

    // Step 2: Find target (water features: lakes, coasts, marshes, or opposite edge)
    const targets = this.findWaterTargets();
    if (targets.length === 0) {
      console.log(`No water targets found for river ${riverIndex + 1}`);
      return [];
    }

    // Log elevation info for debugging
    const startElevation = this.getCellElevation(startCell);
    console.log(`River ${riverIndex + 1}: Starting at elevation ${Math.round(startElevation)}`);

    // Step 3: Use A* pathfinding to find path to nearest water target
    const path = this.findPathToWater(startCell, targets);
    console.log(startCell, targets)
    
    if (path.length > 0) {
      // Analyze elevation profile of the path
      const elevations = path.map(cellId => this.getCellElevation(cellId));
      const startElev = elevations[0];
      const endElev = elevations[elevations.length - 1];
      const maxElev = Math.max(...elevations);
      const minElev = Math.min(...elevations);
      
      console.log(`River ${riverIndex + 1}: Path found - ${path.length} cells`);
      console.log(`  Elevation: ${Math.round(startElev)} -> ${Math.round(endElev)} (Δ${Math.round(endElev - startElev)})`);
      console.log(`  Range: ${Math.round(minElev)} to ${Math.round(maxElev)}`);
      
      // Check for uphill segments
      let uphillSegments = 0;
      for (let i = 1; i < elevations.length; i++) {
        if (elevations[i] > elevations[i - 1]) {
          uphillSegments++;
        }
      }
      if (uphillSegments > 0) {
        console.log(`  Warning: ${uphillSegments} uphill segments found`);
      }

      // Mark all cells in path as river cells
      path.forEach((cellId, index) => {
        const cell = this.voronoiGenerator.cells.get(cellId);
        if (cell) {
          this.riverCells.add(cellId);
          cell.setMetadata('river', true);
          cell.setMetadata('riverIndex', riverIndex);
          cell.setMetadata('riverPosition', index);
          cell.setMetadata('riverElevation', elevations[index]);
        }
      });
    } else {
      console.log(`River ${riverIndex + 1}: No path found from elevation ${Math.round(startElevation)}`);
    }

    return path;
  }

  selectEdgeStartPoint() {
    const gridSize = this.settings.gridSize;
    const edgeTolerance = 20; // Distance from edge to consider "edge cell"
    const edgeCells = [];

    this.voronoiGenerator.cells.forEach((cell, cellId) => {
      // Skip coastal cells
      if (this.coastlineGenerator && this.coastlineGenerator.isCoastal(cellId)) {
        return;
      }

      const site = cell.site;
      if (!site) return;

      const x = site.x;
      const y = site.z || site.y || 0;

      // Check if cell is near any edge
      const isNearEdge = 
        x <= edgeTolerance ||                    // West edge
        x >= (gridSize - edgeTolerance) ||       // East edge
        y <= edgeTolerance ||                    // North edge
        y >= (gridSize - edgeTolerance);         // South edge

      if (isNearEdge) {
        edgeCells.push(cellId);
      }
    });

    if (edgeCells.length === 0) {
      return null;
    }

    // Use seeded random for reproducibility
    const seed = this.settings.voronoi?.seed || Date.now();
    this.seedRandom(seed + 2000); // Offset seed for rivers
    
    const randomIndex = Math.floor(this.random() * edgeCells.length);
    return edgeCells[randomIndex];
  }

  findWaterTargets() {
    const targets = [];

    // Add coastal cells as targets
    if (this.coastlineGenerator) {
      targets.push(...this.coastlineGenerator.getCoastalCells());
    }

    // Add lake cells as targets
    if (this.lakesGenerator) {
      targets.push(...this.lakesGenerator.getLakeCells());
    }

    // Add marsh cells as targets (lower priority)
    if (this.marshGenerator) {
      targets.push(...this.marshGenerator.getMarshCells());
    }

    return targets;
  }

  findPathToWater(startCellId, targetCells) {
    // A* pathfinding algorithm
    const openSet = new Set([startCellId]);
    const cameFrom = new Map();
    const gScore = new Map(); // Cost from start to this cell
    const fScore = new Map(); // gScore + heuristic

    gScore.set(startCellId, 0);
    fScore.set(startCellId, this.heuristic(startCellId, targetCells));

    while (openSet.size > 0) {
      // Get cell with lowest fScore
      let current = null;
      let lowestF = Infinity;
      
      for (const cellId of openSet) {
        const f = fScore.get(cellId) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = cellId;
        }
      }

      if (current === null) break;

      // Check if we reached a target
      if (targetCells.includes(current)) {
        return this.reconstructPath(cameFrom, current);
      }

      openSet.delete(current);
      const currentCell = this.voronoiGenerator.cells.get(current);
      
      if (!currentCell || !currentCell.neighbors) continue;

      // Check all neighbors
      for (const neighborId of currentCell.neighbors) {
        // Skip if neighbor is already a river, coast, lake, or hill
        if (this.isObstacle(neighborId)) {
          continue;
        }

        const tentativeG = (gScore.get(current) || Infinity) + this.getMovementCost(current, neighborId);

        if (tentativeG < (gScore.get(neighborId) || Infinity)) {
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeG);
          fScore.set(neighborId, tentativeG + this.heuristic(neighborId, targetCells));
          
          if (!openSet.has(neighborId)) {
            openSet.add(neighborId);
          }
        }
      }
    }

    return []; // No path found
  }

  heuristic(cellId, targetCells) {
    // Return distance to nearest target, considering elevation
    const cell = this.voronoiGenerator.cells.get(cellId);
    if (!cell || !cell.site) return Infinity;

    const currentElevation = this.getCellElevation(cellId);
    let minCost = Infinity;
    
    for (const targetId of targetCells) {
      const targetCell = this.voronoiGenerator.cells.get(targetId);
      console.log(targetCell)
      if (targetCell && targetCell.site) {
        // Calculate straight-line distance
        const dx = cell.site.x - targetCell.site.x;
        const dy = (cell.site.z || cell.site.y || 0) - (targetCell.site.z || targetCell.site.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Factor in elevation difference
        const targetElevation = this.getCellElevation(targetId);
        const elevationDiff = currentElevation - targetElevation;
        
        // If target is lower (downhill), reduce heuristic cost
        // If target is higher (uphill), increase heuristic cost
        let elevationCost = 0;
        if (elevationDiff < 0) {
          // Going uphill to target
          elevationCost = Math.abs(elevationDiff) * 2; // Penalty for uphill targets
        } else {
          // Going downhill to target
          elevationCost = -elevationDiff * 0.1; // Bonus for downhill targets
        }
        
        const totalCost = distance + elevationCost;
        minCost = Math.min(minCost, totalCost);
      }
    }

    return minCost;
  }

  getMovementCost(fromCellId, toCellId) {
    // Get heights for elevation-based movement cost
    const fromHeight = this.getCellElevation(fromCellId);
    const toHeight = this.getCellElevation(toCellId);
    const elevationChange = toHeight - fromHeight;

    // Base cost
    let cost = 1;

    // Elevation-based cost calculation
    if (elevationChange <= 0) {
      // Flowing downhill or staying level - preferred
      const downhillBonus = Math.abs(elevationChange) * 0.1; // Bonus for steeper downhill
      cost = Math.max(0.1, 1 - downhillBonus); // Minimum cost of 0.1
    } else {
      // Flowing uphill - heavily penalized
      const uphillPenalty = elevationChange * 10; // Heavy penalty for going uphill
      cost = 1 + uphillPenalty;
      
      // Extreme penalty for significant uphill movement
      if (elevationChange > 10) {
        cost += elevationChange * 20; // Even heavier penalty for steep uphill
      }
    }

    // Additional terrain modifiers
    // Lower cost for marshes (rivers like wetlands)
    if (this.marshGenerator && this.marshGenerator.isMarshCell(toCellId)) {
      cost *= 0.7; // Prefer flowing through marshes
    }

    // Slight penalty for very high elevations (mountains)
    if (toHeight > 70) {
      cost *= 1.5; // Rivers avoid mountain peaks
    }

    // Bonus for flowing toward lower-elevation neighbors
    const toNeighborHeights = this.getNeighborElevations(toCellId);
    const hasLowerNeighbors = toNeighborHeights.some(h => h < toHeight);
    if (hasLowerNeighbors) {
      cost *= 0.8; // Prefer cells that have downhill exits
    }

    return Math.max(0.05, cost); // Ensure minimum cost
  }

  getCellElevation(cellId) {
    // Get elevation from hills generator, or use gradient height, or default to 0
    if (this.settings.hillsGenerator) {
      const height = this.settings.hillsGenerator.getCellHeight(cellId);
      if (height > 0) {
        return height;
      }
    }

    // If no hills generator, try to get gradient height from cell metadata
    const cell = this.voronoiGenerator.cells.get(cellId);
    if (cell) {
      const gradientHeight = cell.getMetadata('height');
      if (gradientHeight !== undefined && gradientHeight !== null) {
        return gradientHeight;
      }
    }

    // Default elevation based on distance from center (simple fallback)
    const site = cell?.site;
    if (site) {
      const gridSize = this.settings.gridSize;
      const centerX = gridSize / 2;
      const centerY = gridSize / 2;
      const x = site.x;
      const y = site.z || site.y || 0;
      
      // Distance from center normalized to 0-50 range
      const distFromCenter = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      const maxDist = Math.sqrt(2) * gridSize / 2;
      return (distFromCenter / maxDist) * 30; // 0-30 elevation range
    }

    return 0;
  }

  getNeighborElevations(cellId) {
    const cell = this.voronoiGenerator.cells.get(cellId);
    if (!cell || !cell.neighbors) return [];

    return cell.neighbors.map(neighborId => this.getCellElevation(neighborId));
  }

  isObstacle(cellId) {
    // Rivers can't flow through existing rivers or lakes (they merge instead)
    if (this.riverCells.has(cellId)) return true;
    if (this.lakesGenerator && this.lakesGenerator.isLakeCell(cellId)) {
      // Lakes are targets, not obstacles, but check if it's the final destination
      return false; // Allow rivers to flow into lakes
    }
    
    // Very high elevations are impassable obstacles
    const elevation = this.getCellElevation(cellId);
    if (elevation > 80) return true; // Mountain peaks are impassable
    
    // Check if cell is completely surrounded by higher elevation (trapped valley)
    const neighborElevations = this.getNeighborElevations(cellId);
    const isTrappedValley = neighborElevations.length > 0 && 
      neighborElevations.every(h => h > elevation + 20);
    
    if (isTrappedValley) return true; // Can't escape from deep valleys

    return false;
  }

  reconstructPath(cameFrom, current) {
    const path = [current];
    
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }
    
    return path;
  }

  isRiverCell(cellId) {
    return this.riverCells.has(cellId);
  }

  getRiverCells() {
    return Array.from(this.riverCells);
  }

  getRiverPaths() {
    return [...this.riverPaths];
  }

  getRiverStats() {
    return {
      totalRiverCells: this.riverCells.size,
      numberOfRivers: this.riverPaths.length,
      averageRiverLength: this.riverPaths.length > 0 ? 
        this.riverPaths.reduce((sum, path) => sum + path.length, 0) / this.riverPaths.length : 0,
      longestRiver: this.riverPaths.length > 0 ? 
        Math.max(...this.riverPaths.map(path => path.length)) : 0
    };
  }

  clearRivers() {
    // Remove river metadata from all cells
    this.voronoiGenerator.cells.forEach((cell) => {
      cell.setMetadata('river', false);
      cell.setMetadata('riverIndex', null);
      cell.setMetadata('riverPosition', null);
    });
    
    this.riverCells.clear();
    this.riverPaths = [];
  }

  // Set references to other generators
  setCoastlineGenerator(coastlineGenerator) {
    this.coastlineGenerator = coastlineGenerator;
  }

  setLakesGenerator(lakesGenerator) {
    this.lakesGenerator = lakesGenerator;
  }

  setMarshGenerator(marshGenerator) {
    this.marshGenerator = marshGenerator;
  }

  setHillsGenerator(hillsGenerator) {
    this.settings.hillsGenerator = hillsGenerator;
  }

  // Seeded random number generator
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

  // Create terrain features for rivers
  createRiverFeatures(terrainData) {
    this.riverPaths.forEach((path, index) => {
      const riverFeature = terrainData.createFeature(`river_${index}`);
      
      // Add river path as point distribution
      const riverSites = path.map(cellId => {
        const cell = this.voronoiGenerator.cells.get(cellId);
        return cell ? cell.site : null;
      }).filter(site => site !== null);
      
      riverFeature.addPointDistribution(riverSites);
      
      // Calculate centroid
      if (riverSites.length > 0) {
        const avgX = riverSites.reduce((sum, site) => sum + site.x, 0) / riverSites.length;
        const avgZ = riverSites.reduce((sum, site) => sum + (site.z || site.y || 0), 0) / riverSites.length;
        riverFeature.setCentroid(avgX, avgZ);
      }
      
      // Add metadata
      riverFeature.setMetadata('riverIndex', index);
      riverFeature.setMetadata('pathLength', path.length);
      riverFeature.setMetadata('startCell', path[0]);
      riverFeature.setMetadata('endCell', path[path.length - 1]);
    });

    // Create overall rivers feature
    const riversFeature = terrainData.createFeature('rivers');
    riversFeature.setMetadata('riverCount', this.riverPaths.length);
    riversFeature.setMetadata('stats', this.getRiverStats());
    
    return riversFeature;
  }
}
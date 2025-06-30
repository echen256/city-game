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
    console.log(`\n=== GENERATING SINGLE RIVER ${riverIndex + 1} ===`);
    
    // Step 1: Select a random edge as starting point (non-coastal edge)
    const startCell = this.selectEdgeStartPoint();
    if (!startCell) {
      console.log(`FAILURE: No valid start point found for river ${riverIndex + 1}`);
      return [];
    }

    // Mark start point immediately
    const startCellObj = this.voronoiGenerator.cells.get(startCell);
    if (startCellObj) {
      startCellObj.setMetadata('riverStartPoint', true);
      startCellObj.setMetadata('riverIndex', riverIndex);
      console.log(`Marked start point: ${startCell}`);
    }

    // Step 2: Find target (water features: lakes, coasts, marshes, or opposite edge)
    let targets = this.findWaterTargets();
    if (targets.length === 0) {
      console.log(`No water targets found for river ${riverIndex + 1}, using parallel edge targets`);
      targets = this.selectParallelEdgeTargets(startCell);
      
      if (targets.length === 0) {
        console.log(`FAILURE: No parallel edge targets found for river ${riverIndex + 1}`);
        return [];
      }
    }

    // Mark end point immediately (choose closest target)
    if (targets.length > 0) {
      let endPointId = targets[0]; // Default to first target
      
      // If multiple targets, find the closest one
      if (targets.length > 1 && startCellObj?.site) {
        let minDistance = Infinity;
        const startSite = startCellObj.site;
        
        for (const targetId of targets) {
          const targetCell = this.voronoiGenerator.cells.get(targetId);
          if (targetCell && targetCell.site) {
            const dx = startSite.x - targetCell.site.x;
            const dy = (startSite.z || startSite.y || 0) - (targetCell.site.z || targetCell.site.y || 0);
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance) {
              minDistance = distance;
              endPointId = targetId;
            }
          }
        }
      }
      
      const endCellObj = this.voronoiGenerator.cells.get(endPointId);
      if (endCellObj) {
        endCellObj.setMetadata('riverEndPoint', true);
        endCellObj.setMetadata('riverIndex', riverIndex);
        console.log(`Marked end point: ${endPointId}`);
      }
    }

    // Log elevation info for debugging
    const startElevation = this.getCellElevation(startCell);
    console.log(`River ${riverIndex + 1}: Starting at cell ${startCell}, elevation ${Math.round(startElevation)}`);

    // Step 3: Use A* pathfinding to find path to nearest water target
    console.log(`Starting A* pathfinding from ${startCell} to ${targets.length} targets...`);
    const path = this.findPathToWater(startCell, targets);
    console.log(`A* pathfinding result: ${path.length > 0 ? 'SUCCESS' : 'FAILED'}`);
    
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
      
      console.log(`SUCCESS: River ${riverIndex + 1} generated with ${path.length} cells`);
    } else {
      console.log(`FAILURE: No path found from elevation ${Math.round(startElevation)}`);
    }

    console.log(`=== SINGLE RIVER ${riverIndex + 1} COMPLETE ===\n`);
    return path;
  }

  selectEdgeStartPoint() {
    console.log(`=== SELECTING EDGE START POINT ===`);
    const gridSize = this.settings.gridSize;
    const edgeTolerance = 20; // Distance from edge to consider "edge cell"
    const edgeCells = [];

    console.log(`Grid size: ${gridSize}, Edge tolerance: ${edgeTolerance}`);

    this.voronoiGenerator.cells.forEach((cell, cellId) => {
      // Skip coastal cells
      if (this.coastlineGenerator && this.coastlineGenerator.isCoastal(cellId)) {
        console.log(`Skipping coastal cell ${cellId}`);
        return;
      }

      const site = cell.site;
      if (!site) {
        console.log(`Skipping cell ${cellId} - no site`);
        return;
      }

      const x = site.x;
      const y = site.z || site.y || 0;

      // Check if cell is near any edge
      const isNearEdge = 
        x <= edgeTolerance ||                    // West edge
        x >= (gridSize - edgeTolerance) ||       // East edge
        y <= edgeTolerance ||                    // North edge
        y >= (gridSize - edgeTolerance);         // South edge

      if (isNearEdge) {
        console.log(`Found edge cell ${cellId} at (${x.toFixed(1)}, ${y.toFixed(1)})`);
        edgeCells.push(cellId);
      }
    });

    console.log(`Total edge cells found: ${edgeCells.length}`);
    console.log(`Edge cells: [${edgeCells}]`);

    if (edgeCells.length === 0) {
      console.log(`ERROR: No valid edge cells found!`);
      return null;
    }

    // Use seeded random for reproducibility
    const seed = this.settings.voronoi?.seed || Date.now();
    this.seedRandom(seed + 2000); // Offset seed for rivers
    
    const randomIndex = Math.floor(this.random() * edgeCells.length);
    const selectedCell = edgeCells[randomIndex];
    
    console.log(`Selected start cell: ${selectedCell} (random index: ${randomIndex})`);
    console.log(`=== EDGE START POINT SELECTED ===`);
    
    return selectedCell;
  }

  findWaterTargets() {
    console.log(`=== FINDING WATER TARGETS ===`);
    const targets = [];

    // Add coastal cells as targets
    if (this.coastlineGenerator) {
      const coastalCells = this.coastlineGenerator.getCoastalCells();
      console.log(`Found ${coastalCells.length} coastal cells: [${coastalCells}]`);
      targets.push(...coastalCells);
    } else {
      console.log(`No coastline generator available`);
    }

    // Add lake cells as targets
    if (this.lakesGenerator) {
      const lakeCells = this.lakesGenerator.getLakeCells();
      console.log(`Found ${lakeCells.length} lake cells: [${lakeCells}]`);
      targets.push(...lakeCells);
    } else {
      console.log(`No lakes generator available`);
    }

    // Add marsh cells as targets (lower priority)
    if (this.marshGenerator) {
      const marshCells = this.marshGenerator.getMarshCells();
      console.log(`Found ${marshCells.length} marsh cells: [${marshCells}]`);
      targets.push(...marshCells);
    } else {
      console.log(`No marsh generator available`);
    }

    console.log(`Total water targets found: ${targets.length}`);
    console.log(`All targets: [${targets}]`);
    console.log(`=== WATER TARGETS FOUND ===`);

    return targets;
  }

  findPathToWater(startCellId, targetCells) {
    console.log(`=== A* PATHFINDING DEBUG ===`);
    console.log(`Starting pathfinding from cell ${startCellId} to targets:`, targetCells);
    console.log(`Number of target cells: ${targetCells.length}`);
    
    // A* pathfinding algorithm
    const openSet = new Set([startCellId]);
    const cameFrom = new Map();
    const gScore = new Map(); // Cost from start to this cell
    const fScore = new Map(); // gScore + heuristic

    gScore.set(startCellId, 0);
    fScore.set(startCellId, this.heuristic(startCellId, targetCells));

    console.log(`Initial open set: [${Array.from(openSet)}]`);
    console.log(`Initial gScore[${startCellId}]: 0`);
    console.log(`Initial fScore[${startCellId}]: ${fScore.get(startCellId)}`);

    let iterationCount = 0;
    const maxIterations = 1000; // Prevent infinite loops

    while (openSet.size > 0 && iterationCount < maxIterations) {
      iterationCount++;
      console.log(`\n--- Iteration ${iterationCount} ---`);
      console.log(`Open set size: ${openSet.size}`);
      console.log(`Open set contents: [${Array.from(openSet)}]`);
      
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

      console.log(`Selected current cell: ${current} (fScore: ${lowestF})`);

      if (current === null) {
        console.log(`ERROR: No valid current cell found!`);
        break;
      }

      // Check if we reached a target
      if (targetCells.includes(current)) {
        console.log(`SUCCESS: Reached target cell ${current}!`);
        const path = this.reconstructPath(cameFrom, current);
        console.log(`Final path: [${path}]`);
        console.log(`Path length: ${path.length}`);
        console.log(`=== PATHFINDING COMPLETE ===`);
        return path;
      }

      openSet.delete(current);
      const currentCell = this.voronoiGenerator.cells.get(current);
      
      if (!currentCell) {
        console.log(`ERROR: Current cell ${current} not found in Voronoi cells!`);
        continue;
      }
      
      if (!currentCell.neighbors) {
        console.log(`ERROR: Current cell ${current} has no neighbors!`);
        continue;
      }

      console.log(`Current cell neighbors: [${Array.from(currentCell.neighbors)}]`);
      console.log(`Current cell elevation: ${this.getCellElevation(current)}`);

      // Check all neighbors
      let validNeighbors = 0;
      for (const neighborId of currentCell.neighbors) {
        console.log(`\n  Evaluating neighbor: ${neighborId}`);
        
        // Skip if neighbor is already a river, coast, lake, or hill
        if (this.isObstacle(neighborId)) {
          console.log(`    SKIP: Neighbor ${neighborId} is an obstacle`);
          continue;
        }

        const neighborElevation = this.getCellElevation(neighborId);
        const movementCost = this.getMovementCost(current, neighborId);
        const tentativeG = (gScore.get(current) || Infinity) + movementCost;
        const currentG = gScore.get(neighborId) || Infinity;

        console.log(`    Neighbor elevation: ${neighborElevation}`);
        console.log(`    Movement cost: ${movementCost}`);
        console.log(`    Tentative gScore: ${tentativeG} (current: ${currentG})`);

        if (tentativeG < currentG) {
          console.log(`    UPDATE: Better path found to neighbor ${neighborId}`);
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeG);
          const heuristic = this.heuristic(neighborId, targetCells);
          fScore.set(neighborId, tentativeG + heuristic);
          
          console.log(`    New gScore[${neighborId}]: ${tentativeG}`);
          console.log(`    Heuristic[${neighborId}]: ${heuristic}`);
          console.log(`    New fScore[${neighborId}]: ${tentativeG + heuristic}`);
          
          if (!openSet.has(neighborId)) {
            openSet.add(neighborId);
            console.log(`    ADDED: Neighbor ${neighborId} to open set`);
          }
          validNeighbors++;
        } else {
          console.log(`    SKIP: No better path to neighbor ${neighborId}`);
        }
      }

      console.log(`Valid neighbors processed: ${validNeighbors}`);
    }

    if (iterationCount >= maxIterations) {
      console.log(`ERROR: Pathfinding exceeded maximum iterations (${maxIterations})`);
    } else {
      console.log(`ERROR: No path found - open set exhausted`);
    }
    
    console.log(`Final open set: [${Array.from(openSet)}]`);
    console.log(`Final gScores:`, Object.fromEntries(gScore));
    console.log(`=== PATHFINDING FAILED ===`);
    return []; // No path found
  }

  heuristic(cellId, targetCells) {
    // Return distance to nearest target, considering elevation
    const cell = this.voronoiGenerator.cells.get(cellId);
    if (!cell || !cell.site) {
      console.log(`    Heuristic ERROR: Cell ${cellId} not found or has no site`);
      return Infinity;
    }

    const currentElevation = this.getCellElevation(cellId);
    let minCost = Infinity;
    
    console.log(`    Heuristic calculation for cell ${cellId} (elevation: ${currentElevation})`);
    
    for (const targetId of targetCells) {
      const targetCell = this.voronoiGenerator.cells.get(targetId);
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
        console.log(`      Target ${targetId}: distance=${distance.toFixed(2)}, elevationDiff=${elevationDiff.toFixed(2)}, elevationCost=${elevationCost.toFixed(2)}, totalCost=${totalCost.toFixed(2)}`);
        minCost = Math.min(minCost, totalCost);
      } else {
        console.log(`      Target ${targetId}: INVALID (no cell or site)`);
      }
    }

    console.log(`    Final heuristic for cell ${cellId}: ${minCost.toFixed(2)}`);
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

    const finalCost = Math.max(0.05, cost); // Ensure minimum cost
    
    console.log(`    Movement cost ${fromCellId} -> ${toCellId}: fromHeight=${fromHeight.toFixed(1)}, toHeight=${toHeight.toFixed(1)}, elevationChange=${elevationChange.toFixed(1)}, baseCost=${cost.toFixed(2)}, finalCost=${finalCost.toFixed(2)}`);
    
    return finalCost;
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
    if (this.riverCells.has(cellId)) {
      console.log(`    Obstacle check: Cell ${cellId} is existing river`);
      return true;
    }
    
    if (this.lakesGenerator && this.lakesGenerator.isLakeCell(cellId)) {
      // Lakes are targets, not obstacles, but check if it's the final destination
      console.log(`    Obstacle check: Cell ${cellId} is lake (but allowed as target)`);
      return false; // Allow rivers to flow into lakes
    }
    
    // Very high elevations are impassable obstacles
    const elevation = this.getCellElevation(cellId);
    if (elevation > 80) {
      console.log(`    Obstacle check: Cell ${cellId} is mountain peak (elevation: ${elevation})`);
      return true; // Mountain peaks are impassable
    }
    
    // Check if cell is completely surrounded by higher elevation (trapped valley)
    const neighborElevations = this.getNeighborElevations(cellId);
    const isTrappedValley = neighborElevations.length > 0 && 
      neighborElevations.every(h => h > elevation + 20);
    
    if (isTrappedValley) {
      console.log(`    Obstacle check: Cell ${cellId} is trapped valley (elevation: ${elevation}, neighbor elevations: [${neighborElevations.map(e => e.toFixed(1)).join(', ')}])`);
      return true; // Can't escape from deep valleys
    }

    console.log(`    Obstacle check: Cell ${cellId} is passable (elevation: ${elevation})`);
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
      cell.setMetadata('riverStartPoint', false);
      cell.setMetadata('riverEndPoint', false);
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

  selectParallelEdgeTargets(startCell) {
    const gridSize = this.settings.gridSize;
    const edgeTolerance = 20; // Distance from edge to consider "edge cell"
    const startSite = this.voronoiGenerator.cells.get(startCell)?.site;
    
    if (!startSite) {
      console.log('No start site found for parallel edge targeting');
      return [];
    }

    const startX = startSite.x;
    const startY = startSite.z || startSite.y || 0;

    // Determine which edge the start cell is on
    let startEdge = null;
    if (startX <= edgeTolerance) {
      startEdge = 'W'; // West edge
    } else if (startX >= (gridSize - edgeTolerance)) {
      startEdge = 'E'; // East edge
    } else if (startY <= edgeTolerance) {
      startEdge = 'N'; // North edge
    } else if (startY >= (gridSize - edgeTolerance)) {
      startEdge = 'S'; // South edge
    }

    if (!startEdge) {
      console.log('Start cell is not on any edge');
      return [];
    }

    // Determine parallel/opposite edge
    let targetEdge = null;
    switch (startEdge) {
      case 'N': targetEdge = 'S'; break; // North -> South
      case 'S': targetEdge = 'N'; break; // South -> North
      case 'E': targetEdge = 'W'; break; // East -> West
      case 'W': targetEdge = 'E'; break; // West -> East
    }

    console.log(`Start edge: ${startEdge}, Target edge: ${targetEdge}`);

    // Find cells on the target edge
    const targetCells = [];
    this.voronoiGenerator.cells.forEach((cell, cellId) => {
      const site = cell.site;
      if (!site) return;

      const x = site.x;
      const y = site.z || site.y || 0;

      let isOnTargetEdge = false;
      switch (targetEdge) {
        case 'N': // North edge (top)
          isOnTargetEdge = y <= edgeTolerance;
          break;
        case 'S': // South edge (bottom)
          isOnTargetEdge = y >= (gridSize - edgeTolerance);
          break;
        case 'E': // East edge (right)
          isOnTargetEdge = x >= (gridSize - edgeTolerance);
          break;
        case 'W': // West edge (left)
          isOnTargetEdge = x <= edgeTolerance;
          break;
      }

      if (isOnTargetEdge) {
        targetCells.push(cellId);
      }
    });

    console.log(`Found ${targetCells.length} target cells on ${targetEdge} edge`);
    return targetCells;
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
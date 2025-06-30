export class RiverPathfinder {
  constructor(voronoiGenerator, settings) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.voronoiEdgeGraph = null; // Graph of Voronoi edges for pathfinding
    this.riverCells = new Set(); // Reference to river cells from main generator
    this.coastlineGenerator = null;
    this.lakesGenerator = null;
    this.marshGenerator = null;
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

  setRiverCells(riverCells) {
    this.riverCells = riverCells;
  }

  // Build graph of Voronoi edges for pathfinding
  buildVoronoiPointGraph() {
    console.log('Building Voronoi point graph for pathfinding...');
    
    const voronoiDiagram = this.voronoiGenerator.getVoronoiDiagram();
    console.log(voronoiDiagram)
    if (!voronoiDiagram || !voronoiDiagram.getVoronoiEdgesWithCells) {
      console.error('Cannot get Voronoi edges with cell information');
      return;
    }

    const voronoiEdges = voronoiDiagram.getVoronoiEdgesWithCells();
    console.log(voronoiEdges)
    
    // Build adjacency list representation
    this.voronoiEdgeGraph = new Map();
    
    // Initialize adjacency lists for all cells
    this.voronoiGenerator.cells.forEach((cell, cellId) => {
      this.voronoiEdgeGraph.set(cellId, new Map());
    });
    
    // Add edges and calculate edge heights
    voronoiEdges.forEach(edge => {

      const pointA = edge.pointA;
      const pointB = edge.pointB;
      console.log(pointA, pointB)
      
      // Add bidirectional edges in adjacency list
      // this.voronoiEdgeGraph.get(cellA)?.set(cellB, {
      //   edgeId: edgeId,
      //   edgeHeight: edgeHeight,
      //   neighborHeight: heightB
      // });
      
      // this.voronoiEdgeGraph.get(cellB)?.set(cellA, {
      //   edgeId: edgeId,
      //   edgeHeight: edgeHeight,
      //   neighborHeight: heightA
      // });
    });
    
    console.log(`Built Voronoi edge graph with ${voronoiEdges.length} edges`);
  }

  findPathToWater(startCellId, targetCells) {
    console.log(`=== A* PATHFINDING DEBUG ===`);
    console.log(`Starting pathfinding from cell ${startCellId} to targets:`, targetCells);
    console.log(`Number of target cells: ${targetCells.length}`);
    
    // Validate start cell
    const startCell = this.voronoiGenerator.cells.get(startCellId);
    if (!startCell) {
      console.log(`ERROR: Start cell ${startCellId} not found in Voronoi cells!`);
      return [];
    }
    
    if (!this.voronoiEdgeGraph.has(startCellId)) {
      console.log(`ERROR: Start cell ${startCellId} not found in Voronoi edge graph!`);
      return [];
    }
    
    console.log(`Start cell validation passed.`);
    
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
      
      // Check if current cell exists in our edge graph
      if (!this.voronoiEdgeGraph.has(current)) {
        console.log(`ERROR: Current cell ${current} not found in Voronoi edge graph!`);
        continue;
      }

      console.log(`Current cell elevation: ${this.getCellElevation(current)}`);

      // Check all neighbors using Voronoi edge graph
      let validNeighbors = 0;
      let addedToOpenSet = 0;
      
      const neighbors = this.voronoiEdgeGraph.get(current);
      if (!neighbors) {
        console.log(`ERROR: No neighbors found in Voronoi edge graph for cell ${current}`);
        continue;
      }
      
      for (const [neighborId, edgeInfo] of neighbors) {
        console.log(`\n  Evaluating neighbor: ${neighborId} via edge ${edgeInfo.edgeId}`);
        
        // Skip if neighbor is already a river
        if (this.isObstacle(neighborId)) {
          console.log(`    SKIP: Neighbor ${neighborId} is an obstacle`);
          continue;
        }

        const neighborElevation = this.getCellElevation(neighborId);
        const movementCost = this.getEdgeMovementCost(current, neighborId);
        const currentG = gScore.get(current) || 0;
        const tentativeG = currentG + movementCost;
        const existingG = gScore.get(neighborId);

        console.log(`    Neighbor elevation: ${neighborElevation}`);
        console.log(`    Edge height: ${edgeInfo.edgeHeight}`);
        console.log(`    Movement cost: ${movementCost}`);
        console.log(`    Current gScore: ${currentG}`);
        console.log(`    Tentative gScore: ${tentativeG} (existing: ${existingG || 'undefined'})`);

        // Check if this is a better path OR if neighbor hasn't been visited yet
        if (existingG === undefined || tentativeG < existingG) {
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
            addedToOpenSet++;
          }
          validNeighbors++;
        } else {
          console.log(`    SKIP: No better path to neighbor ${neighborId} (existing: ${existingG}, tentative: ${tentativeG})`);
        }
      }

      console.log(`Valid neighbors processed: ${validNeighbors}, Added to open set: ${addedToOpenSet}`);
      
      // Safety check: if no neighbors were added and we're not at a target, something is wrong
      if (addedToOpenSet === 0 && validNeighbors === 0) {
        console.log(`WARNING: No valid neighbors found for cell ${current}. This might indicate an isolated cell or all neighbors are obstacles.`);
      }
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
    
    if (targetCells.length === 0) {
      console.log(`    Heuristic WARNING: No target cells provided!`);
      return 0; // Return 0 instead of Infinity if no targets
    }
    
    for (const targetId of targetCells) {
      const targetCell = this.voronoiGenerator.cells.get(targetId);
      if (targetCell && targetCell.site) {
        // Calculate straight-line distance
        const dx = cell.site.x - targetCell.site.x;
        const dy = (cell.site.z || cell.site.y || 0) - (targetCell.site.z || targetCell.site.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Factor in elevation difference - much more lenient
        const targetElevation = this.getCellElevation(targetId);
        const elevationDiff = currentElevation - targetElevation;
        
        // Prefer downhill but don't heavily penalize uphill
        let elevationCost = 0;
        if (elevationDiff < 0) {
          // Going uphill to target - very light penalty
          elevationCost = Math.abs(elevationDiff) * 0.1;
        } else {
          // Going downhill to target - strong bonus
          elevationCost = -elevationDiff * 0.3; // Increased bonus for downhill targets
        }
        
        const totalCost = distance + elevationCost;
        console.log(`      Target ${targetId}: distance=${distance.toFixed(2)}, elevationDiff=${elevationDiff.toFixed(2)}, elevationCost=${elevationCost.toFixed(2)}, totalCost=${totalCost.toFixed(2)}`);
        minCost = Math.min(minCost, totalCost);
      } else {
        console.log(`      Target ${targetId}: INVALID (no cell or site)`);
      }
    }

    // Safety check: if all targets were invalid, return a reasonable default
    if (minCost === Infinity) {
      console.log(`    Heuristic WARNING: All targets were invalid, returning default cost`);
      minCost = 100; // Reasonable default cost
    }

    console.log(`    Final heuristic for cell ${cellId}: ${minCost.toFixed(2)}`);
    return minCost;
  }

  getEdgeMovementCost(fromCellId, toCellId) {
    const edgeInfo = this.voronoiEdgeGraph.get(fromCellId)?.get(toCellId);
    if (!edgeInfo) {
      return Infinity; // No edge exists
    }
    
    const fromHeight = this.getCellElevation(fromCellId);
    const toHeight = this.getCellElevation(toCellId);
    const edgeHeight = edgeInfo.edgeHeight;
    
    // Base cost
    let cost = 1;
    
    // Calculate elevation change: water flows from edge height
    const elevationChange = toHeight - edgeHeight;
    
    // Strongly prefer flowing downhill from the edge
    if (elevationChange <= 0) {
      // Flowing downhill from edge - strongly preferred
      const downhillBonus = Math.abs(elevationChange) * 0.3;
      cost = Math.max(0.01, 1 - downhillBonus);
    } else {
      // Flowing uphill from edge - penalized but passable
      const uphillPenalty = elevationChange * 0.8;
      cost = 1 + uphillPenalty;
    }
    
    // Additional terrain modifiers
    if (this.marshGenerator && this.marshGenerator.isMarshCell(toCellId)) {
      cost *= 0.3; // Strong preference for marshes
    }
    
    // Prefer lower edges (valleys)
    if (edgeHeight < 20) {
      cost *= 0.5; // Strong preference for low elevation edges
    }
    
    const finalCost = Math.max(0.01, cost);
    
    console.log(`    Edge cost ${fromCellId} -> ${toCellId}: edgeHeight=${edgeHeight.toFixed(1)}, toHeight=${toHeight.toFixed(1)}, elevationChange=${elevationChange.toFixed(1)}, finalCost=${finalCost.toFixed(2)}`);
    
    return finalCost;
  }

  getMovementCost(fromCellId, toCellId) {
    // Get heights for elevation-based movement cost
    const fromHeight = this.getCellElevation(fromCellId);
    const toHeight = this.getCellElevation(toCellId);
    const elevationChange = toHeight - fromHeight;

    // Base cost - much more permissive
    let cost = 1;

    // Elevation-based cost calculation - emphasize preference, not prohibition
    if (elevationChange <= 0) {
      // Flowing downhill or staying level - strongly preferred
      const downhillBonus = Math.abs(elevationChange) * 0.2; // Increased bonus for steeper downhill
      cost = Math.max(0.01, 1 - downhillBonus); // Very low cost for downhill
    } else {
      // Flowing uphill - penalized but still passable
      const uphillPenalty = elevationChange * 0.5; // Much smaller penalty
      cost = 1 + uphillPenalty;
      
      // Even for significant uphill, keep it reasonable
      if (elevationChange > 20) {
        cost += elevationChange * 0.1; // Very light additional penalty
      }
    }

    // Additional terrain modifiers
    // Lower cost for marshes (rivers like wetlands)
    if (this.marshGenerator && this.marshGenerator.isMarshCell(toCellId)) {
      cost *= 0.5; // Strong preference for flowing through marshes
    }

    // Slight penalty for very high elevations (mountains) - but still passable
    if (toHeight > 80) {
      cost *= 1.1; // Very light penalty
    }

    // Strong bonus for flowing toward lower-elevation neighbors
    const toNeighborHeights = this.getNeighborElevations(toCellId);
    const hasLowerNeighbors = toNeighborHeights.some(h => h < toHeight);
    if (hasLowerNeighbors) {
      cost *= 0.3; // Strong preference for cells that have downhill exits
    }

    const finalCost = Math.max(0.01, cost); // Very low minimum cost to allow all paths
    
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
    // Rivers can't flow through existing rivers (they merge instead)
    if (this.riverCells.has(cellId)) {
      console.log(`    Obstacle check: Cell ${cellId} is existing river`);
      return true;
    }
    
    // Lakes and marshes are always passable (rivers can flow through them)
    if (this.lakesGenerator && this.lakesGenerator.isLakeCell(cellId)) {
      console.log(`    Obstacle check: Cell ${cellId} is lake (passable)`);
      return false;
    }
    
    if (this.marshGenerator && this.marshGenerator.isMarshCell(cellId)) {
      console.log(`    Obstacle check: Cell ${cellId} is marsh (passable)`);
      return false;
    }

    // Remove most elevation-based obstacles - rivers should be able to go anywhere
    // Only block extremely unrealistic scenarios
    const elevation = this.getCellElevation(cellId);
    
    // Only block impossibly high elevations (like 150+ units)
    if (elevation > 150) {
      console.log(`    Obstacle check: Cell ${cellId} is impossibly high peak (elevation: ${elevation})`);
      return true;
    }

    // Remove trapped valley check - rivers should find a way even through difficult terrain
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

  // Helper method to calculate distance between two cells
  getDistanceBetweenCells(cellId1, cellId2) {
    const cell1 = this.voronoiGenerator.cells.get(cellId1);
    const cell2 = this.voronoiGenerator.cells.get(cellId2);
    
    if (!cell1 || !cell2 || !cell1.site || !cell2.site) {
      return Infinity;
    }
    
    const dx = cell1.site.x - cell2.site.x;
    const dy = (cell1.site.z || cell1.site.y || 0) - (cell2.site.z || cell2.site.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }
} 
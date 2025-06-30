import { Point, Edge, Triangle, HalfEdge, VoronoiEdge, GeometryUtils } from '../voronoi/GeometryTypes.js';
import { RiverPathfinder } from './RiverPathfinder.js';

/**
 * Rivers generator using typed geometry and pathfinding
 */
export class RiversGenerator {
  /**
   * @param {Object} voronoiGenerator - Voronoi diagram generator
   * @param {Object} settings - Generator settings
   */
  constructor(voronoiGenerator, settings) {
    /** @type {Object} */
    this.voronoiGenerator = voronoiGenerator;
    /** @type {Object} */
    this.settings = settings;
    /** @type {Set<number>} */
    this.riverCells = new Set();
    /** @type {Array<Array<number>>} */
    this.riverPaths = [];
    /** @type {Object|null} */
    this.coastlineGenerator = null;
    /** @type {Object|null} */
    this.lakesGenerator = null;
    /** @type {Object|null} */
    this.marshGenerator = null;
    /** @type {Set<number>} */
    this.usedStartPoints = new Set();
    /** @type {Set<number>} */
    this.usedEndPoints = new Set();
    /** @type {number} */
    this.minSeparationDistance = 50;
    
    /** @type {RiverPathfinder} */
    this.pathfinder = new RiverPathfinder(voronoiGenerator, settings);
  }

  generateRivers(numRivers = 2) {
    if (!this.voronoiGenerator || !this.voronoiGenerator.cells || this.voronoiGenerator.cells.size === 0) {
      console.error('RiversGenerator: No Voronoi diagram available');
      return [];
    }

    this.clearRivers();
    
    // Setup pathfinder with current state
    this.setupPathfinder();
    
    // console.log(`Generating ${numRivers} rivers...`);

    // for (let i = 0; i < numRivers; i++) {
    //   const river = this.generateSingleRiver(i);
    //   if (river.length > 0) {
    //     this.riverPaths.push(river);
    //     console.log(`Generated river ${i + 1} with ${river.length} cells`);
    //   }
    // }

    // console.log(`Rivers generation complete. Total paths: ${this.riverPaths.length}, total cells: ${this.riverCells.size}`);
    // return this.riverPaths;
  }

  setupPathfinder() {
    // Set references to other generators
    this.pathfinder.setCoastlineGenerator(this.coastlineGenerator);
    this.pathfinder.setLakesGenerator(this.lakesGenerator);
    this.pathfinder.setMarshGenerator(this.marshGenerator);
    this.pathfinder.setHillsGenerator(this.settings.hillsGenerator);
    this.pathfinder.setRiverCells(this.riverCells);
    
    // Build Voronoi edge graph for pathfinding
    this.pathfinder.buildVoronoiPointGraph();
  }

  generateSingleRiver(riverIndex) {
    console.log(`\n=== GENERATING SINGLE RIVER ${riverIndex + 1} ===`);
    
    // Step 1: Select a random edge as starting point (non-coastal edge)
    const startCell = this.selectEdgeStartPoint();
    if (!startCell) {
      console.log(`FAILURE: No valid start point found for river ${riverIndex + 1}`);
      return [];
    }

    // Mark start point immediately and add to used points
    const startCellObj = this.voronoiGenerator.cells.get(startCell);
    if (startCellObj) {
      startCellObj.setMetadata('riverStartPoint', true);
      startCellObj.setMetadata('riverIndex', riverIndex);
      this.usedStartPoints.add(startCell);
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

    // Mark end point immediately (choose closest valid target)
    if (targets.length > 0) {
      let endPointId = null;
      
      // Filter targets to exclude those too close to used end points
      const validTargets = targets.filter(targetId => 
        !this.isTooCloseToUsedPoints(targetId, this.usedEndPoints)
      );
      
      if (validTargets.length === 0) {
        console.log(`No valid end targets (all too close to existing end points), using closest anyway`);
        endPointId = targets[0]; // Fallback to first target
      } else {
        endPointId = validTargets[0]; // Default to first valid target
        
        // If multiple valid targets, find the closest one to start point
        if (validTargets.length > 1 && startCellObj?.site) {
          let minDistance = Infinity;
          const startSite = startCellObj.site;
          
          for (const targetId of validTargets) {
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
      }
      
      const endCellObj = this.voronoiGenerator.cells.get(endPointId);
      if (endCellObj) {
        endCellObj.setMetadata('riverEndPoint', true);
        endCellObj.setMetadata('riverIndex', riverIndex);
        this.usedEndPoints.add(endPointId);
        console.log(`Marked end point: ${endPointId}`);
      }
    }

    // Log elevation info for debugging
    const startElevation = this.getCellElevation(startCell);
    console.log(`River ${riverIndex + 1}: Starting at cell ${startCell}, elevation ${Math.round(startElevation)}`);

    // Step 3: Use A* pathfinding to find path to nearest water target
    console.log(`Starting A* pathfinding from ${startCell} to ${targets.length} targets...`);
    const path = this.pathfinder.findPathToWater(startCell, targets);
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
    const edgeTolerance = 100; // Distance from edge to consider "edge cell"
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
      
      console.log(isNearEdge, x, y, gridSize, edgeTolerance)

      if (isNearEdge) {
        // Check if this cell is too close to previously used start points
        if (this.isTooCloseToUsedPoints(cellId, this.usedStartPoints)) {
          console.log(`Skipping edge cell ${cellId} at (${x.toFixed(1)}, ${y.toFixed(1)}) - too close to existing start point`);
          return;
        }
        
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
    this.usedStartPoints.clear();
    this.usedEndPoints.clear();
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
    const edgeTolerance = 100; // Distance from edge to consider "edge cell"
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

  // Check if a cell is too close to any used points
  isTooCloseToUsedPoints(cellId, usedPoints) {
    for (const usedCellId of usedPoints) {
      if (this.getDistanceBetweenCells(cellId, usedCellId) < this.minSeparationDistance) {
        return true;
      }
    }
    return false;
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
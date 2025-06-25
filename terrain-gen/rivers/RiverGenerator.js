export class RiverGenerator {
  constructor(terrainData, settings) {
    this.terrainData = terrainData;
    this.settings = settings;
  }

  generateRivers() {
    if (!this.settings.riverGeneration || !this.settings.riverGeneration.enabled) {
      return;
    }

    const { gridSize } = this.settings;
    const { 
      minControlPoints, 
      maxControlPoints, 
      randomOffset, 
      minWidth, 
      maxWidth, 
      curveResolution, 
      candidateCount, 
      topPercentage, 
      minBranches, 
      maxBranches 
    } = this.settings.riverGeneration;
    
    // Step 1: Generate multiple river candidates and select the best by length
    const bestRiver = this.selectBestRiverCandidate(
      gridSize, 
      candidateCount, 
      topPercentage, 
      minControlPoints, 
      maxControlPoints, 
      randomOffset, 
      curveResolution
    );
    
    // Step 2: Create main river feature
    const mainRiverFeature = this.terrainData.createFeature('river');
    this.configureRiverFeature(mainRiverFeature, bestRiver, 'main');
    
    // Step 3: Generate river branches
    const branches = this.generateRiverBranches(
      bestRiver, 
      gridSize, 
      minBranches, 
      maxBranches, 
      minControlPoints, 
      maxControlPoints, 
      randomOffset, 
      curveResolution
    );
    
    // Step 4: Apply main river width to create river tiles
    const mainRiverTiles = this.applyRiverToTiles(bestRiver.path, minWidth, maxWidth);
    mainRiverFeature.addAffectedTiles(mainRiverTiles);
    mainRiverFeature.calculateCentroidFromBezierCurves();
    
    // Step 5: Apply branch widths to create river tiles
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      const branchFeature = this.terrainData.createFeature('river');
      this.configureRiverFeature(branchFeature, branch, `branch_${i}`);
      
      const branchTiles = this.applyRiverToTiles(branch.path, minWidth * 0.7, maxWidth * 0.7);
      branchFeature.addAffectedTiles(branchTiles);
      branchFeature.calculateCentroidFromBezierCurves();
      branchFeature.setMetadata('parentRiver', mainRiverFeature.id);
    }
  }

  configureRiverFeature(feature, riverData, subtype) {
    // Add bezier curve data
    feature.addBezierCurve([riverData.startPoint, ...riverData.controlPoints, riverData.endPoint]);
    
    // Add point distributions
    feature.addPointDistribution(riverData.path);
    
    // Set metadata
    feature.setMetadata('subtype', subtype);
    feature.setMetadata('length', riverData.length);
    feature.setMetadata('startPoint', riverData.startPoint);
    feature.setMetadata('endPoint', riverData.endPoint);
    feature.setMetadata('controlPoints', riverData.controlPoints);
  }

  selectBestRiverCandidate(gridSize, candidateCount, topPercentage, minControlPoints, maxControlPoints, randomOffset, curveResolution) {
    const candidates = [];
    
    // Generate multiple river candidates
    for (let i = 0; i < candidateCount; i++) {
      const { startPoint, endPoint } = this.generateRiverEndpoints(gridSize);
      const numControlPoints = Math.floor(Math.random() * (maxControlPoints - minControlPoints + 1)) + minControlPoints;
      const controlPoints = this.generateRiverControlPoints(startPoint, endPoint, numControlPoints, randomOffset, gridSize);
      const riverPath = this.generateBezierCurve([startPoint, ...controlPoints, endPoint], curveResolution);
      const length = this.calculateRiverLength(riverPath);
      
      candidates.push({
        startPoint,
        endPoint,
        controlPoints,
        path: riverPath,
        length: length
      });
    }
    
    // Sort by length (longest first)
    candidates.sort((a, b) => b.length - a.length);
    
    // Select randomly from top percentage
    const topCount = Math.max(1, Math.ceil(candidates.length * (topPercentage / 100)));
    const topCandidates = candidates.slice(0, topCount);
    const selectedIndex = Math.floor(Math.random() * topCandidates.length);
    
    return topCandidates[selectedIndex];
  }

  calculateRiverLength(riverPath) {
    let totalLength = 0;
    
    for (let i = 1; i < riverPath.length; i++) {
      const prev = riverPath[i - 1];
      const curr = riverPath[i];
      const segmentLength = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.z - prev.z, 2)
      );
      totalLength += segmentLength;
    }
    
    return totalLength;
  }

  generateRiverEndpoints(gridSize) {
    // Choose two different edges randomly
    const edges = ['north', 'south', 'east', 'west'];
    const startEdge = edges[Math.floor(Math.random() * edges.length)];
    let endEdge;
    do {
      endEdge = edges[Math.floor(Math.random() * edges.length)];
    } while (endEdge === startEdge);
    
    const getPointOnEdge = (edge) => {
      switch (edge) {
        case 'north':
          return { x: Math.random() * gridSize, z: 0 };
        case 'south':
          return { x: Math.random() * gridSize, z: gridSize - 1 };
        case 'east':
          return { x: gridSize - 1, z: Math.random() * gridSize };
        case 'west':
          return { x: 0, z: Math.random() * gridSize };
      }
    };
    
    return {
      startPoint: getPointOnEdge(startEdge),
      endPoint: getPointOnEdge(endEdge)
    };
  }

  generateRiverControlPoints(startPoint, endPoint, numControlPoints, maxOffset, gridSize) {
    const controlPoints = [];
    
    for (let i = 1; i <= numControlPoints; i++) {
      const t = i / (numControlPoints + 1);
      
      // Linear interpolation between start and end
      const baseX = startPoint.x + (endPoint.x - startPoint.x) * t;
      const baseZ = startPoint.z + (endPoint.z - startPoint.z) * t;
      
      // Apply random offset
      const offsetX = (Math.random() - 0.5) * maxOffset * 2;
      const offsetZ = (Math.random() - 0.5) * maxOffset * 2;
      
      // Clamp to grid bounds
      const x = Math.max(0, Math.min(gridSize - 1, baseX + offsetX));
      const z = Math.max(0, Math.min(gridSize - 1, baseZ + offsetZ));
      
      controlPoints.push({ x, z });
    }
    
    return controlPoints;
  }

  generateBezierCurve(controlPoints, resolution) {
    const curvePoints = [];
    
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      const point = this.calculateBezierPoint(controlPoints, t);
      curvePoints.push(point);
    }
    
    return curvePoints;
  }

  calculateBezierPoint(controlPoints, t) {
    const n = controlPoints.length - 1;
    let x = 0;
    let z = 0;
    
    for (let i = 0; i <= n; i++) {
      const binomial = this.binomialCoefficient(n, i);
      const factor = binomial * Math.pow(1 - t, n - i) * Math.pow(t, i);
      x += factor * controlPoints[i].x;
      z += factor * controlPoints[i].z;
    }
    
    return { x, z };
  }

  binomialCoefficient(n, k) {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 0; i < k; i++) {
      result *= (n - i) / (i + 1);
    }
    return result;
  }

  generateRiverBranches(mainRiver, gridSize, minBranches, maxBranches, minControlPoints, maxControlPoints, randomOffset, curveResolution) {
    const numBranches = Math.floor(Math.random() * (maxBranches - minBranches + 1)) + minBranches;
    const branches = [];
    const allRivers = [mainRiver]; // Track all rivers for potential branching sources
    
    for (let b = 0; b < numBranches; b++) {
      // Select a source river (main river or existing branch)
      const sourceRiver = allRivers[Math.floor(Math.random() * allRivers.length)];
      
      // Select branch source point 1/3 down the source river
      const branchIndex = Math.floor(sourceRiver.path.length / 3);
      const branchSourcePoint = sourceRiver.path[branchIndex];
      
      // Generate random edge point for branch destination
      const branchEndPoint = this.generateRandomEdgePoint(gridSize);
      
      // Generate control points for the branch
      const numControlPoints = Math.floor(Math.random() * (maxControlPoints - minControlPoints + 1)) + minControlPoints;
      const controlPoints = this.generateRiverControlPoints(branchSourcePoint, branchEndPoint, numControlPoints, randomOffset, gridSize);
      
      // Generate branch path
      const branchPath = this.generateBezierCurve([branchSourcePoint, ...controlPoints, branchEndPoint], curveResolution);
      
      const branch = {
        startPoint: branchSourcePoint,
        endPoint: branchEndPoint,
        controlPoints,
        path: branchPath,
        length: this.calculateRiverLength(branchPath),
        sourceRiver: sourceRiver
      };
      
      branches.push(branch);
      allRivers.push(branch); // Add to potential branching sources for future branches
    }
    
    return branches;
  }

  generateRandomEdgePoint(gridSize) {
    const edges = ['north', 'south', 'east', 'west'];
    const edge = edges[Math.floor(Math.random() * edges.length)];
    
    switch (edge) {
      case 'north':
        return { x: Math.random() * gridSize, z: 0 };
      case 'south':
        return { x: Math.random() * gridSize, z: gridSize - 1 };
      case 'east':
        return { x: gridSize - 1, z: Math.random() * gridSize };
      case 'west':
        return { x: 0, z: Math.random() * gridSize };
      default:
        return { x: 0, z: 0 };
    }
  }

  applyRiverToTiles(riverPath, minWidth, maxWidth) {
    const affectedTiles = [];
    
    for (let i = 0; i < riverPath.length; i++) {
      const point = riverPath[i];
      
      // Vary width along the river (wider in middle, narrower at ends)
      const widthProgress = Math.sin((i / riverPath.length) * Math.PI);
      const currentWidth = minWidth + (maxWidth - minWidth) * widthProgress;
      
      // Apply river tiles in a circle around each point
      const radius = Math.ceil(currentWidth / 2);
      
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const distance = Math.sqrt(dx * dx + dz * dz);
          
          if (distance <= radius) {
            const tileX = Math.floor(point.x + dx);
            const tileZ = Math.floor(point.z + dz);
            
            const tile = this.terrainData.getTileAt(tileX, tileZ);
            if (tile) {
              tile.setTileType('water');
              tile.setBuildable(false);
              
              // Set river tiles to slightly below water level
              const { waterLevel } = this.settings;
              tile.setHeight(Math.min(tile.height, waterLevel - 0.5));
              
              affectedTiles.push({ x: tileX, z: tileZ });
            }
          }
        }
      }
    }
    
    return affectedTiles;
  }
}
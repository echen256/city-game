export class TerrainFeature {
  constructor(type, id) {
    this.type = type; // 'river', 'lake', 'coastline', etc.
    this.id = id;
    this.centroid = { x: 0, z: 0 }; // Geometric center of the feature
    this.bezierCurves = []; // Array of bezier curve control points
    this.pointDistributions = []; // Array of point sets used in creation
    this.affectedTiles = []; // Array of {x, z} coordinates of modified tiles
    this.metadata = {}; // Feature-specific data
  }

  setCentroid(x, z) {
    this.centroid = { x, z };
    return this;
  }

  addBezierCurve(controlPoints) {
    this.bezierCurves.push([...controlPoints]);
    return this;
  }

  addPointDistribution(points) {
    this.pointDistributions.push([...points]);
    return this;
  }

  addAffectedTile(x, z) {
    this.affectedTiles.push({ x, z });
    return this;
  }

  addAffectedTiles(tiles) {
    this.affectedTiles.push(...tiles);
    return this;
  }

  setMetadata(key, value) {
    this.metadata[key] = value;
    return this;
  }

  getMetadata(key) {
    return this.metadata[key];
  }

  calculateCentroidFromTiles() {
    if (this.affectedTiles.length === 0) return this;

    let sumX = 0;
    let sumZ = 0;
    for (const tile of this.affectedTiles) {
      sumX += tile.x;
      sumZ += tile.z;
    }

    this.centroid = {
      x: sumX / this.affectedTiles.length,
      z: sumZ / this.affectedTiles.length
    };

    return this;
  }

  calculateCentroidFromBezierCurves() {
    if (this.bezierCurves.length === 0) return this;

    let sumX = 0;
    let sumZ = 0;
    let pointCount = 0;

    for (const curve of this.bezierCurves) {
      for (const point of curve) {
        sumX += point.x;
        sumZ += point.z;
        pointCount++;
      }
    }

    if (pointCount > 0) {
      this.centroid = {
        x: sumX / pointCount,
        z: sumZ / pointCount
      };
    }

    return this;
  }

  toJSON() {
    return {
      type: this.type,
      id: this.id,
      centroid: this.centroid,
      bezierCurves: this.bezierCurves,
      pointDistributions: this.pointDistributions,
      affectedTiles: this.affectedTiles,
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    const feature = new TerrainFeature(data.type, data.id);
    feature.centroid = data.centroid || { x: 0, z: 0 };
    feature.bezierCurves = data.bezierCurves || [];
    feature.pointDistributions = data.pointDistributions || [];
    feature.affectedTiles = data.affectedTiles || [];
    feature.metadata = data.metadata || {};
    return feature;
  }
}

export class TerrainData {
  constructor(tileGrid) {
    this.tileGrid = tileGrid;
    this.features = new Map(); // Map<featureId, TerrainFeature>
    this.featureCounter = 0;
  }

  generateFeatureId(type) {
    return `${type}_${++this.featureCounter}`;
  }

  addFeature(feature) {
    this.features.set(feature.id, feature);
    return feature;
  }

  createFeature(type) {
    const id = this.generateFeatureId(type);
    const feature = new TerrainFeature(type, id);
    return this.addFeature(feature);
  }

  getFeature(id) {
    return this.features.get(id);
  }

  getFeaturesByType(type) {
    const result = [];
    for (const feature of this.features.values()) {
      if (feature.type === type) {
        result.push(feature);
      }
    }
    return result;
  }

  removeFeature(id) {
    return this.features.delete(id);
  }

  getAllFeatures() {
    return Array.from(this.features.values());
  }

  clearFeatures() {
    this.features.clear();
    this.featureCounter = 0;
  }

  // Helper methods for common operations
  getTileAt(x, z) {
    return this.tileGrid.getTile(x, z);
  }

  setTileType(x, z, type) {
    const tile = this.getTileAt(x, z);
    if (tile) {
      tile.setTileType(type);
    }
  }

  setTileHeight(x, z, height) {
    const tile = this.getTileAt(x, z);
    if (tile) {
      tile.setHeight(height);
    }
  }

  // Statistics and analysis
  getFeatureStats() {
    const stats = {};
    for (const feature of this.features.values()) {
      if (!stats[feature.type]) {
        stats[feature.type] = 0;
      }
      stats[feature.type]++;
    }
    return stats;
  }

  getFeatureCoverage() {
    const totalTiles = this.tileGrid.gridSize * this.tileGrid.gridSize;
    let coveredTiles = new Set();

    for (const feature of this.features.values()) {
      for (const tile of feature.affectedTiles) {
        coveredTiles.add(`${tile.x},${tile.z}`);
      }
    }

    return {
      totalTiles,
      coveredTiles: coveredTiles.size,
      coveragePercentage: (coveredTiles.size / totalTiles) * 100
    };
  }

  toJSON() {
    return {
      features: Array.from(this.features.values()).map(f => f.toJSON()),
      featureCounter: this.featureCounter
    };
  }

  static fromJSON(data, tileGrid) {
    const terrainData = new TerrainData(tileGrid);
    terrainData.featureCounter = data.featureCounter || 0;
    
    if (data.features) {
      for (const featureData of data.features) {
        const feature = TerrainFeature.fromJSON(featureData);
        terrainData.features.set(feature.id, feature);
      }
    }

    return terrainData;
  }
}
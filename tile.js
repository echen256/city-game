export class Tile {
  constructor(x, z, height = 0) {
    this.x = x;
    this.z = z;
    this.height = height;
    this.buildable = true;
    this.tileType = 'ground';
    this.building = null;
    this.slope = 0;
    this.isStreet = false;
    this.metadata = {};
  }

  setBuildable(buildable) {
    this.buildable = buildable;
    return this;
  }

  setTileType(type) {
    this.tileType = type; // 'ground', 'water', 'rock', 'street', etc.
    return this;
  }

  setHeight(height) {
    this.height = height;
    return this;
  }

  setSlope(slope) {
    this.slope = slope;
    return this;
  }

  setStreet(isStreet) {
    this.isStreet = isStreet;
    if (isStreet) {
      this.buildable = false;
    }
    return this;
  }

  setBuilding(building) {
    this.building = building;
    if (building) {
      this.buildable = false;
    }
    return this;
  }

  removeBuilding() {
    this.building = null;
    this.updateBuildableStatus();
    return this;
  }

  setMetadata(key, value) {
    this.metadata[key] = value;
    return this;
  }

  getMetadata(key) {
    return this.metadata[key];
  }

  updateBuildableStatus() {
    // Update buildable status based on various factors
    this.buildable = true;

    // Can't build on streets
    if (this.isStreet) {
      this.buildable = false;
      return;
    }

    // Can't build if there's already a building
    if (this.building) {
      this.buildable = false;
      return;
    }

    // Can't build on steep slopes
    if (this.slope > 2) {
      this.buildable = false;
      return;
    }

    // Can't build on certain tile types
    if (this.tileType === 'water' || this.tileType === 'rock') {
      this.buildable = false;
      return;
    }

    // Can't build on extreme heights (too low or too high)
    if (this.height < -8 || this.height > 15) {
      this.buildable = false;
      return;
    }
  }

  canBuildHere() {
    return this.buildable && !this.building && !this.isStreet;
  }

  getWorldPosition(gridSize, tileSize = 1) {
    return {
      x: (this.x - gridSize / 2) * tileSize,
      z: (this.z - gridSize / 2) * tileSize,
      y: this.height
    };
  }

  getNeighborCoordinates() {
    return [
      { x: this.x - 1, z: this.z },     // Left
      { x: this.x + 1, z: this.z },     // Right
      { x: this.x, z: this.z - 1 },     // Up
      { x: this.x, z: this.z + 1 },     // Down
      { x: this.x - 1, z: this.z - 1 }, // Top-left
      { x: this.x + 1, z: this.z - 1 }, // Top-right
      { x: this.x - 1, z: this.z + 1 }, // Bottom-left
      { x: this.x + 1, z: this.z + 1 }  // Bottom-right
    ];
  }

  toString() {
    return `Tile(${this.x},${this.z}) [h:${this.height.toFixed(1)}, buildable:${this.buildable}, type:${this.tileType}]`;
  }

  toJSON() {
    return {
      x: this.x,
      z: this.z,
      height: this.height,
      buildable: this.buildable,
      tileType: this.tileType,
      isStreet: this.isStreet,
      slope: this.slope,
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    const tile = new Tile(data.x, data.z, data.height);
    tile.buildable = data.buildable;
    tile.tileType = data.tileType;
    tile.isStreet = data.isStreet;
    tile.slope = data.slope;
    tile.metadata = data.metadata || {};
    return tile;
  }
}

export class TileGrid {
  constructor(gridSize) {
    this.gridSize = gridSize;
    this.tiles = new Map();
    this.initializeGrid();
  }

  initializeGrid() {
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const tile = new Tile(x, z);
        this.tiles.set(this.getKey(x, z), tile);
      }
    }
  }

  getKey(x, z) {
    return `${x},${z}`;
  }

  getTile(x, z) {
    if (x < 0 || x >= this.gridSize || z < 0 || z >= this.gridSize) {
      return null;
    }
    return this.tiles.get(this.getKey(x, z)) || null;
  }

  setTile(x, z, tile) {
    if (x >= 0 && x < this.gridSize && z >= 0 && z < this.gridSize) {
      this.tiles.set(this.getKey(x, z), tile);
    }
  }

  getTileAtWorldPosition(worldX, worldZ, tileSize = 1) {
    const tileX = Math.floor(worldX + this.gridSize / 2);
    const tileZ = Math.floor(worldZ + this.gridSize / 2);
    return this.getTile(tileX, tileZ);
  }

  getNeighbors(x, z) {
    const neighbors = [];
    const neighborCoords = [
      { x: x - 1, z: z },     // Left
      { x: x + 1, z: z },     // Right
      { x: x, z: z - 1 },     // Up
      { x: x, z: z + 1 }      // Down
    ];

    for (const coord of neighborCoords) {
      const tile = this.getTile(coord.x, coord.z);
      if (tile) {
        neighbors.push(tile);
      }
    }

    return neighbors;
  }

  getAllNeighbors(x, z) {
    const neighbors = [];
    const tile = this.getTile(x, z);
    if (!tile) return neighbors;

    for (const coord of tile.getNeighborCoordinates()) {
      const neighborTile = this.getTile(coord.x, coord.z);
      if (neighborTile) {
        neighbors.push(neighborTile);
      }
    }

    return neighbors;
  }

  getBuildableTiles() {
    const buildableTiles = [];
    for (const tile of this.tiles.values()) {
      if (tile.canBuildHere()) {
        buildableTiles.push(tile);
      }
    }
    return buildableTiles;
  }

  getTilesByType(tileType) {
    const typedTiles = [];
    for (const tile of this.tiles.values()) {
      if (tile.tileType === tileType) {
        typedTiles.push(tile);
      }
    }
    return typedTiles;
  }

  calculateSlopes() {
    for (const tile of this.tiles.values()) {
      const neighbors = this.getNeighbors(tile.x, tile.z);
      let maxHeightDiff = 0;

      for (const neighbor of neighbors) {
        const heightDiff = Math.abs(tile.height - neighbor.height);
        maxHeightDiff = Math.max(maxHeightDiff, heightDiff);
      }

      tile.setSlope(maxHeightDiff);
      tile.updateBuildableStatus();
    }
  }

  markStreets(streetWidth, blockSize) {
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const isStreetX = x % (blockSize + streetWidth) < streetWidth;
        const isStreetZ = z % (blockSize + streetWidth) < streetWidth;
        
        if (isStreetX || isStreetZ) {
          const tile = this.getTile(x, z);
          if (tile) {
            tile.setStreet(true);
          }
        }
      }
    }
  }

  clear() {
    this.tiles.clear();
    this.initializeGrid();
  }

  toJSON() {
    const data = {
      gridSize: this.gridSize,
      tiles: []
    };

    for (const tile of this.tiles.values()) {
      data.tiles.push(tile.toJSON());
    }

    return data;
  }

  static fromJSON(data) {
    const grid = new TileGrid(data.gridSize);
    grid.tiles.clear();

    for (const tileData of data.tiles) {
      const tile = Tile.fromJSON(tileData);
      grid.setTile(tile.x, tile.z, tile);
    }

    return grid;
  }
}
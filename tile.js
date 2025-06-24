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
    
    // 8 neighbors: N, NE, E, SE, S, SW, W, NW
    this.neighbors = {
      north: null,
      northeast: null,
      east: null,
      southeast: null,
      south: null,
      southwest: null,
      west: null,
      northwest: null
    };
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
      { x: this.x, z: this.z - 1 },     // North
      { x: this.x + 1, z: this.z - 1 }, // Northeast
      { x: this.x + 1, z: this.z },     // East
      { x: this.x + 1, z: this.z + 1 }, // Southeast
      { x: this.x, z: this.z + 1 },     // South
      { x: this.x - 1, z: this.z + 1 }, // Southwest
      { x: this.x - 1, z: this.z },     // West
      { x: this.x - 1, z: this.z - 1 }  // Northwest
    ];
  }

  setNeighbor(direction, tile) {
    this.neighbors[direction] = tile;
  }

  getNeighbor(direction) {
    return this.neighbors[direction];
  }

  getAllNeighbors() {
    return Object.values(this.neighbors).filter(neighbor => neighbor !== null);
  }

  getCardinalNeighbors() {
    return [
      this.neighbors.north,
      this.neighbors.east,
      this.neighbors.south,
      this.neighbors.west
    ].filter(neighbor => neighbor !== null);
  }

  getDiagonalNeighbors() {
    return [
      this.neighbors.northeast,
      this.neighbors.southeast,
      this.neighbors.southwest,
      this.neighbors.northwest
    ].filter(neighbor => neighbor !== null);
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
    // Create all tiles first
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const tile = new Tile(x, z);
        this.tiles.set(this.getKey(x, z), tile);
      }
    }
    
    // Then populate neighbor references
    this.populateNeighbors();
  }

  populateNeighbors() {
    const directions = [
      { name: 'north', dx: 0, dz: -1 },
      { name: 'northeast', dx: 1, dz: -1 },
      { name: 'east', dx: 1, dz: 0 },
      { name: 'southeast', dx: 1, dz: 1 },
      { name: 'south', dx: 0, dz: 1 },
      { name: 'southwest', dx: -1, dz: 1 },
      { name: 'west', dx: -1, dz: 0 },
      { name: 'northwest', dx: -1, dz: -1 }
    ];

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const tile = this.getTile(x, z);
        if (tile) {
          for (const direction of directions) {
            const neighborX = x + direction.dx;
            const neighborZ = z + direction.dz;
            const neighbor = this.getTile(neighborX, neighborZ);
            tile.setNeighbor(direction.name, neighbor);
          }
        }
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
    const tile = this.getTile(x, z);
    return tile ? tile.getCardinalNeighbors() : [];
  }

  getAllNeighbors(x, z) {
    const tile = this.getTile(x, z);
    return tile ? tile.getAllNeighbors() : [];
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
      const neighbors = tile.getCardinalNeighbors();
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

  repopulateNeighbors() {
    this.populateNeighbors();
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
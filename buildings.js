import * as THREE from 'three';

export class BuildingGenerator {
  constructor(settings, terrainGenerator) {
    this.settings = settings;
    this.citySettings = settings.city;
    this.terrainGenerator = terrainGenerator;
    this.buildings = [];
  }

  generateCity(scene) {
    // Get all buildable tiles from the terrain generator
    const buildableTiles = this.terrainGenerator.getBuildableTiles();
    
    // Filter tiles that are suitable for buildings based on city planning
    const suitableTiles = this.filterSuitableTiles(buildableTiles);
    
    // Generate buildings on suitable tiles
    this.generateBuildingsOnTiles(scene, suitableTiles);
    
    return this.buildings;
  }

  filterSuitableTiles(buildableTiles) {
    const { buildingSpacing, buildingDensity } = this.citySettings;
    const suitableTiles = [];
    
    // Create a spacing grid to ensure proper building distribution
    const usedPositions = new Set();
    
    for (const tile of buildableTiles) {
      // Skip if too close to another building location
      if (this.isTooCloseToOtherBuildings(tile, usedPositions, buildingSpacing)) {
        continue;
      }
      
      // Apply density check
      if (Math.random() < buildingDensity) {
        suitableTiles.push(tile);
        usedPositions.add(`${tile.x},${tile.z}`);
        
        // Mark nearby positions as used to maintain spacing
        this.markNearbyPositionsAsUsed(tile, usedPositions, buildingSpacing);
      }
    }
    
    return suitableTiles;
  }

  isTooCloseToOtherBuildings(tile, usedPositions, spacing) {
    for (let offsetX = -spacing; offsetX <= spacing; offsetX++) {
      for (let offsetZ = -spacing; offsetZ <= spacing; offsetZ++) {
        const checkX = tile.x + offsetX;
        const checkZ = tile.z + offsetZ;
        if (usedPositions.has(`${checkX},${checkZ}`)) {
          return true;
        }
      }
    }
    return false;
  }

  markNearbyPositionsAsUsed(tile, usedPositions, spacing) {
    const radius = Math.ceil(spacing / 2);
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      for (let offsetZ = -radius; offsetZ <= radius; offsetZ++) {
        const markX = tile.x + offsetX;
        const markZ = tile.z + offsetZ;
        usedPositions.add(`${markX},${markZ}`);
      }
    }
  }

  generateBuildingsOnTiles(scene, tiles) {
    const { minBuildingHeight, maxBuildingHeight } = this.citySettings;
    
    for (const tile of tiles) {
      if (tile.canBuildHere()) {
        const buildingHeight = Math.random() * (maxBuildingHeight - minBuildingHeight) + minBuildingHeight;
        const building = this.createBuildingOnTile(scene, tile, buildingHeight);
        
        if (building) {
          // Mark the tile as having a building
          tile.setBuilding(building);
        }
      }
    }
  }

  createBuildingOnTile(scene, tile, buildingHeight) {
    const geometry = new THREE.BoxGeometry(1, buildingHeight, 1);
    const material = new THREE.MeshBasicMaterial({ 
      color: this.settings.rendering.buildingColor,
      wireframe: false,
      transparent: true,
      opacity: 0.8
    });
    
    const building = new THREE.Mesh(geometry, material);
    
    // Get world position from tile
    const worldPos = tile.getWorldPosition(this.settings.terrain.gridSize, this.settings.terrain.tileSize);
    
    // Position building on tile surface
    building.position.set(
      worldPos.x, 
      tile.height + buildingHeight / 2, 
      worldPos.z
    );
    
    // Store reference to the tile
    building.userData.tile = tile;
    building.userData.tileX = tile.x;
    building.userData.tileZ = tile.z;
    
    this.buildings.push(building);
    scene.add(building);
    
    return building;
  }

  // Legacy method for compatibility - now redirects to tile-based approach
  createBuilding(scene, x, z, terrainHeight, buildingHeight) {
    const tile = this.terrainGenerator.getTileAtWorldPosition(x, z);
    if (tile && tile.canBuildHere()) {
      return this.createBuildingOnTile(scene, tile, buildingHeight);
    }
    return null;
  }

  addShimmerEffect() {
    const time = Date.now() * this.settings.rendering.shimmerSpeed;
    const { shimmerIntensity } = this.settings.rendering;
    
    this.buildings.forEach((building, index) => {
      const baseOpacity = 0.7;
      building.material.opacity = baseOpacity + Math.sin(time + index * 0.1) * shimmerIntensity;
    });
  }

  getBuildingsInRadius(x, z, radius) {
    return this.buildings.filter(building => {
      const distance = Math.sqrt(
        Math.pow(building.position.x - x, 2) + 
        Math.pow(building.position.z - z, 2)
      );
      return distance <= radius;
    });
  }

  removeBuilding(building) {
    const index = this.buildings.indexOf(building);
    if (index > -1) {
      this.buildings.splice(index, 1);
      
      // Remove building reference from tile
      if (building.userData.tile) {
        building.userData.tile.removeBuilding();
      }
      
      building.parent.remove(building);
      building.geometry.dispose();
      building.material.dispose();
    }
  }

  getBuildingAt(tileX, tileZ) {
    return this.buildings.find(building => 
      building.userData.tileX === tileX && building.userData.tileZ === tileZ
    );
  }

  getBuildingAtWorldPosition(worldX, worldZ) {
    const tile = this.terrainGenerator.getTileAtWorldPosition(worldX, worldZ);
    if (tile && tile.building) {
      return tile.building;
    }
    return null;
  }

  clear() {
    this.buildings.forEach(building => {
      // Remove building reference from tile
      if (building.userData.tile) {
        building.userData.tile.removeBuilding();
      }
      
      building.parent.remove(building);
      building.geometry.dispose();
      building.material.dispose();
    });
    this.buildings = [];
  }
}
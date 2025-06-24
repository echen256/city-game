import * as THREE from 'three';
import { TerrainGenerator } from './terrain.js';
import { BuildingGenerator } from './buildings.js';
import { ConfigMenu } from './configmenu.js';

class CityGame {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.avatar = null;
    this.keys = {};
    this.settings = null;
    this.terrainGenerator = null;
    this.buildingGenerator = null;
    this.configMenu = null;
    this.cameraMode = 'isometric'; // 'isometric' or 'topdown'
    this.buildingsVisible = true;
    
    this.loadSettingsAndInit();
  }

  async loadSettingsAndInit() {
    try {
      const response = await fetch('./gamesettings.json');
      const defaultSettings = await response.json();
      
      // Load settings from localStorage or use defaults
      this.settings = this.loadSettingsFromStorage(defaultSettings);
      this.init();
    } catch (error) {
      console.error('Failed to load game settings:', error);
      // Use minimal default settings if loading fails
      this.settings = {
        terrain: { gridSize: 100, minHeight: -10, maxHeight: 10, waterLevel: 0, noiseScale: 0.05, octaves: 4, persistence: 0.5, lacunarity: 2.0 },
        city: { streetWidth: 4, blockSize: 8, buildingSpacing: 2, buildingDensity: 0.7, minBuildingHeight: 2, maxBuildingHeight: 12 },
        player: { speed: 0.2, avatarRadius: 0.5, avatarHeight: 0.5 },
        camera: { offsetX: 20, offsetY: 20, offsetZ: 20 },
        rendering: { backgroundColor: 0x000000, buildingColor: 0xffffff, avatarColor: 0xffffff, gridColor: 0xffffff, shimmerSpeed: 0.001, shimmerIntensity: 0.1 }
      };
      this.init();
    }
  }

  loadSettingsFromStorage(defaultSettings) {
    try {
      const savedSettings = localStorage.getItem('cityGameSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Merge with defaults to ensure all properties exist
        return this.mergeSettings(defaultSettings, parsed);
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }
    return defaultSettings;
  }

  mergeSettings(defaultSettings, savedSettings) {
    const merged = JSON.parse(JSON.stringify(defaultSettings));
    
    for (const category in savedSettings) {
      if (merged[category] && typeof merged[category] === 'object') {
        for (const key in savedSettings[category]) {
          if (merged[category].hasOwnProperty(key)) {
            merged[category][key] = savedSettings[category][key];
          }
        }
      }
    }
    
    return merged;
  }

  saveSettingsToStorage() {
    try {
      localStorage.setItem('cityGameSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }

  init() {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(this.settings.rendering.backgroundColor);
    document.body.appendChild(this.renderer.domElement);

    // Initialize terrain and building generators
    this.terrainGenerator = new TerrainGenerator(this.settings);
    this.terrainGenerator.generateTerrain();
    this.buildingGenerator = new BuildingGenerator(this.settings, this.terrainGenerator);

    // Setup isometric camera
    this.setupCamera();
    
    // Create terrain, grid and city
    this.createTerrain();
    this.createGrid();
    this.generateCity();
    this.createAvatar();
    
    // Setup controls and config menu
    this.setupControls();
    this.setupConfigMenu();
    
    // Start render loop
    this.animate();
  }

  setupCamera() {
    this.updateCameraMode();
  }

  updateCameraMode() {
    if (this.cameraMode === 'topdown') {
      this.setupTopDownCamera();
    } else {
      this.setupIsometricCamera();
    }
  }

  setupIsometricCamera() {
    const { offsetX, offsetY, offsetZ } = this.settings.camera;
    this.camera.position.set(offsetX, offsetY, offsetZ);
    this.camera.lookAt(0, 0, 0);
  }

  setupTopDownCamera() {
    const { gridSize } = this.settings.terrain;
    this.camera.position.set(0, gridSize * 0.8, 0);
    this.camera.lookAt(0, 0, 0);
  }

  toggleCameraMode() {
    this.cameraMode = this.cameraMode === 'isometric' ? 'topdown' : 'isometric';
    this.updateCameraMode();
  }

  createTerrain() {
    const terrain = this.terrainGenerator.createTerrainMesh();
    this.scene.add(terrain);
  }

  createGrid() {
    const gridHelper = this.terrainGenerator.createGridHelper();
    this.scene.add(gridHelper);
  }

  generateCity() {
    this.buildingGenerator.generateCity(this.scene);
    this.updateBuildingVisibility();
  }

  toggleBuildingVisibility() {
    this.buildingsVisible = !this.buildingsVisible;
    this.updateBuildingVisibility();
  }

  updateBuildingVisibility() {
    if (this.buildingGenerator) {
      this.buildingGenerator.buildings.forEach(building => {
        building.visible = this.buildingsVisible;
      });
    }
  }

  createAvatar() {
    const { avatarRadius } = this.settings.player;
    const { avatarColor } = this.settings.rendering;
    
    const geometry = new THREE.SphereGeometry(avatarRadius, 16, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: avatarColor,
      transparent: true,
      opacity: 0.9
    });
    
    this.avatar = new THREE.Mesh(geometry, material);
    
    // Position avatar on terrain surface
    const startX = 0;
    const startZ = 0;
    const terrainHeight = this.terrainGenerator.getHeightAt(startX, startZ);
    this.avatar.position.set(startX, terrainHeight + avatarRadius, startZ);
    
    this.scene.add(this.avatar);
  }

  setupControls() {
    document.addEventListener('keydown', (event) => {
      this.keys[event.code] = true;
      
      // Toggle config menu with 'C' key
      if (event.code === 'KeyC' && this.configMenu) {
        this.configMenu.toggle();
      }
      
      // Toggle camera mode with 'V' key
      if (event.code === 'KeyV') {
        this.toggleCameraMode();
      }
      
      // Toggle building visibility with 'B' key
      if (event.code === 'KeyB') {
        this.toggleBuildingVisibility();
      }
    });

    document.addEventListener('keyup', (event) => {
      this.keys[event.code] = false;
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupConfigMenu() {
    this.configMenu = new ConfigMenu(this.settings, (newSettings, isPreview) => {
      this.onSettingsChanged(newSettings, isPreview);
    }, this.getOriginalSettingsFromFile.bind(this));
  }

  async getOriginalSettingsFromFile() {
    try {
      const response = await fetch('./gamesettings.json');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch original settings:', error);
      throw error;
    }
  }

  onSettingsChanged(newSettings, isPreview) {
    if (!isPreview) {
      // Full regeneration for final apply
      this.settings = newSettings;
      this.saveSettingsToStorage();
      this.regenerateWorld();
    } else {
      // Live preview updates (limited to visual changes)
      this.applyVisualSettings(newSettings);
    }
  }

  applyVisualSettings(newSettings) {
    // Update renderer background
    if (newSettings.rendering.backgroundColor !== this.settings.rendering.backgroundColor) {
      const bgColor = typeof newSettings.rendering.backgroundColor === 'string' ? 
        parseInt(newSettings.rendering.backgroundColor) : newSettings.rendering.backgroundColor;
      this.renderer.setClearColor(bgColor);
    }

    // Update avatar color and size
    if (this.avatar) {
      const avatarColor = typeof newSettings.rendering.avatarColor === 'string' ? 
        parseInt(newSettings.rendering.avatarColor) : newSettings.rendering.avatarColor;
      this.avatar.material.color.setHex(avatarColor);
      
      // Update avatar scale if radius changed
      const radiusRatio = newSettings.player.avatarRadius / this.settings.player.avatarRadius;
      this.avatar.scale.multiplyScalar(radiusRatio);
    }

    // Update building colors
    if (this.buildingGenerator) {
      const buildingColor = typeof newSettings.rendering.buildingColor === 'string' ? 
        parseInt(newSettings.rendering.buildingColor) : newSettings.rendering.buildingColor;
      this.buildingGenerator.buildings.forEach(building => {
        building.material.color.setHex(buildingColor);
      });
    }
  }

  regenerateWorld() {
    // Clear existing world
    this.scene.clear();
    
    // Regenerate terrain and buildings
    this.terrainGenerator = new TerrainGenerator(this.settings);
    this.terrainGenerator.generateTerrain();
    this.buildingGenerator = new BuildingGenerator(this.settings, this.terrainGenerator);

    // Recreate world elements
    this.createTerrain();
    this.createGrid();
    this.generateCity();
    this.createAvatar();
    
    // Update renderer settings
    this.renderer.setClearColor(this.settings.rendering.backgroundColor);
  }

  updateAvatar() {
    const { speed, avatarRadius } = this.settings.player;
    const { gridSize } = this.settings.terrain;
    
    const oldX = this.avatar.position.x;
    const oldZ = this.avatar.position.z;
    
    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      this.avatar.position.z -= speed;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      this.avatar.position.z += speed;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      this.avatar.position.x -= speed;
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      this.avatar.position.x += speed;
    }

    // Keep avatar within bounds
    const bound = gridSize / 2 - 1;
    this.avatar.position.x = Math.max(-bound, Math.min(bound, this.avatar.position.x));
    this.avatar.position.z = Math.max(-bound, Math.min(bound, this.avatar.position.z));

    // Update avatar height to follow terrain
    const terrainHeight = this.terrainGenerator.getHeightAt(this.avatar.position.x, this.avatar.position.z);
    this.avatar.position.y = terrainHeight + avatarRadius;

    // Update camera to follow avatar based on camera mode
    this.updateCameraFollowAvatar();
  }

  updateCameraFollowAvatar() {
    if (this.cameraMode === 'topdown') {
      // Top-down camera follows avatar horizontally but stays above
      const { gridSize } = this.settings.terrain;
      this.camera.position.x = this.avatar.position.x;
      this.camera.position.y = gridSize * 0.8;
      this.camera.position.z = this.avatar.position.z;
      this.camera.lookAt(this.avatar.position.x, this.avatar.position.y, this.avatar.position.z);
    } else {
      // Isometric camera follows with offset
      const { offsetX, offsetY, offsetZ } = this.settings.camera;
      this.camera.position.x = this.avatar.position.x + offsetX;
      this.camera.position.y = this.avatar.position.y + offsetY;
      this.camera.position.z = this.avatar.position.z + offsetZ;
      this.camera.lookAt(this.avatar.position.x, this.avatar.position.y, this.avatar.position.z);
    }
  }

  addShimmer() {
    const time = Date.now() * this.settings.rendering.shimmerSpeed;
    const { shimmerIntensity } = this.settings.rendering;
    
    // Shimmer buildings
    this.buildingGenerator.addShimmerEffect();
    
    // Shimmer avatar
    if (this.avatar) {
      const baseOpacity = 0.8;
      this.avatar.material.opacity = baseOpacity + Math.sin(time * 2) * shimmerIntensity;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    this.updateAvatar();
    this.addShimmer();
    
    this.renderer.render(this.scene, this.camera);
  }
}

// Start the game
new CityGame();
import * as THREE from 'three';

class CityGame {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.gridSize = 100;
    this.cellSize = 1;
    this.avatar = null;
    this.buildings = [];
    this.keys = {};
    
    this.init();
  }

  init() {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000);
    document.body.appendChild(this.renderer.domElement);

    // Setup isometric camera
    this.setupCamera();
    
    // Create grid and city
    this.createGrid();
    this.generateCity();
    this.createAvatar();
    
    // Setup controls
    this.setupControls();
    
    // Start render loop
    this.animate();
  }

  setupCamera() {
    // Isometric camera position
    this.camera.position.set(50, 50, 50);
    this.camera.lookAt(0, 0, 0);
  }

  createGrid() {
    const gridHelper = new THREE.GridHelper(this.gridSize, this.gridSize, 0xffffff, 0xffffff);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    this.scene.add(gridHelper);
  }

  generateCity() {
    // Simple city generation algorithm
    const streetWidth = 4;
    const blockSize = 8;
    
    for (let x = 0; x < this.gridSize; x += blockSize) {
      for (let z = 0; z < this.gridSize; z += blockSize) {
        // Skip streets
        if (x % (blockSize + streetWidth) < streetWidth || z % (blockSize + streetWidth) < streetWidth) {
          continue;
        }
        
        // Generate buildings in blocks
        this.generateBlock(x, z, blockSize);
      }
    }
  }

  generateBlock(startX, startZ, blockSize) {
    const buildingSpacing = 2;
    
    for (let x = startX; x < startX + blockSize; x += buildingSpacing) {
      for (let z = startZ; z < startZ + blockSize; z += buildingSpacing) {
        if (Math.random() > 0.3) { // 70% chance to place building
          const height = Math.random() * 10 + 2; // Random height 2-12
          this.createBuilding(x - this.gridSize/2, height/2, z - this.gridSize/2, 1, height, 1);
        }
      }
    }
  }

  createBuilding(x, y, z, width, height, depth) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      wireframe: false,
      transparent: true,
      opacity: 0.8
    });
    
    const building = new THREE.Mesh(geometry, material);
    building.position.set(x, y, z);
    this.buildings.push(building);
    this.scene.add(building);
  }

  createAvatar() {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    
    this.avatar = new THREE.Mesh(geometry, material);
    this.avatar.position.set(0, 0.5, 0);
    this.scene.add(this.avatar);
  }

  setupControls() {
    document.addEventListener('keydown', (event) => {
      this.keys[event.code] = true;
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

  updateAvatar() {
    const speed = 0.2;
    
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
    const bound = this.gridSize / 2 - 1;
    this.avatar.position.x = Math.max(-bound, Math.min(bound, this.avatar.position.x));
    this.avatar.position.z = Math.max(-bound, Math.min(bound, this.avatar.position.z));

    // Update camera to follow avatar
    this.camera.position.x = this.avatar.position.x + 20;
    this.camera.position.z = this.avatar.position.z + 20;
    this.camera.lookAt(this.avatar.position.x, 0, this.avatar.position.z);
  }

  addShimmer() {
    // Add subtle animation to buildings and avatar
    const time = Date.now() * 0.001;
    
    this.buildings.forEach((building, index) => {
      building.material.opacity = 0.7 + Math.sin(time + index * 0.1) * 0.1;
    });
    
    if (this.avatar) {
      this.avatar.material.opacity = 0.8 + Math.sin(time * 2) * 0.1;
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
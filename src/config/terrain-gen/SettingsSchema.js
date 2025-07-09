export const TERRAIN_SETTINGS_SCHEMA = {
  voronoi: {
    numSites: { 
      type: 'number', 
      min: 10, 
      max: 200, 
      default: 50,
      label: 'Number of Sites',
      description: 'Number of Voronoi sites to generate'
    },
    distribution: {
      type: 'select',
      options: ['poisson', 'random', 'grid', 'hexagonal'],
      default: 'poisson',
      label: 'Distribution',
      description: 'Site distribution pattern'
    },
    poissonRadius: {
      type: 'number',
      min: 10,
      max: 50,
      default: 25,
      label: 'Poisson Radius',
      description: 'Minimum distance between Poisson disk samples'
    },
    seed: {
      type: 'number',
      default: 12345,
      label: 'Seed',
      description: 'Random seed for deterministic generation'
    }
  },
  coastlines: {
    enabled: { type: 'boolean', default: false },
    direction: {
      type: 'select',
      options: ['N', 'S', 'E', 'W'],
      default: 'N',
      label: 'Coast Direction'
    },
    budget: {
      type: 'number',
      min: 10,
      max: 500,
      step: 10,
      default: 50,
      label: 'Coast Budget'
    }
  },
  hills: {
    enabled: { type: 'boolean', default: false },
    budget: {
      type: 'number',
      min: 20,
      max: 500,
      step: 10,
      default: 100,
      label: 'Hills Budget'
    },
    origins: {
      type: 'number',
      min: 1,
      max: 10,
      default: 3,
      label: 'Number of Origins'
    },
    gradient: {
      type: 'boolean',
      default: true,
      label: 'Gradient Enabled'
    }
  },
  lakes: {
    enabled: { type: 'boolean', default: false },
    budget: {
      type: 'number',
      min: 10,
      max: 200,
      step: 5,
      default: 30,
      label: 'Lakes Budget'
    },
    origins: {
      type: 'number',
      min: 1,
      max: 5,
      default: 2,
      label: 'Number of Lakes'
    }
  },
  rivers: {
    enabled: { type: 'boolean', default: true },
    count: {
      type: 'number',
      min: 1,
      max: 4,
      default: 2,
      label: 'Number of Rivers'
    }
  },
  tributaries: {
    enabled: { type: 'boolean', default: true },
    depth: {
      type: 'number',
      min: 1,
      max: 5,
      default: 3,
      label: 'Tributary Depth'
    },
    branchProbability: {
      type: 'number',
      min: 0.1,
      max: 1.0,
      step: 0.1,
      default: 0.7,
      label: 'Branch Probability'
    },
    minDistance: {
      type: 'number',
      min: 5,
      max: 50,
      default: 15,
      label: 'Min Tributary Distance'
    },
    maxDistance: {
      type: 'number',
      min: 20,
      max: 200,
      default: 80,
      label: 'Max Tributary Distance'
    },
    branchingSeparation: {
      type: 'number',
      min: 2,
      max: 15,
      default: 5,
      label: 'Branching Separation'
    }
  },
  marshes: {
    enabled: { type: 'boolean', default: false }
  },
  visualization: {
    showTriangulation: { type: 'boolean', default: true },
    showVoronoiEdges: { type: 'boolean', default: true },
    showSites: { type: 'boolean', default: true },
    showVertices: { type: 'boolean', default: false },
    showHeightGradient: { type: 'boolean', default: true },
    showLakes: { type: 'boolean', default: true },
    showMarshes: { type: 'boolean', default: true },
    showRivers: { type: 'boolean', default: true },
    highlightVertexId: { type: 'number', default: null }
  }
};
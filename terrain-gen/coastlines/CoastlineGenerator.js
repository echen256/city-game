export class CoastlineGenerator {
  constructor(voronoiGenerator, settings = {}, seededRandom) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.seededRandom = seededRandom;
    this.coastlines = [];
    this.coastalCells = new Set();
  }

  setSeededRandom(seededRandom) {
    this.seededRandom = seededRandom;
  }

  random() {
    if (typeof this.seededRandom === 'function') {
      return this.seededRandom();
    }
    return Math.random();
  }

  clearCoastlines() {
    const cells = this.voronoiGenerator?.delaunatorWrapper?.voronoiCells;
    if (cells) {
      this.coastalCells.forEach((cellId) => {
        const cell = cells.get(cellId);
        if (!cell) return;
        if (!cell.metadata) {
          cell.metadata = {};
        }
        cell.metadata.isCoastline = false;
        cell.metadata.coastDirection = null;
      });
    }

    this.coastalCells.clear();
    this.coastlines = [];
  }

  getCoastlineCellCount() {
    return this.coastalCells.size;
  }

  getCoastlines() {
    return this.coastlines.map((coastline) => ({
      id: coastline.id,
      direction: coastline.direction,
      cells: Array.from(coastline.cells)
    }));
  }

  addCellToCoastline(cellId, coastline, direction) {
    const cells = this.voronoiGenerator?.delaunatorWrapper?.voronoiCells;
    if (!cells) {
      return false;
    }

    const cell = cells.get(cellId);
    if (!cell || cell.site?.isBoundary) {
      return false;
    }

    if (!cell.metadata) {
      cell.metadata = {};
    }

    cell.metadata.isCoastline = true;
    cell.metadata.coastDirection = direction;
    this.coastalCells.add(cellId);
    coastline.cells.add(cellId);
    return true;
  }

  generateCoastlines(map) {
    const wrapper = this.voronoiGenerator?.delaunatorWrapper;
    if (!wrapper?.voronoiCells) {
      throw new Error('CoastlineGenerator: No Voronoi data available');
    }

    const config = map?.settings?.coastlines || this.settings?.coastlines || {};
    const direction = (config.direction || 'N').toUpperCase();

    const gridSize = this.voronoiGenerator?.settings?.gridSize || map?.settings?.gridSize || 600;
    const budgetPercent = Number(config.percent ?? config.budget);
    let percentThickness;
    if (Number.isFinite(budgetPercent)) {
      percentThickness = Math.min(0.2, Math.max(0.05, budgetPercent / 100));
    } else {
      percentThickness = 0.15 + this.random() * 0.05;
    }
    let thickness = gridSize * percentThickness;

    let candidates = this.collectRectangularBand(wrapper, direction, gridSize, thickness);
    let attempts = 0;
    const maxThickness = gridSize * 0.2;
    while (candidates.length === 0 && attempts < 3) {
      thickness = Math.min(maxThickness, thickness * 1.2);
      candidates = this.collectRectangularBand(wrapper, direction, gridSize, thickness);
      attempts++;
    }

    if (candidates.length === 0) {
      throw new Error('CoastlineGenerator: Unable to find coastal cells');
    }

    this.clearCoastlines();

    const coastline = {
      id: 'coastline_1',
      direction,
      cells: new Set()
    };

    candidates.forEach((cellId) => {
      this.addCellToCoastline(cellId, coastline, direction);
    });

    this.coastlines = coastline.cells.size ? [coastline] : [];
    console.log(`CoastlineGenerator: Generated coastline with ${coastline.cells.size} cells (direction ${direction}, thickness ${(thickness / gridSize * 100).toFixed(1)}%)`);
    return this.getCoastlines();
  }

  collectRectangularBand(wrapper, direction, gridSize, thickness) {
    const cellIds = [];
    wrapper.voronoiCells.forEach((cell, cellId) => {
      if (!cell || cell.site?.isBoundary) return;
      const x = cell.site.x;
      const z = cell.site.z || cell.site.y || 0;
      switch (direction) {
        case 'S':
          if (z >= gridSize - thickness) cellIds.push(cellId);
          break;
        case 'E':
          if (x >= gridSize - thickness) cellIds.push(cellId);
          break;
        case 'W':
          if (x <= thickness) cellIds.push(cellId);
          break;
        case 'N':
        default:
          if (z <= thickness) cellIds.push(cellId);
          break;
      }
    });
    return cellIds;
  }
}

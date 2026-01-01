export class LakesGenerator {
  constructor(voronoiGenerator, settings, seededRandom) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.seededRandom = seededRandom;
    this.lakeCells = new Set();
    this.lakes = [];
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

  clearLakes() {
    if (this.voronoiGenerator?.delaunatorWrapper?.voronoiCells) {
      this.lakeCells.forEach((cellId) => {
        const cell = this.voronoiGenerator.delaunatorWrapper.voronoiCells.get(cellId);
        if (cell) {
          if (!cell.metadata) {
            cell.metadata = {};
          }
          cell.metadata.isLake = false;
          cell.metadata.lakeId = null;
        }
      });
    }

    this.lakeCells.clear();
    this.lakes = [];
  }

  getLakeCellCount() {
    return this.lakeCells.size;
  }

  getLakes() {
    return this.lakes.map((lake) => ({
      id: lake.id,
      cells: Array.from(lake.cells)
    }));
  }

  addCellToLake(cellId, lake) {
    if (this.lakeCells.has(cellId)) {
      return false;
    }

    const cells = this.voronoiGenerator?.delaunatorWrapper?.voronoiCells;
    if (!cells) {
      return false;
    }

    const cell = cells.get(cellId);
    if (!cell) {
      return false;
    }

    if (cell.site?.isBoundary) {
      return false;
    }

    if (!cell.metadata) {
      cell.metadata = {};
    }

    cell.metadata.isLake = true;
    cell.metadata.lakeId = lake.id;

    this.lakeCells.add(cellId);
    lake.cells.add(cellId);
    return true;
  }

  selectSeedCells(validCells, lakeCount, budget) {
    const seeds = [];
    const usedIndices = new Set();
    const count = Math.min(lakeCount, budget, validCells.length);

    while (seeds.length < count && usedIndices.size < validCells.length) {
      let index = Math.floor(this.random() * validCells.length);
      let attempts = 0;
      while (usedIndices.has(index) && attempts < validCells.length) {
        index = (index + 1) % validCells.length;
        attempts++;
      }

      if (usedIndices.has(index)) {
        break;
      }

      usedIndices.add(index);
      seeds.push(validCells[index]);
    }

    return seeds;
  }

  generateLakes(map) {
    const wrapper = this.voronoiGenerator?.delaunatorWrapper;
    if (!wrapper?.voronoiCells) {
      throw new Error('LakesGenerator: No Voronoi data available');
    }

    const config = map?.settings?.lakes || this.settings?.lakes || {};
    const budget = Math.max(1, Number(config.budget) || 0);
    const lakeCount = Math.max(1, Number(config.numLakes || config.numOrigins) || 1);

    const validCells = [];
    wrapper.voronoiCells.forEach((cell, cellId) => {
      if (cell && !cell.site?.isBoundary) {
        validCells.push(cellId);
        if (!cell.metadata) {
          cell.metadata = {};
        }
      }
    });

    if (validCells.length === 0) {
      throw new Error('LakesGenerator: No valid cells available for lakes');
    }

    this.clearLakes();

    const seeds = this.selectSeedCells(validCells, lakeCount, budget);
    if (seeds.length === 0) {
      throw new Error('LakesGenerator: Unable to select lake seeds');
    }

    const lakes = seeds.map((cellId, index) => ({
      id: `lake_${index + 1}`,
      cells: new Set()
    }));

    let placed = 0;
    lakes.forEach((lake, index) => {
      if (placed >= budget) return;
      if (this.addCellToLake(seeds[index], lake)) {
        placed++;
      }
    });

    const visited = new Set(this.lakeCells);
    const maxIterations = budget * 5;
    let iterations = 0;

    while (placed < budget && iterations < maxIterations) {
      let progress = false;

      for (const lake of lakes) {
        if (placed >= budget) {
          break;
        }

        const neighborCandidates = [];
        lake.cells.forEach((cellId) => {
          const cell = wrapper.voronoiCells.get(cellId);
          if (!cell) {
            return;
          }

          cell.neighbors?.forEach((neighborId) => {
            if (visited.has(neighborId)) {
              return;
            }
            const neighbor = wrapper.voronoiCells.get(neighborId);
            if (!neighbor || neighbor.site?.isBoundary) {
              return;
            }
            neighborCandidates.push(neighborId);
          });
        });

        if (neighborCandidates.length === 0) {
          continue;
        }

        const choiceIndex = Math.floor(this.random() * neighborCandidates.length);
        const chosenId = neighborCandidates[choiceIndex];
        visited.add(chosenId);
        if (this.addCellToLake(chosenId, lake)) {
          placed++;
          progress = true;
        }
      }

      if (!progress) {
        break;
      }

      iterations++;
    }

    this.lakes = lakes;
    console.log(`LakesGenerator: Generated ${lakes.length} lakes covering ${this.lakeCells.size} cells`);
    return this.getLakes();
  }
}

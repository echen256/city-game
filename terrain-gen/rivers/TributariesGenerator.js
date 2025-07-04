/**
 * TributariesGenerator.js - Simplified tributary generation
 * 
 * Creates tributaries for rivers using neighbor expansion
 */

import { PathFinder } from './Pathfinder.js';
import { GraphUtils } from '../geometry/graph/GraphUtils.js';

/**
 * Simplified tributary generator
 */
export class TributariesGenerator {
  constructor(voronoiGenerator, settings = {}, seededRandom) {
    this.voronoiGenerator = voronoiGenerator;
    this.settings = settings;
    this.tributaryPaths = [];
    this.riverVertices = new Set();
    this.pathfinder = new PathFinder(voronoiGenerator.delaunatorWrapper);
    this.seededRandom = seededRandom;
  }

  /**
   * Generate a single tributary for a river
   * @param {Array<number>} riverPath - Single river path
   * @param {Object} graph - Graph data
   * @returns {Array<number>|null} Tributary path or null
   */
  generateSingleTributary(riverPath, graph) {
    // Calculate target tributary length (1/3 of parent river)
    const targetLength = Math.floor(riverPath.length / 3);
    console.log(`Target tributary length: ${targetLength} (1/3 of ${riverPath.length})`);

    // Select a random vertex from the middle portion of the river
    const startIndex = Math.floor(riverPath.length * 0.3);
    const endIndex = Math.floor(riverPath.length * 0.7);
    const randomIndex = startIndex + Math.floor(this.seededRandom() * (endIndex - startIndex));
    const startVertex = riverPath[randomIndex];

    console.log(`Starting tributary from river vertex ${startVertex} (index ${randomIndex})`);

    // Expand neighbors for several generations
    let currentGeneration = new Set([startVertex]);
    const allVertices = new Set([startVertex]);

    for (let generation = 0; generation < riverPath.length / 3; generation++) {
      const nextGeneration = new Set();

      for (const vertex of currentGeneration) {
        const neighbors = graph.voronoiVertexVertexMap[vertex] || [];

        for (const neighbor of neighbors) {
          // Only add if not already visited and not a river vertex
          if (!allVertices.has(neighbor) && !this.riverVertices.has(neighbor)) {
            nextGeneration.add(neighbor);
            allVertices.add(neighbor);
          }
        }
      }

      currentGeneration = nextGeneration;
      console.log(`Generation ${generation + 1}: Added ${nextGeneration.size} new vertices`);

      // Stop if no new vertices found
      if (nextGeneration.size === 0) break;
    }

    // Remove the starting vertex from candidates
    allVertices.delete(startVertex);
    const candidates = Array.from(allVertices);

    if (candidates.length === 0) {
      console.log('No candidate vertices found');
      return null;
    }

    // Sort candidates by distance from start vertex (descending)
    const startPos = graph.circumcenters[startVertex];
    if (!startPos) return null;

    const sortedCandidates = candidates
      .map(vertex => {
        const pos = graph.circumcenters[vertex];
        if (!pos) return null;

        const distance = Math.sqrt(
          Math.pow(pos.x - startPos.x, 2) +
          Math.pow(pos.z - startPos.z, 2)
        );

        return { vertex, distance };
      })
      .filter(item => item !== null)
      .sort((a, b) => b.distance - a.distance); // Descending order

    if (sortedCandidates.length === 0) {
      console.log('No valid candidate positions found');
      return null;
    }

    // Try candidates starting from the farthest, but limit path length to target
    for (const candidate of sortedCandidates) {
      const endVertex = candidate.vertex;

      // Create path from start to end
      const tributaryPath = this.pathfinder.findPath(
        startVertex,
        endVertex,
        graph.voronoiVertexVertexMap,
        graph.voronoiEdges,
        graph.circumcenters
      );

      if (tributaryPath && tributaryPath.length <= targetLength) {
        console.log(`Selected end vertex ${endVertex} at distance ${candidate.distance.toFixed(2)}, path length: ${tributaryPath.length}/${targetLength}`);
        return tributaryPath;
      } else if (tributaryPath) {
        console.log(`Skipping vertex ${endVertex} - path too long: ${tributaryPath.length}/${targetLength}`);
      }
    }

    // If no candidate produces a path within target length, use the shortest available path
    for (let i = sortedCandidates.length - 1; i >= 0; i--) {
      const candidate = sortedCandidates[i];
      const endVertex = candidate.vertex;

      const tributaryPath = this.pathfinder.findPath(
        startVertex,
        endVertex,
        graph.voronoiVertexVertexMap,
        graph.voronoiEdges,
        graph.circumcenters
      );

      if (tributaryPath && tributaryPath.length > 3) {
        console.log(`Fallback: Selected end vertex ${endVertex}, path length: ${tributaryPath.length} (target was ${targetLength})`);
        return tributaryPath;
      }
    }

    console.log('No suitable tributary path found');
    return null;
  }

  /**
   * Get all generated tributary paths
   * @returns {Array<Array<number>>} Array of tributary paths
   */
  getTributaryPaths() {
    return [...this.tributaryPaths];
  }

  /**
   * Generate tributaries for all rivers
   * @param {Object} map - Map instance containing rivers
   * @returns {Array<Array<number>>} Array of tributary paths
   */
  generateTributaries(map) {
    try {
      const riverPaths = map.riversGenerator.getRiverPaths();
      if (riverPaths.length === 0) {
        console.error('Error: No rivers found. Generate rivers first.');
        return [];
      }

      console.log(`Generating tributaries for ${riverPaths.length} rivers...`);

      // Get the original graph for tributary generation
      const originalGraph = GraphUtils.createDeepCopyOfGraph(map.voronoiGenerator.delaunatorWrapper);

      // Mark all river vertices
      this.riverVertices.clear();
      for (const riverPath of riverPaths) {
        for (const vertex of riverPath) {
          this.riverVertices.add(vertex);
        }
      }

      // Generate tributaries
      this.tributaryPaths = [];

      for (let i = 0; i < riverPaths.length; i++) {
        console.log(`\n--- Generating tributaries for river ${i + 1} ---`);

        for (let t = 0; t < this.settings.tributaries.numTributaries; t++) {
          const tributary = this.generateSingleTributary(riverPaths[i], originalGraph);
          if (tributary && tributary.length > this.settings.tributaries.maxTributaryLength) {
            this.tributaryPaths.push(tributary);
            console.log(`Generated tributary ${t + 1} for river ${i + 1} with ${tributary.length} vertices`);
          } else {
            console.log(`Failed to generate tributary ${t + 1} for river ${i + 1}`);
          }
        }
      }

      console.log(`\nTributariesGenerator: Generated ${this.tributaryPaths.length} tributaries total for ${riverPaths.length} rivers`);

      return this.tributaryPaths;

    } catch (error) {
      console.error(`Error generating tributaries: ${error.message}`);
      console.error(error);
      return [];
    }
  }
}


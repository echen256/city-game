import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import seedrandom from 'seedrandom';

import { GraphState } from '../../../terrain-gen/geometry/graph/GraphState.js';
import { VoronoiGenerator } from '../../../terrain-gen/geometry/voronoi/VoronoiGenerator.js';
import { LakesGenerator } from '../../../terrain-gen/lakes/LakesGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_FILENAME = 'map.json';

async function loadReferenceSnapshot() {
  const snapshotPath = path.join(__dirname, SNAPSHOT_FILENAME);
  const file = await fs.readFile(snapshotPath, 'utf-8');
  return JSON.parse(file);
}

function normalizeLake(lake) {
  return {
    id: lake.id,
    cells: [...lake.cells].map(Number).sort((a, b) => a - b)
  };
}

async function runLakeGenerationTest() {
  const referenceData = await loadReferenceSnapshot();
  const metadata = referenceData.metadata || {};
  const settings = metadata.settings;

  assert.ok(settings, 'Reference snapshot is missing settings metadata');
  assert.ok(Array.isArray(referenceData.lakes), 'Reference snapshot is missing lake data');

  const seededRandom = seedrandom(settings.seed);
  const graphState = new GraphState();
  const voronoiGenerator = new VoronoiGenerator(graphState, settings, seededRandom);

  voronoiGenerator.generateVoronoi({ settings });

  const lakesGenerator = new LakesGenerator(voronoiGenerator, settings, seededRandom);
  const generatedLakes = lakesGenerator.generateLakes({ settings });

  const normalizedGenerated = generatedLakes.map(normalizeLake);
  const normalizedReference = referenceData.lakes.map(normalizeLake);

  assert.strictEqual(
    normalizedGenerated.length,
    normalizedReference.length,
    'Generated lake count does not match reference data'
  );

  normalizedGenerated.forEach((lake, index) => {
    assert.deepStrictEqual(
      lake,
      normalizedReference[index],
      `Lake ${index} does not match reference data`
    );
  });

  console.log('**************************************************');
  console.log('Success: Lake generation matches reference data.');
  console.log('**************************************************');
}

runLakeGenerationTest().catch((error) => {
  console.log('**************************************************');
  console.log('Error: Lake generation does not match reference data.');
  console.error(error);
  console.log('**************************************************');
  process.exitCode = 1;
});

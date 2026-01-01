import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import seedrandom from 'seedrandom';

import { GraphState } from '../../../terrain-gen/geometry/graph/GraphState.js';
import { VoronoiGenerator } from '../../../terrain-gen/geometry/voronoi/VoronoiGenerator.js';
import { RiversGenerator } from '../../../terrain-gen/rivers/RiversGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_FILENAME = 'voronoi_data_1767307214938.json';

async function loadReferenceSnapshot() {
  const snapshotPath = path.join(__dirname, SNAPSHOT_FILENAME);
  const file = await fs.readFile(snapshotPath, 'utf-8');
  return JSON.parse(file);
}

async function runRiverGenerationTest() {
  const referenceData = await loadReferenceSnapshot();
  const metadata = referenceData.metadata || {};
  const settings = metadata.settings;

  assert.ok(settings, 'Reference snapshot is missing settings metadata');
  assert.ok(Array.isArray(referenceData.rivers), 'Reference snapshot is missing river data');

  const seededRandom = seedrandom(settings.seed);
  const graphState = new GraphState();
  const voronoiGenerator = new VoronoiGenerator(graphState, settings, seededRandom);

  voronoiGenerator.generateVoronoi({ settings });

  const riversGenerator = new RiversGenerator(voronoiGenerator, settings, seededRandom);
  const mapContext = {
    settings,
    graphState
  };

  const generatedRivers = riversGenerator.generateRivers(mapContext);
  const referenceRivers = referenceData.rivers.map(river => river.vertexIndices);

  assert.strictEqual(
    generatedRivers.length,
    referenceRivers.length,
    'Generated rivers count does not match reference data'
  );

  generatedRivers.forEach((riverPath, index) => {
    const normalizedPath = riverPath.map(Number);
    const referencePath = referenceRivers[index].map(Number);

    assert.deepStrictEqual(
      normalizedPath,
      referencePath,
      `River path ${index} does not match reference data`
    );
  });

  console.log('**************************************************');
  console.log('Success: River generation matches reference data.');
  console.log('**************************************************');
}

runRiverGenerationTest().catch((error) => {
  console.log('**************************************************');
  console.log('Error: River generation does not match reference data.');
  console.error(error);
  console.log('**************************************************');
  process.exitCode = 1;
});

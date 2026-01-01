import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import seedrandom from 'seedrandom';

import { GraphState } from '../../terrain-gen/geometry/graph/GraphState.js';
import { VoronoiGenerator } from '../../terrain-gen/geometry/voronoi/VoronoiGenerator.js';
import { buildVoronoiExport } from '../../terrain-gen/utils/exportVoronoiData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_FILENAME = 'map.json';
const FLOAT_TOLERANCE_DIGITS = 9;

function normalizeNumericValues(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeNumericValues);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeNumericValues(nestedValue)
      ])
    );
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(FLOAT_TOLERANCE_DIGITS));
  }

  return value;
}

async function loadReferenceSnapshot() {
  const snapshotPath = path.join(__dirname, SNAPSHOT_FILENAME);
  const file = await fs.readFile(snapshotPath, 'utf-8');
  return JSON.parse(file);
}

async function runGenerationTest() {
  const referenceData = await loadReferenceSnapshot();
  const metadata = referenceData.metadata || {};
  const settings = metadata.settings;

  if (!settings) {
    throw new Error('Reference snapshot is missing settings metadata');
  }

  const seededRandom = seedrandom(settings.seed);
  const graphState = new GraphState();
  const generator = new VoronoiGenerator(graphState, settings, seededRandom);

  generator.generateVoronoi({ settings });

  if (!generator.delaunatorWrapper) {
    throw new Error('Voronoi generation did not produce a delaunatorWrapper');
  }

  const regeneratedData = buildVoronoiExport(generator.delaunatorWrapper, {
    settings,
    description: metadata.description,
    version: metadata.version,
    exportTimestamp: metadata.exportTimestamp
  });

  const normalizedRegenerated = normalizeNumericValues(regeneratedData);
  const normalizedReference = normalizeNumericValues(referenceData);

  // The voronoi snapshot predates river exports, so ignore river data here
  delete normalizedRegenerated.rivers;
  delete normalizedReference.rivers;
  delete normalizedRegenerated.coastlines;
  delete normalizedReference.coastlines;

  const regeneratedString = JSON.stringify(normalizedRegenerated);
  const referenceString = JSON.stringify(normalizedReference);

  assert.strictEqual(
    regeneratedString,
    referenceString,
    'Regenerated Voronoi data does not match the reference snapshot'
  );

  console.log('**************************************************');
  console.log("Success: Voronoi generation snapshot matches reference data.");
  console.log('**************************************************');
}

runGenerationTest().catch((error) => {
  console.log('**************************************************');
  console.log("Error: Voronoi generation snapshot does not match reference data.");
  console.error(error);
  console.log('**************************************************');
  process.exitCode = 1;
});

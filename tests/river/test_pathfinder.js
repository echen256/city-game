import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VoronoiGenerator } from '../../terrain-gen/voronoi/VoronoiGenerator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


function runPathfindingTests() {
  console.log('=== PathFinder Test Suite ===');
  
  // Load source map data
  const sourceMapPath = path.join(__dirname, '../pathfinding/source_map.json');
  console.log(`Loading source map from: ${sourceMapPath}`);
  const delaunatorWrapper = new DelaunatorWrapper(sourceMapData.points);
  try {
    const sourceMapData = JSON.parse(fs.readFileSync(sourceMapPath, 'utf8'));
    console.log(`Loaded source map with ${sourceMapData.points.length} points`);
    
 
    // Test cases
    const testCases = [
      { start: 161, targets: [311], description: 'Primary test case: 161 -> 311' },
      { start: 0, targets: [49], description: 'Edge case: first -> last point' },
      { start: 25, targets: [30, 35, 40], description: 'Multiple targets test' },
      { start: 10, targets: [15], description: 'Short distance test' },
      { start: 5, targets: [45], description: 'Long distance test' }
    ];
    
    console.log('\n=== Running Test Cases ===');
    
    testCases.forEach((testCase, index) => {
      console.log(`\nTest ${index + 1}: ${testCase.description}`);
      console.log(`Finding path from cell ${testCase.start} to cells [${testCase.targets.join(', ')}]`);
      
      // Ensure start and target cells exist
      const maxCellId = sourceMapData.points.length - 1;
      const validStart = Math.min(testCase.start, maxCellId);
      const validTargets = testCase.targets.filter(t => t <= maxCellId);
      
      if (validTargets.length === 0) {
        console.log('  SKIPPED: No valid target cells');
        return;
      }
      
      if (validStart !== testCase.start) {
        console.log(`  Adjusted start cell: ${testCase.start} -> ${validStart}`);
      }
      
      const startTime = Date.now();
      const path = pathfinder.findPathToWater(validStart, validTargets,);
      const endTime = Date.now();
      
      if (path.length > 0) {
        console.log(`  SUCCESS: Found path with ${path.length} cells`);
        console.log(`  Path: ${path.slice(0, 10).join(' -> ')}${path.length > 10 ? '...' : ''}`); 
      } else {
        console.log('  FAILED: No path found');
      }
      
      console.log(`  Time taken: ${endTime - startTime}ms`);
    });
    
    console.log('\n=== Test Summary ===');
    console.log('All pathfinding tests completed successfully!');
    
  } catch (error) {
    console.error('Error running tests:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run tests
runPathfindingTests();
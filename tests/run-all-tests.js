import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const logsRoot = path.join(__dirname, 'logs');

async function findTestFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return findTestFiles(entryPath);
    }
    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      return [entryPath];
    }
    return [];
  }));
  return files.flat();
}

async function ensureLogDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function runNodeTest(filePath, logDir) {
  return new Promise((resolve) => {
    const relative = path.relative(repoRoot, filePath);
    const sanitizedName = relative.replace(/[\\/]/g, '__');
    const logFilePath = path.join(logDir, `${sanitizedName}.log`);
    const outputChunks = [];

    const child = spawn(process.execPath, [filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: repoRoot
    });

    child.stdout.on('data', (chunk) => outputChunks.push(chunk));
    child.stderr.on('data', (chunk) => outputChunks.push(chunk));

    child.on('close', (code) => {
      const logContent = Buffer.concat(outputChunks).toString('utf-8');
      fs.writeFile(logFilePath, logContent).catch((err) => {
        console.error(`Failed to write log for ${relative}:`, err);
      }).finally(() => {
        if (code === 0) {
          console.log(`[PASS] ${relative} (log: ${path.relative(repoRoot, logFilePath)})`);
        } else {
          console.log(`[FAIL] ${relative} (exit code ${code}, log: ${path.relative(repoRoot, logFilePath)})`);
        }
        resolve(code);
      });
    });
  });
}

async function main() {
  await ensureLogDir(logsRoot);
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runLogDir = path.join(logsRoot, runTimestamp);
  await ensureLogDir(runLogDir);
  console.log(`Logs for this run: ${path.relative(repoRoot, runLogDir)}`);

  const testFiles = (await findTestFiles(__dirname)).sort();

  if (testFiles.length === 0) {
    console.log('No .test.js files found under tests/.');
    return;
  }

  let hasFailure = false;

  for (const file of testFiles) {
    const code = await runNodeTest(file, runLogDir);
    if (code !== 0) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    console.log('\nOne or more tests failed.');
    process.exitCode = 1;
  } else {
    console.log('\nAll tests passed successfully.');
  }
}

main().catch((error) => {
  console.error('Error running tests:', error);
  process.exitCode = 1;
});

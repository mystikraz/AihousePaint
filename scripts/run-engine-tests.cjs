const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, '.test-dist');
fs.rmSync(outputDir, { recursive: true, force: true });

const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const compile = spawnSync(process.execPath, [
  tsc,
  '--target', 'ES2020',
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--esModuleInterop',
  '--skipLibCheck',
  '--outDir', outputDir,
  'tests/architectural-layer-engine.test.ts',
  'lib/architectural-layer-engine.ts',
  'lib/architectural-presets.ts',
  'lib/canvas-recolor.ts',
  'lib/segmentation.ts',
], { cwd: root, stdio: 'inherit' });

if (compile.status !== 0) process.exit(compile.status ?? 1);

const testFile = path.join(outputDir, 'tests', 'architectural-layer-engine.test.js');
const benchmarkScriptDir = path.join(outputDir, 'scripts');
fs.mkdirSync(benchmarkScriptDir, { recursive: true });
fs.copyFileSync(
  path.join(root, 'scripts', 'segmentation-benchmark.cjs'),
  path.join(benchmarkScriptDir, 'segmentation-benchmark.cjs')
);
const result = spawnSync(process.execPath, ['--test', testFile], { cwd: root, stdio: 'inherit' });
fs.rmSync(outputDir, { recursive: true, force: true });
process.exit(result.status ?? 1);

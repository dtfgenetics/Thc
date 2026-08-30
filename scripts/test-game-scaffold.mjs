import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const scaffoldScript = path.join(repoRoot, 'scripts', 'create-game-scaffold.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dtf-game-scaffold-'));
const id = 'ci-scaffold-game';

try {
  const scaffold = spawnSync(process.execPath, [scaffoldScript, id, 'CI Scaffold Game'], {
    cwd: tempRoot,
    encoding: 'utf8'
  });
  assert.equal(scaffold.status, 0, scaffold.stderr || scaffold.stdout);

  const gameRoot = path.join(tempRoot, 'games', id);
  const required = [
    'README.md',
    'game.json',
    'docs/ARCHITECTURE.md',
    'src/main.mjs',
    'src/input.mjs',
    'src/simulation/state.mjs',
    'src/render/README.md',
    'src/ui/README.md',
    'src/assets/manifest.json',
    'test/smoke.test.mjs'
  ];
  for (const rel of required) assert.ok(fs.existsSync(path.join(gameRoot, rel)), `missing scaffold file: ${rel}`);

  const manifest = JSON.parse(fs.readFileSync(path.join(gameRoot, 'game.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.architecture, 'dtf-browser-game-v1');
  assert.equal(manifest.route, null);
  assert.equal(manifest.releaseGates.deploymentRegistered, false);
  assert.equal(manifest.implementation.publicRoute, null);

  const smoke = spawnSync(process.execPath, [path.join(gameRoot, 'test', 'smoke.test.mjs')], {
    cwd: tempRoot,
    encoding: 'utf8'
  });
  assert.equal(smoke.status, 0, smoke.stderr || smoke.stdout);
  assert.match(smoke.stdout, /scaffold smoke test passed/i);

  console.log('Game scaffold contract OK');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

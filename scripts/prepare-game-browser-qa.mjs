import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadGameQaCatalog, readJson } from './lib/game-qa-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = readJson(path.join(ROOT, 'configuration/game-qa/browser-contracts.json'));
const state = loadGameQaCatalog(ROOT);
const requested = new Set();
const args = process.argv.slice(2);

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--game') requested.add(...String(args[++i] ?? '').split(',').filter(Boolean));
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: node scripts/prepare-game-browser-qa.mjs [--game id[,id]]');
    process.exit(0);
  } else {
    throw new Error(`Unknown argument: ${args[i]}`);
  }
}

let games = state.catalog;
if (requested.size) {
  games = games.filter((game) => requested.has(game.id));
  const found = new Set(games.map((game) => game.id));
  const missing = [...requested].filter((id) => !found.has(id));
  if (missing.length) throw new Error(`Unknown game ID(s): ${missing.join(', ')}`);
}

for (const game of games) {
  const contract = config.games?.[game.id];
  const prepare = contract?.prepare;
  if (!prepare) continue;
  if (prepare.command !== 'node') {
    throw new Error(`${game.id}: only shell-free Node preparation commands are allowed`);
  }
  if (!Array.isArray(prepare.args) || !prepare.args.length) {
    throw new Error(`${game.id}: prepare.args must contain a repository-relative script path`);
  }
  const scriptPath = path.resolve(ROOT, prepare.args[0]);
  if (!scriptPath.startsWith(ROOT) || !fs.existsSync(scriptPath)) {
    throw new Error(`${game.id}: prepare script does not exist inside the repository: ${prepare.args[0]}`);
  }

  console.log(`[game-qa:prepare] ${game.id}: node ${prepare.args.join(' ')}`);
  const run = spawnSync(process.execPath, prepare.args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (run.status !== 0) {
    throw new Error(`${game.id}: browser QA preparation failed with exit code ${run.status}`);
  }

  for (const generated of contract.generatedRuntime ?? []) {
    const generatedPath = path.resolve(ROOT, generated);
    if (!generatedPath.startsWith(ROOT) || !fs.existsSync(generatedPath) || fs.statSync(generatedPath).size === 0) {
      throw new Error(`${game.id}: generated browser QA runtime is missing or empty: ${generated}`);
    }
  }
}

console.log('[game-qa:prepare] generated-runtime preparation complete');

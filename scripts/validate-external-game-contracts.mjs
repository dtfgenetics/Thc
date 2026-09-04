import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = new URL('../site/deployment/external-games/', import.meta.url);
const entries = (await readdir(root)).filter(name => name.endsWith('.json')).sort();
const errors = [];
const ids = new Set();
const routes = new Set();

if (entries.length === 0) errors.push('no external game contracts found');

for (const filename of entries) {
  const file = new URL(filename, root);
  let game;
  try {
    game = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    errors.push(`${filename}: invalid JSON (${error.message})`);
    continue;
  }

  const where = `external-games/${filename}`;
  if (typeof game.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(game.id)) errors.push(`${where}: invalid id`);
  else if (ids.has(game.id)) errors.push(`${where}: duplicate id ${game.id}`);
  else ids.add(game.id);

  if (typeof game.title !== 'string' || game.title.trim().length < 3) errors.push(`${where}: title required`);
  if (typeof game.repository !== 'string' || !/^dtfgenetics\/[A-Za-z0-9._-]+$/.test(game.repository)) errors.push(`${where}: invalid repository`);
  if (typeof game.route !== 'string' || !game.route.startsWith('/games/') || !game.route.endsWith('/') || game.route.includes('..')) errors.push(`${where}: route must be /games/.../`);
  else if (routes.has(game.route)) errors.push(`${where}: duplicate route ${game.route}`);
  else routes.add(game.route);

  if (!['release-candidate', 'ready-to-package', 'runtime-integration'].includes(game.status)) errors.push(`${where}: unsupported status ${String(game.status)}`);
  if (typeof game.artifact !== 'string' || game.artifact.trim() === '') errors.push(`${where}: artifact required`);
  if (typeof game.build !== 'string' || game.build.trim() === '') errors.push(`${where}: build command required`);
  if (!game.promotionGate || game.promotionGate.standaloneCI !== 'required' || game.promotionGate.browserAcceptance !== 'required') errors.push(`${where}: standalone/browser promotion gates are required`);
}

if (errors.length) {
  console.error(`External game contract validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`External game contracts valid: ${entries.length} contract(s), ${routes.size} reserved route(s).`);

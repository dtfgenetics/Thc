#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const markerPath = 'site/public-route-patch/games/crossword/source-revision.txt';
const text = await fs.readFile(markerPath, 'utf8');
const values = Object.fromEntries(text.trim().split(/\r?\n/).map((line) => {
  const index = line.indexOf('=');
  return index > 0 ? [line.slice(0, index), line.slice(index + 1)] : [line, ''];
}));

if (values.repository !== 'dtfgenetics/Thc-crossword-') {
  throw new Error(`Unexpected crossword repository: ${values.repository || 'missing'}`);
}
if (!/^[0-9a-f]{40}$/.test(values.commit || '')) {
  throw new Error('Crossword source marker must contain a full 40-character commit SHA.');
}
if (values.route !== 'https://dtfseeds.com/games/crossword/') {
  throw new Error(`Unexpected crossword production route: ${values.route || 'missing'}`);
}

const remote = `https://github.com/${values.repository}.git`;
const advertised = execFileSync('git', ['ls-remote', remote], { encoding: 'utf8' });
const temp = process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
const checkout = path.join(temp, 'crossword-release-source-check');
execFileSync('rm', ['-rf', checkout]);
execFileSync('git', ['init', checkout], { stdio: 'ignore' });
execFileSync('git', ['-C', checkout, 'remote', 'add', 'origin', remote]);
execFileSync('git', ['-C', checkout, 'fetch', '--depth=1', 'origin', values.commit], { stdio: 'inherit' });
const resolved = execFileSync('git', ['-C', checkout, 'rev-parse', 'FETCH_HEAD'], { encoding: 'utf8' }).trim();
if (resolved !== values.commit) throw new Error(`Unable to resolve crossword release commit ${values.commit}.`);
execFileSync('git', ['-C', checkout, 'checkout', '--detach', values.commit], { stdio: 'inherit' });

for (const args of [
  ['ci', '--ignore-scripts'],
  ['test'],
  ['run', 'verify'],
  ['run', 'build']
]) {
  execFileSync('npm', args, { cwd: checkout, stdio: 'inherit' });
}

const requiredFiles = [
  'dist/index.html',
  'dist/puzzles/current.json',
  'dist/puzzles/index.json'
];
for (const file of requiredFiles) {
  const stat = await fs.stat(path.join(checkout, file)).catch(() => null);
  if (!stat?.isFile() || stat.size === 0) throw new Error(`Crossword release build is missing ${file}.`);
}

const builtHtml = await fs.readFile(path.join(checkout, 'dist/index.html'), 'utf8');
if (!builtHtml.includes('/games/crossword/')) throw new Error('Crossword build does not target /games/crossword/.');
if (builtHtml.includes('/src/main.js') || builtHtml.includes('/src/keyboard-polish.js')) {
  throw new Error('Crossword build still references development source entrypoints.');
}
if (!/\/games\/crossword\/assets\/.+\.js/.test(builtHtml)) throw new Error('Crossword build is missing a production JS asset reference.');
if (!/\/games\/crossword\/assets\/.+\.css/.test(builtHtml)) throw new Error('Crossword build is missing a production CSS asset reference.');

const current = JSON.parse(await fs.readFile(path.join(checkout, 'dist/puzzles/current.json'), 'utf8'));
const archive = JSON.parse(await fs.readFile(path.join(checkout, 'dist/puzzles/index.json'), 'utf8'));
if (!current.id || !Array.isArray(current.grid) || current.grid.length === 0) throw new Error('Built current crossword puzzle is incomplete.');
if (!Array.isArray(current.words) || current.words.length < 10) throw new Error('Built current crossword has fewer than 10 words.');
if (!Array.isArray(archive.puzzles) || !archive.puzzles.some((entry) => entry.id === current.id)) {
  throw new Error(`Built crossword archive does not contain current puzzle ${current.id || 'unknown'}.`);
}

console.log(`Crossword release source verified and built: ${values.repository}@${values.commit}`);
console.log(`Production route: ${values.route}`);
console.log(`Current puzzle: ${current.id}; words: ${current.words.length}`);

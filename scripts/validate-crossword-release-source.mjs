#!/usr/bin/env node
import fs from 'node:fs/promises';
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
if (!advertised.includes(values.commit)) {
  const temp = process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
  const repo = `${temp}/crossword-release-source-check`;
  execFileSync('rm', ['-rf', repo]);
  execFileSync('git', ['init', repo], { stdio: 'ignore' });
  execFileSync('git', ['-C', repo, 'remote', 'add', 'origin', remote]);
  execFileSync('git', ['-C', repo, 'fetch', '--depth=1', 'origin', values.commit], { stdio: 'ignore' });
  const resolved = execFileSync('git', ['-C', repo, 'rev-parse', 'FETCH_HEAD'], { encoding: 'utf8' }).trim();
  if (resolved !== values.commit) throw new Error(`Unable to resolve crossword release commit ${values.commit}.`);
}

console.log(`Crossword release source verified: ${values.repository}@${values.commit}`);
console.log(`Production route: ${values.route}`);

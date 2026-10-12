#!/usr/bin/env node
// Inventory Discord invite URLs in source-managed public content.
// Read-only by default; use --strict in CI after Discord admins verify a canonical code.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

const root = process.cwd();
const paths = ['README.md', 'site', 'scripts', 'docs'];
const extensions = new Set(['.md', '.html', '.js', '.mjs', '.ts', '.tsx', '.json', '.php', '.css']);
const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);
const results = new Map();
const invitePattern = /https?:\/\/(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/g;

async function walk(path) {
  let entries;
  try { entries = await readdir(path, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOTDIR') return scan(path); if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) await walk(child);
    else if (entry.isFile()) await scan(child);
  }
}

async function scan(path) {
  if (!extensions.has(extname(path))) return;
  const source = await readFile(path, 'utf8');
  const matches = [...source.matchAll(invitePattern)];
  matches.forEach(match => {
    const key = match[1];
    const rows = results.get(key) || [];
    const line = source.slice(0, match.index).split('\n').length;
    rows.push({ path: relative(root, path).replaceAll('\\', '/'), line });
    results.set(key, rows);
  });
}

for (const path of paths) await walk(join(root, path));
const report = {
  timestamp: new Date().toISOString(),
  verifiedInDiscord: false,
  distinctInviteCodes: results.size,
  invites: [...results.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, occurrences]) => ({
    code, count: occurrences.length, occurrences
  }))
};
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--strict') && results.size !== 1) {
  console.error('Invite audit failed: exactly one confirmed canonical invite code expected. Verify all codes with an authorized Discord admin before enforcing.');
  process.exitCode = 1;
}

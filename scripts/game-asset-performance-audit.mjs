import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameQaCatalog, readJson } from './lib/game-qa-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = readJson(path.join(ROOT, 'configuration/game-qa/performance-budgets.json'));
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const selected = new Set();
let outputDir = path.join(ROOT, 'artifacts/game-qa/assets');

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--game') selected.add(...String(args[++i] ?? '').split(',').filter(Boolean));
  if (args[i] === '--output') outputDir = path.resolve(ROOT, args[++i]);
}

if (config.schemaVersion !== 1) throw new Error(`Unsupported performance budget schema ${config.schemaVersion}`);

const scriptExt = new Set(['.js', '.mjs', '.cjs']);
const styleExt = new Set(['.css']);
const imageExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);
const audioExt = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);

function category(file) {
  const ext = path.extname(file).toLowerCase();
  if (scriptExt.has(ext)) return 'scriptBytes';
  if (styleExt.has(ext)) return 'styleBytes';
  if (imageExt.has(ext)) return 'imageBytes';
  if (audioExt.has(ext)) return 'audioBytes';
  return 'otherBytes';
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name.endsWith('.map')) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function mergedBudget(gameId, level) {
  return {
    ...(config.defaults?.[level] ?? {}),
    ...(config.games?.[gameId]?.[level] ?? {}),
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

const state = loadGameQaCatalog(ROOT);
let games = state.catalog.filter((game) => game.integrationMode === 'local-static' && game.integrationPath);
if (selected.size) {
  games = games.filter((game) => selected.has(game.id));
  const found = new Set(games.map((game) => game.id));
  const missing = [...selected].filter((id) => !found.has(id));
  if (missing.length) throw new Error(`Unknown or non-local-static game ID(s): ${missing.join(', ')}`);
}

const duplicateIndex = new Map();
const reports = [];
let hardFailureCount = 0;
let warningCount = 0;

for (const game of games) {
  const root = path.join(ROOT, game.integrationPath);
  if (!fs.existsSync(root)) {
    reports.push({ id: game.id, title: game.title, status: 'FAIL', findings: [`integration path missing: ${game.integrationPath}`] });
    hardFailureCount += 1;
    continue;
  }

  const files = walk(root);
  const totals = {
    totalBytes: 0,
    scriptBytes: 0,
    styleBytes: 0,
    imageBytes: 0,
    audioBytes: 0,
    otherBytes: 0,
    singleFileBytes: 0,
    fileCount: files.length,
  };
  const largest = [];

  for (const file of files) {
    const stat = fs.statSync(file);
    const size = stat.size;
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    totals.totalBytes += size;
    totals[category(file)] += size;
    totals.singleFileBytes = Math.max(totals.singleFileBytes, size);
    largest.push({ path: rel, bytes: size });

    if (size >= 4096) {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (!duplicateIndex.has(hash)) duplicateIndex.set(hash, []);
      duplicateIndex.get(hash).push({ gameId: game.id, path: rel, bytes: size });
    }
  }
  largest.sort((a, b) => b.bytes - a.bytes);

  const soft = mergedBudget(game.id, 'soft');
  const hard = mergedBudget(game.id, 'hard');
  const warnings = [];
  const failures = [];
  for (const [metric, limit] of Object.entries(hard)) {
    if (Number.isFinite(limit) && Number.isFinite(totals[metric]) && totals[metric] > limit) {
      failures.push(`${metric} ${formatBytes(totals[metric])} exceeds hard budget ${formatBytes(limit)}`);
    }
  }
  for (const [metric, limit] of Object.entries(soft)) {
    if (Number.isFinite(limit) && Number.isFinite(totals[metric]) && totals[metric] > limit && !failures.some((line) => line.startsWith(metric))) {
      warnings.push(`${metric} ${formatBytes(totals[metric])} exceeds soft budget ${formatBytes(limit)}`);
    }
  }

  hardFailureCount += failures.length;
  warningCount += warnings.length;
  reports.push({
    id: game.id,
    title: game.title,
    integrationPath: game.integrationPath,
    status: failures.length ? 'FAIL' : warnings.length ? 'WARN' : 'PASS',
    totals,
    failures,
    warnings,
    largest: largest.slice(0, 10),
  });
}

const duplicates = [...duplicateIndex.values()]
  .filter((entries) => new Set(entries.map((entry) => entry.gameId)).size > 1)
  .sort((a, b) => b[0].bytes - a[0].bytes)
  .slice(0, 50);

fs.mkdirSync(outputDir, { recursive: true });
const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  games: reports,
  duplicateAssets: duplicates,
  totals: {
    games: reports.length,
    pass: reports.filter((report) => report.status === 'PASS').length,
    warn: reports.filter((report) => report.status === 'WARN').length,
    fail: reports.filter((report) => report.status === 'FAIL').length,
    hardFailures: hardFailureCount,
    softWarnings: warningCount,
    crossGameDuplicateGroups: duplicates.length,
  },
};
fs.writeFileSync(path.join(outputDir, 'asset-performance.json'), `${JSON.stringify(payload, null, 2)}\n`);

const lines = [
  '# DTF Game Asset / Performance Audit',
  '',
  `Generated: ${payload.generatedAt}`,
  '',
  '| Game | Status | Total | JS | CSS | Images | Audio | Files |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
];
for (const report of reports) {
  if (!report.totals) {
    lines.push(`| ${report.title} | FAIL | — | — | — | — | — | — |`);
    continue;
  }
  lines.push(`| ${report.title} | ${report.status} | ${formatBytes(report.totals.totalBytes)} | ${formatBytes(report.totals.scriptBytes)} | ${formatBytes(report.totals.styleBytes)} | ${formatBytes(report.totals.imageBytes)} | ${formatBytes(report.totals.audioBytes)} | ${report.totals.fileCount} |`);
}
for (const report of reports.filter((entry) => entry.failures?.length || entry.warnings?.length)) {
  lines.push('', `## ${report.title}`);
  for (const failure of report.failures ?? []) lines.push(`- FAIL: ${failure}`);
  for (const warning of report.warnings ?? []) lines.push(`- WARN: ${warning}`);
  if (report.largest?.length) {
    lines.push('- Largest files:');
    for (const file of report.largest.slice(0, 5)) lines.push(`  - ${file.path}: ${formatBytes(file.bytes)}`);
  }
}
if (duplicates.length) {
  lines.push('', '## Cross-game duplicate asset groups');
  for (const entries of duplicates.slice(0, 20)) {
    lines.push(`- ${formatBytes(entries[0].bytes)}: ${entries.map((entry) => `${entry.gameId}:${entry.path}`).join(' | ')}`);
  }
}
fs.writeFileSync(path.join(outputDir, 'asset-performance.md'), `${lines.join('\n')}\n`);

console.log(`asset/performance audit: PASS=${payload.totals.pass} WARN=${payload.totals.warn} FAIL=${payload.totals.fail} duplicate-groups=${duplicates.length}`);
console.log(`asset/performance artifacts: ${path.relative(ROOT, outputDir)}`);
if (hardFailureCount > 0 || (strict && warningCount > 0)) process.exitCode = 1;

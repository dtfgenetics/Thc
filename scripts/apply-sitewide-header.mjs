import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import {
  SITEWIDE_HEADER_HTML,
  SITEWIDE_HEADER_SCRIPT_TAG,
  SITEWIDE_HEADER_STYLE_TAG,
} from './lib/sitewide-header-template.mjs';

const root = resolve(process.argv[2] || 'release');
const checkOnly = process.argv.includes('--check');
const report = { root, checkOnly, scanned: 0, changed: 0, replacedLegacyHeaders: 0, skipped: 0, failures: [] };

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.html') files.push(path);
  }
  return files;
}

function removeOwnedFragment(html, expression) {
  return html.replace(expression, '');
}

function legacyHeaderScore(fragment) {
  const lower = fragment.toLowerCase();
  const signals = [
    'dtf genetics',
    'dream the future',
    'teaching healthy cultivation',
    'href="/seeds/',
    'href="/learn/',
    'href="/courses/',
    'href="/tools/',
    'href="/games/',
    'href="/community/',
    'href="/shop/',
  ];
  return signals.reduce((score, signal) => score + (lower.includes(signal) ? 1 : 0), 0);
}

function removeLegacyGlobalHeader(html) {
  const bodyIndex = html.search(/<body\b[^>]*>/i);
  if (bodyIndex < 0) return { html, removed: false };
  const bodyOpen = html.slice(bodyIndex).match(/<body\b[^>]*>/i)?.[0] || '';
  const searchStart = bodyIndex + bodyOpen.length;
  const searchWindow = html.slice(searchStart, Math.min(html.length, searchStart + 24000));
  const matches = [...searchWindow.matchAll(/<header\b[^>]*>[\s\S]*?<\/header>/gi)];
  for (const match of matches) {
    const fragment = match[0];
    if (fragment.includes('data-dtf-sitewide-header') || fragment.includes('data-dtf-shell="header-v5"')) continue;
    if (legacyHeaderScore(fragment) < 4) continue;
    const absoluteStart = searchStart + match.index;
    return { html: html.slice(0, absoluteStart) + html.slice(absoluteStart + fragment.length), removed: true };
  }
  return { html, removed: false };
}

function reconcileDocument(source) {
  if (!/<html\b/i.test(source) || !/<body\b/i.test(source)) return { output: source, changed: false, removedLegacy: false, skipped: true };

  let output = source;
  output = removeOwnedFragment(output, /<style\b[^>]*id=["']dtf-sitewide-header-v5-style["'][^>]*>[\s\S]*?<\/style>\s*/gi);
  output = removeOwnedFragment(output, /<script\b[^>]*id=["']dtf-sitewide-header-v5-script["'][^>]*>[\s\S]*?<\/script>\s*/gi);
  output = removeOwnedFragment(output, /<header\b[^>]*data-dtf-sitewide-header=["'][^"']+["'][^>]*>[\s\S]*?<\/header>\s*/gi);

  const legacy = removeLegacyGlobalHeader(output);
  output = legacy.html;

  if (/<\/head>/i.test(output)) output = output.replace(/<\/head>/i, `${SITEWIDE_HEADER_STYLE_TAG}\n</head>`);
  else output = `${SITEWIDE_HEADER_STYLE_TAG}\n${output}`;

  output = output.replace(/<body\b([^>]*)>/i, `<body$1>\n${SITEWIDE_HEADER_HTML}`);
  if (/<\/body>/i.test(output)) output = output.replace(/<\/body>/i, `${SITEWIDE_HEADER_SCRIPT_TAG}\n</body>`);
  else output += `\n${SITEWIDE_HEADER_SCRIPT_TAG}\n`;

  return { output, changed: output !== source, removedLegacy: legacy.removed, skipped: false };
}

const files = await walk(root);
for (const file of files) {
  report.scanned += 1;
  const source = await readFile(file, 'utf8');
  const result = reconcileDocument(source);
  const rel = relative(root, file);
  if (result.skipped) { report.skipped += 1; continue; }
  if (!result.output.includes('data-dtf-shell="header-v5"') || !result.output.includes('dtf-sitewide-header-v5-style')) {
    report.failures.push(`${rel}: canonical header markers missing after reconciliation`);
    continue;
  }
  if (result.removedLegacy) report.replacedLegacyHeaders += 1;
  if (result.changed) {
    report.changed += 1;
    if (!checkOnly) await writeFile(file, result.output);
  }
}

if (checkOnly && report.changed > 0) report.failures.push(`${report.changed} HTML files require sitewide-header reconciliation`);
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;

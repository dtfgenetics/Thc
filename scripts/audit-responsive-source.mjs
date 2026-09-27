import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const roots = [
  'site/public-route-patch',
  'site/wordpress/pages',
  'apps/growlens-web/public'
];

const findings = [];
const stats = { files: 0, html: 0, css: 0 };

async function walk(dir) {
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else await inspect(full);
  }
}

function add(file, severity, code, detail) {
  findings.push({ file, severity, code, detail });
}

async function inspect(file) {
  const ext = extname(file).toLowerCase();
  if (!['.html', '.css'].includes(ext)) return;
  const text = await readFile(file, 'utf8');
  const rel = relative(process.cwd(), file).replaceAll('\\', '/');
  stats.files += 1;
  if (ext === '.html') stats.html += 1;
  if (ext === '.css') stats.css += 1;

  if (ext === '.html') {
    if (!/<meta[^>]+name=["']viewport["'][^>]+width=device-width/i.test(text) &&
        !/<meta[^>]+content=["'][^"']*width=device-width[^"']*["'][^>]+name=["']viewport["']/i.test(text)) {
      add(rel, 'error', 'missing-viewport', 'HTML page has no width=device-width viewport meta tag.');
    }
  }

  const cssText = ext === '.css'
    ? text
    : [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');

  if (!cssText.trim()) return;

  if (!/@media\s*\([^)]*max-width/i.test(cssText)) {
    add(rel, 'warning', 'no-mobile-breakpoint', 'Page-local CSS has no max-width responsive breakpoint.');
  }
  if (/\bwidth\s*:\s*100vw\b/i.test(cssText)) {
    add(rel, 'warning', 'viewport-width', '100vw can overflow when scrollbars or nested containers are present; prefer 100% or shared containers.');
  }
  if (/\bmin-width\s*:\s*(?:[5-9]\d\d|\d{4,})px\b/i.test(cssText)) {
    add(rel, 'warning', 'large-fixed-min-width', 'Large fixed min-width can force horizontal overflow on tablet/mobile.');
  }
  if (/grid-template-columns\s*:\s*repeat\([^,]+,\s*(?!minmax\(0,)[^)]+\)/i.test(cssText)) {
    add(rel, 'info', 'grid-shrink-risk', 'Review grid tracks for minmax(0,1fr) or a mobile collapse path.');
  }
  if (/position\s*:\s*sticky/i.test(cssText) && !/--dtf-global-header-height/i.test(cssText)) {
    add(rel, 'warning', 'sticky-offset-contract', 'Sticky UI does not reference the shared global-header-height contract.');
  }
  if (/overflow-x\s*:\s*(?:hidden|clip)/i.test(cssText) &&
      /(?:table|pre|\.grid|grid-template-columns)/i.test(cssText) &&
      !/overflow-x\s*:\s*auto/i.test(cssText)) {
    add(rel, 'info', 'hidden-overflow-review', 'Page clips horizontal overflow; verify dense content is not made unreachable.');
  }
}

for (const root of roots) await walk(root);

const severityOrder = { error: 0, warning: 1, info: 2 };
findings.sort((a,b) => severityOrder[a.severity] - severityOrder[b.severity] || a.file.localeCompare(b.file) || a.code.localeCompare(b.code));

const summary = findings.reduce((acc, row) => {
  acc[row.severity] = (acc[row.severity] || 0) + 1;
  return acc;
}, { error: 0, warning: 0, info: 0 });

console.log(JSON.stringify({
  audit: 'DTF responsive source audit v1',
  roots,
  stats,
  summary,
  findings
}, null, 2));

if (summary.error > 0) process.exit(1);

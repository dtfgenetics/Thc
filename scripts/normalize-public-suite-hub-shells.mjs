import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import {
  SITEWIDE_HEADER_HTML,
  SITEWIDE_HEADER_SCRIPT_TAG,
  SITEWIDE_HEADER_STYLE_TAG,
} from './lib/sitewide-header-template-v6.mjs';

const suiteRoot = resolve(process.argv[2] || 'release');
const responsiveLayoutPath = resolve(process.env.DTF_RESPONSIVE_LAYOUT_CSS || 'site/wordpress/assets/responsive-layout-v1.css');
const uxPolishPath = resolve(process.env.DTF_SITEWIDE_UX_POLISH_CSS || 'site/wordpress/assets/sitewide-ux-polish-v1.css');

const [responsiveLayoutCss, uxPolishCss] = await Promise.all([
  readFile(responsiveLayoutPath, 'utf8'),
  readFile(uxPolishPath, 'utf8'),
]);
if (!responsiveLayoutCss.includes('DTFSeeds shared responsive layout system v1')) throw new Error('Responsive layout stylesheet marker missing');
if (!uxPolishCss.includes('DTFSeeds sitewide UX polish v1')) throw new Error('Sitewide UX polish stylesheet marker missing');

const sharedStyles = `${SITEWIDE_HEADER_STYLE_TAG}\n<style id="dtf-responsive-layout-v1">${responsiveLayoutCss}</style>\n<style id="dtf-sitewide-ux-polish-v1">${uxPolishCss}</style>`;
const targets = ['tools/index.html', 'games/index.html', 'projects/index.html'];

function stripOwnedShell(source) {
  let html = source
    .replace(/<style\b[^>]*id=["']dtf-sitewide-header-v[56]-style["'][^>]*>[\s\S]*?<\/style>\s*/gi, '')
    .replace(/<style\b[^>]*id=["']dtf-responsive-layout-v1["'][^>]*>[\s\S]*?<\/style>\s*/gi, '')
    .replace(/<style\b[^>]*id=["']dtf-sitewide-ux-polish-v1["'][^>]*>[\s\S]*?<\/style>\s*/gi, '')
    .replace(/<script\b[^>]*id=["']dtf-sitewide-header-v[56]-script["'][^>]*>[\s\S]*?<\/script>\s*/gi, '')
    .replace(/<header\b[^>]*data-dtf-sitewide-header=["'][^"']+["'][^>]*>[\s\S]*?<\/header>\s*/gi, '');

  const body = html.match(/<body\b[^>]*>/i);
  if (!body || body.index == null) return html;
  const start = body.index + body[0].length;
  const window = html.slice(start, Math.min(html.length, start + 26000));
  const headers = [...window.matchAll(/<header\b[^>]*>[\s\S]*?<\/header>/gi)];
  for (const match of headers) {
    const fragment = match[0].toLowerCase();
    const signals = [
      'dtf genetics', 'dream the future', 'primary navigation',
      'href="/seeds/', 'href="/learn/', 'href="/courses/', 'href="/tools/',
      'href="/games/', 'href="/community/', 'href="/shop/',
    ];
    const score = signals.reduce((total, token) => total + (fragment.includes(token) ? 1 : 0), 0);
    if (score < 4) continue;
    const absolute = start + match.index;
    html = html.slice(0, absolute) + html.slice(absolute + match[0].length);
    break;
  }
  return html;
}

function normalize(source, rel) {
  if (!/<html\b/i.test(source) || !/<body\b/i.test(source)) throw new Error(`${rel}: expected complete HTML document`);
  let html = stripOwnedShell(source);
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${sharedStyles}\n</head>`);
  else throw new Error(`${rel}: closing head tag missing`);
  html = html.replace(/<body\b([^>]*)>/i, `<body$1>\n${SITEWIDE_HEADER_HTML}`);
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${SITEWIDE_HEADER_SCRIPT_TAG}\n</body>`);
  else throw new Error(`${rel}: closing body tag missing`);

  const header = html.match(/<header\b[^>]*data-dtf-shell=["']header-v6["'][^>]*>[\s\S]*?<\/header>/i)?.[0] || '';
  if (!header.includes('data-dtf-sitewide-header="canonical-eight-v1"')) throw new Error(`${rel}: canonical V6 marker missing after normalization`);
  const nav = header.match(/<nav\b[^>]*id=["']dtf-global-primary-nav["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1] || '';
  const labels = [...nav.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
  const expected = ['Home', 'Seeds', 'Learn', 'Courses', 'Diagnostic', 'Games', 'Community', 'Shop'];
  if (JSON.stringify(labels) !== JSON.stringify(expected)) throw new Error(`${rel}: unexpected canonical navigation ${JSON.stringify(labels)}`);
  return html;
}

const report = [];
for (const rel of targets) {
  const file = resolve(suiteRoot, rel);
  let source;
  try { source = await readFile(file, 'utf8'); }
  catch (error) {
    if (error?.code === 'ENOENT') { report.push({ rel, skipped: true, reason: 'missing from this suite' }); continue; }
    throw error;
  }
  const output = normalize(source, rel);
  await writeFile(file, output);
  report.push({ rel, changed: output !== source, bytes: Buffer.byteLength(output) });
}

console.log(JSON.stringify({ ok: true, suiteRoot, shell: 'header-v6', navigation: 'canonical-eight-v1', targets: report }, null, 2));

import process from 'node:process';

const BASE_URL = 'https://dtfseeds.com';
const routes = [
  { path: '/games/crossword/', title: 'Crossword', canonical: '/games/crossword/', minText: 100 },
  { path: '/games/who-took-it/', title: 'Who Took It', canonical: '/games/who-took-it/', minText: 100 },
  { path: '/growlens/', title: 'GrowLens', canonical: '/growlens/', minText: 120 },
  { path: '/thc-grow-doc/', title: 'Grow Doc', canonical: '/thc-grow-doc/', minText: 120 },
  { path: '/tools/', title: 'Tools', canonical: '/tools/', minText: 500 },
  { path: '/projects/', title: 'Projects', canonical: '/projects/', minText: 700 },
];

const banned = ['email@email.com', '+123456789', 'Needed from owner', 'Reserved strain card'];

function textFromHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromHtml(html) {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
}

function canonicalFromHtml(html) {
  const links = html.match(/<link\b[^>]*>/gi) || [];
  for (const link of links) {
    const rel = link.match(/rel=["']([^"']+)["']/i)?.[1] || '';
    if (!rel.toLowerCase().split(/\s+/).includes('canonical')) continue;
    return link.match(/href=["']([^"']+)["']/i)?.[1] || '';
  }
  return '';
}

function descriptionFromHtml(html) {
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  for (const meta of metas) {
    if ((meta.match(/name=["']([^"']+)["']/i)?.[1] || '').toLowerCase() !== 'description') continue;
    return meta.match(/content=["']([^"']*)["']/i)?.[1] || '';
  }
  return '';
}

let failed = 0;
const seenTitles = new Map();

for (const route of routes) {
  const url = new URL(route.path, BASE_URL).href;
  const problems = [];
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'DTFSeeds-Public-Suite-QA/1.0' },
    });
    const html = await response.text();
    const text = textFromHtml(html);
    const title = titleFromHtml(html);
    const canonical = canonicalFromHtml(html);
    const description = descriptionFromHtml(html);

    if (response.status !== 200) problems.push(`HTTP ${response.status}`);
    if (!/<h1\b/i.test(html)) problems.push('missing H1');
    if (!title.toLowerCase().includes(route.title.toLowerCase())) problems.push(`title must include ${route.title}`);
    if (!description.trim()) problems.push('missing meta description');
    if (canonical !== new URL(route.canonical, BASE_URL).href) problems.push(`canonical mismatch: ${canonical || '<missing>'}`);
    if (text.length < route.minText) problems.push(`only ${text.length} crawlable characters; expected ${route.minText}+`);
    for (const phrase of banned) if (html.toLowerCase().includes(phrase.toLowerCase())) problems.push(`banned public phrase: ${phrase}`);

    if (seenTitles.has(title)) problems.push(`duplicate title also used by ${seenTitles.get(title)}`);
    else if (title) seenTitles.set(title, route.path);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length) {
    failed += 1;
    console.error(`FAIL ${route.path}`);
    for (const problem of problems) console.error(`  - ${problem}`);
  } else {
    console.log(`PASS ${route.path}`);
  }
}

try {
  const puzzle = await fetch(new URL('/puzzles/current.json', BASE_URL), {
    signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'DTFSeeds-Public-Suite-QA/1.0' },
  });
  if (!puzzle.ok) throw new Error(`HTTP ${puzzle.status}`);
  const data = await puzzle.json();
  if (!Array.isArray(data.grid) || !data.grid.length) throw new Error('current puzzle has no grid');
  if (!data.clues || typeof data.clues !== 'object') throw new Error('current puzzle has no clues');
  console.log('PASS /puzzles/current.json');
} catch (error) {
  failed += 1;
  console.error(`FAIL /puzzles/current.json: ${error instanceof Error ? error.message : String(error)}`);
}

if (failed) {
  console.error(`DTFSeeds public-suite audit failed: ${failed} check(s).`);
  process.exit(1);
}

console.log(`DTFSeeds public-suite audit passed: ${routes.length} HTML routes plus current puzzle data.`);

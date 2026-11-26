import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const heading = html => html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const links = html => new Set([...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)]
  .map(match => match[1]).filter(href => href.startsWith('/') && !href.startsWith('//') && !href.includes('#')));

export function verifyHubContract(source, live) {
  // Shared-shell normalization deliberately replaces header/footer links.
  // The hub's own promised destinations belong to its main content.
  const sourceMain = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (sourceMain) {
    const liveMain = live.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
    if (!liveMain) throw new Error('Public hub main content is missing');
    source = sourceMain;
    live = liveMain;
  }
  const expected = heading(source);
  if (!expected || heading(live) !== expected) throw new Error('Public hub H1 differs from packaged source');
  const expectedLinks = links(source), actualLinks = links(live);
  if (!expectedLinks.size) throw new Error('Packaged hub contains no internal destinations');
  const missing = [...expectedLinks].filter(href => !actualLinks.has(href));
  if (missing.length) throw new Error(`Public hub is missing packaged destinations: ${missing.join(', ')}`);
  return { heading: expected, destinations: expectedLinks.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [sourcePath, livePath] = process.argv.slice(2);
  if (!sourcePath || !livePath) throw new Error('Usage: verify-public-hub-contract.mjs SOURCE_HTML LIVE_HTML');
  console.log(JSON.stringify(verifyHubContract(readFileSync(sourcePath,'utf8'), readFileSync(livePath,'utf8'))));
}

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { stripNonRenderedMarkup } from './lib/html-audit-markup.mjs';
export const HOME_RELEASE_HEADING = 'Current releases, shown with the real strain cards.';

export function verifyHomeReleaseArtwork(html, cards, attempt = 1) {
  const rendered = stripNonRenderedMarkup(html).replace(/<!--[\s\S]*?-->/g, '');
  // Match the actual release section, never CSS comments or generated content.
  const sections = [...rendered.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)]
    .map(m => m[0]).filter(s => /<div\b[^>]*\sclass=["'][^"']*\brelease-grid\b[^"']*["']/i.test(s));
  const section = sections.length === 1 ? sections[0] : '';
  const images = section.match(/<img\b[^>]*>/gi) || [];
  const classCount = images.filter(s => /\sclass=["'][^"']*\bdtf-release-card-image\b[^"']*["']/i.test(s)).length;
  const hrefs = [...section.matchAll(/<a\b[^>]*\shref=["']([^"']+)["']/gi)].map(m=>m[1]);
  const routesOk = cards.every(card => hrefs.includes(`/product/${card.productSlug}/`));
  const altOk = cards.every(card => images.some(s => s.includes(`alt="${card.altText}"`) || s.includes(`alt='${card.altText}'`)));
  const portraitOk = images.length === cards.length && images.every(s => /aspect-ratio:\s*2\/3/.test(s) && /object-fit:\s*contain/.test(s));
  const headingOk = [...section.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].some(m=>m[1].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim() === HOME_RELEASE_HEADING);
  const ok = cards.length > 0 && classCount === cards.length && routesOk && altOk && portraitOk && headingOk;
  return {attempt, bytes:html.length, sectionBytes:section.length, classCount, routesOk, altOk, portraitOk, headingOk, ok};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = readFileSync(process.argv[2], 'utf8');
  const {cards} = JSON.parse(readFileSync('site/wordpress/products/strain-card-images.json', 'utf8'));
  const result = verifyHomeReleaseArtwork(html, cards, Number(process.argv[3] || 1));
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../site/wordpress/pages/community.html', import.meta.url), 'utf8');
const links = [...html.matchAll(/<a[^>]+href="https:\/\/discord\.gg\/[^"]+"[^>]*>/g)].map(match => match[0]);
assert.ok(links.length >= 1, 'community page must contain Discord entry links');
for (const link of links) {
  assert.match(link, /data-thc-cta="[\w-]+"/, 'Discord links must have a placement identifier');
  assert.match(link, /rel="noopener noreferrer"/, 'Discord links must be opened safely');
}
assert.match(html, /window\.dtfAnalyticsConsent !== true/, 'tracking must require affirmative consent');
assert.match(html, /Array\.isArray\(window\.dataLayer\)/, 'tracking must only use an existing configured data layer');
assert.match(html, /thc_discord_cta_click/, 'expected event is missing');
assert.doesNotMatch(html, /fetch\(\s*['"]https?:/, 'must not send unconsented third-party requests');
console.log('THC community CTA instrumentation static checks passed');

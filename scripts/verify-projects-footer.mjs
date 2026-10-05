import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function assertProjectsFooter(html, label = 'Projects') {
  // Count elements, not examples embedded in scripts, styles, or comments.
  const markup = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const footers = [...markup.matchAll(/<footer\b[^>]*>/gi)];
  const closing = [...markup.matchAll(/<\/footer\s*>/gi)];
  assert.equal(footers.length, 1, `${label}: expected exactly one footer`);
  assert.equal(closing.length, 1, `${label}: expected exactly one closing footer`);
  assert.match(footers[0][0], /\bdata-dtf-shell\s*=\s*(["'])footer-v6\1/i, `${label}: canonical footer shell missing`);
  assert.match(footers[0][0], /\bdata-dtf-sitewide-footer\s*=\s*(["'])canonical-eight-v1\1/i, `${label}: canonical footer identity missing`);
}

export async function verifyProjectsRoutes({ baseUrl = 'https://dtfseeds.com', fingerprint, fetchImpl = fetch } = {}) {
  assert.ok(fingerprint, 'Canonical Projects release fingerprint is required');
  const checks = [];
  for (const route of ['/projects/', '/projects/index.html']) {
    for (const cacheBust of [false, true]) {
      const url = new URL(route, baseUrl);
      if (cacheBust) url.searchParams.set('dtf_footer_check', `${Date.now()}-${checks.length}`);
      const response = await fetchImpl(url, {
        redirect: 'manual',
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', 'User-Agent': 'DTFSeeds-Projects-Footer/1.0' },
        signal: AbortSignal.timeout(45_000),
      });
      const label = `${route} (${cacheBust ? 'fresh' : 'ordinary'})`;
      assert.equal(response.status, 200, `${label}: expected direct HTTP 200`);
      assert.equal(response.headers.get('location'), null, `${label}: unexpected redirect`);
      assert.match(response.headers.get('content-type') || '', /text\/html/i, `${label}: expected HTML`);
      const html = await response.text();
      assert.ok(html.includes(fingerprint), `${label}: canonical release fingerprint missing`);
      assert.ok(html.includes('This roadmap follows the same release records used by DTFSeeds deployment.'), `${label}: Projects content missing`);
      assertProjectsFooter(html, label);
      checks.push({ route, cacheBust, status: response.status, footerCount: 1, canonicalFooterCount: 1 });
    }
  }
  return { ok: true, checkedAt: new Date().toISOString(), fingerprint, checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = await readFile(new URL('../site/public-route-patch/projects/index.html', import.meta.url), 'utf8');
  const fingerprint = source.match(/dtf-release-fingerprint: [A-Za-z0-9._:-]+/)?.[0];
  console.log(JSON.stringify(await verifyProjectsRoutes({ fingerprint }), null, 2));
}

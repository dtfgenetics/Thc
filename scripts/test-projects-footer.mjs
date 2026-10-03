import assert from 'node:assert/strict';
import { assertProjectsFooter, verifyProjectsRoutes } from './verify-projects-footer.mjs';

const footer = '<footer data-dtf-shell="footer-v6" data-dtf-sitewide-footer="canonical-eight-v1">Shared footer</footer>';
const fingerprint = 'dtf-release-fingerprint: test-projects';
const html = `<!-- ${fingerprint} -->This roadmap follows the same release records used by DTFSeeds deployment.${footer}`;
assertProjectsFooter(footer);
assertProjectsFooter(footer.replaceAll('"', "'"));
assertProjectsFooter(`<!-- <footer>example</footer> --><script>const example='<footer></footer>';</script>${footer}`);
for (const bad of ['', '<footer>Legacy</footer>', `${footer}<footer>Legacy</footer>`, footer + footer, footer.replace('</footer>', '')]) {
  assert.throws(() => assertProjectsFooter(bad), /footer/);
}

const requested = [];
const makeResponse = (body = html, status = 200, extraHeaders = {}) => new Response(body, { status, headers: { 'content-type': 'text/html', ...extraHeaders } });
const result = await verifyProjectsRoutes({ fingerprint, fetchImpl: async (url, options) => {
  requested.push(new URL(url));
  assert.equal(options.redirect, 'manual');
  return makeResponse();
} });
assert.equal(result.checks.length, 4);
assert.deepEqual(requested.map(url => [url.pathname, url.searchParams.has('dtf_footer_check')]), [
  ['/projects/', false], ['/projects/', true], ['/projects/index.html', false], ['/projects/index.html', true],
]);
for (const response of [makeResponse(html + footer), makeResponse(html, 302, { location: '/projects/' }), makeResponse(html.replace(fingerprint, 'stale')), makeResponse(html, 200, { 'content-type': 'application/json' })]) {
  await assert.rejects(verifyProjectsRoutes({ fingerprint, fetchImpl: async () => response }));
}
await assert.rejects(verifyProjectsRoutes({ fingerprint, fetchImpl: async () => { throw new Error('Network unavailable'); } }), /Network unavailable/);
console.log('Projects footer guard passed: element counts, canonical identity, both routes/cache variants, stale/redirect/network failures.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyHubContract } from './verify-public-hub-contract.mjs';
import { SITEWIDE_FOOTER_HTML, SITEWIDE_FOOTER_MARKER } from './lib/sitewide-footer-template-v6.mjs';

const source = '<h1>Current hub</h1><a href="/games/one/">One</a><a href="/tools/">Tools</a>';
assert.equal(verifyHubContract(source,source).destinations,2);
assert.throws(() => verifyHubContract(source, '<h1>Current hub</h1>'), /missing packaged/);
assert.throws(() => verifyHubContract(source, source.replace('Current hub','Stale hub')), /H1/);
assert.throws(() => verifyHubContract('<h1>Empty</h1>','<h1>Empty</h1>'), /no internal/);
assert.equal(verifyHubContract(`<main>${source}</main><footer><a href="/old-footer/">Old</a></footer>`, `<main>${source}</main>`).destinations,2);
assert.throws(() => verifyHubContract(`<main>${source}</main>`, source), /main content/);
for (const route of ['games','projects']) {
  const html = readFileSync(`site/public-route-patch/${route}/index.html`,'utf8');
  assert.ok(verifyHubContract(html,html).destinations > 5);
}
assert.ok(SITEWIDE_FOOTER_HTML.includes(SITEWIDE_FOOTER_MARKER));
const learningWorkflow = readFileSync('.github/workflows/wordpress-learning-experience-v3-production.yml','utf8');
assert.doesNotMatch(learningWorkflow, /data-dtf-shell="footer-v3"/);
assert.equal((learningWorkflow.match(/expected_footer_marker="\$\(node/g)||[]).length,2);
console.log('Public hubs: current headings and every packaged internal destination required; stale counts unused.');

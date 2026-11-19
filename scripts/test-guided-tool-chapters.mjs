import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vpd = readFileSync('site/public-route-patch/vpd-chart/index.html', 'utf8');
const ppfd = readFileSync('site/public-route-patch/ppfd-chart/index.html', 'utf8');
const approx = (actual, target, tolerance = 0.015) => assert.ok(Math.abs(actual - target) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${target}`);
const saturation = T => 0.6108 * Math.exp(17.27 * T / (T + 237.3));
const actualAir = saturation(25) * 0.60;
approx(saturation(25) - actualAir, 1.27);
approx(saturation(23) - actualAir, 0.91);
approx(500 * 18 * 3600 / 1_000_000, 32.4, 0.00001);
approx((400 * 6 + 700 * 12) * 3600 / 1_000_000, 38.88, 0.00001);

for (const [label, html, markers] of [
  ['VPD', vpd, ['id="vpd-guided-chapter"', 'What this result actually means', '0.91 kPa', '1.27 kPa', '/learn/environment-vpd/', '/ppfd-chart/']],
  ['PPFD', ppfd, ['id="ppfd-guided-chapter"', '32.4 mol m⁻² d⁻¹', '38.88 mol m⁻² d⁻¹', '/learn/lighting/', '/vpd-chart/']]
]) {
  for (const marker of markers) assert.ok(html.includes(marker), `${label} missing learning marker: ${marker}`);
  assert.equal(html.split('</main>').length, 2, `${label} must retain one closing main`);
  assert.equal(html.split('<section').length - 1, html.split('</section>').length - 1, `${label} section elements are unbalanced`);
  assert.ok(html.includes('<details>') && html.includes('<summary>'), `${label} practice answer must be keyboard accessible`);
}
assert.ok(ppfd.includes('<div class="education">') && ppfd.includes('<article class="edu">'), 'Light Lab chapter must use existing responsive card system');
assert.ok(vpd.includes('<div class="learn-grid">'), 'VPD chapter must use existing responsive card system');
console.log('THC guided learning chapters passed: validated equations, examples, routes, and semantic structure.');

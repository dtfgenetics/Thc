import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, REQUIRED } from './verify-release-evidence.mjs';
const good = () => ({
  project: 'THC', release: 'example', productionUrl: 'https://dtfseeds.com',
  gates: Object.fromEntries(REQUIRED.map(k => [k, {status:'passed',checkedAt:'2026-10-16T14:00:00Z',evidence:['https://github.com/dtfgenetics/Thc/actions']}]))
});
test('a complete evidence manifest passes structural validation', () => assert.deepEqual(validate(good()), []));
test('a missing gate blocks release', () => { const m=good(); delete m.gates.visual; assert.match(validate(m).join(','),/visual/); });
test('unchecked or placeholder evidence blocks release', () => { const m=good(); m.gates.scientific.evidence=['todo']; assert.match(validate(m).join(','),/scientific/); });
test('insecure production URL blocks release', () => {const m=good();m.productionUrl='http://example.com'; assert.match(validate(m).join(','),/productionUrl/);});
test('invalid timestamp blocks release', () => {const m=good();m.gates.outcome.checkedAt='not-a-date';assert.match(validate(m).join(','),/outcome/);});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const d = JSON.parse(load('../docs/education/diagnostics/root-zone-soil-case.json'));
const svg = load('../docs/education/diagnostics/root-zone-evidence-path.svg');
const base = JSON.parse(load('../site/wordpress/education/diagnostic-case-lab-v1.json'));
const extension = JSON.parse(load('../site/wordpress/education/diagnostic-case-lab-v2-extension.json'));
assert.equal(d.schemaVersion, 1);
assert.equal(d.status, 'supplemental-unpublished');
assert.equal(d.route, '/learn/diagnostic-cases/');
assert.equal(d.context.containerLiters, 11);
assert.equal(d.context.EC, 'unknown');
assert.match(d.context.pH, /numerical value.*not supplied/i);
assert.equal(d.hypotheses.length, 4);
assert.deepEqual(d.hypotheses.map(x => x.rank), [1, 2, 3, 4]);
assert(d.hypotheses.every(x => x.supports.length && x.confirm.length && x.challenge.length && x.confidence));
assert(d.decisionRules.some(x => x.includes('Do not call nutrient lockout confirmed')));
assert(d.decisionRules.some(x => x.includes('different sampling methods')));
assert(d.sources.every(x => typeof x.doi === 'string' && /^10\.[0-9]+\//.test(x.doi)));
const validSources = new Set([...base.sourceRefs, ...extension.sourceRefs].map(x => x.id));
assert(d.sources.every(x => validSources.has(x.id)), 'Supplemental citations must resolve to canonical Case Lab sources');
assert(![...base.cases, ...extension.cases].some(x => x.id === d.id), 'Supplemental case must not duplicate published case IDs');
assert.equal(base.cases.length + extension.cases.length, 24, 'Preserve publisher case count');
assert.equal(base.decisionTrees.length + extension.decisionTrees.length, 12, 'Preserve publisher tree count');
assert.equal(base.sourceRefs.length + extension.sourceRefs.length, 13, 'Preserve publisher reference count');
assert.equal(d.visual, 'docs/education/diagnostics/root-zone-evidence-path.svg');
assert.match(svg, /<svg\b/);
assert.match(svg, /role="img"/);
assert.match(svg, /<title\b/);
assert.match(svg, /<desc\b/);
assert(!/guaranteed cure|confirmed lockout|100% certain/i.test(JSON.stringify(d)));
const protocol = load('../docs/education/diagnostics/root-zone-evidence-protocol.md');
for (const section of ['Evidence priority', 'Sample comparability rules', 'Differential checkpoints', 'Photo evidence plan', 'Interpretation template']) {
  assert(protocol.includes(section), `Protocol missing: ${section}`);
}
for (const term of ['mS/cm', 'sample location', 'runoff', 'tissue', 'old necrotic leaves', 'synthetic reference']) {
  assert(protocol.toLowerCase().includes(term.toLowerCase()), `Protocol missing concept: ${term}`);
}
assert(protocol.includes('10.3390/plants12030422'));
assert(protocol.includes('10.3389/fpls.2025.1433985'));
const mechanismSvg = load('../docs/education/diagnostics/root-zone-mechanisms.svg');
assert.match(mechanismSvg, /role="img"/);
assert.match(mechanismSvg, /<title\\b/);
assert.match(mechanismSvg, /<desc\\b/);
for (const label of ['Elevated salts', 'Elevated soil pH', 'Low root aeration']) {
  assert(mechanismSvg.includes(label), 'Missing mechanism: ' + label);
}
assert(protocol.includes('root-zone-mechanisms.svg'));
console.log('Root-zone diagnostic case and Case Lab compatibility checks passed');
